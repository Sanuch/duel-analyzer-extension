import { getInfluenceBlockStats, getVoiceBlockStats } from "../core/calculator";
import type { BattleState, PlayerState } from "../core/model";

const ROOT_ID = "duel-analyzer-live-panel";
const STYLE_ID = "duel-analyzer-style";

function formatPlayerBlocks(player: PlayerState, config: BattleState["config"]): string {
  const v = getVoiceBlockStats(player.voiceActions, config.voiceBlock);
  const i = getInfluenceBlockStats(player.influenceActions, config.influenceBlock, player.availableInfluences);

  const influencePart = `influence ${i.total}/${i.blockSize}, bad=${i.bad > 0 ? "yes" : "no"}`;
  const voicePart = config.voiceBlock === 0
    ? "voice disabled (DEAFENING)"
    : `voice thrown=${v.total}, passed=${v.good}`;

  return `${influencePart}; ${voicePart}`;
}

export function render(state: BattleState): void {
  ensureStyle();

  const appBar = document.getElementById("app_bar");
  if (!appBar || !appBar.parentElement) {
    return;
  }

  let root = document.getElementById(ROOT_ID) as HTMLElement | null;
  if (!root) {
    root = document.createElement("section");
    root.id = ROOT_ID;
    appBar.insertAdjacentElement("afterend", root);
  }

  const conditionLabel = state.config.condition !== "DEFAULT"
    ? `<div class="da-condition">${state.config.condition}</div>`
    : `<div class="da-condition">DEFAULT</div>`;

  root.innerHTML = `
    <div class="da-card">
      <h3>Duel Analyzer Live</h3>
      ${conditionLabel}
      <div class="da-blocks">
        <div><strong>Hero</strong>: ${formatPlayerBlocks(state.hero, state.config)}</div>
        <div><strong>Oppt</strong>: ${formatPlayerBlocks(state.oppt, state.config)}</div>
      </div>
    </div>
  `;
}

function ensureStyle(): void {
  if (document.getElementById(STYLE_ID)) {
    return;
  }

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    #duel-analyzer-live-panel {
      margin: 8px 0 10px;
      font-family: -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif;
      width: 100%;
    }

    #duel-analyzer-live-panel .da-card {
      background: #f8fbff;
      border: 1px solid #c9d8e8;
      border-radius: 6px;
      color: #1e2b3a;
      padding: 8px 10px;
    }

    #duel-analyzer-live-panel h3 {
      margin: 0 0 4px;
      font-size: 13px;
      letter-spacing: 0.03em;
      text-transform: uppercase;
    }

    #duel-analyzer-live-panel .da-blocks {
      font-size: 12px;
      line-height: 1.7;
      font-family: monospace;
    }

    #duel-analyzer-live-panel .da-condition {
      font-size: 11px;
      color: #7a4d00;
      margin-bottom: 4px;
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }
  `;

  document.head.append(style);
}
