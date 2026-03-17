import { useState, useCallback, useRef, useEffect } from "react";
import { applySkins, stopPatcher as stopPatcherCmd, getPatcherStatus } from "../lib/commands";
import type { PatcherStatus } from "../types";

export function usePatcher() {
  const [status, setStatus] = useState<PatcherStatus>("Idle");
  const [error, setError] = useState<string | null>(null);
  const polling = useRef<ReturnType<typeof setInterval> | null>(null);

  const pollStatus = useCallback(() => {
    if (polling.current) return;
    polling.current = setInterval(async () => {
      try {
        const s = await getPatcherStatus();
        setStatus(s);
        if (s === "Idle" || (typeof s === "object" && "Error" in s)) {
          if (polling.current) {
            clearInterval(polling.current);
            polling.current = null;
          }
        }
      } catch {}
    }, 500);
  }, []);

  useEffect(() => {
    return () => {
      if (polling.current) clearInterval(polling.current);
    };
  }, []);

  const apply = useCallback(
    async (zipPaths: string[]) => {
      if (zipPaths.length === 0) return;
      setError(null);
      setStatus("Importing");
      pollStatus();
      try {
        await applySkins(zipPaths);
      } catch (err) {
        setError(String(err));
        setStatus("Idle");
        if (polling.current) {
          clearInterval(polling.current);
          polling.current = null;
        }
      }
    },
    [pollStatus]
  );

  const stop = useCallback(async () => {
    try {
      await stopPatcherCmd();
      setStatus("Idle");
      setError(null);
    } catch (err) {
      setError(String(err));
    }
    if (polling.current) {
      clearInterval(polling.current);
      polling.current = null;
    }
  }, []);

  const isActive = status !== "Idle" && !(typeof status === "object" && "Error" in status);

  return { status, error, apply, stop, isActive };
}
