import { useState, useEffect, useCallback } from "react";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { getVersion } from "@tauri-apps/api/app";
import { invoke } from "@tauri-apps/api/core";
import { Swords, Layers, Package, Settings as SettingsIcon, Star } from "lucide-react";
import { useGamePath } from "./hooks/useGamePath";
import { usePatcher } from "./hooks/usePatcher";
import { useDownloads } from "./hooks/useDownloads";
import { useCustoms } from "./hooks/useCustoms";
import { ensureChampions } from "./hooks/useChampions";
import { ensureSkinIds, ensureRepoZips, ensureChromaInfo } from "./hooks/useSkinData";
import { useVersionCheck } from "./hooks/useVersionCheck";
import StatusBar from "./components/StatusBar";
import GamePathSelector from "./components/GamePathSelector";
import ChampionGrid from "./components/ChampionGrid";
import ChampionDetail from "./components/ChampionDetail";
import MySkins from "./components/MySkins";
import Customs from "./components/Customs";
import Settings from "./components/Settings";
import Toast from "./components/Toast";
import UpdateBanner from "./components/UpdateBanner";
import type { Champion } from "./types";
import logo from "./assets/icon.png";

type View = "champions" | "my-skins" | "customs" | "settings";

const NAV_ITEMS: { id: View; label: string; icon: typeof Swords }[] = [
  { id: "champions", label: "Champions", icon: Swords },
  { id: "my-skins", label: "My Skins", icon: Layers },
  { id: "customs", label: "Customs", icon: Package },
  { id: "settings", label: "Settings", icon: SettingsIcon },
];

function App() {
  const { gamePath, detectedPath, status, selectPath, confirmSetup, checkPath } = useGamePath();
  const patcher = usePatcher();
  const dl = useDownloads();
  const customs = useCustoms();
  const update = useVersionCheck();
  const [view, setView] = useState<View>("champions");
  const [selectedChampion, setSelectedChampion] = useState<Champion | null>(null);
  const [skinSelection, setSkinSelection] = useState<Record<string, string>>(() => {
    try {
      const raw = localStorage.getItem("zushi_skin_selection");
      if (raw) return JSON.parse(raw) as Record<string, string>;
    } catch {}
    return {};
  });
  const [appVersion, setAppVersion] = useState("");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    getVersion()
      .then(setAppVersion)
      .catch(() => {});
  }, []);

  // Show window once webview is ready
  useEffect(() => {
    const win = getCurrentWebviewWindow();
    win.show();
    win.setAlwaysOnTop(true).then(() => {
      win.setFocus();
      setTimeout(() => win.setAlwaysOnTop(false), 100);
    });
  }, []);

  // Preload caches
  useEffect(() => {
    ensureChampions().catch(() => {});
    ensureSkinIds().catch(() => {});
    ensureRepoZips().catch(() => {});
    ensureChromaInfo().catch(() => {});
  }, []);

  // Surface patcher errors as toast
  useEffect(() => {
    if (patcher.error) setToastMessage(patcher.error);
  }, [patcher.error]);

  // Surface customs errors as toast
  useEffect(() => {
    if (customs.error) setToastMessage(customs.error);
  }, [customs.error]);

  function handleNavClick(id: View): void {
    setView(id);
    if (id !== "champions") setSelectedChampion(null);
  }

  const handleApply = useCallback(() => {
    const skinPaths: string[] = [];
    for (const [championName, skinName] of Object.entries(skinSelection)) {
      const skin = dl.downloads.find(
        (d) => d.champion_name === championName && d.skin_name === skinName
      );
      if (skin) skinPaths.push(skin.zip_path);
    }
    const allPaths = [...skinPaths, ...customs.enabledPaths];
    if (allPaths.length > 0) patcher.apply(allPaths);
  }, [skinSelection, dl.downloads, customs.enabledPaths, patcher]);

  useEffect(() => {
    localStorage.setItem("zushi_skin_selection", JSON.stringify(skinSelection));
  }, [skinSelection]);

  const skinCount = Object.keys(skinSelection).length;

  function renderContent() {
    if (view === "settings") {
      return (
        <div className="flex-1 overflow-y-auto">
          <Settings
            gamePath={gamePath}
            onPathChange={selectPath}
            patcherActive={patcher.isActive}
            onSkinsCleared={async () => {
              setSkinSelection({});
              await dl.refresh();
            }}
            onCustomsCleared={customs.refresh}
          />
        </div>
      );
    }

    if (view === "customs") {
      return (
        <Customs
          customs={customs.customs}
          onAdd={customs.addCustom}
          onRemove={customs.remove}
          onToggle={customs.toggle}
        />
      );
    }

    if (view === "my-skins") {
      return (
        <MySkins
          downloads={dl.downloads}
          patcherActive={patcher.isActive}
          selection={skinSelection}
          onSelectionChange={setSkinSelection}
          onDelete={dl.deleteSkin}
        />
      );
    }

    if (selectedChampion) {
      return (
        <ChampionDetail
          champion={selectedChampion}
          onBack={() => setSelectedChampion(null)}
          isDownloaded={dl.isDownloaded}
          downloading={dl.downloading}
          onDownload={dl.download}
          onDownloadAll={dl.downloadMultiple}
        />
      );
    }

    return <ChampionGrid onSelect={setSelectedChampion} />;
  }

  return (
    <div className="bg-charcoal-400 relative flex h-screen">
      <aside className="border-border flex w-50 shrink-0 flex-col border-r">
        <div className="flex items-end gap-2.5 px-4 py-4 select-none">
          <img src={logo} alt="Zushi" className="h-9 w-9" />
          <span className="font-logo text-gold-400 text-4xl leading-6 uppercase">Zushi</span>
        </div>

        <div className="border-border mx-3 border-b" />

        <nav className="flex flex-col gap-1 p-3 select-none">
          {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
            const active = view === id;
            return (
              <button
                key={id}
                onClick={() => handleNavClick(id)}
                className={[
                  "flex cursor-pointer items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-charcoal-200 text-gold-400"
                    : "text-ink-muted hover:text-ink hover:bg-charcoal-300",
                ].join(" ")}
              >
                <Icon size={16} strokeWidth={1.5} />
                {label}
              </button>
            );
          })}
        </nav>

        <div className="mt-auto">
          <button
            onClick={() =>
              invoke("open_url", { url: "https://github.com/Mouadzz/zushi" }).catch(() => {})
            }
            className="text-ink-muted hover:text-gold-400 mx-2 mb-2 flex cursor-pointer items-center gap-1.5 rounded-md px-3 py-2 text-sm transition-colors"
          >
            <Star
              size={16}
              strokeWidth={1.5}
              fill="currentColor"
              className="text-gold-400 shrink-0"
            />
            <span className="whitespace-nowrap">Star Zushi on GitHub</span>
          </button>

          {update.updateAvailable && update.latestVersion ? (
            <UpdateBanner version={update.latestVersion} releasesUrl={update.releasesUrl} />
          ) : (
            <div className="px-4 pb-4 select-none">
              <span className="text-ink-muted text-xs">{appVersion ? `v${appVersion}` : ""}</span>
            </div>
          )}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <main className="flex flex-1 flex-col overflow-hidden">{renderContent()}</main>

        <StatusBar
          patcherStatus={patcher.status}
          downloading={dl.downloading}
          skinCount={skinCount}
          customCount={customs.enabledCount}
          onApply={handleApply}
          onStop={patcher.stop}
        />
      </div>

      {(toastMessage || dl.error) && (
        <Toast
          key={toastMessage ?? dl.error ?? ""}
          message={toastMessage ?? dl.error ?? ""}
          onClose={() => {
            setToastMessage(null);
            dl.clearError();
            customs.clearError();
          }}
        />
      )}

      {status !== "game-detected" && (
        <div className="bg-charcoal-400 absolute inset-0 z-50">
          <GamePathSelector
            onConfirm={confirmSetup}
            onSelect={selectPath}
            onCheck={checkPath}
            detectedPath={detectedPath}
            status={status}
          />
        </div>
      )}
    </div>
  );
}

export default App;
