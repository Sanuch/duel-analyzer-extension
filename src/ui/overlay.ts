import { getInfluenceBlockStats, getVoiceBlockStats, stepAmplification } from "../core/calculator";
import type { BattleState, DuelCondition, PlayerState, StepHealthChange, StepSummary } from "../core/model";
import browser from "webextension-polyfill";

const ROOT_ID = "duel-analyzer-live-panel";
const STYLE_ID = "duel-analyzer-style";
const UPLOAD_BTN_ID = "duel-analyzer-upload-btn";
const UPLOAD_STATUS_ID = "duel-analyzer-upload-status";
const COLLAPSED_KEY = "duelAnalyzerCollapsed";
const POSITION_KEY = "duelAnalyzerPosition";
const COIN = "🪙";
const EMPTY = "🟡";

const HINTS = {
  health: "Здоровье в % от максимума. В скобках — с поправкой на усиление после 60-го шага",
  influence: "Влияния в текущем блоке. В скобках — номера кривых влияний в блоке",
  available: "В квадратных скобках — сколько влияний доступно сейчас",
  voice:
    "Гласы в текущем блоке. В скобках — сколько из них сработало (на глас был ответ); после двоеточия — экстра-гласы: сработавшие сверх трёх за блок, за вычетом недобора в прошлых блоках",
  prana: "Потраченная прана",
  healthChange: "Изменение здоровья за шаг в % от максимума. В скобках — с поправкой на усиление",
  empty: "Пустой шаг: никто не действовал, в логе только вспомогательные тексты (антракт, трибуны, судья)",
  coin: "Монетка: шаг с дополнительной строкой действия в логе (после 3-го шага две обычные строки, при «ходят вместе» — три)",
} as const;

/** Special conditions of a duel, as shown in the header (the default one is not shown). */
const CONDITIONS: Partial<Record<DuelCondition, { name: string; hint: string }>> = {
  DEAFENING: { name: "Вопли зрителей", hint: "Богов не слышно: гласов нет" },
  TOGETHER: { name: "Ходят вместе", hint: "Герои ходят вместе, дуэль идёт вдвое быстрее" },
  ANTIDOME: { name: "Антибожественный купол", hint: "Боги чаще промахиваются, блок влияний — 4" },
  CRAZY_SQUIRRELS: { name: "Озверевшие белки", hint: "Герои теряют здоровье" },
  LIMIT_INFLUENCE: { name: "Влияния ограничены", hint: "Не больше двух односторонних влияний" },
  LIMIT_UNPACK: { name: "Лимит распаковки", hint: "Нельзя распаковать больше трёх зарядов" },
  PRAYING: { name: "Намаливание", hint: "Можно намаливать богам прану" },
  BRICKS: { name: "Золотые кирпичи", hint: "В призовой фонд идут золотые кирпичи" },
  RESOURCE: { name: "Полезный ресурс", hint: "Победитель получает ресурс для ковчега" },
  EXTRA_GOLD: { name: "Призовой фонд", hint: "Дополнительный призовой фонд" },
};

type Layout = "inline" | "float";

let lastRender: { state: BattleState; battleOver: boolean } | null = null;
let collapsed = readCollapsed();

/** Status of the log upload; kept here because the panel is redrawn on every step of a replay. */
const uploadView = { text: "", className: "da-upload-status", disabled: false };

function isDuelLogPage(): boolean {
  return /^\/duels\/log\/[^/]+$/i.test(window.location.pathname);
}

// ─── Log upload ──────────────────────────────────────────────────────────────

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

function setUploadView(text: string, className: string, disabled: boolean): void {
  uploadView.text = text;
  uploadView.className = className;
  uploadView.disabled = disabled;

  const statusEl = document.getElementById(UPLOAD_STATUS_ID);
  if (statusEl) {
    statusEl.textContent = text;
    statusEl.className = className;
  }

  const btn = document.getElementById(UPLOAD_BTN_ID) as HTMLButtonElement | null;
  if (btn) {
    btn.disabled = disabled;
  }
}

async function uploadLog(): Promise<void> {
  setUploadView("Отправка...", "da-upload-status da-upload-pending", true);

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
        setUploadView("✓ Лог получен, пройдите captcha", "da-upload-status da-upload-ok", true);
        window.location.href = confirmUrl;
      } else {
        setUploadView("✓ Лог получен", "da-upload-status da-upload-ok", true);
      }
    } else {
      const status = response && typeof response === "object" && "status" in response
        ? String(response.status)
        : "unknown";
      const body = response && typeof response === "object" && "body" in response
        ? String(response.body ?? "")
        : "";
      setUploadView(toCompactUploadError(status, body), "da-upload-status da-upload-err", false);
    }
  } catch (err) {
    const message = err instanceof Error && err.message
      ? err.message
      : "Сеть недоступна";
    setUploadView(`✗ ${message}`, "da-upload-status da-upload-err", false);
  }
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

// ─── Rendering ───────────────────────────────────────────────────────────────

/**
 * Two layouts for the same card:
 * - live log (no replay slider): at the top of the central column, above the log and
 *   level with the hero blocks;
 * - finished log (replay slider present): a small collapsible, draggable window in the
 *   bottom right corner (the top right is taken by the replay controls).
 */
export function render(state: BattleState, battleOver = false): void {
  ensureStyle();
  lastRender = { state, battleOver };

  const layout: Layout = document.getElementById("slider") ? "float" : "inline";
  const root = ensureRoot(layout);
  if (!root) {
    return;
  }

  root.innerHTML = renderCard(state, battleOver && isDuelLogPage(), battleOver);
}

function ensureRoot(layout: Layout): HTMLElement | null {
  let root = document.getElementById(ROOT_ID);
  if (!root) {
    root = document.createElement("section");
    root.id = ROOT_ID;
    root.addEventListener("click", onClick);
    root.addEventListener("pointerdown", onPointerDown);
  }

  root.className = layout === "inline" ? "da-inline" : "da-float";
  if (layout === "float") {
    applySavedPosition(root);
    if (root.parentNode !== document.body) {
      document.body.append(root);
    }
    return root;
  }

  clearPosition(root);
  const centralBlock = document.getElementById("central_block");
  const appBar = document.getElementById("app_bar");
  const host = centralBlock ?? appBar?.parentElement;
  if (!host) {
    return null;
  }

  if (host.firstChild !== root) {
    host.insertBefore(root, host.firstChild);
  }

  return root;
}

function onClick(event: Event): void {
  if (!(event.target instanceof Element)) {
    return;
  }

  if (event.target.closest(`#${UPLOAD_BTN_ID}`)) {
    void uploadLog();
    return;
  }

  if (event.target.closest("[data-da-toggle]")) {
    collapsed = !collapsed;
    writeCollapsed(collapsed);
    if (lastRender) {
      render(lastRender.state, lastRender.battleOver);
    }
  }
}

function renderCard(state: BattleState, canUpload: boolean, battleOver: boolean): string {
  const header = `
    <div class="da-head">
      <div class="da-head-row">
        <strong class="da-title">Duel Analyzer</strong>
        <span class="da-step">шаг ${formatStep(state)}</span>
        <button type="button" class="da-toggle" data-da-toggle title="${collapsed ? "Развернуть" : "Свернуть"}">${collapsed ? "+" : "–"}</button>
      </div>
      ${headerNotes(state)}
    </div>
  `;

  if (collapsed) {
    return `<div class="da-card">${header}</div>`;
  }

  const recent = state.steps
    .slice()
    .reverse()
    .map(
      (item) =>
        `<tr><th>#${item.number}${stepMarks(item)}</th><td>${formatHealthChange(item.heroHealth)}</td><td>${formatHealthChange(item.opptHealth)}</td></tr>`,
    )
    .join("");

  return `
    <div class="da-card">
      ${header}
      <table class="da-table">
        <thead>
          <tr>
            <th></th>
            ${playerHead("Hero", "da-hero", state.hero)}
            ${playerHead("Oppt", "da-oppt", state.oppt)}
          </tr>
        </thead>
        <tbody>
          ${row("Зд", HINTS.health, formatHealth(state.hero, state), formatHealth(state.oppt, state))}
          ${row("Вл", HINTS.influence, formatInfluences(state.hero, state), formatInfluences(state.oppt, state))}
          ${row("Гл", HINTS.voice, formatVoices(state.hero, state), formatVoices(state.oppt, state))}
          ${row("Пр", HINTS.prana, state.hero.powerCounter, state.oppt.powerCounter)}
        </tbody>
      </table>
      <div class="da-recent-title" title="${HINTS.healthChange}">Последние шаги</div>
      <div class="da-recent" title="${HINTS.healthChange}">
        <table class="da-table"><tbody>${recent}</tbody></table>
      </div>
      ${renderUploadSection(canUpload, battleOver)}
    </div>
  `;
}

function renderUploadSection(canUpload: boolean, battleOver: boolean): string {
  if (canUpload) {
    return `
      <div class="da-upload">
        <button id="${UPLOAD_BTN_ID}" class="da-upload-btn"${uploadView.disabled ? " disabled" : ""}>↑ Отправить лог на сервер</button>
        <span id="${UPLOAD_STATUS_ID}" class="${uploadView.className}">${escapeHtml(uploadView.text)}</span>
      </div>
    `;
  }

  if (battleOver) {
    return `
      <div class="da-upload">
        <span id="${UPLOAD_STATUS_ID}" class="da-upload-status da-upload-pending">Отправка доступна только на странице лога дуэли</span>
      </div>
    `;
  }

  return "";
}

/** `Hero[3]`: the number in brackets is how many influences the god can use right now. */
function playerHead(name: string, cls: string, player: PlayerState): string {
  return `<th class="${cls}" title="${HINTS.available}">${name}[${player.availableInfluences}]</th>`;
}

function row(short: string, hint: string, hero: string | number, oppt: string | number): string {
  return `<tr><th><abbr title="${hint}">${short}</abbr></th><td>${hero}</td><td>${oppt}</td></tr>`;
}

// ─── Header ──────────────────────────────────────────────────────────────────

function formatStep(state: BattleState): string {
  return state.totalSteps > 0 ? `${state.currentStep} / ${state.totalSteps}` : `${state.currentStep}`;
}

function conditionBadge(state: BattleState): string {
  const condition = CONDITIONS[state.config.condition];
  return condition
    ? `<span class="da-condition" title="${condition.hint}">${condition.name}</span>`
    : "";
}

/** Warning that the step shown now is empty. */
function emptyStepWarning(state: BattleState): string {
  const current = state.steps[state.steps.length - 1];
  return current && current.number === state.currentStep && current.empty
    ? `<span class="da-empty" title="${HINTS.empty}">${EMPTY} Пустой шаг</span>`
    : "";
}

/** `🪙` for one coin, `3×🪙` for several. */
function coinBadge(state: BattleState): string {
  if (state.coins === 0) {
    return "";
  }

  const text = state.coins > 1 ? `${state.coins}×${COIN}` : COIN;
  return `<span class="da-coins" title="${HINTS.coin}">${text}</span>`;
}

/** Second line of the header: the duel condition, the empty step warning and the coin counter. */
function headerNotes(state: BattleState): string {
  const notes = `${conditionBadge(state)}${emptyStepWarning(state)}${coinBadge(state)}`;
  return notes ? `<div class="da-head-notes">${notes}</div>` : "";
}

/** Marks of a step in the list: 🟡 for an empty step, 🪙 for a coin. */
function stepMarks(item: StepSummary): string {
  const empty = item.empty ? `<span title="${HINTS.empty}">${EMPTY}</span>` : "";
  const coin = item.coin ? `<span title="${HINTS.coin}">${COIN}</span>` : "";
  return empty || coin ? ` ${empty}${coin}` : "";
}

// ─── Values ──────────────────────────────────────────────────────────────────

/** `30%`, and `30% (28%)` once the damage amplification (after the 60th step) is in effect. */
function formatHealth(player: PlayerState, state: BattleState): string {
  if (player.maxHealth <= 0) {
    return "–";
  }

  const percent = (player.health / player.maxHealth) * 100;
  const amplification = stepAmplification(state.currentStep);
  const text = `${Math.round(percent)}%`;
  return amplification > 1 ? `${text} (${Math.round(percent / amplification)}%)` : text;
}

/** `4/6` — used in the current block; `4/6(2)` — and the second one was a "кривое" influence. */
function formatInfluences(player: PlayerState, state: BattleState): string {
  const stats = getInfluenceBlockStats(
    player.influenceActions,
    state.config.influenceBlock,
    player.availableInfluences,
  );
  const backfire = stats.badPositions.length > 0 ? `(${stats.badPositions.join(",")})` : "";
  return `${stats.total}/${stats.blockSize}${backfire}`;
}

/** `7/10(3)` — 7 voices used in the block, 3 of them worked; `7/10(5:2)` — and 2 extra voices. */
function formatVoices(player: PlayerState, state: BattleState): string {
  if (state.config.voiceBlock === 0) {
    return "–";
  }

  const stats = getVoiceBlockStats(player.voiceActions, state.config.voiceBlock);
  const worked = stats.extra > 0 ? `${stats.good}:${stats.extra}` : `${stats.good}`;
  return `${stats.total}/${stats.blockSize}(${worked})`;
}

/** `-12%`, with the amplification-free value in brackets when there is an amplification: `-16% (-8%)`. */
function formatHealthChange(change: StepHealthChange): string {
  if (change.pct === null || Math.round(change.pct) === 0) {
    return "–";
  }

  const signed = (value: number): string => `${value > 0 ? "+" : ""}${Math.round(value)}%`;
  const effective = change.effectivePct !== null ? ` (${signed(change.effectivePct)})` : "";

  return `${signed(change.pct)}${effective}`;
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch] ?? ch);
}

// ─── Dragging (floating window only) ─────────────────────────────────────────

interface Position {
  left: number;
  top: number;
}

let dragOffset: { x: number; y: number } | null = null;

function onPointerDown(event: PointerEvent): void {
  const root = document.getElementById(ROOT_ID);
  if (
    !root ||
    !root.classList.contains("da-float") ||
    !(event.target instanceof Element) ||
    event.target.closest("[data-da-toggle]") ||
    !event.target.closest(".da-head")
  ) {
    return;
  }

  const rect = root.getBoundingClientRect();
  dragOffset = { x: event.clientX - rect.left, y: event.clientY - rect.top };
  event.preventDefault();

  // The header is re-rendered on every update, so follow the pointer on the document.
  document.addEventListener("pointermove", onPointerMove);
  document.addEventListener("pointerup", onPointerUp);
}

function onPointerMove(event: PointerEvent): void {
  const root = document.getElementById(ROOT_ID);
  if (!root || !dragOffset) {
    return;
  }

  setPosition(root, { left: event.clientX - dragOffset.x, top: event.clientY - dragOffset.y });
}

function onPointerUp(): void {
  document.removeEventListener("pointermove", onPointerMove);
  document.removeEventListener("pointerup", onPointerUp);
  dragOffset = null;

  const root = document.getElementById(ROOT_ID);
  if (root?.style.left) {
    writePosition({ left: parseFloat(root.style.left), top: parseFloat(root.style.top) });
  }
}

/** Keeps the window inside the viewport, whatever was saved or dragged. */
function setPosition(root: HTMLElement, position: Position): void {
  const maxLeft = Math.max(0, window.innerWidth - root.offsetWidth);
  const maxTop = Math.max(0, window.innerHeight - root.offsetHeight);

  root.style.left = `${Math.min(Math.max(0, position.left), maxLeft)}px`;
  root.style.top = `${Math.min(Math.max(0, position.top), maxTop)}px`;
  root.style.right = "auto";
  root.style.bottom = "auto";
}

function applySavedPosition(root: HTMLElement): void {
  if (root.style.left) {
    return;
  }

  const saved = readPosition();
  if (saved) {
    setPosition(root, saved);
  }
}

function clearPosition(root: HTMLElement): void {
  root.style.left = "";
  root.style.top = "";
  root.style.right = "";
  root.style.bottom = "";
}

function readPosition(): Position | null {
  try {
    const raw = window.localStorage.getItem(POSITION_KEY);
    const value: unknown = raw ? JSON.parse(raw) : null;
    if (
      typeof value === "object" &&
      value !== null &&
      typeof (value as Position).left === "number" &&
      typeof (value as Position).top === "number"
    ) {
      return value as Position;
    }
  } catch {
    // Unreadable or blocked storage: fall back to the default corner.
  }

  return null;
}

function writePosition(position: Position): void {
  try {
    window.localStorage.setItem(POSITION_KEY, JSON.stringify(position));
  } catch {
    // Storage may be blocked by the page; the position then only lives until reload.
  }
}

function readCollapsed(): boolean {
  try {
    return window.localStorage.getItem(COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
}

function writeCollapsed(value: boolean): void {
  try {
    window.localStorage.setItem(COLLAPSED_KEY, value ? "1" : "0");
  } catch {
    // Storage may be blocked by the page; the state then only lives until reload.
  }
}

// ─── Styles ──────────────────────────────────────────────────────────────────

function ensureStyle(): void {
  if (document.getElementById(STYLE_ID)) {
    return;
  }

  const root = `#${ROOT_ID}`;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    ${root} {
      box-sizing: border-box;
      color: #333;
      font: 12px/1.5 Verdana, Helvetica, Arial, sans-serif;
    }

    ${root} * {
      box-sizing: border-box;
    }

    ${root} .da-title {
      font-weight: bold;
    }

    ${root} .da-step {
      color: #666;
    }

    ${root} .da-hero {
      color: #2a6db5;
    }

    ${root} .da-oppt {
      color: #b03a2e;
    }

    ${root} abbr[title] {
      text-decoration: underline dotted;
      cursor: help;
    }

    /* Live log: the card at the top of the central column. */
    ${root}.da-inline {
      margin: 0 0 6px;
    }

    /* Finished log: small window in the bottom right (the top right has the replay controls). */
    ${root}.da-float {
      position: fixed;
      right: 16px;
      bottom: 16px;
      z-index: 99999;
      width: min(340px, calc(100vw - 32px));
    }

    ${root} .da-card {
      background: #fff;
      border: 1px solid #bbb;
      border-radius: 6px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.18);
      overflow: hidden;
    }

    ${root} .da-head {
      padding: 4px 8px;
      background: #eee;
      border-bottom: 1px solid #ddd;
    }

    ${root} .da-head-row {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    ${root}.da-float .da-head {
      cursor: move;
      user-select: none;
      touch-action: none;
    }

    ${root} .da-head .da-step {
      margin-left: auto;
    }

    ${root} .da-head-notes {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      justify-content: space-between;
      gap: 8px;
      font-size: 11px;
    }

    ${root} .da-condition {
      color: #8a5a00;
      cursor: help;
    }

    ${root} .da-empty {
      color: #8a6d00;
      font-weight: bold;
      cursor: help;
    }

    ${root} .da-coins {
      margin-left: auto;
      font-weight: bold;
      cursor: help;
    }

    ${root} .da-toggle {
      width: 20px;
      height: 20px;
      padding: 0;
      line-height: 16px;
      color: #555;
      background: #fff;
      border: 1px solid #bbb;
      border-radius: 4px;
      cursor: pointer;
    }

    ${root} .da-table {
      width: calc(100% - 16px);
      margin: 6px 8px;
      border-collapse: collapse;
    }

    ${root} .da-table th,
    ${root} .da-table td {
      padding: 2px 6px;
      text-align: right;
      font-weight: normal;
      border-bottom: 1px solid #eee;
    }

    ${root} .da-table th:first-child {
      width: 56px;
      text-align: left;
      font-weight: bold;
      white-space: nowrap;
    }

    ${root} .da-table thead th {
      font-weight: bold;
      border-bottom: 1px solid #ccc;
    }

    ${root} .da-recent-title {
      padding: 0 8px;
      font-weight: bold;
    }

    ${root}.da-float .da-recent {
      max-height: 140px;
      padding: 0 0 4px;
      overflow: auto;
    }

    ${root} .da-upload {
      margin: 0 8px 8px;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    ${root} .da-upload-btn {
      font-size: 12px;
      padding: 3px 10px;
      border: 1px solid #6b9cce;
      border-radius: 4px;
      background: #e8f2fc;
      color: #1a3a5c;
      cursor: pointer;
    }

    ${root} .da-upload-btn:hover:not(:disabled) {
      background: #d0e8f8;
    }

    ${root} .da-upload-btn:disabled {
      opacity: 0.5;
      cursor: default;
    }

    ${root} .da-upload-status {
      font-size: 12px;
    }

    ${root} .da-upload-pending { color: #666; }
    ${root} .da-upload-ok      { color: #2a7a2a; }
    ${root} .da-upload-err     { color: #b00020; }
  `;

  document.head.append(style);
}
