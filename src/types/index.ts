export type AppStatus = "idle" | "setup" | "game-detected" | "game-not-found" | "error";

export type PatcherStatus =
  | "Idle"
  | "Importing"
  | "BuildingOverlay"
  | "WaitingForGame"
  | "FoundGame"
  | "Scanning"
  | "Patching"
  | "InGame"
  | "GameExited"
  | { Error: string };

export interface Champion {
  id: string;     // "Aatrox" - used in DDragon image URLs
  key: string;    // "266" - numeric ID, matches LeagueSkins repo structure
  name: string;   // "Aatrox"
  title: string;  // "the Darkin Blade"
  tags: string[]; // ["Fighter", "Tank"]
}

export interface Skin {
  id: string;       // "266007" - skin ID from skin_ids.json
  num: number;      // 7 - skinId % 1000, used for splash art URLs
  name: string;     // "Blood Moon Aatrox" - exact name matching LeagueSkins repo folder
  championId: string; // "Aatrox" - DDragon champion id for image URLs
  championName: string; // "Aatrox" - repo folder name (from base skin entry in skin_ids)
}

export interface DownloadedSkin {
  champion_name: string;
  skin_name: string;
  zip_path: string;
}
