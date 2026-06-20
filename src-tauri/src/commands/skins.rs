use crate::state::DownloadedSkin;
use serde::{Deserialize, Serialize};
use std::fs;
use std::io::Read;
use std::path::PathBuf;
use tauri::{AppHandle, Emitter, Manager};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadItem {
    pub url: String,
    pub champion_name: String,
    pub skin_name: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct DownloadProgress {
    current: u32,
    total: u32,
    skin_name: String,
}

/// Skin names like "K/DA Kai'Sa" contain '/', which is a path separator.
/// Encode it for on-disk folder/file names and decode when reading back,
/// so the logical skin name stays intact everywhere else.
fn encode_path(s: &str) -> String {
    s.replace('/', "%2F")
}

fn decode_path(s: &str) -> String {
    s.replace("%2F", "/")
}

fn skins_dir(app: &AppHandle) -> PathBuf {
    let dir = app
        .path()
        .app_data_dir()
        .expect("failed to get app data dir")
        .join("skins");
    fs::create_dir_all(&dir).ok();
    dir
}

/// Flatten a spawn_blocking result into our String error type.
fn flatten<T>(res: Result<Result<T, String>, impl std::fmt::Display>) -> Result<T, String> {
    match res {
        Ok(inner) => inner,
        Err(e) => Err(e.to_string()),
    }
}

/// Download a single skin zip. Runs blocking I/O on a background thread.
#[tauri::command]
pub async fn download_skin(
    app: AppHandle,
    url: String,
    champion_name: String,
    skin_name: String,
) -> Result<String, String> {
    let base = skins_dir(&app);
    flatten(
        tauri::async_runtime::spawn_blocking(move || {
            let skin_dir = base
                .join(encode_path(&champion_name))
                .join(encode_path(&skin_name));
            fs::create_dir_all(&skin_dir).map_err(|e| e.to_string())?;

            let zip_path = skin_dir.join(format!("{}.zip", encode_path(&skin_name)));

            let resp = ureq::get(&url)
                .call()
                .map_err(|e| format!("Download failed: {e}"))?;

            let mut bytes = Vec::new();
            resp.into_reader()
                .read_to_end(&mut bytes)
                .map_err(|e| format!("Read failed: {e}"))?;

            if bytes.is_empty() {
                return Err("Downloaded file is empty".to_string());
            }

            fs::write(&zip_path, &bytes).map_err(|e| format!("Write failed: {e}"))?;

            Ok(zip_path.to_string_lossy().into_owned())
        })
        .await,
    )
}

/// Download multiple skins in one call. Runs entirely on a background thread,
/// emitting progress events so the UI stays responsive.
#[tauri::command]
pub async fn download_multiple_skins(
    app: AppHandle,
    items: Vec<DownloadItem>,
) -> Result<u32, String> {
    let base = skins_dir(&app);
    flatten(
        tauri::async_runtime::spawn_blocking(move || {
            let total = items.len() as u32;
            let mut success_count = 0u32;

            for item in &items {
                let skin_dir = base
                    .join(encode_path(&item.champion_name))
                    .join(encode_path(&item.skin_name));
                if fs::create_dir_all(&skin_dir).is_err() {
                    continue;
                }

                let zip_path = skin_dir.join(format!("{}.zip", encode_path(&item.skin_name)));

                let ok = (|| -> bool {
                    let resp = match ureq::get(&item.url).call() {
                        Ok(r) => r,
                        Err(_) => return false,
                    };
                    let mut bytes = Vec::new();
                    if resp.into_reader().read_to_end(&mut bytes).is_err() || bytes.is_empty() {
                        return false;
                    }
                    fs::write(&zip_path, &bytes).is_ok()
                })();

                if ok {
                    success_count += 1;
                }

                app.emit(
                    "download-progress",
                    DownloadProgress {
                        current: success_count,
                        total,
                        skin_name: item.skin_name.clone(),
                    },
                )
                .ok();
            }

            Ok(success_count)
        })
        .await,
    )
}

#[tauri::command]
pub async fn list_downloaded_skins(app: AppHandle) -> Result<Vec<DownloadedSkin>, String> {
    let base = skins_dir(&app);
    flatten(
        tauri::async_runtime::spawn_blocking(move || {
            let mut skins = Vec::new();

            let entries = match fs::read_dir(&base) {
                Ok(e) => e,
                Err(_) => return Ok(skins),
            };

            for champion_entry in entries.flatten() {
                if !champion_entry
                    .file_type()
                    .map(|t| t.is_dir())
                    .unwrap_or(false)
                {
                    continue;
                }
                let champion_dir_name = champion_entry.file_name().to_string_lossy().to_string();
                let champion_name = decode_path(&champion_dir_name);

                if let Ok(skin_entries) = fs::read_dir(champion_entry.path()) {
                    for skin_entry in skin_entries.flatten() {
                        if !skin_entry
                            .file_type()
                            .map(|t| t.is_dir())
                            .unwrap_or(false)
                        {
                            continue;
                        }
                        let skin_dir_name = skin_entry.file_name().to_string_lossy().to_string();
                        let zip_path = skin_entry.path().join(format!("{}.zip", &skin_dir_name));

                        if zip_path.exists() {
                            skins.push(DownloadedSkin {
                                champion_name: champion_name.clone(),
                                skin_name: decode_path(&skin_dir_name),
                                zip_path: zip_path.to_string_lossy().into_owned(),
                            });
                        }
                    }
                }
            }

            Ok(skins)
        })
        .await,
    )
}

#[tauri::command]
pub async fn delete_downloaded_skin(
    app: AppHandle,
    champion_name: String,
    skin_name: String,
) -> Result<(), String> {
    let base = skins_dir(&app);
    flatten(
        tauri::async_runtime::spawn_blocking(move || {
            let skin_dir = base
                .join(encode_path(&champion_name))
                .join(encode_path(&skin_name));
            if skin_dir.exists() {
                fs::remove_dir_all(&skin_dir).map_err(|e| e.to_string())?;
            }

            let champion_dir = base.join(encode_path(&champion_name));
            if champion_dir.exists() {
                if champion_dir
                    .read_dir()
                    .map(|mut d| d.next().is_none())
                    .unwrap_or(false)
                {
                    fs::remove_dir(&champion_dir).ok();
                }
            }

            Ok(())
        })
        .await,
    )
}

#[tauri::command]
pub async fn get_skins_dir_size(app: AppHandle) -> Result<u64, String> {
    let base = skins_dir(&app);
    flatten(
        tauri::async_runtime::spawn_blocking(move || Ok(dir_size(&base))).await,
    )
}

#[tauri::command]
pub async fn clear_all_skins(app: AppHandle) -> Result<(), String> {
    let base = skins_dir(&app);
    flatten(
        tauri::async_runtime::spawn_blocking(move || {
            if base.exists() {
                fs::remove_dir_all(&base).map_err(|e| e.to_string())?;
                fs::create_dir_all(&base).ok();
            }
            Ok(())
        })
        .await,
    )
}

use super::dir_size;
