#!/usr/bin/env node
// SPEC-INFRA-002 REQ-002·005 — 릴리스 태그와 세 파일 버전의 일치 검사 + 직전 버전 태그 계산.
// 릴리스 워크플로의 version-check job이 실행한다:
//   node scripts/check-release-version.mjs "$GITHUB_REF_NAME"
// 의존성 없이 Node 기본 모듈만 쓴다(워크플로에서 npm ci 없이 실행).
import { appendFileSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

// @MX:NOTE: [AUTO] 점을 이스케이프하고 ^…$로 고정한다 — 이스케이프하지 않으면 v0x19x0 같은 태그가 통과한다.
// 프리릴리스(-rc.1)·4자리 버전 거부는 의도된 동작이다(워크플로 태그 필터와 같은 범위만 허용).
const TAG_PATTERN = /^v(\d+)\.(\d+)\.(\d+)$/;

// 워크플로 로그와 오류 메시지에 그대로 찍히는 저장소 기준 상대 경로
export const VERSION_FILES = {
  packageJson: "package.json",
  cargoToml: "src-tauri/Cargo.toml",
  tauriConf: "src-tauri/tauri.conf.json",
};

function parseTag(tag) {
  const m = TAG_PATTERN.exec(tag ?? "");
  return m ? m.slice(1).map(Number) : null;
}

// @MX:ANCHOR: [AUTO] 버전 검사 계약 — 입력: 태그·[{file, version}], 출력: 오류 메시지 목록(빈 배열 = 통과)
// @MX:REASON: release.yml version-check job(CLI 경유)과 단위 테스트가 함께 의존한다. 메시지 형식(파일 경로·값·태그 포함)은 AC-001이 검사한다.
export function checkReleaseVersion(tag, versions) {
  if (!parseTag(tag)) {
    return [`태그 형식 위반: ${JSON.stringify(tag ?? "")} — 정확히 vX.Y.Z(숫자 3개) 형식이어야 한다(프리릴리스·4자리 버전은 지원하지 않음).`];
  }
  const expected = tag.slice(1);
  return versions
    .filter(({ version }) => version !== expected)
    .map(({ file, version }) => `버전 불일치: ${file}의 version은 ${JSON.stringify(version)}인데 태그는 ${tag}(기대값 ${expected})이다.`);
}

// @MX:NOTE: [AUTO] [package] 절 안의 version만 읽는다 — [dependencies]의 `tauri = { version = "2" }` 같은 값을 잡지 않도록
// 절 머리(`[...]`)가 나올 때마다 현재 절을 바꾸고, 줄 맨 앞의 `version =` 키만 본다. CRLF도 허용한다.
export function readCargoPackageVersion(tomlText) {
  let section = "";
  for (const raw of tomlText.split(/\r?\n/)) {
    const line = raw.trim();
    const header = /^\[([^\]]+)\]$/.exec(line);
    if (header) {
      section = header[1].trim();
      continue;
    }
    if (section !== "package") continue;
    const m = /^version\s*=\s*"([^"]*)"/.exec(line);
    if (m) return m[1];
  }
  return null;
}

function compareParts(a, b) {
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return 0;
}

// 현재 태그보다 작은 vX.Y.Z 태그 가운데 가장 큰 것(숫자 비교). 없으면 빈 문자열.
export function findPreviousTag(tags, currentTag) {
  const current = parseTag(currentTag);
  if (!current) return "";
  let best = null;
  for (const tag of tags) {
    const parts = parseTag(tag);
    if (!parts || compareParts(parts, current) >= 0) continue;
    if (!best || compareParts(parts, best.parts) > 0) best = { tag, parts };
  }
  return best ? best.tag : "";
}

function readJsonVersion(path) {
  // BOM과 CRLF가 섞여 있어도 JSON.parse가 읽도록 BOM만 제거한다
  const text = readFileSync(path, "utf8").replace(/^﻿/, "");
  const version = JSON.parse(text).version;
  return typeof version === "string" ? version : null;
}

// 세 파일의 version을 읽는다. 경로는 node:path로 합쳐 Windows 러너에서도 동작한다.
export function readVersions(rootDir) {
  const at = (rel) => join(rootDir, ...rel.split("/"));
  return [
    { file: VERSION_FILES.packageJson, version: readJsonVersion(at(VERSION_FILES.packageJson)) },
    { file: VERSION_FILES.cargoToml, version: readCargoPackageVersion(readFileSync(at(VERSION_FILES.cargoToml), "utf8")) },
    { file: VERSION_FILES.tauriConf, version: readJsonVersion(at(VERSION_FILES.tauriConf)) },
  ];
}

function gitTags(rootDir) {
  const out = execFileSync("git", ["tag", "--list", "v*"], { cwd: rootDir, encoding: "utf8" });
  return out.split(/\r?\n/).filter(Boolean);
}

// CLI 본체. 부수 효과(파일·git·출력)를 인자로 받아 테스트에서 바꿔 끼울 수 있게 한다.
export function runCli({
  tag,
  rootDir = process.cwd(),
  outputFile = process.env.GITHUB_OUTPUT,
  listTags = gitTags,
  log = console.log,
  error = console.error,
} = {}) {
  const versions = parseTag(tag) ? readVersions(rootDir) : [];
  const errors = checkReleaseVersion(tag, versions);
  if (errors.length > 0) {
    for (const message of errors) error(`::error::${message}`);
    for (const { file, version } of versions) error(`  ${file}: ${JSON.stringify(version)}`);
    return 1;
  }
  const previousTag = findPreviousTag(listTags(rootDir), tag);
  const version = tag.slice(1);
  log(`태그 ${tag}와 세 파일 버전이 일치한다: ${versions.map((v) => v.file).join(", ")}`);
  log(previousTag ? `직전 버전 태그: ${previousTag}` : "직전 버전 태그 없음 — 노트 시작점을 지정하지 않는다");
  if (outputFile) {
    appendFileSync(outputFile, `tag=${tag}\nversion=${version}\nprevious_tag=${previousTag}\n`);
  }
  return 0;
}

// 직접 실행했을 때만 CLI를 돈다(테스트가 import해도 실행되지 않게).
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.exitCode = runCli({ tag: process.argv[2] ?? process.env.GITHUB_REF_NAME });
}
