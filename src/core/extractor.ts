import type { RawStep } from "./model";

export function extractStep(node: Node, fallbackNumber: number): RawStep | null {
  if (!(node instanceof HTMLElement)) {
    return null;
  }

  const stepNumberFromAttr = Number(node.getAttribute("data-step") ?? node.getAttribute("data-t"));
  const number = Number.isFinite(stepNumberFromAttr) && stepNumberFromAttr > 0
    ? stepNumberFromAttr
    : fallbackNumber;

  const text = node.innerText?.trim();
  if (!text) {
    return null;
  }

  const texts = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  return {
    number,
    texts
  };
}
