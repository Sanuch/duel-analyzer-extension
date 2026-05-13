import { getPatterns } from "../resources-client/resourcesClient";
import type { CompiledPatterns, ResourceLang } from "../resources-client/types";
import type { DuelCondition, InfluenceResult, RawStep, ResultEnvelope, StepEvent, VoiceResult } from "./model";
import { classifyVoiceResult } from "./voiceResultClassifier";

// Command text marker: "..." or «...»
const VOICE_COMMAND_RE = /[«"][^»"]{1,200}[»"]/;

// condition patterns are loaded from resources; mapping is by stable index ranges
const CONDITION_RANGES: Array<{ condition: DuelCondition; from: number; to: number }> = [
  { condition: "DEAFENING", from: 0, to: 2 },
  { condition: "TOGETHER", from: 2, to: 4 },
  { condition: "ANTIDOME", from: 4, to: 6 },
  { condition: "CRAZY_SQUIRRELS", from: 6, to: 8 },
  { condition: "LIMIT_INFLUENCE", from: 8, to: 10 },
  { condition: "LIMIT_UNPACK", from: 10, to: 12 },
  { condition: "PRAYING", from: 12, to: 14 },
  { condition: "BRICKS", from: 14, to: 17 },
  { condition: "RESOURCE", from: 17, to: 20 },
  { condition: "EXTRA_GOLD", from: 20, to: 22 },
];

function matchesAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

function slicePatterns(patterns: RegExp[], from: number, to: number): RegExp[] {
  const safeFrom = Math.max(0, from);
  const safeTo = Math.min(patterns.length, to);
  return patterns.slice(safeFrom, safeTo);
}

function classifyInfluenceResultByVoiceHint(text: string): InfluenceResult {
  // Mutual/backfire heuristics are language-agnostic markers, not phrase dictionaries.
  if (/(обоих|оба|соперники|друг\s+другу|both\s+opponents|both\s+competitors|everyone|всем)/i.test(text)) {
    return "MUTUAL";
  }
  if (/(предназнача\w*\s+противнику|intended\s+for\s+.*\s+rival|instead\s+hit\s+self|поймал\w*\s+молни\w*)/i.test(text)) {
    return "ANTI";
  }

  const voiceLike = classifyVoiceResult(text, "ru");
  if (voiceLike === "HEAL") return "HEAL";
  return "ATTACK";
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
    if (matchesAny(remaining[i], patterns.miracle)) {
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
    if (matchesAny(t, patterns.influence)) {
      influenceResult = classifyInfluenceResultByVoiceHint(t);
      influenceText = t;
      remaining.splice(i, 1);
      break;
    }
  }

  let voicePhrase: string | undefined;
  let voiceCommandFound = false;

  // 3) consume voice-response phrase from resources
  for (let i = 0; i < remaining.length; i++) {
    if (matchesAny(remaining[i], patterns.voice)) {
      voicePhrase = remaining[i];
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
    voiceResult: voicePhrase ? classifyVoiceResult(voicePhrase, lang) : voiceCommandFound ? "NONE" : undefined,
    miracleDetected,
    influenceResult,
    influenceText,
  };
}

export function detectCondition(texts: string[]): DuelCondition {
  const conditionPatterns = getPatterns("ru").conditions;

  for (const text of texts) {
    for (const { condition, from, to } of CONDITION_RANGES) {
      const group = slicePatterns(conditionPatterns, from, to);
      if (group.length > 0 && matchesAny(text, group)) {
        return condition;
      }
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
