/** Language codes supported by the resource system. */
export type ResourceLang = "ru" | "en";

/**
 * All resource types.
 * Pattern-based types compile to RegExp[] and feed the recogniser.
 * Structural types (selectors, thresholds) carry typed data.
 */
export type ResourceType =
  | "influence"
  | "miracle"
  | "voice"
  | "conditions"
  | "voice-result-groups"
  | "selectors"
  | "thresholds";

/** Pattern-based resource types that map to CompiledPatterns fields. */
export type PatternResourceType = "influence" | "miracle" | "voice" | "conditions";

export interface ResourceMeta {
  lang: ResourceLang;
  type: ResourceType;
}

/** Envelope for every resource file fetched from the remote manifest. */
export interface ResourceFile<T> {
  schemaVersion: string;
  dataVersion: string;
  /** SHA-256 hex digest of canonical JSON for data payload, optionally prefixed with "sha256:". */
  checksum: string;
  meta: ResourceMeta;
  data: T;
}

/** `data` shape for pattern-based resource files. */
export interface PatternData {
  /** Plain regex source strings (no delimiters). Case-insensitive flag applied on load. */
  patterns: string[];
}

/** `data` shape for the selectors resource file. */
export interface SelectorsData {
  stepContainer: string;
  stepItem: string;
}

/** `data` shape for the thresholds resource file. */
export interface ThresholdsData {
  [key: string]: number;
}

/** `data` shape for voice result grouping config. */
export interface VoiceResultGroupsData {
  resultOrder: string[];
  groups: Record<string, number[][]>;
}

/** Single entry in the remote resource manifest. */
export interface ManifestEntry {
  lang: ResourceLang;
  type: ResourceType;
  dataVersion: string;
  /** SHA-256 hex digest of canonical JSON for data payload, optionally prefixed with "sha256:". */
  checksum: string;
  url: string;
}

/** Remote manifest format — index of all available resource files. */
export interface ResourceManifest {
  schemaVersion: string;
  updatedAt: string;
  files: ManifestEntry[];
}

/** Compiled RegExp patterns ready for the recogniser. */
export interface CompiledPatterns {
  influence: RegExp[];
  miracle: RegExp[];
  voice: RegExp[];
  conditions: RegExp[];
}

/** The resolved view of all resources the rest of the app consumes. */
export interface ResolvedResources {
  patterns: Record<ResourceLang, CompiledPatterns>;
  voicePatternSources: Record<ResourceLang, string[]>;
  voiceResultGroups: VoiceResultGroupsData;
  selectors: SelectorsData;
  thresholds: ThresholdsData;
}
