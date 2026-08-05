// Win32 key simulator
#[cfg(target_os = "windows")]
use std::time::Duration;

#[cfg(target_os = "windows")]
use windows_sys::Win32::UI::Input::KeyboardAndMouse::{
    SendInput, INPUT, INPUT_KEYBOARD, KEYBDINPUT, KEYEVENTF_KEYUP,
};

#[derive(Debug)]
pub struct KeyError(String);

impl std::fmt::Display for KeyError {
    fn fmt(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
        write!(f, "Key Error: {}", self.0)
    }
}

impl std::error::Error for KeyError {}

#[cfg(target_os = "windows")]
pub fn press_key(key_code: u16, hold_ms: u64) -> Result<(), KeyError> {
    tracing::info!("Pressing key {} for {}ms", key_code, hold_ms);

    let mut inputs = [INPUT {
        r#type: INPUT_KEYBOARD,
        Anonymous: windows_sys::Win32::UI::Input::KeyboardAndMouse::INPUT_0 {
            ki: KEYBDINPUT {
                wVk: key_code,
                wScan: 0,
                dwFlags: 0,
                time: 0,
                dwExtraInfo: 0,
            },
        },
    }];

    unsafe {
        SendInput(1, &inputs as *const _, std::mem::size_of::<INPUT>() as i32);
    }

    std::thread::sleep(Duration::from_millis(hold_ms));

    inputs[0].Anonymous.ki.dwFlags = KEYEVENTF_KEYUP;

    unsafe {
        SendInput(1, &inputs as *const _, std::mem::size_of::<INPUT>() as i32);
    }

    Ok(())
}

#[cfg(not(target_os = "windows"))]
pub fn press_key(key_code: u16, hold_ms: u64) -> Result<(), KeyError> {
    tracing::info!(
        "Simulated key press {} for {}ms (Not supported on non-Windows)",
        key_code,
        hold_ms
    );
    Ok(())
}
