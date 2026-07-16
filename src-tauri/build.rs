fn main() {
    // Windows .exe에 임베드되는 아이콘은 tauri_build::build()가 리소스로 생성한다.
    // 기본적으로 Cargo는 아이콘 파일만 바뀌면 build.rs를 재실행하지 않아, 증분 빌드가
    // 이전에 컴파일된 리소스를 재사용하면서 옛 아이콘이 그대로 임베드되는 문제가 있다.
    // (Windows 릴리즈 빌드에서 "바뀐 아이콘이 반영되지 않음" 재발 원인)
    //
    // 아래처럼 아이콘/설정 파일을 rerun-if-changed로 명시하면, 해당 파일이 바뀔 때마다
    // Cargo가 build.rs를 재실행 → 리소스를 다시 굽고 → .exe에 새 아이콘이 재임베드된다.
    // cargo clean 없이 필요한 것만 갱신하며, macOS/Linux에서는 무해하다(no-op).
    for path in [
        "tauri.conf.json",
        "icons/icon.ico",   // Windows .exe 임베드 아이콘
        "icons/icon.icns",  // macOS 번들 아이콘
        "icons/128x128.png",
        "icons/128x128@2x.png",
        "icons/64x64.png",
        "icons/32x32.png",
    ] {
        println!("cargo:rerun-if-changed={path}");
    }

    tauri_build::build()
}
