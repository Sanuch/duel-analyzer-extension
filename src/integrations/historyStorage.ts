import browser from "webextension-polyfill";
import type { BattleState } from "../core/model";

const HISTORY_KEY = "duelAnalyzerHistory";
const HISTORY_LIMIT = 20;

interface StoredHistoryEntry {
  savedAt: string;
  snapshot: BattleState;
}

export async function saveBattleSnapshot(snapshot: BattleState): Promise<void> {
  const state = await browser.storage.local.get(HISTORY_KEY);
  const current: StoredHistoryEntry[] = Array.isArray(state[HISTORY_KEY]) ? state[HISTORY_KEY] : [];

  current.push({
    savedAt: new Date().toISOString(),
    snapshot: structuredClone(snapshot)
  });

  await browser.storage.local.set({
    [HISTORY_KEY]: current.slice(-HISTORY_LIMIT)
  });
}
