# 🔐 THE UNREAL COOL AUTH WITH NEST.JS

**THE UNREAL COOL AUTH WITH NEST.JS** is a minimalist user authentication service implemented on **NestJS + TypeScript**.
The project is a REST API prototype for registration, login and obtaining information about the current user.

---

## ✨ Possibilities

- User registration
- Authentication by login and password
- JWT-based authorization
- Protection against brute-force attacks
- Caching of the user profile
- Stateless architecture
- Test coverage (Jest + Supertest)

---

## 🧱 Technology stack

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

## 📁 Project structure

```text
src
├── app.controller.spec.ts
├── app.controller.ts
├── app.module.ts
├── app.service.ts
├── auth
│ ├── auth.controller.spec.ts
│ ├── auth.controller.ts
│ ├── auth.module.ts
│ ├── auth.service.spec.ts
│ ├── auth.service.ts
│ ├── dto
│ │ ├── login.dto.ts
│ │ └── register.dto.ts
│ └── guards
│ ├── at.guard.spec.ts
│ └── at.guard.ts
├── common
│ ├── config
│ │ └── env.validation.ts
│ ├── db
│ │ ├── db.client.ts
│ │ ├── db.module.ts
│ │ ├── db.service.ts
│ │ └── schema.ts
│ ├── index.ts
│ └── redis
│ ├── redis.module.ts
│ ├── redis.provider.ts
│ ├── redis.service.spec.ts
│ └── redis.service.ts
└── main.ts

test
├── app.e2e-spec.ts
├── auth.e2e-spec.ts
└── jest-e2e.json
```

Part 2 — What if (scaling)

If the authentication service needs to be scaled to 1,000 registrations per second and 100,000 logins per second, I would consider it a state-light service, where the main load falls on read operations and cryptography.

Registration is a relatively rare operation, but it includes writing to the database. For this load, PostgreSQL with horizontal read scaling via read replicas is suitable. Unique indexes on username and email are mandatory to protect against race conditions under concurrent requests. It is necessary to implement rate limiting at the API Gateway or Ingress level to protect against abuse.

Side effects (sending a welcome email, writing an audit log, etc.) must be executed asynchronously through a message queue (Kafka, SQS, or RabbitMQ). This unloads the main registration flow.

1,000 registrations per second is an acceptable load for PostgreSQL with properly configured indexes, connection pool, and sufficient resources.

Login (100k RPS)

Login is an operation of reading a user from the database, verifying the password (bcrypt or argon2), and generating a JWT.

Architectural principles:

Redis is used as first-level storage for storing account locks, counters of failed attempts, and user-id cache.
JWT is fully stateless; sessions are not stored in the database.
The main load is on the CPU due to password hashing, therefore vertical scaling of CPU resources is critical.
NestJS instances are scaled horizontally behind an L7 load balancer.
The connection pool to PostgreSQL is minimal, since login mostly performs read operations.

Data storage

PostgreSQL remains the primary source of truth. Redis is used only for temporary, volatile data. Distributed transactions are not used — all operations must be idempotent.

The key idea: login is almost entirely served from memory and CPU. The database must not become a bottleneck.

Part 3 — Social Login (Google / GitHub)

Social login is implemented via OAuth 2.0 Authorization Code Flow. Our service acts as an identity broker, while Google or GitHub act as external providers.

Flow:

The client clicks the login button and is redirected to our backend endpoint.

The backend redirects the user to the provider’s page, specifying client_id and redirect_uri.

After successful authentication, the provider returns the user to our callback URL with a temporary code.

The backend exchanges this code for an access_token and requests the user’s profile from the provider.

We search for the user in our database by the provider + provider_id pair.
– If the user is not found, we create a new record.
– If found, we update the data if necessary.

We generate our own JWT and return it to the client.
