# Ansible Playbook для деплоя Password Generator

Этот Ansible playbook автоматизирует развертывание Password Generator на удаленных серверах.

## 📋 Требования

### На управляющей машине (откуда запускается Ansible)

- Ansible 2.9+
- Python 3.6+
- SSH доступ к целевым серверам

Установка Ansible:

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install ansible python3-pip

# Или через pip
pip3 install ansible
```

### На целевых серверах

- Ubuntu/Debian или совместимый Linux дистрибутив
- SSH доступ с sudo правами
- Python 3 (обычно предустановлен)

## 🚀 Быстрый старт

### 1. Настройка inventory

Отредактируйте `inventory.ini`:

```ini
[password_gen_servers]
password-gen-prod ansible_host=192.168.1.100 ansible_user=deploy
```

### 2. Настройка SSH доступа

Убедитесь, что SSH ключи настроены:

```bash
ssh-copy-id deploy@192.168.1.100
```

Или используйте пароль (менее безопасно):

```bash
ansible-playbook deploy.yml --ask-pass --ask-become-pass
```

### 3. Запуск деплоя

```bash
cd ansible

# Проверка доступности серверов
ansible all -m ping

# Запуск деплоя
ansible-playbook deploy.yml

# С пересборкой образов
ansible-playbook deploy.yml -e rebuild_images=true
```

## 📝 Конфигурация

### Переменные

Основные переменные находятся в:
- `group_vars/all.yml` - переменные для всех хостов
- `host_vars/<hostname>.yml` - переменные для конкретного хоста
- `inventory.ini` - переменные в inventory файле

### Ключевые переменные

```yaml
app_name: password-gen           # Имя приложения
deploy_path: /opt/password-gen   # Путь деплоя
http_port: 80                    # HTTP порт
rebuild_images: false            # Пересобирать Docker образы
check_health: true               # Проверять healthcheck после деплоя
```

### Переопределение переменных

```bash
# Через командную строку
ansible-playbook deploy.yml -e "http_port=8080"

# Через файл
ansible-playbook deploy.yml -e "@vars/production.yml"
```

## 🎯 Что делает playbook

1. **Установка зависимостей**
   - Обновление системы
   - Установка Docker и Docker Compose
   - Установка системных пакетов

2. **Подготовка окружения**
   - Создание директории для деплоя
   - Настройка пользователя и прав

3. **Копирование файлов**
   - Синхронизация файлов проекта на сервер
   - Исключение ненужных файлов (.git, *.md и т.д.)

4. **Деплой приложения**
   - Остановка существующих контейнеров
   - Сборка Docker образов
   - Запуск контейнеров

5. **Проверка работоспособности**
   - Ожидание запуска сервиса
   - Проверка healthcheck endpoint

## 📋 Примеры использования

### Деплой на один сервер

```bash
ansible-playbook deploy.yml -l password-gen-prod
```

### Деплой с пересборкой образов

```bash
ansible-playbook deploy.yml -e rebuild_images=true
```

### Деплой без проверки healthcheck

```bash
ansible-playbook deploy.yml -e check_health=false
```

### Деплой на кастомный порт

```bash
ansible-playbook deploy.yml -e http_port=9090
```

### Просмотр изменений (dry-run)

```bash
ansible-playbook deploy.yml --check --diff
```

## 🔍 Отладка

### Проверка подключения

```bash
ansible all -m ping
```

### Проверка фактов

```bash
ansible all -m setup
```

### Запуск с подробным выводом

```bash
ansible-playbook deploy.yml -v          # Подробно
ansible-playbook deploy.yml -vv         # Очень подробно
ansible-playbook deploy.yml -vvv        # Максимальная детализация
```

### Проверка конкретной задачи

```bash
ansible-playbook deploy.yml --tags "docker"
```

## 🏷 Теги (tags)

Playbook поддерживает теги для выполнения отдельных частей:

```bash
# Только установка Docker
ansible-playbook deploy.yml --tags "docker"

# Только копирование файлов
ansible-playbook deploy.yml --tags "files"

# Только деплой контейнеров
ansible-playbook deploy.yml --tags "deploy"
```

## 🔒 Безопасность

### Использование SSH ключей (рекомендуется)

```bash
# Генерация SSH ключа (если нет)
ssh-keygen -t ed25519 -C "ansible-deploy"

# Копирование на сервер
ssh-copy-id deploy@server-ip
```

### Использование Ansible Vault для секретов

```bash
# Создание зашифрованного файла
ansible-vault create group_vars/all.yml

# Редактирование
ansible-vault edit group_vars/all.yml

# Запуск с паролем vault
ansible-playbook deploy.yml --ask-vault-pass
```

## 📊 Структура файлов

```
ansible/
├── deploy.yml              # Основной playbook
├── inventory.ini           # Inventory файл
├── ansible.cfg            # Конфигурация Ansible
├── group_vars/
│   └── all.yml            # Переменные для всех хостов
├── host_vars/
│   └── hostname.yml       # Переменные для конкретного хоста
└── README.md              # Эта документация
```

## 🐛 Устранение неполадок

### Ошибка подключения

```bash
# Проверить SSH подключение
ssh deploy@server-ip

# Проверить с Ansible
ansible all -m ping -vvv
```

### Ошибки прав доступа

Убедитесь, что пользователь имеет sudo права:

```bash
# На сервере
sudo visudo
# Добавить: deploy ALL=(ALL) NOPASSWD: ALL
```

### Проблемы с Docker

```bash
# Проверить статус Docker
ansible all -m shell -a "systemctl status docker"

# Перезапустить Docker
ansible all -m systemd -a "name=docker state=restarted"
```

## 🔗 Полезные ссылки

- [Ansible Documentation](https://docs.ansible.com/)
- [Ansible Best Practices](https://docs.ansible.com/ansible/latest/user_guide/playbooks_best_practices.html)
- [Docker Compose Ansible Module](https://docs.ansible.com/ansible/latest/collections/community/docker/docker_compose_v2_module.html)
