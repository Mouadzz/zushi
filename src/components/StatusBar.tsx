import { Play, Square, Loader2 } from "lucide-react";
import type { PatcherStatus } from "../types";

interface StatusBarProps {
  patcherStatus: PatcherStatus;
  downloading?: string | null;
  skinCount: number;
  customCount: number;
  onApply: () => void;
  onStop: () => void;
}

function getStatusInfo(s: PatcherStatus): { label: string; dotClass: string; spinner: boolean } {
  if (typeof s === "object" && "Error" in s) {
    return { label: s.Error, dotClass: "bg-error", spinner: false };
  }
  switch (s) {
    case "Idle":
      return { label: "Ready", dotClass: "bg-ink-muted", spinner: false };
    case "Importing":
      return { label: "Importing mods...", dotClass: "bg-gold-400 animate-pulse", spinner: true };
    case "BuildingOverlay":
      return { label: "Building overlay...", dotClass: "bg-gold-400 animate-pulse", spinner: true };
    case "WaitingForGame":
      return { label: "Waiting for game...", dotClass: "bg-gold-400 animate-pulse", spinner: true };
    case "FoundGame":
      return { label: "Game found!", dotClass: "bg-success", spinner: false };
    case "Scanning":
      return { label: "Scanning game...", dotClass: "bg-gold-400 animate-pulse", spinner: true };
    case "Patching":
      return { label: "Mods applied!", dotClass: "bg-success animate-pulse", spinner: false };
    case "InGame":
      return { label: "In game", dotClass: "bg-success", spinner: false };
    case "GameExited":
      return { label: "Game ended — ready for next...", dotClass: "bg-gold-400 animate-pulse", spinner: false };
    default:
      return { label: "Ready", dotClass: "bg-ink-muted", spinner: false };
  }
}

export default function StatusBar({
  patcherStatus,
  downloading,
  skinCount,
  customCount,
  onApply,
  onStop,
}: StatusBarProps) {
  const { label, dotClass, spinner } = getStatusInfo(patcherStatus);
  const isActive =
    patcherStatus !== "Idle" && !(typeof patcherStatus === "object" && "Error" in patcherStatus);

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

  const totalSelected = skinCount + customCount;
  const canApply = totalSelected > 0 && !isActive;

  const countLabel = [
    skinCount > 0 ? `${skinCount} ${skinCount === 1 ? "skin" : "skins"}` : null,
    customCount > 0 ? `${customCount} ${customCount === 1 ? "custom" : "customs"}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <footer className="border-border bg-charcoal-500 flex items-center gap-3 border-t px-4 py-2.5">
      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${displayDot}`} />
      {showSpinner && <Loader2 size={14} className="text-gold-400 shrink-0 animate-spin" />}
      <span
        className={[
          "truncate text-sm",
          isActive || showDownload ? "text-ink font-medium" : "text-ink-secondary",
        ].join(" ")}
      >
        {displayLabel}
      </span>

      <div className="ml-auto flex shrink-0 items-center gap-3">
        {!isActive && countLabel && (
          <span className="text-ink-muted text-xs tabular-nums select-none">{countLabel}</span>
        )}

        {isActive ? (
          <button
            onClick={onStop}
            className="bg-error/10 text-error border-error/20 hover:bg-error/20 hover:border-error/40 flex h-9 cursor-pointer items-center gap-2 rounded-xl border px-4 transition-all active:scale-95"
            title="Stop patcher"
          >
            <Square size={13} strokeWidth={2.5} fill="currentColor" />
            <span className="text-sm font-medium">Stop</span>
          </button>
        ) : (
          <button
            onClick={onApply}
            disabled={!canApply}
            className={[
              "flex h-9 items-center gap-2 rounded-xl px-4 transition-all active:scale-95",
              canApply
                ? "bg-gold-400 text-charcoal-600 hover:bg-gold-300 shadow-gold-400/30 cursor-pointer shadow-lg"
                : "bg-charcoal-300 text-ink-muted/30 pointer-events-none",
            ].join(" ")}
          >
            <Play size={14} strokeWidth={2.5} fill="currentColor" />
            <span className="text-sm font-semibold">Apply</span>
          </button>
        )}
      </div>
    </footer>
  );
}
