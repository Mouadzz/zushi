import { invoke } from "@tauri-apps/api/core";
import { Loader2 } from "lucide-react";

interface UpdateBannerProps {
  version: string;
  releasesUrl: string;
  canInstall: boolean;
  installing: boolean;
  error: string | null;
  onInstall: () => void;
}

export default function UpdateBanner({
  version,
  releasesUrl,
  canInstall,
  installing,
  error,
  onInstall,
}: UpdateBannerProps) {
  return (
    <div className="border-gold-400/20 bg-gold-400/8 mt-auto mx-3 mb-3 flex flex-col gap-2 rounded-lg border p-3">
      <span className="text-ink text-xs font-medium">
        v{version} available
      </span>
      {error && <span className="text-ink-muted text-xs">Update failed: {error}</span>}
      {canInstall ? (
        <button
          onClick={onInstall}
          disabled={installing}
          className="bg-gold-400 text-charcoal-600 hover:bg-gold-300 flex w-full cursor-pointer items-center justify-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium transition-colors disabled:cursor-default disabled:opacity-70"
        >
          {installing && <Loader2 size={13} strokeWidth={2} className="animate-spin" />}
          {installing ? "Updating…" : "Update & restart"}
        </button>
      ) : (
        <button
          onClick={() => invoke("open_url", { url: releasesUrl }).catch(() => {})}
          className="bg-gold-400 text-charcoal-600 hover:bg-gold-300 w-full cursor-pointer rounded px-3 py-1.5 text-xs font-medium transition-colors"
        >
          Download update
        </button>
      )}
    </div>
  );
}
