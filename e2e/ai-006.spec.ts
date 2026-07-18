// SPEC-AI-006 E2E: 프롬프트 정밀도·지연 워치독·이어쓰기 보조 UX 5종 전체 여정 (실 WebKit 엔진).
// 커버: (1) 인라인 변환 시 선택 스코핑(다른 섹션 미흡수, mock 응답 기반), (2) 이어쓰기 길이
// 옵션(설정 토글 → 발행 payload 반영), (3) 장시간 대기 안내 문구(8초 임계, page.clock),
// (4) 고스트 재요청(↻, 동일 컨텍스트 재발행), (5) 콘솔 에러 0.
// 선례: ai-inline-edit.spec.ts(선택 툴바 여정), ai-free-continue.spec.ts(자유 위치 이어쓰기
// 여정), ai-toggle.spec.ts(SettingsModal 열기/닫기 패턴).
// 타임아웃 하드 워치독(항목 2, 60초)·프롬프트 스코핑 절 자체(항목 1)는 Rust 단(cargo test)에서
// 검증되며, 여기서는 프론트 계약(payload 구성·DOM 표출)만 다룬다(acceptance.md 명시 제약).
import { test, expect, AiMockScenario } from './fixtures/tauri-v2-ai-mock';
import type { Page } from '@playwright/test';

const CONTINUE_DOC = '첫 문단이 끊겨서\n\n둘째 문단은 그대로 남아야 한다.';

// 다중 섹션 문서 — 스코핑 검증용(AC-AI6-001 A-1 유사 구성).
const MULTI_SECTION_DOC = [
  '# 문서 제목',
  '',
  '## 1. 개요',
  '이 문서는 여러 섹션을 포함한 예시 문서입니다.',
  '',
  '## 2. 인증 흐름',
  '사용자는 로그인 후 토큰을 발급받아 API 를 호출합니다.',
  '',
  '## 3. 태그 분류 규칙',
  '태그는 소문자 케밥 케이스로 통일하고 최대 5개까지 허용합니다.',
].join('\n');

async function openEditorAtFirstLineEnd(page: Page): Promise<void> {
  await page.goto('/');
  const editor = page.locator('.cm-content');
  await editor.waitFor({ timeout: 10_000 });
  await editor.click();
  await editor.fill(CONTINUE_DOC);
  await page.keyboard.press('ControlOrMeta+Home');
  await page.keyboard.press('End');
}

async function setScenario(page: Page, scenario: AiMockScenario): Promise<void> {
  await page.evaluate((s) => {
    window.__AI_MOCK__.scenario = s;
  }, scenario);
}

async function openSettings(page: Page): Promise<void> {
  await page.locator('button[aria-label="Settings"]').click();
  await expect(page.locator('[role="dialog"][aria-label="설정"]')).toBeVisible({
    timeout: 5_000,
  });
}

async function closeSettings(page: Page): Promise<void> {
  await page.locator('[data-testid="settings-backdrop"]').click({ position: { x: 5, y: 5 } });
  await expect(page.locator('[role="dialog"][aria-label="설정"]')).toHaveCount(0, {
    timeout: 3_000,
  });
}

function continueLengthToggle(page: Page) {
  return page.locator('input[aria-label="이어쓰기 짧게 쓰기"]');
}

async function aiRequestArgsList(
  page: Page,
): Promise<Array<Record<string, unknown>>> {
  return page.evaluate(() =>
    window.__AI_MOCK__.requests
      .filter((r) => r.cmd === 'ai_request')
      .map((r) => (r.payload as { args: Record<string, unknown> }).args),
  );
}

test.describe('SPEC-AI-006 e2e', () => {
  test('고스트 재요청(↻): done 상태에만 노출, 클릭 시 동일 컨텍스트로 새 requestId 재발행', async ({
    aiPage,
  }) => {
    const consoleErrors: string[] = [];
    aiPage.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    aiPage.on('pageerror', (err) => consoleErrors.push(`pageerror: ${err.message}`));

    await openEditorAtFirstLineEnd(aiPage);
    // 'hang' 시나리오로 청크/완료 타이밍을 전적으로 수동 제어한다 — 'success' 는 실시간
    // (~120ms)으로 자동 완료되어 상태 전이 단언 시점을 결정적으로 잡기 어렵다(전체 스위트 부하 시
    // 관찰된 레이스). [주의] `GhostControlsWidget`은 `value.status`가 설정된 뒤에만 렌더링되며,
    // 그 값은 aiStore 구독 콜백(ghostStoreBridge)이 스트림 상태 변화를 감지해야 실린다 — 발행
    // 직후(첫 청크 도착 전)에는 status 가 비어 있어 컨트롤 자체가 아직 DOM 에 없다(구현 확인).
    // 따라서 "streaming 중 ↻ 부재"는 첫 청크 도착 이후(status='streaming')를 기준으로 검증한다.
    await setScenario(aiPage, 'hang');
    await aiPage.keyboard.press('ControlOrMeta+Enter');

    const placeholder = aiPage.locator('.mdedit-ai-ghost-placeholder');
    await expect(placeholder).toBeVisible({ timeout: 5_000 });

    const before = await aiRequestArgsList(aiPage);
    expect(before).toHaveLength(1);
    const firstArgs = before[0];

    // 첫 청크만 주입 — streaming 상태로 결정적 전이(아직 완료 아님).
    await aiPage.evaluate(
      ({ id }) => window.__AI_MOCK__.emit('ai://chunk', { requestId: id, text: '이어지는 내용' }),
      { id: firstArgs.requestId as string },
    );

    // streaming 중엔 ↻ 부재 — [■ 중지]만 노출된다(REQ-AI6-011).
    const controls = aiPage.locator('.cm-ai-ghost-controls');
    await expect(controls).toBeVisible({ timeout: 5_000 });
    await expect(aiPage.locator('.cm-ai-ghost-redo-btn')).toHaveCount(0);
    await expect(controls.locator('.cm-ai-ghost-btn', { hasText: '■ 중지' })).toBeVisible();

    // 완료 주입 — done 으로 결정적으로 전이시킨다.
    await aiPage.evaluate(
      ({ id }) => window.__AI_MOCK__.emit('ai://done', { requestId: id, result: '이어지는 내용' }),
      { id: firstArgs.requestId as string },
    );

    // done 전환 후 ↻ 노출(REQ-AI6-010).
    const redo = aiPage.locator('.cm-ai-ghost-redo-btn');
    await expect(redo).toBeVisible({ timeout: 5_000 });
    await expect(controls.locator('.cm-ai-ghost-btn')).toHaveCount(2); // 넣기·지우기만(재요청 제외)

    await redo.click();

    await expect
      .poll(async () => (await aiRequestArgsList(aiPage)).length, { timeout: 5_000 })
      .toBe(2);
    const after = await aiRequestArgsList(aiPage);
    const secondArgs = after[1];

    // 새 requestId — 그러나 그 외 트리거 인자(feature/presetKind/model/outline/컨텍스트)는
    // 동일하게 재사용된다(D5, 재파생 아님).
    expect(secondArgs.requestId).not.toBe(firstArgs.requestId);
    const { requestId: _f, ...firstRest } = firstArgs;
    const { requestId: _s, ...secondRest } = secondArgs;
    expect(secondRest).toEqual(firstRest);

    const critical = consoleErrors.filter(
      (e) => e.includes('RangeError') || e.includes('Uncaught') || e.startsWith('pageerror'),
    );
    expect(critical).toHaveLength(0);
  });

  test('이어쓰기 길이 옵션: 기본은 normal, 설정 토글로 short 발행 반영(REQ-AI6-012/013)', async ({
    aiPage,
  }) => {
    // 1) 기본값(미설정) — normal 이 실려 발행된다.
    await openEditorAtFirstLineEnd(aiPage);
    await aiPage.keyboard.press('ControlOrMeta+Enter');
    await expect
      .poll(async () => (await aiRequestArgsList(aiPage)).length, { timeout: 5_000 })
      .toBe(1);
    const defaultArgs = (await aiRequestArgsList(aiPage))[0];
    expect(defaultArgs.length).toBe('normal');

    // 2) 설정에서 '짧게'로 전환 후 재발행하면 short 가 실린다. 기존 고스트를 지우고
    // (Esc → dismissGhostCommand) 같은 위치에서 다시 트리거한다.
    await aiPage.keyboard.press('Escape');
    await openSettings(aiPage);
    const toggle = continueLengthToggle(aiPage);
    await expect(toggle).not.toBeChecked();
    await toggle.click();
    await expect(toggle).toBeChecked();
    await closeSettings(aiPage);

    await aiPage.locator('.cm-content').click();
    await aiPage.keyboard.press('ControlOrMeta+Home');
    await aiPage.keyboard.press('End');
    await aiPage.keyboard.press('ControlOrMeta+Enter');

    await expect
      .poll(async () => (await aiRequestArgsList(aiPage)).length, { timeout: 5_000 })
      .toBe(2);
    const shortArgs = (await aiRequestArgsList(aiPage))[1];
    expect(shortArgs.length).toBe('short');
  });

  test('장시간 대기 안내 문구: 8초 임계 전엔 없고, 경과 후 표시되며, 첫 청크 도착 시 제거(REQ-AI6-007/008/009)', async ({
    aiPage,
  }) => {
    await aiPage.clock.install();
    await openEditorAtFirstLineEnd(aiPage);
    await setScenario(aiPage, 'hang'); // 첫 청크가 오지 않는 시나리오
    await aiPage.keyboard.press('ControlOrMeta+Enter');

    const placeholder = aiPage.locator('.mdedit-ai-ghost-placeholder');
    await expect(placeholder).toBeVisible({ timeout: 5_000 });

    // 임계(8초) 전 — 대기 안내 문구 없음.
    const notice = aiPage.locator('.mdedit-ai-wait-notice');
    await expect(notice).toHaveCount(0);

    // 임계 경과 — 보조 문구 표시. 가짜 진행률 요소는 존재하지 않는다(REQ-AI6-009).
    await aiPage.clock.runFor(8_100);
    await expect(notice).toBeVisible({ timeout: 3_000 });
    await expect(notice).toContainText('아직 생성 중이에요');
    await expect(aiPage.locator('[role="progressbar"]')).toHaveCount(0);
    await expect(aiPage.locator('.mdedit-ai-progress')).toHaveCount(0);

    // 첫 청크 도착 → 안내 즉시 제거.
    const requestId = await aiPage.evaluate(() => {
      const req = window.__AI_MOCK__.requests.find((r) => r.cmd === 'ai_request');
      return (req!.payload as { args: { requestId: string } }).args.requestId;
    });
    await aiPage.evaluate(
      ({ id }) => window.__AI_MOCK__.emit('ai://chunk', { requestId: id, text: '이어지는 내용' }),
      { id: requestId },
    );
    await expect(notice).toHaveCount(0, { timeout: 3_000 });
  });

  test('인라인 변환 스코핑: 선택한 문단만 발행 페이로드에 실리고 다른 섹션은 포함되지 않는다(AC-AI6-001)', async ({
    aiPage,
  }) => {
    await aiPage.goto('/');
    const editor = aiPage.locator('.cm-content');
    await editor.waitFor({ timeout: 10_000 });
    await editor.click();
    await editor.fill(MULTI_SECTION_DOC);

    // "2. 인증 흐름" 본문 문단만 선택(더블클릭 후 라인 전체 선택은 불안정하므로 텍스트 검색 후
    // Shift+End 로 라인 선택).
    const target = '사용자는 로그인 후 토큰을 발급받아 API 를 호출합니다.';
    await editor.evaluate((el, text) => {
      const idx = el.textContent?.indexOf(text) ?? -1;
      if (idx < 0) throw new Error('target text not found');
    }, target);

    // 커서를 문서 시작으로 이동 후 대상 문단이 나올 때까지 아래로 이동, 라인 선택.
    await aiPage.keyboard.press('ControlOrMeta+Home');
    const lines = MULTI_SECTION_DOC.split('\n');
    const targetLineIndex = lines.findIndex((l) => l === target);
    for (let i = 0; i < targetLineIndex; i += 1) {
      await aiPage.keyboard.press('ArrowDown');
    }
    await aiPage.keyboard.press('Home');
    await aiPage.keyboard.press('Shift+End');

    await aiPage.locator('.mdedit-ai-sparkle-btn').click();
    await aiPage
      .locator('.mdedit-ai-preset-menu .mdedit-ai-preset-item', { hasText: '짧게 줄이기' })
      .click();

    await expect(aiPage.locator('.mdedit-ai-card')).toBeVisible({ timeout: 5_000 });

    const req = await aiPage.evaluate(() =>
      window.__AI_MOCK__.requests.find((r) => r.cmd === 'ai_request'),
    );
    expect(req).toBeTruthy();
    const args = (req!.payload as { args: Record<string, unknown> }).args;
    expect(args.selection).toBe(target);
    expect(args.selection).not.toContain('개요');
    expect(args.selection).not.toContain('태그 분류');
  });
});
