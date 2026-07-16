# SVG in Markdown 렌더 확인 (SPEC-PREVIEW-008)

이 문서는 마크다운 안에서 SVG가 실제로 뜨는지 확인하는 샘플입니다.
Split/Preview 모드로 열어서 각 항목이 기대대로 동작하는지 보세요.

---

## 1. 기본 인라인 SVG (도형)

아래는 마크다운 본문에 직접 붙여넣은 `<svg>` 입니다. **그림으로 렌더되어야 합니다.**

<svg xmlns="http://www.w3.org/2000/svg" width="200" height="80" viewBox="0 0 200 80">
  <rect x="4" y="4" width="192" height="72" rx="12" fill="#0ea5e9"/>
  <circle cx="40" cy="40" r="24" fill="#fde047"/>
  <text x="120" y="47" font-family="sans-serif" font-size="18" fill="#ffffff">Inline SVG</text>
</svg>

---

## 2. 그래디언트 + fragment 참조 보존 확인

`fill="url(#g2)"` 같은 `#fragment` 참조가 sanitize 후에도 살아 있어야 그래디언트가 보입니다.
(Fix 3에서 `data:`·외부 URL은 차단하되 `#id` 조각 참조는 보존하도록 처리)

<svg xmlns="http://www.w3.org/2000/svg" width="220" height="80" viewBox="0 0 220 80">
  <defs>
    <linearGradient id="g2" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#22c55e"/>
      <stop offset="100%" stop-color="#0891b2"/>
    </linearGradient>
  </defs>
  <rect x="4" y="4" width="212" height="72" rx="12" fill="url(#g2)"/>
  <text x="110" y="47" text-anchor="middle" font-family="sans-serif" font-size="16" fill="#ffffff">Gradient (#g2)</text>
</svg>

기대: 초록→청록 그래디언트 막대가 보이면 fragment 참조 보존 정상.

---

## 3. XSS sanitize 확인 (스크립트는 제거되어야 함)

아래 SVG에는 `onload`/`<script>` 가 들어 있습니다. **도형은 보이되, 경고창(alert)은 절대 뜨면 안 됩니다.**

<svg xmlns="http://www.w3.org/2000/svg" width="160" height="60" viewBox="0 0 160 60" onload="alert('XSS-onload')">
  <script>alert('XSS-script')</script>
  <rect x="4" y="4" width="152" height="52" rx="10" fill="#ef4444"/>
  <text x="80" y="36" text-anchor="middle" font-family="sans-serif" font-size="14" fill="#ffffff">sanitized</text>
</svg>

기대: 빨간 사각형은 보이고, alert 창은 안 뜸.

---

## 4. 인라인 코드 안의 SVG는 그대로 텍스트 (Fix 1)

백틱으로 감싼 `<svg onload=alert(1)></svg>` 는 **렌더되지 않고 코드 텍스트 그대로** 보여야 합니다.

블록 코드도 마찬가지:

```html
<svg xmlns="http://www.w3.org/2000/svg" width="100" height="40">
  <rect width="100" height="40" fill="tomato"/>
</svg>
```

기대: 위 두 경우 모두 SVG가 그림이 아니라 코드로 표시됨.

---

## 5. 이미지 문법으로 SVG 파일 참조

`![](svg/sample.svg)` — 상대경로 SVG 파일을 `<img>` 로 렌더 (기존 imageResolver 경로, 이번 SPEC에서 안 건드림).

![샘플 SVG](svg/sample.svg)

기대: `samples/svg/sample.svg` 그림이 인라인으로 표시됨.

---

## 확인 체크리스트

- [ ] 1번: 파란 배지 + 노란 원 그림이 보임
- [ ] 2번: 초록→청록 그래디언트 막대가 보임 (fragment 참조 정상)
- [ ] 3번: 빨간 사각형은 보이되 alert 안 뜸 (sanitize 정상)
- [ ] 4번: 인라인/블록 코드의 svg는 코드 텍스트로 남음
- [ ] 5번: 이미지 참조로 sample.svg가 렌더됨
