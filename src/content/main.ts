import { applyConfig, applyEvents } from "../core/calculator";
import { extractStepGroup } from "../core/extractor";
import { createInitialState } from "../core/model";
import { detectCondition, recognise } from "../core/recogniser";
import {
  buildUnknownPhraseItems,
  createUnknownPhraseReporter,
} from "../integrations/unknownPhraseReporter";
import { getSelectors, initResources } from "../resources-client/resourcesClient";
import { render } from "../ui/overlay";


let state = createInitialState();
const unknownPhraseReporter = createUnknownPhraseReporter();
const PHRASES_MANIFEST_URL = import.meta.env.VITE_PHRASES_MANIFEST_URL ?? "";

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

/** Returns true if the battle is over (current step equals max step). */
function isBattleOver(): boolean {
  const turnNumEl = document.getElementById("turn_num");
  if (!turnNumEl) return false;
  const text = turnNumEl.parentElement?.textContent ?? "";
  // Format: "Вести с арены (шаг N / MAX)"
  const match = text.match(/(\d+)\s*\/\s*(\d+)/);
  if (!match) return false;
  return match[1] === match[2];
}

/**
 * Final duel page load after fight ends usually has no u=1 in URL.
 * Show upload button in that case even if step header format differs.
 */
function isFinalPageLoad(): boolean {
  const url = new URL(window.location.href);
  return url.searchParams.get("u") !== "1";
}

function normalizeForCompare(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/ё/g, "е");
}

function addInfluenceCounterToMatchedText(
  nodes: Node[],
  influenceText: string,
  currentInBlock: number,
  blockSize: number,
): void {
  const target = normalizeForCompare(influenceText);
  if (!target) return;

  const elements = nodes.filter((n): n is HTMLElement => n instanceof HTMLElement);
  for (const el of elements) {
    const spans = Array.from(el.querySelectorAll(".text_content .t")) as HTMLElement[];
    for (const span of spans) {
      if (span.nextElementSibling?.classList.contains("influence-counter")) {
        continue;
      }

      const text = span.textContent ?? "";
      if (normalizeForCompare(text) !== target) {
        continue;
      }

      const counterBadge = document.createElement("span");
      counterBadge.className = "influence-counter";
      counterBadge.style.cssText = [
        "display:inline-block",
        "margin-left:4px",
        "padding:1px 4px",
        "background:rgba(100, 150, 200, 0.2)",
        "border-radius:3px",
        "font-size:0.85em",
        "color:#666",
        "font-weight:normal",
      ].join(";");
      counterBadge.textContent = `${currentInBlock}/${blockSize}`;

      span.insertAdjacentElement("afterend", counterBadge);
      return;
    }
  }
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

  state = createInitialState();

  const selectors = getSelectors();
  const container = resolveStepContainer(selectors.stepContainer);
  if (!container) {
    console.warn("[duel-analyzer] step container not found", {
      configured: selectors.stepContainer,
      fallback: GODVILLE_CONTAINER_FALLBACK,
    });
    return;
  }

  const knownNodes = new WeakSet<Node>();
  let sequence = 0;

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

  for (const stepNum of sortedStepNums) {
    const nodes = stepGroupsMap.get(stepNum)!;
    sequence += 1;
    await processStepGroup(nodes, sequence);
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

  render(state, isBattleOver() || isFinalPageLoad());
}

async function processStepGroup(nodes: Node[], fallbackNumber: number): Promise<void> {
  const rawStep = extractStepGroup(nodes, fallbackNumber);
  if (!rawStep) return;

  const recognised = recognise(rawStep);

  const unknownPhrases = recognised.unknownPhrases;
  if (unknownPhrases.length > 0) {
    const items = buildUnknownPhraseItems({
      phrases: unknownPhrases,
      stepNumber: rawStep.number,
      lang: "ru",
    });
    try {
      await unknownPhraseReporter.report(items);
    } catch (error) {
      console.warn("[duel-analyzer] unknown phrase report failed", error);
    }
  }

  if (rawStep.number <= 3 && state.config.condition === "DEFAULT") {
    const condition = detectCondition(rawStep.texts);
    applyConfig(state, condition);
  }

  applyEvents(state, rawStep, recognised);

  const blockSize = state.config.influenceBlock;
  if (recognised.hero.influenceResult !== undefined && recognised.hero.influenceText) {
    const used = state.hero.influenceActions.length;
    const posInBlock = ((used - 1) % blockSize) + 1;
    addInfluenceCounterToMatchedText(nodes, recognised.hero.influenceText, posInBlock, blockSize);
  }

  if (recognised.oppt.influenceResult !== undefined && recognised.oppt.influenceText) {
    const used = state.oppt.influenceActions.length;
    const posInBlock = ((used - 1) % blockSize) + 1;
    addInfluenceCounterToMatchedText(nodes, recognised.oppt.influenceText, posInBlock, blockSize);
  }
  
  render(state, isBattleOver() || isFinalPageLoad());
}

void bootstrap();
