import { useState, useEffect, useCallback } from "react";
import { getVersion } from "@tauri-apps/api/app";
import { checkForUpdate, installUpdate } from "../lib/commands";

const GITHUB_REPO = "Mouadzz/zushi";
const RELEASES_URL = `https://github.com/${GITHUB_REPO}/releases`;
const API_URL = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;

function compareVersions(current: string, latest: string): number {
  const a = current.split(".").map(Number);
  const b = latest.split(".").map(Number);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const diff = (b[i] ?? 0) - (a[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

// Used when the signed update feed can't be read (offline, or a release without latest.json):
// we can still tell the user a new version exists and link to the download.
async function latestReleaseVersion(): Promise<string | null> {
  const currentVersion = await getVersion();
  const res = await fetch(API_URL);
  if (!res.ok) return null;
  const data = await res.json();
  const tagName: string = data.tag_name ?? "";
  // Tag format: "v0.1.0-85" → extract "0.1.0"
  const remote = tagName.replace(/^v/, "").split("-")[0];
  return remote && compareVersions(currentVersion, remote) > 0 ? remote : null;
}

export function useVersionCheck() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [latestVersion, setLatestVersion] = useState<string | null>(null);
  const [canInstall, setCanInstall] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const update = await checkForUpdate();
        if (update) {
          setLatestVersion(update.version);
          setCanInstall(true);
          setUpdateAvailable(true);
        }
        return;
      } catch {
        // fall back to the releases API below
      }
      try {
        const remote = await latestReleaseVersion();
        if (remote) {
          setLatestVersion(remote);
          setUpdateAvailable(true);
        }
      } catch {
        // silently ignore
      }
    })();
  }, []);

  // On success the app relaunches into the new version, so this only returns on failure.
  const install = useCallback(async () => {
    setInstalling(true);
    setError(null);
    try {
      await installUpdate();
    } catch (e) {
      setError(String(e));
      setCanInstall(false);
    } finally {
      setInstalling(false);
    }
  }, []);

  return { updateAvailable, latestVersion, releasesUrl: RELEASES_URL, canInstall, installing, error, install };
}
