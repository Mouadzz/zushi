import { useState, useEffect, useCallback } from "react";
import { getCached, getStale, setCache } from "../lib/cache";
import type { Champion, Skin, Chroma, SkinGroup } from "../types";

const SKIN_IDS_URL =
  "https://raw.githubusercontent.com/Alban1911/LeagueSkins/main/resources/en/skin_ids.json";
const TREE_API_URL =
  "https://api.github.com/repos/Alban1911/LeagueSkins/git/trees/main?recursive=1";
const SKINS_JSON_URL =
  "https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/skins.json";

const SKIN_IDS_CACHE_KEY = "zushi:skin_ids";
// _v2 invalidates the stale name-based cache from older builds.
const REPO_ZIPS_CACHE_KEY = "zushi:repo_files_v2";
const CHROMAS_CACHE_KEY = "zushi:chromas";

let skinIdsCache: Record<string, string> | null = null;
let repoZipsCache: Map<string, string> | null = null;
let chromaInfoCache: Map<number, { colors: string[]; parentId: number }> | null = null;

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
    })
    .catch((err) => {
      const stale = getStale<Record<string, string>>(SKIN_IDS_CACHE_KEY);
      if (stale) {
        skinIdsCache = stale;
        return stale;
      }
      throw err;
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
        if (entry.type !== "blob" || !entry.path.startsWith("skins/")) continue;
        // Paths are id-based, e.g. "skins/222/222020/222025/222025.fantome".
        // The filename stem is the skin id, matching skin_ids.json keys.
        const filename = entry.path.split("/").pop() ?? "";
        const ext = filename.endsWith(".fantome")
          ? ".fantome"
          : filename.endsWith(".zip")
            ? ".zip"
            : null;
        if (!ext) continue;
        const skinId = filename.slice(0, -ext.length);
        if (!/^\d+$/.test(skinId)) continue;
        map.set(skinId, entry.path);
      }
      repoZipsCache = map;
      setCache(REPO_ZIPS_CACHE_KEY, [...map.entries()]);
      return map;
    })
    .catch((err) => {
      const stale = getStale<[string, string][]>(REPO_ZIPS_CACHE_KEY);
      if (stale) {
        repoZipsCache = new Map(stale);
        return repoZipsCache;
      }
      throw err;
    });
}

export function ensureChromaInfo(): Promise<Map<number, { colors: string[]; parentId: number }>> {
  if (chromaInfoCache) return Promise.resolve(chromaInfoCache);

  const cached = getCached<[number, { colors: string[]; parentId: number }][]>(CHROMAS_CACHE_KEY);
  if (cached) {
    chromaInfoCache = new Map(cached);
    return Promise.resolve(chromaInfoCache);
  }

  return fetch(SKINS_JSON_URL)
    .then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    })
    .then((data: Record<string, { id: number; chromas?: { id: number; colors?: string[] }[] }>) => {
      const map = new Map<number, { colors: string[]; parentId: number }>();
      for (const [, skin] of Object.entries(data)) {
        if (!skin.chromas) continue;
        for (const c of skin.chromas) {
          map.set(c.id, { colors: c.colors ?? [], parentId: skin.id });
        }
      }
      chromaInfoCache = map;
      setCache(CHROMAS_CACHE_KEY, [...map.entries()]);
      return map;
    })
    .catch(() => {
      chromaInfoCache = new Map();
      return chromaInfoCache;
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

    // Skip chromas of the default skin (e.g. "Steel Blitzcrank") — not real,
    // applicable skins and they have no card to group under. See grouping below.
    const chromaInfo = chromaInfoCache?.get(numericId);
    if (chromaInfo && chromaInfo.parentId % 1000 === 0) continue;

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

export function getSkinsGroupedForChampion(
  champion: Champion,
  skinIds: Record<string, string>
): SkinGroup[] {
  const flat = getSkinsForChampion(champion, skinIds);
  if (!chromaInfoCache || chromaInfoCache.size === 0) {
    return flat.map((s) => ({ base: s, chromas: [] }));
  }

  const byId = new Map<number, Skin>();
  for (const s of flat) byId.set(parseInt(s.id, 10), s);

  const groups = new Map<number, SkinGroup>();
  const orphans: Chroma[] = [];

  for (const s of flat) {
    const numericId = parseInt(s.id, 10);
    const chromaInfo = chromaInfoCache.get(numericId);

    if (!chromaInfo) {
      groups.set(numericId, { base: s, chromas: [] });
      continue;
    }

    const parentSkin = byId.get(chromaInfo.parentId);
    const parentName = parentSkin?.name ?? s.name.replace(/\s+\([^)]+\)$/, "");
    const chroma: Chroma = { ...s, parentName, colors: chromaInfo.colors };

    const parentGroup = groups.get(chromaInfo.parentId);
    if (parentGroup) {
      parentGroup.chromas.push(chroma);
    } else {
      orphans.push(chroma);
    }
  }

  for (const c of orphans) {
    const info = chromaInfoCache.get(parseInt(c.id, 10));
    const g = info ? groups.get(info.parentId) : undefined;
    if (g) {
      g.chromas.push(c);
    } else {
      groups.set(parseInt(c.id, 10), { base: c, chromas: [] });
    }
  }

  const result = [...groups.values()];
  result.sort((a, b) => a.base.num - b.base.num);
  for (const g of result) g.chromas.sort((a, b) => a.num - b.num);
  return result;
}

export function lookupChromaInfo(
  skinName: string
): { colors: string[]; parentName: string } | null {
  if (!skinIdsCache || !chromaInfoCache) return null;

  let foundId: number | null = null;
  for (const [id, name] of Object.entries(skinIdsCache)) {
    if (name === skinName) {
      foundId = parseInt(id, 10);
      break;
    }
  }
  if (foundId === null) return null;

  const info = chromaInfoCache.get(foundId);
  if (!info) return null;

  const parentEntry = Object.entries(skinIdsCache).find(
    ([id]) => parseInt(id, 10) === info.parentId
  );
  const parentName = parentEntry?.[1] ?? skinName.replace(/\s+\([^)]+\)$/, "");

  return { colors: info.colors, parentName };
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

  const repoPath = repoZipsCache.get(skin.id);
  if (!repoPath) return null;

  const encoded = repoPath
    .split("/")
    .map((seg) => encodeURIComponent(seg))
    .join("/");
  return `https://raw.githubusercontent.com/Alban1911/LeagueSkins/main/${encoded}`;
}

export function isSkinAvailable(skin: Skin): boolean {
  if (!repoZipsCache) return true; // optimistic before tree loads
  return repoZipsCache.has(skin.id);
}

export function useSkinData(champion: Champion | null) {
  const [skinIds, setSkinIds] = useState<Record<string, string> | null>(skinIdsCache);
  const [skins, setSkins] = useState<Skin[]>([]);
  const [groups, setGroups] = useState<SkinGroup[]>([]);
  const [loading, setLoading] = useState(!skinIdsCache || !repoZipsCache);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (skinIdsCache && repoZipsCache) {
      setSkinIds(skinIdsCache);
      setLoading(false);
      void ensureChromaInfo();
      return;
    }

    void ensureChromaInfo();
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
      setGroups([]);
      return;
    }
    setSkins(getSkinsForChampion(champion, skinIds));
    setGroups(getSkinsGroupedForChampion(champion, skinIds));
  }, [champion, skinIds]);

  const getSkins = useCallback(
    (champ: Champion): Skin[] => {
      if (!skinIds) return [];
      return getSkinsForChampion(champ, skinIds);
    },
    [skinIds]
  );

  return { skins, groups, loading, error, getSkins };
}
