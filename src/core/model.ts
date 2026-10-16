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
  /** The line with the quoted voice command, to mark it in the log. */
  voiceText?: string;
}

export interface ResultEnvelope {
  events: StepEvent[];
  unknownPhrases: string[];
  /** Nobody acted in this step: its plain lines are filler texts (intermission, audience, referee). */
  empty: boolean;
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

/** Health in points: both players. */
export interface HealthPoint {
  hero: number;
  oppt: number;
}

/** Health after every step (`byStep`) and the maximum health of both players. */
export interface HealthTimeline {
  max: HealthPoint;
  byStep: Map<number, HealthPoint>;
}

/** Health change of one player in one step. */
export interface StepHealthChange {
  /** % of max health; null when the health of the step is unknown. */
  pct: number | null;
  /** The same change without the damage amplification; null while there is none. */
  effectivePct: number | null;
}

export interface StepSummary {
  number: number;
  heroAction: string;
  opptAction: string;
  /** A "coin" step: after the 3rd step the log has two plain lines (three under TOGETHER). */
  coin: boolean;
  /** An empty step: nobody acted, the plain lines are filler texts. */
  empty: boolean;
  heroHealth: StepHealthChange;
  opptHealth: StepHealthChange;
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
  /** Max health, 0 while unknown. */
  maxHealth: number;
  powerCounter: number;
  miracles: number;
  lastAction: string;
  availableInfluences: number;
  voiceActions: VoiceResult[];
  influenceActions: InfluenceResult[];
}

export interface BattleState {
  currentStep: number;
  /** Number of the last step of the log. */
  totalSteps: number;
  /** Coin steps up to the current step. */
  coins: number;
  config: BattleConfig;
  hero: PlayerState;
  oppt: PlayerState;
  steps: StepSummary[];
}

function makeInitialPlayer(name: string, startInfluences: number): PlayerState {
  return {
    name,
    health: 0,
    maxHealth: 0,
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
    totalSteps: 0,
    coins: 0,
    config,
    hero: makeInitialPlayer("HERO", config.startInfluences),
    oppt: makeInitialPlayer("OPPT", config.startInfluences),
    steps: [],
  };
}
