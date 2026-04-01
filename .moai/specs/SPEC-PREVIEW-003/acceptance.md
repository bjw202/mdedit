---
spec_id: SPEC-PREVIEW-003
type: acceptance
---

# SPEC-PREVIEW-003: LaTeX 수학 수식 렌더링 - 인수 기준

## 테스트 시나리오

### Scenario 1: 인라인 수학 수식 렌더링

```gherkin
Given Markdown 문서에 인라인 수식 "$E = mc^{2}$"이 포함되어 있다
When 미리보기 패널이 해당 문서를 렌더링한다
Then 수식이 KaTeX에 의해 시각적으로 렌더링된다
And 렌더링 결과에 ".katex" 클래스를 가진 HTML 요소가 포함된다
And 원시 텍스트 "$E = mc^{2}$"는 표시되지 않는다
```

```gherkin
Given Markdown 문서에 그리스 문자 인라인 수식 "$\alpha + \beta = \gamma$"이 포함되어 있다
When 미리보기 패널이 해당 문서를 렌더링한다
Then 그리스 문자가 올바른 수학 기호로 렌더링된다
```

### Scenario 2: 블록 수학 수식 렌더링

```gherkin
Given Markdown 문서에 블록 수식이 포함되어 있다:
  """
  $$
  \int_{0}^{\infty} e^{-x^2} dx = \frac{\sqrt{\pi}}{2}
  $$
  """
When 미리보기 패널이 해당 문서를 렌더링한다
Then 수식이 중앙 정렬된 독립 블록으로 렌더링된다
And 적분 기호, 분수, 제곱근이 모두 올바르게 표시된다
```

```gherkin
Given Markdown 문서에 한 줄 블록 수식 "$$r = \frac{mz}{2}$$"이 포함되어 있다
When 미리보기 패널이 해당 문서를 렌더링한다
Then 수식이 블록 레벨로 중앙 정렬되어 렌더링된다
```

### Scenario 3: 혼합 콘텐츠 렌더링

```gherkin
Given Markdown 문서에 다음 요소가 혼합되어 있다:
  - 인라인 수식: "$x^2 + y^2 = r^2$"
  - 테이블: 3x3 데이터 테이블
  - 코드 블록: ```javascript 구문
  - Mermaid 다이어그램: ```mermaid flowchart
  - 일반 텍스트 및 헤더
When 미리보기 패널이 해당 문서를 렌더링한다
Then 모든 요소가 각각 올바르게 렌더링된다
And 수학 수식은 KaTeX로, 코드는 Shiki로, 다이어그램은 Mermaid로 처리된다
And 요소 간 렌더링 간섭이 발생하지 않는다
```

### Scenario 4: 에지 케이스 처리

```gherkin
Given Markdown 문서에 빈 인라인 수식 "$$"이 포함되어 있다
When 미리보기 패널이 해당 문서를 렌더링한다
Then 빈 수식은 원시 텍스트로 표시되거나 무시된다
And 전체 미리보기 렌더링이 중단되지 않는다
```

```gherkin
Given Markdown 문서에 유효하지 않은 LaTeX 구문 "$\invalidcommand{x}$"이 포함되어 있다
When 미리보기 패널이 해당 문서를 렌더링한다
Then 해당 수식 위치에 에러 메시지 또는 원시 텍스트가 표시된다
And 나머지 문서의 렌더링은 정상적으로 완료된다
```

```gherkin
Given Markdown 문서에 이스케이프된 달러 기호 "\$100"이 포함되어 있다
When 미리보기 패널이 해당 문서를 렌더링한다
Then "$100"이 리터럴 텍스트로 표시된다
And 수학 수식으로 해석되지 않는다
```

```gherkin
Given Markdown 문서에 중첩된 중괄호 수식 "$\frac{\sqrt{x^{2}+1}}{y}$"이 포함되어 있다
When 미리보기 패널이 해당 문서를 렌더링한다
Then 분수, 제곱근, 거듭제곱이 모두 올바르게 중첩 렌더링된다
```

### Scenario 5: 코드 블록 내 달러 기호 보호

```gherkin
Given Markdown 문서에 코드 블록 안에 "$x$"가 포함되어 있다:
  """
  ```python
  price = "$100"
  formula = "$x^2$"
  ```
  """
When 미리보기 패널이 해당 문서를 렌더링한다
Then 코드 블록 내의 "$" 기호는 수식으로 해석되지 않는다
And 코드가 Shiki에 의해 구문 강조된다
```

```gherkin
Given Markdown 문서에 인라인 코드 "`$x^2$`"가 포함되어 있다
When 미리보기 패널이 해당 문서를 렌더링한다
Then 인라인 코드 내의 "$x^2$"는 수식으로 해석되지 않고 리터럴 텍스트로 표시된다
```

---

## 성능 기준

| 지표                                         | 기준값    | 측정 방법                                              |
| -------------------------------------------- | --------- | ------------------------------------------------------ |
| 수식 포함 문서 렌더링 추가 지연              | < 50ms    | `renderMarkdown` 함수 실행 시간 비교 (수식 유/무)      |
| 수식 10개 포함 10KB 문서 전체 렌더링         | < 100ms   | `console.time` 또는 Vitest benchmark                   |
| 번들 크기 증가                               | < 500KB   | Vite 빌드 출력에서 KaTeX 관련 청크 크기 확인           |

---

## Quality Gate 기준

### 필수 통과 항목

- [ ] 인라인 수식(`$...$`) 렌더링 정상 동작
- [ ] 블록 수식(`$$...$$`) 렌더링 정상 동작
- [ ] 유효하지 않은 수식이 전체 렌더링을 중단하지 않음
- [ ] 코드 블록 내 `$` 기호가 수식으로 해석되지 않음
- [ ] 기존 테스트 전체 통과 (회귀 없음)
- [ ] TypeScript 컴파일 에러 없음
- [ ] ESLint 경고/에러 없음

### 선택 통과 항목

- [ ] 다크 모드에서 수식 가시성 확보
- [ ] 이스케이프된 달러 기호(`\$`) 리터럴 표시
- [ ] 번들 크기 증가 500KB 이하

---

## 검증 방법

### 자동화 테스트

- **단위 테스트**: `renderMarkdown` 함수에 대한 Vitest 테스트 케이스 추가
  - 입력: 수식이 포함된 Markdown 문자열
  - 검증: 출력 HTML에 `.katex` 클래스 요소 존재 여부 확인
  - 검증: `throwOnError: false` 옵션으로 잘못된 수식 처리 확인

### 수동 테스트

- 다양한 LaTeX 구문으로 실제 문서 작성 후 미리보기 확인
- 기존 테스트 문서(코드 블록, Mermaid, 테이블 포함)에 수식 추가 후 공존 확인
- 라이트/다크 모드 전환 시 수식 가시성 확인

---

## Definition of Done

1. KaTeX 및 `@traptitech/markdown-it-katex` 의존성이 `package.json`에 추가됨
2. KaTeX CSS가 애플리케이션에 임포트됨
3. `renderer.ts`에서 KaTeX 플러그인이 markdown-it에 등록됨
4. 인라인 수식과 블록 수식이 미리보기에서 올바르게 렌더링됨
5. 잘못된 수식이 전체 렌더링을 중단하지 않음
6. 기존 기능(Shiki, Mermaid, 테이블, 이미지)과 간섭 없이 공존함
7. 모든 기존 테스트가 통과함
8. 단위 테스트가 추가되어 수식 렌더링을 검증함
