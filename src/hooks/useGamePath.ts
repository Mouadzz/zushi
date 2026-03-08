import { useState, useEffect, useCallback } from "react";
import { detectGamePath, setGamePath, validateGamePath } from "../lib/commands";
import type { AppStatus } from "../types";

const SETUP_KEY = "zushi:setup_complete";

export function useGamePath() {
  const [gamePath, setGamePathState] = useState<string | null>(null);
  const [detectedPath, setDetectedPath] = useState<string | null>(null);
  const [status, setStatus] = useState<AppStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const setupDone = localStorage.getItem(SETUP_KEY) === "true";

    detectGamePath()
      .then((path) => {
        if (path) {
          setDetectedPath(path);
          if (setupDone) {
            setGamePathState(path);
            setStatus("game-detected");
          } else {
            setStatus("setup");
          }
        } else {
          setStatus(setupDone ? "game-not-found" : "setup");
        }
      })
      .catch((err) => {
        setStatus(setupDone ? "error" : "setup");
        setError(String(err));
      });
  }, []);

  const confirmSetup = useCallback(async (path: string): Promise<boolean> => {
    const validated = await validateGamePath(path);
    if (validated) {
      await setGamePath(validated);
      setGamePathState(validated);
      setStatus("game-detected");
      setError(null);
      localStorage.setItem(SETUP_KEY, "true");
      return true;
    }
    return false;
  }, []);

  const selectPath = useCallback(async (path: string): Promise<boolean> => {
    const validated = await validateGamePath(path);
    if (validated) {
      await setGamePath(validated);
      setGamePathState(validated);
      setStatus("game-detected");
      setError(null);
      return true;
    }
    return false;
  }, []);

  const checkPath = useCallback(async (path: string): Promise<string | null> => {
    return validateGamePath(path);
  }, []);

  return { gamePath, detectedPath, status, error, selectPath, confirmSetup, checkPath };
}
