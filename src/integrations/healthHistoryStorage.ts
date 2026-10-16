import browser from "webextension-polyfill";
import type { HealthPoint } from "../core/model";

const HEALTH_KEY = "duelAnalyzerHealthHistory";
const BATTLES_LIMIT = 5;

interface StoredBattle {
  savedAt: number;
  max: [number, number];
  points: Record<string, [number, number]>;
}

export interface BattleHealth {
  max: HealthPoint | null;
  byStep: Map<number, HealthPoint>;
}

/**
 * A live log does not say what the health was at earlier steps, so the points seen
 * while watching are kept per battle and survive page refreshes.
 */
export async function loadBattleHealth(battleId: string): Promise<BattleHealth> {
  const empty: BattleHealth = { max: null, byStep: new Map() };
  if (!battleId) {
    return empty;
  }

  const stored = (await browser.storage.local.get(HEALTH_KEY))[HEALTH_KEY];
  const battle = isRecord(stored) ? (stored[battleId] as StoredBattle | undefined) : undefined;
  if (!battle) {
    return empty;
  }

  const byStep = new Map<number, HealthPoint>();
  for (const [step, [hero, oppt]] of Object.entries(battle.points)) {
    byStep.set(Number(step), { hero, oppt });
  }

  return { max: { hero: battle.max[0], oppt: battle.max[1] }, byStep };
}

export async function saveBattleHealth(
  battleId: string,
  max: HealthPoint,
  byStep: Map<number, HealthPoint>,
): Promise<void> {
  if (!battleId) {
    return;
  }

  const stored = (await browser.storage.local.get(HEALTH_KEY))[HEALTH_KEY];
  const all: Record<string, StoredBattle> = isRecord(stored)
    ? (stored as Record<string, StoredBattle>)
    : {};

  const points: StoredBattle["points"] = {};
  for (const [step, point] of byStep) {
    points[String(step)] = [point.hero, point.oppt];
  }

  all[battleId] = { savedAt: Date.now(), max: [max.hero, max.oppt], points };

  // Keep only the most recently watched battles.
  const newest = Object.entries(all)
    .sort(([, a], [, b]) => b.savedAt - a.savedAt)
    .slice(0, BATTLES_LIMIT);

  await browser.storage.local.set({ [HEALTH_KEY]: Object.fromEntries(newest) });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
