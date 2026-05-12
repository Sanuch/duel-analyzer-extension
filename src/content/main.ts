import { applyConfig, applyEvents } from "../core/calculator";
import { extractStep } from "../core/extractor";
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

function isLiveDuelMode(): boolean {
  const url = new URL(window.location.href);
  const isDuelLog = /\/duels\/log\//.test(url.pathname);
  return isDuelLog && url.searchParams.get("u") === "1";
}

async function bootstrap(): Promise<void> {
  if (!isLiveDuelMode()) {
    return;
  }

  await initResources(PHRASES_MANIFEST_URL);

  // В live-режиме страница полностью перезагружается, поэтому
  // пересчитываем состояние заново из текущего DOM.
  state = createInitialState();

  const selectors = getSelectors();
  const container = document.querySelector(selectors.stepContainer);
  if (!(container instanceof HTMLElement)) {
    return;
  }

  const knownNodes = new WeakSet<Node>();
  let sequence = 0;

  // Process existing steps once on startup, пропуская уже обработанные
  for (const node of Array.from(container.querySelectorAll(selectors.stepItem))) {
    if (!knownNodes.has(node)) {
      sequence += 1;
      // extractStep даст номер шага, сравниваем с state.currentStep
      const rawStep = extractStep(node, sequence);
      if (rawStep && rawStep.number > state.currentStep) {
        await processStepNode(node, sequence);
        knownNodes.add(node);
      }
    }
  }

  const observer = new MutationObserver(async (records) => {
    for (const record of records) {
      for (const node of Array.from(record.addedNodes)) {
        if (knownNodes.has(node)) {
          continue;
        }

        sequence += 1;
        const rawStep = extractStep(node, sequence);
        if (rawStep && rawStep.number > state.currentStep) {
          await processStepNode(node, sequence);
          knownNodes.add(node);
        }
      }
    }
  });

  observer.observe(container, {
    childList: true,
    subtree: false
  });

  render(state);
}

async function processStepNode(node: Node, fallbackNumber: number): Promise<void> {
  const rawStep = extractStep(node, fallbackNumber);
  if (!rawStep) {
    return;
  }

  const recognised = recognise(rawStep);

  if (recognised.unknownPhrases.length > 0) {
    const items = buildUnknownPhraseItems({
      phrases: recognised.unknownPhrases,
      stepNumber: rawStep.number,
      lang: "ru",
    });
    await unknownPhraseReporter.report(items);
  }

  // Detect duel condition from early steps (condition text appears in step 1-3)
  if (rawStep.number <= 3 && state.config.condition === "DEFAULT") {
    const condition = detectCondition(rawStep.texts);
    applyConfig(state, condition);
  }

  applyEvents(state, rawStep, recognised);
  render(state);
}

void bootstrap();
