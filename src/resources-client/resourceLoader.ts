import type {
  ManifestEntry,
  PatternData,
  ResourceFile,
  ResourceLang,
  ResourceManifest,
  ResourceType,
  SelectorsData,
  ThresholdsData,
} from "./types";
import { getCacheVersions, makeCacheKey, writeToCache } from "./resourceCache";

const SUPPORTED_MANIFEST_SCHEMA = "1.0";
const SUPPORTED_RESOURCE_SCHEMA = "1.0";

// ─── Manifest ────────────────────────────────────────────────────────────────

export async function fetchManifest(url: string): Promise<ResourceManifest> {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Manifest fetch failed: ${response.status} ${response.statusText}`);
  }
  const json: unknown = await response.json();
  return validateManifest(json);
}

function validateManifest(raw: unknown): ResourceManifest {
  if (
    typeof raw !== "object" ||
    raw === null ||
    typeof (raw as Record<string, unknown>)["schemaVersion"] !== "string" ||
    typeof (raw as Record<string, unknown>)["updatedAt"] !== "string" ||
    !Array.isArray((raw as Record<string, unknown>)["files"])
  ) {
    throw new Error("Invalid manifest format");
  }

  const manifest = raw as ResourceManifest;
  if (manifest.schemaVersion !== SUPPORTED_MANIFEST_SCHEMA) {
    throw new Error(
      `Unsupported manifest schemaVersion: ${manifest.schemaVersion}. Expected: ${SUPPORTED_MANIFEST_SCHEMA}`,
    );
  }

  return manifest;
}

// ─── Selective loading ───────────────────────────────────────────────────────

/**
 * Downloads only files whose dataVersion differs from what's already cached.
 * Each file is validated (schema + checksum) before being written to cache.
 */
export async function loadChangedResources(manifest: ResourceManifest): Promise<void> {
  const cachedVersions = await getCacheVersions();

  for (const entry of manifest.files) {
    const key = makeCacheKey(entry.lang, entry.type);
    if (cachedVersions[key] === entry.dataVersion) {
      continue; // already up to date
    }

    await fetchAndCacheEntry(entry);
  }
}

// ─── Single-file fetch ───────────────────────────────────────────────────────

async function fetchAndCacheEntry(entry: ManifestEntry): Promise<void> {
  const response = await fetch(entry.url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(
      `Resource fetch failed [${entry.lang}/${entry.type}]: ${response.status} ${response.statusText}`,
    );
  }

  const bodyText = await response.text();

  const actualChecksum = await computeSha256Hex(bodyText);
  const expectedChecksum = entry.checksum.startsWith("sha256:")
    ? entry.checksum.slice(7)
    : entry.checksum;

  if (actualChecksum !== expectedChecksum) {
    throw new Error(
      `Checksum mismatch for [${entry.lang}/${entry.type}]: ` +
        `expected ${expectedChecksum}, got ${actualChecksum}`,
    );
  }

  const json: unknown = JSON.parse(bodyText);
  const file = validateResourceFile(json, entry.lang, entry.type);
  await writeToCache(file);
}

// ─── Validation ──────────────────────────────────────────────────────────────

function validateResourceFile(
  raw: unknown,
  expectedLang: ResourceLang,
  expectedType: ResourceType,
): ResourceFile<PatternData | SelectorsData | ThresholdsData> {
  if (
    typeof raw !== "object" ||
    raw === null ||
    typeof (raw as Record<string, unknown>)["schemaVersion"] !== "string" ||
    typeof (raw as Record<string, unknown>)["dataVersion"] !== "string" ||
    typeof (raw as Record<string, unknown>)["checksum"] !== "string" ||
    typeof (raw as Record<string, unknown>)["meta"] !== "object" ||
    (raw as Record<string, unknown>)["meta"] === null ||
    (raw as Record<string, unknown>)["data"] === undefined
  ) {
    throw new Error(
      `Invalid resource file format for [${expectedLang}/${expectedType}]`,
    );
  }

  const file = raw as ResourceFile<PatternData | SelectorsData | ThresholdsData>;

  if (file.schemaVersion !== SUPPORTED_RESOURCE_SCHEMA) {
    throw new Error(
      `Unsupported resource schemaVersion "${file.schemaVersion}" ` +
        `for [${expectedLang}/${expectedType}]`,
    );
  }

  if (file.meta.lang !== expectedLang || file.meta.type !== expectedType) {
    throw new Error(
      `Resource meta mismatch: expected ${expectedLang}/${expectedType}, ` +
        `got ${file.meta.lang}/${file.meta.type}`,
    );
  }

  return file;
}

// ─── Crypto ──────────────────────────────────────────────────────────────────

async function computeSha256Hex(text: string): Promise<string> {
  const encoded = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
