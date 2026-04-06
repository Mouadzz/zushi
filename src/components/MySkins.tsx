import { useState } from "react";
import { Layers, Check, Info, X } from "lucide-react";
import { splashUrl, findChampionByName, championAvatar } from "../hooks/useChampions";
import { lookupSplashNum } from "../hooks/useSkinData";
import type { DownloadedSkin } from "../types";

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

  const selectedCount = Object.keys(selection).length;

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

  const grouped = new Map<string, DownloadedSkin[]>();
  for (const skin of downloads) {
    const list = grouped.get(skin.champion_name) ?? [];
    list.push(skin);
    grouped.set(skin.champion_name, list);
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-border flex shrink-0 items-center border-b px-4 py-3">
        <span className="text-ink-muted text-sm tabular-nums select-none">
          {downloads.length} {downloads.length === 1 ? "skin" : "skins"}
        </span>
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
          {[...grouped.entries()].map(([champion, skins]) => {
            const selectedSkin = selection[champion];
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
                      {skins.length} {skins.length === 1 ? "skin" : "skins"}
                    </p>
                  </div>
                </div>

                <div className="flex min-w-0 flex-1 flex-wrap gap-2">
                  {skins.map((skin) => {
                    const isSelected = selectedSkin === skin.skin_name;
                    return (
                      <div key={skin.skin_name} className="relative">
                        <button
                          onClick={() => toggleSkin(skin.champion_name, skin.skin_name)}
                          className={[
                            "relative h-20 w-28 overflow-hidden rounded transition-all",
                            patcherActive ? "cursor-default opacity-50" : "cursor-pointer",
                            isSelected
                              ? "ring-gold-400 ring-offset-charcoal-400 ring-2 ring-offset-1"
                              : "ring-charcoal-50/20 hover:ring-charcoal-50/40 ring-1",
                          ].join(" ")}
                          title={skin.skin_name}
                        >
                          <SkinThumb championName={skin.champion_name} skinName={skin.skin_name} />

                          {isSelected && (
                            <div className="bg-gold-400 absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full border border-white/30 shadow-sm">
                              <Check size={11} strokeWidth={3} className="text-charcoal-600" />
                            </div>
                          )}

                          <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/80 via-black/40 to-transparent px-1.5 pt-4 pb-1">
                            <p className="line-clamp-3 text-[9px] leading-tight text-white/90">
                              {skin.skin_name}
                            </p>
                          </div>
                        </button>

                        {!patcherActive && (
                          <button
                            onClick={() => handleDelete(skin.champion_name, skin.skin_name)}
                            className="bg-charcoal-500 hover:bg-error text-ink-muted absolute top-1 left-1 flex h-5 w-5 cursor-pointer items-center justify-center rounded-full shadow transition-colors hover:text-white"
                            title="Delete"
                          >
                            <X size={10} strokeWidth={2.5} />
                          </button>
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
