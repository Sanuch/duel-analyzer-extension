import { VERSION } from './version';
import { versionChecker } from './version-checker';

/**
 * Инициализирует проверку версии при запуске плагина
 */
type ChromeApi = {
  tabs?: {
    query: (queryInfo: Record<string, never>, callback: (tabs: Array<{ id?: number }>) => void) => void;
    sendMessage: (tabId: number, message: unknown, responseCallback?: () => void) => void;
  };
};

export async function initializeVersionCheck(): Promise<void> {
  console.log(`🔌 Plugin loaded. Version: ${VERSION}`);

  try {
    const versionInfo = await versionChecker.checkForUpdates();

    if (versionInfo.isOutdated) {
      console.warn(
        `⚠️  New version available: ${versionInfo.latest} (current: ${versionInfo.current})`,
      );

      // Отправляем уведомление в content script
      const chromeApi = (globalThis as { chrome?: ChromeApi }).chrome;
      if (chromeApi?.tabs) {
        chromeApi.tabs.query({}, (tabs) => {
          tabs.forEach((tab) => {
            if (tab.id) {
              chromeApi.tabs?.sendMessage(
                tab.id,
                {
                  type: 'VERSION_UPDATE_AVAILABLE',
                  current: versionInfo.current,
                  latest: versionInfo.latest,
                  updateUrl: versionInfo.updateUrl,
                },
                () => {
                  // Ignore errors, tab might not have content script
                },
              );
            }
          });
        });
      }
    } else {
      console.log(`✓ Plugin is up to date`);
    }
  } catch (error) {
    console.error('Failed to check for updates:', error);
  }
}

/**
 * Экспортирует текущую версию для использования в других модулях
 */
export { VERSION } from './version';
export type { VersionInfo } from './version-checker';
export { versionChecker } from './version-checker';
