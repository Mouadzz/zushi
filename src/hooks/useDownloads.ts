import { useState, useEffect, useCallback, useRef } from "react";
import { listen } from "@tauri-apps/api/event";
import {
  listDownloadedSkins,
  downloadSkin as downloadSkinCmd,
  downloadMultipleSkins,
  deleteDownloadedSkin as deleteCmd,
  getSkinsDirSize,
  clearAllSkins as clearAllCmd,
} from "../lib/commands";
import type { DownloadedSkin } from "../types";

interface QueueItem {
  url: string;
  championName: string;
  skinName: string;
}

interface DownloadProgress {
  current: number;
  total: number;
  skinName: string;
}

export function useDownloads() {
  const [downloads, setDownloads] = useState<DownloadedSkin[]>([]);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cacheSize, setCacheSize] = useState(0);
  const busy = useRef(false);

  const refreshSize = useCallback(async () => {
    try {
      const size = await getSkinsDirSize();
      setCacheSize(size);
    } catch {
      // ignore
    }
  }, []);

  const refresh = useCallback(async () => {
    try {
      const list = await listDownloadedSkins();
      setDownloads(list);
    } catch {}
    await refreshSize();
  }, [refreshSize]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const isDownloaded = useCallback(
    (championName: string, skinName: string): boolean => {
      return downloads.some((d) => d.champion_name === championName && d.skin_name === skinName);
    },
    [downloads]
  );

  const download = useCallback(
    async (url: string, championName: string, skinName: string) => {
      if (busy.current) return;
      busy.current = true;
      const key = `${championName}/${skinName}`;
      setDownloading(key);
      setError(null);
      try {
        await downloadSkinCmd(url, championName, skinName);
      } catch (err) {
        setError(String(err));
      }
      setDownloading(null);
      busy.current = false;
      await refresh();
    },
    [refresh]
  );

  const downloadMultiple = useCallback(
    async (items: QueueItem[]) => {
      if (busy.current || items.length === 0) return;
      busy.current = true;
      setDownloading("batch");
      setError(null);

      const unlisten = await listen<DownloadProgress>("download-progress", (event) => {
        setDownloading(
          `${event.payload.skinName} (${event.payload.current}/${event.payload.total})`
        );
      });

      try {
        await downloadMultipleSkins(items);
      } catch (err) {
        setError(String(err));
      }

      unlisten();
      setDownloading(null);
      busy.current = false;
      await refresh();
    },
    [refresh]
  );

  const deleteSkin = useCallback(
    async (championName: string, skinName: string) => {
      setError(null);
      try {
        await deleteCmd(championName, skinName);
        await refresh();
      } catch (err) {
        setError(String(err));
      }
    },
    [refresh]
  );

  const clearAll = useCallback(async () => {
    setError(null);
    try {
      await clearAllCmd();
      await refresh();
    } catch (err) {
      setError(String(err));
    }
  }, [refresh]);

  const clearError = useCallback(() => setError(null), []);

  return {
    downloads,
    downloading,
    error,
    cacheSize,
    isDownloaded,
    download,
    downloadMultiple,
    deleteSkin,
    clearAll,
    clearError,
    refresh,
  };
}
