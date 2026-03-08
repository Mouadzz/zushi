import { useState, useEffect } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { FolderOpen, Check, AlertCircle, Loader2 } from "lucide-react";
import type { AppStatus } from "../types";
import logo from "../assets/icon.png";
import Toast from "./Toast";

interface GamePathSelectorProps {
  onConfirm: (path: string) => Promise<boolean>;
  onSelect: (path: string) => Promise<boolean>;
  onCheck: (path: string) => Promise<string | null>;
  detectedPath: string | null;
  status: AppStatus;
}

export default function GamePathSelector({
  onConfirm,
  onSelect,
  onCheck,
  detectedPath,
  status,
}: GamePathSelectorProps) {
  const [validatedPath, setValidatedPath] = useState<string | null>(detectedPath);
  const [displayPath, setDisplayPath] = useState<string | null>(detectedPath);
  const [pathValid, setPathValid] = useState<boolean | null>(detectedPath ? true : null);
  const [loading, setLoading] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  useEffect(() => {
    if (detectedPath) {
      setDisplayPath(detectedPath);
      setValidatedPath(detectedPath);
      setPathValid(true);
    }
  }, [detectedPath]);

  const isSetup = status === "setup";

  const handleBrowse = async () => {
    setLoading(true);
    setToastMsg(null);
    try {
      const selected = await open({
        multiple: false,
        title: "Select your League of Legends game path",
      });

      if (selected) {
        const path = selected as string;
        setDisplayPath(path);
        const resolved = await onCheck(path);
        if (resolved) {
          setValidatedPath(resolved);
          setPathValid(true);
        } else {
          setValidatedPath(null);
          setPathValid(false);
          setToastMsg("Invalid game path: LeagueofLegends.app not found");
        }
      }
    } catch {
      setToastMsg("Failed to open file dialog.");
    } finally {
      setLoading(false);
    }
  };

  const handleContinue = async () => {
    if (!validatedPath) return;
    setLoading(true);
    try {
      const handler = isSetup ? onConfirm : onSelect;
      const valid = await handler(validatedPath);
      if (!valid) {
        setPathValid(false);
        setToastMsg("Invalid game path: LeagueofLegends.app not found");
      }
    } catch {
      setToastMsg("Something went wrong while validating the path.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-full items-center justify-center">
      <div className="flex max-w-md flex-col items-center gap-6 px-6 text-center">
        <img src={logo} alt="Zushi" className="h-14 w-14" />

        <div>
          <h1 className="text-ink text-lg font-medium">
            {isSetup ? "Welcome to Zushi" : "League of Legends not found"}
          </h1>
          <p className="text-ink-secondary mt-1.5 text-sm leading-relaxed">
            {isSetup && detectedPath
              ? "We detected your League of Legends installation."
              : "Select your League of Legends game path to get started."}
          </p>
        </div>

        {displayPath && (
          <div
            className={[
              "flex w-full items-center gap-3 rounded-lg border px-4 py-3",
              pathValid === false
                ? "border-error/40 bg-error/5"
                : pathValid === true
                  ? "border-success/40 bg-success/5"
                  : "border-border bg-charcoal-500",
            ].join(" ")}
          >
            <FolderOpen
              size={16}
              strokeWidth={1.5}
              className={
                pathValid === false
                  ? "text-error shrink-0"
                  : pathValid === true
                    ? "text-success shrink-0"
                    : "text-ink-muted shrink-0"
              }
            />
            <span className="text-ink-secondary flex-1 truncate text-left font-mono text-xs">
              {displayPath}
            </span>
            {pathValid === true && (
              <Check size={16} strokeWidth={2.5} className="text-success shrink-0" />
            )}
            {pathValid === false && (
              <AlertCircle size={16} strokeWidth={2} className="text-error shrink-0" />
            )}
          </div>
        )}

        <div className="flex w-full flex-col items-center gap-2.5">
          {displayPath && pathValid === true && (
            <button
              onClick={handleContinue}
              disabled={loading}
              className="bg-gold-400 text-charcoal-600 hover:bg-gold-300 w-full cursor-pointer rounded-md px-5 py-2.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 size={14} className="animate-spin" />
                  Validating...
                </span>
              ) : (
                "Continue"
              )}
            </button>
          )}

          <button
            onClick={handleBrowse}
            disabled={loading}
            className={[
              "cursor-pointer rounded-md px-5 py-2 text-sm transition-colors",
              "disabled:cursor-not-allowed disabled:opacity-50",
              displayPath && pathValid === true
                ? "text-ink-secondary hover:text-ink"
                : "border-gold-400 text-gold-400 hover:bg-gold-400/10 w-full border py-2.5",
            ].join(" ")}
          >
            {loading && !(displayPath && pathValid === true)
              ? "Validating..."
              : displayPath && pathValid === true
                ? "Wrong path? Change it"
                : pathValid === false
                  ? "Select another path"
                  : "Browse..."}
          </button>
        </div>
      </div>

      {toastMsg && <Toast message={toastMsg} onClose={() => setToastMsg(null)} />}
    </div>
  );
}
