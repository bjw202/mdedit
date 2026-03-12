# SPEC-IMG-WIDGET-001: Acceptance Criteria

## Traceability

| TAG | Reference |
|-----|-----------|
| SPEC-IMG-WIDGET-001 | spec.md |

---

## Test Scenarios

### AC-1: Widget Renders for Data URI Images (REQ-1)

```gherkin
Given 에디터에 "![screenshot](data:image/png;base64,iVBORw0KGgoAAAANSUhEUg...)" 텍스트가 있을 때
When 에디터가 렌더링되면
Then raw base64 텍스트 대신 이미지 위젯이 표시된다
And 위젯은 ".cm-image-widget" 클래스를 가진 DOM 요소이다
```

### AC-2: Widget Displays Correct Metadata (REQ-2)

```gherkin
Given data URI 이미지가 alt="screenshot", MIME=png, base64 길이 56000자인 경우
When 위젯이 렌더링되면
Then 썸네일 이미지가 최대 높이 80px로 표시된다
And alt 텍스트 "screenshot"이 표시된다
And MIME 타입 "PNG"가 표시된다
And 파일 크기 "41.0KB" (약 56000 * 3/4 / 1024)가 표시된다
```

### AC-3: Source Text Unchanged (REQ-3)

```gherkin
Given 위젯이 data URI 이미지에 적용된 상태에서
When view.state.doc.toString()을 호출하면
Then 원본 마크다운 텍스트 "![alt](data:image/...)" 가 그대로 존재한다
And 위젯에 의한 텍스트 변경이 없다
```

### AC-4: Widget NOT Applied to File Path Images (REQ-4)

```gherkin
Given 에디터에 "![photo](./images/photo.png)" 텍스트가 있을 때
When 에디터가 렌더링되면
Then 위젯이 적용되지 않는다
And 원본 텍스트가 그대로 표시된다
```

### AC-5: Widget NOT Applied to HTTP URLs (REQ-4)

```gherkin
Given 에디터에 "![logo](https://example.com/logo.png)" 텍스트가 있을 때
When 에디터가 렌더링되면
Then 위젯이 적용되지 않는다
```

### AC-6: Widget Click Places Cursor (REQ-5)

```gherkin
Given data URI 이미지 위젯이 표시된 상태에서
When 사용자가 위젯을 클릭하면
Then 커서가 해당 이미지 마크다운 구문의 소스 텍스트 범위에 위치한다
```

### AC-7: Widget Updates on New Image Paste (REQ-6)

```gherkin
Given 빈 에디터 상태에서
When 사용자가 inline-blob 모드로 이미지를 붙여넣으면
Then 새로 삽입된 data URI에 대해 위젯이 자동으로 렌더링된다
```

### AC-8: Widget Removed on Image Deletion (REQ-6)

```gherkin
Given data URI 이미지 위젯이 표시된 상태에서
When 사용자가 해당 이미지 마크다운 텍스트를 삭제하면
Then 위젯이 제거된다
```

### AC-9: Dark Mode Theme Adaptation (REQ-7)

```gherkin
Given 에디터가 다크 모드 상태일 때
When 위젯이 렌더링되면
Then 위젯 배경, 테두리, 텍스트 색상이 다크 모드에 맞게 적용된다
And CSS 변수를 통해 테마가 적용된다
```

---

## Quality Gate Criteria

| Criteria | Target |
|----------|--------|
| Unit test coverage | >= 85% for image-widget.ts |
| REQ coverage | All 7 REQs have corresponding tests |
| TypeScript strict | Zero `any` types |
| Performance | 위젯 렌더링이 에디터 키 입력 지연을 유발하지 않음 |
| Lint | Zero ESLint errors |

---

## Definition of Done

- [ ] `image-widget.ts` 파일이 `src/components/editor/extensions/`에 생성됨
- [ ] `MarkdownEditor.tsx`의 extensions 배열에 `imageWidgetExtension()` 추가됨
- [ ] 모든 acceptance criteria (AC-1 ~ AC-9) 테스트 통과
- [ ] 다크/라이트 모드에서 위젯 정상 표시
- [ ] 기존 에디터 기능 (syntax highlighting, 키보드 단축키 등)에 영향 없음
- [ ] 코드 리뷰 완료
