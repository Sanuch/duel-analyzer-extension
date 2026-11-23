import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";

// Player action lines from step 48 of the saved duel log; no local fixture needed.
const myTexts = [
  "Судья вдруг закатил глаза и возопил: «Бей!».",
  "Бродячий Сис-админ вдруг ощущает переизбыток электричества в организме и выпускает его через пальцы в противника красивыми молниями.",
];
const oppTexts = [
  "Глас с небес вдруг произнес: «бей».",
  "Бродячий Сис-админ сбит с толку: метящий в него метеорит в последний момент отклонился от курса и задел обоих соперников сразу. Аккуратнее, Pyrokines!",
];
const patterns = {
  voice: [], miracle: [], conditions: [], emptyStep: [],
  influence: [
    { pattern: "ощущает переизбыток электричества в организме", result: "ATTACK" },
    { pattern: "метеорит в последний момент отклонился от курса и задел обоих соперников", result: "MUTUAL" },
  ],
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

test("step 48: recognise each player's voice and influence", () => {
  const result = recognise({ number: 48, texts: [...myTexts, ...oppTexts], myTexts, oppTexts, neutralTexts: [] });
  assert.equal(result.hero.voiceResult, "NONE");
  assert.equal(result.hero.voiceText, myTexts[0]);
  assert.equal(result.hero.influenceResult, "ATTACK");
  assert.equal(result.hero.influenceText, myTexts[1]);
  assert.equal(result.oppt.voiceResult, "NONE");
  assert.equal(result.oppt.voiceText, oppTexts[0]);
  assert.equal(result.oppt.influenceResult, "MUTUAL");
  assert.equal(result.oppt.influenceText, oppTexts[1]);
});
