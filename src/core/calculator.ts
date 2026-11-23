import type { BattleConfig, BattleState, DuelCondition, HealthTimeline, InfluenceResult, RawStep, ResultEnvelope, StepEvent, StepHealthChange, StepSummary, VoiceResult } from "./model";

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

// ─── Step rules ───────────────────────────────────────────────────────────────

/** Damage amplification of a step: none up to the 60th step, then +2% per step. */
export function stepAmplification(stepNumber: number): number {
  return stepNumber <= 60 ? 1 : 1 + (stepNumber - 60) * 0.02;
}

/**
 * A "coin" step (the rule of the logs2 parser): after the third step the log has
 * two plain action lines instead of one, three when the heroes go together.
 */
export function isCoinStep(stepNumber: number, plainCount: number, condition: DuelCondition): boolean {
  return stepNumber > 3 && plainCount === (condition === "TOGETHER" ? 3 : 2);
}

/** Health change of one player in a step, in % of max health, plus the same without the amplification. */
function healthChange(
  stepNumber: number,
  health: HealthTimeline | undefined,
  side: "hero" | "oppt",
): StepHealthChange {
  const unknown: StepHealthChange = { pct: null, effectivePct: null };
  const current = health?.byStep.get(stepNumber);
  const previous = health?.byStep.get(stepNumber - 1);
  const max = health?.max[side] ?? 0;
  if (!current || !previous || max <= 0) {
    return unknown;
  }

  const pct = ((current[side] - previous[side]) / max) * 100;
  const factor = stepAmplification(stepNumber);
  return { pct, effectivePct: factor > 1 ? pct / factor : null };
}

/**
 * Health change of both players in a step in HP points (not %), for the value shown next to
 * the health of the page. null when the health of the step or the step before is unknown.
 */
export function healthDeltaPoints(
  stepNumber: number,
  health: HealthTimeline | undefined,
): { hero: number | null; oppt: number | null } {
  const current = health?.byStep.get(stepNumber);
  const previous = health?.byStep.get(stepNumber - 1);
  if (!current || !previous) {
    return { hero: null, oppt: null };
  }
  return { hero: current.hero - previous.hero, oppt: current.oppt - previous.oppt };
}

// ─── Event application ────────────────────────────────────────────────────────

export interface ApplyOptions {
  /**
   * Whether coin steps can be told. The rule depends on the duel condition ("together" has
   * one plain line more), so it is off while the condition phrases are not loaded.
   */
  coins?: boolean;
}

export function applyEvents(
  state: BattleState,
  step: RawStep,
  envelope: ResultEnvelope,
  health?: HealthTimeline,
  options: ApplyOptions = {},
): BattleState {
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
      const spent = state.hero.availableInfluences > 0;
      state.hero.availableInfluences = Math.max(0, state.hero.availableInfluences - 1);
      if (spent) {
        state.oppt.availableInfluences += 1;
      }
    }
    if (event.type === "INFLUENCE" && event.text === "oppt_influence") {
      state.oppt.powerCounter += 25;
      const spent = state.oppt.availableInfluences > 0;
      state.oppt.availableInfluences = Math.max(0, state.oppt.availableInfluences - 1);
      if (spent) {
        state.hero.availableInfluences += 1;
      }
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
      const spent = miracleActor.availableInfluences > 0;
      miracleActor.availableInfluences = Math.max(0, miracleActor.availableInfluences - 1);
      if (spent) {
        opponent.availableInfluences += 1;
      }
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

  const coin =
    options.coins !== false && isCoinStep(step.number, step.neutralTexts.length, state.config.condition);
  if (coin) {
    state.coins += 1;
  }

  const summary: StepSummary = {
    number: step.number,
    heroAction: owner === "HERO" ? actor.lastAction : state.hero.lastAction,
    opptAction: owner === "OPPT" ? actor.lastAction : state.oppt.lastAction,
    coin,
    empty: envelope.empty,
    heroHealth: healthChange(step.number, health, "hero"),
    opptHealth: healthChange(step.number, health, "oppt"),
    heroInfluence: envelope.hero.influenceResult ?? null,
    heroVoice: envelope.hero.voiceResult ?? null,
    opptInfluence: envelope.oppt.influenceResult ?? null,
    opptVoice: envelope.oppt.voiceResult ?? null,
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

/**
 * How many actions of every result a player has had (the `get_*_action_stat` of logs2).
 * A voice nobody answered (`NONE`) is not an action and is skipped.
 */
export function countActionResults<T extends string>(actions: readonly T[]): Map<T, number> {
  const counts = new Map<T, number>();
  for (const result of actions) {
    if (result === "NONE") {
      continue;
    }
    counts.set(result, (counts.get(result) ?? 0) + 1);
  }
  return counts;
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
