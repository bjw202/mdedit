// 앱 명령 이름 목록(SPEC-SEC-001). tests/app_acl.rs도 같은 파일을 include! 한다.
include!("app_commands.rs");

fn main() {
    // Windows .exe에 임베드되는 아이콘은 tauri-build의 build 함수가 리소스로 생성한다.
    // 기본적으로 Cargo는 아이콘 파일만 바뀌면 build.rs를 재실행하지 않아, 증분 빌드가
    // 이전에 컴파일된 리소스를 재사용하면서 옛 아이콘이 그대로 임베드되는 문제가 있다.
    // (Windows 릴리즈 빌드에서 "바뀐 아이콘이 반영되지 않음" 재발 원인)
    //
    // 아래처럼 아이콘/설정 파일을 rerun-if-changed로 명시하면, 해당 파일이 바뀔 때마다
    // Cargo가 build.rs를 재실행 → 리소스를 다시 굽고 → .exe에 새 아이콘이 재임베드된다.
    // cargo clean 없이 필요한 것만 갱신하며, macOS/Linux에서는 무해하다(no-op).
    for path in [
        "tauri.conf.json",
        "app_commands.rs", // 앱 ACL 매니페스트 입력(SPEC-SEC-001)
        "icons/icon.ico",   // Windows .exe 임베드 아이콘
        "icons/icon.icns",  // macOS 번들 아이콘
        "icons/128x128.png",
        "icons/128x128@2x.png",
        "icons/64x64.png",
        "icons/32x32.png",
    ] {
        println!("cargo:rerun-if-changed={path}");
    }

    // SPEC-SEC-001: 앱 ACL 매니페스트를 만들어 앱 명령도 ACL 검사 대상으로 삼는다.
    // 매니페스트가 없으면 tauri는 앱 명령의 ACL 검사를 건너뛰어, 원격·불투명 출처 프레임이
    // 앱 명령을 호출할 수 있다. 오류를 삼키면 매니페스트 없이 빌드되어 그 상태로 돌아가므로,
    // 실패는 반드시 빌드 실패로 전파한다.
    if let Err(err) = tauri_build::try_build(
        tauri_build::Attributes::new()
            .app_manifest(tauri_build::AppManifest::new().commands(APP_COMMANDS)),
    ) {
        eprintln!("tauri-build 실패(앱 ACL 매니페스트 포함): {err:#}");
        std::process::exit(1);
    }
}
