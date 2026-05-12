/**
 * Phrase Collector — собирает нераспознанные фразы из боевого лога.
 * Временная заглушка для анализа и отладки.
 */

export interface CollectedPhrase {
  phrase: string;
  timestamp: string;
  battleId?: string;
  arena?: "odd" | "even";
  isInfluence?: boolean;
  count: number; // сколько раз встречалась за сессию
}

const PHRASES_KEY = "duelAnalyzerPhrases";

class PhraseCollector {
  private phrases: Map<string, CollectedPhrase> = new Map();

  /**
   * Добавить нераспознанную фразу в сборщик
   */
  addPhrase(phrase: string, options: {
    arena?: "odd" | "even";
    isInfluence?: boolean;
    battleId?: string;
  } = {}): void {
    const key = phrase.toLowerCase().trim();
    const existing = this.phrases.get(key);

    if (existing) {
      existing.count += 1;
    } else {
      this.phrases.set(key, {
        phrase,
        timestamp: new Date().toISOString(),
        arena: options.arena,
        isInfluence: options.isInfluence,
        battleId: options.battleId,
        count: 1,
      });
    }

    // Логируем в консоль (debug-уровень)
    if (process.env.NODE_ENV !== "production") {
      console.debug(
        `[PhraseCollector] Unknown phrase: "${phrase}" (count: ${existing ? existing.count + 1 : 1})`
      );
    }
  }

  /**
   * Получить все собранные фразы
   */
  getAll(): CollectedPhrase[] {
    return Array.from(this.phrases.values());
  }

  /**
   * Получить статистику
   */
  getStats(): {
    totalUnique: number;
    totalOccurrences: number;
    byInfluence: { influence: number; regular: number };
  } {
    const all = this.getAll();
    const totalOccurrences = all.reduce((sum, p) => sum + p.count, 0);

    return {
      totalUnique: all.length,
      totalOccurrences,
      byInfluence: {
        influence: all.filter(p => p.isInfluence).reduce((s, p) => s + p.count, 0),
        regular: all.filter(p => !p.isInfluence).reduce((s, p) => s + p.count, 0),
      },
    };
  }

  /**
   * Сохранить в storage.local
   */
  async saveToStorage(): Promise<void> {
    const data = this.getAll();
    try {
      const browser = await import("webextension-polyfill");
      await browser.default.storage.local.set({
        [PHRASES_KEY]: data,
      });
    } catch (e) {
      console.warn("[PhraseCollector] Failed to save to storage:", e);
    }
  }

  /**
   * Загрузить из storage.local
   */
  async loadFromStorage(): Promise<void> {
    try {
      const browser = await import("webextension-polyfill");
      const stored = await browser.default.storage.local.get(PHRASES_KEY);
      const data = Array.isArray(stored[PHRASES_KEY])
        ? (stored[PHRASES_KEY] as CollectedPhrase[])
        : [];

      for (const phrase of data) {
        this.phrases.set(phrase.phrase.toLowerCase().trim(), phrase);
      }
    } catch (e) {
      console.warn("[PhraseCollector] Failed to load from storage:", e);
    }
  }

  /**
   * Очистить сборщик
   */
  clear(): void {
    this.phrases.clear();
  }

  /**
   * Экспортировать для отправки (JSON)
   */
  exportAsJson(): string {
    return JSON.stringify(this.getAll(), null, 2);
  }
}

export const phraseCollector = new PhraseCollector();
