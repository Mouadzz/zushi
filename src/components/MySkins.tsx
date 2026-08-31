import { useState, useEffect, useMemo } from "react";
import { Layers, Check, Info, X, Search } from "lucide-react";
import { splashUrl, findChampionByName, championAvatar } from "../hooks/useChampions";
import { lookupSplashNum, lookupChromaInfo, ensureChromaInfo } from "../hooks/useSkinData";
import type { DownloadedSkin } from "../types";

function useChromaReady(): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let cancelled = false;
    ensureChromaInfo()
      .then(() => {
        if (!cancelled) setReady(true);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  return ready;
}

// base is null when the user only owns chromas of this base.
type DownloadGroup = {
  base: DownloadedSkin | null;
  baseSkinName: string;
  chromas: { dl: DownloadedSkin; colors: string[] }[];
};

type Selection = Record<string, string>;

interface MySkinsProps {
  downloads: DownloadedSkin[];
  patcherActive: boolean;
  selection: Selection;
  onSelectionChange: (selection: Selection) => void;
  onDelete: (championName: string, skinName: string) => Promise<void>;
}

function SkinThumb({ championName, skinName }: { championName: string; skinName: string }) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const champ = findChampionByName(championName);
  const num = lookupSplashNum(skinName);

  if (!champ || num === null || failed) {
    return <div className="bg-charcoal-600 h-full w-full" />;
  }

  return (
    <>
      {!loaded && (
        <div className="from-charcoal-600 via-charcoal-400 to-charcoal-600 animate-shimmer absolute inset-0 bg-linear-to-r bg-size-[200%_100%]" />
      )}
      <img
        src={splashUrl(champ.id, num)}
        alt={skinName}
        className={[
          "h-full w-full object-cover object-[center_20%]",
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

function ChampAvatar({ championName }: { championName: string }) {
  const [failed, setFailed] = useState(false);
  const champ = findChampionByName(championName);

  if (!champ || failed) {
    return (
      <div className="bg-charcoal-500 text-ink-muted flex h-8 w-8 items-center justify-center rounded text-[10px]">
        {championName.charAt(0)}
      </div>
    );
  }

  return (
    <img
      src={championAvatar(champ.id)}
      alt={championName}
      className="h-8 w-8 rounded object-cover"
      draggable={false}
      onError={() => setFailed(true)}
    />
  );
}

export default function MySkins({
  downloads,
  patcherActive,
  selection,
  onSelectionChange,
  onDelete,
}: MySkinsProps) {
  const chromaReady = useChromaReady(); // re-render once Community Dragon chroma data lands

  const toggleSkin = (championName: string, skinName: string) => {
    if (patcherActive) return;
    if (selection[championName] === skinName) {
      const next = { ...selection };
      delete next[championName];
      onSelectionChange(next);
    } else {
      onSelectionChange({ ...selection, [championName]: skinName });
    }
  };

  const handleDelete = async (championName: string, skinName: string) => {
    if (patcherActive) return;
    // Also deselect if this skin was selected
    if (selection[championName] === skinName) {
      const next = { ...selection };
      delete next[championName];
      onSelectionChange(next);
    }
    await onDelete(championName, skinName);
  };

  const handleDeleteGroup = async (championName: string, skinNames: string[]) => {
    if (patcherActive || skinNames.length === 0) return;
    if (skinNames.includes(selection[championName])) {
      const next = { ...selection };
      delete next[championName];
      onSelectionChange(next);
    }
    await Promise.all(skinNames.map((n) => onDelete(championName, n)));
  };

  const selectedCount = Object.keys(selection).length;
  const [search, setSearch] = useState("");

  // Grouping scans the ~9k skin database per skin, so memoize it on downloads
  // (and chroma readiness) instead of rebuilding on every search/selection render.
  const grouped = useMemo(() => {
    void chromaReady; // recompute once Community Dragon chroma data lands
    const map = new Map<string, DownloadGroup[]>();
    for (const skin of downloads) {
      const champGroups = map.get(skin.champion_name) ?? [];
      const chromaInfo = lookupChromaInfo(skin.skin_name);
      if (chromaInfo) {
        let g = champGroups.find((g) => g.baseSkinName === chromaInfo.parentName);
        if (!g) {
          g = { base: null, baseSkinName: chromaInfo.parentName, chromas: [] };
          champGroups.push(g);
        }
        g.chromas.push({ dl: skin, colors: chromaInfo.colors });
      } else {
        let g = champGroups.find((g) => g.baseSkinName === skin.skin_name);
        if (!g) {
          g = { base: skin, baseSkinName: skin.skin_name, chromas: [] };
          champGroups.push(g);
        } else {
          g.base = skin;
        }
      }
      map.set(skin.champion_name, champGroups);
    }
    return map;
  }, [downloads, chromaReady]);

  const filteredEntries = useMemo(() => {
    const entries = [...grouped.entries()];
    const query = search.trim().toLowerCase();
    return query ? entries.filter(([champion]) => champion.toLowerCase().includes(query)) : entries;
  }, [grouped, search]);

  if (downloads.length === 0) {
    return (
      <div className="flex h-full flex-col">
        <div className="border-border flex shrink-0 items-center border-b px-4 py-3">
          <span className="text-ink-muted text-sm select-none">0 skins</span>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
          <div className="bg-charcoal-300 flex h-12 w-12 items-center justify-center rounded-full">
            <Layers size={20} strokeWidth={1.5} className="text-ink-muted" />
          </div>
          <div>
            <p className="text-ink-secondary text-sm">No skins downloaded yet</p>
            <p className="text-ink-muted mt-1 text-xs">
              Browse champions and download skins to get started
            </p>
          </div>
        </div>
      </div>
    );
  }

  let baseSkinCount = 0;
  for (const groups of grouped.values()) baseSkinCount += groups.length;

  return (
    <div className="flex h-full flex-col">
      <div className="border-border flex shrink-0 items-center gap-3 border-b px-4 py-3">
        <span className="text-ink-muted text-sm tabular-nums select-none">
          {baseSkinCount} {baseSkinCount === 1 ? "skin" : "skins"}
        </span>

        <div className="relative max-w-64 flex-1">
          <Search
            size={14}
            strokeWidth={1.5}
            className="text-ink-muted pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter by champion"
            className="bg-charcoal-500 border-border text-ink placeholder:text-ink-muted focus:border-gold-500/60 w-full rounded-sm border py-1.5 pr-3 pl-8 text-sm transition-colors focus:outline-none"
          />
        </div>

        {selectedCount > 0 && (
          <span className="text-gold-400 ml-auto text-sm font-medium tabular-nums select-none">
            {selectedCount} selected
          </span>
        )}
      </div>

      <div className="bg-gold-400/8 border-gold-400/15 mx-4 mt-3 mb-1 flex items-start gap-2.5 rounded-lg border px-3 py-2.5">
        <Info size={14} strokeWidth={1.5} className="text-gold-400 mt-0.5 shrink-0" />
        <p className="text-ink-secondary text-xs leading-relaxed">
          <span className="text-gold-400 font-medium">Keep the default skin</span> selected in
          champion select. If you use a skin you already own, it will override your patched one.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="flex flex-col">
          {filteredEntries.length === 0 && (
            <div className="text-ink-muted flex h-32 items-center justify-center text-sm">
              No champions match "{search}"
            </div>
          )}
          {filteredEntries.map(([champion, groups]) => {
            const selectedSkin = selection[champion];
            const baseCount = groups.length;
            return (
              <div
                key={champion}
                className="border-border flex items-start gap-3 border-b px-4 py-3"
              >
                <div className="flex w-32 shrink-0 items-center gap-2.5 pt-0.5">
                  <ChampAvatar championName={champion} />
                  <div className="min-w-0">
                    <p className="text-ink truncate text-xs font-medium">{champion}</p>
                    <p className="text-ink-muted truncate text-[10px]">
                      {baseCount} {baseCount === 1 ? "skin" : "skins"}
                    </p>
                  </div>
                </div>

                <div className="flex min-w-0 flex-1 flex-wrap gap-2">
                  {groups.map((group) => {
                    const baseSelected = selectedSkin === group.baseSkinName;
                    const selectedChroma = group.chromas.find(
                      (c) => c.dl.skin_name === selectedSkin
                    );
                    const anySelected = baseSelected || !!selectedChroma;
                    const baseClickable = !patcherActive && group.base !== null;

                    const hasChromas = group.chromas.length > 0;
                    return (
                      <div
                        key={group.baseSkinName}
                        className={
                          hasChromas
                            ? "bg-charcoal-500/70 border-charcoal-300/25 rounded-md border p-1.5"
                            : ""
                        }
                      >
                        <div className="relative">
                          <button
                            onClick={() => {
                              if (!baseClickable || !group.base) return;
                              toggleSkin(group.base.champion_name, group.base.skin_name);
                            }}
                            disabled={!baseClickable}
                            className={[
                              "relative h-24 w-32 overflow-hidden rounded transition-all",
                              patcherActive
                                ? "cursor-default opacity-50"
                                : group.base
                                  ? "cursor-pointer"
                                  : "cursor-default",
                              anySelected
                                ? "ring-gold-400 ring-offset-charcoal-400 ring-2 ring-offset-1"
                                : "ring-charcoal-50/20 hover:ring-charcoal-50/40 ring-1",
                              !group.base && "opacity-70",
                            ]
                              .filter(Boolean)
                              .join(" ")}
                            title={
                              group.base
                                ? group.baseSkinName
                                : `${group.baseSkinName} (base not downloaded)`
                            }
                          >
                            <SkinThumb championName={champion} skinName={group.baseSkinName} />

                            {baseSelected && (
                              <div className="bg-gold-400 absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full border border-white/30 shadow-sm">
                                <Check size={11} strokeWidth={3} className="text-charcoal-600" />
                              </div>
                            )}
                            {selectedChroma && (
                              <div
                                className="absolute top-1 right-1 h-5 w-5 rounded-full border-2 border-white shadow-sm"
                                style={{
                                  background: selectedChroma.colors[1]
                                    ? `linear-gradient(135deg, ${selectedChroma.colors[0]} 0% 50%, ${selectedChroma.colors[1]} 50% 100%)`
                                    : selectedChroma.colors[0] ?? "var(--color-gold-400)",
                                }}
                                title={`Chroma: ${selectedChroma.dl.skin_name}`}
                              />
                            )}

                            <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/80 via-black/40 to-transparent px-1.5 pt-4 pb-1">
                              <p className="line-clamp-2 text-[10px] leading-tight text-white/90">
                                {group.baseSkinName}
                              </p>
                            </div>
                          </button>

                          {!patcherActive && group.base && (
                            <button
                              onClick={() => {
                                const names: string[] = [];
                                if (group.base) names.push(group.base.skin_name);
                                for (const c of group.chromas) names.push(c.dl.skin_name);
                                handleDeleteGroup(champion, names);
                              }}
                              className="bg-charcoal-500 hover:bg-error text-ink-muted absolute top-1 left-1 flex h-5 w-5 cursor-pointer items-center justify-center rounded-full shadow transition-colors hover:text-white"
                              title={
                                group.chromas.length > 0
                                  ? `Delete skin and ${group.chromas.length} chroma${group.chromas.length === 1 ? "" : "s"}`
                                  : "Delete skin"
                              }
                            >
                              <X size={10} strokeWidth={2.5} />
                            </button>
                          )}
                        </div>

                        {group.chromas.length > 0 && (
                          <div className="mt-1 flex w-32 flex-wrap items-center gap-1">
                            {group.chromas.map((c) => {
                              const isSel = selectedSkin === c.dl.skin_name;
                              const bg = c.colors[1]
                                ? `linear-gradient(135deg, ${c.colors[0]} 0% 50%, ${c.colors[1]} 50% 100%)`
                                : (c.colors[0] ?? undefined);
                              return (
                                <button
                                  key={c.dl.skin_name}
                                  onClick={() => toggleSkin(c.dl.champion_name, c.dl.skin_name)}
                                  onContextMenu={(e) => {
                                    e.preventDefault();
                                    handleDelete(c.dl.champion_name, c.dl.skin_name);
                                  }}
                                  disabled={patcherActive}
                                  title={`${c.dl.skin_name}\n(right-click to delete)`}
                                  className={[
                                    "ring-offset-charcoal-400 relative h-4 w-4 shrink-0 rounded-sm transition-all",
                                    patcherActive
                                      ? "cursor-default opacity-50"
                                      : "cursor-pointer",
                                    isSel
                                      ? "ring-gold-400 ring-2 ring-offset-1"
                                      : "ring-charcoal-50/30 hover:ring-charcoal-50/60 ring-1",
                                  ].join(" ")}
                                  style={{
                                    background:
                                      bg ?? "var(--color-charcoal-300, #3a3a3a)",
                                  }}
                                >
                                  {isSel && (
                                    <Check
                                      size={9}
                                      strokeWidth={3}
                                      className="absolute inset-0 m-auto text-white drop-shadow"
                                    />
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
