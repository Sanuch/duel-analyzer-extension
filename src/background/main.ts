import browser from "webextension-polyfill";
import { refreshResources } from "../resources-client/resourcesClient";

/**
 * Remote manifest URL.
 * Empty string disables remote fetching (development / no-server mode).
 * Replace with the actual URL when the server is available.
 */
const RESOURCES_MANIFEST_URL = "";

const REFRESH_ALARM = "da-resources-refresh";
/** Refresh interval in minutes (60 min = once per hour). */
const REFRESH_INTERVAL_MINUTES = 60;

// ─── Resource refresh helpers ─────────────────────────────────────────────────

async function triggerRefresh(): Promise<void> {
  if (!RESOURCES_MANIFEST_URL) {
    return;
  }
  try {
    await refreshResources(RESOURCES_MANIFEST_URL);
  } catch (err) {
    console.warn("[duel-analyzer] resource refresh failed:", err);
  }
}

// ─── Lifecycle ────────────────────────────────────────────────────────────────

browser.runtime.onInstalled.addListener(() => {
  // Schedule periodic refresh on first install / update.
  void browser.alarms.create(REFRESH_ALARM, {
    periodInMinutes: REFRESH_INTERVAL_MINUTES,
  });

  // Eagerly refresh resources right after install/update.
  void triggerRefresh();
});

browser.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === REFRESH_ALARM) {
    void triggerRefresh();
  }
});

// ─── Message bus ──────────────────────────────────────────────────────────────

browser.runtime.onMessage.addListener((message: unknown) => {
  if (
    typeof message === "object" &&
    message !== null &&
    "type" in message &&
    message.type === "duel-analyzer.ping"
  ) {
    return Promise.resolve({ ok: true, ts: Date.now() });
  }

  return undefined;
});
