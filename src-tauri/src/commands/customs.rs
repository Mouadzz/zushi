use crate::state::CustomEntry;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use tauri::{AppHandle, Manager};

fn customs_dir(app: &AppHandle) -> PathBuf {
    let dir = app
        .path()
        .app_data_dir()
        .expect("failed to get app data dir")
        .join("customs");
    fs::create_dir_all(&dir).ok();
    dir
}

fn flatten<T>(res: Result<Result<T, String>, impl std::fmt::Display>) -> Result<T, String> {
    match res {
        Ok(inner) => inner,
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
pub async fn import_custom(
    app: AppHandle,
    src_path: String,
    name: String,
) -> Result<CustomEntry, String> {
    let base = customs_dir(&app);
    flatten(
        tauri::async_runtime::spawn_blocking(move || {
            let src = PathBuf::from(&src_path);

            let ext = src
                .extension()
                .and_then(|e| e.to_str())
                .map(|e| e.to_lowercase());
            let ext_str = match ext.as_deref() {
                Some("zip") => "zip",
                Some("fantome") => "fantome",
                Some("modpkg") => "modpkg",
                _ => return Err("File must be a .zip, .fantome or .modpkg".to_string()),
            };

            if !src.exists() {
                return Err("File not found".to_string());
            }

            // Sanitize name
            let mut safe_name: String = name
                .chars()
                .filter(|c| c.is_alphanumeric() || *c == '-' || *c == '_' || *c == ' ' || *c == '.')
                .collect::<String>()
                .trim()
                .to_string();

            // Defense: strip a trailing archive extension so we never produce
            // "Name.fantome.fantome" if the display name still carries one.
            for suffix in [".fantome", ".zip", ".modpkg"] {
                if safe_name.to_lowercase().ends_with(suffix) {
                    safe_name.truncate(safe_name.len() - suffix.len());
                    safe_name = safe_name.trim().to_string();
                    break;
                }
            }

            if safe_name.is_empty() {
                return Err("Invalid mod name".to_string());
            }

            if ext_str == "modpkg" {
                let dest = base.join(format!("{}.fantome", safe_name));
                modpkg_to_fantome(&src, &dest)?;
                return Ok(CustomEntry {
                    name: safe_name,
                    file_path: dest.to_string_lossy().into_owned(),
                });
            }

            let ext = ext_str;
            let dest = base.join(format!("{}.{}", safe_name, ext));
            fs::copy(&src, &dest).map_err(|e| format!("Failed to copy mod: {}", e))?;

            Ok(CustomEntry {
                name: safe_name,
                file_path: dest.to_string_lossy().into_owned(),
            })
        })
        .await,
    )
}

/// Converts a .modpkg (LeagueToolkit's mod format) into a .fantome so the rest of the
/// pipeline stays unchanged. Only the "base" layer is kept; optional layers are dropped.
fn modpkg_to_fantome(src: &Path, dest: &Path) -> Result<(), String> {
    let err = |e: ltk_modpkg::ModpkgError| format!("Failed to read .modpkg: {}", e);
    let file = fs::File::open(src).map_err(|e| format!("Failed to open mod: {}", e))?;
    let mut modpkg = ltk_modpkg::Modpkg::mount_from_reader(file).map_err(err)?;
    let meta = modpkg.load_metadata().map_err(err)?;

    // Unique per call, so two imports of the same mod never share or delete each other's files.
    let nonce = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or_default();
    let tmp = dest.with_extension(format!("modpkg.{}.{}.tmp", std::process::id(), nonce));
    let result = (|| {
        let layers = tmp.join("layers");
        ltk_modpkg::ModpkgExtractor::new(&mut modpkg)
            .extract_layer("base", &layers)
            .map_err(err)?;
        let base = layers.join("base");
        if !base.is_dir() {
            return Err("This .modpkg has no base layer".to_string());
        }

        let mod_dir = tmp.join("mod");
        fs::create_dir_all(mod_dir.join("META")).map_err(|e| e.to_string())?;
        fs::rename(&base, mod_dir.join("WAD")).map_err(|e| e.to_string())?;

        let info = serde_json::json!({
            "Name": meta.display_name(),
            "Author": meta.authors().iter().map(|a| a.name()).collect::<Vec<_>>().join(", "),
            "Version": meta.version().to_string(),
            "Description": meta.description().unwrap_or_default(),
        });
        fs::write(mod_dir.join("META").join("info.json"), info.to_string()).map_err(|e| e.to_string())?;

        // Zip next to the destination, then move it into place, so a failed run never
        // leaves a half-written .fantome in the customs list.
        let packed = tmp.join("packed.fantome");
        let output = Command::new("/usr/bin/zip")
            .args(["-qr", "-X"])
            .arg(&packed)
            .args(["META", "WAD"])
            .current_dir(&mod_dir)
            .output()
            .map_err(|e| format!("Failed to run zip: {}", e))?;
        if !output.status.success() {
            return Err(format!(
                "Failed to pack converted mod: {}",
                String::from_utf8_lossy(&output.stderr).lines().next().unwrap_or("unknown error")
            ));
        }
        fs::rename(&packed, dest).map_err(|e| format!("Failed to save converted mod: {}", e))
    })();
    let _ = fs::remove_dir_all(&tmp);
    result
}

#[tauri::command]
pub async fn list_customs(app: AppHandle) -> Result<Vec<CustomEntry>, String> {
    let base = customs_dir(&app);
    flatten(
        tauri::async_runtime::spawn_blocking(move || {
            let mut customs = Vec::new();

            let entries = match fs::read_dir(&base) {
                Ok(e) => e,
                Err(_) => return Ok(customs),
            };

            for entry in entries.flatten() {
                let path = entry.path();
                let ext = path
                    .extension()
                    .and_then(|e| e.to_str())
                    .map(|e| e.to_lowercase());
                if ext == Some("zip".to_string()) || ext == Some("fantome".to_string()) {
                    if let Some(stem) = path.file_stem().and_then(|s| s.to_str()) {
                        customs.push(CustomEntry {
                            name: stem.to_string(),
                            file_path: path.to_string_lossy().into_owned(),
                        });
                    }
                }
            }

            customs.sort_by(|a, b| a.name.cmp(&b.name));
            Ok(customs)
        })
        .await,
    )
}

#[tauri::command]
pub async fn remove_custom(app: AppHandle, name: String) -> Result<(), String> {
    let base = customs_dir(&app);
    flatten(
        tauri::async_runtime::spawn_blocking(move || {
            for ext in &["zip", "fantome"] {
                let path = base.join(format!("{}.{}", name, ext));
                if path.exists() {
                    fs::remove_file(&path).map_err(|e| e.to_string())?;
                    return Ok(());
                }
            }
            Ok(())
        })
        .await,
    )
}

#[tauri::command]
pub async fn clear_all_customs(app: AppHandle) -> Result<(), String> {
    let base = customs_dir(&app);
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

#[tauri::command]
pub async fn get_customs_dir_size(app: AppHandle) -> Result<u64, String> {
    let base = customs_dir(&app);
    flatten(tauri::async_runtime::spawn_blocking(move || Ok(super::dir_size(&base))).await)
}
