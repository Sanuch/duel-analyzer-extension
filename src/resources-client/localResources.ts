import type { ResolvedResources } from "./types";
import influenceData from "../../../phrases/resources/influence.json";
import voiceData from "../../../phrases/resources/voice.json";
import miracleData from "../../../phrases/resources/miracle.json";
import conditionsData from "../../../phrases/resources/conditions.json";

// Compile once at module load time; reused for both ru and en (patterns are shared).
const influencePatterns = influenceData.data.patterns.map((p: string) => new RegExp(p, "i"));
const voicePatterns = voiceData.data.patterns.map((p: string) => new RegExp(p, "i"));
const miraclePatterns = miracleData.data.patterns.map((p: string) => new RegExp(p, "i"));
const conditionsPatterns = conditionsData.data.patterns.map((p: string) => new RegExp(p, "i"));

/**
 * Hardcoded fallback data used when neither storage.local cache nor a remote
 * manifest is available.  All remote resources override these values once
 * loaded; this file is the last line of defence.
 */
export const LOCAL_FALLBACK: ResolvedResources = {
  patterns: {
    ru: {
      voice: voicePatterns,
      influence: influencePatterns,
      miracle: miraclePatterns,
      conditions: conditionsPatterns,
    },
    en: {
      voice: voicePatterns,
      influence: influencePatterns,
      miracle: miraclePatterns,
      conditions: conditionsPatterns,
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
