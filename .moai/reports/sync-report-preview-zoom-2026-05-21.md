# 동기화 보고서: 미리보기 줌(Preview Zoom) 버그 수정

**작성일**: 2026-05-21  
**작업 분기**: `fix/preview-zoom`  
**커밋 해시**: 4c3b90d  
**작업 유형**: 버그 수정 (SPEC 없음 — /moai fix 처리)

---

## 개요

헤더의 A-/A+ 폰트 조절 기능이 마크다운 미리보기의 전체 요소(헤딩, 인라인 코드, 표, 이미지, 간격)를 zoom 배율로 동시에 확대/축소하도록 개선되었습니다.

### 기술 상세

| 항목 | 내용 |
|-----|------|
| **문제점** | A-/A+ 버튼이 에디터만 확대/축소하고, 미리보기 헤딩/코드는 고정 크기 유지 |
| **해결책** | fontSize 설정을 CSS zoom 비율로 해석 (zoom = fontSize/14), 미리보기와 코드 뷰어 동시 적용 |
| **확대/축소 대상** | 헤딩(h1-h6), 인라인 코드, 표, 이미지, 모든 간격 요소 |
| **미적용 대상** | .html iframe 뷰어, 에디터 패널 (변경 없음) |
| **신규 npm 의존성** | 없음 |

---

## 수정된 파일

### 새로 추가된 파일
- `src/lib/preview/previewZoom.ts` — fontSize → zoom 변환 유틸리티 함수

### 수정된 파일
- `src/components/preview/PreviewRenderer.tsx` — previewZoom 통합
- `src/components/preview/MarkdownPreview.tsx` — 미리보기 요소에 zoom 스타일 적용
- `src/components/preview/CodeFileViewer.tsx` — 코드 뷰어 zoom 동기화
- `src/index.css` — zoom 애니메이션 트랜지션 추가
- 관련 테스트 파일 업데이트

---

## 테스트 결과

| 항목 | 결과 |
|-----|------|
| **전체 테스트 통과** | 456/456 통과 |
| **타입 체크** | 0 오류 |
| **린팅** | 0 오류 |
| **빌드 성공** | ✓ |

---

## 문서화 현황

### 1. CHANGELOG.md
**상태**: ✓ 업데이트 완료

**변경 사항**: `## [Unreleased] → ### Fixed` 섹션에 다음 항목 추가
- **미리보기 폰트 크기 축소/확대 (A-/A+) 통합**
- 문제점, 현재 상태, 대상 파일, 신규 의존성 정보 포함

### 2. README.md
**상태**: ⊘ 스킵 (이유: 헤더 제어 기능의 행동 개선사항이므로 기능 목록에 추가하기 부자연스러움)

**분석**: 
- 현재 구조: 헤더 파일 작업 버튼 목록(`Ctrl+N`, `Ctrl+S`, `Ctrl+Shift+S`) 포함
- 줌 기능은 기존 기능의 내부 개선(헤딩·코드도 함께 스케일)이므로 별도 기능으로 나열하기 어색
- 결론: 자연스러운 추가 위치 없음 → 강제 편집 회피

### 3. `.moai/project/product.md`
**상태**: ✓ 업데이트 완료

**변경 사항**: `## Feature Status by SPEC → ### Font Size Control Enhancement` 섹션 업데이트
- 기존 불완전한 설명 제거
- 완성된 구현 내역 추가:
  - 상태: Completed (2026-05-21)
  - fontSize → zoom 변환 메커니즘
  - 영향 범위 명시 (미리보기/코드 뷰어 O, iframe/에디터 X)
  - 신규 파일 및 변경 파일 목록
  - 테스트 상태 기재

---

## 동기화 요약

| 파일 | 작업 | 사유 |
|-----|------|------|
| CHANGELOG.md | ✓ 업데이트 | 변경 기록 반영 필수 |
| README.md | ⊘ 스킵 | 기존 기능의 개선이므로 기능 목록 추가 부자연스러움 |
| product.md | ✓ 업데이트 | 완성된 기능 상태 동기화 필수 |
| src/** | — (미터치) | SPEC 없는 버그 수정이므로 코드 파일 편집 금지 |
| .moai/specs/** | — (미터치) | SPEC 문서 없음 (이는 /moai fix 작업이므로 정상) |

---

## 기술 정보

### 줌 구현 원리

```typescript
// fontSize를 CSS zoom 배율로 변환
const zoom = fontSize / 14; // 14px = 100% (기본값)
// 예: fontSize=16 → zoom=1.14 (114% 확대)
// 예: fontSize=12 → zoom=0.86 (86% 축소)
```

### 적용 범위

**미리보기 요소** (확대/축소 O):
- 모든 제목 (h1-h6)
- 인라인 코드 (`<code>`)
- 표 (`<table>`)
- 이미지 및 캡션
- 모든 간격 (margin, padding)

**제외 요소** (변경 없음):
- `.html` iframe 뷰어 (별도 샌드박스)
- 에디터 패널 (CodeMirror 독립 관리)

---

## 품질 보증

### LSP 검증
- 타입스크립트 타입 체크: ✓ 0 오류
- 린팅: ✓ 0 오류

### 테스트 커버리지
- 새로운 `previewZoom` 유틸 함수: 단위 테스트 포함
- MarkdownPreview 컴포넌트: 통합 테스트 업데이트
- CodeFileViewer 컴포넌트: zoom 동기화 테스트 추가
- 전체 테스트 통과율: 456/456 (100%)

### 회귀 방지
- zoom 값 범위 제한 (안전 경계값)
- 빠른 연속 줌 인/아웃 시 부드러운 애니메이션 적용
- 브라우저 호환성 검증 (CSS zoom 지원)

---

## 결론

미리보기 줌 버그 수정이 완료되었으며, 관련 문서가 동기화되었습니다. 

**완료된 작업**:
- CHANGELOG.md: 수정 내역 기재 ✓
- product.md: 기능 상태 업데이트 ✓
- README.md: 자연스러운 추가 지점 없어 스킵 ✓

**보존된 파일**:
- 소스 코드 (src/**, src-tauri/**): 미터치 ✓
- SPEC 문서 (.moai/specs/**): 해당 SPEC 없음 ✓

**테스트 상태**: 모두 통과 ✓

---

**작성자**: Claude Code Manager (documentation)  
**상태**: 문서화 동기화 완료  
**다음 단계**: PR 생성 후 orchestrator가 git commit 처리
