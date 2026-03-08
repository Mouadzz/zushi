import { Search } from "lucide-react";
import { useChampions, championAvatar } from "../hooks/useChampions";
import type { Champion } from "../types";

interface ChampionGridProps {
  onSelect: (champion: Champion) => void;
}

export default function ChampionGrid({ onSelect }: ChampionGridProps) {
  const { champions, total, loading, error, search, setSearch } = useChampions();

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <span className="text-ink-muted text-sm">Loading champions...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2">
        <span className="text-error text-sm">Failed to load champion data</span>
        <span className="text-ink-muted text-xs">{error}</span>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-border flex shrink-0 items-center gap-3 border-b px-4 py-2.5">
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
            placeholder="Search champions..."
            className="bg-charcoal-500 border-border text-ink placeholder:text-ink-muted focus:border-gold-500/60 w-full rounded-sm border py-1.5 pr-3 pl-8 text-sm transition-colors focus:outline-none"
            spellCheck={false}
            autoComplete="off"
          />
        </div>
        <span className="text-ink-muted text-[11px] tabular-nums select-none">
          {champions.length}
          {search.trim() ? ` / ${total}` : ""}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3">
        {champions.length > 0 ? (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(72px,1fr))] gap-0.5">
            {champions.map((champ) => (
              <button
                key={champ.key}
                onClick={() => onSelect(champ)}
                className="group flex cursor-pointer flex-col items-center gap-0.5 rounded-sm p-1.5 transition-transform duration-100 active:scale-[0.96]"
                title={`${champ.name}, ${champ.title}`}
              >
                <div className="border-charcoal-50/30 group-hover:border-gold-400 bg-charcoal-500 h-14 w-14 overflow-hidden rounded-sm border transition-colors duration-150">
                  <img
                    src={championAvatar(champ.id)}
                    alt={champ.name}
                    className="h-full w-full object-cover transition-transform duration-150 group-hover:scale-105"
                    loading="lazy"
                    draggable={false}
                  />
                </div>
                <span className="text-ink-muted group-hover:text-gold-300 w-full truncate text-center text-[10px] leading-tight transition-colors select-none">
                  {champ.name}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div className="flex h-32 items-center justify-center">
            <span className="text-ink-muted text-sm">No champions found</span>
          </div>
        )}
      </div>
    </div>
  );
}
