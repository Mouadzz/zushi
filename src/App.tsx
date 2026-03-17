import { useState, useEffect } from "react";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { Swords, Layers, Settings as SettingsIcon } from "lucide-react";
import { useGamePath } from "./hooks/useGamePath";
import { usePatcher } from "./hooks/usePatcher";
import { useDownloads } from "./hooks/useDownloads";
import { ensureChampions } from "./hooks/useChampions";
import { ensureSkinIds, ensureRepoZips } from "./hooks/useSkinData";
import StatusBar from "./components/StatusBar";
import GamePathSelector from "./components/GamePathSelector";
import ChampionGrid from "./components/ChampionGrid";
import ChampionDetail from "./components/ChampionDetail";
import MySkins from "./components/MySkins";
import Settings from "./components/Settings";
import Toast from "./components/Toast";
import UpdateBanner from "./components/UpdateBanner";
import { useVersionCheck } from "./hooks/useVersionCheck";
import type { Champion } from "./types";
import logo from "./assets/icon.png";

type View = "champions" | "my-skins" | "settings";

const NAV_ITEMS: { id: View; label: string; icon: typeof Swords }[] = [
  { id: "champions", label: "Champions", icon: Swords },
  { id: "my-skins", label: "My Skins", icon: Layers },
  { id: "settings", label: "Settings", icon: SettingsIcon },
];

function App() {
  const { gamePath, detectedPath, status, selectPath, confirmSetup, checkPath } = useGamePath();
  const patcher = usePatcher();
  const dl = useDownloads();
  const update = useVersionCheck();
  const [view, setView] = useState<View>("champions");
  const [selectedChampion, setSelectedChampion] = useState<Champion | null>(null);
  const [skinSelection, setSkinSelection] = useState<Record<string, string>>({});

  // Show window once webview is ready (hidden at start to avoid white flash)
  // Briefly set alwaysOnTop to force the window above other apps on macOS
  useEffect(() => {
    const win = getCurrentWebviewWindow();
    win.show();
    win.setAlwaysOnTop(true).then(() => {
      win.setFocus();
      setTimeout(() => win.setAlwaysOnTop(false), 100);
    });
  }, []);

  // Preload caches so MySkins images work without visiting Champions first
  useEffect(() => {
    ensureChampions().catch(() => {});
    ensureSkinIds().catch(() => {});
    ensureRepoZips().catch(() => {});
  }, []);

  const handleNavClick = (id: View) => {
    setView(id);
    if (id !== "champions") setSelectedChampion(null);
  };

  const renderContent = () => {
    if (view === "settings") {
      return (
        <div className="flex-1 overflow-y-auto">
          <Settings
            gamePath={gamePath}
            onPathChange={selectPath}
            patcherActive={patcher.isActive}
            onSkinsCleared={dl.refresh}
          />
        </div>
      );
    }

    if (view === "my-skins") {
      return (
        <MySkins
          downloads={dl.downloads}
          onApply={patcher.apply}
          onStop={patcher.stop}
          patcherActive={patcher.isActive}
          selection={skinSelection}
          onSelectionChange={setSkinSelection}
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
  };

  return (
    <div className="bg-charcoal-400 relative flex h-screen">
      <aside className="border-border flex w-45 shrink-0 flex-col border-r">
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

        {update.updateAvailable && update.latestVersion && (
          <UpdateBanner
            version={update.latestVersion}
            releasesUrl={update.releasesUrl}
          />
        )}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <main className="flex flex-1 flex-col overflow-hidden">{renderContent()}</main>

        <StatusBar patcherStatus={patcher.status} downloading={dl.downloading} />
      </div>

      {dl.error && <Toast message={dl.error} onClose={dl.clearError} />}

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
