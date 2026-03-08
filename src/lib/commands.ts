import { invoke } from "@tauri-apps/api/core";
import type { PatcherStatus, DownloadedSkin } from "../types";

export async function detectGamePath(): Promise<string | null> {
  return invoke<string | null>("detect_game_path");
}

export async function validateGamePath(path: string): Promise<string | null> {
  return invoke<string | null>("validate_game_path", { path });
}

export async function setGamePath(path: string): Promise<void> {
  return invoke("set_game_path", { path });
}

export async function getGamePath(): Promise<string | null> {
  return invoke<string | null>("get_game_path");
}

export async function applySkin(zipPath: string): Promise<string> {
  return invoke<string>("apply_skin", { zipPath });
}

export async function applySkins(zipPaths: string[]): Promise<string> {
  return invoke<string>("apply_skins", { zipPaths });
}

export async function stopPatcher(): Promise<void> {
  return invoke("stop_patcher");
}

export async function getPatcherStatus(): Promise<PatcherStatus> {
  return invoke<PatcherStatus>("get_patcher_status");
}

export async function downloadSkin(
  url: string,
  championName: string,
  skinName: string
): Promise<string> {
  return invoke<string>("download_skin", { url, championName, skinName });
}

export async function downloadMultipleSkins(
  items: { url: string; championName: string; skinName: string }[]
): Promise<number> {
  return invoke<number>("download_multiple_skins", { items });
}

export async function listDownloadedSkins(): Promise<DownloadedSkin[]> {
  return invoke<DownloadedSkin[]>("list_downloaded_skins");
}

export async function deleteDownloadedSkin(championName: string, skinName: string): Promise<void> {
  return invoke("delete_downloaded_skin", { championName, skinName });
}

export async function getSkinsDirSize(): Promise<number> {
  return invoke<number>("get_skins_dir_size");
}

export async function clearAllSkins(): Promise<void> {
  return invoke("clear_all_skins");
}

export async function getWorkDirSize(): Promise<number> {
  return invoke<number>("get_work_dir_size");
}

export async function clearWorkDir(): Promise<void> {
  return invoke("clear_work_dir");
}
