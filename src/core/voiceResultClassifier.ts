import { getVoicePatternSources, getVoiceResultGroups } from "../resources-client/resourcesClient";
import type { ResourceLang } from "../resources-client/types";
import type { VoiceResult } from "./model";

type VoiceResultWithPatterns = Exclude<VoiceResult, "NONE" | "UNKNOWN">;

export function classifyVoiceResult(text: string, lang: ResourceLang = "ru"): VoiceResult {
  const voicePatterns = getVoicePatternSources(lang);
  const groupsConfig = getVoiceResultGroups();
  const compiledByResult = buildCompiledGroups(voicePatterns, groupsConfig.groups);

  for (const resultRaw of groupsConfig.resultOrder) {
    const result = resultRaw as VoiceResultWithPatterns;
    const patterns = compiledByResult[result] ?? [];
    if (patterns.some((pattern) => pattern.test(text))) {
      return result;
    }
  }

  return "UNKNOWN";
}

function buildCompiledGroups(
  patterns: string[],
  groups: Record<VoiceResultWithPatterns, number[][]>,
): Record<VoiceResultWithPatterns, RegExp[]> {
  const out = {} as Record<VoiceResultWithPatterns, RegExp[]>;

  for (const [result, ranges] of Object.entries(groups) as [VoiceResultWithPatterns, number[][]][]) {
    const groupPatterns: RegExp[] = [];

    for (const range of ranges) {
      if (range.length < 2) continue;
      const from = range[0];
      const to = range[1];
      const safeFrom = Math.max(0, from);
      const safeTo = Math.min(patterns.length, to);
      for (let i = safeFrom; i < safeTo; i++) {
        groupPatterns.push(new RegExp(patterns[i], "i"));
      }
    }

    out[result] = groupPatterns;
  }

  return out;
}