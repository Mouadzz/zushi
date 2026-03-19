import { useState, useEffect } from "react";
import { getVersion } from "@tauri-apps/api/app";

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

export function useVersionCheck() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [latestVersion, setLatestVersion] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const currentVersion = await getVersion();
        const res = await fetch(API_URL);
        if (!res.ok) return;
        const data = await res.json();
        const tagName: string = data.tag_name ?? "";
        // Tag format: "v0.1.0-85" → extract "0.1.0"
        const remote = tagName.replace(/^v/, "").split("-")[0];
        if (remote && compareVersions(currentVersion, remote) > 0) {
          setLatestVersion(remote);
          setUpdateAvailable(true);
        }
      } catch {
        // silently ignore
      }
    })();
  }, []);

  return { updateAvailable, latestVersion, releasesUrl: RELEASES_URL };
}
