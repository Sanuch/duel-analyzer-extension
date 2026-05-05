import { applyEvents } from "../core/calculator";
import { extractStep } from "../core/extractor";
import { createInitialState } from "../core/model";
import { recognise } from "../core/recogniser";
import { saveBattleSnapshot } from "../integrations/historyStorage";
import { getSelectors, initResources } from "../resources-client/resourcesClient";
import { render } from "../ui/overlay";

const state = createInitialState();

async function bootstrap(): Promise<void> {
  await initResources();

  const selectors = getSelectors();
  const container = document.querySelector(selectors.stepContainer);
  if (!(container instanceof HTMLElement)) {
    return;
  }

  const knownNodes = new WeakSet<Node>();
  let sequence = 0;

  // Process existing steps once on startup.
  for (const node of Array.from(container.querySelectorAll(selectors.stepItem))) {
    if (!knownNodes.has(node)) {
      sequence += 1;
      await processStepNode(node, sequence);
      knownNodes.add(node);
    }
  }

  const observer = new MutationObserver(async (records) => {
    for (const record of records) {
      for (const node of Array.from(record.addedNodes)) {
        if (knownNodes.has(node)) {
          continue;
        }

        sequence += 1;
        await processStepNode(node, sequence);
        knownNodes.add(node);
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

  const events = recognise(rawStep);
  applyEvents(state, rawStep, events);
  render(state);
  await saveBattleSnapshot(state);
}

void bootstrap();
