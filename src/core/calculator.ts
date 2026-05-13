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
  } else if (condition === "TOGETHER") {
    // Fight is twice as fast (no mechanical change in UI, just informational)
  } else if (condition === "CRAZY_SQUIRRELS") {
    // Crazy squirrels cause damage (no mechanical change in UI, just informational)
  } else if (condition === "LIMIT_UNPACK") {
    // Unpack limit to 3 charges (no mechanical change in UI, just informational)
  } else if (condition === "PRAYING") {
    // Can restore godpower by praying (no mechanical change in UI, just informational)
  } else if (condition === "BRICKS") {
    // Extra bricks reward (no mechanical change in UI, just informational)
  } else if (condition === "RESOURCE") {
    // Extra resource reward (no mechanical change in UI, just informational)
  } else if (condition === "EXTRA_GOLD") {
    // Extra gold prize (no mechanical change in UI, just informational)
  }
}

// ─── Event application ────────────────────────────────────────────────────────

export function applyEvents(state: BattleState, step: RawStep, envelope: ResultEnvelope): BattleState {
  const owner = resolveStepOwner(step.number);
  const actor = owner === "HERO" ? state.hero : state.oppt;
  const { events } = envelope;

  actor.lastAction = eventLabel(events[0]?.type ?? "UNKNOWN");

  // Power counter and availability updates are based on each player's own events
  for (const event of events) {
    if (event.type === "VOICE" && event.text === "hero_voice") {
      state.hero.powerCounter += 5;
    }
    if (event.type === "VOICE" && event.text === "oppt_voice") {
      state.oppt.powerCounter += 5;
    }
    if (event.type === "INFLUENCE" && event.text === "hero_influence") {
      state.hero.powerCounter += 25;
      state.hero.availableInfluences = Math.max(0, state.hero.availableInfluences - 1);
      state.oppt.availableInfluences += 1;
    }
    if (event.type === "INFLUENCE" && event.text === "oppt_influence") {
      state.oppt.powerCounter += 25;
      state.oppt.availableInfluences = Math.max(0, state.oppt.availableInfluences - 1);
      state.hero.availableInfluences += 1;
    }
    if (event.type === "MIRACLE") {
      const miracleActor = event.text === "hero_miracle"
        ? state.hero
        : event.text === "oppt_miracle"
          ? state.oppt
          : actor;
      const opponent = miracleActor === state.hero ? state.oppt : state.hero;

      miracleActor.powerCounter += 50;
      miracleActor.miracles += 1;
      miracleActor.availableInfluences = Math.max(0, miracleActor.availableInfluences - 1);
      opponent.availableInfluences += 1;
    }
  }

  // Voice and influence action tracking — per player, independent of step parity
  if (envelope.hero.voiceResult !== undefined) {
    state.hero.voiceActions.push(envelope.hero.voiceResult);
  }
  if (envelope.hero.influenceResult !== undefined) {
    state.hero.influenceActions.push(envelope.hero.influenceResult);
  }
  if (envelope.oppt.voiceResult !== undefined) {
    state.oppt.voiceActions.push(envelope.oppt.voiceResult);
  }
  if (envelope.oppt.influenceResult !== undefined) {
    state.oppt.influenceActions.push(envelope.oppt.influenceResult);
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
  badPositions: number[];
  blockSize: number;
  available: number;
}

export function getVoiceBlockStats(voiceActions: VoiceResult[], blockSize: number): VoiceBlockStats {
  if (blockSize === 0) return { total: 0, good: 0, extra: 0, blockSize: 0 };

  const chunks = chunkArray(voiceActions, blockSize);
  const extra = chunks.reduce((acc, chunk) => acc + extraByChunk(chunk, blockSize), 0);
  const currentBlock = chunks.length > 0 ? chunks[chunks.length - 1] : [];
  const good = currentBlock.filter(isTriggeredVoiceResult).length;

  return { total: currentBlock.length, good, extra, blockSize };
}

export function getInfluenceBlockStats(
  influenceActions: InfluenceResult[],
  blockSize: number,
  available: number,
): InfluenceBlockStats {
  const chunks = chunkArray(influenceActions, blockSize);
  const currentBlock = chunks.length > 0 ? chunks[chunks.length - 1] : [];
  const badPositions = currentBlock
    .map((result, index) => (isBackfireInfluence(result) ? index + 1 : 0))
    .filter((position) => position > 0);

  return {
    total: currentBlock.length,
    bad: badPositions.length,
    badPositions,
    blockSize,
    available,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isBackfireInfluence(result: InfluenceResult): boolean {
  return result === "ANTI" || result === "EMPTY" || result === "MUTUAL";
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  if (size === 0 || arr.length === 0) return [];
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}

function extraByChunk(chunk: VoiceResult[], blockSize: number): number {
  const good = chunk.filter(isTriggeredVoiceResult).length;
  if (good > 3) return good - 3;
  if (good < 3 && chunk.length === blockSize) return -(3 - good);
  return 0;
}

function isTriggeredVoiceResult(result: VoiceResult): boolean {
  return result !== "NONE" && result !== "UNKNOWN";
}

function resolveStepOwner(stepNumber: number): "HERO" | "OPPT" {
  return stepNumber % 2 === 1 ? "HERO" : "OPPT";
}

function eventLabel(type: StepEvent["type"]): string {
  return type;
}

// Re-export BattleConfig type for convenience
export type { BattleConfig, DuelCondition };
