import { heroHealthIndex } from "../core/extractor";

/** Marks the spans added by the plugin, so they can be replaced without touching the page's own. */
const MARK = "da-hp-delta";

/**
 * Shows the HP change of the step next to the health of each player in the page's stats
 * blocks, in the same markup the page uses for a finished log (`span.hpd`). Only for a live
 * log: a finished one already has these spans.
 */
export function renderHealthDelta(delta: { hero: number | null; oppt: number | null }): void {
  const heroIndex = heroHealthIndex();
  const opptIndex = heroIndex === 0 ? 1 : 0;
  placeDelta(`#hp${heroIndex}`, delta.hero);
  placeDelta(`#hp${opptIndex}`, delta.oppt);
}

function placeDelta(hpSelector: string, delta: number | null): void {
  const hp = document.querySelector(hpSelector);
  hp?.parentElement?.querySelectorAll(`.${MARK}`).forEach((node) => node.remove());
  if (!hp || delta === null || delta === 0) {
    return;
  }

  const span = document.createElement("span");
  span.className = `hpd ${delta > 0 ? "hpd_green" : "hpd_red"} ${MARK}`;
  span.textContent = delta > 0 ? `+${delta}` : `${delta}`;
  hp.before(span);
}
