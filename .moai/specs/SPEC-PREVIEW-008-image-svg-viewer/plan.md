# SPEC-PREVIEW-008 — 구현 계획

> 본 문서는 WHAT/WHY(spec.md)에 대한 HOW를 다룬다. 확정된 기술 결정과 브라운필드 변경 지도, @MX 태그 대상을 기록한다. Given-When-Then 수용 시나리오는 acceptance.md 참조.

## 확정 기술 결정 (Locked Decisions)

| # | 결정 | 내용 | 근거 |
|---|------|------|------|
| D1 | **상태 라우팅 = 확장자 기반** | `getFileViewType`에 이미지·SVG **확장자 분기**를 추가하고, `previewStatus`(binary/text) 판정보다 **앞에** 배치한다. `PreviewStatus` 타입은 **확장하지 않는다**('image'/'svg' 상태값 미추가). fileStore·useFileSystem 변경 최소화. | SPEC-PREVIEW-007의 `.html`/`.md` 분기가 `previewStatus`보다 앞에 놓인 것과 동일 패턴. 래스터는 `read_file` reject로 `binary`, SVG는 성공으로 `text`가 되므로, 확장자 분기가 앞서지 않으면 오라우팅된다. |
| D2 | **이미지 로드 경로 = `asset://`** | `ImageFileViewer`는 `convertFileSrc`(OS 파일 스트리밍)로 이미지를 `<img>`에 로드한다. base64 데이터 URI(`read_image_as_base64`)는 사용하지 않는다. | asset://는 메모리 적재가 없어 대용량 이미지도 저비용(HtmlFileViewer가 v1.3.0에서 5MB 임계 제거한 것과 동일). base64는 대용량에서 메모리·성능 부담. |
| D3 | **SVG 대용량 임계값 = 소스 뷰에만** | SVG 렌더 뷰는 무제한(asset:// 또는 sanitize된 인라인 표시). `FILE_SIZE_THRESHOLD`는 소스 뷰(텍스트를 메모리에 적재해 Shiki 강조)에만 적용. | 렌더는 저비용, 소스 강조는 대용량에서 비용이 크다. 렌더 뷰를 임계값으로 막으면 기능 상실. |
| D4 | **인라인 SVG = placeholder-and-restore** | markdown-it 렌더 전 `<svg>...</svg>` 블록을 플레이스홀더 토큰으로 치환 → `html:false` 하에서 렌더 → 렌더된 HTML의 플레이스홀더를 DOMPurify SVG 프로파일로 sanitize한 SVG로 복원. **커스텀 markdown-it 블록 룰 미사용.** | markdown-it 파이프라인을 건드리지 않아 회귀 위험 최소. `html:false` 전역 유지. 후처리 위치가 단일(PreviewRenderer sanitize 단계). |
| D5 | **DOMPurify 의존성 추가** | `dompurify` + `@types/dompurify`를 package.json에 추가. sanitize 유틸은 인라인 SVG·SVG 뷰어 렌더 뷰가 공용. | 현재 미포함(검증 완료). SVG 프로파일 sanitize에 필요. |
| D6 | **SvgFileViewer가 `.svg` 평문 경로 대체** | `.svg`는 현재 `previewStatus='text'` → `CodeFileViewer lang='text'`(평문 XML). 확장자 분기가 이를 넘겨받아 `SvgFileViewer`(렌더 기본)로 라우팅. 소스 뷰는 내부에서 `CodeFileViewer`(또는 Shiki) 재사용. | 사용자는 XML 소스가 아니라 그림을 먼저 보기를 기대. |

## 구현 마일스톤 (우선순위 순, 시간 추정 없음)

### M1 (우선순위: High) — 라우팅 골격 + 이미지 뷰어
- `getFileViewType`에 이미지·SVG 확장자 분기 추가(확장자 우선, previewStatus 앞).
- `ImageFileViewer` 신규 생성: asset:// `<img>`, 줌(fit/100%/증감)·팬, 체커보드, 픽셀·파일 크기 메타, 테마 대응.
- `openFile`에 이미지 확장자 조기 분기(래스터 `read_file` 시도 회피, 뷰 전용 처리; 대용량 가드 미적용).
- 검증: 시나리오 A·B·C·H(이미지·회귀 부분).

### M2 (우선순위: High) — SVG 뷰어 (렌더/소스 토글)
- `SvgFileViewer` 신규 생성: 렌더 뷰 기본(sanitize된 SVG), 소스 뷰 토글(Shiki), 렌더 뷰 줌·팬.
- `getFileViewType` `'svg'` 분기 → `SvgFileViewer` 렌더.
- SVG 소스 뷰에만 `FILE_SIZE_THRESHOLD` 적용(D3).
- 공용 `svgSanitize` 유틸 신규(DOMPurify SVG 프로파일).
- 검증: 시나리오 D·E·F.

### M3 (우선순위: Medium) — 마크다운 인라인 SVG
- `dompurify` + `@types/dompurify` 의존성 추가.
- `renderer.ts`/`PreviewRenderer.tsx`에 placeholder-and-restore + sanitize 단계 추가(D4). `html:false` 유지.
- 검증: 시나리오 G(인라인 SVG 허용 + 일반 HTML 차단).

### M4 (우선순위: Medium) — 회귀·보안 가드 고정
- 악성 SVG 픽스처 가드 테스트(스크립트 미실행).
- 기존 라우팅(.md/.html/code/text/binary)·이미지 문법 회귀 스위트.
- 검증: 시나리오 F·G·H 전체 + acceptance.md 테스트 매핑.

## [DELTA] Brownfield Change Map

| 분류 | 대상 | 변경 내용 |
|------|------|-----------|
| [MODIFY] | `src/components/preview/PreviewContainer.tsx` | `getFileViewType` 반환 타입에 `'image'`·`'svg'` 추가. **이미지·SVG 확장자 분기를 `.html`/`.md` 분기와 함께 `previewStatus` 판정보다 앞에** 삽입(D1, 확장자 우선). `viewType==='image'`→`ImageFileViewer`, `'svg'`→`SvgFileViewer` 렌더 분기 추가. @MX:ANCHOR 유지, @MX:SPEC에 REQ-PREVIEW008 추가. |
| [MODIFY] | `src/hooks/useFileSystem.ts` | `openFile`에 이미지·SVG 확장자 조기 분기 추가: 래스터 이미지는 `read_file` 미시도(reject 낭비 회피), `currentFile`만 설정하고 편집기 미로드. SVG는 소스 뷰용 텍스트 로드(렌더 뷰가 기본). 대용량 가드(REQ-007-005)를 이미지·SVG 렌더에 적용하지 않음. `PreviewStatus`는 확장하지 않음(D1) — 기존 값 재사용 또는 무영향. |
| [MODIFY] | `src/store/fileStore.ts` | **무변경 목표.** D1(확장자 기반)에 따라 `PreviewStatus` 확장 없음. 확장자 분기가 store 상태에 의존하지 않으므로 fileStore는 손대지 않는다. |
| [NEW] | `src/components/preview/ImageFileViewer.tsx` | 래스터 이미지 보기 전용 컴포넌트. `convertFileSrc`(asset://)로 `<img>` 로드(D2). 줌(fit/100%/증감)·팬, 투명 체커보드 배경(CSS), `<img>` `naturalWidth/Height`로 픽셀 크기, `FileNode.size`로 파일 크기 표시, 테마 대응. `previewZoom` 규약 정합. |
| [NEW] | `src/components/preview/SvgFileViewer.tsx` | `.svg` 렌더/소스 토글 뷰어. 렌더 뷰: `svgSanitize`된 SVG를 표시(줌·팬). 소스 뷰: `CodeFileViewer`(Shiki, lang='xml' 또는 'svg') 재사용 + `FILE_SIZE_THRESHOLD` 적용(D3). 토글 상태는 로컬 useState. |
| [NEW] | `src/lib/preview/svgSanitize.ts` | DOMPurify SVG 프로파일 sanitize 단일 유틸. 인라인 SVG·SVG 뷰어 렌더 뷰 공용. 설정: spec.md Security 섹션. sanitize 실패 시 안전 폴백 반환. |
| [MODIFY] | `src/lib/markdown/renderer.ts` | `html:false` **유지**. 렌더 전 `<svg>...</svg>` 블록을 플레이스홀더로 치환하는 전처리 추가(D4). 커스텀 블록 룰 미사용. @MX:NOTE로 "html:false 유지, svg만 placeholder-and-restore" 근거 명시. |
| [MODIFY] | `src/components/preview/PreviewRenderer.tsx` | `dangerouslySetInnerHTML` 직전에 플레이스홀더 → `svgSanitize`된 SVG 복원 단계 추가(D4). @MX:ANCHOR 유지, @MX:NOTE에 "svg만 DOMPurify로 허용, 일반 HTML은 html:false로 차단" 근거 추가. |
| [MODIFY] | `package.json` | `dompurify` + `@types/dompurify` 의존성 추가(D5, 현재 미포함 검증 완료). |
| [EXISTING] | `src-tauri/src/commands/image_ops.rs` | 변경 없음 — D2로 base64 미사용. `read_image_as_base64`는 재사용 안 함(asset:// 경로). |
| [EXISTING] | `src/lib/image/imageResolver.ts` | 변경 없음 — 이미지 문법 `![](x.svg)`/`![](x.png)` 경로 그대로. |
| [EXISTING] | `src/lib/preview/extensionLangMap.ts` | 변경 없음 — 이미지/SVG 확장자는 코드 매핑에 없음(검증 완료), 코드 뷰어로 오라우팅되지 않음. |
| [EXISTING] | `src/components/preview/CodeFileViewer.tsx`, `UnsupportedFileViewer.tsx`, `HtmlFileViewer.tsx`, `MarkdownPreview.tsx` | 변경 없음 — 기존 라우팅 유지(SVG 소스 뷰에 CodeFileViewer 무변경 재사용). |

## @MX Tag Targets

- **`getFileViewType` (`PreviewContainer.tsx`)** — 이미 `@MX:ANCHOR`(fan_in 진입점). 이미지·SVG 분기 추가 시 ANCHOR 유지 + `@MX:SPEC: SPEC-PREVIEW-008` 추가. 확장자 우선 순서 불변식을 `@MX:REASON`에 명시(previewStatus보다 앞, D1).
- **`PreviewRenderer` (`PreviewRenderer.tsx`)** — 이미 `@MX:ANCHOR`. sanitize/restore 단계 확장 시 `@MX:NOTE` 갱신: "svg 서브트리만 DOMPurify로 허용, 일반 HTML은 markdown-it html:false로 차단". 보안 불변식 → `@MX:WARN` 후보(설정 약화 시 XSS, `@MX:REASON` 동반).
- **`renderer.ts` `renderMarkdown`** — `html:false` 라인에 `@MX:WARN`/`@MX:REASON`: "html:true 전환 금지, svg 예외는 placeholder-and-restore로만".
- **`svgSanitize.ts` (신규)** — 인라인 SVG·SVG 뷰어 양쪽 사용 → fan_in >= 2, 보안 경계 → `@MX:ANCHOR` 후보.
- **`ImageFileViewer` / `SvgFileViewer` (신규)** — 신규 exported 컴포넌트 → `@MX:NOTE`(의도·재사용 패턴). 초기 미검증 구간은 `@MX:TODO`(GREEN에서 해소).

## 리스크 및 완화

| 리스크 | 영향 | 완화 |
|--------|------|------|
| DOMPurify SVG 프로파일 설정 드리프트로 XSS 허용 | 높음(보안) | 악성 SVG 픽스처 가드 테스트로 설정 고정(M4). 버전 핀 검토. |
| placeholder-and-restore가 코드블록 내 `<svg>` 텍스트를 잘못 치환 | 중간 | 플레이스홀더 치환을 코드펜스/인라인코드 밖에만 적용하도록 경계 처리. 회귀 테스트에 "코드블록 안 svg 텍스트" 픽스처 포함. |
| asset:// scope 미등록 폴더에서 이미지 로드 실패 | 중간 | 기존 `registerAssetScope`(openFolder 시 등록) 재사용. 로드 실패 시 뷰어 내 오류 안내(앱 중단 없음). |
| 대용량 SVG 소스 강조 성능 | 낮음 | D3으로 소스 뷰에만 임계값 적용, 초과 시 강조 생략 안내. |
| SMIL 애니메이션 DoS | 낮음(범위 밖) | 리스크로만 기록, 본 SPEC 미해결. |

## 검증 게이트

- 본 저장소 게이트: **tsc + vitest + Playwright**(eslint 아님 — `npm run lint`는 설정 부재로 항상 실패, 회귀 오판 금지).
- must-pass: 시나리오 F·G(보안), H(회귀). acceptance.md 테스트 매핑 참조.
