# Stage 4 — Docker Compose

## Goal
Run both services together using Docker Compose.  
You'll see how Docker's internal DNS lets the frontend Nginx proxy to the backend by service name.

---

## Create `docker-compose.yml`

Create this file at the root of your workspace (one level above both repos):

```yaml
version: '3.8'

services:
  backend:
    build: ./FifaApp-backend
    ports:
      - "8000:8000"
    environment:
      - MONGO_URI=${MONGO_URI}
    networks:
      - fifaapp-network

  frontend:
    build: ./FifaApp-frontend
    ports:
      - "3000:80"
    depends_on:
      - backend
    networks:
      - fifaapp-network

networks:
  fifaapp-network:
    driver: bridge
```

---

## Create `.env` (never commit this!)

```bash
cat > .env << 'EOF'
MONGO_URI=mongodb+srv://fifaapp:<password>@cluster0.xxxxx.mongodb.net/fifaapp?retryWrites=true&w=majority
EOF
```

Compose automatically reads `.env` from the same directory and injects `${MONGO_URI}` into the backend container.

---

## How does the frontend reach the backend?

Look at `FifaApp-frontend/nginx.conf`:

```nginx
location /api {
    proxy_pass http://backend:8000;
}
```

`backend` is the **Docker Compose service name**. When containers share a network, Docker's built-in DNS resolves service names to their container IPs automatically. This is why we don't hardcode an IP address.

---

## Run it

```bash
docker compose up --build
```

- Frontend: [http://localhost:3000](http://localhost:3000)
- Backend API: [http://localhost:8000](http://localhost:8000)

Try adding and deleting players. Everything should work exactly like Stage 2, but now both services are containerized.

---

## Useful commands

```bash
docker compose logs -f backend      # Follow backend logs
docker compose down                  # Stop and remove containers
docker compose up --build -d         # Run in the background
```

---

## Key concepts
| Concept | What you saw |
|---------|-------------|
| Service discovery | Frontend reaches backend via `http://backend:8000` (service name = DNS) |
| Env file | `.env` feeds secrets into containers without baking them into the image |
| depends_on | Compose starts backend before frontend |
| Shared network | Both services talk on `fifaapp-network`, isolated from the host |

---

## Stuck? Check the solution
```
solutions/04-compose/docker-compose.yml
```

**Next:** Deploy to Kubernetes (Stage 5)
