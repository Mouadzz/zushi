const DEFAULT_TTL = 24 * 60 * 60 * 1000; // 24 hours

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

export function getCached<T>(key: string, ttl = DEFAULT_TTL): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const entry: CacheEntry<T> = JSON.parse(raw);
    // Keep expired entries so getStale() can serve them as a fallback when
    // the network is down or rate-limited.
    if (Date.now() - entry.timestamp > ttl) return null;
    return entry.data;
  } catch {
    return null;
  }
}

/** Returns cached data regardless of age. Use as a fallback when a fetch fails. */
export function getStale<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const entry: CacheEntry<T> = JSON.parse(raw);
    return entry.data;
  } catch {
    return null;
  }
}

export function setCache<T>(key: string, data: T): void {
  try {
    const entry: CacheEntry<T> = { data, timestamp: Date.now() };
    localStorage.setItem(key, JSON.stringify(entry));
  } catch {
    // localStorage full or unavailable - ignore
  }
}
