#!/bin/bash
# Скрипт для быстрого деплоя Password Generator на продакшн

set -e

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Деплой Password Generator${NC}"
echo ""

# Проверка Docker
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker не установлен${NC}"
    exit 1
fi

# Проверка Docker Compose
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo -e "${RED}❌ Docker Compose не установлен${NC}"
    exit 1
fi

# Использовать docker compose (v2) если доступен, иначе docker-compose (v1)
COMPOSE_CMD="docker compose"
if ! docker compose version &> /dev/null; then
    COMPOSE_CMD="docker-compose"
fi

# Определить файл compose
COMPOSE_FILE="docker-compose.yml"
if [ -f "docker-compose.prod.yml" ]; then
    COMPOSE_FILE="docker-compose.prod.yml"
    echo -e "${YELLOW}📋 Используется docker-compose.prod.yml${NC}"
fi

echo -e "${GREEN}✅ Проверка конфигурации...${NC}"

# Проверка наличия файлов
if [ ! -f "$COMPOSE_FILE" ]; then
    echo -e "${RED}❌ Файл $COMPOSE_FILE не найден${NC}"
    exit 1
fi

if [ ! -f "Dockerfile" ]; then
    echo -e "${RED}❌ Dockerfile не найден${NC}"
    exit 1
fi

# Остановка существующих контейнеров
echo -e "${YELLOW}🛑 Остановка существующих контейнеров...${NC}"
$COMPOSE_CMD -f "$COMPOSE_FILE" down 2>/dev/null || true

# Сборка и запуск
echo -e "${GREEN}🔨 Сборка образа...${NC}"
$COMPOSE_CMD -f "$COMPOSE_FILE" build --no-cache

echo -e "${GREEN}🚀 Запуск контейнеров...${NC}"
$COMPOSE_CMD -f "$COMPOSE_FILE" up -d

# Ожидание запуска
echo -e "${YELLOW}⏳ Ожидание запуска контейнеров...${NC}"
sleep 5

# Проверка статуса
echo -e "${GREEN}📊 Статус контейнеров:${NC}"
$COMPOSE_CMD -f "$COMPOSE_FILE" ps

# Проверка healthcheck
echo -e "${GREEN}🏥 Проверка healthcheck...${NC}"
HEALTH_URL="http://localhost/health"
if grep -q "8080" "$COMPOSE_FILE" 2>/dev/null; then
    HEALTH_URL="http://localhost:8080/health"
fi

if curl -sf "$HEALTH_URL" > /dev/null; then
    echo -e "${GREEN}✅ Healthcheck успешен${NC}"
else
    echo -e "${YELLOW}⚠️  Healthcheck не прошел, проверьте логи${NC}"
fi

echo ""
echo -e "${GREEN}✅ Деплой завершен!${NC}"
echo -e "${YELLOW}📋 Полезные команды:${NC}"
echo "  Логи:           $COMPOSE_CMD -f $COMPOSE_FILE logs -f"
echo "  Статус:         $COMPOSE_CMD -f $COMPOSE_FILE ps"
echo "  Остановка:      $COMPOSE_CMD -f $COMPOSE_FILE down"
echo "  Перезапуск:     $COMPOSE_CMD -f $COMPOSE_FILE restart"
