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

// A chroma is a skin variant (e.g. "Battle Academia Briar (Pearl)") of a base
// skin. Shares the parent's splash art but has its own colors and its own zip
// in the LeagueSkins repo.
export interface Chroma extends Skin {
  parentName: string;
  colors: string[]; // 1 hex for solid, 2 for gradient
}

// A base skin paired with its chroma variants. ChampionDetail renders one
// card per group; chromas appear as small swatches inside the card.
export interface SkinGroup {
  base: Skin;
  chromas: Chroma[];
}

export interface DownloadedSkin {
  champion_name: string;
  skin_name: string;
  zip_path: string;
}

export interface CustomEntry {
  name: string;
  file_path: string;
}

export interface CustomMod extends CustomEntry {
  enabled: boolean;
}
