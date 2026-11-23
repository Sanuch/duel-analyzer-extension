import type { HealthPoint, RawStep } from "./model";

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

// ─── Step counter and health shown by the page ───────────────────────────────

const TURN_COUNTER_SELECTOR = "#turn_num";

export interface HealthSnapshot {
  hero: { health: number; maxHealth: number };
  oppt: { health: number; maxHealth: number };
}

/** Step shown by the page: `#turn_num` follows the replay slider and the head of a live log. */
export function extractCurrentStep(): number | null {
  const value = Number(document.querySelector(TURN_COUNTER_SELECTOR)?.textContent?.trim());
  return Number.isInteger(value) && value > 0 ? value : null;
}

/**
 * Health of both players as currently rendered by the page (replay updates `#hpN` on
 * every step switch). The hero is the player whose stats block is `#hero1_stats`; its
 * hp index is not guaranteed to be 0.
 */
export function extractHealth(): HealthSnapshot | null {
  const heroIndex = heroHealthIndex();
  const opptIndex = heroIndex === 0 ? 1 : 0;

  const hero = readHealth(heroIndex);
  const oppt = readHealth(opptIndex);
  return hero && oppt ? { hero, oppt } : null;
}

export function heroHealthIndex(): 0 | 1 {
  return document.querySelector("#hero1_stats #hp1") ? 1 : 0;
}

/**
 * A finished log carries the health of both players after every step in an inline
 * script (`var hp = {"0": {"0": 476, "1": 476}, "1": {...}, ...}`). Empty for live logs.
 */
export function extractHealthTimeline(): Map<number, HealthPoint> {
  const timeline = new Map<number, HealthPoint>();

  for (const script of Array.from(document.scripts)) {
    const match = /var\s+hp\s*=\s*(\{[\s\S]*?\})\s*;/.exec(script.textContent ?? "");
    if (!match) {
      continue;
    }

    let raw: unknown;
    try {
      raw = JSON.parse(match[1]);
    } catch {
      continue;
    }

    if (typeof raw !== "object" || raw === null) {
      continue;
    }

    const heroIndex = String(heroHealthIndex());
    const opptIndex = heroIndex === "0" ? "1" : "0";

    for (const [key, value] of Object.entries(raw)) {
      const step = Number(key);
      if (!Number.isInteger(step) || step < 0 || typeof value !== "object" || value === null) {
        continue;
      }

      const points = value as Record<string, unknown>;
      const hero = toHealth(points[heroIndex]) ?? toHealth(points[opptIndex]);
      const oppt = toHealth(points[opptIndex]) ?? toHealth(points[heroIndex]);
      if (hero !== null && oppt !== null) {
        timeline.set(step, { hero, oppt });
      }
    }

    break;
  }

  return timeline;
}

function toHealth(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** Id of the battle, the last segment of `/duels/log/<id>`. */
export function extractBattleId(): string {
  return location.pathname.split("/").filter(Boolean).pop() ?? "";
}

function readHealth(index: number): { health: number; maxHealth: number } | null {
  const health = readNumber(`#hp${index}`);
  const maxHealth = readNumber(`#hpm${index}`);
  return health === null || maxHealth === null ? null : { health, maxHealth };
}

function readNumber(selector: string): number | null {
  const value = Number(document.querySelector(selector)?.textContent?.trim());
  return Number.isFinite(value) ? value : null;
}
