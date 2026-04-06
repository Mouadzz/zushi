import { useState, useEffect, useCallback } from "react";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { open } from "@tauri-apps/plugin-dialog";
import { Upload, X, Check, FileArchive, Package } from "lucide-react";
import type { CustomMod } from "../types";

interface CustomsProps {
  customs: CustomMod[];
  onAdd: (path: string) => Promise<void>;
  onRemove: (name: string) => Promise<void>;
  onToggle: (name: string) => void;
}

export default function Customs({ customs, onAdd, onRemove, onToggle }: CustomsProps) {
  const [draggingOver, setDraggingOver] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAdd = useCallback(
    async (path: string) => {
      const fileName = path.split("/").pop() ?? path;
      setAdding(fileName);
      setError(null);
      try {
        await onAdd(path);
      } catch (e) {
        setError(String(e));
      } finally {
        setAdding(null);
      }
    },
    [onAdd]
  );

  useEffect(() => {
    let unlisten: (() => void) | null = null;

    getCurrentWebviewWindow()
      .onDragDropEvent((event) => {
        const { type } = event.payload;
        if (type === "drop") {
          setDraggingOver(false);
          const paths = (event.payload as { type: "drop"; paths: string[] }).paths;
          const zips = paths.filter((p) => {
            const lower = p.toLowerCase();
            return lower.endsWith(".zip") || lower.endsWith(".fantome");
          });
          zips.forEach(handleAdd);
        } else if (type === "leave") {
          setDraggingOver(false);
        } else {
          setDraggingOver(true);
        }
      })
      .then((fn) => {
        unlisten = fn;
      });

    return () => {
      unlisten?.();
    };
  }, [handleAdd]);

  async function handleBrowse() {
    const selected = await open({
      multiple: true,
      filters: [{ name: "Mod", extensions: ["zip", "fantome"] }],
    });
    if (!selected) return;
    const paths = Array.isArray(selected) ? selected : [selected];
    for (const p of paths) handleAdd(p);
  }

  const activeCount = customs.filter((c) => c.enabled).length;

  return (
    <div className="flex h-full flex-col">
      <div className="border-border flex shrink-0 items-center border-b px-4 py-3">
        <span className="text-ink-muted text-sm tabular-nums select-none">
          {customs.length} {customs.length === 1 ? "custom" : "customs"}
          {activeCount > 0 && (
            <span className="text-gold-400 ml-1.5 font-medium">{activeCount} active</span>
          )}
        </span>
      </div>

      <div
        onClick={handleBrowse}
        className={[
          "border-border mx-4 mt-4 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-5 transition-all",
          draggingOver
            ? "border-gold-400 bg-gold-400/10"
            : "hover:border-charcoal-50/30 hover:bg-charcoal-300/30",
        ].join(" ")}
      >
        <Upload
          size={18}
          strokeWidth={1.5}
          className={draggingOver ? "text-gold-400" : "text-ink-muted"}
        />
        <p
          className={`text-sm font-medium ${draggingOver ? "text-gold-400" : "text-ink-secondary"}`}
        >
          {adding ? `Adding ${adding}...` : "Drop mods here"}
        </p>
        <p className="text-ink-muted text-xs">or click to browse</p>
      </div>

      {error && (
        <div className="bg-error/10 text-error mx-4 mt-2 rounded-md px-3 py-2 text-xs">{error}</div>
      )}

      {customs.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
          <div className="bg-charcoal-300 flex h-12 w-12 items-center justify-center rounded-full">
            <Package size={20} strokeWidth={1.5} className="text-ink-muted" />
          </div>
          <p className="text-ink-secondary text-sm">No custom mods yet</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-4">
          <div className="flex flex-wrap gap-4">
            {customs.map((custom) => (
              <div key={custom.name} className="relative">
                <button
                  onClick={() => onToggle(custom.name)}
                  className={[
                    "relative h-24 w-36 cursor-pointer overflow-hidden rounded transition-all",
                    custom.enabled
                      ? "ring-gold-400 ring-offset-charcoal-400 ring-2 ring-offset-1"
                      : "ring-charcoal-50/20 hover:ring-charcoal-50/40 ring-1",
                  ].join(" ")}
                  title={custom.name}
                >
                  <div className="bg-charcoal-300 absolute inset-0" />

                  <div className="absolute inset-0 flex items-center justify-center pb-4">
                    <FileArchive
                      size={34}
                      strokeWidth={1}
                      className={custom.enabled ? "text-gold-400/70" : "text-ink-muted/40"}
                    />
                  </div>

                  {custom.enabled && (
                    <div className="bg-gold-400 absolute top-1.5 right-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-white/30 shadow-sm">
                      <Check size={11} strokeWidth={3} className="text-charcoal-600" />
                    </div>
                  )}

                  <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/40 via-black/15 to-transparent px-2 pt-5 pb-1.5">
                    <p className="line-clamp-2 text-[11px] leading-tight text-white/90">
                      {custom.name}
                    </p>
                  </div>
                </button>

                <button
                  onClick={() => onRemove(custom.name)}
                  className="bg-charcoal-500 hover:bg-error text-ink-muted absolute top-1.5 left-1.5 flex h-5 w-5 cursor-pointer items-center justify-center rounded-full shadow transition-colors hover:text-white"
                  title="Remove"
                >
                  <X size={10} strokeWidth={2.5} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
