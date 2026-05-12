# Полное руководство по версионированию плагина

## 📋 Краткое описание

Система автоматически версионирует плагин на основе:
- **Базовой версии** (major.minor) из `VERSION.json`
- **Автоматической patch версии** на основе timestamp при каждой сборке
- **Проверки новых версий** с кешированием на 24 часа

## 🎯 Что было реализовано

### 1. **Система версионирования**
- ✅ `VERSION.json` - файл с базовой версией
- ✅ `scripts/version.js` - скрипт автоматического генерирования версии
- ✅ Синхронизация версии в `package.json`, `manifest.chromium.json`, `manifest.firefox.json`
- ✅ Автоматическое создание `src/core/version.ts` с константами

### 2. **Проверка обновлений**
- ✅ `src/core/version-checker.ts` - класс для проверки новых версий
- ✅ Интеграция с GitHub API (releases)
- ✅ Кеширование результатов на 24 часа
- ✅ Сравнение версий (семантическое версионирование)

### 3. **Менеджер версий**
- ✅ `src/core/version-manager.ts` - функция инициализации версионирования
- ✅ Автоматическое уведомление content scripts об обновлениях
- ✅ Готовая интеграция с alarm API для периодической проверки

### 4. **CI/CD интеграция**
- ✅ Обновлен `build-extension.yml` с шагом версионирования
- ✅ Создан `release.yml` для автоматического создания релизов
- ✅ Создание ZIP архивов при merge в main

## 🚀 Быстрый старт

### 1️⃣ Первая сборка
```bash
npm run build
```

Результат:
```
✓ Version set to: 1.0.1234
✓ package.json updated
✓ manifest.chromium.json updated
✓ manifest.firefox.json updated
✓ version.ts created
```

### 2️⃣ Интегрируем в background скрипт
Файл: `src/background/main.ts`
```typescript
import { initializeVersionCheck } from '@core/version-manager';

// При инициализации плагина
chrome.runtime.onInstalled.addListener(async () => {
  console.log('Extension installed');
  await initializeVersionCheck();
});

// Периодическая проверка обновлений
chrome.alarms.create('checkVersion', { periodInMinutes: 60 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'checkVersion') {
    initializeVersionCheck().catch(console.error);
  }
});
```

### 3️⃣ Обновляем VERSION_CHECK_URL
Файл: `src/core/version.ts`
```typescript
export const VERSION_CHECK_URL = 'https://api.github.com/repos/YOUR_USERNAME/YOUR_REPO/releases/latest';
```

Например:
```typescript
export const VERSION_CHECK_URL = 'https://api.github.com/repos/oivashchenko/duel-analyzer-extension/releases/latest';
```

## 📝 Файлы, которые были созданы/изменены

### Новые файлы:
```
VERSION.json                           # Базовая версия
scripts/version.js                     # Скрипт версионирования
scripts/VERSIONING_GUIDE.md           # Полная документация
src/core/version.ts                   # Автогенерируемый (версия и URL)
src/core/version-checker.ts           # Класс проверки обновлений
src/core/version-manager.ts           # Инициализация версионирования
docs/VERSIONING.md                    # Документация в docs/
.github/workflows/release.yml         # GitHub Actions для релизов
docs/VERSIONING_QUICKSTART.md         # Быстрый старт
```

### Изменённые файлы:
```
package.json                          # Добавлены скрипты версионирования
.github/workflows/build-extension.yml # Добавлен шаг генерирования версии
```

## 🔄 Рабочий процесс разработки

### Для регулярных сборок
```bash
npm run build                  # Автоматически обновляет patch версию
```

### Для обновления после новой функции
1. Отредактируйте `VERSION.json`:
```json
{
  "major": 1,
  "minor": 1
}
```

2. Сделайте сборку:
```bash
npm run build
```

3. Создайте коммит и push:
```bash
git add VERSION.json
git commit -m "bump: version 1.1.x"
git push
```

GitHub Actions автоматически создаст релиз!

### Для больших обновлений
```json
{
  "major": 2,
  "minor": 0
}
```

## 📦 Использование версии в коде

### В background скрипте
```typescript
import { VERSION, versionChecker } from '@core/version-manager';

console.log(`Current version: ${VERSION}`);

// Проверка обновлений
const info = await versionChecker.checkForUpdates();
if (info.isOutdated) {
  console.warn(`New version: ${info.latest}`);
}
```

### В content script
```typescript
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'VERSION_UPDATE_AVAILABLE') {
    console.log(`Update available: ${message.latest}`);
    // Показать UI с уведомлением об обновлении
  }
});
```

## 🔍 Структура версии

```
Полная версия: 1.2.3456
              └─ └─ └─ └─ Patch (автоматический timestamp)
                └─ └─ Minor (из VERSION.json)
                  └─ Major (из VERSION.json)
```

| Сценарий | VERSION.json | Полная версия | Git команды |
|---|---|---|---|
| Первый запуск | `1.0` | `1.0.1234` | `npm run build` |
| Новая функция | `1.1` | `1.1.5678` | Отредактировать, `git add VERSION.json`, `git push` |
| Критический баг | `1.0` | `1.0.9999` | `npm run build` |
| Большое обновление | `2.0` | `2.0.1111` | Отредактировать, `git add VERSION.json`, `git push` |

## 🤖 CI/CD Pipeline

### При push в main/master:
1. ✅ Проверить TypeScript
2. ✅ Генерировать версию
3. ✅ Собрать для всех браузеров
4. ✅ Загрузить artifacts

### При изменении VERSION.json в main:
1. ✅ Генерировать версию
2. ✅ Собрать для всех браузеров
3. ✅ Создать GitHub Release
4. ✅ Загрузить ZIP архивы
5. ✅ Опубликовать релиз

## 🐛 Troubleshooting

### Ошибка: "VERSION.json not found"
```bash
# Убедитесь, что файл существует в корне проекта
ls -la VERSION.json
```

### Ошибка: "Cannot find module './version'"
```bash
# Выполните версионирование вручную
npm run version:generate

# Или выполните полную сборку
npm run build
```

### Версия не обновляется в манифестах
```bash
# Проверьте пути в scripts/version.js
node scripts/version.js

# Проверьте вывод
cat package.json | grep version
cat manifests/manifest.chromium.json | grep version
```

### Проверка обновлений не работает
1. Проверьте URL в `src/core/version.ts`
2. Проверьте консоль DevTools расширения
3. Проверьте доступ к GitHub API (может потребоваться CORS)

## 📚 Дополнительная документация

- [VERSIONING_QUICKSTART.md](./VERSIONING_QUICKSTART.md) - Быстрый старт
- [../scripts/VERSIONING_GUIDE.md](../scripts/VERSIONING_GUIDE.md) - Детальное руководство
- [VERSIONING.md](./VERSIONING.md) - Технические подробности

## 🎓 Примеры использования

### Пример 1: Проверка версии при загрузке
```typescript
// src/background/main.ts
import { VERSION, initializeVersionCheck } from '@core/version-manager';

console.log(`🔌 Extension loaded: ${VERSION}`);

chrome.runtime.onInstalled.addListener(async () => {
  await initializeVersionCheck();
});
```

### Пример 2: Проверка обновлений каждый час
```typescript
// src/background/main.ts
chrome.alarms.create('checkVersion', { periodInMinutes: 60 });

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'checkVersion') {
    await initializeVersionCheck();
  }
});
```

### Пример 3: UI для уведомления об обновлении
```typescript
// src/content/main.ts
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'VERSION_UPDATE_AVAILABLE') {
    const notification = document.createElement('div');
    notification.innerHTML = `
      <strong>Доступна новая версия ${message.latest}</strong>
      <a href="${message.updateUrl}">Скачать</a>
    `;
    notification.style.cssText = `
      position: fixed; top: 20px; right: 20px;
      background: #4CAF50; color: white; padding: 16px;
      border-radius: 4px; z-index: 999999;
    `;
    document.body.appendChild(notification);
  }
});
```

## ✨ Готово!

Система версионирования полностью настроена и готова к использованию. 

Следующие шаги:
1. Отредактируйте `src/core/version.ts` с вашим GitHub URL
2. Добавьте `initializeVersionCheck()` в background скрипт
3. Выполните `npm run build` для первой сборки
4. Тестируйте версионирование локально
5. Сделайте push в main для запуска GitHub Actions
