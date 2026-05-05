import browser from "webextension-polyfill";

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
