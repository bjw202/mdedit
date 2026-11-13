---
id: SPEC-AI-017
title: "미리보기에서 가리켜 지시하기 — 인수 기준"
version: "0.1.0"
status: draft
created: 2026-11-13
updated: 2026-11-13
---

# SPEC-AI-017 인수 기준

프롬프트 기준은 계획 단계 실측에 실제로 보낸 파일(`spike/captures/{table-column,diagram-node}.{system,user}.txt`)을 run 단계에서 `src-tauri/tests/fixtures/point-{table,diagram}-{system,user}.txt` 로 **복사**한 것이다. 미리보기 쪽 테스트는 실제 `renderMarkdown` 출력과 실제 `renderDiagram` SVG 를 쓴다(손으로 만든 마크업 금지).

공통 예시 문서(이하 「예시 문서」):

````markdown
# 요금

| 요금제 | 월 요금 | 저장 공간 |
|---|---:|---|
| 무료 | 0원 | 5GB |
| 기본 | [9,900원](https://example.com/p) | 100GB |
| 프로 | 19,900원 | 1TB |

```mermaid
flowchart LR
  A[장바구니] --> B[주문서 작성]
  B --> C{결제}
  C -->|성공| D[주문 완료]
  C -->|실패| B
```

- 목록 안 표
  | a | b |
  |---|---|
  | 1 | 2 |
````

## 자동 테스트 (vitest · cargo test)

### AC-AI17-001 — 보이는 조건 (REQ-AI17-001)
- Given: 예시 문서, 판정 함수에 (AI 켜짐, 정책 잠금, 보기 모드) 조합을 준다.
- Then: (켜짐, 잠금 없음, `split`) 에서만 가리키기가 활성이고, AI 꺼짐·정책 잠금·`editor`·`preview` 보기에서는 비활성이다.

### AC-AI17-002 — 대상 판정 (REQ-AI17-004)
- Given: 예시 문서를 `renderMarkdown` + `renderDiagram` 으로 그린 DOM.
- Then: 머리 `월 요금` 칸 → 열(열 번호 2), `9,900원` 링크 글자 → 칸(행 2, 열 2), 노드 `C` 의 글자 요소 → 노드 `C`, 연결선·연결선 글자 → 대상 아님, 목록 안 표의 칸 → 대상 아님, 상태 다이어그램 `[*]` 노드(`root_start`) → 대상 아님, 파이 다이어그램 → 대상 없음.

### AC-AI17-003 — 다이어그램 `data-line` 과 노드 ID (REQ-AI17-005, 004)
- Then: 예시 문서 렌더 결과의 `div.mermaid-container` 가 펜스 시작 줄(0부터)을 `data-line` 으로 가진다. flowchart·sequence·state·class·er·mindmap 샘플의 `renderDiagram` SVG 에서 `g.pele-node[data-id]` 를 찾을 수 있다(S3 재현 — pele 를 올려 이 계약이 깨지면 실패한다).

### AC-AI17-004 — 블록 범위와 블록 텍스트 (REQ-AI17-005, 009)
- Then: 표 대상의 블록 텍스트는 표 다섯 줄 그대로, 범위는 그 다섯 줄. 노드 대상의 요청 텍스트(`selection`)는 펜스 안 코드 다섯 줄, 카드 범위는 펜스 줄을 포함한 일곱 줄.

### AC-AI17-005 — 낡은 미리보기 (REQ-AI17-006)
- Given: 보관 소스는 예시 문서, 에디터 문서는 `기본` 행의 `100GB` 를 `200GB` 로 바꾼 것.
- Then: 표 칸 대상 판정 결과가 「낡음」이고 요청이 만들어지지 않는다. 표 밖(제목 줄)만 바꾼 문서에서는 낡음이 아니다(블록이 같은 줄에 그대로 있을 때).

### AC-AI17-006 — 대상 정보 문자열 (REQ-AI17-007)
- Then: 열 대상 = `대상: 열\n열 번호: 2 (왼쪽부터)\n열 머리: 월 요금`, 칸 대상(`9,900원`) = `대상: 칸\n행 번호: 2 (머리 행 다음부터)\n열 번호: 2 (왼쪽부터)\n열 머리: 월 요금\n칸 내용: [9,900원](https://example.com/p)`(소스 값), 노드 대상 = `대상: 노드\n노드 ID: C\n표시 글자: 결제`. 소스 행에 칸이 모자란 경우 `칸 내용: `(빈 값).

### AC-AI17-007 — 길이 한도 (REQ-AI17-008)
- Given: 12,001자 표.
- Then: 입력창이 길이 안내를 보이고 보내기가 비활성이다. 12,000자 표는 보낼 수 있다.

### AC-AI17-008 — 입력창 (REQ-AI17-009)
- Then: 대상 요약이 `열: 월 요금` / `칸: 2행 · 월 요금` / `노드: 결제 (C)`. Enter 로 보내고, Shift+Enter 는 줄바꿈, Esc 는 닫힘. 빈 지시(공백만 포함)는 보낼 수 없다.

### AC-AI17-009 — 요청 인자 (REQ-AI17-009)
- Then: 열 대상에 `연 요금으로, ×10` 을 보내면 `ai_request` 인자가 `feature: 'inline-edit'`, `presetKind: 'point-table'`, `selection` = 표 다섯 줄, `customInstruction: '연 요금으로, ×10'`, `pointer` = AC-006 의 열 문자열이고 `contextBefore`·`contextAfter` 가 없다. 노드 대상은 `presetKind: 'point-diagram'`, `selection` = 펜스 안 코드.

### AC-AI17-010 — 백엔드 조립 (REQ-AI17-010)
- Then: `point-table`(지시 `연 요금으로, ×10`, 대상 정보·블록 = S5 값)의 조립 결과가 `point-table-system.txt`·`point-table-user.txt` 와 바이트까지 같고, `point-diagram`(지시 `결제 앞에 캐시 노드 추가`)도 `point-diagram-*.txt` 와 같다. 추가 지시를 주면 시스템 끝과 재확인 블록에 `추가 지시(재요청): …` 가 붙는다. 블록에 `mdedit_pointer` 가 들어 있으면 두 태그 이름에 같은 접미사가 붙는다. `pointer` 가 없거나 공백뿐이면 오류다. `allows_web()` 이 거짓이다.

### AC-AI17-011 — 검증과 재요청 (REQ-AI17-011)
- Given: 가리키기 카드 컨트롤러에 차례로 결과를 넣는다.
- Then:
  - 표: 유효한 다른 표 → 검토 단계. 표 뒤에 설명 문단이 붙은 출력 → 첫 실패(자동 재요청 1회, `exempt`). 열 수가 다른 행이 있는 표 → 실패. 원본과 같은 표 → 실패이고 추가 지시는 `이전 결과가 원본과 같았다. 지시한 변경을 반영하라.`.
  - 다이어그램: 펜스로 감싼 유효 코드 → 검토 단계(펜스 벗김). 문법 오류 코드 → 첫 실패(오류 문구 동봉 자동 재요청).
  - 두 번째 연속 실패 → 오류 카드(「다시 시도」·「취소」만, 적용 버튼 없음). 「목록으로 정리」 폴백이 나타나지 않는다.
  - 자동 재요청은 ↻ 횟수에 세지 않는다.

### AC-AI17-012 — 결과 표시와 적용 (REQ-AI17-012, 013)
- Then: 검토 단계 카드에 결과 텍스트와 렌더된 모습(표: 미리보기 렌더러 출력의 `table`, 다이어그램: 미니 SVG)이 있다. 버튼은 「바꾸기」(강조)·「아래에 삽입」. 2,001자 이상 블록 + 완결 `unknown` 이면 「바꾸기」가 사라지고 기존 안내 문구가 뜬다(SPEC-AI-013 그대로). 「바꾸기」 적용 후 문서는 블록 범위만 결과로 바뀌고(다이어그램은 `` ```mermaid `` 펜스 포함) 되돌리기 한 번으로 원래 문서와 같아진다. 「취소」 뒤 문서는 그대로다.

### AC-AI17-013 — 다른 기능 불변 (REQ-AI17-016)
- Then: 기존 프롬프트 조립 테스트(SPEC-AI-012·016 의 바이트 비교 포함)가 수정 없이 통과한다. 가리키기 요청의 claude 인자는 `--tools` 다음이 빈 문자열이고 `--allowedTools` 가 없으며, codex 인자에 `features.apps=false`·`features.shell_tool=false`·`features.view_image=false`·`web_search=disabled` 가 있다.

## 실제 브라우저 (Playwright webkit, `e2e/preview-pointing.spec.ts`)

### AC-AI17-014 — 포인터 순서와 정리 (REQ-AI17-001, 002, 003, 014, 015)
- Given: 예시 문서, AI 켜짐, 분할 보기, `tauri-v2-ai-mock`.
- Then:
  1. ⌥ 없이 표 칸 클릭 → 입력창 없음. 칸 글자 드래그 → 텍스트가 선택되고 입력창 없음.
  2. ⌥ 누른 채 머리 `월 요금` 위로 이동 → 그 `th` 에만 강조 테두리. ⌥ 떼면 사라짐.
  3. ⌥+클릭 링크 칸(`9,900원`) → 입력창이 뜨고 브라우저 열기 호출(`open_url_in_browser`)이 **없다**. ⌥ 없이 같은 링크 클릭 → 열기 호출이 있다(기존 동작).
  4. 다이어그램 노드 `C` 의 글자 위 ⌥+클릭 → 입력창 요약 `노드: 결제 (C)`(M1 첫 확인 항목).
  5. 입력창에 지시를 넣고 Enter → `__AI_MOCK__.requests` 에 AC-009 인자의 요청 1건, 에디터에 카드가 뜨고, 미리보기의 대상 요소가 강조된 채 남는다. 카드 「취소」 → 강조가 사라진다.
  6. 보기 모드 `preview` 로 바꾼 뒤 ⌥+클릭 → 입력창 없음.
  7. 입력창이 열린 상태에서 AI 를 끄면 입력창·강조가 사라진다. 카드가 열린 상태에서 다른 파일로 바꾸면 카드·강조가 사라진다. 요청 중(`hang` 시나리오) 대상 표의 칸 하나를 에디터에서 고치면 카드가 기존 침범 상태(「원문이 편집되어 멈췄어요」)가 된다.
  8. 스크롤 동기: 예시 문서를 길게 늘린 뒤 에디터를 다이어그램 펜스 줄까지 스크롤하면 미리보기의 다이어그램이 보이는 영역에 들어온다(`data-line` 추가 후 회귀 없음).

## 수동 확인 (run 단계)

### AC-AI17-015 — macOS 실기기 전체 흐름 (REQ-AI17-001~015)
- claude haiku 와 codex 기본 모델로 각각: 표 열 대상 "연 요금으로, ×10", 다이어그램 노드 대상 "결제 앞에 캐시 노드 추가" → 카드에 렌더된 결과 → 「바꾸기」 → 미리보기 갱신 → 되돌리기 1회로 복원. 결과(지연·검증·재요청 여부)를 progress.md 에 남긴다.

### AC-AI17-016 — Windows 실기기 (REQ-AI17-001, A3)
- Windows 에서 Alt+클릭으로 입력창이 뜨고, Alt 를 뗀 뒤 창 메뉴가 포커스를 가져가지 않는지 확인한다. 기기가 없으면 미확인으로 남기고 sync 보고에 적는다.

## 완료 정의

- AC-AI17-001 ~ 013 자동 테스트 통과(`cargo test --manifest-path src-tauri/Cargo.toml`, 바뀐 파일의 `npx vitest run`), AC-AI17-014 Playwright webkit 통과, `npx tsc --noEmit`, 바뀐 파일 eslint 통과. Rust 테스트는 CI 에서 돌지 않으므로 원문을 progress.md 에 남긴다.
- AC-AI17-015 결과가 progress.md 에 기록됨. AC-AI17-016 은 확인 또는 미확인 명시.
