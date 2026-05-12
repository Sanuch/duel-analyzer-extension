import { VERSION, VERSION_CHECK_URL } from './version';

export interface VersionInfo {
  current: string;
  latest: string;
  isOutdated: boolean;
  updateUrl?: string;
}

export class VersionChecker {
  private cacheKey = 'version_check_cache';
  private cacheDuration = 24 * 60 * 60 * 1000; // 24 часа

  /**
   * Проверяет доступность новой версии плагина
   */
  async checkForUpdates(): Promise<VersionInfo> {
    const cached = this.getCachedVersion();
    if (cached) {
      return cached;
    }

    try {
      const response = await fetch(VERSION_CHECK_URL);
      if (!response.ok) {
        console.warn('Failed to fetch version info');
        return this.defaultResponse();
      }

      const data = await response.json() as { tag_name?: string; html_url?: string };
      const latestVersion = data.tag_name?.replace(/^v/, '') || '';

      const result: VersionInfo = {
        current: VERSION,
        latest: latestVersion,
        isOutdated: this.compareVersions(VERSION, latestVersion) < 0,
        updateUrl: data.html_url,
      };

      this.cacheVersion(result);
      return result;
    } catch (error) {
      console.error('Version check error:', error);
      return this.defaultResponse();
    }
  }

  /**
   * Сравнивает две версии
   * Возвращает: -1 если v1 < v2, 0 если v1 === v2, 1 если v1 > v2
   */
  private compareVersions(v1: string, v2: string): number {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);

    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const num1 = parts1[i] || 0;
      const num2 = parts2[i] || 0;

      if (num1 < num2) return -1;
      if (num1 > num2) return 1;
    }

    return 0;
  }

  private defaultResponse(): VersionInfo {
    return {
      current: VERSION,
      latest: VERSION,
      isOutdated: false,
    };
  }

  private getCachedVersion(): VersionInfo | null {
    try {
      const cached = localStorage.getItem(this.cacheKey);
      if (!cached) return null;

      const data = JSON.parse(cached) as { version: VersionInfo; timestamp: number };
      if (Date.now() - data.timestamp > this.cacheDuration) {
        localStorage.removeItem(this.cacheKey);
        return null;
      }

      return data.version;
    } catch {
      return null;
    }
  }

  private cacheVersion(version: VersionInfo): void {
    try {
      localStorage.setItem(
        this.cacheKey,
        JSON.stringify({
          version,
          timestamp: Date.now(),
        }),
      );
    } catch {
      // Ignore cache errors
    }
  }
}

export const versionChecker = new VersionChecker();
