---
spec_id: SPEC-PREVIEW-003
type: plan
---

# SPEC-PREVIEW-003: LaTeX 수학 수식 렌더링 - 구현 계획

## 구현 전략

기존 `mermaidPlugin` 통합 패턴을 참고하여 KaTeX 플러그인을 markdown-it 렌더링 파이프라인에 추가한다. `@traptitech/markdown-it-katex`는 markdown-it 플러그인 인터페이스(`md.use()`)를 따르므로 통합이 간단하다.

---

## 태스크 분해

### Primary Goal: KaTeX 플러그인 통합

**Task 1: 의존성 설치**

```bash
npm install katex @traptitech/markdown-it-katex
npm install -D @types/katex
```

- `katex`: KaTeX 렌더링 엔진 및 CSS/폰트 에셋
- `@traptitech/markdown-it-katex`: markdown-it 플러그인
- `@types/katex`: TypeScript 타입 정의 (devDependency)

**Task 2: KaTeX CSS 임포트**

`src/main.tsx`에 KaTeX 스타일시트를 임포트한다:

```typescript
import 'katex/dist/katex.min.css';
```

또는 `src/index.css` 상단에 추가:

```css
@import 'katex/dist/katex.min.css';
```

- Vite가 CSS를 자동으로 번들링하므로 별도 설정 불필요
- 폰트 파일은 KaTeX CSS가 자동으로 참조

**Task 3: renderer.ts에 KaTeX 플러그인 등록**

`src/lib/markdown/renderer.ts`의 `renderMarkdown` 함수에서 markdown-it 인스턴스에 KaTeX 플러그인을 등록한다:

```typescript
import markdownItKatex from '@traptitech/markdown-it-katex';

// 기존 플러그인 등록 영역에 추가
md.use(markdownItKatex, {
  throwOnError: false,  // 잘못된 수식이 렌더링을 중단하지 않도록
});
```

**참고 구현 패턴**: `src/lib/markdown/mermaidPlugin.ts`의 `md.use(mermaidPlugin)` 등록 방식을 참고한다. KaTeX 플러그인은 커스텀 플러그인이 아닌 서드파티 플러그인이므로 별도의 플러그인 파일 생성 없이 `renderer.ts`에서 직접 등록한다.

### Secondary Goal: 다크 모드 및 스타일 조정

**Task 4: 다크 모드 수식 스타일링**

KaTeX가 렌더링하는 수식의 기본 색상은 검정(`#000`)이므로, 다크 모드에서 가시성을 확보하기 위해 CSS 변수 또는 미디어 쿼리로 색상을 오버라이드한다:

```css
/* index.css 또는 별도 CSS에 추가 */
.dark .katex {
  color: inherit;
}
```

### Final Goal: 테스트 및 검증

**Task 5: 단위 테스트 작성**

`renderer.ts`의 `renderMarkdown` 함수에 대한 테스트 케이스를 추가한다:

- 인라인 수식(`$...$`) 렌더링 검증
- 블록 수식(`$$...$$`) 렌더링 검증
- 혼합 콘텐츠 렌더링 검증
- 에러 수식 처리 검증

**Task 6: 수동 검증**

실제 문서로 다음 항목을 수동 확인:

- 다양한 LaTeX 구문 (분수, 제곱근, 행렬, 그리스 문자 등)
- 기존 기능과의 공존 (코드 블록, Mermaid, 테이블)
- 다크 모드에서의 가시성
- 번들 크기 영향 확인

---

## 플러그인 등록 순서

현재 `renderer.ts`의 플러그인 등록 순서와 KaTeX 추가 위치:

```
1. md.enable('table')
2. md.enable('strikethrough')
3. md.use(mermaidPlugin)         -- Mermaid 코드 블록 인터셉트
4. md.use(markdownItKatex, ...)  -- [NEW] KaTeX 수식 렌더링
5. md.use(tableScrollPlugin)     -- 테이블 래핑
6. md.use(imageResolverPlugin)   -- 이미지 경로 해석
7. md.use(dataLinePlugin)        -- 스크롤 동기화용 data-line
```

KaTeX 플러그인은 Mermaid 다음, 테이블 플러그인 전에 등록한다. KaTeX는 토큰 레벨에서 동작하므로 렌더러 규칙을 오버라이드하는 플러그인보다 먼저 등록하는 것이 안전하다.

---

## 리스크 분석

### Risk 1: KaTeX CSS와 기존 스타일 충돌

- **가능성**: 낮음
- **영향**: 수식 표시 깨짐 또는 다른 요소 스타일 변경
- **대응**: KaTeX CSS는 `.katex` 클래스 스코프 내에서만 적용되므로 충돌 가능성이 낮음. 충돌 발생 시 CSS 특이성(specificity)을 조정하여 격리

### Risk 2: 번들 크기 증가

- **가능성**: 확정 (KaTeX ~300KB, 폰트 포함)
- **영향**: 초기 로딩 시간 약간 증가
- **대응**: Tauri 앱은 로컬 실행이므로 네트워크 지연이 없어 영향 미미. Vite의 코드 스플리팅으로 필요 시 지연 로딩 가능

### Risk 3: Tauri WebView CSP (Content Security Policy) 제한

- **가능성**: 중간
- **영향**: KaTeX가 인라인 스타일(`style` 속성)을 사용하므로 CSP의 `style-src` 정책에 의해 차단될 수 있음
- **대응**: Tauri의 `tauri.conf.json`에서 CSP 설정을 확인하고, 필요 시 `'unsafe-inline'` 또는 KaTeX 관련 해시를 허용 목록에 추가. 현재 프로젝트에서 Mermaid도 인라인 스타일을 사용하고 있으므로 이미 허용되어 있을 가능성이 높음

### Risk 4: `$` 기호 오탐 (False Positive)

- **가능성**: 중간
- **영향**: 통화 표기(`$100`)가 수식으로 잘못 해석될 수 있음
- **대응**: `@traptitech/markdown-it-katex`의 기본 동작이 단독 `$` 뒤 공백 패턴을 처리하는지 확인. 필요 시 플러그인 옵션 또는 커스텀 파서 규칙으로 조정

---

## 의존성 관계

```
SPEC-PREVIEW-001 (markdown-it 기반 렌더링)
    └── SPEC-PREVIEW-003 (KaTeX 수식 렌더링) [이 SPEC]
```

---

## 변경 영향 범위

| 파일                             | 변경 내용                    | 영향 범위    |
| -------------------------------- | ---------------------------- | ------------ |
| `package.json`                   | 의존성 2개 추가              | 빌드 시스템  |
| `src/lib/markdown/renderer.ts`   | `md.use()` 1줄 + import 1줄 | 렌더링 엔진  |
| `src/main.tsx` 또는 `src/index.css` | CSS import 1줄           | 전역 스타일  |

총 변경 규모: **최소 3줄** (import 1줄, use 1줄, CSS import 1줄)
