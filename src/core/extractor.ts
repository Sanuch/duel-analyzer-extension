import type { RawStep } from "./model";

/**
 * Extracts a single RawStep from a group of DOM nodes that share the same data-t (step number).
 * All nodes should belong to the same step. Texts are categorized by their container class:
 * - "infl"     → hero's actions (voice command/response or influence)
 * - "opp_infl" → opponent's actions
 * - neither    → neutral (combat text, step context)
 */
export function extractStepGroup(nodes: Node[], fallbackNumber: number): RawStep | null {
  const elements = nodes.filter((n): n is HTMLElement => n instanceof HTMLElement);
  if (elements.length === 0) return null;

  // Get step number from the first element that has the attribute
  let number = fallbackNumber;
  for (const el of elements) {
    const n = Number(el.getAttribute("data-step") ?? el.getAttribute("data-t"));
    if (Number.isFinite(n) && n > 0) {
      number = n;
      break;
    }
  }

  const myTexts: string[] = [];
  const oppTexts: string[] = [];
  const neutralTexts: string[] = [];

  for (const el of elements) {
    const textContentEl = el.querySelector(".text_content");
    const isInfl = textContentEl instanceof HTMLElement && textContentEl.classList.contains("infl");
    const isOppInfl = textContentEl instanceof HTMLElement && textContentEl.classList.contains("opp_infl");

    const phraseNodes = Array.from(el.querySelectorAll(".text_content .t"));
    const texts = phraseNodes
      .map((node) => node.textContent?.trim() ?? "")
      .filter(Boolean);

    // Fallback: use innerText if no .t spans found
    if (texts.length === 0 && el instanceof HTMLElement) {
      const raw = el.innerText?.trim();
      if (raw) {
        texts.push(
          ...raw
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean),
        );
      }
    }

    if (isInfl) {
      myTexts.push(...texts);
    } else if (isOppInfl) {
      oppTexts.push(...texts);
    } else {
      neutralTexts.push(...texts);
    }
  }

  const allTexts = [...neutralTexts, ...myTexts, ...oppTexts];
  if (allTexts.length === 0) return null;

  return {
    number,
    texts: allTexts,
    neutralTexts,
    myTexts,
    oppTexts,
  };
}
