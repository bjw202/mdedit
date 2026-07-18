// @MX:ANCHOR: [AUTO] 자식 프로세스 스폰 공통 플래그 - Windows 콘솔 창 억제 계약
// @MX:REASON: [AUTO] 외부 프로세스를 띄우는 모든 지점(claude 스폰·버전 프로브·URL 열기, fan_in >= 3)이
//   이 헬퍼를 거쳐야 한다. GUI 앱에서 콘솔 창이 잠깐 떴다 사라지는 현상을 막는 단일 출처.

#[cfg(windows)]
use std::os::windows::process::CommandExt;
use std::process::Command;

/// Windows `CREATE_NO_WINDOW` 프로세스 생성 플래그. 콘솔 애플리케이션을 실행해도
/// 새 콘솔 창을 만들지 않는다(Win32 `CreateProcess` dwCreationFlags).
#[cfg(windows)]
pub const CREATE_NO_WINDOW: u32 = 0x0800_0000;

/// 자식 프로세스가 콘솔 창을 띄우지 않도록 생성 플래그를 적용한다.
///
/// Windows에서만 `CREATE_NO_WINDOW`를 붙이고, 그 외 플랫폼에서는 아무것도 하지 않는다.
/// 호출부에서 체이닝할 수 있도록 받은 `Command`를 그대로 돌려준다.
#[cfg(windows)]
pub fn no_window(cmd: &mut Command) -> &mut Command {
    cmd.creation_flags(CREATE_NO_WINDOW)
}

/// non-Windows에서는 무동작(no-op) — 플랫폼 공통 호출부를 위해 시그니처만 맞춘다.
#[cfg(not(windows))]
pub fn no_window(cmd: &mut Command) -> &mut Command {
    cmd
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn no_window_returns_same_command_for_chaining() {
        // 모든 플랫폼에서 체이닝 가능해야 한다(반환값이 같은 Command를 가리킨다).
        let mut cmd = Command::new("echo");
        let ptr_before = &raw const cmd;
        let returned = no_window(&mut cmd);
        assert_eq!(ptr_before, &raw const *returned);
    }

    #[test]
    fn no_window_preserves_program_and_args() {
        // 플래그 적용이 프로그램·인자를 건드리지 않는다.
        let mut cmd = Command::new("echo");
        cmd.args(["a", "b"]);
        let cmd = no_window(&mut cmd);
        assert_eq!(cmd.get_program(), "echo");
        let args: Vec<_> = cmd.get_args().collect();
        assert_eq!(args, ["a", "b"]);
    }

    // 콘솔 창이 실제로 억제되는지는 단위 테스트로 관측할 수 없다. 여기서는 플래그 상수값이
    // Win32 CREATE_NO_WINDOW(0x08000000)와 일치하는지만 고정한다.
    #[cfg(windows)]
    #[test]
    fn create_no_window_matches_win32_constant() {
        assert_eq!(CREATE_NO_WINDOW, 0x0800_0000);
    }
}
