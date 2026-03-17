import { Loader2 } from "lucide-react";
import type { PatcherStatus } from "../types";

interface StatusBarProps {
  patcherStatus: PatcherStatus;
  downloading?: string | null;
}

function getLabel(s: PatcherStatus): { label: string; dotClass: string } {
  if (typeof s === "object" && "Error" in s) {
    return { label: s.Error, dotClass: "bg-error" };
  }
  switch (s) {
    case "Idle":
      return { label: "Ready", dotClass: "bg-ink-muted" };
    case "Importing":
      return {
        label: "Importing skins...",
        dotClass: "bg-gold-400 animate-pulse",
      };
    case "BuildingOverlay":
      return {
        label: "Building overlay...",
        dotClass: "bg-gold-400 animate-pulse",
      };
    case "WaitingForGame":
      return {
        label: "Waiting for game...",
        dotClass: "bg-gold-400 animate-pulse",
      };
    case "FoundGame":
      return { label: "Game found!", dotClass: "bg-success" };
    case "Scanning":
      return {
        label: "Scanning game...",
        dotClass: "bg-gold-400 animate-pulse",
      };
    case "SkinActive":
      return { label: "Skins applied!", dotClass: "bg-success animate-pulse" };
    case "WaitingForExit":
      return { label: "In game - skins active", dotClass: "bg-success" };
    case "GameExited":
      return {
        label: "Game ended - ready for next...",
        dotClass: "bg-gold-400 animate-pulse",
      };
    default:
      return { label: "Ready", dotClass: "bg-ink-muted" };
  }
}

export default function StatusBar({ patcherStatus, downloading }: StatusBarProps) {
  const { label, dotClass } = getLabel(patcherStatus);
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
  const isWorking =
    showDownload ||
    (isActive &&
      patcherStatus !== "SkinActive" &&
      patcherStatus !== "WaitingForExit" &&
      patcherStatus !== "FoundGame");

  return (
    <footer className="border-border bg-charcoal-500 flex items-center gap-3 border-t px-5 py-3.5">
      <span className={`h-3 w-3 shrink-0 rounded-full ${displayDot}`} />
      {isWorking && <Loader2 size={16} className="text-gold-400 shrink-0 animate-spin" />}
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
