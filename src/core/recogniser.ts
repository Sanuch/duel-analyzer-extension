import { getPatterns } from "../resources-client/resourcesClient";
import type { CompiledPatterns, ResourceLang } from "../resources-client/types";
import type { DuelCondition, InfluenceResult, RawStep, ResultEnvelope, StepEvent, VoiceResult } from "./model";

// Command text marker: "..." or «...»
const VOICE_COMMAND_RE = /[«"][^»"]{1,200}[»"]/;

// condition patterns are loaded from resources; mapping is by stable index ranges
function matchPatternResult(text: string, patterns: Array<{ pattern: string; result: string }>): string | undefined {
  for (const { pattern, result } of patterns) {
    const regex = new RegExp(pattern, "i");
    if (regex.test(text)) {
      return result;
    }
  }
  return undefined;
}

function analyzePlayerTexts(
  playerTexts: string[],
  patterns: CompiledPatterns,
  lang: ResourceLang,
): {
  voiceResult?: VoiceResult;
  miracleDetected?: boolean;
  influenceResult?: InfluenceResult;
  influenceText?: string;
} {
  if (playerTexts.length === 0) {
    return {};
  }

  const remaining = [...playerTexts];
  // 1) consume miracle first (same pipeline order as logs2)
  let miracleDetected = false;
  for (let i = 0; i < remaining.length; i++) {
    if (matchPatternResult(remaining[i], patterns.miracle)) {
      miracleDetected = true;
      remaining.splice(i, 1);
      break;
    }
  }

  // 2) consume influence before any voice parsing
  let influenceResult: InfluenceResult | undefined;
  let influenceText: string | undefined;
  for (let i = 0; i < remaining.length; i++) {
    const t = remaining[i];
    const result = matchPatternResult(t, patterns.influence);
    if (result) {
      influenceResult = result as InfluenceResult;
      influenceText = t;
      remaining.splice(i, 1);
      break;
    }
  }

  let voiceResult: VoiceResult | undefined;
  let voiceCommandFound = false;

  // 3) consume voice-response phrase from resources
  for (let i = 0; i < remaining.length; i++) {
    const result = matchPatternResult(remaining[i], patterns.voice);
    if (result) {
      voiceResult = result as VoiceResult;
      remaining.splice(i, 1);
      break;
    }
  }

  // 4) consume voice command marker (quoted command)
  for (let i = 0; i < remaining.length; i++) {
    if (VOICE_COMMAND_RE.test(remaining[i])) {
      voiceCommandFound = true;
      remaining.splice(i, 1);
      break;
    }
  }

  return {
    voiceResult: voiceResult ? voiceResult : voiceCommandFound ? "NONE" : undefined,
    miracleDetected,
    influenceResult,
    influenceText,
  };
}

export function detectCondition(texts: string[]): DuelCondition {
  const conditionPatterns = getPatterns("ru").conditions;

  for (const text of texts) {
    const detected = matchPatternResult(text, conditionPatterns);
    if (detected) {
      return detected as DuelCondition;
    }
  }

  return "DEFAULT";
}

export function recognise(rawStep: RawStep): ResultEnvelope {
  const lang: ResourceLang = "ru";
  const patterns = getPatterns(lang);

  const hero = analyzePlayerTexts(rawStep.myTexts, patterns, lang);
  const oppt = analyzePlayerTexts(rawStep.oppTexts, patterns, lang);

  const events: StepEvent[] = [];

  if (hero.voiceResult !== undefined) {
    events.push({ type: "VOICE", text: "hero_voice", voiceResult: hero.voiceResult });
  }
  if (oppt.voiceResult !== undefined) {
    events.push({ type: "VOICE", text: "oppt_voice", voiceResult: oppt.voiceResult });
  }
  if (hero.miracleDetected) {
    events.push({ type: "MIRACLE", text: "hero_miracle" });
  }
  if (oppt.miracleDetected) {
    events.push({ type: "MIRACLE", text: "oppt_miracle" });
  }
  if (hero.influenceResult !== undefined) {
    events.push({ type: "INFLUENCE", text: "hero_influence", influenceResult: hero.influenceResult });
  }
  if (oppt.influenceResult !== undefined) {
    events.push({ type: "INFLUENCE", text: "oppt_influence", influenceResult: oppt.influenceResult });
  }

  return {
    events,
    unknownPhrases: [],
    hero: {
      voiceResult: hero.voiceResult,
      influenceResult: hero.influenceResult,
      influenceText: hero.influenceText,
    },
    oppt: {
      voiceResult: oppt.voiceResult,
      influenceResult: oppt.influenceResult,
      influenceText: oppt.influenceText,
    },
  };
}
