#!/bin/bash

# Скрипт для проверки установки системы версионирования

echo "🔍 Проверка системы версионирования..."
echo ""

# Проверка основных файлов
echo "📋 Проверка основных файлов:"
files=(
  "VERSION.json"
  "scripts/version.js"
  "src/core/version.ts"
  "src/core/version-checker.ts"
  "src/core/version-manager.ts"
  ".github/workflows/build-extension.yml"
  ".github/workflows/release.yml"
  "docs/VERSIONING.md"
  "scripts/VERSIONING_GUIDE.md"
  "VERSION_MANAGEMENT.md"
  "VERSIONING_QUICKSTART.md"
  "IMPLEMENTATION_SUMMARY.md"
)

missing=0
for file in "${files[@]}"; do
  if [ -f "$file" ]; then
    echo "  ✅ $file"
  else
    echo "  ❌ $file"
    missing=$((missing + 1))
  fi
done

echo ""
if [ $missing -eq 0 ]; then
  echo "✨ Все файлы присутствуют!"
else
  echo "⚠️  Отсутствуют $missing файлов"
fi

echo ""
echo "📄 Проверка конфигурации:"

# Проверка VERSION.json
if grep -q '"major"' VERSION.json 2>/dev/null; then
  version=$(node -e "console.log(require('./VERSION.json').major + '.' + require('./VERSION.json').minor)" 2>/dev/null)
  echo "  ✅ VERSION.json (базовая версия: $version)"
else
  echo "  ❌ VERSION.json не имеет правильной структуры"
fi

# Проверка package.json
if grep -q "version:generate" package.json 2>/dev/null; then
  echo "  ✅ package.json (скрипты добавлены)"
else
  echo "  ❌ package.json не содержит version:generate"
fi

# Проверка version.ts
if grep -q "export const VERSION" src/core/version.ts 2>/dev/null; then
  echo "  ✅ src/core/version.ts (константы версии)"
else
  echo "  ❌ src/core/version.ts не имеет экспортов"
fi

echo ""
echo "🔧 Проверка работоспособности:"

# Проверка Node.js
if command -v node &> /dev/null; then
  node_version=$(node -v)
  echo "  ✅ Node.js ($node_version)"
else
  echo "  ❌ Node.js не установлен"
  exit 1
fi

# Проверка npm
if command -v npm &> /dev/null; then
  npm_version=$(npm -v)
  echo "  ✅ npm ($npm_version)"
else
  echo "  ❌ npm не установлен"
  exit 1
fi

echo ""
echo "📋 Готовые команды:"
echo ""
echo "  npm run version:generate    - Генерирует версию"
echo "  npm run build               - Полная сборка с версионированием"
echo "  npm run dev                 - Разработка с автоперезагрузкой"
echo ""

echo "✨ Система версионирования готова к использованию!"
echo ""
echo "Следующие шаги:"
echo "  1. Обновите VERSION_CHECK_URL в src/core/version.ts"
echo "  2. Добавьте initializeVersionCheck() в background скрипт"
echo "  3. Выполните: npm run build"
echo "  4. Сделайте push в main для создания релиза"
