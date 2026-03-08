use serde::{Deserialize, Serialize};
use std::process::ChildStdin;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum AppStatus {
    Idle,
    GameDetected,
    GameNotFound,
    Error(String),
}

impl Default for AppStatus {
    fn default() -> Self {
        AppStatus::Idle
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum PatcherStatus {
    Idle,
    Importing,
    BuildingOverlay,
    WaitingForGame,
    FoundGame,
    Scanning,
    SkinActive,
    WaitingForExit,
    GameExited,
    Error(String),
}

impl Default for PatcherStatus {
    fn default() -> Self {
        PatcherStatus::Idle
    }
}

pub struct AppState {
    pub game_path: Option<String>,
    pub status: AppStatus,
    pub patcher_status: PatcherStatus,
    pub patcher_stdin: Option<ChildStdin>,
    pub patcher_gen: u64,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            game_path: None,
            status: AppStatus::default(),
            patcher_status: PatcherStatus::default(),
            patcher_stdin: None,
            patcher_gen: 0,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadedSkin {
    pub champion_name: String,
    pub skin_name: String,
    pub zip_path: String,
}

impl std::fmt::Debug for AppState {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("AppState")
            .field("game_path", &self.game_path)
            .field("status", &self.status)
            .field("patcher_status", &self.patcher_status)
            .field("patcher_stdin", &self.patcher_stdin.is_some())
            .finish()
    }
}
