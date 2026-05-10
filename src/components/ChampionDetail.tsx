import { useState } from "react";
import { ArrowLeft, Download, Check, Loader2 } from "lucide-react";
import { useSkinData, skinDownloadUrl, isSkinAvailable, getSplashNum } from "../hooks/useSkinData";
import { splashUrl, championAvatar } from "../hooks/useChampions";
import type { Champion, Skin, Chroma, SkinGroup } from "../types";

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

// Tiny coloured square representing a chroma. Single-color → solid fill,
// two-color → diagonal split. Border/check overlay reflects per-chroma state
// (downloaded, downloading, available, not-in-repo). 0 colors falls back to
// a neutral square so chromas without color metadata still render.
function ChromaSwatch({
  chroma,
  downloaded,
  isDownloading,
  available,
  busy,
  onDownload,
}: {
  chroma: Chroma;
  downloaded: boolean;
  isDownloading: boolean;
  available: boolean;
  busy: boolean;
  onDownload: () => void;
}) {
  const [c1, c2] = chroma.colors;
  const bg = !c1
    ? undefined
    : c2
      ? `linear-gradient(135deg, ${c1} 0% 50%, ${c2} 50% 100%)`
      : c1;

  // Per-chroma "downloaded" state is intentionally not shown — the big card's
  // single checkmark already conveys it (chromas come down with the base via
  // the cascade). Swatches only show: spinner while in flight, a soft ring
  // when available, dimmed when not in repo. Clicking still downloads just
  // that chroma if a user wants to grab one in isolation.
  const ring = isDownloading
    ? "ring-gold-400 ring-2"
    : available
      ? "ring-charcoal-50/30 hover:ring-gold-400/80 ring-1"
      : "ring-charcoal-50/10 opacity-30 ring-1";

  const clickable = available && !busy && !downloaded && !isDownloading;

  return (
    <button
      type="button"
      onClick={clickable ? onDownload : undefined}
      disabled={!clickable}
      title={`${chroma.name}${!available ? " (not available)" : ""}`}
      className={[
        "ring-offset-charcoal-500 relative h-5 w-5 shrink-0 rounded-sm ring-offset-1 transition-all",
        clickable ? "cursor-pointer" : "cursor-default",
        ring,
      ].join(" ")}
      style={{ background: bg ?? "var(--color-charcoal-400, #2a2a2a)" }}
    >
      {isDownloading && (
        <Loader2 size={10} strokeWidth={2.5} className="absolute inset-0 m-auto animate-spin text-white" />
      )}
    </button>
  );
}

function SkinCard({
  group,
  downloadKeyState,
  busy,
  onDownloadSkin,
  onDownloadGroup,
}: {
  group: SkinGroup;
  downloadKeyState: (championName: string, skinName: string) => {
    downloaded: boolean;
    isDownloading: boolean;
    available: boolean;
    url: string | null;
  };
  busy: boolean;
  onDownloadSkin: (url: string, championName: string, skinName: string) => void;
  // Click on the base skin's main DL button: pull the base AND every chroma in
  // one batch (skipping any that are already on disk or unavailable). Chroma
  // swatches still individually trigger only their own chroma.
  onDownloadGroup: (group: SkinGroup) => void;
}) {
  const baseState = downloadKeyState(group.base.championName, group.base.name);

  return (
    <div
      className={[
        "group bg-charcoal-500 relative overflow-hidden rounded border transition-colors",
        baseState.available
          ? "border-charcoal-50/20 hover:border-gold-400/60"
          : "border-charcoal-50/10 opacity-50",
      ].join(" ")}
    >
      <div className="bg-charcoal-600 relative aspect-video overflow-hidden">
        <SkinSplash skin={group.base} />

        <div className="absolute top-2 right-2 z-10">
          {baseState.downloaded ? (
            <span className="bg-success/90 flex h-7 w-7 items-center justify-center rounded-full border border-white/20 shadow-lg">
              <Check size={14} strokeWidth={2.5} className="text-white" />
            </span>
          ) : baseState.isDownloading ? (
            <span className="bg-gold-400/90 flex h-7 w-7 items-center justify-center rounded-full shadow-lg">
              <Loader2 size={14} strokeWidth={2} className="animate-spin text-white" />
            </span>
          ) : baseState.available && !busy ? (
            <button
              onClick={() => onDownloadGroup(group)}
              className="bg-charcoal-600/80 hover:bg-gold-400 hover:text-charcoal-600 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full text-white opacity-0 shadow-lg transition-colors group-hover:opacity-100"
              title={
                group.chromas.length > 0
                  ? `Download skin and ${group.chromas.length} chroma${group.chromas.length === 1 ? "" : "s"}`
                  : "Download"
              }
            >
              <Download size={14} strokeWidth={2} />
            </button>
          ) : null}
        </div>

        {!baseState.available && (
          <div className="bg-charcoal-600/60 absolute inset-0 flex items-center justify-center">
            <span className="text-[10px] font-medium tracking-wide text-white/60 uppercase select-none">
              Not available
            </span>
          </div>
        )}
      </div>

      <div className="px-3 py-2">
        <p className="text-ink line-clamp-2 text-xs leading-snug">{group.base.name}</p>
        {group.chromas.length > 0 && (
          <div className="mt-1.5 flex flex-wrap items-center gap-1">
            {group.chromas.map((chroma) => {
              const cs = downloadKeyState(chroma.championName, chroma.name);
              return (
                <ChromaSwatch
                  key={chroma.id}
                  chroma={chroma}
                  downloaded={cs.downloaded}
                  isDownloading={cs.isDownloading}
                  available={cs.available}
                  busy={busy}
                  onDownload={() => {
                    if (cs.url) onDownloadSkin(cs.url, chroma.championName, chroma.name);
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

export default function ChampionDetail({
  champion,
  onBack,
  isDownloaded,
  downloading,
  onDownload,
  onDownloadAll,
}: ChampionDetailProps) {
  const { skins, groups, loading, error } = useSkinData(champion);

  const busy = downloading !== null;
  // Download All still walks the flat list — bases AND chromas, every entry
  // that has a zip in the LeagueSkins repo and isn't already on disk.
  const notDownloaded = skins.filter(
    (s) => !isDownloaded(s.championName, s.name) && isSkinAvailable(s)
  );
  const allDownloaded = notDownloaded.length === 0 && skins.length > 0;

  // Per-card lookup. Centralised so SkinCard/ChromaSwatch don't have to
  // re-derive the four state bits in two places.
  const downloadKeyState = (championName: string, skinName: string) => {
    const dlKey = `${championName}/${skinName}`;
    const stub = { championName, name: skinName } as Skin;
    return {
      downloaded: isDownloaded(championName, skinName),
      isDownloading: downloading === dlKey,
      available: isSkinAvailable(stub),
      url: skinDownloadUrl(stub),
    };
  };

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

  // Click on a skin card's main DL button: queue the base + every chroma in
  // that group, skipping anything already on disk or unavailable. Goes through
  // the same onDownloadAll path so the existing batch-progress UI applies.
  const handleDownloadGroup = (group: SkinGroup) => {
    const items: { url: string; championName: string; skinName: string }[] = [];
    const candidates: Skin[] = [group.base, ...group.chromas];
    for (const s of candidates) {
      if (isDownloaded(s.championName, s.name)) continue;
      const url = skinDownloadUrl(s);
      if (!url) continue;
      items.push({ url, championName: s.championName, skinName: s.name });
    }
    if (items.length === 1) {
      // Single item — go through the single-download path so progress shows
      // on the one card instead of triggering batch UI for nothing.
      onDownload(items[0].url, items[0].championName, items[0].skinName);
    } else if (items.length > 1) {
      onDownloadAll(items);
    }
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
              {groups.length} {groups.length === 1 ? "skin" : "skins"}
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
        ) : groups.length === 0 ? (
          <div className="flex h-32 items-center justify-center">
            <span className="text-ink-muted text-sm">No skins available</span>
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-3">
            {groups.map((group) => (
              <SkinCard
                key={group.base.id}
                group={group}
                downloadKeyState={downloadKeyState}
                busy={busy}
                onDownloadSkin={onDownload}
                onDownloadGroup={handleDownloadGroup}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
