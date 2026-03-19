import { useState, useEffect, useCallback } from "react";
import { importCustom, listCustoms, removeCustom } from "../lib/commands";
import type { CustomMod } from "../types";

const ENABLED_KEY = "zushi_customs_enabled";

function loadEnabled(): Set<string> {
  try {
    const raw = localStorage.getItem(ENABLED_KEY);
    if (raw) return new Set(JSON.parse(raw) as string[]);
  } catch {}
  return new Set();
}

function saveEnabled(enabled: Set<string>) {
  localStorage.setItem(ENABLED_KEY, JSON.stringify([...enabled]));
}

export function useCustoms() {
  const [customs, setCustoms] = useState<CustomMod[]>([]);
  const [enabled, setEnabled] = useState<Set<string>>(loadEnabled);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const list = await listCustoms();
      const enabledSet = loadEnabled();
      setCustoms(list.map((e) => ({ ...e, enabled: enabledSet.has(e.name) })));
    } catch (e) {
      setError(String(e));
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Keep customs list in sync whenever enabled changes
  useEffect(() => {
    setCustoms((prev) => prev.map((c) => ({ ...c, enabled: enabled.has(c.name) })));
  }, [enabled]);

  const addCustom = useCallback(
    async (srcPath: string) => {
      const fileName = srcPath.split("/").pop() ?? srcPath;
      const name = fileName.replace(/\.zip$/i, "");
      setError(null);
      const entry = await importCustom(srcPath, name);
      // Auto-enable on add
      setEnabled((prev) => {
        const next = new Set(prev);
        next.add(entry.name);
        saveEnabled(next);
        return next;
      });
      await refresh();
    },
    [refresh]
  );

  const remove = useCallback(
    async (name: string) => {
      await removeCustom(name);
      setEnabled((prev) => {
        const next = new Set(prev);
        next.delete(name);
        saveEnabled(next);
        return next;
      });
      await refresh();
    },
    [refresh]
  );

  const toggle = useCallback((name: string) => {
    setEnabled((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      saveEnabled(next);
      return next;
    });
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const enabledPaths = customs.filter((c) => c.enabled).map((c) => c.file_path);
  const enabledCount = enabledPaths.length;

  return { customs, addCustom, remove, toggle, enabledPaths, enabledCount, error, clearError };
}
