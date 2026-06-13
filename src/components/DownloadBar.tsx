import { Loader2 } from "lucide-react";

interface DownloadBarProps {
  downloading: string | null;
}

export default function DownloadBar({ downloading }: DownloadBarProps) {
  if (!downloading) return null;

  let label: string;
  let progress: { current: number; total: number } | null = null;

  if (downloading === "batch") {
    label = "Preparing downloads...";
  } else {
    // Batch progress arrives as "Skin Name (3/10)".
    const match = downloading.match(/^(.*) \((\d+)\/(\d+)\)$/);
    if (match) {
      label = `Downloading ${match[1]}`;
      progress = { current: Number(match[2]), total: Number(match[3]) };
    } else {
      label = `Downloading ${downloading.split("/").pop()}...`;
    }
  }

  const pct = progress ? Math.round((progress.current / progress.total) * 100) : null;

  return (
    <div className="border-border bg-charcoal-600 relative flex items-center gap-3 border-t px-4 py-2">
      <Loader2 size={14} className="text-gold-400 shrink-0 animate-spin" />
      <span className="text-ink truncate text-sm font-medium">{label}</span>
      {progress && (
        <span className="text-ink-muted ml-auto shrink-0 text-xs tabular-nums select-none">
          {progress.current}/{progress.total}
        </span>
      )}
      {pct !== null && (
        <div className="bg-charcoal-300 absolute inset-x-0 bottom-0 h-0.5">
          <div
            className="bg-gold-400 h-full transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  );
}
