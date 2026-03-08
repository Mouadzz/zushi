import { useState } from "react";
import { ArrowLeft, Download, Check, Loader2 } from "lucide-react";
import { useSkinData, skinDownloadUrl, isSkinAvailable, getSplashNum } from "../hooks/useSkinData";
import { splashUrl, championAvatar } from "../hooks/useChampions";
import type { Champion, Skin } from "../types";

interface ChampionDetailProps {
  champion: Champion;
  onBack: () => void;
  isDownloaded: (championName: string, skinName: string) => boolean;
  downloading: string | null;
  onDownload: (url: string, championName: string, skinName: string) => void;
  onDownloadAll: (items: { url: string; championName: string; skinName: string }[]) => void;
}

function SkinSplash({ skin }: { skin: Skin }) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const num = getSplashNum(skin);

  if (failed) {
    return (
      <div className="bg-charcoal-600 flex h-full w-full items-center justify-center">
        <span className="text-ink-muted text-[10px] select-none">No preview</span>
      </div>
    );
  }

  return (
    <>
      {!loaded && (
        <div className="from-charcoal-600 via-charcoal-400 to-charcoal-600 animate-shimmer absolute inset-0 bg-linear-to-r bg-size-[200%_100%]" />
      )}
      <img
        src={splashUrl(skin.championId, num)}
        alt={skin.name}
        className={[
          "h-full w-full object-cover object-top transition-transform duration-300 group-hover:scale-105",
          loaded ? "opacity-100" : "opacity-0",
        ].join(" ")}
        loading="lazy"
        draggable={false}
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
      />
    </>
  );
}

function SkinCard({
  skin,
  downloaded,
  isDownloading,
  available,
  busy,
  onDownload,
}: {
  skin: Skin;
  downloaded: boolean;
  isDownloading: boolean;
  available: boolean;
  busy: boolean;
  onDownload: () => void;
}) {
  return (
    <div
      className={[
        "group bg-charcoal-500 relative overflow-hidden rounded border transition-colors",
        available
          ? "border-charcoal-50/20 hover:border-gold-400/60"
          : "border-charcoal-50/10 opacity-50",
      ].join(" ")}
    >
      <div className="bg-charcoal-600 relative aspect-video overflow-hidden">
        <SkinSplash skin={skin} />

        <div className="absolute top-2 right-2 z-10">
          {downloaded ? (
            <span className="bg-success/90 flex h-7 w-7 items-center justify-center rounded-full border border-white/20 shadow-lg">
              <Check size={14} strokeWidth={2.5} className="text-white" />
            </span>
          ) : isDownloading ? (
            <span className="bg-gold-400/90 flex h-7 w-7 items-center justify-center rounded-full shadow-lg">
              <Loader2 size={14} strokeWidth={2} className="animate-spin text-white" />
            </span>
          ) : available && !busy ? (
            <button
              onClick={onDownload}
              className="bg-charcoal-600/80 hover:bg-gold-400 hover:text-charcoal-600 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full text-white opacity-0 shadow-lg transition-colors group-hover:opacity-100"
              title="Download"
            >
              <Download size={14} strokeWidth={2} />
            </button>
          ) : null}
        </div>

        {!available && (
          <div className="bg-charcoal-600/60 absolute inset-0 flex items-center justify-center">
            <span className="text-[10px] font-medium tracking-wide text-white/60 uppercase select-none">
              Not available
            </span>
          </div>
        )}
      </div>

      <div className="px-3 py-2">
        <p className="text-ink line-clamp-2 text-xs leading-snug">{skin.name}</p>
      </div>
    </div>
  );
}

export default function ChampionDetail({
  champion,
  onBack,
  isDownloaded,
  downloading,
  onDownload,
  onDownloadAll,
}: ChampionDetailProps) {
  const { skins, loading, error } = useSkinData(champion);

  const busy = downloading !== null;
  const notDownloaded = skins.filter(
    (s) => !isDownloaded(s.championName, s.name) && isSkinAvailable(s)
  );
  const allDownloaded = notDownloaded.length === 0 && skins.length > 0;

  const handleDownloadAll = () => {
    const items: { url: string; championName: string; skinName: string }[] = [];
    for (const s of notDownloaded) {
      const url = skinDownloadUrl(s);
      if (url) {
        items.push({ url, championName: s.championName, skinName: s.name });
      }
    }
    if (items.length > 0) onDownloadAll(items);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="border-border flex shrink-0 items-center gap-3 border-b px-4 py-2.5">
        <button
          onClick={onBack}
          className="hover:bg-charcoal-200 text-ink-muted hover:text-ink -ml-1 flex h-8 w-8 cursor-pointer items-center justify-center rounded-md transition-colors"
        >
          <ArrowLeft size={20} strokeWidth={1.5} />
        </button>

        <img
          src={championAvatar(champion.id)}
          alt={champion.name}
          className="h-7 w-7 rounded-sm"
          draggable={false}
        />

        <div className="flex min-w-0 items-baseline gap-2">
          <span className="text-ink truncate text-sm font-medium">{champion.name}</span>
          <span className="text-ink-muted hidden truncate text-xs sm:inline">{champion.title}</span>
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-3">
          {!loading && (
            <span className="text-ink-muted text-[11px] tabular-nums select-none">
              {skins.length} {skins.length === 1 ? "skin" : "skins"}
            </span>
          )}

          {!loading && skins.length > 0 && !allDownloaded && (
            <button
              onClick={handleDownloadAll}
              disabled={busy}
              className="bg-gold-400 text-charcoal-600 hover:bg-gold-300 flex cursor-pointer items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium transition-colors disabled:pointer-events-none disabled:opacity-40"
            >
              <Download size={13} strokeWidth={2} />
              Download All
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex h-32 items-center justify-center">
            <span className="text-ink-muted text-sm">Loading skins...</span>
          </div>
        ) : error ? (
          <div className="flex h-32 flex-col items-center justify-center gap-1">
            <span className="text-error text-sm">Failed to load skin data</span>
            <span className="text-ink-muted text-xs">{error}</span>
          </div>
        ) : skins.length === 0 ? (
          <div className="flex h-32 items-center justify-center">
            <span className="text-ink-muted text-sm">No skins available</span>
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-3">
            {skins.map((skin) => {
              const dlKey = `${skin.championName}/${skin.name}`;
              const url = skinDownloadUrl(skin);
              const available = isSkinAvailable(skin);
              return (
                <SkinCard
                  key={skin.id}
                  skin={skin}
                  downloaded={isDownloaded(skin.championName, skin.name)}
                  isDownloading={downloading === dlKey}
                  available={available}
                  busy={busy}
                  onDownload={() => {
                    if (url) {
                      onDownload(url, skin.championName, skin.name);
                    }
                  }}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
