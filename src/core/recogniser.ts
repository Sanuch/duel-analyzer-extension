import { getPatterns } from "../resources-client/resourcesClient";
import type { CompiledPatterns, ResourceLang } from "../resources-client/types";
import type { DuelCondition, InfluenceResult, RawStep, ResultEnvelope, StepEvent, VoiceResult } from "./model";

// Command text marker: "..." or «...»
const VOICE_COMMAND_RE = /[«"][^»"]{1,200}[»"]/;
// A command is introduced by a colon or explicitly described as a voice. Quoted
// trophy names in ordinary responses/influences must remain available to match.
const EXPLICIT_VOICE_RE = /(?:[:：]\s*[«"][^»"]+[»"]|глас[^«"]*[«"][^»"]+[»"])/i;

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

/** True when any entry matches; unlike `matchPatternResult` it does not depend on the entry's `result`. */
function matchesAnyEntry(text: string, patterns: Array<{ pattern: string }>): boolean {
  return patterns.some(({ pattern }) => new RegExp(pattern, "i").test(text));
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
  voiceText?: string;
} {
  if (playerTexts.length === 0) {
    return {};
  }

  const remaining = [...playerTexts];
  let voiceCommandFound = false;
  let voiceText: string | undefined;
  const commandIndex = remaining.findIndex((text) => EXPLICIT_VOICE_RE.test(text));
  if (commandIndex !== -1) {
    voiceCommandFound = true;
    voiceText = remaining.splice(commandIndex, 1)[0];
  }

  // The arrow marks the game's response to a command, including prayers.
  // Classify it before searching for influence patterns that can overlap.
  let voiceResult: VoiceResult | undefined;
  const responseIndex = remaining.findIndex((text) => /^\s*➥/.test(text) && matchPatternResult(text, patterns.voice));
  if (responseIndex !== -1) {
    voiceResult = matchPatternResult(remaining[responseIndex], patterns.voice) as VoiceResult;
    remaining.splice(responseIndex, 1);
  }
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

  // 3) consume voice-response phrase from resources
  for (let i = 0; voiceResult === undefined && i < remaining.length; i++) {
    const result = matchPatternResult(remaining[i], patterns.voice);
    if (result) {
      voiceResult = result as VoiceResult;
      remaining.splice(i, 1);
      break;
    }
  }

  // 4) consume voice command marker (quoted command)
  for (let i = 0; !voiceCommandFound && i < remaining.length; i++) {
    if (VOICE_COMMAND_RE.test(remaining[i])) {
      voiceCommandFound = true;
      voiceText = remaining[i];
      remaining.splice(i, 1);
      break;
    }
  }

  return {
    voiceResult: voiceResult ? voiceResult : voiceCommandFound ? "NONE" : undefined,
    miracleDetected,
    influenceResult,
    influenceText,
    voiceText,
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
    // As in logs2: the plain lines of the step are searched together for a filler text.
    empty: matchesAnyEntry(rawStep.neutralTexts.join("\n"), patterns.emptyStep),
    hero: {
      voiceResult: hero.voiceResult,
      influenceResult: hero.influenceResult,
      influenceText: hero.influenceText,
      voiceText: hero.voiceText,
    },
    oppt: {
      voiceResult: oppt.voiceResult,
      influenceResult: oppt.influenceResult,
      influenceText: oppt.influenceText,
      voiceText: oppt.voiceText,
    },
  };
}
