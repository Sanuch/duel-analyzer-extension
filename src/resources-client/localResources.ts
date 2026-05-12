import type { ResolvedResources } from "./types";

/**
 * Empty fallback used before remote resources are loaded via VITE_PHRASES_MANIFEST_URL.
 * Patterns are populated once the background script fetches the remote manifest.
 */
export const LOCAL_FALLBACK: ResolvedResources = {
  patterns: {
    ru: {
      voice: [],
      influence: [],
      miracle: [],
      conditions: [],
    },
    en: {
      voice: [],
      influence: [],
      miracle: [],
      conditions: [],
    },
  },
  selectors: {
    stepContainer: "#last_items_arena .d_content",
    stepItem: ".new_line.dtc",
  },
  thresholds: {
    voicePower: 5,
    influencePower: 25,
    miraclePower: 50,
  },
};

/**
 * @deprecated Import from resourcesClient instead.
 * Kept for backward compatibility — selectors forwarded from LOCAL_FALLBACK.
 */
export const localResources = {
  selectors: LOCAL_FALLBACK.selectors,
  patterns: LOCAL_FALLBACK.patterns.ru,
};
