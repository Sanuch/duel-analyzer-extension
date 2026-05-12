import browser from "webextension-polyfill";
import { refreshResources } from "../resources-client/resourcesClient";

/**
 * Remote manifest URL.
 * Empty string disables remote fetching (development / no-server mode).
 * Replace with the actual URL when the server is available.
 */
const PHRASES_MANIFEST_URL = import.meta.env.VITE_PHRASES_MANIFEST_URL ?? "";
const LOGS2_API_URL = import.meta.env.VITE_LOGS2_API_URL ?? "https://gvl.sanuch.name";

const REFRESH_ALARM = "da-resources-refresh";
/** Refresh interval in minutes (60 min = once per hour). */
const REFRESH_INTERVAL_MINUTES = 60;

// ─── Resource refresh helpers ─────────────────────────────────────────────────

async function triggerRefresh(): Promise<void> {
  if (!PHRASES_MANIFEST_URL) {
    return;
  }
  try {
    await refreshResources(PHRASES_MANIFEST_URL);
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

  if (
    typeof message === "object" &&
    message !== null &&
    "type" in message &&
    message.type === "duel-analyzer.upload-log" &&
    "html" in message &&
    typeof message.html === "string"
  ) {
    return (async () => {
      try {
        const baseUrl = LOGS2_API_URL.replace(/\/$/, "");
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };

        const response = await fetch(`${baseUrl}/duels/upload/pending`, {
          method: "POST",
          headers,
          body: JSON.stringify({ html: message.html }),
        });

        const text = await response.text();
        if (!response.ok) {
          return {
            ok: false,
            status: response.status,
            body: text.slice(0, 500),
          };
        }

        let data: unknown = null;
        try {
          data = text ? JSON.parse(text) : null;
        } catch {
          data = { raw: text };
        }

        return {
          ok: true,
          status: response.status,
          data,
        };
      } catch (error) {
        return {
          ok: false,
          status: 0,
          body: error instanceof Error ? error.message : String(error),
        };
      }
    })();
  }

  return undefined;
});
