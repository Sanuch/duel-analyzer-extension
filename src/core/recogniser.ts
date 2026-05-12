import { getPatterns } from "../resources-client/resourcesClient";
import type { CompiledPatterns, ResourceLang } from "../resources-client/types";
import type { DuelCondition, InfluenceResult, RawStep, ResultEnvelope, StepEvent, VoiceResult } from "./model";

// Matches a voice command in quotes: «...» or "..."
const VOICE_COMMAND_RE = /[«""][^»""]{1,200}[»""]/;

// Patterns for the 3 conditions that affect block sizes
const CONDITION_PATTERNS: Partial<Record<DuelCondition, RegExp>> = {
  DEAFENING: /вопли зрителей|able to hear their gods/i,
  ANTIDOME: /антибожественный купол|more likely to backfire than usual/i,
  LIMIT_INFLUENCE: /односторонних влияний двумя|influences limit to 2/i,
};

// Approximate BAD influences (mutual/empty/anti) by battle text markers.
const BAD_INFLUENCE_RE = /не обращают внимания|не слышат|за пределами слышимости|обоих соперников|вылечил обоих|всем немного здоровья|противнику .*здоров/i;

export function detectCondition(texts: string[]): DuelCondition {
  for (const text of texts) {
    for (const [condition, pattern] of Object.entries(CONDITION_PATTERNS) as [DuelCondition, RegExp][]) {
      if (pattern.test(text)) return condition;
    }
  }
  return "DEFAULT";
}

export function recognise(
  step: RawStep,
  lang: ResourceLang = "ru",
  patterns?: CompiledPatterns,
): ResultEnvelope {
  const p = patterns ?? getPatterns(lang);

  const events: StepEvent[] = step.texts.map((text) => {
    if (matchesAny(text, p.miracle)) return { type: "MIRACLE", text };
    if (matchesAny(text, p.influence)) return { type: "INFLUENCE", text, influenceResult: "REAL" as InfluenceResult };
    if (matchesAny(text, p.voice)) return { type: "VOICE", text, voiceResult: "TRIGGERED" as VoiceResult };
    return { type: "UNKNOWN", text };
  });

  // Step-level voice result: triggered if any response phrase matched,
  // none if voice command in quotes was found but no response matched.
  let voiceResult: VoiceResult | undefined;
  if (events.some((e) => e.type === "VOICE")) {
    voiceResult = "TRIGGERED";
  } else if (step.texts.some((text) => VOICE_COMMAND_RE.test(text))) {
    voiceResult = "NONE";
  }

  // Step-level influence result (all influences currently treated as REAL)
  let influenceResult: InfluenceResult | undefined;
  if (events.some((e) => e.type === "INFLUENCE" || e.type === "MIRACLE")) {
    const hasBadMarker = step.texts.some((text) => BAD_INFLUENCE_RE.test(text));
    influenceResult = hasBadMarker ? "BAD" : "REAL";
  }

  const unknownPhrases = events
    .filter((event) => event.type === "UNKNOWN")
    .map((event) => event.text);

  return { events, unknownPhrases, voiceResult, influenceResult };
}

function matchesAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}
