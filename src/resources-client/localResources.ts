import conditionsResource from "../../../phrases/resources/conditions.json";
import influenceResource from "../../../phrases/resources/influence.json";
import miracleResource from "../../../phrases/resources/miracle.json";
import voiceResource from "../../../phrases/resources/voice.json";
import type { PatternData, ResourceFile, ResolvedResources } from "./types";

type PatternResource = ResourceFile<PatternData>;

function compilePatternResource(resource: PatternResource): RegExp[] {
  return resource.data.patterns.map((pattern) => new RegExp(pattern, "i"));
}

const LOCAL_RU_PATTERNS = {
  voice: compilePatternResource(voiceResource as PatternResource),
  influence: compilePatternResource(influenceResource as PatternResource),
  miracle: compilePatternResource(miracleResource as PatternResource),
  conditions: compilePatternResource(conditionsResource as PatternResource),
};

/**
 * Bundled fallback used before remote resources are loaded via VITE_PHRASES_MANIFEST_URL.
 * Remote cache may override these patterns, but the extension must work after
 * local builds even when the external manifest URL is not configured.
 */
export const LOCAL_FALLBACK: ResolvedResources = {
  patterns: {
    ru: {
      voice: [...LOCAL_RU_PATTERNS.voice],
      influence: [...LOCAL_RU_PATTERNS.influence],
      miracle: [...LOCAL_RU_PATTERNS.miracle],
      conditions: [...LOCAL_RU_PATTERNS.conditions],
    },
    en: {
      voice: [...LOCAL_RU_PATTERNS.voice],
      influence: [...LOCAL_RU_PATTERNS.influence],
      miracle: [...LOCAL_RU_PATTERNS.miracle],
      conditions: [...LOCAL_RU_PATTERNS.conditions],
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
