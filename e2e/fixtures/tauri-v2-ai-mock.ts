// SPEC-AI-001 E2E: Tauri v2 IPC 충실 목 (__TAURI_INTERNALS__ + plugin:event).
// Rust 측 계약을 그대로 재현한다:
//  - ai_request 는 페이로드 최상위에 `args` 키가 있어야 하며(camelCase 필드),
//    없으면 실제 Tauri 디스패치처럼 "invalid args" 로 거부한다.
//  - 스트리밍은 ai://chunk N회 → ai://done (requestId 일치) 순서.
//  - 오류 시나리오는 ai://error { kind, message, cancelledBy? }.
// 시나리오는 window.__AI_MOCK__.scenario 로 제어한다(테스트에서 evaluate 로 변경).
import { test as base, Page } from '@playwright/test';

export type AiMockScenario =
  | 'success'
  | 'login-error'
  | 'network-error'
  | 'invoke-reject'
  | 'hang' // 스트림이 오지 않음(취소 테스트용)
  // BUG-1/2/3 실기기 재현: 1차 응답은 펜스로 감쌌지만 문법이 진짜 무효인 다이어그램,
  // 재요청(2차) 응답은 펜스로 감싼 유효 다이어그램. ai_request 호출 순번으로 분기한다.
  | 'diagram-fenced-then-valid';

declare global {
  interface Window {
    __AI_MOCK__: {
      scenario: AiMockScenario;
      requests: Array<{ cmd: string; payload: unknown }>;
      resultText: string;
      emit: (event: string, payload: unknown) => void;
    };
  }
}

async function injectTauriV2Mock(page: Page): Promise<void> {
  await page.addInitScript(() => {
    let nextCallbackId = 1;
    let nextEventId = 1;
    const callbacks = new Map<number, (arg: unknown) => void>();
    // eventName → Set<callbackId>
    const listeners = new Map<string, Set<number>>();

    const mockState = {
      scenario: 'success' as string,
      requests: [] as Array<{ cmd: string; payload: unknown }>,
      resultText: '다듬은 결과 문장이에요.',
      // 'diagram-fenced-then-valid' 시나리오의 ai_request 호출 순번(1차 무효 → 2차 유효).
      diagramCallCount: 0,
      emit(event: string, payload: unknown) {
        const ids = listeners.get(event);
        if (!ids) return;
        for (const id of ids) {
          const cb = callbacks.get(id);
          if (cb) cb({ event, id: nextEventId++, payload });
        }
      },
    };
    (window as unknown as Record<string, unknown>).__AI_MOCK__ = mockState;

    function streamSuccess(requestId: string): void {
      const text = mockState.resultText;
      const mid = Math.ceil(text.length / 2);
      const chunks = [text.slice(0, mid), text.slice(mid)];
      let delay = 30;
      for (const chunk of chunks) {
        setTimeout(() => mockState.emit('ai://chunk', { requestId, text: chunk }), delay);
        delay += 30;
      }
      setTimeout(
        () => mockState.emit('ai://done', { requestId, result: text }),
        delay + 30
      );
    }

    function handleAiRequest(payload: unknown): Promise<unknown> {
      // 실제 Tauri 디스패치 재현: 파라미터 이름 `args` 키 필수.
      const p = payload as { args?: Record<string, unknown> } | undefined;
      if (!p || typeof p.args !== 'object' || p.args === null) {
        return Promise.reject(
          'invalid args `args` for command `ai_request`: command ai_request missing required key args'
        );
      }
      const args = p.args;
      if (typeof args.requestId !== 'string' || typeof args.feature !== 'string') {
        return Promise.reject('invalid args: requestId/feature required');
      }
      const requestId = args.requestId as string;
      switch (mockState.scenario) {
        case 'invoke-reject':
          return Promise.reject('AI 기능이 조직 정책으로 비활성화되어 있어요.');
        case 'login-error':
          setTimeout(
            () =>
              mockState.emit('ai://error', {
                requestId,
                kind: 'login',
                message: '로그인이 풀렸어요. 연결 안내를 확인해주세요.',
              }),
            40
          );
          return Promise.resolve(null);
        case 'network-error':
          setTimeout(
            () =>
              mockState.emit('ai://error', {
                requestId,
                kind: 'network',
                message: '네트워크에 연결할 수 없어요.',
              }),
            40
          );
          return Promise.resolve(null);
        case 'hang':
          return Promise.resolve(null);
        case 'diagram-fenced-then-valid': {
          mockState.diagramCallCount += 1;
          const isFirstAttempt = mockState.diagramCallCount === 1;
          // 1차: 펜스로 감쌌지만 진짜 무효 문법(자동 재요청을 유발해야 함).
          // 2차(자동 재요청): 펜스로 감싼 유효 mermaid(펜스 제거 후 검증 통과해야 함, BUG-3a).
          const text = isFirstAttempt
            ? '```mermaid\nnotarealdiagramtype foo!!!\n```'
            : '```mermaid\nflowchart LR\n  A[접수] --> B[검토] --> C[승인]\n```';
          setTimeout(() => mockState.emit('ai://chunk', { requestId, text }), 30);
          setTimeout(() => mockState.emit('ai://done', { requestId, result: text }), 60);
          return Promise.resolve(null);
        }
        default:
          streamSuccess(requestId);
          return Promise.resolve(null);
      }
    }

    function handleAiCancel(payload: unknown): Promise<unknown> {
      const p = payload as { args?: { requestId?: string } } | undefined;
      if (!p || typeof p.args !== 'object' || p.args === null) {
        return Promise.reject(
          'invalid args `args` for command `ai_cancel`: command ai_cancel missing required key args'
        );
      }
      const requestId = p.args.requestId ?? '';
      setTimeout(
        () =>
          mockState.emit('ai://error', {
            requestId,
            kind: 'other',
            message: '요청을 취소했어요.',
            cancelledBy: 'user',
          }),
        20
      );
      return Promise.resolve(null);
    }

    const internals = {
      transformCallback(cb: (arg: unknown) => void, _once?: boolean): number {
        const id = nextCallbackId++;
        callbacks.set(id, cb);
        return id;
      },
      unregisterCallback(id: number): void {
        callbacks.delete(id);
      },
      convertFileSrc(p: string): string {
        return p;
      },
      invoke(cmd: string, payload?: unknown): Promise<unknown> {
        mockState.requests.push({ cmd, payload });
        switch (cmd) {
          case 'plugin:event|listen': {
            const { event, handler } = payload as { event: string; handler: number };
            if (!listeners.has(event)) listeners.set(event, new Set());
            listeners.get(event)!.add(handler);
            return Promise.resolve(nextEventId++);
          }
          case 'plugin:event|unlisten': {
            const { event, eventId } = payload as { event: string; eventId: number };
            void eventId;
            // callbackId 기준 관리이므로 통째로 두되 unregisterCallback 이 실효 해제한다.
            void event;
            return Promise.resolve(null);
          }
          case 'ai_detect_providers':
            return Promise.resolve([
              { id: 'claude', installed: true, version: '2.1.211', loggedIn: true },
            ]);
          case 'ai_policy_status':
            return Promise.resolve({ disabled: false });
          case 'ai_request':
            return handleAiRequest(payload);
          case 'ai_cancel':
            return handleAiCancel(payload);
          default:
            return Promise.resolve(null);
        }
      },
    };

    (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = internals;
    (window as unknown as Record<string, unknown>).__TAURI_EVENT_PLUGIN_INTERNALS__ = {
      unregisterListener: (_event: string, _eventId: number) => {},
    };
  });
}

export const test = base.extend<{ aiPage: Page }>({
  aiPage: async ({ page }, use) => {
    await injectTauriV2Mock(page);
    await use(page);
  },
});

export { expect } from '@playwright/test';
