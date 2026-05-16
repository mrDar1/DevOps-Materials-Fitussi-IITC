# Lab: Dockerize a Node.js Application

## Goal

Containerize this Express.js app by writing a `Dockerfile` and a `.dockerignore` file. Build the image and run the container successfully.

---

## App Overview

| File | Purpose |
|------|---------|
| `app.js` | Entry point — starts Express server |
| `src/config/index.js` | Reads env vars (`PORT`, `APP_ENV`, `APP_NAME`, `APP_VERSION`) |
| `src/routes/` | Three routes: `/`, `/health`, `/users` |
| `src/middleware/logger.js` | Request logger |
| `package.json` | Single dependency: `express` |

The app reads config from environment variables. Defaults are defined in `src/config/index.js`.

---

## Tasks

### 1. Create `.dockerignore`

Exclude files that should not be copied into the image:
- `node_modules/`
- `.env`
- `*.log`

### 2. Create `Dockerfile`

Your Dockerfile must:

1. Use `node:20-alpine` as base image
2. Set `/app` as the working directory
3. Copy `package.json` first (before source code)
4. Install **production-only** dependencies
5. Copy the rest of the source code
6. Set these environment variables:
   - `PORT=3000`
   - `APP_ENV=production`
   - `APP_NAME=docker-node-app`
   - `APP_VERSION=1.0.0`
7. Expose port `3000`
8. Start the app with `node app.js`

### 3. Build the Image

```bash
docker build -t node-app .
```

### 4. Run the Container

```bash
docker run -p 3000:3000 node-app
```

### 5. Verify

Test all three routes:

```bash
curl http://localhost:3000/
curl http://localhost:3000/health
curl http://localhost:3000/users
```

All three should return JSON responses.

---

## Bonus: Three Ways to Pass Environment Variables

The app reads config from env vars. Try all three injection methods and observe how the startup log changes.

### Method 1 — Baked into Dockerfile (`ENV` instruction)

Already done in your Dockerfile. These are **defaults burned into the image layer**.

```dockerfile
ENV PORT=3000
ENV APP_ENV=production
ENV APP_NAME=docker-node-app
ENV APP_VERSION=1.0.0
```

Run normally — values come from image:
```bash
docker run -p 3000:3000 node-app
```

Expected log:
```
[production] docker-node-app v1.0.0 running on port 3000
```

---

### Method 2 — Imperative (`-e` flag at runtime)

Override individual vars at `docker run` time. **Runtime values override Dockerfile `ENV`.**

```bash
docker run -p 3000:3000 \
  -e APP_ENV=staging \
  -e APP_NAME=my-custom-app \
  -e APP_VERSION=2.0.0 \
  node-app
```

Expected log:
```
[staging] my-custom-app v2.0.0 running on port 3000
```

---

### Method 3 — Env file (`--env-file` flag)

Create a file (e.g. `.env.docker`) with key=value pairs, pass it to `docker run`.

Create `.env.docker`:
```
APP_ENV=development
APP_NAME=lab-app
APP_VERSION=3.0.0
PORT=3000
```

Run with env file:
```bash
docker run -p 3000:3000 --env-file .env.docker node-app
```

Expected log:
```
[development] lab-app v3.0.0 running on port 3000
```

> **Note:** `.env.docker` is safe to commit (no secrets). Never commit `.env` with real credentials — that's why it's in `.dockerignore`.

---

### Comparison Table

| Method | When set | Overridable at runtime | Use case |
|--------|----------|------------------------|----------|
| `ENV` in Dockerfile | Image build time | Yes, by `-e` or `--env-file` | Sensible defaults |
| `-e` flag | `docker run` time | N/A — it is the override | One-off overrides, CI/CD |
| `--env-file` | `docker run` time | N/A — it is the override | Multiple vars, per-environment configs |

---

## Acceptance Criteria

- [ ] `.dockerignore` excludes `node_modules`, `.env`, and `*.log`
- [ ] Image builds without errors
- [ ] Container starts and logs the app name + port
- [ ] All three routes respond with HTTP 200
- [ ] `node_modules` is not in the image layer from `COPY . .`

---

## Hints

<details>
<summary>Hint 1 — Why copy package.json before source code?</summary>

Docker caches each layer. If you copy `package.json` first and run `npm install`, that layer is cached until `package.json` changes. Copying source code after means code changes don't trigger a reinstall.

</details>

<details>
<summary>Hint 2 — Production-only install flag</summary>

`npm install --omit=dev` skips devDependencies, keeping the image smaller.

</details>

<details>
<summary>Hint 3 — alpine vs full node image</summary>

`node:20-alpine` is ~50MB vs ~300MB for `node:20`. Use alpine for production images.

</details>

---

## Expected Startup Log

```
[production] docker-node-app v1.0.0 running on port 3000
```
