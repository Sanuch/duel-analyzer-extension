# Версионирование плагина

## Обзор

Система версионирования позволяет:
- Управлять базовой версией (major.minor) через `VERSION.json`
- Автоматически генерировать patch версию при сборке
- Проверять наличие новых версий плагина
- Синхронизировать версию в `package.json` и манифестах браузера

## Файлы версионирования

### `VERSION.json`
Основной файл для управления базовой версией:
```json
{
  "major": 1,
  "minor": 0
}
```

### `scripts/version.js`
Скрипт, который запускается перед сборкой и:
1. Читает базовую версию из `VERSION.json`
2. Генерирует patch версию на основе timestamp
3. Обновляет `package.json`
4. Обновляет `manifests/manifest.chromium.json`
5. Обновляет `manifests/manifest.firefox.json`
6. Создает `src/core/version.ts` с константами версии

### `src/core/version.ts`
Автоматически генерируемый файл с экспортируемыми константами:
```typescript
export const VERSION = '1.0.1234';
export const VERSION_CHECK_URL = 'https://api.github.com/repos/YOUR_REPO/releases/latest';
```

### `src/core/version-checker.ts`
Класс для проверки новых версий с кешированием (24 часа)

### `src/core/version-manager.ts`
Менеджер версий с интеграцией в основной код плагина

## Процесс разработки

### Для регулярных сборок (autobump patch версии)
```bash
npm run build
```
Это выполнит:
1. `npm run version:generate` - обновит patch версию
2. `npm run build:chromium` - соберет плагин для Chrome

### Для больших изменений (обновление major/minor)
1. Отредактируйте `VERSION.json`:
   ```json
   {
     "major": 2,
     "minor": 0
   }
   ```
2. Выполните сборку:
   ```bash
   npm run build
   ```

### Для разработки с live reload
```bash
npm run dev
```
Версия будет обновлена автоматически при каждом изменении

## Использование версии в коде

### В background скрипте
```typescript
import { initializeVersionCheck, VERSION } from '@core/version-manager';

// При инициализации плагина
chrome.runtime.onInstalled.addListener(async () => {
  await initializeVersionCheck();
});
```

### Проверка версии вручную
```typescript
import { versionChecker } from '@core/version-checker';

const versionInfo = await versionChecker.checkForUpdates();
if (versionInfo.isOutdated) {
  console.log('Новая версия:', versionInfo.latest);
}
```

## Конфигурация GitHub API

Обновите URL в `src/core/version.ts`:
```typescript
export const VERSION_CHECK_URL = 'https://api.github.com/repos/YOUR_USERNAME/YOUR_REPO/releases/latest';
```

Плагин будет получать информацию о последней версии из GitHub releases.

## Примеры версий

| Этап разработки | VERSION.json | Полная версия | Описание |
|---|---|---|---|
| Начало | `1.0` | `1.0.1234` | Initial release |
| Новая функция | `1.1` | `1.1.5678` | Minor update |
| Большое обновление | `2.0` | `2.0.1111` | Major release |

## Кеширование

Результаты проверки версии кешируются на 24 часа в `localStorage` для снижения нагрузки на GitHub API.
