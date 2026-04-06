pub mod customs;
pub mod game_path;
pub mod patcher;
pub mod skins;

use std::fs;
use std::process::Command;

/// Open a URL in the real (GUI) user's default browser, not root's.
#[tauri::command]
pub fn open_url(url: String) -> Result<(), String> {
    // stat -f '%Su' /dev/console gives the user who owns the GUI session.
    let real_user = Command::new("stat")
        .args(["-f", "%Su", "/dev/console"])
        .output()
        .ok()
        .and_then(|o| String::from_utf8(o.stdout).ok())
        .map(|s| s.trim().to_string())
        .unwrap_or_default();

    if !real_user.is_empty() && real_user != "root" {
        Command::new("sudo")
            .args(["-u", &real_user, "open", &url])
            .spawn()
            .map_err(|e| e.to_string())?;
    } else {
        Command::new("open")
            .arg(&url)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

pub fn dir_size(path: &std::path::Path) -> u64 {
    let mut total = 0u64;
    if let Ok(entries) = fs::read_dir(path) {
        for entry in entries.flatten() {
            let ft = match entry.file_type() {
                Ok(ft) => ft,
                Err(_) => continue,
            };
            if ft.is_file() {
                total += entry.metadata().map(|m| m.len()).unwrap_or(0);
            } else if ft.is_dir() {
                total += dir_size(&entry.path());
            }
        }
    }
    total
}
