# Architecture Overview - MdEdit v0.4.0

> **Last Updated**: 2026-04-01
> **Version**: 0.4.0
> **Stack**: Tauri v2 (Rust) + React 18 + TypeScript + CodeMirror 6

## Project Summary

MdEdit는 크로스 플랫폼 데스크톱 마크다운 에디터. Tauri v2 (Rust 백엔드) + React 18 (프론트엔드) 기반.

- **3-pane 레이아웃**: 사이드바 파일 탐색기, CodeMirror 6 에디터, 실시간 마크다운 미리보기
- **마크다운 렌더링**: markdown-it + Shiki 구문 강조 + Mermaid 다이어그램 + KaTeX 수식
- **내보내기**: HTML, PDF (네이티브 print), DOCX (docx npm 패키지)
- **파일 감시**: notify crate로 외부 변경 자동 감지
- **상태 관리**: Zustand (persist middleware로 localStorage 저장)
- **이미지 처리**: inline-blob (base64 data URI) 또는 file-save (./images/) 모드

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Tauri v2 Shell                           │
│                                                             │
│  ┌──────────────────────┐  ┌────────────────────────────┐  │
│  │   Rust Backend       │  │   React Frontend           │  │
│  │   (src-tauri/src/)   │  │   (src/)                   │  │
│  │                      │  │                            │  │
│  │  ┌────────────────┐  │  │  ┌──────────────────────┐  │  │
│  │  │ file_ops       │  │◄─┤  │ lib/tauri/ipc.ts     │  │  │
│  │  │ directory_ops   │  │  │  │ (19 IPC wrappers)    │  │  │
│  │  │ watcher        │  │  │  └──────────────────────┘  │  │
│  │  │ image_ops      │  │  │                            │  │
│  │  │ browser_ops    │  │  │  ┌──────────────────────┐  │  │
│  │  └────────────────┘  │  │  │ Components           │  │  │
│  │                      │  │  │  layout/ editor/      │  │  │
│  │  ┌────────────────┐  │  │  │  preview/ sidebar/    │  │  │
│  │  │ AppState       │  │  │  └──────────────────────┘  │  │
│  │  │  watcher       │  │  │                            │  │
│  │  │  watch_path    │  │  │  ┌──────────────────────┐  │  │
│  │  └────────────────┘  │  │  │ Zustand Stores       │  │  │
│  │                      │  │  │  editor / file / ui   │  │  │
│  └──────────────────────┘  │  └──────────────────────┘  │  │
│                            │                            │  │
│                            │  ┌──────────────────────┐  │  │
│                            │  │ Markdown Pipeline     │  │  │
│                            │  │  markdown-it + Shiki  │  │  │
│                            │  │  + Mermaid + KaTeX    │  │  │
│                            │  └──────────────────────┘  │  │
│                            └────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Module Map

자세한 내용은 각 영역별 codemap 참조:

- [frontend.md](./frontend.md) — React 컴포넌트, 훅, 스토어, 라이브러리
- [backend.md](./backend.md) — Rust 모듈, IPC 커맨드, 상태 관리
- [pipelines.md](./pipelines.md) — 렌더링, 이미지, 내보내기 파이프라인 + 데이터 플로우
- [testing.md](./testing.md) — 테스트 아키텍처, 커버리지 맵, 패턴
