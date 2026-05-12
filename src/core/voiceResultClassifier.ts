import voiceResource from "../../../phrases/resources/voice.json";
import voiceResultGroupsResource from "../../../phrases/resources/voice-result-groups.json";
import type { VoiceResult } from "./model";

type VoiceResultWithPatterns = Exclude<VoiceResult, "NONE" | "UNKNOWN">;

interface VoiceResourceShape {
  data: {
    patterns: string[];
  };
}

interface VoiceResultGroupsShape {
  data: {
    resultOrder: VoiceResultWithPatterns[];
    groups: Record<VoiceResultWithPatterns, number[][]>;
  };
}

const voicePatterns = (voiceResource as VoiceResourceShape).data.patterns;
const groupsConfig = (voiceResultGroupsResource as VoiceResultGroupsShape).data;

const compiledByResult = buildCompiledGroups(voicePatterns, groupsConfig.groups);

export function classifyVoiceResult(text: string): VoiceResult {
  for (const result of groupsConfig.resultOrder) {
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