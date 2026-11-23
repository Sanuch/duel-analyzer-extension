import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";

const patterns = {
  voice: [{ pattern: "повинуясь гласу, .* быстренько читает короткую молитву", result: "PRAY" }],
  influence: [{ pattern: "Сч.т на табло замигал и изменился в пользу героя", result: "HEAL" }],
  miracle: [], conditions: [], emptyStep: [],
};
const bundle = await build({
  entryPoints: [new URL("../src/core/recogniser.ts", import.meta.url).pathname],
  bundle: true, write: false, format: "esm", platform: "node",
  plugins: [{
    name: "test-resources",
    setup(builder) {
      builder.onResolve({ filter: /resourcesClient$/ }, () => ({ path: "resources", namespace: "test" }));
      builder.onLoad({ filter: /.*/, namespace: "test" }, () => ({
        contents: `export const getPatterns = () => (${JSON.stringify(patterns)});`,
      }));
    },
  }],
});
const { recognise } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].contents).toString("base64")}`);
const step = (myTexts) => ({ number: 22, texts: myTexts, myTexts, oppTexts: [], neutralTexts: [] });

test("quoted influence text is a voice and does not hide a real influence", () => {
  const voiceLine = "Хорошо поставленный голос с неба произнёс: «Счёт на табло замигал и изменился в пользу героя Вродлива Пaдла. Счастливец благодарит своего бога за зелёнку».";
  const influenceLine = "Счёт на табло замигал и изменился в пользу героя Бзянка. Счастливица благодарит своего бога.";
  for (const lines of [[voiceLine], [voiceLine, influenceLine], [influenceLine, voiceLine]]) {
    const result = recognise(step(lines));
    assert.equal(result.hero.voiceResult, "NONE");
    assert.equal(result.hero.voiceText, voiceLine);
    assert.equal(result.hero.influenceResult, lines.length === 1 ? undefined : "HEAL");
    assert.equal(result.events.filter((event) => event.type === "INFLUENCE").length, lines.length - 1);
  }
});

test("prayer response is counted as a triggered voice", () => {
  const result = recognise(step([
    "Глас с небес произнёс: «Молись!».",
    "➥ Повинуясь гласу, Вродлива Падла быстренько читает короткую молитву.",
  ]));
  assert.equal(result.hero.voiceResult, "PRAY");
  assert.equal(result.events.find((event) => event.type === "VOICE")?.voiceResult, "PRAY");
});
