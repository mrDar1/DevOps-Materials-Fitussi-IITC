# express-app

Production-like Express API. TypeScript ESM, MongoDB (Mongoose), no auth.

## Stack

- Express 4 + TypeScript
- MongoDB via Mongoose
- helmet, cors, compression, express-rate-limit
- pino + pino-http logging
- zod validation
- jest + supertest + mongodb-memory-server

## Layout

```
src/
  app.ts              # express app factory + /status
  server.ts           # bootstrap: connect DB -> listen -> graceful shutdown
  config/
    env.ts            # env vars + dynamic Mongo URI
    database.ts       # mongoose connect / disconnect
    logger.ts
  errors/             # HttpError
  middleware/         # validate, errorHandler
  routes/             # health
  modules/users/      # routes -> controller -> service -> store (Mongoose model)
tests/                # supertest integration (in-memory Mongo)
```

## Environment

Connection URI is built dynamically from the parts.

| Var          | Meaning                          |
|--------------|----------------------------------|
| `NODE_ENV`   | App status: `DEV` or `TEST`      |
| `PORT`       | HTTP service port                |
| `MONGO_USER` | Mongo username                   |
| `MONGO_PASS` | Mongo password                   |
| `MONGO_HOST` | Mongo host:port (e.g. `localhost:27017`) |

URI: `mongodb://<MONGO_USER>:<MONGO_PASS>@<MONGO_HOST>/<db>?authSource=admin`

## Run

```bash
cp .env.example .env
npm install
npm run dev
```

Needs a reachable MongoDB (local `docker run -p 27017:27017 mongo`, or Atlas via `MONGO_HOST`).

## Endpoints

- `GET  /livez`, `GET /readyz`
- `GET  /status`              `{ status: DEV|TEST, port, db }`
- `GET  /api/users`
- `POST /api/users`           `{ name, email }`
- `GET  /api/users/:id`
- `PATCH /api/users/:id`      partial `{ name?, email? }`
- `DELETE /api/users/:id`

## Test

In-memory Mongo, no external DB needed.

```bash
npm test
```
