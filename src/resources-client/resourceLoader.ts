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

const SUPPORTED_MANIFEST_SCHEMA = "2.0";
const SUPPORTED_RESOURCE_SCHEMA = "2.0";

// ─── Manifest ────────────────────────────────────────────────────────────────

export async function fetchManifest(url: string): Promise<ResourceManifest> {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Manifest fetch failed: ${response.status} ${response.statusText}`);
  }
  const json: unknown = await response.json();
  const manifest = validateManifest(json);
  return resolveManifestUrls(manifest, url);
}

function resolveManifestUrls(manifest: ResourceManifest, manifestUrl: string): ResourceManifest {
  return {
    ...manifest,
    files: manifest.files.map((entry) => ({
      ...entry,
      url: new URL(entry.url, manifestUrl).toString(),
    })),
  };
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
  console.log(`Starting fetch for resource: ${entry.url}`);
  try {
    const response = await fetch(entry.url, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Failed to fetch resource: ${entry.url}, status: ${response.status}`);
    }

    const data = await response.json();
    console.log(`Fetched resource successfully: ${entry.url}`);

    // Validate and cache the resource
    const validated = validateResourceFile(data, entry.lang, entry.type);
    await writeToCache(validated);
    console.log(`Resource cached: ${entry.type} (${entry.lang}), version: ${entry.dataVersion}`);
  } catch (error) {
    console.error(`Error fetching resource: ${entry.url}`, error);
  }
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

  const rawMeta = (raw as { meta?: unknown }).meta;
  const metaRecord =
    typeof rawMeta === "object" && rawMeta !== null
      ? (rawMeta as { lang?: unknown; type?: unknown })
      : {};
  const actualLang =
    typeof metaRecord.lang === "string" ? (metaRecord.lang as ResourceLang) : expectedLang;
  const actualType =
    typeof metaRecord.type === "string" ? (metaRecord.type as ResourceType) : "";

  if (actualLang !== expectedLang || actualType !== expectedType) {
    throw new Error(
      `Resource meta mismatch: expected ${expectedLang}/${expectedType}, ` +
        `got ${actualLang}/${actualType}`,
    );
  }

  if (file.meta.lang !== actualLang || file.meta.type !== actualType) {
    return {
      ...file,
      meta: {
        lang: expectedLang,
        type: expectedType,
      },
    };
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
