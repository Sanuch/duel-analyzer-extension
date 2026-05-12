import { getPatterns } from "../resources-client/resourcesClient";
import type { CompiledPatterns, ResourceLang } from "../resources-client/types";
import type { DuelCondition, InfluenceResult, RawStep, ResultEnvelope, StepEvent, VoiceResult } from "./model";
import { classifyVoiceResult } from "./voiceResultClassifier";

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

// Backfire classification mirrors ginger_note/logs2 influence recogniser semantics.
const INFLUENCE_EMPTY_PATTERNS: RegExp[] = [
  /неземная благодать снизошла вдруг на арену/i,
  /достаёт из ранца смятую незабудку, расправляет/i,
  /яркая радуга возникла над полем боя/i,
  /c неба послышался явственный скрежет зубов/i,
  /.* was showered with healing water\. unfortunately, it only works if consumed/i,
  /a beam of healing light showered the audience\. the audience complained about the excessive use of bright lighting on the battlefield/i,
  /a bright rainbow appeared on the battlefield\. beautiful/i,
  /An inspiring anthem plays from heaven, cheering .* on\. Impressive, but not exactly useful/i,
  /the fighters were nonplussed when the sky opened with a crack and a doctor dropped, unconscious, at .* feet/i,
  /вспышка, удар, грохот, запах палёного\. герои терпеливо ждут, пока им заменят рефери/i,
  /внезапно на трибунах раздаётся электрический треск и они начинают доверху заполняться попкорном/i,
  /досталась мирно пасущемуся неподал\.ку/i,
  /исполняет зажигательный танец с саблями/i,
  /ринул.* искать огнетушитель/i,
  /.* received a book of castable curses from the heavens, but couldn't read the handwriting/i,
  /a peal of thunder distracted the fighters\. it seems like it was .* doing/i,
  /sent a lightning bolt sizzling down onto a nearby pasture/i,
  /the sky lit up, and there was a deafening thunderclap\. no flash photography.*/i,
];

const INFLUENCE_MUTUAL_PATTERNS: RegExp[] = [
  /совсем на чуть-чуть разворачивает ход времени, восстанавливая всем немного здоровья/i,
  /а потому вылечил.* обоих героев, а заодно судей, комментаторов, зрителей и случайно залетевшую на арену птичку/i,
  /пролившийся внезапно с небес поток живой воды вылечил обоих соперников/i,
  /torrential rain converted the battlefield into a rejuvenating mudbath\. the fighters resume the battle feeling refreshed/i,
  /a sudden shower of healing water from heaven cured both competitors/i,
  /удар, ещё удар\.\.\. апоплексический удар у обоих соперников/i,
  /метящий в .* метеорит в последний момент отклонился от курса и задел обоих соперников сразу/i,
  /молния, ударившая в землю, превращает песок в стекло/i,
  /испуганно принюхиваясь к запаху жжёных тряпок, противники пытаются взобраться на голову друг другу/i,
  /a meteorite flying at .* deviated from its course at the last moment and hit both opponents at once/i,
  /thunderous clouds rolled in, and acid rained down from the heavens, injuring both competitors/i,
  /a plague of locusts swarmed into the battlefield and descended upon both opponents, who fought them off only after sustaining considerable damage/i,
];

const INFLUENCE_ANTI_PATTERNS: RegExp[] = [
  /неожиданно почувствовал.* себя лучше.*проклинает метк.* хозя.*/i,
  /неожиданно почувствовал.* себя лучше.* смиренно возносит хвалу небесам за ниспосланное испытание/i,
  /.* suddenly felt better\. .* muttered mean things about .* imprecise .*/i,
  /неловко отскакивая от вражеского удара, .* по.мал.* молнию, предназначавшуюся противнику/i,
  /awkwardly bouncing from the enemy's attack, .* caught a lightning bolt intended for .* rival/i,
  /unfortunately, the weapon acted as a conductor and .* received a lightning bolt meant for .*/i,
];

const HEAL_INFLUENCE_HINT_RE = /вылеч|леч|здоров|благодать|лечилк|healing|healed|restore|restorative|cured|health/i;

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
 *   1. Find voice RESPONSE phrase → consume it (typed VoiceResult)
 *   2. Find voice COMMAND (text in quotes) → consume it
 *   3. If either found → voice event created
 *   4. In remaining texts, find direct influence action → influence event
 *
 * Returns voice and influence results for that player.
 */
function analyzePlayerTexts(
  playerTexts: string[],
  patterns: CompiledPatterns,
  lang: ResourceLang,
): {
  voiceResult?: VoiceResult;
  influenceResult?: InfluenceResult;
  influenceText?: string;
} {
  if (playerTexts.length === 0) {
    return {};
  }

  const remaining = [...playerTexts];
  let voiceResponseText: string | undefined;
  let voiceCommandFound = false;

  // Step 1: Find a voice RESPONSE phrase (consume it).
  // Uses the full pattern list from phrases/resources/voice.json.
  for (let i = 0; i < remaining.length; i++) {
    if (matchesAny(remaining[i], patterns.voice)) {
      voiceResponseText = remaining[i];
      remaining.splice(i, 1);
      break;
    }
  }

  // Step 2: Find a voice COMMAND (text in quotes, e.g. «лечись» or "heal") — consume it
  for (let i = 0; i < remaining.length; i++) {
    // Ignore audience/NPC quote mentions; they are not player-issued commands.
    if (COMMAND_MENTION_RE.test(remaining[i])) continue;

    // A phrase can contain quotes (e.g. motto in narration) and still be an influence action.
    // Do not treat such lines as voice commands.
    if (matchesAny(remaining[i], patterns.influence)) continue;

    if (VOICE_COMMAND_RE.test(remaining[i])) {
      voiceCommandFound = true;
      remaining.splice(i, 1);
      break;
    }
  }

  // Determine voice result
  let voiceResult: VoiceResult | undefined;
  if (voiceResponseText || voiceCommandFound) {
    voiceResult = voiceResponseText ? classifyVoiceResult(voiceResponseText, lang) : "NONE";
  }

  // Step 3: In remaining texts, look for a direct influence action.
  // This mirrors ginger_note/logs2: voice response + voice command are consumed
  // before influence recognition, so voice responses marked with ➥ are not
  // counted as influence usages.
  let influenceResult: InfluenceResult | undefined;
  let influenceText: string | undefined;
  for (const text of remaining) {
    // Skip command mentions (audience/NPC text, not real player actions)
    if (COMMAND_MENTION_RE.test(text)) continue;

    if (matchesAny(text, patterns.influence)) {
      influenceResult = classifyInfluenceResult(text);
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
  const heroAnalysis = analyzePlayerTexts(step.myTexts, p, lang);
  const opptAnalysis = analyzePlayerTexts(step.oppTexts, p, lang);

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

function classifyInfluenceResult(text: string): InfluenceResult {
  if (matchesAny(text, INFLUENCE_EMPTY_PATTERNS)) return "EMPTY";
  if (matchesAny(text, INFLUENCE_MUTUAL_PATTERNS)) return "MUTUAL";
  if (matchesAny(text, INFLUENCE_ANTI_PATTERNS)) return "ANTI";
  return HEAL_INFLUENCE_HINT_RE.test(text) ? "HEAL" : "ATTACK";
}

