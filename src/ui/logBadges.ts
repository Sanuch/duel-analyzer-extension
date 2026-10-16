import type { BattleConfig, InfluenceResult, ResultEnvelope, VoiceResult } from "../core/model";

const BADGE_CLASS = "da-badge";
const STYLE_ID = "duel-analyzer-badge-style";

const SIDE_NAME = { hero: "Hero", oppt: "Oppt" } as const;
type Side = keyof typeof SIDE_NAME;

/** A step of the log: its recognised result and the DOM rows it comes from. */
export interface BadgeStep {
  number: number;
  nodes: Node[];
  envelope: ResultEnvelope;
}

/**
 * Puts a small counter after every counted influence and voice of the log: `2/6` for the
 * second influence of the block (`2/6 ✗` when it is a "кривое" one), `7/10` for a voice
 * (`7/10 ✓` when it worked). Colour and tooltip say which is which, so every number of the
 * panel can be traced to its lines. Counters are numbered over the whole log, so they do not
 * depend on the step shown by the replay.
 *
 * The badges are plain spans next to the phrase inside its row.
 */
export function markLog(steps: BadgeStep[], config: BattleConfig): void {
  ensureStyle();

  for (const step of steps) {
    for (const node of step.nodes) {
      if (node instanceof HTMLElement) {
        node.querySelectorAll(`.${BADGE_CLASS}`).forEach((badge) => badge.remove());
      }
    }
  }

  const ordinals: Record<Side, { influence: number; voice: number }> = {
    hero: { influence: 0, voice: 0 },
    oppt: { influence: 0, voice: 0 },
  };

  for (const step of [...steps].sort((a, b) => a.number - b.number)) {
    const used = new Set<HTMLElement>();

    for (const side of ["hero", "oppt"] as const) {
      const result = step.envelope[side];

      if (result.influenceResult !== undefined && result.influenceText) {
        const ordinal = ++ordinals[side].influence;
        const size = config.influenceBlock;
        const backfire = isBackfire(result.influenceResult);
        const position = positionInBlock(ordinal, size);

        append(step, used, result.influenceText, {
          text: `${position}/${size}${backfire ? " ✗" : ""}`,
          title:
            `${SIDE_NAME[side]}: влияние №${ordinal} (шаг ${step.number}), ` +
            `${position}-е в блоке из ${size}` +
            (backfire ? ". Кривое: пустое, общее или против себя" : ""),
          modifier: backfire ? "da-badge-backfire" : "da-badge-influence",
        });
      }

      if (result.voiceResult !== undefined && result.voiceText) {
        const ordinal = ++ordinals[side].voice;
        const size = config.voiceBlock;
        const worked = isWorked(result.voiceResult);
        const position = size > 0 ? positionInBlock(ordinal, size) : ordinal;

        append(step, used, result.voiceText, {
          text: `${size > 0 ? `${position}/${size}` : position}${worked ? " ✓" : ""}`,
          title:
            `${SIDE_NAME[side]}: глас №${ordinal} (шаг ${step.number})` +
            (size > 0 ? `, ${position}-е в блоке из ${size}` : "") +
            `. ${worked ? "Сработал: на него есть ответ" : "Не сработал: ответа нет"}`,
          modifier: "da-badge-voice",
        });
      }
    }
  }
}

function isBackfire(result: InfluenceResult): boolean {
  return result === "ANTI" || result === "EMPTY" || result === "MUTUAL";
}

function isWorked(result: VoiceResult): boolean {
  return result !== "NONE" && result !== "UNKNOWN";
}

function positionInBlock(ordinal: number, size: number): number {
  return size > 0 ? ((ordinal - 1) % size) + 1 : ordinal;
}

function normalize(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ").replace(/ё/g, "е");
}

interface Badge {
  text: string;
  title: string;
  modifier: string;
}

/** Finds the row of the phrase in the step (each row at most once) and appends the badge to it. */
function append(step: BadgeStep, used: Set<HTMLElement>, phrase: string, badge: Badge): void {
  const target = normalize(phrase);

  for (const node of step.nodes) {
    if (!(node instanceof HTMLElement)) {
      continue;
    }

    for (const span of Array.from(node.querySelectorAll<HTMLElement>(".text_content .t"))) {
      if (used.has(span) || normalize(span.textContent ?? "") !== target) {
        continue;
      }

      used.add(span);
      const element = document.createElement("span");
      element.className = `${BADGE_CLASS} ${badge.modifier}`;
      element.textContent = badge.text;
      element.title = badge.title;
      span.insertAdjacentElement("afterend", element);
      return;
    }
  }
}

function ensureStyle(): void {
  if (document.getElementById(STYLE_ID)) {
    return;
  }

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .${BADGE_CLASS} {
      display: inline-block;
      margin-left: 4px;
      padding: 0 5px;
      border: 1px solid transparent;
      border-radius: 8px;
      font: bold 10px/15px Verdana, Helvetica, Arial, sans-serif;
      white-space: nowrap;
      vertical-align: baseline;
      cursor: help;
    }

    .${BADGE_CLASS}.da-badge-influence { color: #2a6db5; background: #e8f0fb; border-color: #c4d8f3; }
    .${BADGE_CLASS}.da-badge-backfire { color: #b03a2e; background: #fde8e6; border-color: #f3c4bf; }
    .${BADGE_CLASS}.da-badge-voice { color: #2e7d32; background: #e8f5e9; border-color: #c3e2c5; }
  `;

  document.head.append(style);
}
