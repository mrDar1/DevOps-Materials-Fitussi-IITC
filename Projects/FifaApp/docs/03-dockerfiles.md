# Stage 3 — Dockerfiles

## Goal
Package each service as a self-contained Docker image.  
You'll write a Dockerfile for each app, build it, and run it standalone.

---

## Frontend Dockerfile (multi-stage build)

Inside `FifaApp-frontend/`, create a file named `Dockerfile`:

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

**Why two stages?**  
Stage 1 (`builder`) compiles the React app. Stage 2 discards Node.js and only keeps the compiled output, resulting in a tiny final image (~25 MB).

**What is `nginx.conf`?**  
It's already in your repo. It tells Nginx to:
- Serve the static React files from `/usr/share/nginx/html`
- Proxy any `/api/*` requests to `http://backend:8000` (the Docker Compose service name)

---

## Backend Dockerfile

Inside `FifaApp-backend/`, create a file named `Dockerfile`:

```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

---

## Build and test each image independently

### Backend
```bash
cd FifaApp-backend
docker build -t fifaapp-backend .
docker run -p 8000:8000 -e MONGO_URI="<your-atlas-uri>" fifaapp-backend
```

Verify:
```bash
curl http://localhost:8000/health
# {"status":"ok"}
```

### Frontend
```bash
cd FifaApp-frontend
docker build -t fifaapp-frontend .
docker run -p 3000:80 fifaapp-frontend
```

Open [http://localhost:3000](http://localhost:3000) — the UI loads, but API calls fail because there's no backend container running. **This is expected.** We'll wire them together in Stage 4.

---

## Commit your Dockerfiles

```bash
# In FifaApp-frontend
git add Dockerfile
git commit -m "Add Dockerfile (multi-stage nginx build)"
git push

# In FifaApp-backend
git add Dockerfile
git commit -m "Add Dockerfile (python:3.11-slim)"
git push
```

---

## Stuck? Check the solution
```
solutions/03-docker/frontend/Dockerfile
solutions/03-docker/backend/Dockerfile
```

**Next:** Combine both services with Docker Compose (Stage 4)
