# 🔐 CoolAuth

**CoolAuth** — минималистичный сервис аутентификации пользователей, реализованный на **NestJS + TypeScript**.  
Проект представляет собой прототип REST API для регистрации, логина и получения информации о текущем пользователе.

---

## ✨ Возможности

- Регистрация пользователей
- Аутентификация по логину и паролю
- JWT-based авторизация
- Защита от brute-force атак
- Кэширование профиля пользователя
- Stateless архитектура
- Покрытие тестами (Jest + Supertest)

---

## 🧱 Технологический стек

- **Node.js / TypeScript**
- **NestJS**
- **PostgreSQL**
- **Drizzle ORM**
- **Redis** (`ioredis`)
- **JWT**
- **bcrypt**
- **Jest / Supertest**
- **Docker / docker-compose**

---

## 📁 Структура проекта

```text
src/
├── auth/
│   ├── auth.controller.ts
│   ├── auth.service.ts
│   ├── dto/
│   ├── guards/
│   └── auth.module.ts
├── common/
│   ├── db/
│   │   ├── schema.ts
│   │   └── db.service.ts
│   └── redis/
│       └── redis.service.ts
├── app.module.ts
└── main.ts

test/
├── auth.controller.e2e-spec.ts
└── auth.service.spec.ts
```

f
dco
