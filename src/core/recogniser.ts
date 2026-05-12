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
  TOGETHER: /ходить вместе|fight will be twice as fast as usual/i,
  CRAZY_SQUIRRELS: /озверевшие белки|lose some health points/i,
  LIMIT_UNPACK: /распаковать больше трех|more than 3 charges/i,
  PRAYING: /намаливать богам|restore some godpower/i,
  BRICKS: /три золотых кирпича|два кирпича|three gold bricks/i,
  RESOURCE: /полезный ресурс|log of gopher wood|get a log for their ark/i,
  EXTRA_GOLD: /дополнительный призовой фонд|extra gold prize/i,
};

// Patterns that indicate this is just a command mention (audience/environment noise), not a player action.
const COMMAND_MENTION_RE = /завибрировало от громогласного:|донёсся|развернули плакат:|возопил:|молвил:|прогудело:|зашлись криками:|соорудили надпись|падает.*скрижаль|заявил:|сообщил:|послышалось:|выкрикнул:|прокричал:/i;

export function detectCondition(texts: string[]): DuelCondition {
  for (const text of texts) {
    for (const [condition, pattern] of Object.entries(CONDITION_PATTERNS) as [DuelCondition, RegExp][]) {
      if (pattern.test(text)) return condition;
    }
  }
  return "DEFAULT";
}

/**
 * Analyzes one player's texts (from infl or opp_infl divs) using the ginger_note
 * consume-chain approach:
 *   1. Find voice RESPONSE phrase → consume it (TRIGGERED)
 *   2. Find voice COMMAND (text in quotes) → consume it
 *   3. If either found → voice event created
 *   4. In remaining texts, find direct influence action → influence event
 *
 * Returns voice and influence results for that player.
 */
function analyzePlayerTexts(
  playerTexts: string[],
  patterns: CompiledPatterns,
): {
  voiceResult?: VoiceResult;
  influenceResult?: InfluenceResult;
  influenceText?: string;
} {
  if (playerTexts.length === 0) {
    return {};
  }

  const remaining = [...playerTexts];
  let voiceResponseFound = false;
  let voiceCommandFound = false;

  // Step 1: Find a voice RESPONSE phrase (consume it).
  // Uses the full pattern list from phrases/resources/voice.json.
  for (let i = 0; i < remaining.length; i++) {
    if (matchesAny(remaining[i], patterns.voice)) {
      voiceResponseFound = true;
      remaining.splice(i, 1);
      break;
    }
  }

  // Step 2: Find a voice COMMAND (text in quotes, e.g. «лечись» or "heal") — consume it
  for (let i = 0; i < remaining.length; i++) {
    if (VOICE_COMMAND_RE.test(remaining[i])) {
      voiceCommandFound = true;
      remaining.splice(i, 1);
      break;
    }
  }

  // Determine voice result
  let voiceResult: VoiceResult | undefined;
  if (voiceResponseFound || voiceCommandFound) {
    voiceResult = voiceResponseFound ? "TRIGGERED" : "NONE";
  }

  // Step 3: In remaining texts, look for a direct influence action.
  // Uses the full pattern list from phrases/resources/influence.json.
  let influenceResult: InfluenceResult | undefined;
  let influenceText: string | undefined;
  for (const text of remaining) {
    // Skip command mentions (audience/NPC text, not real player actions)
    if (COMMAND_MENTION_RE.test(text)) continue;

    if (matchesAny(text, patterns.influence)) {
      influenceResult = "REAL";
      influenceText = text;
      break;
    }

    // Catch-all: ➥ prefix marks new/unknown influence phrases not yet in influence.json
    if (text.startsWith("➥")) {
      influenceResult = "REAL";
      influenceText = text;
      break;
    }
  }

  return { voiceResult, influenceResult, influenceText };
}

export function recognise(
  step: RawStep,
  lang: ResourceLang = "ru",
  patterns?: CompiledPatterns,
): ResultEnvelope {
  const p = patterns ?? getPatterns(lang);

  // Collect MIRACLE events from neutral texts (miracles don't have infl/opp_infl class)
  const events: StepEvent[] = step.texts.map((text) => {
    if (matchesAny(text, p.miracle)) return { type: "MIRACLE", text };
    return { type: "UNKNOWN", text };
  });

  // Analyze each player's texts independently (voice + influence per player)
  const heroAnalysis = analyzePlayerTexts(step.myTexts, p);
  const opptAnalysis = analyzePlayerTexts(step.oppTexts, p);

  // Build synthetic events for voice/influence (used for power counter updates)
  if (heroAnalysis.voiceResult !== undefined) {
    events.push({ type: "VOICE", text: "hero_voice", voiceResult: heroAnalysis.voiceResult });
  }
  if (heroAnalysis.influenceResult !== undefined) {
    events.push({ type: "INFLUENCE", text: "hero_influence", influenceResult: heroAnalysis.influenceResult });
  }
  if (opptAnalysis.voiceResult !== undefined) {
    events.push({ type: "VOICE", text: "oppt_voice", voiceResult: opptAnalysis.voiceResult });
  }
  if (opptAnalysis.influenceResult !== undefined) {
    events.push({ type: "INFLUENCE", text: "oppt_influence", influenceResult: opptAnalysis.influenceResult });
  }

  const unknownPhrases = events
    .filter((event) => event.type === "UNKNOWN")
    .map((event) => event.text);

  return {
    events,
    unknownPhrases,
    hero: {
      voiceResult: heroAnalysis.voiceResult,
      influenceResult: heroAnalysis.influenceResult,
      influenceText: heroAnalysis.influenceText,
    },
    oppt: {
      voiceResult: opptAnalysis.voiceResult,
      influenceResult: opptAnalysis.influenceResult,
      influenceText: opptAnalysis.influenceText,
    },
  };
}

function matchesAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

