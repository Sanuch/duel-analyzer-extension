import browser from "webextension-polyfill";
import { buildBattleState } from "../core/battle";
import type { AnalysedStep } from "../core/battle";
import {
  extractBattleId,
  extractCurrentStep,
  extractHealth,
  extractHealthTimeline,
  extractStepGroup,
} from "../core/extractor";
import type { HealthPoint, HealthTimeline } from "../core/model";
import { createInitialState } from "../core/model";
import { recognise } from "../core/recogniser";
import { versionNotificationManager } from "../core/version-notification";
import { loadBattleHealth, saveBattleHealth } from "../integrations/healthHistoryStorage";
import {
  buildUnknownPhraseItems,
  createUnknownPhraseReporter,
} from "../integrations/unknownPhraseReporter";
import { getSelectors, initResources } from "../resources-client/resourcesClient";
import { markLog } from "../ui/logBadges";
import { render } from "../ui/overlay";

const unknownPhraseReporter = createUnknownPhraseReporter();
const PHRASES_MANIFEST_URL = import.meta.env.VITE_PHRASES_MANIFEST_URL ?? "";

/** A recognised step together with the DOM rows it comes from. */
interface LogStep extends AnalysedStep {
  nodes: Node[];
}

/** Recognised steps by number. The state is rebuilt from them for the step the page shows. */
const logSteps = new Map<number, LogStep>();
/** Set when steps were added, so the log badges are rewritten only then (not on every replay step). */
let badgesDirty = true;

// Health of the steps of a live log: remembered while watching, kept per battle.
let liveHealth = new Map<number, HealthPoint>();
let liveMax: HealthPoint | null = null;
let battleId = "";

function isArenaDuelPage(): boolean {
  const url = new URL(window.location.href);
  const isDuelLog = /\/duels\/log\//.test(url.pathname);
  if (!isDuelLog) return false;

  // Only activate when the "Вести с арены" block is present on the page.
  // This block appears only on the arena duel log page (not profile logs, etc.).
  const arenaBlock = document.querySelector(".afl.block .block_h");
  const hasArenaHeading = arenaBlock !== null &&
    (arenaBlock.textContent ?? "").includes("Вести с арены");
  if (!hasArenaHeading) return false;

  return true;
}

/**
 * Checks whether the active-battle auto-refresh checkbox is present.
 * The checkbox exists only while the battle is still ongoing.
 */
function hasUpdateCheckbox(): boolean {
  return document.querySelector("input#update[name='update'][type='checkbox']") !== null;
}

/** Returns true when the battle is over and the active-battle checkbox is gone. */
function isBattleOver(): boolean {
  return !hasUpdateCheckbox();
}

const GODVILLE_CONTAINER_FALLBACK = "#last_items_arena .d_content";
const GODVILLE_STEP_ITEM_FALLBACK = ".new_line.dtc";

function resolveStepContainer(selector: string): HTMLElement | null {
  const primary = document.querySelector(selector);
  if (primary instanceof HTMLElement) {
    return primary;
  }

  const fallback = document.querySelector(GODVILLE_CONTAINER_FALLBACK);
  if (fallback instanceof HTMLElement) {
    return fallback;
  }

  return null;
}

function resolveStepItems(container: HTMLElement, selector: string): Element[] {
  const primary = Array.from(container.querySelectorAll(selector));
  if (primary.length > 0) {
    return primary;
  }

  const fallbackInContainer = Array.from(container.querySelectorAll(GODVILLE_STEP_ITEM_FALLBACK));
  if (fallbackInContainer.length > 0) {
    return fallbackInContainer;
  }

  return Array.from(document.querySelectorAll(GODVILLE_STEP_ITEM_FALLBACK));
}

/** Returns the step number from a DOM node's data-t or data-step attribute. */
function getStepNumber(node: Node): number | null {
  if (!(node instanceof HTMLElement)) return null;
  const n = Number(node.getAttribute("data-t") ?? node.getAttribute("data-step"));
  return Number.isFinite(n) && n > 0 ? n : null;
}

async function bootstrap(): Promise<void> {
  if (!isArenaDuelPage()) {
    return;
  }

  await initResources(PHRASES_MANIFEST_URL);

  const selectors = getSelectors();
  const container = resolveStepContainer(selectors.stepContainer);
  if (!container) {
    console.warn("[duel-analyzer] step container not found", {
      configured: selectors.stepContainer,
      fallback: GODVILLE_CONTAINER_FALLBACK,
    });
    return;
  }

  battleId = extractBattleId();
  try {
    // Live logs: the health of earlier steps is only known from what was seen before.
    const watched = await loadBattleHealth(battleId);
    liveHealth = watched.byStep;
    liveMax = watched.max;
  } catch (error) {
    console.warn("[duel-analyzer] battle health history unavailable", error);
  }

  const knownNodes = new WeakSet<Node>();

  // Group all existing nodes by step number, then process each group in ascending order.
  const allNodes = resolveStepItems(container, selectors.stepItem);

  if (allNodes.length === 0) {
    console.warn("[duel-analyzer] no step nodes found", {
      configuredItemSelector: selectors.stepItem,
      fallbackItemSelector: GODVILLE_STEP_ITEM_FALLBACK,
    });
  }

  // Build map: stepNumber → ordered list of nodes (DOM order is newest-first, so we reverse)
  const stepGroupsMap = new Map<number, Node[]>();
  for (let i = allNodes.length - 1; i >= 0; i--) {
    const node = allNodes[i];
    const stepNum = getStepNumber(node) ?? 0;
    if (!stepGroupsMap.has(stepNum)) {
      stepGroupsMap.set(stepNum, []);
    }
    stepGroupsMap.get(stepNum)!.push(node);
    knownNodes.add(node);
  }

  // Sort step numbers ascending (oldest first) for correct state accumulation
  const sortedStepNums = Array.from(stepGroupsMap.keys()).sort((a, b) => a - b);

  let sequence = 0;
  for (const stepNum of sortedStepNums) {
    const nodes = stepGroupsMap.get(stepNum)!;
    sequence += 1;
    await processStepGroup(nodes, sequence, false);
  }

  // ── Live mode: buffer incoming nodes by step number ──────────────────────────
  // Nodes for the same step arrive as separate mutation records. We buffer them
  // until the step number changes, then flush the completed group.
  const liveBuffer = new Map<number, Node[]>();
  let lastLiveStep = 0;

  async function flushLiveStep(stepNum: number): Promise<void> {
    const nodes = liveBuffer.get(stepNum);
    if (!nodes || nodes.length === 0) return;
    liveBuffer.delete(stepNum);
    sequence += 1;
    await processStepGroup(nodes, sequence);
  }

  const observer = new MutationObserver(async (records) => {
    for (const record of records) {
      for (const node of Array.from(record.addedNodes)) {
        if (knownNodes.has(node)) continue;
        knownNodes.add(node);

        const stepNum = getStepNumber(node);
        if (stepNum === null) continue;

        // When step number changes, flush the previously buffered step
        if (lastLiveStep !== 0 && stepNum !== lastLiveStep) {
          await flushLiveStep(lastLiveStep);
        }
        lastLiveStep = stepNum;

        if (!liveBuffer.has(stepNum)) {
          liveBuffer.set(stepNum, []);
        }
        liveBuffer.get(stepNum)!.push(node);
      }
    }

    // Flush the last buffered step after all records are processed
    if (lastLiveStep !== 0 && liveBuffer.has(lastLiveStep)) {
      await flushLiveStep(lastLiveStep);
    }
  });

  observer.observe(container, {
    childList: true,
    subtree: false,
  });

  // A finished log is replayed by the page: the step shown (`#turn_num`) and the health
  // (`#hp0`, `#hp1`) change without any new rows, and the panel has to follow them.
  const followPage = new MutationObserver(() => refresh());
  const watch = document.querySelectorAll("#turn_num, #hp0, #hp1");
  for (const node of Array.from(watch)) {
    followPage.observe(node, { childList: true, characterData: true, subtree: true });
  }

  refresh();
}

async function processStepGroup(
  nodes: Node[],
  fallbackNumber: number,
  refreshNow = true,
): Promise<void> {
  const firstNumber = getStepNumber(nodes[0]);
  // Rows of a step may arrive in several pieces: recognise the step from all of them.
  const previous = firstNumber !== null ? logSteps.get(firstNumber) : undefined;
  const allNodes = previous ? [...previous.nodes, ...nodes] : nodes;

  const raw = extractStepGroup(allNodes, fallbackNumber);
  if (!raw) return;

  const envelope = recognise(raw);

  const unknownPhrases = envelope.unknownPhrases;
  if (unknownPhrases.length > 0) {
    const items = buildUnknownPhraseItems({
      phrases: unknownPhrases,
      stepNumber: raw.number,
      lang: "ru",
    });
    try {
      await unknownPhraseReporter.report(items);
    } catch (error) {
      console.warn("[duel-analyzer] unknown phrase report failed", error);
    }
  }

  logSteps.set(raw.number, { raw, envelope, nodes: allNodes });
  badgesDirty = true;

  if (refreshNow) {
    refresh();
  }
}

/**
 * Redraws the panel for the step the page shows: the last step of a live log, or the step
 * of the replay slider of a finished one.
 */
function refresh(): void {
  const steps = [...logSteps.values()];
  if (steps.length === 0) {
    render(createInitialState(), isBattleOver());
    return;
  }

  const last = Math.max(...steps.map((step) => step.raw.number));
  const current = Math.min(extractCurrentStep() ?? last, last);

  const state = buildBattleState(steps, current, collectHealth(current));
  render(state, isBattleOver());

  if (badgesDirty) {
    badgesDirty = false;
    // The block sizes depend on the condition announced at the start, whatever step is shown.
    const config = buildBattleState(steps, last).config;
    markLog(
      steps.map((step) => ({ number: step.raw.number, nodes: step.nodes, envelope: step.envelope })),
      config,
    );
  }
}

/**
 * Health of every step. A finished log has the whole history in the page; a live log only
 * shows the current health, so the points seen so far are accumulated and remembered.
 */
function collectHealth(current: number): HealthTimeline | undefined {
  const fromPage = extractHealthTimeline();
  const shown = extractHealth();

  if (shown) {
    const max = { hero: shown.hero.maxHealth, oppt: shown.oppt.maxHealth };
    const point = { hero: shown.hero.health, oppt: shown.oppt.health };

    if (fromPage.size > 0) {
      if (!fromPage.has(current)) {
        fromPage.set(current, point);
      }
      return { max, byStep: fromPage };
    }

    const known = liveHealth.get(current);
    if (!known || known.hero !== point.hero || known.oppt !== point.oppt) {
      liveHealth.set(current, point);
      void saveBattleHealth(battleId, max, liveHealth).catch((error) =>
        console.warn("[duel-analyzer] battle health not saved", error),
      );
    }
    liveMax = max;
    return { max, byStep: liveHealth };
  }

  return liveMax ? { max: liveMax, byStep: liveHealth } : undefined;
}

// ─── Version update notifications ─────────────────────────────────────────────

browser.runtime.onMessage.addListener((message: unknown) => {
  if (
    typeof message === "object" &&
    message !== null &&
    "type" in message &&
    message.type === "VERSION_UPDATE_AVAILABLE"
  ) {
    const versionMsg = message as {
      type: string;
      current?: string;
      latest?: string;
      updateUrl?: string;
    };

    const current = versionMsg.current || "unknown";
    const latest = versionMsg.latest || "unknown";

    // Проверяем, не отклонил ли пользователь это обновление ранее
    if (versionNotificationManager.isDismissed(latest)) {
      console.log(`[duel-analyzer] version ${latest} was previously dismissed`);
      return;
    }

    // Показываем баннер обновления
    versionNotificationManager.showUpdateBanner({
      current,
      latest,
      updateUrl: versionMsg.updateUrl,
    });
  }
});

void bootstrap();
