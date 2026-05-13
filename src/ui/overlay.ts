import { getInfluenceBlockStats, getVoiceBlockStats } from "../core/calculator";
import type { BattleState, PlayerState } from "../core/model";
import browser from "webextension-polyfill";

const ROOT_ID = "duel-analyzer-live-panel";
const STYLE_ID = "duel-analyzer-style";
const UPLOAD_BTN_ID = "duel-analyzer-upload-btn";
const UPLOAD_STATUS_ID = "duel-analyzer-upload-status";

function isDuelLogPage(): boolean {
  return /^\/duels\/log\/[^/]+$/i.test(window.location.pathname);
}

interface PlayerCells {
  influence: string;
  voice: string;
  health: string;
}

function formatPlayerBlocks(player: PlayerState, config: BattleState["config"], stepNumber: number): PlayerCells {
  const v = getVoiceBlockStats(player.voiceActions, config.voiceBlock);
  const i = getInfluenceBlockStats(player.influenceActions, config.influenceBlock, player.availableInfluences);
  const health = formatHealthPercent(player.health, stepNumber, player.name);

  const influenceSuffix = i.badPositions.length > 0 ? `(${i.badPositions.join(",")})` : "";
  const influence = `влияния ${i.total}/${i.blockSize}${influenceSuffix}`;
  const voice = config.voiceBlock === 0
    ? "гласы 0/0"
    : `гласы ${v.good}/${v.total}${v.extra > 0 ? `(${v.extra})` : ""}`;

  return { influence, voice, health: `здоровье ${health}` };
}

function renderPlayerRow(label: string, available: number, cells: PlayerCells): string {
  const lbl = available > 0 ? `${label}[${available}]` : label;
  return `<span class="da-lbl">${lbl}</span><span>${cells.influence}</span><span>${cells.voice}</span><span>${cells.health}</span>`;
}

function formatHealthPercent(_rawHealth: number, stepNumber: number, side: string): string {
  const suffix = side === "HERO" ? "0" : "1";
  const currentHealth = Number(document.getElementById(`hp${suffix}`)?.textContent ?? "");
  const maxHealth = Number(document.getElementById(`hpm${suffix}`)?.textContent ?? "");
  if (!Number.isFinite(currentHealth) || !Number.isFinite(maxHealth) || maxHealth <= 0) {
    return "—";
  }

  if (currentHealth <= 1) return "0";
  const stepFactor = getStepCoefficient(stepNumber);
  const percent = currentHealth / maxHealth * 100 / stepFactor;
  return `${Math.max(0, percent).toFixed(1)}%`;
}

function getStepCoefficient(stepNumber: number): number {
  return stepNumber <= 60 ? 1 : 1 + (stepNumber - 60) * 0.02;
}

function looksLikeLoginPage(url: string, html: string): boolean {
  const lowerUrl = url.toLowerCase();
  const urlLooksLikeLogin = /\/(login|signin|auth|session|users\/sign_in|oauth)\b/.test(lowerUrl);

  const hasPasswordField = /type=["']password["']|name=["']password["']/i.test(html);
  const hasAuthFormMarker = /<form[^>]+(login|signin|auth|session)|id=["'][^"']*(login|signin|auth)|class=["'][^"']*(login|signin|auth)/i.test(html);
  const hasLoginWords = /(войти|вход|логин|пароль|sign in|log in|login|password)/i.test(html);

  return urlLooksLikeLogin || (hasPasswordField && (hasAuthFormMarker || hasLoginWords));
}

function looksLikeArenaLogPage(html: string): boolean {
  return /id=["']last_items_arena["']|Вести с арены/i.test(html);
}

async function fetchCleanLogHtml(): Promise<string> {
  const response = await fetch(window.location.href, {
    method: "GET",
    credentials: "include",
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Не удалось получить исходный лог (HTTP ${response.status})`);
  }

  const html = await response.text();
  if (!html.trim()) {
    throw new Error("Не удалось получить исходный лог");
  }

  if (looksLikeLoginPage(response.url, html)) {
    throw new Error("Сессия истекла: вместо лога получена страница входа. Авторизуйтесь и повторите попытку");
  }

  if (!looksLikeArenaLogPage(html)) {
    const redirectHint = response.redirected ? ` (redirect: ${response.url})` : "";
    throw new Error(`Вместо страницы лога получен другой документ${redirectHint}`);
  }

  return html;
}

async function uploadLog(): Promise<void> {
  const btn = document.getElementById(UPLOAD_BTN_ID) as HTMLButtonElement | null;
  const statusEl = document.getElementById(UPLOAD_STATUS_ID);
  if (!btn || !statusEl) return;

  btn.disabled = true;
  statusEl.textContent = "Отправка...";
  statusEl.className = "da-upload-status da-upload-pending";

  try {
    const html = await fetchCleanLogHtml();
    const response = await browser.runtime.sendMessage({
      type: "duel-analyzer.upload-log",
      html,
    });

    if (response && typeof response === "object" && "ok" in response && response.ok) {
      const data = ("data" in response ? response.data : null) as {
        pending_id?: string;
        confirm_url?: string;
      } | null;
      const confirmUrl = data?.confirm_url;
      if (confirmUrl) {
        statusEl.textContent = "✓ Лог получен, пройдите captcha";
        window.location.href = confirmUrl;
      } else {
        statusEl.textContent = "✓ Лог получен";
      }
      statusEl.className = "da-upload-status da-upload-ok";
    } else {
      const status = response && typeof response === "object" && "status" in response
        ? String(response.status)
        : "unknown";
      const body = response && typeof response === "object" && "body" in response
        ? String(response.body ?? "")
        : "";
        statusEl.textContent = toCompactUploadError(status, body);
      statusEl.className = "da-upload-status da-upload-err";
      btn.disabled = false;
    }
  } catch (err) {
    const message = err instanceof Error && err.message
      ? err.message
      : "Сеть недоступна";
    statusEl.textContent = `✗ ${message}`;
    statusEl.className = "da-upload-status da-upload-err";
    btn.disabled = false;
  }
}

export function render(state: BattleState, battleOver = false): void {
  ensureStyle();
  const canUpload = battleOver && isDuelLogPage();

  const appBar = document.getElementById("app_bar");
  const centralBlock = document.getElementById("central_block");
  if (!appBar || !appBar.parentElement) {
    return;
  }

  let root = document.getElementById(ROOT_ID) as HTMLElement | null;
  if (!root) {
    root = document.createElement("section");
    root.id = ROOT_ID;
  }

  const host = centralBlock ?? appBar.parentElement;
  if (host.firstChild) {
    host.insertBefore(root, host.firstChild);
  } else {
    host.appendChild(root);
  }

  const conditionLabel = state.config.condition !== "DEFAULT"
    ? `<div class="da-condition">${state.config.condition}</div>`
    : `<div class="da-condition">DEFAULT</div>`;

  const uploadSection = canUpload ? `
    <div class="da-upload">
      <button id="${UPLOAD_BTN_ID}" class="da-upload-btn">↑ Отправить лог на сервер</button>
      <span id="${UPLOAD_STATUS_ID}" class="da-upload-status"></span>
    </div>
  ` : battleOver ? `
    <div class="da-upload">
      <span id="${UPLOAD_STATUS_ID}" class="da-upload-status da-upload-pending">Отправка доступна только на странице лога дуэли</span>
    </div>
  ` : "";

  root.innerHTML = `
    <div class="da-card">
      <div class="da-header">
        <h3>Duel Analyzer Live</h3>
        ${conditionLabel}
      </div>
      <div class="da-blocks">
        ${renderPlayerRow("Hero", state.hero.availableInfluences, formatPlayerBlocks(state.hero, state.config, state.currentStep))}
        ${renderPlayerRow("Oppt", state.oppt.availableInfluences, formatPlayerBlocks(state.oppt, state.config, state.currentStep))}
      </div>
      ${uploadSection}
    </div>
  `;

  if (canUpload) {
    document.getElementById(UPLOAD_BTN_ID)?.addEventListener("click", () => {
      void uploadLog();
    });
  }
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
      box-sizing: border-box;
    }

    #duel-analyzer-live-panel .da-card {
      background: #f8fbff;
      border: 1px solid #c9d8e8;
      border-radius: 6px;
      color: #1e2b3a;
      padding: 8px 10px;
    }

    #duel-analyzer-live-panel .da-header {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 12px;
      margin: 0 0 4px;
    }

    #duel-analyzer-live-panel h3 {
      margin: 0;
      font-size: 13px;
      letter-spacing: 0.03em;
      text-transform: uppercase;
      flex: 1 1 auto;
    }

    #duel-analyzer-live-panel .da-blocks {
      display: grid;
      grid-template-columns: 4.5em 9em 8em auto;
      column-gap: 4px;
      font-size: 12px;
      line-height: 1.7;
      font-family: monospace;
    }

    #duel-analyzer-live-panel .da-lbl {
      font-weight: bold;
      white-space: nowrap;
    }

    #duel-analyzer-live-panel .da-condition {
      font-size: 11px;
      color: #7a4d00;
      margin: 0;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      white-space: nowrap;
      text-align: right;
      flex: 0 0 auto;
    }

    #duel-analyzer-live-panel .da-upload {
      margin-top: 8px;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    #duel-analyzer-live-panel .da-upload-btn {
      font-size: 12px;
      padding: 3px 10px;
      border: 1px solid #6b9cce;
      border-radius: 4px;
      background: #e8f2fc;
      color: #1a3a5c;
      cursor: pointer;
    }

    #duel-analyzer-live-panel .da-upload-btn:hover:not(:disabled) {
      background: #d0e8f8;
    }

    #duel-analyzer-live-panel .da-upload-btn:disabled {
      opacity: 0.5;
      cursor: default;
    }

    #duel-analyzer-live-panel .da-upload-status {
      font-size: 12px;
    }

    #duel-analyzer-live-panel .da-upload-pending { color: #666; }
    #duel-analyzer-live-panel .da-upload-ok      { color: #2a7a2a; }
    #duel-analyzer-live-panel .da-upload-err     { color: #b00020; }
  `;

  document.head.append(style);
}
  function toCompactUploadError(status: string, body: string): string {
    if (status === "429") {
      return "✗ Слишком много запросов. Попробуйте снова через минуту";
    }

    const trimmed = body.trim();
    const looksLikeHtml = /^<!doctype html>|^<html[\s>]/i.test(trimmed);

    if (!trimmed || looksLikeHtml) {
      return `✗ Ошибка ${status}`;
    }

    const normalized = trimmed.replace(/\s+/g, " ").slice(0, 140);
    return `✗ Ошибка ${status}: ${normalized}`;
  }
