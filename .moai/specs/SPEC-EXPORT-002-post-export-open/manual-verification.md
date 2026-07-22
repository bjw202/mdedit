# SPEC-EXPORT-002 수동 검증 항목

본 SPEC 의 일부 요구사항은 자동화(vitest/Playwright) 범위 밖이다. 아래 항목들은
`tauri dev` 또는 실제 빌드 앱을 직접 조작해야만 검증 가능하며, 본 Run phase 에서는
**추적 가능한 미검증 항목**으로 명시적으로 남긴다(acceptance.md "검증 불가 경계").

---

## 1. reveal 권한 충분성 (T5, spec.md A3, 신뢰도 Medium)

**상황**: `capabilities/main.json` 에 `opener:allow-reveal-item-in-dir` 단일 퍼미션을
추가했다. 이것만으로 reveal 이 permission denied 없이 동작하는지는 plan phase 에서
확정하지 못했다(문서만 보고 추측 금지).

**검증 절차**:
1. `tauri dev` 로 앱 실행.
2. 임의의 마크다운 문서를 연다(또는 새 문서 작성).
3. Export → Export as HTML (또는 DOCX) → 저장 다이얼로그에서 위치 선택.
4. 완료 모달이 나타나면 `폴더에서 보기` 클릭.
5. **기대**: Finder(macOS)/탐색기(Windows)/파일 관리자(Linux) 가 열리고 **내보낸 파일이
   선택된 상태**로 표시된다.

**실패 시 대응**:
- permission denied 에러가 콘솔에 찍히거나 alert 로 노출되면, `opener:default` 외에
  추가 scope/permission 항목이 필요한 것이다. 식별 후 `capabilities/main.json` 에 추가하고
  본 문서 + spec.md A3 에 결과 반영.
- 본 Run phase 에서는 `tauri dev` 를 실행할 수 없어 이 검증을 수행하지 못했다.

---

## 2. 크로스플랫폼 스모크 (acceptance.md S1~S4)

Playwright 는 앱 webview 내부만 관측한다. Finder/탐색기/Preview/Word 가 실제로
떴는지, 파일이 선택 상태로 표시되는지는 관측 범위 밖이다(검증 불가 경계 (1)).
각 플랫폼에서 수동 확인이 필요하다.

### S1. `열기` → OS 기본 앱으로 내보낸 파일이 열림 (macOS/Windows/Linux)
- HTML → 기본 브라우저(Safari/Chrome/Edge/Firefox).
- DOCX → Word / LibreOffice / Pages 등.
- 기본 앱 미등록 시: AC-008 실패 경로(window.alert)로 처리되는지 함께 확인.

### S2. `폴더에서 보기` → macOS Finder 에서 파일 선택 상태로 폴더 열림
- 파일이 하이라이트된 Finder 창이 표시되어야 한다.

### S3. `폴더에서 보기` → Windows 탐색기에서 파일 선택 상태로 폴더 열림
- 파일이 하이라이트된 탐색기 창이 표시되어야 한다.

### S4. `폴더에서 보기` → Linux 동작
- 파일 관리자 구현에 따라 **폴더만 열리고 파일 선택이 되지 않을 수 있음**(허용되는 기능적 저하,
  spec.md A2). **폴더조차 열리지 않으면 결함**이다.

---

## 3. 자동화된 검증의 한계 (이미 acceptance.md 에 명시)

- **open/reveal 의 실제 OS 실행**: Playwright 는 invoke payload 단언까지만 검증한다
  (`post-export-dialog.spec.ts` AC-005/006). 그 아래는 `tauri-plugin-opener` 의 책임이다.
- **파일 "무변경"** (PDF, browser_ops.rs, devDependencies, src-tauri/ 변경 1건 한정):
  baseline hash 가 없어 vitest 로 단언 불가 → `git diff main..HEAD` 로 코드 리뷰 확인.
  본 Run phase 커밋들은 모두 명시적 경로만 스테이징했으므로 해당 제약을 준수했다.
