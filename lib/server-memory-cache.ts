type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

const globalCache = globalThis as typeof globalThis & {
  __flowmediMemoryCache?: Map<string, CacheEntry<unknown>>;
};

function getStore() {
  if (!globalCache.__flowmediMemoryCache) {
    globalCache.__flowmediMemoryCache = new Map<string, CacheEntry<unknown>>();
  }
  return globalCache.__flowmediMemoryCache;
}

export async function getOrSetMemoryCache<T>(
  key: string,
  ttlMs: number,
  producer: () => Promise<T>
): Promise<T> {
  const now = Date.now();
  const store = getStore();
  const existing = store.get(key) as CacheEntry<T> | undefined;
  if (existing && existing.expiresAt > now) return existing.value;

  const value = await producer();
  store.set(key, { value, expiresAt: now + ttlMs });
  return value;
}
