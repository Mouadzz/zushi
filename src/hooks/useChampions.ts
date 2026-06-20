import { useState, useEffect, useMemo } from "react";
import type { Champion } from "../types";
import { getCached, setCache } from "../lib/cache";

// Fallback when the version lookup fails; updated to the live latest at runtime.
const FALLBACK_VERSION = "16.12.1";
const VERSIONS_URL = "https://ddragon.leagueoflegends.com/api/versions.json";

const CACHE_KEY = "zushi:champions_v2";
const VERSION_CACHE_KEY = "zushi:ddragon_version";

let ddragonVersion = FALLBACK_VERSION;
let versionResolved: Promise<string> | null = null;

// Module-level cache so data survives component re-mounts
let championsCache: Champion[] | null = null;

function ensureVersion(): Promise<string> {
  if (versionResolved) return versionResolved;

  const cached = getCached<string>(VERSION_CACHE_KEY);
  if (cached) {
    ddragonVersion = cached;
    versionResolved = Promise.resolve(cached);
    return versionResolved;
  }

  versionResolved = fetch(VERSIONS_URL)
    .then((res) => (res.ok ? res.json() : Promise.reject()))
    .then((versions: string[]) => {
      if (versions[0]) ddragonVersion = versions[0];
      setCache(VERSION_CACHE_KEY, ddragonVersion);
      return ddragonVersion;
    })
    .catch(() => ddragonVersion);
  return versionResolved;
}

export function championAvatar(id: string): string {
  return `https://ddragon.leagueoflegends.com/cdn/${ddragonVersion}/img/champion/${id}.png`;
}

export function splashUrl(championId: string, skinNum: number): string {
  return `https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${championId}_${skinNum}.jpg`;
}

export function ensureChampions(): Promise<Champion[]> {
  if (championsCache) return Promise.resolve(championsCache);

  return ensureVersion().then(() => {
    const cached = getCached<Champion[]>(CACHE_KEY);
    if (cached) {
      championsCache = cached;
      return cached;
    }

    return fetch(`https://ddragon.leagueoflegends.com/cdn/${ddragonVersion}/data/en_US/champion.json`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((json) => {
        const list: Champion[] = Object.values(json.data).map((c: any) => ({
          id: c.id,
          key: c.key,
          name: c.name,
          title: c.title,
          tags: c.tags,
        }));
        list.sort((a, b) => a.name.localeCompare(b.name));
        championsCache = list;
        setCache(CACHE_KEY, list);
        return list;
      });
  });
}

export function findChampionByName(name: string): Champion | undefined {
  return championsCache?.find((c) => c.name === name);
}

export function useChampions() {
  const [champions, setChampions] = useState<Champion[]>(championsCache ?? []);
  const [loading, setLoading] = useState(!championsCache);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (championsCache) return;

    ensureChampions()
      .then((list) => setChampions(list))
      .catch((err) => setError(String(err)))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return champions;
    const q = search.toLowerCase();
    return champions.filter((c) => c.name.toLowerCase().includes(q));
  }, [champions, search]);

  return {
    champions: filtered,
    total: champions.length,
    loading,
    error,
    search,
    setSearch,
  };
}
