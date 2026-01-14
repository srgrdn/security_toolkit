# Руководство по деплою на продакшн

## 📋 Требования

- Сервер с SSH доступом
- Root или sudo доступ к серверу
- Ansible на управляющей машине (для автоматического деплоя)

## 🚀 Варианты деплоя

### Вариант 1: Ansible (рекомендуется) ⭐

Автоматизированный деплой через Ansible. См. [ansible/README.md](ansible/README.md) для подробной документации.

**Быстрый старт:**

```bash
cd ansible

# Настроить inventory.ini
# Запустить деплой
ansible-playbook deploy.yml
```

### Вариант 2: Docker Compose (ручной деплой)

#### 1. Подготовка сервера

```bash
# Обновить систему
sudo apt update && sudo apt upgrade -y

# Установить Docker (если не установлен)
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Установить Docker Compose (если не установлен)
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Добавить пользователя в группу docker (опционально)
sudo usermod -aG docker $USER
```

#### 2. Копирование проекта на сервер

```bash
# На локальной машине: создать архив проекта
cd /path/to/password_gen
tar -czf password-gen.tar.gz \
  --exclude='.git' \
  --exclude='*.md' \
  --exclude='REVIEW.md' \
  www/ nginx/ Dockerfile docker-compose.yml .dockerignore

# Скопировать на сервер
scp password-gen.tar.gz user@your-server:/opt/

# На сервере: распаковать
ssh user@your-server
cd /opt
tar -xzf password-gen.tar.gz
cd password-gen  # или создайте директорию password-gen и распакуйте туда
```

#### 3. Настройка для продакшна

Создайте файл `docker-compose.prod.yml`:

```yaml
version: '3.8'

services:
  web:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: password-gen-prod
    restart: always
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/ssl:/etc/nginx/ssl:ro  # SSL сертификаты
    networks:
      - password-gen-network
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost/health"]
      interval: 30s
      timeout: 3s
      retries: 3
      start_period: 5s
    security_opt:
      - no-new-privileges:true
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 256M
        reservations:
          cpus: '0.5'
          memory: 128M

networks:
  password-gen-network:
    driver: bridge
```

#### 4. Настройка SSL/HTTPS (Let's Encrypt)

##### Вариант A: Использование Certbot (рекомендуется)

```bash
# Установить Certbot
sudo apt install certbot

# Получить сертификат (замените your-domain.com на ваш домен)
sudo certbot certonly --standalone -d your-domain.com -d www.your-domain.com

# Сертификаты будут в:
# /etc/letsencrypt/live/your-domain.com/fullchain.pem
# /etc/letsencrypt/live/your-domain.com/privkey.pem
```

Обновите `nginx/default.conf` для HTTPS:

```nginx
# Редирект HTTP на HTTPS
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;
    
    # Для обновления сертификатов Let's Encrypt
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }
    
    location / {
        return 301 https://$server_name$request_uri;
    }
}

server {
    listen 443 ssl http2;
    server_name your-domain.com www.your-domain.com;
    
    # SSL сертификаты
    ssl_certificate /etc/nginx/ssl/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/privkey.pem;
    
    # SSL настройки безопасности
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384';
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    
    root /usr/share/nginx/html;
    index index.html;

    # Security headers
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy "geolocation=(), microphone=(), camera=()" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
    
    # Content Security Policy
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'; frame-ancestors 'none';" always;

    # Остальная конфигурация...
    # (см. текущий default.conf)
}
```

Скопируйте сертификаты:

```bash
sudo mkdir -p /opt/password-gen/nginx/ssl
sudo cp /etc/letsencrypt/live/your-domain.com/fullchain.pem /opt/password-gen/nginx/ssl/
sudo cp /etc/letsencrypt/live/your-domain.com/privkey.pem /opt/password-gen/nginx/ssl/
sudo chmod 644 /opt/password-gen/nginx/ssl/fullchain.pem
sudo chmod 600 /opt/password-gen/nginx/ssl/privkey.pem
```

##### Вариант B: Без домена (только HTTP, не рекомендуется для продакшна)

Используйте стандартный `docker-compose.yml`, но измените порты на 80.

#### 5. Запуск

```bash
cd /opt/password-gen

# Собрать и запустить
docker compose -f docker-compose.prod.yml up -d --build

# Проверить статус
docker compose -f docker-compose.prod.yml ps

# Посмотреть логи
docker compose -f docker-compose.prod.yml logs -f
```

#### 6. Настройка автообновления SSL сертификатов

Создайте cron задачу для обновления сертификатов:

```bash
sudo crontab -e

# Добавить строку (обновление сертификатов и перезагрузка контейнера)
0 3 * * * certbot renew --quiet --deploy-hook "cd /opt/password-gen && docker compose -f docker-compose.prod.yml restart web"
```

### Вариант 2: Kubernetes

Создайте манифесты Kubernetes (см. примеры в `k8s/` директории, если создадим).

### Вариант 3: Облачные платформы

#### AWS ECS / Fargate
- Создайте Docker образ и загрузите в ECR
- Создайте task definition
- Запустите через ECS service

#### Google Cloud Run
- Соберите образ и загрузите в Container Registry
- Деплой через `gcloud run deploy`

#### Azure Container Instances
- Загрузите образ в Azure Container Registry
- Создайте контейнер через Azure CLI или Portal

## 🔒 Дополнительные меры безопасности

### 1. Настройка файрвола

```bash
# UFW (Ubuntu)
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable

# Или iptables
sudo iptables -A INPUT -p tcp --dport 80 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 443 -j ACCEPT
```

### 2. Настройка fail2ban (защита от брутфорса)

```bash
sudo apt install fail2ban
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

### 3. Регулярные обновления

```bash
# Добавить в cron для автоматических обновлений безопасности
0 4 * * 0 apt update && apt upgrade -y && docker compose -f docker-compose.prod.yml pull && docker compose -f docker-compose.prod.yml up -d
```

### 4. Мониторинг

#### Использование systemd для автозапуска

Создайте `/etc/systemd/system/password-gen.service`:

```ini
[Unit]
Description=Password Generator Service
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/password-gen
ExecStart=/usr/local/bin/docker compose -f docker-compose.prod.yml up -d
ExecStop=/usr/local/bin/docker compose -f docker-compose.prod.yml down
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
```

Активировать:

```bash
sudo systemctl daemon-reload
sudo systemctl enable password-gen.service
sudo systemctl start password-gen.service
```

## 📊 Мониторинг и логи

### Просмотр логов

```bash
# Логи контейнера
docker compose -f docker-compose.prod.yml logs -f web

# Логи Nginx
docker compose -f docker-compose.prod.yml exec web tail -f /var/log/nginx/access.log
docker compose -f docker-compose.prod.yml exec web tail -f /var/log/nginx/error.log
```

### Healthcheck мониторинг

Настройте внешний мониторинг (например, UptimeRobot, Pingdom) для проверки:
- `https://your-domain.com/health`
- `https://your-domain.com/`

## 🔄 Обновление приложения

```bash
cd /opt/password-gen

# Остановить
docker compose -f docker-compose.prod.yml down

# Обновить код (если изменился)
# ... скопировать новые файлы ...

# Пересобрать и запустить
docker compose -f docker-compose.prod.yml up -d --build

# Проверить
docker compose -f docker-compose.prod.yml ps
curl https://your-domain.com/health
```

## 🐛 Устранение неполадок

### Контейнер не запускается

```bash
# Проверить логи
docker compose -f docker-compose.prod.yml logs web

# Проверить конфигурацию Nginx
docker compose -f docker-compose.prod.yml exec web nginx -t
```

### Проблемы с SSL

```bash
# Проверить сертификаты
openssl x509 -in /opt/password-gen/nginx/ssl/fullchain.pem -text -noout

# Обновить сертификаты вручную
sudo certbot renew
```

### Проблемы с портами

```bash
# Проверить занятость портов
sudo netstat -tulpn | grep -E ':(80|443)'

# Если порты заняты, измените маппинг в docker-compose.prod.yml
```

## 📝 Чек-лист деплоя

- [ ] Сервер подготовлен (Docker, Docker Compose)
- [ ] Проект скопирован на сервер
- [ ] Доменное имя настроено (если используется)
- [ ] SSL сертификаты получены и настроены
- [ ] Nginx конфигурация обновлена для HTTPS
- [ ] Файрвол настроен
- [ ] Контейнер запущен и работает
- [ ] Healthcheck проходит успешно
- [ ] Автообновление SSL настроено
- [ ] Мониторинг настроен
- [ ] Логи проверены

## 🔗 Полезные ссылки

- [Docker Documentation](https://docs.docker.com/)
- [Let's Encrypt](https://letsencrypt.org/)
- [Nginx Security Headers](https://owasp.org/www-project-secure-headers/)
- [Docker Compose CLI](https://docs.docker.com/compose/reference/)
