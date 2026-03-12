# SPEC-IMG-WIDGET-001: Implementation Plan

## Traceability

| TAG | Reference |
|-----|-----------|
| SPEC-IMG-WIDGET-001 | spec.md |

---

## Technical Approach

### Architecture

CodeMirror 6의 `ViewPlugin` 기반 extension으로 구현한다. ViewPlugin은 에디터 뷰의 라이프사이클에 맞춰 decoration을 관리하며, 문서 변경 시 자동으로 업데이트된다.

```
imageWidgetExtension()
  └── ViewPlugin
        ├── create(): 초기 DecorationSet 생성
        ├── update(): docChanged 시 DecorationSet 재계산
        └── decorations: EditorView.decorations 제공

ImageWidget extends WidgetType
  ├── toDOM(): 썸네일 + 메타데이터 DOM 생성
  ├── eq(): 동일 위젯 비교 (캐싱)
  └── estimatedHeight: 위젯 높이 추정
```

### Implementation Strategy

TDD RED-GREEN-REFACTOR 사이클을 따른다:

1. **RED**: 각 REQ에 대한 실패 테스트 작성
2. **GREEN**: 테스트를 통과하는 최소 구현
3. **REFACTOR**: 코드 품질 개선

---

## Milestones

### Primary Goal: Core Widget Rendering

- ViewPlugin 생성 및 regex 기반 data URI 이미지 패턴 감지
- WidgetType 서브클래스 구현 (썸네일 + 메타데이터 표시)
- Decoration.replace()로 매칭 범위를 위젯으로 대체
- MarkdownEditor.tsx의 extensions 배열에 추가

### Secondary Goal: Dynamic Behavior

- 문서 변경 시 decoration 동적 업데이트
- 새 이미지 붙여넣기 시 즉시 위젯 렌더링
- 이미지 마크다운 삭제 시 위젯 제거

### Final Goal: Theme & Polish

- 다크/라이트 모드 CSS 변수 적용
- 위젯 클릭 시 커서 위치 동작 확인
- Viewport 범위 제한 최적화 (성능)

---

## Risks and Mitigations

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| 대용량 base64 regex 매칭 성능 저하 | 에디터 입력 지연 | Medium | viewport 범위로 매칭 제한, `PluginField` 대신 `decorations` provide 사용 |
| data URI 길이로 인한 위젯 eq() 비교 비용 | 불필요한 DOM 재생성 | Low | alt 텍스트 + data URI 해시로 eq() 비교 최적화 |
| 기존 extension과의 충돌 | syntax highlighting 깨짐 | Low | decoration 우선순위(priority) 조정으로 해결 |

---

## Dependencies

- CodeMirror 6 core packages (이미 설치됨): `@codemirror/view`, `@codemirror/state`
- 추가 패키지 설치 불필요
