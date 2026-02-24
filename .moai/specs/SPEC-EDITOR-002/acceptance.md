# Acceptance Criteria: SPEC-EDITOR-002 Editor UX Enhancements

## Test Scenarios

### Scenario 1: 저장 피드백 - Saved 상태 표시

- **Given**: 에디터에 파일이 열려 있고 변경사항이 없는 상태
- **When**: Footer가 렌더링될 때
- **Then**: saveStatus가 "Saved"로 표시되어야 한다
- **And**: 초록색 상태 인디케이터가 표시되어야 한다

### Scenario 2: 저장 피드백 - Unsaved 상태 전환

- **Given**: 에디터에 저장된 파일이 열려 있는 상태
- **When**: 사용자가 에디터에서 텍스트를 수정할 때
- **Then**: Footer saveStatus가 "Unsaved"로 변경되어야 한다
- **And**: 노란색 상태 인디케이터가 표시되어야 한다

### Scenario 3: 저장 피드백 - Saving → Saved 전환

- **Given**: 에디터에 미저장 변경사항이 있는 상태
- **When**: 사용자가 Ctrl+S를 누를 때
- **Then**: saveStatus가 "Saving..."으로 잠시 표시되어야 한다
- **And**: 저장 완료 후 "Saved"로 변경되어야 한다

### Scenario 4: 저장 피드백 - New 상태

- **Given**: 새 파일 상태 (currentFile이 null)
- **When**: Footer가 렌더링될 때
- **Then**: saveStatus가 "New"로 표시되어야 한다

### Scenario 5: 다른 이름으로 저장 - Ctrl+Shift+S

- **Given**: 에디터에 텍스트가 작성된 상태
- **When**: 사용자가 Ctrl+Shift+S를 누를 때
- **Then**: 네이티브 파일 저장 대화상자가 열려야 한다
- **When**: 사용자가 "my-document.md" 경로를 선택하고 확인할 때
- **Then**: 해당 경로로 파일이 저장되어야 한다
- **And**: editorStore의 currentFile이 새 경로로 업데이트되어야 한다
- **And**: saveStatus가 "Saved"로 변경되어야 한다

### Scenario 6: 다른 이름으로 저장 - 취소

- **Given**: Ctrl+Shift+S로 Save-As 대화상자가 열린 상태
- **When**: 사용자가 대화상자에서 취소를 누를 때
- **Then**: 파일이 저장되지 않아야 한다
- **And**: 이전 상태가 유지되어야 한다

### Scenario 7: 미저장 경고 - 파일 전환 시 저장

- **Given**: 에디터에 미저장 변경사항이 있는 상태 (isDirty: true)
- **When**: 사용자가 File Explorer에서 다른 파일을 클릭할 때
- **Then**: 미저장 경고 다이얼로그가 표시되어야 한다
- **And**: "저장", "저장하지 않음", "취소" 3개 옵션이 있어야 한다
- **When**: 사용자가 "저장"을 선택할 때
- **Then**: 현재 파일이 저장된 후 선택한 파일로 전환되어야 한다

### Scenario 8: 미저장 경고 - 저장하지 않고 전환

- **Given**: 미저장 경고 다이얼로그가 표시된 상태
- **When**: 사용자가 "저장하지 않음"을 선택할 때
- **Then**: 변경사항이 버려지고 선택한 파일로 전환되어야 한다

### Scenario 9: 미저장 경고 - 전환 취소

- **Given**: 미저장 경고 다이얼로그가 표시된 상태
- **When**: 사용자가 "취소"를 선택할 때
- **Then**: 파일 전환이 취소되어야 한다
- **And**: 현재 파일과 변경사항이 유지되어야 한다

### Scenario 10: 미저장 경고 - 변경사항 없을 때

- **Given**: 에디터에 변경사항이 없는 상태 (isDirty: false)
- **When**: 사용자가 다른 파일을 클릭할 때
- **Then**: 경고 다이얼로그 없이 즉시 파일이 전환되어야 한다

### Scenario 11: 툴바 Bold 버튼

- **Given**: 에디터에서 "Hello"가 선택된 상태
- **When**: 사용자가 툴바의 Bold 버튼을 클릭할 때
- **Then**: 선택된 텍스트가 `**Hello**`로 변경되어야 한다

### Scenario 12: 툴바 Italic 버튼

- **Given**: 에디터에서 "World"가 선택된 상태
- **When**: 사용자가 툴바의 Italic 버튼을 클릭할 때
- **Then**: 선택된 텍스트가 `*World*`로 변경되어야 한다

### Scenario 13: 툴바 Heading 버튼

- **Given**: 에디터에서 커서가 "My Title" 라인에 있는 상태
- **When**: 사용자가 툴바의 Heading 버튼을 클릭할 때
- **Then**: 해당 라인이 `## My Title`로 변경되어야 한다

### Scenario 14: 툴바 List 버튼

- **Given**: 에디터에서 커서가 "Item" 라인에 있는 상태
- **When**: 사용자가 툴바의 List 버튼을 클릭할 때
- **Then**: 해당 라인이 `- Item`으로 변경되어야 한다

### Scenario 15: 툴바 Quote 버튼

- **Given**: 에디터에서 커서가 "A quote" 라인에 있는 상태
- **When**: 사용자가 툴바의 Quote 버튼을 클릭할 때
- **Then**: 해당 라인이 `> A quote`로 변경되어야 한다

### Scenario 16: 툴바 - 텍스트 선택 없이 Bold

- **Given**: 에디터에서 텍스트 선택이 없는 상태
- **When**: 사용자가 툴바의 Bold 버튼을 클릭할 때
- **Then**: 커서 위치에 `**bold**` 플레이스홀더가 삽입되어야 한다
- **And**: "bold" 텍스트가 선택된 상태여야 한다

### Scenario 17: 새 파일 - Ctrl+N

- **Given**: 에디터에 파일이 열려 있고 변경사항이 없는 상태
- **When**: 사용자가 Ctrl+N을 누를 때
- **Then**: 에디터가 빈 상태로 초기화되어야 한다
- **And**: editorStore의 currentFile이 null로 설정되어야 한다
- **And**: uiStore의 saveStatus가 "New"로 설정되어야 한다

### Scenario 18: 단어/글자 수 표시

- **Given**: 에디터에 "Hello World Test"가 입력된 상태
- **When**: Footer가 렌더링될 때
- **Then**: "3 words" 단어 수가 표시되어야 한다
- **And**: "16 chars" 글자 수가 표시되어야 한다

### Scenario 19: 단어/글자 수 - 빈 콘텐츠

- **Given**: 에디터 콘텐츠가 빈 문자열인 상태
- **When**: Footer가 렌더링될 때
- **Then**: "0 words 0 chars"로 표시되어야 한다

### Scenario 20: 단어/글자 수 - 실시간 업데이트

- **Given**: 에디터에 "Hello"가 입력된 상태 (1 word, 5 chars)
- **When**: 사용자가 " World"를 추가로 입력할 때
- **Then**: Footer가 "2 words 11 chars"로 즉시 업데이트되어야 한다

---

## Edge Cases

### Edge Case 1: Ctrl+S 새 파일 상태

- **Condition**: currentFile이 null인 상태에서 Ctrl+S를 누를 때
- **Expected**: Save-As 대화상자를 대신 표시해야 한다 (파일 경로가 없으므로)

### Edge Case 2: 다른 이름으로 저장 시 기존 파일 덮어쓰기

- **Condition**: Save-As 대화상자에서 이미 존재하는 파일 경로를 선택할 때
- **Expected**: Tauri dialog가 OS 레벨에서 덮어쓰기 확인을 처리해야 한다

### Edge Case 3: 저장 중 에러 발생

- **Condition**: 파일 저장 시 디스크 용량 부족 또는 권한 문제가 발생할 때
- **Expected**: saveStatus를 "Unsaved"로 유지하고 에러 메시지를 사용자에게 표시해야 한다

### Edge Case 4: 빠른 연속 저장

- **Condition**: 사용자가 Ctrl+S를 빠르게 여러 번 누를 때
- **Expected**: 중복 저장 요청을 방지하고 마지막 저장만 실행해야 한다

### Edge Case 5: 미저장 경고 중 파일 시스템 에러

- **Condition**: 미저장 경고에서 "저장" 선택 후 저장이 실패할 때
- **Expected**: 파일 전환을 중단하고 에러 메시지를 표시해야 한다

### Edge Case 6: 툴바 포맷 - 멀티라인 선택

- **Condition**: 여러 라인이 선택된 상태에서 Bold 버튼을 클릭할 때
- **Expected**: 선택된 전체 텍스트를 `**` 로 감싸야 한다

### Edge Case 7: Ctrl+N 미저장 변경사항

- **Condition**: 미저장 변경사항이 있는 상태에서 Ctrl+N을 누를 때
- **Expected**: 미저장 경고 다이얼로그를 표시한 후 사용자 선택에 따라 처리해야 한다

### Edge Case 8: 단어 수 - 특수 문자만 있는 경우

- **Condition**: 에디터 콘텐츠가 "--- ### ***"인 경우
- **Expected**: Markdown 문법 기호도 단어로 카운트해야 한다 (3 words)

### Edge Case 9: Heading 접두사 중복 적용

- **Condition**: 이미 `## `가 있는 라인에서 Heading 버튼을 다시 클릭할 때
- **Expected**: `## `를 추가하여 `## ## `가 되거나, 또는 헤딩 레벨을 증가시킬 수 있다 (구현 판단)

---

## Performance Criteria

| 측정 항목 | 목표 | 측정 방법 |
|-----------|------|-----------|
| 저장 피드백 상태 전환 | < 16ms | setSaveStatus 호출 ~ Footer 리렌더링 |
| 단어/글자 수 계산 (10KB) | < 10ms | content 변경 ~ 카운트 계산 완료 |
| 툴바 버튼 ~ 에디터 반영 | < 16ms | 버튼 클릭 ~ EditorView 업데이트 |
| Save-As 대화상자 표시 | < 200ms | Ctrl+Shift+S ~ 대화상자 렌더링 |
| 미저장 경고 다이얼로그 표시 | < 16ms | 파일 클릭 ~ 다이얼로그 렌더링 |
| Ctrl+N 에디터 초기화 | < 50ms | 키 입력 ~ 에디터 빈 상태 전환 |

---

## Quality Gates

### TRUST 5 검증

- **Tested**: uiStore saveStatus 상태 전이 테스트, useFileSystem unsaved warning 테스트, keyboard-shortcuts applyMarkdownFormat/prefixLine 테스트, Footer 렌더링 테스트
- **Readable**: TypeScript strict mode, 명확한 함수/변수명, 콜백 패턴 일관성
- **Unified**: Tailwind CSS 일관된 스타일링, Zustand 패턴 일관성, CodeMirror keymap 패턴 일관성
- **Secured**: Save-As 경로 검증 (Tauri dialog 자체 처리), 파일 저장 에러 핸들링
- **Trackable**: SPEC-EDITOR-002 태그로 커밋 추적, 요구사항별 테스트 매핑

### Definition of Done

- [ ] uiStore saveStatus 상태 및 액션 구현 완료
- [ ] Footer saveStatus 표시 및 스타일링 완료
- [ ] Ctrl+S 저장 시 saveStatus 연동 완료
- [ ] Ctrl+Shift+S 다른 이름으로 저장 구현 완료 (Tauri dialog + 백엔드)
- [ ] 미저장 변경사항 경고 다이얼로그 구현 완료
- [ ] 파일 전환 시 unsaved warning 연동 완료
- [ ] EditorToolbar onFormat 콜백 연결 완료 (모든 포맷 버튼)
- [ ] onViewReady 패턴으로 EditorView 외부 노출 완료
- [ ] keyboard-shortcuts.ts에 applyMarkdownFormat, prefixLine 함수 추가 완료
- [ ] Ctrl+N 새 파일 단축키 구현 완료
- [ ] Footer 단어/글자 수 표시 구현 완료
- [ ] save_file_as Tauri 커맨드 및 IPC wrapper 구현 완료
- [ ] TypeScript 타입 에러 0건
- [ ] ESLint 경고 0건
- [ ] 85% 이상 테스트 커버리지 달성

---

## Traceability

- SPEC Reference: SPEC-EDITOR-002
- Requirements Coverage: REQ-EDITOR002-U01 ~ U04, E01 ~ E15, S01 ~ S04, N01 ~ N04, O01 ~ O03
