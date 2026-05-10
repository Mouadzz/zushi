import { useState, useEffect, useCallback } from "react";
import { getCached, setCache } from "../lib/cache";
import type { Champion, Skin, Chroma, SkinGroup } from "../types";

const SKIN_IDS_URL =
  "https://raw.githubusercontent.com/Alban1911/LeagueSkins/main/resources/en/skin_ids.json";
const TREE_API_URL =
  "https://api.github.com/repos/Alban1911/LeagueSkins/git/trees/main?recursive=1";
// Community Dragon: single JSON with every skin's id/name/chromas[] (with hex
// colors). Used for chroma classification and color swatches; the LeagueSkins
// repo provides the actual zips.
const SKINS_JSON_URL =
  "https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/skins.json";

const SKIN_IDS_CACHE_KEY = "zushi:skin_ids";
const REPO_ZIPS_CACHE_KEY = "zushi:repo_zips";
const CHROMAS_CACHE_KEY = "zushi:chromas";

// Module-level caches
let skinIdsCache: Record<string, string> | null = null;
let repoZipsCache: Map<string, string> | null = null;
// chromaInfoCache maps numeric chroma id (e.g. 266008) to its color list and
// the numeric id of its parent base skin. If null after fetch, chromas just
// render without colors — UI degrades gracefully.
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

// Fetches Community Dragon's skins.json (all skins indexed by id, with each
// base skin's chromas array). Builds a map keyed by chroma id → {colors, parentId}.
// This is best-effort: if the fetch fails, chroma swatches just won't show colors.
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
      // Degrade silently — return an empty map so the rest of the app keeps working.
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
 * Group a champion's flat skin list into base skins each carrying their
 * chromas. A skin is classified as a chroma iff its numeric id appears in
 * Community Dragon's chroma map (chromaInfoCache); the regex-on-name approach
 * was unreliable because some legitimate skin names contain parentheses.
 *
 * If chroma info hasn't loaded yet (or failed), every skin becomes its own
 * group with empty chromas — UI just shows the flat layout.
 */
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
  const orphans: Chroma[] = []; // chromas whose parent isn't in skin_ids (rare)

  for (const s of flat) {
    const numericId = parseInt(s.id, 10);
    const chromaInfo = chromaInfoCache.get(numericId);

    if (!chromaInfo) {
      // Base skin — give it an empty group; chromas attach below.
      groups.set(numericId, { base: s, chromas: [] });
      continue;
    }

    // Chroma — find/create its parent's group and attach.
    const parentSkin = byId.get(chromaInfo.parentId);
    const parentName = parentSkin?.name ?? s.name.replace(/\s+\([^)]+\)$/, "");
    const chroma: Chroma = { ...s, parentName, colors: chromaInfo.colors };

    const parentGroup = groups.get(chromaInfo.parentId);
    if (parentGroup) {
      parentGroup.chromas.push(chroma);
    } else {
      // Parent not iterated yet (or missing) — defer.
      orphans.push(chroma);
    }
  }

  // Re-attach any chromas whose parent appeared after them, or surface as
  // standalone if the parent really doesn't exist in this champion's set.
  for (const c of orphans) {
    const numericParentId = parseInt(c.id, 10) - (parseInt(c.id, 10) % 1000); // not actually right; use chromaInfo
    void numericParentId;
    const info = chromaInfoCache.get(parseInt(c.id, 10));
    const g = info ? groups.get(info.parentId) : undefined;
    if (g) {
      g.chromas.push(c);
    } else {
      // Parent base skin missing from skin_ids — treat as standalone so it stays usable.
      groups.set(parseInt(c.id, 10), { base: c, chromas: [] });
    }
  }

  // Sort: groups by base skin num, chromas inside by their own num.
  const result = [...groups.values()];
  result.sort((a, b) => a.base.num - b.base.num);
  for (const g of result) g.chromas.sort((a, b) => a.num - b.num);
  return result;
}

/**
 * Look up chroma metadata by skin name (e.g. "Battle Academia Briar (Pearl)").
 * Returns null if the name isn't a known chroma OR if chroma data hasn't loaded
 * yet. MySkins uses this to decide whether a downloaded entry is a chroma and
 * what color/parent to render it under.
 */
export function lookupChromaInfo(
  skinName: string
): { colors: string[]; parentName: string } | null {
  if (!skinIdsCache || !chromaInfoCache) return null;

  // Find the numeric id for this skin name (downloads only carry the name).
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

  // Resolve parent's display name from skin_ids (falls back to stripping the
  // "(Variant)" suffix if the parent id somehow isn't there).
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
  const [groups, setGroups] = useState<SkinGroup[]>([]);
  const [loading, setLoading] = useState(!skinIdsCache || !repoZipsCache);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (skinIdsCache && repoZipsCache) {
      setSkinIds(skinIdsCache);
      setLoading(false);
      // Chroma info loads in background — non-blocking. If it lands later,
      // the next champion render picks it up.
      void ensureChromaInfo();
      return;
    }

    // Chroma info is best-effort: we don't block initial loading on it.
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
