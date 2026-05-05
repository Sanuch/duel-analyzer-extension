import { getPatterns } from "../resources-client/resourcesClient";
import type { CompiledPatterns, ResourceLang } from "../resources-client/types";
import type { RawStep, StepEvent } from "./model";

export function recognise(
  step: RawStep,
  lang: ResourceLang = "ru",
  patterns?: CompiledPatterns,
): StepEvent[] {
  const p = patterns ?? getPatterns(lang);

  return step.texts.map((text) => {
    if (matchesAny(text, p.miracle)) return { type: "MIRACLE", text };
    if (matchesAny(text, p.influence)) return { type: "INFLUENCE", text };
    if (matchesAny(text, p.voice)) return { type: "VOICE", text };
    return { type: "UNKNOWN", text };
  });
}

function matchesAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}
