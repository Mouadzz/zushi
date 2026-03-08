use crate::state::{AppState, AppStatus};
use std::path::Path;
use std::sync::{Arc, Mutex};
use tauri::State;

const DEFAULT_GAME_PATH: &str = "/Applications/League of Legends.app/Contents/LoL/Game";

/// Check if a directory is a valid League game folder by looking for LeagueofLegends.app.
fn is_valid_game_dir(path: &str) -> bool {
    let app_path = Path::new(path).join("LeagueofLegends.app");
    app_path.exists()
}

/// Try multiple path suffixes to find the Game directory.
fn resolve_game_path(raw: &str) -> Option<String> {
    if raw.is_empty() {
        return None;
    }

    let candidates = [
        format!("{}/Contents/LoL/Game", raw),
        raw.to_string(),
        format!("{}/Game", raw),
    ];

    for candidate in &candidates {
        if is_valid_game_dir(candidate) {
            return Path::new(candidate)
                .canonicalize()
                .ok()
                .map(|p| p.to_string_lossy().to_string());
        }
    }

    None
}

#[tauri::command]
pub fn detect_game_path(state: State<'_, Arc<Mutex<AppState>>>) -> Result<Option<String>, String> {
    if is_valid_game_dir(DEFAULT_GAME_PATH) {
        let path = Path::new(DEFAULT_GAME_PATH)
            .canonicalize()
            .map_err(|e| e.to_string())?
            .to_string_lossy()
            .to_string();

        let mut app_state = state.lock().map_err(|e| e.to_string())?;
        app_state.game_path = Some(path.clone());
        app_state.status = AppStatus::GameDetected;
        return Ok(Some(path));
    }

    let mut app_state = state.lock().map_err(|e| e.to_string())?;
    app_state.status = AppStatus::GameNotFound;
    Ok(None)
}

#[tauri::command]
pub fn validate_game_path(path: String) -> Result<Option<String>, String> {
    Ok(resolve_game_path(&path))
}

#[tauri::command]
pub fn set_game_path(path: String, state: State<'_, Arc<Mutex<AppState>>>) -> Result<(), String> {
    let validated = resolve_game_path(&path)
        .ok_or_else(|| "Invalid game path: LeagueofLegends.app not found".to_string())?;

    let mut app_state = state.lock().map_err(|e| e.to_string())?;
    app_state.game_path = Some(validated);
    app_state.status = AppStatus::GameDetected;
    Ok(())
}

#[tauri::command]
pub fn get_game_path(state: State<'_, Arc<Mutex<AppState>>>) -> Result<Option<String>, String> {
    let app_state = state.lock().map_err(|e| e.to_string())?;
    Ok(app_state.game_path.clone())
}
