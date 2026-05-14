# SPEC-PREVIEW-004 — 수동 검증 체크리스트

> 이 파일에 열거된 시나리오는 jsdom 환경에서 검증 불가능하므로,
> `npm run dev`로 앱을 실행하여 실제 Chromium WebView + Tauri 런타임에서 직접 검증해야 한다.
>
> 보안 시나리오 3·4·5·5-A는 acceptance.md에서 **must-pass** 기준으로 지정된 항목이다.
> 하나라도 실패하면 전체 SPEC이 실패한다.

## 사전 준비: 테스트용 샘플 폴더 구성

다음 파일들을 포함하는 샘플 폴더(`/tmp/html-test-folder/` 등)를 만든다.

```
/tmp/html-test-folder/
├── normal.html           # 정상 HTML (CSS·이미지·스크립트 포함)
├── style.css             # normal.html이 참조하는 외부 CSS
├── logo.png              # normal.html이 참조하는 이미지
├── attack-ipc.html       # 시나리오 3: Tauri IPC 탈취 시도
├── attack-path.html      # 시나리오 4: 경로 탈출 시도
├── attack-absolute.html  # 시나리오 5: 절대 경로 범위 밖 접근
├── large.html            # 시나리오 6: 5MB 초과 파일
└── sub/
    └── child.html        # 시나리오 3(기능): 상위 폴더 자산 참조
```

---

## 시나리오 3 (보안 must-pass): 앱 권한 탈취 시도 차단

### attack-ipc.html 내용

```html
<!DOCTYPE html>
<html>
<head><title>Attack: IPC</title></head>
<body>
  <h1>IPC 탈취 시도 테스트</h1>
  <div id="result">시도 중...</div>
  <script>
    // 시도 1: window.__TAURI__ 직접 접근
    if (window.__TAURI__) {
      document.getElementById('result').textContent =
        '⚠️ 취약: __TAURI__ 접근 성공';
    } else {
      document.getElementById('result').textContent =
        '✅ 안전: __TAURI__ 접근 불가 (undefined)';
    }

    // 시도 2: __TAURI_IPC__ 직접 호출
    try {
      if (window.__TAURI_IPC__) {
        window.__TAURI_IPC__({ cmd: 'delete_file', path: '/tmp/test.txt' });
        document.getElementById('result').textContent += ' | ⚠️ IPC 호출 성공';
      } else {
        document.getElementById('result').textContent += ' | ✅ IPC 접근 불가';
      }
    } catch(e) {
      document.getElementById('result').textContent +=
        ' | ✅ IPC 호출 오류(예상): ' + e.message;
    }

    // 시도 3: parent window 접근 시도
    try {
      const parentTauri = window.parent.__TAURI__;
      if (parentTauri) {
        document.getElementById('result').textContent += ' | ⚠️ parent.__TAURI__ 접근 성공';
      } else {
        document.getElementById('result').textContent += ' | ✅ parent.__TAURI__ 없음';
      }
    } catch(e) {
      document.getElementById('result').textContent +=
        ' | ✅ parent 접근 차단(예상 — sandbox): ' + e.message;
    }
  </script>
</body>
</html>
```

### 검증 절차

1. 앱 실행: `npm run dev`
2. `/tmp/html-test-folder` 폴더 열기
3. 사이드바에서 `attack-ipc.html` 클릭
4. 프리뷰 패널에서 표시된 결과 확인

### 합격 기준

- `__TAURI__` 접근이 **undefined** 또는 차단되어야 한다
- `__TAURI_IPC__` 호출이 **차단**되거나 오류가 발생해야 한다
- `window.parent.__TAURI__` 접근이 **차단**(SecurityError)되어야 한다
- 파일 시스템 조작이 **일어나지 않아야** 한다

---

## 시나리오 4 (보안 must-pass): 경로 탈출 시도 차단

### attack-path.html 내용

```html
<!DOCTYPE html>
<html>
<head><title>Attack: Path Traversal</title></head>
<body>
  <h1>경로 탈출 테스트</h1>
  <p>아래 이미지·링크가 로드되지 않아야 합니다:</p>

  <!-- 상위 폴더 탈출 시도 -->
  <img id="escape-img"
       src="../../.ssh/id_rsa"
       alt="탈출 시도"
       onload="document.getElementById('result').textContent='⚠️ 취약: 상위 폴더 자산 로드됨'"
       onerror="document.getElementById('result').textContent='✅ 안전: 경로 탈출 차단됨'"
  />

  <!-- 동일 폴더 형제 폴더 탈출 시도 -->
  <img src="../other-folder/secret.png"
       alt="형제 폴더 탈출"
       onerror="this.alt='✅ 형제 폴더 차단됨'"
  />

  <div id="result">테스트 중...</div>
</body>
</html>
```

### 검증 절차

1. 폴더 열기 후 `attack-path.html` 클릭
2. 프리뷰 패널 확인

### 합격 기준

- 이미지가 **로드되지 않고** `onerror` 처리가 실행되어야 한다
- 브라우저 개발자 도구(WebView Inspector)에서 asset 요청이 **403/blocked** 상태여야 한다
- `../../` 경로가 해소된 절대 경로는 `A/**` glob에 매칭되지 않아 자동 차단되어야 한다

---

## 시나리오 5 (보안 must-pass): 범위 밖 절대 경로 읽기 차단

### attack-absolute.html 내용

```html
<!DOCTYPE html>
<html>
<head><title>Attack: Absolute Path</title></head>
<body>
  <h1>절대 경로 접근 테스트</h1>
  <p>아래 자산들이 차단되어야 합니다:</p>

  <!-- /etc/passwd 접근 시도 -->
  <img src="/etc/passwd"
       alt="/etc/passwd"
       onerror="this.parentElement.innerHTML += ' → ✅ 차단됨'"
  />

  <!-- 홈 디렉토리 비밀 파일 접근 시도 -->
  <img src="/Users/$(whoami)/.ssh/id_rsa"
       alt="ssh key"
       onerror="this.parentElement.innerHTML += ' → ✅ 차단됨'"
  />

  <script>
    // fetch로 절대 경로 시도
    fetch('asset://localhost//etc/passwd')
      .then(r => r.text())
      .then(t => {
        document.body.innerHTML +=
          '<p style="color:red">⚠️ 취약: /etc/passwd 내용 로드됨: ' +
          t.substring(0, 100) + '</p>';
      })
      .catch(e => {
        document.body.innerHTML +=
          '<p style="color:green">✅ 안전: /etc/passwd 접근 차단됨 — ' + e + '</p>';
      });
  </script>
</body>
</html>
```

### 검증 절차

1. 폴더 열기 후 `attack-absolute.html` 클릭
2. 프리뷰 패널 확인

### 합격 기준

- 모든 절대 경로 자산이 **차단**되어야 한다
- `/etc/passwd` fetch가 **실패**하고 오류 안내가 표시되어야 한다
- 민감한 파일 내용이 **노출되지 않아야** 한다

---

## 시나리오 5-A (보안 must-pass): 재시작 후 scope가 bounded 상태임을 확인

> **[SUPERSEDED] 원래 5-A 문구("앱 재시작 후 빈 scope 확인")는 v1.2.0에서 폐기되었다.**
> 1차 수동 검증(2026-05-14)에서, 폴더를 수동으로 열지 않았는데도
> `fetch('asset://localhost//tmp/html-test-folder/normal.html')`이 status=200을 반환했다.
>
> **근본 원인 (확인됨)**: `src/App.tsx` 23-32행 — 앱이 시작 시 직전에 열었던 폴더를
> 자동 복원한다(SPEC-UI-003 REQ-UI-003-06/07의 기존 의도된 기능). 자동 복원은
> `openFolderPath(lastWatchedPath)`를 호출하고, 이는 본 SPEC의 M1 구현 이후
> `registerAssetScope`(= `allow_directory`)를 호출한다. 따라서 재시작 직후
> asset scope는 사용자가 아무것도 하기 전에 직전 폴더로 즉시 다시 채워진다.
>
> **이것은 취약점이 아니다.** 근거:
> - scope는 여전히 **bounded**(allow-all 아님): 시나리오 5에서 폴더가 열려 있어도
>   `/etc/passwd`가 status=403을 반환함이 이미 증명됨. 정적 `scope: []` + 런타임
>   `allow_directory`는 한정된 scope를 만든다.
> - 자동 복원되는 폴더는 사용자가 직전 세션에서 **명시적으로 연** 폴더이므로
>   "scope는 사용자가 명시적으로 연 폴더만 포함한다"는 보안 속성이 그대로 성립한다.
> - 시작 시 HTML이 자동 렌더링되지 않으므로(사용자가 `.html`을 클릭해야 함)
>   자동 복원은 자동 실행 공격면을 추가하지 않는다.
> - Rust `asset_protocol_scope`는 프로세스 시작 시점엔 비어 있다 — 즉시 한 폴더를
>   다시 등록하는 것은 프런트엔드 자동 복원이다.

### 검증 절차 (수정된 판별 테스트)

1. 직전 세션에서 폴더 A(`/tmp/html-test-folder`)를 명시적으로 연다.
2. 앱을 완전히 종료 후 재시작: `npm run dev`. **시작 후 폴더를 수동으로 조작하지 않는다**
   (SPEC-UI-003 자동 복원이 폴더 A를 다시 열도록 둔다).
3. 브라우저 개발자 도구 콘솔에서 다음 두 요청을 실행:
   ```javascript
   // (a) 자동 복원된 폴더 A 안의 파일 → 200 기대 (사용자가 연 폴더이므로 정상)
   fetch('asset://localhost//tmp/html-test-folder/normal.html')
     .then(r => console.log('(a) 복원 폴더 파일 status:', r.status, '— 200이어야 정상'))
     .catch(e => console.log('(a) 오류:', e));

   // (b) 등록된 폴더 밖 경로 → 403 must-pass
   fetch('asset://localhost//etc/passwd')
     .then(r => console.log('(b) /etc/passwd status:', r.status, '— 403이어야 안전'))
     .catch(e => console.log('(b) 차단됨(안전):', e));
   ```

### 합격 기준

- **(a) 복원된 폴더 A의 파일은 접근 가능(status 200)** — 폴더 A는 사용자가 명시적으로
  연 폴더이므로 이는 기대된 정상 동작이다.
- **(b) 등록된 폴더 밖 경로(`/etc/passwd` 등)는 차단(status 403)** — 반드시 성립.
- (a)와 (b)가 함께 성립하여 scope가 allow-all이 아니라 **bounded**(사용자가 연 폴더로
  한정)임이 증명된다.
- 원래 기대였던 "scope가 완전히 빈 상태"는 SPEC-UI-003 자동 복원과 양립하지 않으므로
  더 이상 합격 기준이 아니다.

---

## 시나리오 1 (기능): 정상 HTML 보기

### 검증 절차

1. `normal.html` 및 `style.css`, `logo.png` 파일 준비
2. 폴더 열기 → 사이드바에 `normal.html` 표시 확인
3. `normal.html` 클릭

### 합격 기준

- 프리뷰 패널에 iframe이 렌더링되어야 한다
- CSS가 적용된 디자인이 보여야 한다
- 이미지(`logo.png`)가 표시되어야 한다
- 편집기 패널에 "이 형식은 편집할 수 없습니다" 플레이스홀더가 표시되어야 한다

---

## 시나리오 2 (기능): 마크다운 ↔ HTML 전환

### 검증 절차

1. 폴더 열기
2. `.md` 파일 클릭 → 마크다운 렌더링 확인
3. `.html` 파일 클릭 → HTML iframe 렌더링 확인
4. 다시 `.md` 파일 클릭 → 마크다운 렌더링으로 복귀 확인

### 합격 기준

- 전환 시 프리뷰 패널이 올바른 뷰를 표시해야 한다
- HTML 디자인이 앱 셸(헤더·사이드바·푸터)을 침범하지 않아야 한다
- 마크다운 파일로 돌아왔을 때 편집기가 정상 편집 가능 상태여야 한다

---

## 시나리오 3 (기능): 하위 폴더 HTML이 상위 폴더 자산 참조

### child.html 내용

```html
<!DOCTYPE html>
<html>
<head>
  <!-- 상위 폴더의 style.css 참조 -->
  <link rel="stylesheet" href="../style.css" />
</head>
<body>
  <img src="../logo.png" alt="상위 폴더 이미지" />
  <p>상위 폴더 자산이 로드되어야 합니다.</p>
</body>
</html>
```

### 검증 절차

1. `/tmp/html-test-folder/` 열기
2. `sub/child.html` 클릭

### 합격 기준

- `../style.css`와 `../logo.png`가 정상 로드되어야 한다 (폴더 A/** glob 범위 내)

---

## 시나리오 6 (성능): 5MB 초과 파일 — 앱 멈춤 방지

### large.html 생성

```bash
# 5MB보다 큰 파일 생성
python3 -c "print('<html><body>' + 'x' * (5*1024*1024 + 1000) + '</body></html>')" > /tmp/html-test-folder/large.html
```

### 검증 절차

1. 폴더 열기
2. `large.html` 클릭

### 합격 기준

- iframe이 **렌더링되지 않아야** 한다
- "미리보기 불가" 안내 메시지가 표시되어야 한다
- 앱이 응답 불가 상태가 되지 않아야 한다

---

## 시나리오 7 (회귀 must-pass): 기존 마크다운 기능 회귀 없음

### 검증 절차

1. 폴더 열기
2. 코드 하이라이트가 포함된 마크다운 파일 열기
3. KaTeX 수식(`$E = mc^2$`) 포함 마크다운 파일 열기
4. Mermaid 다이어그램 포함 마크다운 파일 열기
5. 스크롤 싱크 동작 확인 (Footer의 스크롤 싱크 버튼 활성화 후)

### 합격 기준

- 마크다운 렌더링이 이전과 동일하게 동작해야 한다
- KaTeX, Mermaid가 올바르게 렌더링되어야 한다
- 스크롤 싱크가 정상 동작해야 한다
- Export 기능(HTML/PDF/DOCX)이 회귀 없이 동작해야 한다

---

## 오픈 질문 (manual-verification 후 결정)

### 5-B: allow-same-origin 부여 필요 여부 — 확정됨

**1차 검증 결과 (2026-05-14, `sandbox="allow-scripts"`)**:
- 시나리오 1: 스크립트는 실행됐으나 **외부 CSS·이미지가 로드되지 않음**.
  `allow-scripts`만 주면 iframe 문서가 불투명 origin을 가져 자기 자신의
  `asset:` 상대경로 자산조차 cross-origin으로 차단됨.
- 시나리오 3: IPC 탈취 정상 차단 (sandbox 동작 확인).

**결정**: `sandbox="allow-scripts allow-same-origin"`으로 변경.
- 근거: iframe 콘텐츠는 `asset://` origin에서 제공되고 앱 셸은 `tauri://`
  (dev는 `localhost:1420`) origin이다. `allow-same-origin`은 iframe을 자기
  자신의 `asset:` 자산과만 same-origin으로 묶으며, 앱 셸과는 여전히
  cross-origin이므로 `__TAURI__`·`parent` 접근은 차단된 채로 유지된다.
- 위험한 케이스(프레임 콘텐츠가 임베더와 same-origin → sandbox 자가 해제)는
  origin이 다르므로 해당하지 않는다.

**재검증 필요 (2차 라운드 — must-pass)**:
1. **시나리오 1 재실행** — `normal.html`에서 CSS(파란 배경+금색)와 이미지(금테)가
   로드되어야 한다.
2. **시나리오 3 재실행 (필수)** — `attack-ipc.html`에서 `__TAURI__`·IPC·parent
   접근이 **여전히 모두 차단**되어야 한다. 하나라도 ⚠️가 나오면 이 결정을 롤백한다.
3. 시나리오 4·5도 재확인 권장 (scope 경계는 sandbox와 무관하므로 변화 없어야 함).
