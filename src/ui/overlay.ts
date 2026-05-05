import type { BattleState } from "../core/model";

const ROOT_ID = "duel-analyzer-overlay";
const STYLE_ID = "duel-analyzer-style";

export function render(state: BattleState): void {
  ensureStyle();

  let root = document.getElementById(ROOT_ID);
  if (!root) {
    root = document.createElement("aside");
    root.id = ROOT_ID;
    document.body.append(root);
  }

  const recentSteps = state.steps
    .slice()
    .reverse()
    .map((item) => `<li>#${item.number} H:${item.heroAction} | O:${item.opptAction}</li>`)
    .join("");

  root.innerHTML = `
    <div class="da-card">
      <h3>Duel Analyzer</h3>
      <div class="da-grid">
        <div><strong>Hero HP:</strong> ${state.hero.health}</div>
        <div><strong>Oppt HP:</strong> ${state.oppt.health}</div>
        <div><strong>Hero Power:</strong> ${state.hero.powerCounter}</div>
        <div><strong>Oppt Power:</strong> ${state.oppt.powerCounter}</div>
      </div>
      <div><strong>Last 5 steps</strong></div>
      <ol>${recentSteps}</ol>
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
    #duel-analyzer-overlay {
      position: fixed;
      top: 16px;
      right: 16px;
      z-index: 99999;
      font-family: -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif;
      width: min(320px, calc(100vw - 32px));
    }

    #duel-analyzer-overlay .da-card {
      background: rgba(13, 17, 28, 0.93);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 12px;
      color: #f5f6fa;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
      padding: 12px;
    }

    #duel-analyzer-overlay h3 {
      margin: 0 0 8px;
      font-size: 14px;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }

    #duel-analyzer-overlay .da-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6px;
      margin-bottom: 10px;
      font-size: 13px;
    }

    #duel-analyzer-overlay ol {
      margin: 8px 0 0;
      padding-inline-start: 18px;
      max-height: 160px;
      overflow: auto;
      font-size: 12px;
    }

    #duel-analyzer-overlay li {
      margin: 0 0 4px;
    }
  `;

  document.head.append(style);
}
