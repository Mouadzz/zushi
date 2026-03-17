import { Loader2 } from "lucide-react";
import type { PatcherStatus } from "../types";

interface StatusBarProps {
  patcherStatus: PatcherStatus;
  downloading?: string | null;
}

function getStatusInfo(s: PatcherStatus): { label: string; dotClass: string; spinner: boolean } {
  if (typeof s === "object" && "Error" in s) {
    return { label: s.Error, dotClass: "bg-error", spinner: false };
  }
  switch (s) {
    case "Idle":
      return { label: "Ready", dotClass: "bg-ink-muted", spinner: false };
    case "Importing":
      return { label: "Importing skins...", dotClass: "bg-gold-400 animate-pulse", spinner: true };
    case "BuildingOverlay":
      return { label: "Building overlay...", dotClass: "bg-gold-400 animate-pulse", spinner: true };
    case "WaitingForGame":
      return { label: "Waiting for game...", dotClass: "bg-gold-400 animate-pulse", spinner: true };
    case "FoundGame":
      return { label: "Game found!", dotClass: "bg-success", spinner: false };
    case "Scanning":
      return { label: "Scanning game...", dotClass: "bg-gold-400 animate-pulse", spinner: true };
    case "Patching":
      return { label: "Skins applied!", dotClass: "bg-success animate-pulse", spinner: false };
    case "InGame":
      return { label: "In game", dotClass: "bg-success", spinner: false };
    case "GameExited":
      return { label: "Game ended - ready for next...", dotClass: "bg-gold-400 animate-pulse", spinner: false };
    default:
      return { label: "Ready", dotClass: "bg-ink-muted", spinner: false };
  }
}

export default function StatusBar({ patcherStatus, downloading }: StatusBarProps) {
  const { label, dotClass, spinner } = getStatusInfo(patcherStatus);
  const isActive =
    patcherStatus !== "Idle" && !(typeof patcherStatus === "object" && "Error" in patcherStatus);

  // Show download status when actively downloading and patcher is idle
  const showDownload = downloading && patcherStatus === "Idle";
  let displayLabel = label;
  if (showDownload) {
    if (downloading === "batch") {
      displayLabel = "Preparing downloads...";
    } else if (downloading.includes("(")) {
      displayLabel = `Downloading ${downloading}`;
    } else {
      displayLabel = `Downloading ${downloading.split("/").pop()}...`;
    }
  }
  const displayDot = showDownload ? "bg-gold-400 animate-pulse" : dotClass;
  const showSpinner = showDownload || spinner;

  return (
    <footer className="border-border bg-charcoal-500 flex items-center gap-3 border-t px-5 py-3.5">
      <span className={`h-3 w-3 shrink-0 rounded-full ${displayDot}`} />
      {showSpinner && <Loader2 size={16} className="text-gold-400 shrink-0 animate-spin" />}
      <span
        className={[
          "truncate text-[15px]",
          isActive || showDownload ? "text-ink font-medium" : "text-ink-secondary",
        ].join(" ")}
      >
        {displayLabel}
      </span>
      <span className="text-ink-muted ml-auto shrink-0 text-xs">Zushi v0.1.1</span>
    </footer>
  );
}
