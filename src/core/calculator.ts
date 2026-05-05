import type { BattleState, RawStep, StepEvent, StepSummary } from "./model";

export function applyEvents(state: BattleState, step: RawStep, events: StepEvent[]): BattleState {
  const owner = resolveStepOwner(step.number);
  const actor = owner === "HERO" ? state.hero : state.oppt;

  actor.lastAction = eventLabel(events[0]?.type ?? "UNKNOWN");

  for (const event of events) {
    if (event.type === "VOICE") {
      actor.powerCounter += 5;
    }

    if (event.type === "INFLUENCE") {
      actor.powerCounter += 25;
    }

    if (event.type === "MIRACLE") {
      actor.powerCounter += 50;
      actor.miracles += 1;
    }
  }

  if (step.hp) {
    state.hero.health = step.hp.hero;
    state.oppt.health = step.hp.oppt;
  }

  state.currentStep = Math.max(state.currentStep, step.number);

  const summary: StepSummary = {
    number: step.number,
    heroAction: owner === "HERO" ? actor.lastAction : state.hero.lastAction,
    opptAction: owner === "OPPT" ? actor.lastAction : state.oppt.lastAction
  };

  state.steps.push(summary);
  state.steps = state.steps.slice(-5);

  return state;
}

function resolveStepOwner(stepNumber: number): "HERO" | "OPPT" {
  return stepNumber % 2 === 1 ? "HERO" : "OPPT";
}

function eventLabel(type: StepEvent["type"]): string {
  return type;
}
