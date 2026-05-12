import type {
  CompiledPatterns,
  PatternData,
  PatternResourceType,
  ResolvedResources,
  ResourceLang,
  SelectorsData,
  ThresholdsData,
} from "./types";
import { readCached } from "./resourceCache";
import { fetchManifest, loadChangedResources } from "./resourceLoader";
import { LOCAL_FALLBACK } from "./localResources";

const PATTERN_TYPES: PatternResourceType[] = [
  "influence",
  "miracle",
  "voice",
  "conditions",
];

let resolvedResources: ResolvedResources | null = null;

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Loads resources from storage.local cache and optionally refreshes them from
 * a remote manifest before the first recognise() call.
 */
export async function initResources(manifestUrl = ""): Promise<void> {
  if (manifestUrl) {
    const manifest = await fetchManifest(manifestUrl);
    await loadChangedResources(manifest);
  }

  resolvedResources = await buildResolvedResources();
}

/**
 * Fetches the remote manifest, downloads only changed files, validates them
 * (schema + checksum), writes to cache, and rebuilds the in-memory view.
 *
 * Silently skips if `manifestUrl` is empty — allows development without a
 * live server while keeping the same code path.
 */
export async function refreshResources(manifestUrl: string): Promise<void> {
  await initResources(manifestUrl);
}

export function getPatterns(lang: ResourceLang): CompiledPatterns {
  return resolvedResources?.patterns[lang] ?? LOCAL_FALLBACK.patterns[lang];
}

export function getSelectors(): SelectorsData {
  return resolvedResources?.selectors ?? LOCAL_FALLBACK.selectors;
}

export function getThresholds(): ThresholdsData {
  return resolvedResources?.thresholds ?? LOCAL_FALLBACK.thresholds;
}

// ─── Internal ─────────────────────────────────────────────────────────────────

async function buildResolvedResources(): Promise<ResolvedResources> {
  const langs: ResourceLang[] = ["ru", "en"];

  const patterns: Record<ResourceLang, CompiledPatterns> = {
    ru: cloneFallbackPatterns("ru"),
    en: cloneFallbackPatterns("en"),
  };

  // Phrase types are language-agnostic; load once and share across all langs.
  for (const type of PATTERN_TYPES) {
    const cached = await readCached<PatternData>("ru", type);
    if (cached) {
      const compiled = cached.data.patterns.map((p) => new RegExp(p, "i"));
      patterns.ru[type] = compiled;
      patterns.en[type] = compiled;
    }
  }

  // Selectors and thresholds are language-independent; stored under "ru" key.
  const selectorsCached = await readCached<SelectorsData>("ru", "selectors");
  const selectors: SelectorsData = selectorsCached?.data ?? LOCAL_FALLBACK.selectors;

  const thresholdsCached = await readCached<ThresholdsData>("ru", "thresholds");
  const thresholds: ThresholdsData = thresholdsCached?.data ?? LOCAL_FALLBACK.thresholds;

  return { patterns, selectors, thresholds };
}

function cloneFallbackPatterns(lang: ResourceLang): CompiledPatterns {
  const fb = LOCAL_FALLBACK.patterns[lang];
  return {
    influence: [...fb.influence],
    miracle: [...fb.miracle],
    voice: [...fb.voice],
    conditions: [...fb.conditions],
  };
}
