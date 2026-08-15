# Codolio Backend

REST API powering **Codolio** — a platform that unifies a developer's coding stats from LeetCode, Codeforces, GitHub, HackerRank, and CodeChef into a single verified profile.

Built by **Nitin Pandey**

---

## Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Features](#features)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Database Setup](#database-setup)
- [Running the Server](#running-the-server)
- [API Routes](#api-routes)
- [Caching Strategy](#caching-strategy)
- [Verification System](#verification-system)
- [Error Handling](#error-handling)
- [Health Check](#health-check)
- [Deployment](#deployment)

---

## Overview

This backend fetches live stats from five coding platforms, caches them across two layers (Redis + PostgreSQL), verifies platform ownership via a token challenge, and exposes it all through a clean REST API consumed by the Codolio frontend.

```
User → PlatformLink (per platform) → CachedStat (fetched JSON)
```

---

## Tech Stack

| Layer | Technology | Why |
|---|---|---|
| Runtime | Node.js | Non-blocking I/O — ideal for parallel calls to 5 external APIs |
| Framework | Express.js | Minimal, full control over middleware order |
| Database | PostgreSQL | Relational structure fits User → PlatformLink → CachedStat |
| ORM | Prisma | Type-safe client, version-controlled migrations |
| Cache | Redis (ioredis) | Sub-millisecond reads, 30-min TTL |
| Auth | JWT + bcryptjs | Stateless tokens, secure password hashing |
| Validation | Joi | Schema-based request validation |
| HTTP Client | Axios | Used to call external platform APIs |
| Security | Helmet | Secure HTTP headers |
| Logging | Morgan | Request logging in development |

---

## Features

- JWT authentication (register, login, protected routes)
- Link/update/unlink coding platform accounts
- Live stats fetched from LeetCode, Codeforces, GitHub, HackerRank, CodeChef
- Two-layer caching (Redis + PostgreSQL) — 30 minute freshness window
- Platform ownership verification via token challenge (no OAuth needed)
- Public profile endpoint — aggregates all platform stats in one call
- Global leaderboard per platform
- Head-to-head comparison between any two users
- Centralized validation and global error handling

---

## Project Structure

```
src/
├── config/
│   ├── db.js              Prisma client singleton
│   └── redis.js           ioredis client singleton
├── controllers/
│   ├── auth.controller.js
│   ├── platform.controller.js
│   ├── stats.controller.js
│   ├── leaderboard.controller.js
│   └── verification.controller.js
├── middleware/
│   ├── auth.js            JWT verification
│   ├── validate.js        Joi validation middleware
│   ├── errorHandler.js    Global error handler
│   └── notFound.js        404 handler
├── routes/
│   ├── auth.routes.js
│   ├── platform.routes.js
│   ├── stats.routes.js
│   ├── leaderboard.routes.js
│   └── verification.routes.js
├── services/
│   ├── leetcode.service.js
│   ├── codeforces.service.js
│   ├── github.service.js
│   ├── hackerrank.service.js
│   ├── codechef.service.js
│   ├── stats.service.js       Unified fetch + cache logic
│   └── verification.service.js
├── utils/
│   ├── cache.js            Redis helpers
│   ├── AppError.js         Custom error class
│   └── validators.js       Joi schemas
└── index.js                 Entry point

prisma/
└── schema.prisma
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL (local or hosted — e.g. [Neon](https://neon.tech), [Supabase](https://supabase.com))
- Redis (local or hosted — e.g. [Upstash](https://upstash.com))

### Installation

```bash
git clone <your-repo-url>
cd codolio-backend
npm install
```

---

## Environment Variables

Create a `.env` file in the root:

```env
PORT=5000
DATABASE_URL=postgresql://user:password@localhost:5432/codolio
JWT_SECRET=your_super_secret_key_min_32_chars
REDIS_URL=redis://localhost:6379
GITHUB_TOKEN=your_github_personal_access_token
ALLOWED_ORIGIN=http://localhost:5173
```

| Variable | Required | Notes |
|---|---|---|
| `PORT` | No | Defaults to 5000 |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `JWT_SECRET` | Yes | Random string, 32+ characters |
| `REDIS_URL` | Yes | Redis connection string |
| `GITHUB_TOKEN` | Recommended | Raises GitHub API rate limit from 60 → 5,000 req/hr |
| `ALLOWED_ORIGIN` | Production | Set to your deployed frontend URL |

---

## Database Setup

```bash
npx prisma migrate dev --name init    # creates tables + generates client
npx prisma studio                     # optional — visual DB browser
```

Schema summary:

| Table | Purpose |
|---|---|
| `User` | Account credentials, unique email + username |
| `PlatformLink` | One row per platform linked per user, unique on `(userId, platform)` |
| `CachedStat` | JSONB storage of the last fetched stats per platform link |

---

## Running the Server

```bash
npm run dev     # development, with nodemon auto-restart
npm start       # production
```

On successful start you should see:

```
Database connected successfully
Server running on port 5000
```

---

## API Routes

### Auth
| Method | Route | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/register` | — | Create account, returns JWT |
| POST | `/api/auth/login` | — | Login, returns JWT |
| GET | `/api/auth/me` | ✅ | Get current user |

### Platforms
| Method | Route | Auth | Description |
|---|---|---|---|
| POST | `/api/platforms/link` | ✅ | Link a platform |
| PUT | `/api/platforms/update` | ✅ | Update linked username |
| DELETE | `/api/platforms/unlink/:platform` | ✅ | Unlink a platform |
| GET | `/api/platforms/my` | ✅ | List linked platforms |

### Stats
| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/api/stats/me` | ✅ | Stats for all linked platforms |
| GET | `/api/stats/me/summary` | ✅ | Aggregated summary |
| GET | `/api/stats/me/:platform` | ✅ | Stats for one platform |
| POST | `/api/stats/me/:platform/refresh` | ✅ | Force-refresh (bypass cache) |
| GET | `/api/stats/profile/:username` | — | Public profile with all stats |

### Verification
| Method | Route | Auth | Description |
|---|---|---|---|
| POST | `/api/verify/:platform/request` | ✅ | Get verification token |
| POST | `/api/verify/:platform/confirm` | ✅ | Confirm token is on profile |

### Leaderboard
| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/api/leaderboard?platform=&limit=` | — | Rankings for a platform |
| GET | `/api/leaderboard/compare?userA=&userB=` | — | Head-to-head comparison |

---

## Caching Strategy

Every stats request checks two layers before calling an external API:

```
Redis (30 min TTL)
   ↓ miss
PostgreSQL CachedStat (fresh if < 30 min old)
   ↓ miss / stale
External platform API
   ↓
Write to PostgreSQL → Write to Redis → Return data
```

This keeps repeat requests under 1ms and protects against external API rate limits and downtime.

---

## Verification System

Proves a user owns the platform account they linked — no OAuth required.

1. `POST /verify/:platform/request` — generates a unique token (e.g. `CF-a3f9b2c1`)
2. User places the token on their platform profile (bio, About Me, or a code submission comment depending on platform)
3. `POST /verify/:platform/confirm` — backend checks the platform's public API for the token
4. If found, `isVerified` is set to `true` and the token is cleared

---

## Error Handling

- All input validated with Joi before reaching controllers
- Global error handler maps Prisma errors, JWT errors, and Axios failures to clean HTTP responses
- No stack traces or internal details ever reach the client
- `uncaughtException` / `unhandledRejection` guards prevent silent crashes

---

## Health Check

```bash
curl http://localhost:5000/status
```

```json
{ "status": "OK" }
```

Use this to confirm the server is running before debugging anything else.

---

## Deployment

Deployed on **Railway** (Node + PostgreSQL + Redis in one project):

```bash
# Start command on Railway
npx prisma migrate deploy && node src/index.js
```

Set these environment variables in the Railway dashboard: `JWT_SECRET`, `GITHUB_TOKEN`, `ALLOWED_ORIGIN`. `DATABASE_URL` and `REDIS_URL` are auto-injected when you add the PostgreSQL and Redis plugins.

---

## License

All rights reserved © Nitin Pandey

---

**Made by Nitin Pandey**
