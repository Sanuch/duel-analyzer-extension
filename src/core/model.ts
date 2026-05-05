export type EventType = "VOICE" | "INFLUENCE" | "MIRACLE" | "EMPTY" | "UNKNOWN";

export interface StepEvent {
  type: EventType;
  text: string;
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

export interface PlayerState {
  name: string;
  health: number;
  powerCounter: number;
  miracles: number;
  lastAction: string;
}

export interface BattleState {
  currentStep: number;
  hero: PlayerState;
  oppt: PlayerState;
  steps: StepSummary[];
}

export function createInitialState(): BattleState {
  return {
    currentStep: 0,
    hero: {
      name: "HERO",
      health: 100,
      powerCounter: 0,
      miracles: 0,
      lastAction: "-"
    },
    oppt: {
      name: "OPPT",
      health: 100,
      powerCounter: 0,
      miracles: 0,
      lastAction: "-"
    },
    steps: []
  };
}
