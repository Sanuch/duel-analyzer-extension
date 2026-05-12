# Быстрый старт версионирования

## Установка и первый запуск

### 1. Проверьте файлы версионирования
```bash
# Убедитесь, что файлы созданы:
ls -la VERSION.json                    # Базовая версия
ls -la scripts/version.js              # Скрипт версионирования
ls -la src/core/version.ts             # Константы версии (автогенерируемый)
ls -la src/core/version-checker.ts     # Проверка обновлений
ls -la src/core/version-manager.ts     # Менеджер версий
```

### 2. Первая сборка с версионированием
```bash
npm run build
```

Вывод должен быть похож на:
```
✓ Version set to: 1.0.1234
✓ package.json updated
✓ manifest.chromium.json updated
✓ manifest.firefox.json updated
✓ version.ts created
```

### 3. Интегрируйте в background скрипт

В файле `src/background/main.ts` добавьте:
```typescript
import { initializeVersionCheck } from '@core/version-manager';

// При инициализации плагина
chrome.runtime.onInstalled.addListener(async () => {
  await initializeVersionCheck();
});

// Или периодическая проверка обновлений
chrome.alarms.create('checkVersion', { periodInMinutes: 60 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'checkVersion') {
    initializeVersionCheck().catch(console.error);
  }
});
```

### 4. Настройте GitHub URL

Отредактируйте `src/core/version.ts` и замените:
```typescript
export const VERSION_CHECK_URL = 'https://api.github.com/repos/YOUR_USERNAME/YOUR_REPO/releases/latest';
```

Например:
```typescript
export const VERSION_CHECK_URL = 'https://api.github.com/repos/user123/duel-analyzer-extension/releases/latest';
```

## Повседневное использование

### Обычная сборка (автоматический patch)
```bash
npm run build
```

### Сборка для разработки с автоперезагрузкой
```bash
npm run dev
```

### Обновление версии для нового релиза
1. Отредактируйте `VERSION.json`:
   ```json
   {
     "major": 1,
     "minor": 1
   }
   ```
2. Выполните сборку:
   ```bash
   npm run build
   ```

## Проверка версии в плагине

### UI для уведомления об обновлении (пример для content script)

```typescript
// В src/content/main.ts
import { VERSION } from '@core/version';

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'VERSION_UPDATE_AVAILABLE') {
    showUpdateNotification({
      currentVersion: message.current,
      newVersion: message.latest,
      downloadUrl: message.updateUrl,
    });
  }
});

function showUpdateNotification(info: any) {
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #4CAF50;
    color: white;
    padding: 16px;
    border-radius: 4px;
    font-family: system-ui;
    z-index: 999999;
    cursor: pointer;
  `;
  notification.innerHTML = `
    <strong>Новая версия доступна!</strong>
    <br>${info.currentVersion} → ${info.newVersion}
    <br><a href="${info.downloadUrl}" target="_blank" style="color: white; text-decoration: underline;">Скачать</a>
  `;
  document.body.appendChild(notification);
  
  setTimeout(() => notification.remove(), 10000);
}
```

## Структура файлов

```
duel-analyzer-resources/
├── VERSION.json                      # Базовая версия (редактируется вручную)
├── package.json                      # Версия синхронизируется отсюда
├── scripts/
│   ├── version.js                    # Скрипт версионирования (запускается npm run version:generate)
│   └── VERSIONING_GUIDE.md           # Полная документация
├── manifests/
│   ├── manifest.chromium.json        # Версия синхронизируется
│   └── manifest.firefox.json         # Версия синхронизируется
└── src/core/
    ├── version.ts                    # Автогенерируемый (VERSION и VERSION_CHECK_URL)
    ├── version-checker.ts            # Проверка обновлений на GitHub
    └── version-manager.ts            # Инициализация версионирования
```

## Troubleshooting

### Версия не обновляется
Убедитесь, что скрипт может прочитать файлы:
```bash
node scripts/version.js
```

### Манифесты не обновляются
Проверьте пути в `scripts/version.js`

### Проверка версии не работает
1. Проверьте URL в `src/core/version.ts`
2. Откройте DevTools консоль в расширении
3. Убедитесь, что GitHub API доступен
