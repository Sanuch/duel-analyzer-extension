import { localResources } from "../resources-client/localResources";
import type { RawStep, StepEvent } from "./model";

export function recognise(step: RawStep): StepEvent[] {
  return step.texts.map((text) => {
    if (matchesAny(text, localResources.patterns.miracle)) {
      return { type: "MIRACLE", text };
    }

    if (matchesAny(text, localResources.patterns.influence)) {
      return { type: "INFLUENCE", text };
    }

    if (matchesAny(text, localResources.patterns.voice)) {
      return { type: "VOICE", text };
    }

    if (matchesAny(text, localResources.patterns.empty)) {
      return { type: "EMPTY", text };
    }

    return { type: "UNKNOWN", text };
  });
}

function matchesAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}
