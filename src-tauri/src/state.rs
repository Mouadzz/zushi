use serde::{Deserialize, Serialize};
use std::process::ChildStdin;

#[derive(Debug, Default, Clone, Serialize, Deserialize, PartialEq)]
pub enum AppStatus {
    #[default]
    Idle,
    GameDetected,
    GameNotFound,
    Error(String),
}

#[derive(Debug, Default, Clone, Serialize, Deserialize, PartialEq)]
pub enum PatcherStatus {
    #[default]
    Idle,
    Importing,
    BuildingOverlay,
    WaitingForGame,
    FoundGame,
    Scanning,
    Patching,
    InGame,
    GameExited,
    Error(String),
}

#[derive(Default)]
pub struct AppState {
    pub game_path: Option<String>,
    pub status: AppStatus,
    pub patcher_status: PatcherStatus,
    pub patcher_stdin: Option<ChildStdin>,
    pub patcher_pid: Option<u32>,
    pub patcher_gen: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadedSkin {
    pub champion_name: String,
    pub skin_name: String,
    pub zip_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CustomEntry {
    pub name: String,
    pub file_path: String,
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
