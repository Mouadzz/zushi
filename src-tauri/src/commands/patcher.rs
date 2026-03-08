use crate::state::{AppState, PatcherStatus};
use std::fs;
use std::io::{BufRead, BufReader, Write};
use std::path::PathBuf;
use std::process::{Command, Stdio};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Manager, State};

fn work_dir(app: &AppHandle) -> PathBuf {
    let dir = app
        .path()
        .app_data_dir()
        .expect("failed to get app data dir");
    fs::create_dir_all(&dir).ok();
    dir
}

fn sidecar_path(_app: &AppHandle) -> PathBuf {
    let triple = if cfg!(target_arch = "aarch64") {
        "aarch64-apple-darwin"
    } else {
        "x86_64-apple-darwin"
    };

    // Production: Tauri bundles the sidecar as "mod-tools" next to the app binary
    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            let bin = dir.join("mod-tools");
            if bin.exists() {
                return bin;
            }
        }
    }

    // Dev: binary lives in src-tauri/binaries/ with the target triple suffix
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("binaries")
        .join(format!("mod-tools-{}", triple))
}

fn run_mod_tools(binary: &PathBuf, args: &[String]) -> Result<String, String> {
    eprintln!("[zushi] Running: {:?} {:?}", binary, args);
    let output = Command::new(binary)
        .args(args)
        .output()
        .map_err(|e| format!("Failed to run mod-tools: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();

    if !output.status.success() {
        let detail = if stderr.is_empty() { stdout.trim().to_string() } else { format!("{}\n{}", stdout.trim(), stderr.trim()) };
        return Err(format!("mod-tools failed (exit {}): {}", output.status.code().unwrap_or(-1), detail));
    }

    Ok(stdout)
}

#[tauri::command]
pub fn apply_skin(
    app: AppHandle,
    state: State<'_, Arc<Mutex<AppState>>>,
    zip_path: String,
) -> Result<String, String> {
    start_apply(app, vec![zip_path], state.inner().clone())
}

#[tauri::command]
pub fn apply_skins(
    app: AppHandle,
    state: State<'_, Arc<Mutex<AppState>>>,
    zip_paths: Vec<String>,
) -> Result<String, String> {
    start_apply(app, zip_paths, state.inner().clone())
}

/// Validates inputs, sets status to Importing, spawns a background thread
/// for the heavy work, and returns immediately so the UI stays responsive.
fn start_apply(
    app: AppHandle,
    zip_paths: Vec<String>,
    state: Arc<Mutex<AppState>>,
) -> Result<String, String> {
    if zip_paths.is_empty() {
        return Err("No skins selected".to_string());
    }

    {
        let s = state.lock().map_err(|e| e.to_string())?;
        if s.patcher_stdin.is_some() {
            return Err("Patcher is already running. Stop it first.".to_string());
        }
    }

    let game_path = {
        let s = state.lock().map_err(|e| e.to_string())?;
        s.game_path
            .clone()
            .ok_or_else(|| "Game path not set".to_string())?
    };

    let binary = sidecar_path(&app);
    eprintln!("[zushi] mod-tools path: {:?}", binary);
    eprintln!("[zushi] mod-tools exists: {}", binary.exists());
    if !binary.exists() {
        return Err(format!("mod-tools not found at {:?}", binary));
    }

    let gen = {
        let mut s = state.lock().map_err(|e| e.to_string())?;
        s.patcher_gen += 1;
        s.patcher_status = PatcherStatus::Importing;
        s.patcher_gen
    };

    let base = work_dir(&app);

    eprintln!("[zushi] Spawning patcher thread with {} skins, game: {}", zip_paths.len(), game_path);
    std::thread::spawn(move || {
        if let Err(e) = do_apply_skins_bg(binary, base, game_path, zip_paths, state.clone(), gen) {
            eprintln!("[zushi] Patcher error: {}", e);
            if let Ok(mut s) = state.lock() {
                if s.patcher_gen == gen {
                    s.patcher_status = PatcherStatus::Error(e);
                    s.patcher_stdin = None;
                }
            }
        }
    });

    Ok("Patcher starting".to_string())
}

fn do_apply_skins_bg(
    binary: PathBuf,
    base: PathBuf,
    game_path: String,
    zip_paths: Vec<String>,
    state: Arc<Mutex<AppState>>,
    gen: u64,
) -> Result<(), String> {
    let installed_dir = base.join("installed");
    let overlay_dir = base.join("overlay");
    let config_file = base.join("config");

    let _ = fs::remove_dir_all(&installed_dir);
    let _ = fs::remove_dir_all(&overlay_dir);
    fs::create_dir_all(&installed_dir).map_err(|e| e.to_string())?;
    fs::create_dir_all(&overlay_dir).map_err(|e| e.to_string())?;
    fs::write(&config_file, "").map_err(|e| e.to_string())?;

    // Step 1: Import all skins
    let mut mod_names = Vec::new();
    for (i, zip_path) in zip_paths.iter().enumerate() {
        let mod_name = format!("mod_{}", i);
        let mod_dir = installed_dir.join(&mod_name);

        run_mod_tools(
            &binary,
            &[
                "import".into(),
                zip_path.clone(),
                mod_dir.to_string_lossy().to_string(),
                format!("--game:{}", game_path),
            ],
        )?;

        mod_names.push(mod_name);
    }

    // Step 2: Build overlay with all mods
    {
        if let Ok(mut s) = state.lock() {
            if s.patcher_gen == gen {
                s.patcher_status = PatcherStatus::BuildingOverlay;
            }
        }
    }

    let mods_arg = format!("--mods:{}", mod_names.join("/"));
    let mkoverlay_args = vec![
        "mkoverlay".into(),
        installed_dir.to_string_lossy().to_string(),
        overlay_dir.to_string_lossy().to_string(),
        format!("--game:{}", game_path),
        mods_arg,
        "--ignoreConflict".into(),
    ];

    run_mod_tools(&binary, &mkoverlay_args)?;

    // Step 3: Run patcher
    {
        if let Ok(mut s) = state.lock() {
            if s.patcher_gen == gen {
                s.patcher_status = PatcherStatus::WaitingForGame;
            }
        }
    }

    let overlay_str = overlay_dir.to_string_lossy().to_string();
    let config_str = config_file.to_string_lossy().to_string();
    let game_arg = format!("--game:{}", game_path);

    let mut child = Command::new(&binary)
        .args([
            "runoverlay",
            &overlay_str,
            &config_str,
            &game_arg,
            "--opts:none",
        ])
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to start patcher: {}", e))?;

    let stdin = child.stdin.take();
    {
        if let Ok(mut s) = state.lock() {
            if s.patcher_gen == gen {
                s.patcher_stdin = stdin;
            }
        }
    }

    let stdout = child.stdout.take();
    let stderr = child.stderr.take();

    let state_arc = state.clone();
    let stdout_thread = std::thread::spawn(move || {
        if let Some(out) = stdout {
            let reader = BufReader::new(out);
            for line in reader.lines().map_while(Result::ok) {
                if let Some(status_msg) = line.strip_prefix("Status: ") {
                    let new_status = match status_msg {
                        "Waiting for league match to start" => Some(PatcherStatus::WaitingForGame),
                        "Found League" => Some(PatcherStatus::FoundGame),
                        "Scanning" | "Wait initialized" => Some(PatcherStatus::Scanning),
                        "Patching" | "Saving" | "Wait patchable" => Some(PatcherStatus::SkinActive),
                        "Waiting for exit" => Some(PatcherStatus::WaitingForExit),
                        "League exited" => Some(PatcherStatus::GameExited),
                        _ => None,
                    };
                    if let Some(status) = new_status {
                        if let Ok(mut s) = state_arc.lock() {
                            if s.patcher_gen == gen {
                                s.patcher_status = status;
                            }
                        }
                    }
                }
            }
        }
    });

    let stderr_thread = std::thread::spawn(move || {
        if let Some(err) = stderr {
            let reader = BufReader::new(err);
            for line in reader.lines().map_while(Result::ok) {
                eprintln!("[zushi] mod-tools err: {}", line);
            }
        }
    });

    let exit_status = child.wait().map_err(|e| format!("Failed to wait for patcher: {}", e))?;
    let _ = stdout_thread.join();
    let _ = stderr_thread.join();

    if let Ok(mut s) = state.lock() {
        if s.patcher_gen == gen {
            if !exit_status.success() {
                let code = exit_status.code().unwrap_or(-1);
                eprintln!("[zushi] mod-tools runoverlay exited with code {}", code);
                s.patcher_status = PatcherStatus::Error(format!("Patcher exited unexpectedly (code {})", code));
            } else {
                s.patcher_status = PatcherStatus::Idle;
            }
            s.patcher_stdin = None;
        }
    }

    Ok(())
}

#[tauri::command]
pub fn stop_patcher(state: State<'_, Arc<Mutex<AppState>>>) -> Result<(), String> {
    let stdin = {
        let mut s = state.lock().map_err(|e| e.to_string())?;
        s.patcher_stdin.take()
    };

    if let Some(mut pipe) = stdin {
        pipe.write_all(b"\n").ok();
        drop(pipe);
    }

    let mut s = state.lock().map_err(|e| e.to_string())?;
    s.patcher_status = PatcherStatus::Idle;
    Ok(())
}

#[tauri::command]
pub fn get_patcher_status(state: State<'_, Arc<Mutex<AppState>>>) -> Result<PatcherStatus, String> {
    let s = state.lock().map_err(|e| e.to_string())?;
    Ok(s.patcher_status.clone())
}

#[tauri::command]
pub fn get_work_dir_size(app: AppHandle) -> Result<u64, String> {
    let base = work_dir(&app);
    let installed = dir_size(&base.join("installed"));
    let overlay = dir_size(&base.join("overlay"));
    Ok(installed + overlay)
}

#[tauri::command]
pub fn clear_work_dir(app: AppHandle, state: State<'_, Arc<Mutex<AppState>>>) -> Result<(), String> {
    {
        let s = state.lock().map_err(|e| e.to_string())?;
        if s.patcher_stdin.is_some() {
            return Err("Cannot clear while patcher is running".to_string());
        }
    }
    let base = work_dir(&app);
    let _ = fs::remove_dir_all(base.join("installed"));
    let _ = fs::remove_dir_all(base.join("overlay"));
    let _ = fs::remove_file(base.join("config"));
    Ok(())
}

fn dir_size(path: &std::path::Path) -> u64 {
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
