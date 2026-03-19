import { useState, useEffect, useMemo } from "react";
import type { Champion } from "../types";
import { getCached, setCache } from "../lib/cache";

const DDRAGON_VERSION = "15.4.1";
export const DDRAGON_BASE = `https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}`;

const CACHE_KEY = "zushi:champions";

// Module-level cache so data survives component re-mounts
let championsCache: Champion[] | null = null;

export function championAvatar(id: string): string {
  return `${DDRAGON_BASE}/img/champion/${id}.png`;
}

export function splashUrl(championId: string, skinNum: number): string {
  return `https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${championId}_${skinNum}.jpg`;
}

export function ensureChampions(): Promise<Champion[]> {
  if (championsCache) return Promise.resolve(championsCache);

  const cached = getCached<Champion[]>(CACHE_KEY);
  if (cached) {
    championsCache = cached;
    return Promise.resolve(cached);
  }

  return fetch(`${DDRAGON_BASE}/data/en_US/champion.json`)
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
