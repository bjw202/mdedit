// @MX:SPEC: SPEC-AI-010 REQ-AI10-016 REQ-AI10-017 REQ-AI10-019 REQ-AI10-020 REQ-AI10-021
// AC-AI10-010(경계 함수 부분)·AC-AI10-011 — 마크다운 블록 경계 탐색기의 규칙 전수와
// expandToSentenceBoundary 의 상한.
//
// TDD RED phase(수정 전 작성): `findBlockEnd` 는 아직 존재하지 않는다. 그리고
// `expandToSentenceBoundary` 는 `doc.slice(to).indexOf('\n\n')` 로 문단 끝을 찾고 빈 줄이
// 없으면 `doc.length` 로 폴백한다 — 종결 부호도 빈 줄도 없는 제목·목록·표 영역에서는
// 확장 범위가 조용히 문서 끝까지 넓어진다. 그 산출은 replace 모드가 **파괴적으로 덮어쓰는**
// 범위이므로 결함 3의 두 절반 중 위험한 쪽이다.

import { describe, it, expect } from 'vitest';
import {
  findBlockEnd,
  expandToSentenceBoundary,
} from '@/components/editor/extensions/ai-suggestion-card';

describe('findBlockEnd: 마크다운 블록 경계 탐색 (REQ-AI10-016/017)', () => {
  it('순수 함수다 — 문자열 인자만으로 호출된다(EditorView/DOM/스토어 무의존)', () => {
    expect(typeof findBlockEnd).toBe('function');
    expect(findBlockEnd('abc', 0)).toBe(3);
  });

  // 7종 블록 시작 — 각각 "그 줄 직전"(개행 앞)에서 멈춘다.
  const BLOCK_STARTS: Array<[string, string]> = [
    ['ATX 제목', '# 제목'],
    ['ATX 제목(h6)', '###### 제목'],
    ['순서 없는 목록(-)', '- 항목'],
    ['순서 없는 목록(*)', '* 항목'],
    ['순서 없는 목록(+)', '+ 항목'],
    ['순서 있는 목록(1.)', '1. 항목'],
    ['순서 있는 목록(1))', '1) 항목'],
    ['인용', '> 인용'],
    ['표 행', '| a | b |'],
    ['코드 펜스(```)', '```js'],
    ['코드 펜스(~~~)', '~~~'],
    ['구분선(---)', '---'],
    ['구분선(***)', '***'],
    ['구분선(___)', '___'],
  ];

  for (const [label, nextLine] of BLOCK_STARTS) {
    it(`다음 줄이 ${label} 이면 그 직전에서 멈춘다`, () => {
      // 시작 줄은 산문이 아니라 목록으로 둬서 "빈 줄 다음의 ---" 예외 조건과 섞이지 않게 한다.
      const first = '- 시작 항목';
      const doc = `${first}\n${nextLine}\n뒤 내용`;
      expect(findBlockEnd(doc, 0)).toBe(first.length);
    });
  }

  it('다음 줄이 빈 줄이면 그 직전에서 멈춘다', () => {
    const doc = '본문 줄\n\n다음 문단';
    expect(findBlockEnd(doc, 0)).toBe('본문 줄'.length);
  });

  it('다음 줄이 공백만 있는 줄이어도 그 직전에서 멈춘다', () => {
    const doc = '본문 줄\n   \n다음 문단';
    expect(findBlockEnd(doc, 0)).toBe('본문 줄'.length);
  });

  it('산문 연속 줄은 계속 전진해 먼저 만나는 블록 시작 직전에서 멈춘다', () => {
    const doc = '첫 줄\n둘째 줄\n셋째 줄\n## 다음 절';
    expect(findBlockEnd(doc, 0)).toBe('첫 줄\n둘째 줄\n셋째 줄'.length);
  });

  // REQ-AI10-017 예외 조항은 "그 줄을 구분선이 아니라 setext 제목 밑줄로 보아 **연속 줄로
  // 취급한다**"까지만 규정한다 — 밑줄이 블록을 끝낸다고는 하지 않는다. 따라서 단언은
  // "밑줄에서 멈추지 않는다"이며, 뒤에 블록 시작이 오면 거기서 멈춘다.
  it('setext 밑줄 예외: 산문 줄 바로 다음의 --- 는 구분선이 아니라 제목 밑줄이다', () => {
    const doc = '제목 텍스트\n---\n## 다음 절';
    // 밑줄에서 멈추면 제목 텍스트와 밑줄 **사이**에 내용이 삽입되어 문서 구조가 깨진다.
    expect(findBlockEnd(doc, 0)).not.toBe('제목 텍스트'.length);
    expect(findBlockEnd(doc, 0)).toBe('제목 텍스트\n---'.length);
  });

  it('setext 밑줄 예외: === 도 동일하게 연속으로 취급한다', () => {
    const doc = '제목 텍스트\n===\n## 다음 절';
    expect(findBlockEnd(doc, 0)).not.toBe('제목 텍스트'.length);
    expect(findBlockEnd(doc, 0)).toBe('제목 텍스트\n==='.length);
  });

  it('빈 줄 다음의 --- 는 setext 가 아니라 구분선이므로 멈춘다', () => {
    const doc = '본문\n\n---\n뒤';
    expect(findBlockEnd(doc, 0)).toBe('본문'.length);
  });

  it('블록 시작 줄 다음의 --- 도 구분선이므로 멈춘다', () => {
    const doc = '- 항목\n---\n뒤';
    expect(findBlockEnd(doc, 0)).toBe('- 항목'.length);
  });

  it('들여쓰기 0~3칸은 블록 시작으로 인정한다', () => {
    for (const indent of ['', ' ', '  ', '   ']) {
      const doc = `본문 줄\n${indent}- 항목\n뒤`;
      expect(findBlockEnd(doc, 0)).toBe('본문 줄'.length);
    }
  });

  it('들여쓰기 4칸 이상은 들여쓴 코드로 보아 블록 시작이 아니다', () => {
    const doc = '본문 줄\n    - 항목\n\n뒤';
    expect(findBlockEnd(doc, 0)).toBe('본문 줄\n    - 항목'.length);
  });

  it('EOF 에 도달하면 doc.length 를 반환한다(REQ-AI10-021)', () => {
    const doc = '첫 줄\n둘째 줄\n셋째 줄';
    expect(findBlockEnd(doc, 0)).toBe(doc.length);
  });

  it('스캔은 시작 오프셋이 속한 줄의 **다음 줄**부터 한다(EC-6)', () => {
    // 시작 줄 자신이 목록 항목이어도 즉시 0폭으로 멈추지 않는다.
    const doc = '- 하나\n- 둘\n- 셋';
    expect(findBlockEnd(doc, 0)).toBe('- 하나'.length);
    expect(findBlockEnd(doc, '- 하나'.length)).toBe('- 하나'.length);
  });

  it('시작 오프셋이 doc.length 면 doc.length 를 반환한다(EC-7)', () => {
    const doc = '- 하나\n- 둘';
    expect(findBlockEnd(doc, doc.length)).toBe(doc.length);
  });

  it('빈 문서 / 개행 없는 한 줄 문서에서도 예외 없이 doc.length 를 반환한다(EC-9)', () => {
    expect(findBlockEnd('', 0)).toBe(0);
    expect(findBlockEnd('한 줄뿐', 0)).toBe('한 줄뿐'.length);
  });

  it('반환값은 개행 문자 **앞** 오프셋이다', () => {
    const doc = '본문\n\n뒤';
    const end = findBlockEnd(doc, 0);
    expect(doc[end]).toBe('\n');
  });
});

describe('expandToSentenceBoundary: 상한이 블록 끝이다 (AC-AI10-011)', () => {
  it('종결 부호가 없는 제목 영역에서 확장이 그 줄 끝까지만 간다(문서 끝이 아니다)', () => {
    const doc = '## 제목\n- 하나\n- 둘\n- 셋';
    const r = expandToSentenceBoundary(doc, 0, 3);
    expect(r.to).toBe('## 제목'.length);
    expect(r.to).not.toBe(doc.length);
    expect(r.expanded).toBe(true);
  });

  it('산문 연속 줄 뒤에 제목이 오면 문단 전체까지만 확장한다', () => {
    const doc = '첫 줄\n둘째 줄\n## 다음 절';
    const r = expandToSentenceBoundary(doc, 0, 2);
    expect(r.to).toBe('첫 줄\n둘째 줄'.length);
  });

  it('종결 부호가 존재하는 기존 케이스의 반환값은 개정 전과 동일하다', () => {
    const doc = 'Keep this. Extra sentence here. Tail.';
    const r = expandToSentenceBoundary(doc, 0, 'Keep this. Extra'.length);
    expect(doc.slice(r.from, r.to)).toBe('Keep this. Extra sentence here.');
    expect(r.expanded).toBe(true);
  });

  it('이미 종결 부호/문단 경계에서 끝나면 조기 반환한다(무변경)', () => {
    const doc = 'Hello world. More text';
    expect(expandToSentenceBoundary(doc, 0, 'Hello world.'.length)).toEqual({
      from: 0,
      to: 'Hello world.'.length,
      expanded: false,
    });
    const doc2 = 'abc def\n\nnext';
    expect(expandToSentenceBoundary(doc2, 0, 'abc def'.length).expanded).toBe(false);
  });
});
