/**
 * Система версионирования плагина
 * 
 * ## Использование
 * 
 * 1. **Обновление базовой версии:**
 *    Отредактируйте `VERSION.json` для изменения major/minor версии
 * 
 * 2. **Сборка с автоматической версией:**
 *    ```bash
 *    npm run build
 *    ```
 *    Это выполнит `version:generate` перед сборкой, который:
 *    - Прочитает VERSION.json
 *    - Сгенерирует patch версию на основе timestamp
 *    - Обновит package.json
 *    - Создаст src/core/version.ts
 * 
 * 3. **Проверка обновлений в плагине:**
 *    ```typescript
 *    import { versionChecker } from '@core/version-checker';
 *    
 *    const versionInfo = await versionChecker.checkForUpdates();
 *    if (versionInfo.isOutdated) {
 *      console.log('New version available:', versionInfo.latest);
 *      console.log('Download at:', versionInfo.updateUrl);
 *    }
 *    ```
 * 
 * ## Структура версии
 * 
 * Полная версия: `MAJOR.MINOR.PATCH`
 * - **MAJOR**: Задается в VERSION.json, изменяется вручную для больших обновлений
 * - **MINOR**: Задается в VERSION.json, изменяется вручную для новых функций
 * - **PATCH**: Автоматически генерируется при каждой сборке на основе timestamp
 * 
 * ## Конфигурация
 * 
 * В `src/core/version.ts` обновите `VERSION_CHECK_URL` на ваш репозиторий:
 * ```
 * https://api.github.com/repos/YOUR_USERNAME/YOUR_REPO/releases/latest
 * ```
 * 
 * ## Кеширование
 * 
 * Результаты проверки версии кешируются на 24 часа в localStorage
 */
