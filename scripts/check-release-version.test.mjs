// SPEC-INFRA-002 REQ-002·005 — 릴리스 버전 검사 스크립트 단위 테스트 (AC-001·002)
import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  checkReleaseVersion,
  findPreviousTag,
  readCargoPackageVersion,
  readVersions,
  runCli,
} from "./check-release-version.mjs";

const FILES = {
  pkg: "package.json",
  cargo: "src-tauri/Cargo.toml",
  tauri: "src-tauri/tauri.conf.json",
};

function versions(overrides = {}) {
  // null(버전을 읽지 못함)도 그대로 넘기도록 ?? 대신 키 존재 여부로 고른다
  const v = (key) => (key in overrides ? overrides[key] : "0.19.0");
  return [
    { file: FILES.pkg, version: v("pkg") },
    { file: FILES.cargo, version: v("cargo") },
    { file: FILES.tauri, version: v("tauri") },
  ];
}

describe("checkReleaseVersion", () => {
  it("태그와 세 파일 버전이 모두 같으면 오류가 없다", () => {
    expect(checkReleaseVersion("v0.19.0", versions())).toEqual([]);
  });

  it.each([
    ["pkg", FILES.pkg],
    ["cargo", FILES.cargo],
    ["tauri", FILES.tauri],
  ])("%s 하나만 다르면 그 파일 경로·값·태그를 담은 오류가 정확히 1개다", (key, file) => {
    const errors = checkReleaseVersion("v0.19.0", versions({ [key]: "0.18.0" }));
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain(file);
    expect(errors[0]).toContain("0.18.0");
    expect(errors[0]).toContain("v0.19.0");
  });

  it("버전을 읽지 못한 파일도 오류로 보고한다", () => {
    const errors = checkReleaseVersion("v0.19.0", versions({ cargo: null }));
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain(FILES.cargo);
  });

  // v0x19x0: 점을 이스케이프하지 않은 정규식(/^v\d+.\d+.\d+$/)이 통과시키는 사례
  it.each(["v0.19.0-rc.1", "0.19.0", "v0.19", "v0x19x0", "v0.19.0.1", ""])(
    "형식이 vX.Y.Z가 아닌 태그 %j는 형식 위반 오류가 난다",
    (tag) => {
      const errors = checkReleaseVersion(tag, versions());
      expect(errors).toHaveLength(1);
      expect(errors[0]).toMatch(/형식/);
    },
  );
});

describe("readCargoPackageVersion", () => {
  it("[dependencies]의 version이 아니라 [package] 절의 version을 읽는다", () => {
    const toml = [
      "[package]",
      'name = "mdedit"',
      'version = "0.19.0"',
      "",
      "[dependencies]",
      'tauri = { version = "2" }',
      'serde = { version = "1", features = ["derive"] }',
    ].join("\n");
    expect(readCargoPackageVersion(toml)).toBe("0.19.0");
  });

  it("[package] 절보다 앞에 다른 절의 version이 있어도 [package] 값을 고른다", () => {
    const toml = '[workspace]\nversion = "9.9.9"\n\n[package]\nname = "x"\nversion = "0.19.0"\n';
    expect(readCargoPackageVersion(toml)).toBe("0.19.0");
  });

  it("CRLF 줄바꿈도 읽는다", () => {
    expect(readCargoPackageVersion('[package]\r\nname = "x"\r\nversion = "0.19.0"\r\n')).toBe("0.19.0");
  });

  it("[package] 절에 version이 없으면 null이다", () => {
    expect(readCargoPackageVersion('[package]\nname = "x"\n[dependencies]\nversion = "1"\n')).toBeNull();
  });
});

describe("findPreviousTag", () => {
  it("현재 태그보다 작은 vX.Y.Z 중 가장 큰 것을 고르고 비semver 태그는 무시한다", () => {
    const tags = ["v0.13.2", "v0.14.0", "v0.15.0", "v0.16.1", "v0.17.0", "v0.18.0", "latest", "v0.19.0-rc.1"];
    expect(findPreviousTag(tags, "v0.19.0")).toBe("v0.18.0");
  });

  it("더 작은 vX.Y.Z 태그가 없으면 빈 값이다", () => {
    expect(findPreviousTag(["v0.19.0", "v1.0.0", "latest"], "v0.19.0")).toBe("");
    expect(findPreviousTag([], "v0.19.0")).toBe("");
  });

  it("문자열 비교가 아니라 숫자 비교다 (v0.9.0 < v0.10.0)", () => {
    expect(findPreviousTag(["v0.9.0", "v0.10.0"], "v0.11.0")).toBe("v0.10.0");
  });

  it("현재 태그 자체와 그보다 큰 태그는 제외한다", () => {
    expect(findPreviousTag(["v0.18.0", "v0.19.0", "v0.20.0"], "v0.19.0")).toBe("v0.18.0");
  });
});

describe("readVersions + runCli (임시 저장소)", () => {
  let dir;

  function makeRepo({ pkg = "0.19.0", cargo = "0.19.0", tauri = "0.19.0", crlf = false } = {}) {
    dir = mkdtempSync(join(tmpdir(), "release-version-"));
    mkdirSync(join(dir, "src-tauri"));
    const eol = crlf ? "\r\n" : "\n";
    writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "mdedit", version: pkg }, null, 2).replace(/\n/g, eol));
    writeFileSync(join(dir, "src-tauri", "Cargo.toml"), ["[package]", 'name = "mdedit"', `version = "${cargo}"`, "", "[dependencies]", 'tauri = { version = "2" }', ""].join(eol));
    writeFileSync(join(dir, "src-tauri", "tauri.conf.json"), JSON.stringify({ productName: "mdedit", version: tauri }, null, 2).replace(/\n/g, eol));
    return dir;
  }

  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
    dir = undefined;
  });

  it("세 파일의 버전을 파일 경로와 함께 읽는다 (CRLF 포함)", () => {
    const root = makeRepo({ crlf: true, cargo: "0.18.0" });
    expect(readVersions(root)).toEqual(versions({ cargo: "0.18.0" }));
  });

  it("BOM(U+FEFF)이 앞에 붙은 JSON 파일도 읽는다", () => {
    const root = makeRepo();
    const withBom = (file) => {
      const text = readFileSync(file, "utf8");
      writeFileSync(file, "﻿" + text);
    };
    withBom(join(root, "package.json"));
    withBom(join(root, "src-tauri", "tauri.conf.json"));
    expect(readVersions(root)).toEqual(versions());
  });

  it("일치하면 종료 코드 0이고 GITHUB_OUTPUT에 tag·version·previous_tag를 쓴다", () => {
    const root = makeRepo();
    const outputFile = join(root, "gh-output.txt");
    const logs = [];
    const code = runCli({
      tag: "v0.19.0",
      rootDir: root,
      outputFile,
      listTags: () => ["v0.18.0", "v0.17.0", "latest"],
      log: (m) => logs.push(m),
      error: (m) => logs.push(m),
    });
    expect(code).toBe(0);
    expect(readFileSync(outputFile, "utf8")).toBe("tag=v0.19.0\nversion=0.19.0\nprevious_tag=v0.18.0\n");
  });

  it("불일치하면 종료 코드 1이고 파일별 오류를 출력하며 GITHUB_OUTPUT은 쓰지 않는다", () => {
    const root = makeRepo({ pkg: "0.18.0", tauri: "0.17.0" });
    const outputFile = join(root, "gh-output.txt");
    const errors = [];
    const code = runCli({
      tag: "v0.19.0",
      rootDir: root,
      outputFile,
      listTags: () => [],
      log: () => {},
      error: (m) => errors.push(m),
    });
    expect(code).toBe(1);
    const text = errors.join("\n");
    expect(text).toContain("package.json");
    expect(text).toContain("src-tauri/tauri.conf.json");
    expect(() => readFileSync(outputFile, "utf8")).toThrow();
  });

  it("태그가 없으면 종료 코드 1이다", () => {
    const root = makeRepo();
    const errors = [];
    const code = runCli({ tag: undefined, rootDir: root, listTags: () => [], log: () => {}, error: (m) => errors.push(m) });
    expect(code).toBe(1);
    expect(errors.join("\n")).toMatch(/형식/);
  });
});
