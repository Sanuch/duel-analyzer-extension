import type { ResolvedResources } from "./types";

/**
 * Hardcoded fallback data used when neither storage.local cache nor a remote
 * manifest is available.  All remote resources override these values once
 * loaded; this file is the last line of defence.
 */
export const LOCAL_FALLBACK: ResolvedResources = {
  patterns: {
    ru: {
      voice: [/\b(молв|говор|шепч|произнос)/i],
      influence: [/\b(влияни|атак|удар|исцел|лечит)/i],
      miracle: [/\b(чудо|чуд)/i],
      conditions: [/\b(если|услов|провер)/i],
    },
    en: {
      voice: [/\b(voice|pray|whisper|utter)/i],
      influence: [/\b(influence|attack|heal|strike)/i],
      miracle: [/\b(miracle)/i],
      conditions: [/\b(if|condition|check)/i],
    },
  },
  selectors: {
    stepContainer: "#steps",
    stepItem: ".step",
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
