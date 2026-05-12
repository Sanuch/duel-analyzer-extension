export type EventType = "VOICE" | "INFLUENCE" | "MIRACLE" | "UNKNOWN";
export type VoiceResult = "ATTACK" | "HEAL" | "ROOT" | "SPILL" | "STINK" | "BLOCK" | "PRAY" | "MIXED" | "NONE" | "UNKNOWN";
export type InfluenceResult = "ATTACK" | "HEAL" | "ANTI" | "EMPTY" | "MUTUAL";
export type DuelCondition = "DEFAULT" | "DEAFENING" | "ANTIDOME" | "LIMIT_INFLUENCE" | "TOGETHER" | "CRAZY_SQUIRRELS" | "LIMIT_UNPACK" | "PRAYING" | "BRICKS" | "RESOURCE" | "EXTRA_GOLD";

export interface StepEvent {
  type: EventType;
  text: string;
  voiceResult?: VoiceResult;
  influenceResult?: InfluenceResult;
}

export interface PlayerResult {
  voiceResult?: VoiceResult;
  influenceResult?: InfluenceResult;
  influenceText?: string;
}

export interface ResultEnvelope {
  events: StepEvent[];
  unknownPhrases: string[];
  hero: PlayerResult;
  oppt: PlayerResult;
}

export interface RawStep {
  number: number;
  /** All texts from all divs combined. */
  texts: string[];
  /** Texts from divs with class="infl" (hero's voice/influence actions). */
  myTexts: string[];
  /** Texts from divs with class="opp_infl" (opponent's voice/influence actions). */
  oppTexts: string[];
  neutralTexts: string[];
  hp?: {
    hero: number;
    oppt: number;
  };
}

export interface StepSummary {
  number: number;
  heroAction: string;
  opptAction: string;
}

export interface BattleConfig {
  voiceBlock: number;
  influenceBlock: number;
  startInfluences: number;
  condition: DuelCondition;
}

export interface PlayerState {
  name: string;
  health: number;
  powerCounter: number;
  miracles: number;
  lastAction: string;
  availableInfluences: number;
  voiceActions: VoiceResult[];
  influenceActions: InfluenceResult[];
}

export interface BattleState {
  currentStep: number;
  config: BattleConfig;
  hero: PlayerState;
  oppt: PlayerState;
  steps: StepSummary[];
}

function makeInitialPlayer(name: string, startInfluences: number): PlayerState {
  return {
    name,
    health: 100,
    powerCounter: 0,
    miracles: 0,
    lastAction: "-",
    availableInfluences: startInfluences,
    voiceActions: [],
    influenceActions: [],
  };
}

export function createInitialState(): BattleState {
  const config: BattleConfig = {
    voiceBlock: 10,
    influenceBlock: 6,
    startInfluences: 4,
    condition: "DEFAULT",
  };
  return {
    currentStep: 0,
    config,
    hero: makeInitialPlayer("HERO", config.startInfluences),
    oppt: makeInitialPlayer("OPPT", config.startInfluences),
    steps: [],
  };
}
