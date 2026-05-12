export type EventType = "VOICE" | "INFLUENCE" | "MIRACLE" | "UNKNOWN";
export type VoiceResult = "TRIGGERED" | "NONE";
export type InfluenceResult = "REAL" | "BAD";
export type DuelCondition = "DEFAULT" | "DEAFENING" | "ANTIDOME" | "LIMIT_INFLUENCE";

export interface StepEvent {
  type: EventType;
  text: string;
  voiceResult?: VoiceResult;
  influenceResult?: InfluenceResult;
}

export interface ResultEnvelope {
  events: StepEvent[];
  unknownPhrases: string[];
  voiceResult?: VoiceResult;
  influenceResult?: InfluenceResult;
}

export interface RawStep {
  number: number;
  texts: string[];
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
