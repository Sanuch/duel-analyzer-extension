import type { BattleConfig, BattleState, DuelCondition, InfluenceResult, RawStep, ResultEnvelope, StepEvent, StepSummary, VoiceResult } from "./model";

// ─── Config ───────────────────────────────────────────────────────────────────

export function applyConfig(state: BattleState, condition: DuelCondition): void {
  if (state.config.condition !== "DEFAULT") return;
  state.config.condition = condition;
  if (condition === "DEAFENING") {
    state.config.voiceBlock = 0;
  } else if (condition === "ANTIDOME") {
    state.config.influenceBlock = 4;
  } else if (condition === "LIMIT_INFLUENCE") {
    state.config.startInfluences = 2;
    state.hero.availableInfluences = 2;
    state.oppt.availableInfluences = 2;
  }
}

// ─── Event application ────────────────────────────────────────────────────────

export function applyEvents(state: BattleState, step: RawStep, envelope: ResultEnvelope): BattleState {
  const owner = resolveStepOwner(step.number);
  const actor = owner === "HERO" ? state.hero : state.oppt;
  const opponent = owner === "HERO" ? state.oppt : state.hero;
  const { events, voiceResult, influenceResult } = envelope;

  actor.lastAction = eventLabel(events[0]?.type ?? "UNKNOWN");

  for (const event of events) {
    if (event.type === "VOICE") {
      actor.powerCounter += 5;
    }

    if (event.type === "INFLUENCE") {
      actor.powerCounter += 25;
      actor.availableInfluences = Math.max(0, actor.availableInfluences - 1);
      opponent.availableInfluences += 1;
    }

    if (event.type === "MIRACLE") {
      actor.powerCounter += 50;
      actor.miracles += 1;
      actor.availableInfluences = Math.max(0, actor.availableInfluences - 1);
      opponent.availableInfluences += 1;
    }
  }

  if (voiceResult !== undefined) {
    actor.voiceActions.push(voiceResult);
  }

  if (influenceResult !== undefined) {
    actor.influenceActions.push(influenceResult);
  }

  if (step.hp) {
    state.hero.health = step.hp.hero;
    state.oppt.health = step.hp.oppt;
  }

  state.currentStep = Math.max(state.currentStep, step.number);

  const summary: StepSummary = {
    number: step.number,
    heroAction: owner === "HERO" ? actor.lastAction : state.hero.lastAction,
    opptAction: owner === "OPPT" ? actor.lastAction : state.oppt.lastAction,
  };

  state.steps.push(summary);
  state.steps = state.steps.slice(-5);

  return state;
}

// ─── Block stats ──────────────────────────────────────────────────────────────

export interface VoiceBlockStats {
  total: number;
  good: number;
  extra: number;
  blockSize: number;
}

export interface InfluenceBlockStats {
  total: number;
  bad: number;
  blockSize: number;
  available: number;
}

export function getVoiceBlockStats(voiceActions: VoiceResult[], blockSize: number): VoiceBlockStats {
  if (blockSize === 0) return { total: 0, good: 0, extra: 0, blockSize: 0 };

  const chunks = chunkArray(voiceActions, blockSize);
  const extra = chunks.reduce((acc, chunk) => acc + extraByChunk(chunk, blockSize), 0);
  const currentBlock = chunks.length > 0 ? chunks[chunks.length - 1] : [];
  const good = currentBlock.filter((r) => r === "TRIGGERED").length;

  return { total: currentBlock.length, good, extra, blockSize };
}

export function getInfluenceBlockStats(
  influenceActions: InfluenceResult[],
  blockSize: number,
  available: number,
): InfluenceBlockStats {
  const chunks = chunkArray(influenceActions, blockSize);
  const currentBlock = chunks.length > 0 ? chunks[chunks.length - 1] : [];
  const bad = currentBlock.filter((r) => r === "BAD").length;

  return { total: currentBlock.length, bad, blockSize, available };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function chunkArray<T>(arr: T[], size: number): T[][] {
  if (size === 0 || arr.length === 0) return [];
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}

function extraByChunk(chunk: VoiceResult[], blockSize: number): number {
  const good = chunk.filter((r) => r === "TRIGGERED").length;
  if (good > 3) return good - 3;
  if (good < 3 && chunk.length === blockSize) return -(3 - good);
  return 0;
}

function resolveStepOwner(stepNumber: number): "HERO" | "OPPT" {
  return stepNumber % 2 === 1 ? "HERO" : "OPPT";
}

function eventLabel(type: StepEvent["type"]): string {
  return type;
}

// Re-export BattleConfig type for convenience
export type { BattleConfig, DuelCondition };
