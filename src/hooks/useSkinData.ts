import { useState, useEffect, useCallback } from "react";
import { getCached, setCache } from "../lib/cache";
import type { Champion, Skin } from "../types";

const SKIN_IDS_URL =
  "https://raw.githubusercontent.com/Alban1911/LeagueSkins/main/resources/en/skin_ids.json";
const TREE_API_URL =
  "https://api.github.com/repos/Alban1911/LeagueSkins/git/trees/main?recursive=1";

const SKIN_IDS_CACHE_KEY = "zushi:skin_ids";
const REPO_ZIPS_CACHE_KEY = "zushi:repo_zips";

// Module-level caches
let skinIdsCache: Record<string, string> | null = null;
let repoZipsCache: Map<string, string> | null = null;

export function ensureSkinIds(): Promise<Record<string, string>> {
  if (skinIdsCache) return Promise.resolve(skinIdsCache);

  const cached = getCached<Record<string, string>>(SKIN_IDS_CACHE_KEY);
  if (cached) {
    skinIdsCache = cached;
    return Promise.resolve(cached);
  }

  return fetch(SKIN_IDS_URL)
    .then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    })
    .then((data: Record<string, string>) => {
      skinIdsCache = data;
      setCache(SKIN_IDS_CACHE_KEY, data);
      return data;
    });
}

export function ensureRepoZips(): Promise<Map<string, string>> {
  if (repoZipsCache) return Promise.resolve(repoZipsCache);

  const cached = getCached<[string, string][]>(REPO_ZIPS_CACHE_KEY);
  if (cached) {
    repoZipsCache = new Map(cached);
    return Promise.resolve(repoZipsCache);
  }

  return fetch(TREE_API_URL)
    .then((res) => {
      if (!res.ok) throw new Error(`GitHub API ${res.status}`);
      return res.json();
    })
    .then((data: { tree: { path: string; type: string }[] }) => {
      const map = new Map<string, string>();
      for (const entry of data.tree) {
        if (
          entry.type === "blob" &&
          entry.path.startsWith("skins/") &&
          entry.path.endsWith(".zip")
        ) {
          // e.g. "skins/Akali/Headhunter Akali/Headhunter Akali.zip"
          const parts = entry.path.split("/");
          const filename = parts[parts.length - 1].replace(/\.zip$/, "");
          const champion = parts[1];
          map.set(`${champion}/${filename}`, entry.path);
        }
      }
      repoZipsCache = map;
      setCache(REPO_ZIPS_CACHE_KEY, [...map.entries()]);
      return map;
    });
}

export function getSkinsForChampion(champion: Champion, skinIds: Record<string, string>): Skin[] {
  const champKey = parseInt(champion.key, 10);
  const baseId = String(champKey * 1000);
  const championRepoName = skinIds[baseId] ?? champion.name;

  const skins: Skin[] = [];
  for (const [id, name] of Object.entries(skinIds)) {
    const numericId = parseInt(id, 10);
    const ownerKey = Math.floor(numericId / 1000);
    if (ownerKey !== champKey) continue;

    const num = numericId % 1000;
    if (num === 0) continue;

    skins.push({
      id,
      num,
      name,
      championId: champion.id,
      championName: championRepoName,
    });
  }

  skins.sort((a, b) => a.num - b.num);
  return skins;
}

/**
 * For a Skin object, return the splash num to use for DDragon images.
 * Chromas don't have their own splash on DDragon - we resolve to the base skin's num.
 */
export function getSplashNum(skin: Skin): number {
  if (!skinIdsCache) return skin.num;

  const match = skin.name.match(/^(.+?)\s+\([^)]+\)$/);
  if (!match) return skin.num;

  const baseName = match[1];
  const champKey = Math.floor(parseInt(skin.id, 10) / 1000);

  for (const [id, name] of Object.entries(skinIdsCache)) {
    if (name === baseName && Math.floor(parseInt(id, 10) / 1000) === champKey) {
      return parseInt(id, 10) % 1000;
    }
  }

  return skin.num;
}

/**
 * For a skin name string, look up the splash num to use for DDragon images.
 * Resolves chromas to their base skin's splash num.
 */
export function lookupSplashNum(skinName: string): number | null {
  if (!skinIdsCache) return null;

  let foundId: string | null = null;
  for (const [id, name] of Object.entries(skinIdsCache)) {
    if (name === skinName) {
      foundId = id;
      break;
    }
  }
  if (!foundId) return null;

  const champKey = Math.floor(parseInt(foundId, 10) / 1000);
  const skinNum = parseInt(foundId, 10) % 1000;

  // Check if this is a chroma: "BaseName (Variant)"
  const match = skinName.match(/^(.+?)\s+\([^)]+\)$/);
  if (match) {
    const baseName = match[1];
    for (const [id, name] of Object.entries(skinIdsCache)) {
      if (name === baseName && Math.floor(parseInt(id, 10) / 1000) === champKey) {
        return parseInt(id, 10) % 1000;
      }
    }
  }

  return skinNum;
}

/**
 * Returns the exact download URL for a skin by looking up the repo tree.
 * Returns null if the skin doesn't exist in the repo.
 */
export function skinDownloadUrl(skin: Skin): string | null {
  if (!repoZipsCache) return null;

  const key = `${skin.championName}/${skin.name}`;
  const repoPath = repoZipsCache.get(key);
  if (!repoPath) return null;

  const encoded = repoPath
    .split("/")
    .map((seg) => encodeURIComponent(seg))
    .join("/");
  return `https://raw.githubusercontent.com/Alban1911/LeagueSkins/main/${encoded}`;
}

export function isSkinAvailable(skin: Skin): boolean {
  if (!repoZipsCache) return true; // optimistic before tree loads
  const key = `${skin.championName}/${skin.name}`;
  return repoZipsCache.has(key);
}

export function useSkinData(champion: Champion | null) {
  const [skinIds, setSkinIds] = useState<Record<string, string> | null>(skinIdsCache);
  const [skins, setSkins] = useState<Skin[]>([]);
  const [loading, setLoading] = useState(!skinIdsCache || !repoZipsCache);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (skinIdsCache && repoZipsCache) {
      setSkinIds(skinIdsCache);
      setLoading(false);
      return;
    }

    Promise.all([ensureSkinIds(), ensureRepoZips()])
      .then(([ids]) => {
        setSkinIds(ids);
      })
      .catch((err) => setError(String(err)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!champion || !skinIds) {
      setSkins([]);
      return;
    }
    setSkins(getSkinsForChampion(champion, skinIds));
  }, [champion, skinIds]);

  const getSkins = useCallback(
    (champ: Champion): Skin[] => {
      if (!skinIds) return [];
      return getSkinsForChampion(champ, skinIds);
    },
    [skinIds]
  );

  return { skins, loading, error, getSkins };
}
