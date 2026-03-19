import { open } from "@tauri-apps/plugin-shell";

interface UpdateBannerProps {
  version: string;
  releasesUrl: string;
}

export default function UpdateBanner({ version, releasesUrl }: UpdateBannerProps) {
  return (
    <div className="border-gold-400/20 bg-gold-400/8 mt-auto mx-3 mb-3 flex flex-col gap-2 rounded-lg border p-3">
      <span className="text-ink text-xs font-medium">
        v{version} available
      </span>
      <button
        onClick={() => open(releasesUrl)}
        className="bg-gold-400 text-charcoal-600 hover:bg-gold-300 w-full cursor-pointer rounded px-3 py-1.5 text-xs font-medium transition-colors"
      >
        Download update
      </button>
    </div>
  );
}
