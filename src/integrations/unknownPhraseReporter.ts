import browser from "webextension-polyfill";
import type { ResourceLang } from "../resources-client/types";

const UNKNOWN_QUEUE_KEY = "duelAnalyzerUnknownPhraseQueue";
const UNKNOWN_QUEUE_LIMIT = 300;

export interface UnknownPhraseItem {
  phrase: string;
  stepNumber: number;
  lang: ResourceLang;
  ts: number;
  dedupKey: string;
}

export interface UnknownPhraseReporter {
  report(items: UnknownPhraseItem[]): Promise<void>;
}

export interface FutureExternalApiContract {
  endpoint: string;
  auth: {
    mode: "none" | "bearer" | "api-key";
    headerName?: string;
  };
  retry: {
    maxAttempts: number;
    backoffMs: number;
    strategy: "linear" | "exponential";
  };
  dedup: {
    keyField: "dedupKey";
    ttlSeconds: number;
  };
}

const FUTURE_EXTERNAL_API_CONTRACT: FutureExternalApiContract = {
  endpoint: "",
  auth: {
    mode: "none",
  },
  retry: {
    maxAttempts: 3,
    backoffMs: 1000,
    strategy: "exponential",
  },
  dedup: {
    keyField: "dedupKey",
    ttlSeconds: 86400,
  },
};

/**
 * Feature flag for future real integration.
 * Keep disabled until external API is ready and validated.
 */
const ENABLE_REAL_UNKNOWN_REPORTING = false;

export function createUnknownPhraseReporter(): UnknownPhraseReporter {
  if (ENABLE_REAL_UNKNOWN_REPORTING) {
    return new RealUnknownPhraseReporter(FUTURE_EXTERNAL_API_CONTRACT);
  }

  return new StubUnknownPhraseReporter();
}

class StubUnknownPhraseReporter implements UnknownPhraseReporter {
  async report(items: UnknownPhraseItem[]): Promise<void> {
    if (items.length === 0) {
      return;
    }

    const state = await browser.storage.local.get(UNKNOWN_QUEUE_KEY);
    const current: UnknownPhraseItem[] = Array.isArray(state[UNKNOWN_QUEUE_KEY])
      ? (state[UNKNOWN_QUEUE_KEY] as UnknownPhraseItem[])
      : [];

    const next = [...current, ...items].slice(-UNKNOWN_QUEUE_LIMIT);

    await browser.storage.local.set({
      [UNKNOWN_QUEUE_KEY]: next,
    });

    console.debug("[duel-analyzer] unknown phrases queued", {
      added: items.length,
      total: next.length,
    });
  }
}

/**
 * Placeholder for future external integration.
 * Contract is defined, network sending remains disabled by feature flag.
 */
class RealUnknownPhraseReporter implements UnknownPhraseReporter {
  constructor(private readonly contract: FutureExternalApiContract) {}

  async report(items: UnknownPhraseItem[]): Promise<void> {
    if (items.length === 0) {
      return;
    }

    console.warn("[duel-analyzer] real unknown reporter is not implemented yet", {
      endpointConfigured: Boolean(this.contract.endpoint),
      items: items.length,
    });
  }
}

export function buildUnknownPhraseItems(params: {
  phrases: string[];
  stepNumber: number;
  lang: ResourceLang;
}): UnknownPhraseItem[] {
  const { phrases, stepNumber, lang } = params;

  return phrases.map((phrase) => {
    const normalized = phrase.trim().toLowerCase();
    return {
      phrase,
      stepNumber,
      lang,
      ts: Date.now(),
      dedupKey: `${lang}:${stepNumber}:${normalized}`,
    };
  });
}
