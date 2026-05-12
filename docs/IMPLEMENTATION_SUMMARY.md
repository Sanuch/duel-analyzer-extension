# Система версионирования плагина - Реализация

## 📋 Краткое резюме

Реализована полная система управления версиями для плагина **Duel Analyzer Extension** с автоматическим версионированием сборок, проверкой обновлений и интеграцией CI/CD.

---

## ✅ Реализованные компоненты

### 1. **Управление версией (VERSION.json)**
- 📄 **Файл:** `VERSION.json`
- **Описание:** Хранит базовую версию (major.minor)
- **Текущее значение:**
  ```json
  {
    "major": 1,
    "minor": 0
  }
  ```

### 2. **Скрипт генерирования версии**
- 📄 **Файл:** `scripts/version.js`
- **Функции:**
  - Читает базовую версию из `VERSION.json`
  - Генерирует patch версию на основе timestamp
  - Обновляет `package.json`
  - Обновляет `manifest.chromium.json`
  - Обновляет `manifest.firefox.json`
  - Создает `src/core/version.ts` с константами
- **Вызов:** `npm run version:generate`

### 3. **Константы версии**
- 📄 **Файл:** `src/core/version.ts` (автогенерируемый)
- **Экспортирует:**
  ```typescript
  export const VERSION = '1.0.1234';
  export const VERSION_CHECK_URL = 'https://api.github.com/repos/YOUR_REPO/releases/latest';
  ```

### 4. **Проверка обновлений**
- 📄 **Файл:** `src/core/version-checker.ts`
- **Класс:** `VersionChecker`
- **Функции:**
  - Проверка новых версий на GitHub API
  - Сравнение версий (семантическое)
  - Кеширование результатов на 24 часа
  - Обработка ошибок
- **Использование:**
  ```typescript
  import { versionChecker } from '@core/version-checker';
  const info = await versionChecker.checkForUpdates();
  ```

### 5. **Менеджер версий**
- 📄 **Файл:** `src/core/version-manager.ts`
- **Функция:** `initializeVersionCheck()`
- **Возможности:**
  - Инициализация проверки версии
  - Логирование текущей версии
  - Отправка сообщений content scripts об обновлениях
  - Готовая интеграция для background скрипта

### 6. **NPM скрипты**
- **`npm run version:generate`** - Генерирует версию
- **`npm run dev`** - Запускает разработку с версионированием
- **`npm run build`** - Полная сборка с версионированием

### 7. **GitHub Actions Workflows**

#### build-extension.yml (обновлён)
- ✅ Добавлен шаг `Generate version`
- Запускается на каждый push в main/master
- Строит extension для Chromium и Firefox

#### release.yml (новый)
- ✅ Триггер: изменение `VERSION.json`
- Автоматически создаёт GitHub Release
- Создаёт ZIP архивы для обоих браузеров
- Публикует релиз с attachments

### 8. **Документация**

| Файл | Назначение |
|---|---|
| `docs/VERSION_MANAGEMENT.md` | Полное руководство по системе версионирования |
| `docs/VERSIONING_QUICKSTART.md` | Быстрый старт для разработчиков |
| `scripts/VERSIONING_GUIDE.md` | Детальное описание каждого компонента |
| `docs/VERSIONING.md` | Технические подробности |
| `README.md` | Обновлена с информацией о версионировании |

---

## 🚀 Как использовать

### Первая сборка
```bash
npm install
npm run build
```

Вывод:
```
✓ Version set to: 1.0.1234
✓ package.json updated
✓ manifest.chromium.json updated
✓ manifest.firefox.json updated
✓ version.ts created
```

### Интеграция в background скрипт
Файл: `src/background/main.ts`
```typescript
import { initializeVersionCheck } from '@core/version-manager';

chrome.runtime.onInstalled.addListener(async () => {
  await initializeVersionCheck();
});

// Периодическая проверка (каждый час)
chrome.alarms.create('checkVersion', { periodInMinutes: 60 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'checkVersion') {
    initializeVersionCheck().catch(console.error);
  }
});
```

### Обновление базовой версии
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
3. Сделайте commit и push - GitHub Actions автоматически создаст релиз

### Конфигурация GitHub URL
Отредактируйте `src/core/version.ts`:
```typescript
export const VERSION_CHECK_URL = 'https://api.github.com/repos/oivashchenko/duel-analyzer-extension/releases/latest';
```

---

## 📊 Структура версии

```
Полная версия: MAJOR.MINOR.PATCH
              ↓      ↓      ↓
              1  .   0  .   1234

- MAJOR: Из VERSION.json (редактируется вручную для больших изменений)
- MINOR: Из VERSION.json (редактируется вручную для новых функций)
- PATCH: Автоматический timestamp (генерируется при каждой сборке)
```

### Примеры версионирования

| Сценарий | VERSION.json | Полная версия | Действие |
|---|---|---|---|
| Начало | `{"major": 1, "minor": 0}` | `1.0.1234` | `npm run build` |
| Новая функция | `{"major": 1, "minor": 1}` | `1.1.5678` | Отредактировать + push |
| Баг фикс | `{"major": 1, "minor": 1}` | `1.1.9999` | `npm run build` |
| Большой релиз | `{"major": 2, "minor": 0}` | `2.0.1111` | Отредактировать + push |

---

## 🔄 CI/CD Pipeline

### На каждый push в main/master:
1. ✅ Checkout кода
2. ✅ Setup Node.js 22
3. ✅ Установка зависимостей
4. ✅ TypeScript проверка
5. ✅ **Генерирование версии** (новый шаг)
6. ✅ Сборка для Chromium
7. ✅ Сборка для Firefox
8. ✅ Загрузка artifacts

### При изменении VERSION.json в main:
1. ✅ Генерирование версии
2. ✅ Сборка для всех браузеров
3. ✅ Создание GitHub Release с тегом `v1.0.x`
4. ✅ Загрузка ZIP архивов:
   - `duel-analyzer-chromium-1.0.x.zip`
   - `duel-analyzer-firefox-1.0.x.zip`

---

## 📁 Структура файлов

```
duel-analyzer-resources/
├── VERSION.json                    # ← Редактируется вручную для обновления версии
├── package.json                    # ← Обновлено с новыми скриптами
├── README.md                       # ← Обновлено информацией о версионировании
│
├── scripts/
│   ├── version.js                  # ← Новый скрипт версионирования
│   └── VERSIONING_GUIDE.md         # ← Документация
│
├── src/core/
│   ├── version.ts                  # ← Автогенерируемый
│   ├── version-checker.ts          # ← Новый класс проверки обновлений
│   └── version-manager.ts          # ← Новый менеджер версий
│
├── docs/
│   ├── VERSIONING.md               # ← Документация
│   ├── VERSION_MANAGEMENT.md       # ← Полное руководство
│   └── VERSIONING_QUICKSTART.md    # ← Быстрый старт
│
└── .github/workflows/
    ├── build-extension.yml         # ← Обновлено
    └── release.yml                 # ← Новый workflow
```

---

## 🎓 Примеры использования

### Пример 1: Проверка версии при загрузке
```typescript
import { VERSION, initializeVersionCheck } from '@core/version-manager';

console.log(`🔌 Extension v${VERSION} loaded`);

chrome.runtime.onInstalled.addListener(async () => {
  await initializeVersionCheck();
});
```

### Пример 2: Ручная проверка обновлений
```typescript
import { versionChecker } from '@core/version-checker';

const versionInfo = await versionChecker.checkForUpdates();
if (versionInfo.isOutdated) {
  console.log(`New version available: ${versionInfo.latest}`);
  console.log(`Download: ${versionInfo.updateUrl}`);
}
```

### Пример 3: UI уведомление об обновлении
```typescript
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'VERSION_UPDATE_AVAILABLE') {
    showNotification(message.latest, message.updateUrl);
  }
});

function showNotification(newVersion, url) {
  const div = document.createElement('div');
  div.innerHTML = `
    <strong>Новая версия ${newVersion} доступна</strong>
    <a href="${url}">Скачать</a>
  `;
  div.style.cssText = `
    position: fixed; top: 20px; right: 20px;
    background: #4CAF50; color: white; padding: 16px;
    border-radius: 4px; z-index: 999999;
  `;
  document.body.appendChild(div);
}
```

---

## 🔧 Технические детали

### Генерирование patch версии
```javascript
const buildNumber = Math.floor(Date.now() / 1000) % 10000;
// Уникальный номер на основе timestamp, макс 10000 значений
```

### Сравнение версий
```typescript
// Семантическое сравнение версий
compareVersions('1.0.10', '1.0.9') > 0  // true
compareVersions('2.0.0', '1.9.9') > 0   // true
compareVersions('1.1.0', '1.1.0') === 0 // true
```

### Кеширование
- **Ключ:** `version_check_cache`
- **Длительность:** 24 часа
- **Хранилище:** `localStorage`

---

## ⚙️ Переменные окружения GitHub Actions

Нет обязательных переменных для версионирования. Система использует:
- `VITE_PHRASES_MANIFEST_URL` (существующая переменная для phrases)
- `GITHUB_TOKEN` (встроенная переменная GitHub Actions)

---

## 📝 Следующие шаги

1. **Обновите GitHub URL** в `src/core/version.ts`
2. **Интегрируйте** `initializeVersionCheck()` в `src/background/main.ts`
3. **Протестируйте** локально: `npm run build`
4. **Push** в main для запуска GitHub Actions
5. **Отредактируйте** `VERSION.json` для создания релиза

---

## ✨ Резюме

Система полностью настроена и готова к использованию:
- ✅ Автоматическое версионирование при сборке
- ✅ Проверка новых версий через GitHub API
- ✅ Кеширование на 24 часа
- ✅ Интеграция с CI/CD (GitHub Actions)
- ✅ Автоматическое создание релизов
- ✅ Полная документация и примеры

**Для начала работы:**
```bash
npm run build
```
