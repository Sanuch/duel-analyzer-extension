import browser from "webextension-polyfill";
import type { ResourceFile, ResourceLang, ResourceType } from "./types";

const CACHE_KEY_PREFIX = "da_resource_";
const CACHE_INDEX_KEY = "da_resource_index";

/** Map of cacheKey → dataVersion, persisted in storage.local. */
interface CacheIndex {
  [key: string]: string;
}

const memoryCache = new Map<string, ResourceFile<unknown>>();

export function makeCacheKey(lang: ResourceLang, type: ResourceType): string {
  return `${CACHE_KEY_PREFIX}${lang}_${type}`;
}

export async function readCached<T>(
  lang: ResourceLang,
  type: ResourceType,
): Promise<ResourceFile<T> | null> {
  const key = makeCacheKey(lang, type);

  if (memoryCache.has(key)) {
    return memoryCache.get(key) as ResourceFile<T>;
  }

  try {
    const result = await browser.storage.local.get(key);
    const stored = result[key];
    if (stored !== undefined && stored !== null && typeof stored === "object") {
      const file = stored as ResourceFile<T>;
      memoryCache.set(key, file as ResourceFile<unknown>);
      return file;
    }
  } catch {
    // storage unavailable — treat as cache miss
  }

  return null;
}

export async function writeToCache<T>(file: ResourceFile<T>): Promise<void> {
  const { lang, type } = file.meta;
  const key = makeCacheKey(lang, type);

  memoryCache.set(key, file as ResourceFile<unknown>);

  try {
    const indexResult = await browser.storage.local.get(CACHE_INDEX_KEY);
    const index: CacheIndex =
      (indexResult[CACHE_INDEX_KEY] as CacheIndex | undefined) ?? {};
    index[key] = file.dataVersion;
    await browser.storage.local.set({ [key]: file, [CACHE_INDEX_KEY]: index });
  } catch {
    // storage write failed — in-memory cache still valid for this session
  }
}

export async function getCacheVersions(): Promise<CacheIndex> {
  try {
    const result = await browser.storage.local.get(CACHE_INDEX_KEY);
    return (result[CACHE_INDEX_KEY] as CacheIndex | undefined) ?? {};
  } catch {
    return {};
  }
}

/** Clears only the in-memory layer; storage.local is left intact. */
export function clearMemoryCache(): void {
  memoryCache.clear();
}
