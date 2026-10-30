use std::os::unix::fs::MetadataExt;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::{Arc, Mutex};

use serde::Serialize;
use tauri::{AppHandle, State};
use tauri_plugin_updater::UpdaterExt;

use crate::state::AppState;

#[derive(Serialize)]
pub struct UpdateInfo {
    pub version: String,
    pub notes: Option<String>,
}

/// The .app bundle we are running from (…/Zushi.app/Contents/MacOS/zushi).
fn app_bundle() -> Option<PathBuf> {
    let exe = std::env::current_exe().ok()?;
    let bundle = exe.parent()?.parent()?.parent()?;
    (bundle.extension()? == "app").then(|| bundle.to_path_buf())
}

/// Zushi runs as root, so the updater extracts the new bundle as root.
/// Hand it back to whoever owned the old one so it can still be moved or deleted normally.
fn restore_owner(bundle: &Path, uid: u32, gid: u32) {
    if uid == 0 {
        return;
    }
    match Command::new("/usr/sbin/chown")
        .args(["-R", &format!("{}:{}", uid, gid)])
        .arg(bundle)
        .status()
    {
        Ok(s) if s.success() => {}
        other => eprintln!("[zushi] Failed to restore owner of {}: {:?}", bundle.display(), other),
    }
}

#[tauri::command]
pub async fn check_for_update(app: AppHandle) -> Result<Option<UpdateInfo>, String> {
    let update = app
        .updater()
        .map_err(|e| e.to_string())?
        .check()
        .await
        .map_err(|e| e.to_string())?;

    Ok(update.map(|u| UpdateInfo {
        version: u.version,
        notes: u.body,
    }))
}

/// Download, verify and install the latest release in place, then relaunch.
#[tauri::command]
pub async fn install_update(
    app: AppHandle,
    state: State<'_, Arc<Mutex<AppState>>>,
) -> Result<(), String> {
    let update = app
        .updater()
        .map_err(|e| e.to_string())?
        .check()
        .await
        .map_err(|e| e.to_string())?
        .ok_or("Zushi is already up to date")?;

    let bundle = app_bundle();
    let owner = bundle
        .as_ref()
        .and_then(|b| std::fs::metadata(b).ok())
        .map(|m| (m.uid(), m.gid()));

    eprintln!("[zushi] Installing update {}", update.version);
    update
        .download_and_install(|_, _| {}, || {})
        .await
        .map_err(|e| e.to_string())?;

    if let (Some(bundle), Some((uid, gid))) = (bundle, owner) {
        restore_owner(&bundle, uid, gid);
    }

    // Let mod-tools exit cleanly before we relaunch.
    super::patcher::stop_patcher(state).ok();
    app.restart();
}
