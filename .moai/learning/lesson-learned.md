# Lesson Learned: Tauri/WKWebView CSS 시각적 버그 디버깅

**날짜:** 2026-02-25
**SPEC:** SPEC-E2E-001 (Playwright E2E 테스트 인프라)
**소요:** 2개 세션에 걸쳐 약 5회 반복
**심각도:** 높음 (사용자 대면 시각적 버그가 여러 "수정" 후에도 지속)

---

## 1. 무슨 일이 있었나

### 버그 내용
마크다운 미리보기 패널에 세 가지 문제가 있었다:
- 넓은 테이블에 수평 스크롤이 없음
- 짧은 테이블의 오른쪽 테두리가 안 닫힘
- 윈도우가 좁으면 텍스트가 잘림

### 디버깅 타임라인

| 반복 | 시도한 내용 | 결과 | 낭비된 시간 |
|------|-----------|------|------------|
| 1 | 인라인 스타일에서 `width: 100%` 제거 | 개선 없음 | 보통 |
| 2 | wrapper에 `padding-right: 1px` 추가 | 개선 없음 | 낮음 |
| 3 | `border-collapse: separate` (근본적 CSS 수정) | 테두리 수정됨, 스크롤은 여전히 없음 | 높음 |
| 4 | 테이블별 `overflow-x: scroll` + 커스텀 스크롤바 | 테이블별 스크롤은 생겼으나, 사용자는 패널 전체 스크롤을 원함 | 높음 |
| 5 | 프리뷰 패널 `overflow: scroll` + `::-webkit-scrollbar` 강제 표시 | **해결** | 낮음 |

**총 5회 반복. 5번째에서야 해결.**

---

## 2. 디버깅이 오래 걸린 근본 원인

### 근본 원인 1: 잘못된 멘탈 모델
- **AI가 가정한 것:** "CSS 계산값이 잘못됐다" (border-collapse, border-width)
- **실제 현실:** CSS 값은 대체로 맞았다. 진짜 문제는:
  - macOS/WKWebView 오버레이 스크롤바가 스크롤바를 완전히 숨김
  - 사용자는 요소별 스크롤이 아닌 패널 전체 스크롤을 원함
  - `getComputedStyle`은 선언된 값을 보고하지, 시각적 렌더링을 보고하지 않음

**교훈:** CSS 계산값이 "맞아도" 시각적 출력이 맞다는 보장이 없다. macOS/WKWebView에서는 오버플로우가 발생해도 스크롤바가 보이지 않을 수 있다.

### 근본 원인 2: 테스트 환경 불일치
- Playwright WebKit (1280x720 뷰포트) vs 실제 Tauri WKWebView (사용자의 전체 화면)
- Playwright의 608px 프리뷰 패널에서 오버플로우하는 테이블이 사용자의 1328px 패널에서는 딱 맞음
- 테스트는 통과했지만 **다른 뷰포트 컨텍스트**를 테스트한 것

**교훈:** E2E 테스트는 사용자의 실제 환경과 일치해야 한다. 뷰포트에 의존하는 테스트는 CSS 시각적 버그에 대해 신뢰할 수 없다.

### 근본 원인 3: 사용자 실제 화면과의 피드백 루프 부재
- AI가 CSS 변경 → 자동 테스트 실행 → "해결됨" 선언
- 사용자가 실제로 보는 것을 확인하는 메커니즘 없음
- "해결!" / "여전히 안 됨!" 의 반복으로 시간 낭비

**교훈:** 시각적 버그에서는 자동 테스트만으로 불충분하다. 앱에서 실제 DOM 상태를 보여주는 **진단 오버레이**가 돌파구였다.

### 근본 원인 4: 사용자 요구사항 오해
- AI는 "수평 스크롤"을 테이블별 스크롤(wrapper 방식)로 해석
- 사용자는 프리뷰 패널 전체의 수평 스크롤을 원함
- 이 근본적 오해가 1~4번째 반복을 잘못된 방향으로 이끔

**교훈:** 구현 전에 UX 요구사항을 명확히 하라. "스크롤바가 어디에 나와야 하는가?"는 핵심 질문이다.

---

## 3. 최종적으로 해결한 방법

### 3단계 수정

```
1. border-collapse: separate; border-spacing: 0   (테두리 클리핑 수정)
2. 프리뷰 패널: overflow: scroll                   (패널 전체 스크롤 활성화)
3. ::-webkit-scrollbar 커스텀 스타일               (macOS에서 스크롤바 강제 표시)
```

### 왜 이것이 작동하는가
- `border-collapse: separate`는 WebKit 테두리 클리핑 버그를 근본적으로 제거
- 패널 수준 `overflow: scroll`은 모든 넓은 콘텐츠(테이블, 코드 등)에 통합 스크롤바 제공
- 커스텀 `::-webkit-scrollbar`는 macOS 오버레이 스크롤바 숨김을 재정의

---

## 4. 향후 CSS/시각적 버그 디버깅 가이드라인

### 사용자(jw)를 위한 가이드

#### 1단계: 기대 동작과 실제 동작을 정확히 설명하기
- 나쁜 예: "스크롤이 안 돼"
- 좋은 예: "프리뷰 패널 전체 하단에 수평 스크롤바가 나와야 하는데, 대신 각 테이블에만 개별 스크롤바가 나온다" 또는 "스크롤바가 어디에도 안 보인다"

#### 2단계: 수정이 적용되어야 할 위치 명시하기
- "스크롤바는 프리뷰 패널 전체에 있어야 하고, 테이블별이 아니다"
- "패널 안에 맞는 짧은 테이블 포함 모든 테이블의 테두리가 보여야 한다"

#### 3단계: 첫 수정 실패 시 진단 오버레이 조기 요청
시각적 버그가 첫 번째 수정 시도 후에도 지속되면, Claude에게 요청:
```
컴포넌트에 실제 DOM 상태(overflow 값, 스크롤 크기, computed 스타일)를
보여주는 진단 오버레이를 추가해줘
```
이것이 추측을 제거하고 근본 원인에 더 빨리 도달하게 한다.

#### 4단계: 진단 출력을 정확하게 보고하기
진단 출력을 정확히 복사-붙여넣기하라. 이 한 단계가 몇 시간의 디버깅을 절약했다.

### Claude Code를 위한 가이드

#### 규칙 1: 진단 오버레이를 먼저 추가하고, 그 다음 수정
Tauri/WKWebView의 모든 시각적/CSS 버그에 대해:
1. 실제 DOM 상태를 보여주는 진단 오버레이 추가
2. 사용자에게 진단 출력 보고 요청
3. 실제 데이터에 기반하여 수정 (가정이 아닌)
4. 수정 확인 후 오버레이 제거

#### 규칙 2: getComputedStyle만 믿지 말 것
`getComputedStyle`은 CSS 값을 보고하지, 시각적 렌더링을 보고하지 않는다. macOS/WKWebView에서:
- overflow: auto/scroll이어도 스크롤바가 보이지 않을 수 있음
- 1px로 계산되어도 테두리가 클리핑될 수 있음
- 항상 시각적 진단(스크린샷 또는 오버레이)으로 검증

#### 규칙 3: 테스트 환경을 사용자 환경에 맞추기
- 사용자의 화면 크기 / 윈도우 크기 확인
- Playwright 뷰포트를 일치시키기
- 좁은 화면과 넓은 화면 시나리오 모두 테스트

#### 규칙 4: 구현 전 UX 의도 명확히 하기
모든 UI/UX 수정에 대해 확인할 것:
- 스크롤바가 어디에 나와야 하는가? (요소별 vs 패널 전체)
- 윈도우가 좁으면 어떻게 되어야 하는가?
- 다양한 콘텐츠 크기에서 기대 동작은?

#### 규칙 5: macOS/WKWebView 스크롤바 체크리스트
Tauri에서 macOS 스크롤을 구현할 때:
- [ ] 스크롤바가 항상 보여야 하면 `overflow: scroll` 사용 (auto가 아닌)
- [ ] `::-webkit-scrollbar` 커스텀 스타일로 가시성 강제
- [ ] 양축 스크롤을 위한 `::-webkit-scrollbar-corner` 포함
- [ ] macOS 시스템 환경설정의 "스크롤 막대 표시: 항상" 설정으로 테스트

---

## 5. 피해야 할 안티패턴

### 안티패턴 1: "테스트 통과 = 버그 해결"
`getComputedStyle(td).borderRightWidth === '1px'`을 확인하는 E2E 테스트는 항상 통과했다.
CSS 속성은 맞았으니까. 하지만 테두리는 시각적으로 클리핑되어 있었다.
**수정:** CSS 값이 아닌 시각적 결과(스크롤 위치, 바운딩 사각형)를 테스트하라.

### 안티패턴 2: 진단 없는 반복적 CSS 미세 조정
`padding-right: 1px` 추가, `width: 100%`를 `min-width: 100%`로 변경 등은
산탄총 접근법이다. 각각의 작은 변경마다 전체 테스트 주기가 필요하다.
**수정:** 먼저 실제 DOM 상태를 진단하고, 하나의 목표 수정을 하라.

### 안티패턴 3: 브라우저 동작 = WKWebView 동작이라는 가정
Playwright의 WebKit은 macOS WKWebView와 동일하지 않다. 오버레이 스크롤바,
뷰포트 크기, 캐싱 동작이 다르다.
**수정:** 항상 실제 Tauri 앱에서 검증하라.

---

## 6. 빠른 참조: Tauri/macOS CSS 디버그 플레이북

```
1. 사용자가 시각적 버그 보고
2. 영향받는 컴포넌트에 진단 오버레이 추가
3. 사용자가 진단 출력 보고
4. 분석: CSS 값 문제인가, 렌더링/가시성 문제인가?
5. CSS 값은 맞지만 시각적으로 안 보이면:
   - macOS 오버레이 스크롤바 숨김 확인
   - 부모 overflow 체인 확인
   - 뷰포트 크기 차이 확인
6. 목표 수정 적용
7. 사용자가 시각적 수정 확인
8. 진단 오버레이 제거
9. 실제 시각적 문제를 감지하도록 E2E 테스트 업데이트
```

---

## 7. 후속 발견 (2026-02-25): Windows WebView2 플랫폼별 스크롤 불가 버그

**문제:** macOS 스크롤 수정 완료 후, Windows Tauri(WebView2)에서 동일 증상 재발
- 좁은 창에서 텍스트·표 모두 잘려서 표시
- 수평 스크롤 없음 (스크롤바 아예 안 보임)

### 근본 원인: ResizablePanels Flex 레이아웃 오버플로우 버그

**코드 위치:** `src/components/layout/ResizablePanels.tsx`

**버그:** 에디터/프리뷰 너비가 컨테이너 전체(100%)의 퍼센트로 계산됐지만, 동일한 flex 컨테이너 안에 고정 픽셀 너비 사이드바(250px)와 디바이더(8px)가 이미 공간을 차지하고 있었다.

```
창 1440px, 사이드바 250px, previewWidth=50% 기준
사이드바: 250px + 디바이더: 8px
에디터:   50% of 1440px = 720px   ← 사이드바 몫 미포함
프리뷰:   50% of 1440px = 720px   ← 사이드바 몫 미포함
합계:     1698px > 1440px → 258px 오버플로우 → 프리뷰 258px 잘림
```

**왜 macOS는 동작하고 Windows는 안 됐는가?**

프리뷰 패널이 258px 잘린 상태에서 (720px 레이아웃, 462px만 보임):
- **macOS** (`overflow: scroll`): 강제 스크롤바가 패널 왼쪽(x=0)부터 시작 → 462px 가시 영역 안에 스크롤 트랙 포함 → 부분적으로라도 클릭·드래그 가능
- **Windows** (`overflow: auto`): 스크롤바가 패널 우측 끝(x=712~720)에만 렌더 → 258px 클리핑으로 완전히 숨겨진 영역 → 스크롤 완전 불가

**수정 (`ResizablePanels.tsx` 2줄 변경):**

```js
// Before: 사이드바 미포함 → 항상 258px 오버플로우
const editorWidth = `calc(${100 - previewWidth}%)`;
const previewWidthStyle = `${previewWidth}%`;

// After: 사이드바 + 디바이더 포함 → 오버플로우 없음
const fixedWidthPx = effectiveSidebarWidth + (sidebarCollapsed ? 4 : 8);
const editorWidth = `calc((100% - ${fixedWidthPx}px) * ${(100 - previewWidth) / 100})`;
const previewWidthStyle = `calc((100% - ${fixedWidthPx}px) * ${previewWidth / 100})`;
```

### 디버깅 과정 교훈

| 반복 | 접근법 | 결과 | 낭비된 시간 |
|------|-------|------|------------|
| 1 | CSS `overflow: auto` 적용 (CSS 문제 가정) | 진단값 정상인데 스크롤 없음 | 높음 |
| 2 | `@supports (scrollbar-gutter)` CSS 분기 | macOS Safari 17+도 지원 → macOS 깨짐 | 보통 |
| 3 | `navigator.userAgent` JS 플랫폼 감지 | macOS OK, Windows 여전히 안 됨 | 낮음 |
| 4 | `padding-right: 1px` + `overflow: auto` | 진단값 맞지만 스크롤 안 보임 | 보통 |
| 5 | **ResizablePanels 레이아웃 계산 수정** | **해결** | 낮음 |

**총 5회 반복. CSS가 아닌 레이아웃 수준의 버그였음.**

### 새로운 디버깅 규칙

#### 규칙 6: 플랫폼별 동작 차이가 있으면 레이아웃 오버플로우를 먼저 확인
macOS는 동작하지만 Windows에서 스크롤이 없을 때:
1. flex 컨테이너에서 고정 px 요소와 % 요소가 혼용되는지 확인
2. 총 계산 너비 = 컨테이너 너비인지 수동 계산
3. `overflow-hidden` 부모가 오른쪽 자식을 잘라내는지 확인

#### 규칙 7: Flex 컨테이너에서 고정 px + % 혼용 시 calc() 보정 필수
```js
// 안전한 패턴
const fixedWidthPx = sidebarWidth + dividerWidths;
const contentWidth = `calc((100% - ${fixedWidthPx}px) * ${fraction})`;
```

#### 규칙 8: CSS overflow 디버깅 전 레이아웃 시각적 검증 먼저
`overflow: auto`가 스크롤을 안 만들 때 CSS를 수정하기 전에:
```javascript
// 콘솔에서 스크롤 컨테이너의 실제 레이아웃 너비 vs 시각 너비 확인
const el = document.querySelector('.preview-scroll');
const parent = el.parentElement;
const grandparent = parent.parentElement;
console.log('el.offsetWidth:', el.offsetWidth);          // 레이아웃 너비
console.log('parent.offsetWidth:', parent.offsetWidth);   // 부모 너비
console.log('grandparent.scrollWidth > grandparent.offsetWidth:', grandparent.scrollWidth > grandparent.offsetWidth);
// true면 조상 수준에서 오버플로우가 발생하고 있다는 증거
```

---

## 8. 향후 크로스플랫폼 시각적 버그 대응 워크플로우

Tauri 앱(macOS WKWebView, Windows WebView2)에서 시각적 버그를 만났을 때 따를 **표준 워크플로우**.

---

### 단계 0: 버그 분류 (1분)

보고된 증상으로 버그 유형을 먼저 확인한다.

| 증상 | 유형 | 시작 단계 |
|------|------|----------|
| 패널이 예상보다 좁음, 요소 잘림 | 레이아웃 오버플로우 | → 단계 2A |
| 스크롤바 안 보임 (요소 크기는 맞음) | CSS/렌더링 | → 단계 2B |
| macOS는 되고 Windows만 안 됨 | 플랫폼별 차이 | → 단계 1 진단 |
| 양 플랫폼 모두 안 됨 | 공통 레이아웃/CSS | → 단계 1 진단 |

---

### 단계 1: 진단 스크립트 실행 (버그 상태에서)

Tauri DevTools(우클릭 → 요소 검사 → Console) 또는 개발 중인 경우 브라우저 콘솔에서 실행:

```javascript
// === Tauri 크로스플랫폼 시각적 버그 진단 스크립트 ===
const s = document.querySelector('.preview-scroll');
const p = s?.parentElement;
const g = p?.parentElement;

console.log('[플랫폼]', document.documentElement.getAttribute('data-platform'));
console.log('[창 크기]', window.innerWidth, 'x', window.innerHeight);

if (s) console.log('[preview-scroll]', {
  offsetWidth: s.offsetWidth,
  scrollWidth: s.scrollWidth,
  overflow: getComputedStyle(s).overflow,
  overflowX: getComputedStyle(s).overflowX,
});
if (p) console.log('[parent wrapper]', {
  offsetWidth: p.offsetWidth,
  overflow: getComputedStyle(p).overflow,
});
if (g) console.log('[grandparent flex]', {
  offsetWidth: g.offsetWidth,
  scrollWidth: g.scrollWidth,
  isOverflowing: g.scrollWidth > g.offsetWidth,
});
```

---

### 단계 2A: 레이아웃 오버플로우 수정

진단에서 `grandparent.scrollWidth > grandparent.offsetWidth === true` 이면 **레이아웃 버그**다.

**원인 패턴:** flex 컨테이너 안에 고정 px 요소 + % 기반 요소가 섞여 있어 합계가 컨테이너를 초과한다.

**수동 계산으로 확인:**
```
예상 합계 = 고정요소(px) + 요소1(% of 컨테이너) + 요소2(% of 컨테이너)
예상 합계 > 컨테이너 너비 → 오버플로우 확정
```

**수정 패턴 (필수):**
```js
// Before: 고정 px 미포함 → 항상 overflow
const width = `${fraction}%`;

// After: 고정 px 뺀 나머지의 비율 → overflow 없음
const fixedPx = sidebarPx + dividerPx + /* 기타 고정 요소 */;
const width = `calc((100% - ${fixedPx}px) * ${fraction})`;
```

---

### 단계 2B: CSS/렌더링 버그 수정

진단에서 레이아웃은 정상인데 스크롤바가 안 보이면 **CSS 렌더링 버그**다.

**Tauri 플랫폼별 CSS 분기 (표준 패턴):**

```typescript
// App.tsx: 앱 시작 시 플랫폼 속성 설정 (1회)
useEffect(() => {
  const isWindows = navigator.userAgent.includes('Windows');
  document.documentElement.setAttribute('data-platform', isWindows ? 'windows' : 'other');
}, []);
```

```css
/* index.css: 플랫폼별 CSS 분기 */

/* macOS WKWebView: overlay 스크롤바 숨김 → 커스텀 스크롤바로 강제 표시 */
.preview-scroll {
  overflow: scroll !important;
}
.preview-scroll::-webkit-scrollbar { width: 8px; height: 8px; }
.preview-scroll::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 4px; }

/* Windows WebView2: 네이티브 스크롤바는 항상 보임 → overflow 필요할 때만 */
[data-platform="windows"] .preview-scroll {
  overflow: auto !important;
}
```

**CSS 스크롤 관련 체크리스트:**
- `overflow: scroll` vs `overflow: auto` — macOS는 scroll, Windows는 auto
- `::-webkit-scrollbar` — Chromium(Windows)도 지원하므로 커스텀 스타일 통일 가능
- `border-collapse: separate` — WebKit 테두리 클리핑 버그 방지
- `padding-right: 1px` — Chromium에서 테이블 오른쪽 테두리 클리핑 방지

---

### 단계 3: 수정 후 검증 체크리스트

수정 후 **반드시** 실제 Tauri 앱에서 확인 (Playwright/브라우저가 아닌):

- [ ] macOS: 기본 창 크기에서 정상 동작
- [ ] macOS: 좁은 창(800px 이하)에서 스크롤 동작
- [ ] Windows: 기본 창 크기에서 정상 동작
- [ ] Windows: 좁은 창(800px 이하)에서 스크롤 동작
- [ ] 사이드바 열림 / 닫힘 상태 모두
- [ ] 다양한 테이블 너비 (좁은 / 넓은 / 딱 맞는)
- [ ] 수정 전 macOS에서 정상이었던 기능이 깨지지 않음

---

### 단계 4: 진단 판단 트리

```
버그 보고 접수
    │
    ▼
진단 스크립트 실행 (단계 1)
    │
    ├─ grandparent.scrollWidth > offsetWidth?
    │       YES → 단계 2A (레이아웃 오버플로우)
    │       NO  ↓
    │
    ├─ s.scrollWidth > s.offsetWidth + 스크롤바 안 보임?
    │       YES → 단계 2B (CSS 렌더링)
    │       NO  ↓
    │
    ├─ s.scrollWidth == s.offsetWidth?
    │       YES → 콘텐츠가 오버플로우하지 않음
    │             (창 크기 더 좁혀서 재시도)
    │
    └─ 여전히 불명확?
            → 진단 오버레이 추가 (규칙 1 참조)
```

---

### 단계 5: 학습 문서화

버그를 해결한 뒤 이 파일에 기록:

1. **근본 원인**: 레이아웃 오버플로우 / CSS 렌더링 / 플랫폼별 / 기타
2. **진단에서 결정적이었던 값**: 어떤 수치가 버그를 확정했는가
3. **수정 코드 스니펫**: 핵심 변경만 간결하게
4. **예방 체크리스트**: 재발 방지를 위한 항목

---

### 플랫폼별 알려진 동작 차이 참조표

| 항목 | macOS WKWebView | Windows WebView2 |
|------|----------------|-----------------|
| 스크롤바 기본 표시 | overlay (숨겨짐) | 항상 표시 |
| `overflow: auto` | 콘텐츠 없으면 스크롤바 숨김 | 콘텐츠 없으면 스크롤바 숨김 |
| `overflow: scroll` | 스크롤바 항상 표시 (overlay이면 보이지 않을 수 있음) | 스크롤바 항상 표시 (공간 차지) |
| `::-webkit-scrollbar` | 지원 ✓ | 지원 ✓ (Chromium) |
| `border-collapse: collapse` | 테두리 클리핑 버그 발생 가능 | 정상 |
| Playwright WebKit | WKWebView와 다름 (뷰포트, 스크롤바 동작) | 해당 없음 |

---

버전: 1.2.0
작성일: 2026-02-25 (초판) / 2026-02-25 (7절 추가) / 2026-02-25 (8절 워크플로우 가이드 추가)
작성자: MoAI + jw (공동 디버깅 세션)
