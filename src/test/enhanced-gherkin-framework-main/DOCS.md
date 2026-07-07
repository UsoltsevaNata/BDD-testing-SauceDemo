# Enhanced Gherkin Framework — Руководство по настройке

## Предварительные требования
Перед установкой убедитесь, что у вас установлены:
- **Node.js** (рекомендуется версия 18+)
- **pnpm** (рекомендуется последняя версия)

Установить pnpm можно командой:
```bash
npm install -g pnpm
```

## Установка проекта

### 1. Клонирование репозитория
```bash
git clone https://github.com/svetlanagerus/enhanced-gherkin-framework
cd enhanced-gherkin-framework
```

### 2. Установка зависимостей

Проект использует `pnpm`, поэтому установите зависимости командой:
```bash
pnpm install
```

> **Важно:** Скрипт `preinstall` запрещает установку через `npm` или `yarn`.

### 3. Установка браузеров для Playwright
```bash
pnpm playwright-install-browsers
```

## Запуск тестов

### Запуск всех тестов
```bash
pnpm run-tests
```

### Запуск тестов через Jest
```bash
pnpm test
```

## Структура проекта
```
/enhanced-gherkin-framework/
├── features/             # Файлы с Gherkin-сценариями
├── src/                  # Исходный код
│   ├── parser/           # Парсер Gherkin-файлов
│   ├── executor/         # Исполнитель тестов
│   ├── steps/            # Определение шагов тестов
│   ├── utils/            # Вспомогательные утилиты
│   ├── index.ts          # Точка входа
├── tests/                # Тесты проекта
├── package.json          # Конфигурация проекта
└── pnpm-lock.yaml        # Блокировка зависимостей
```

## Конфигурация

Настройки проекта хранятся в файле `config/default.json` (или `config/{environment}.json`):
```json
{
  "logging": {
    "enabled": true,
    "outputPath": "logs/output.log"
  },
  "screenshots": {
    "enabled": true,
    "path": "screenshots/"
  },
  "videos": {
    "enabled": false,
    "path": "videos/"
  }
}
```
Выбор файлов сценариев находится в файле `src/index.ts`.

Для запуска конкретных сценариев нужно внести в массив имена файлов.
```typescript
const featureFiles = [
        'scenario1.en.feature',
        'scenario2.en.feature',
        'scenario3.en.feature'
    ];
```

Для запуска всех сценариев оставьте массив пустым.
```typescript
const featureFiles = [];
```

## Полезные команды

| Команда | Описание |
|---------|----------|
| `pnpm install` | Установка зависимостей |
| `pnpm playwright-install-browsers` | Установка браузеров для Playwright |
| `pnpm run-tests` | Запуск всех тестов |
| `pnpm test` | Запуск тестов с Jest |
