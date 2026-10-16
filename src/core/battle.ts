import { applyConfig, applyEvents } from "./calculator";
import type { BattleState, HealthTimeline, RawStep, ResultEnvelope } from "./model";
import { createInitialState } from "./model";
import { detectCondition } from "./recogniser";
import { getPatterns } from "../resources-client/resourcesClient";

/** A recognised step of the log. */
export interface AnalysedStep {
  raw: RawStep;
  envelope: ResultEnvelope;
}

/**
 * Rebuilds the battle state as it was at `upToStep` by replaying every step from the
 * start. Stateless on purpose: a finished log can be replayed to any step, forwards
 * or backwards, and a live log keeps appending steps.
 */
export function buildBattleState(
  steps: AnalysedStep[],
  upToStep: number,
  health?: HealthTimeline,
): BattleState {
  // Without the condition phrases the "together" duels cannot be told, and so cannot the coins.
  const coins = getPatterns("ru").conditions.length > 0;
  const sorted = [...steps].sort((a, b) => a.raw.number - b.raw.number);
  const state = createInitialState();
  state.totalSteps = sorted.length > 0 ? sorted[sorted.length - 1].raw.number : 0;

  for (const { raw, envelope } of sorted) {
    if (raw.number > upToStep) {
      break;
    }

    if (raw.number <= 3 && state.config.condition === "DEFAULT") {
      applyConfig(state, detectCondition(raw.texts));
    }

    applyEvents(state, raw, envelope, health, { coins });
  }

  const current = health?.byStep.get(state.currentStep);
  if (health && current) {
    state.hero.health = current.hero;
    state.hero.maxHealth = health.max.hero;
    state.oppt.health = current.oppt;
    state.oppt.maxHealth = health.max.oppt;
  }

  return state;
}
