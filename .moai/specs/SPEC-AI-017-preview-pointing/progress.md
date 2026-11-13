# SPEC-AI-017 진행 기록

## §E.1 Plan-phase Audit-Ready Signal

- plan_status: audit-ready
- plan_complete_at: (plan-auditor PASS 후 기록)
- 작업 위치: `.claude/worktrees/t9`, 브랜치 `WT-preview-pointing`(origin/main 1f3d4a5 기준), 카드 t9
- 산출물: spec.md, plan.md, acceptance.md, spike/(스크립트 4개·결과 4개·실측 캡처)
- 계획 단계 실측: spec.md 「실측 기록」 S1~S5 (claude 2.1.323, codex-cli 0.167.0, pele 1.10.0, macOS)

### plan-auditor 회차 기록

| 회차 | 판정 | 점수 | 보고서 | 반영 |
|------|------|------|--------|------|

## spike/ 안내

| 파일 | 내용 | 다시 돌리기 |
|------|------|-------------|
| `targeting-rate.mjs` → `targeting-rate.json` | S1·S2 — 표 행·열 / 다이어그램 노드 ID 의 소스 대응률 | `node .moai/specs/SPEC-AI-017-preview-pointing/spike/targeting-rate.mjs .` (저장소 루트에서) |
| `block-length.json` | S1 — 최상위 표·다이어그램 블록 길이 분포(한 줄 스크립트 결과) | — |
| `sanitize-data-id.test.ts.txt` → `sanitize-data-id.out.txt` | S3 — `renderDiagram`(정화 포함) 뒤 `data-id`·`closest` (jsdom). 정규 테스트에 섞이지 않게 `.txt` 로 보관 | `.ts` 로 복사한 뒤 `npx vitest run <경로>` |
| `cli-roundtrip.mjs` → `cli-roundtrip.json`, `captures/` | S5 — 정본 문구로 claude haiku·codex 기본 모델 표 1건·다이어그램 1건 | `node …/cli-roundtrip.mjs <임시 폴더>` |
| `haiku-diagram-repeat.mjs` → `haiku-diagram-repeat.json` | S5 — 초안 vs 개정 문구, haiku 다이어그램 3회씩. **주의**: 이 스크립트는 `captures/diagram-node.*.txt` 를 초안으로 읽어 개정 문장을 끼워 넣는다. 정본 문구로 다시 잰 뒤 그 파일들이 개정본으로 바뀌었으므로, 지금 다시 돌리면 두 변형이 같아진다(기록된 JSON 은 바뀌기 전 실행 결과) | — |
| `captures/diagram-node.claude-haiku.draft-run0-unchanged.out.txt` | S5 — 초안 문구 1회차에 haiku 가 원본을 그대로 돌려준 실제 응답 | — |
