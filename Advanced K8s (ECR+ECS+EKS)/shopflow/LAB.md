# ShopFlow – Docker + Kubernetes Lab

> **Level:** Beginner–Intermediate | **Total time:** ~3.5 hours | **Requirements:** Docker, Docker Compose, Minikube, kubectl

---

## Project Overview

ShopFlow is an online store composed of 3 services:

| Service | Technology | Role |
|---------|------------|------|
| frontend | Nginx + React (Vite) | User interface |
| backend | NestJS (Node.js) | REST API |
| postgres | PostgreSQL 16 | Primary database |

### Network Architecture

```
Browser → frontend (port 8080)
               ↓ /api/* proxy
            backend (port 3000)
               ↓
           postgres
```

Two isolated networks:
- `frontend-net` — frontend only (external traffic)
- `backend-net` — backend, postgres, and frontend (for proxy)

---

## Phase 1 – Docker Build & Multi-Stage (45 min)

### Goal
Understand multi-stage builds, network isolation, and image layers.

### Steps

**1.1 – Build and run**
```bash
cd shopflow
docker compose up --build
```

Open `http://localhost:8080` and verify the store loads.

**1.2 – Compare image sizes**
```bash
# Builder stage only (includes devDependencies, TypeScript compiler):
docker build --target builder -t shopflow-backend:fat ./backend
docker images shopflow-backend:fat

# Final production image (only dist + runtime dependencies):
docker images shopflow-backend
```
> **Question:** How many MB did you save? What's in the builder that's excluded from production?

**1.3 – Prove network isolation**
```bash
# Frontend should NOT be able to reach postgres directly:
docker exec shopflow-frontend ping postgres
# Expected: Name or service not known

# Backend can:
docker exec shopflow-backend ping postgres
# Expected: successful response
```

> **Why does this work?** Frontend is attached to both `frontend-net` and `backend-net`, but postgres lives only on `backend-net`. Frontend can proxy requests to backend, but cannot reach postgres directly.

**1.4 – Check healthchecks**
```bash
docker compose ps
# Verify every service shows "healthy"
```

### Verification commands
```bash
docker compose ps
docker compose logs backend --tail=20
docker network ls
docker network inspect shopflow_backend-net
docker network inspect shopflow_frontend-net
```

### Discussion questions
1. Why separate `frontend-net` from `backend-net`?
2. What happens if you remove `depends_on`?
3. What's the difference between `COPY` and `ADD` in a Dockerfile?
4. Why use `node:20-alpine` instead of `node:20`?

---

## Phase 2 – Volumes & Data Persistence (30 min)

### Goal
Understand that database data lives in a volume, not inside the container.

### Steps

**2.1 – Inspect volumes**
```bash
docker volume ls
# You should see: shopflow_postgres-data
```

**2.2 – Prove persistence**

Buy a few products (BUY NOW) to change stock values.

```bash
# Stop all containers WITHOUT removing volumes:
docker compose down

# Start again:
docker compose up -d

# Open http://localhost:8080 — stock changes are preserved
```

**2.3 – Delete volumes**
```bash
# Stop and remove volumes:
docker compose down -v

# Start again:
docker compose up -d

# Open http://localhost:8080 — data reset to defaults (backend re-seeds)
```

> The backend automatically seeds 5 products on first startup.

### Discussion questions
1. What is the difference between `docker compose down` and `docker compose down -v`?
2. Why does postgres need a volume but the backend doesn't?
3. What happens if two containers try to write to the same volume simultaneously?

---

## Phase 3 – Development Mode (25 min)

### Goal
Understand the difference between production and development compose, and see hot-reload in action.

### Steps

**3.1 – Start the dev environment**
```bash
# Make sure production environment is stopped:
docker compose down

# Start dev environment:
docker compose -f docker-compose.dev.yml up --build
```

Differences between environments:

| | Production | Development |
|---|---|---|
| Backend command | `node dist/main.js` | `nest start --watch` (hot reload) |
| Frontend server | Nginx + static build | Vite dev server |
| Frontend port | 8080 | 5173 |
| Source mount | No | Yes — changes apply instantly |

**3.2 – Test hot-reload**

Open `http://localhost:5173` in your browser.

Edit `frontend/src/App.tsx` — change the text `ShopFlow` inside the `<h1>` to anything else and save. The browser will update automatically.

**3.3 – Inspect running commands**
```bash
# See the command running inside each container:
docker inspect shopflow-backend --format '{{.Config.Cmd}}'
```

### Discussion questions
1. Why not use `target: builder` in production?
2. What is the advantage of mounting source code in development?
3. Why doesn't the development frontend need Nginx?

---

## Cleanup (Docker)

```bash
# Stop production environment:
docker compose down -v

# Stop development environment:
docker compose -f docker-compose.dev.yml down -v

# Remove images (optional):
docker rmi shopflow-backend shopflow-frontend shopflow-backend:fat
```

### Docker completion checklist

- [ ] Built images with multi-stage build
- [ ] Proved network isolation between frontend and postgres
- [ ] Proved volumes persist data after `docker compose down`
- [ ] Ran the development environment with hot-reload

---

## Quick Reference (Docker)

```bash
# Compose
docker compose up --build
docker compose up --build -d          # background
docker compose down
docker compose down -v                # includes volumes
docker compose logs -f backend
docker compose ps

# Dev mode
docker compose -f docker-compose.dev.yml up --build

# Images
docker images
docker build --target builder -t name:tag ./dir

# Containers
docker exec shopflow-backend ping postgres

# Networks
docker network ls
docker network inspect shopflow_backend-net

# Volumes
docker volume ls
docker volume inspect shopflow_postgres-data
```

---

## Phase 4 – Kubernetes: Namespace + Deployments (45 min)

### Goal
Deploy ShopFlow on Minikube with all components.

### Prerequisites
```bash
minikube start
minikube status
```

### Steps

**4.1 – Create Namespace**
```bash
kubectl apply -f k8s/namespace.yaml
kubectl get namespaces | grep shopflow
```

**4.2 – Build images into Minikube**
```bash
# Point Docker CLI at Minikube's daemon
eval $(minikube docker-env)

# Build (now inside Minikube)
docker build -t shopflow-backend:latest ./backend
docker build -t shopflow-frontend:latest ./frontend

# Verify
docker images | grep shopflow
```

**4.3 – Deploy Postgres**
```bash
kubectl apply -f k8s/postgres/secret.yaml
kubectl apply -f k8s/postgres/deployment.yaml
kubectl apply -f k8s/postgres/service.yaml

kubectl rollout status deployment/postgres -n shopflow
```

**4.4 – Deploy Backend**
```bash
kubectl apply -f k8s/backend/configmap.yaml
kubectl apply -f k8s/backend/secret.yaml
kubectl apply -f k8s/backend/deployment.yaml
kubectl apply -f k8s/backend/service.yaml
kubectl rollout status deployment/backend -n shopflow
```

**4.5 – Deploy Frontend**
```bash
kubectl apply -f k8s/frontend/deployment.yaml
kubectl apply -f k8s/frontend/service.yaml
kubectl rollout status deployment/frontend -n shopflow
```

**4.6 – Verify everything**
```bash
kubectl get all -n shopflow
```

### Discussion questions
1. Why is `imagePullPolicy: Never` required on Minikube?
2. What is the difference between `kubectl apply` and `kubectl create`?
3. What happens if you deploy the backend before Postgres is ready?

---

## Phase 5 – ConfigMaps, Secrets & PVC (45 min)

### Goal
Understand the difference between ConfigMap, Secret, and PersistentVolumeClaim.

| | ConfigMap | Secret |
|---|---|---|
| Purpose | Non-sensitive configuration | Sensitive data |
| Encoding | Plain text | base64 |
| Access | env, volume | env, volume |
| Example | NODE_ENV, PORT | passwords, API keys |

### Steps

**5.1 – Inspect ConfigMap**
```bash
kubectl get configmap backend-config -n shopflow -o yaml
kubectl describe configmap backend-config -n shopflow
```

**5.2 – Inspect Secret**
```bash
kubectl get secret backend-secret -n shopflow -o yaml
# Value appears as base64

# Decode manually:
kubectl get secret backend-secret -n shopflow \
  -o jsonpath='{.data.DB_PASSWORD}' | base64 -d
```

**5.3 – Prove PVC persistence**
```bash
# Find the postgres pod
kubectl get pods -n shopflow -l app=postgres

# Delete the pod (Deployment auto-creates a new one)
kubectl delete pod <postgres-pod-name> -n shopflow

# Wait for new pod
kubectl rollout status deployment/postgres -n shopflow

# Data still exists:
kubectl exec -n shopflow deployment/backend -- \
  wget -qO- http://localhost:3000/api/products
```

**5.4 – Check PVC**
```bash
kubectl get pvc -n shopflow
kubectl describe pvc postgres-pvc -n shopflow
```

### Discussion questions
1. What happens to data without a PVC when the pod is deleted?
2. Why should passwords not go into a ConfigMap?
3. What is the difference between `stringData` and `data` in a Secret?

---

## Phase 6 – Ingress + Rolling Update (45 min)

### Goal
Expose the app through Ingress and perform a rolling update with zero downtime.

### Steps

**6.1 – Enable Ingress Controller**
```bash
minikube addons enable ingress
kubectl get pods -n ingress-nginx
```

**6.2 – Apply Ingress**
```bash
kubectl apply -f k8s/ingress.yaml
kubectl get ingress -n shopflow
```

**6.3 – Add local DNS**
```bash
# Get Minikube IP
minikube ip

# Add to /etc/hosts (replace <MINIKUBE_IP>):
echo "<MINIKUBE_IP> shopflow.local" | sudo tee -a /etc/hosts
```

Open browser at `http://shopflow.local`

**6.4 – Rolling Update**
```bash
kubectl set image deployment/backend \
  backend=shopflow-backend:latest -n shopflow

# Watch rollout:
kubectl rollout status deployment/backend -n shopflow

# View rollout history:
kubectl rollout history deployment/backend -n shopflow
```

**6.5 – Scale replicas**
```bash
kubectl scale deployment backend --replicas=4 -n shopflow
kubectl get pods -n shopflow -l app=backend -w
```

**6.6 – Rollback**
```bash
kubectl rollout undo deployment/backend -n shopflow
kubectl rollout status deployment/backend -n shopflow
```

### Discussion questions
1. What is the default rolling update strategy?
2. How many pods will be unavailable during an update with 2 replicas?
3. What is the difference between Ingress and a LoadBalancer Service?

---

## Phase 7 – Bonus: Failure & Self-Healing (30 min)

### Goal
Observe Kubernetes self-healing in action.

### Steps

**7.1 – Delete a pod and watch it recreate**
```bash
# Open second terminal with:
kubectl get pods -n shopflow -w

# In first terminal, delete a pod:
kubectl delete pod <backend-pod-name> -n shopflow

# Watch Kubernetes create a replacement automatically
```

**7.2 – Scale to zero — what happens to the app?**
```bash
kubectl scale deployment backend --replicas=0 -n shopflow

# Try accessing http://shopflow.local
# What do you see? (red error banner)

# Restore:
kubectl scale deployment backend --replicas=2 -n shopflow
```

**7.3 – Check liveness probe**
```bash
kubectl describe pod <backend-pod> -n shopflow | grep -A 10 "Liveness"
kubectl describe pod <backend-pod> -n shopflow | grep "Restart Count"
```

**7.4 – Check Events**
```bash
kubectl get events -n shopflow --sort-by='.lastTimestamp' | tail -20
```

**7.5 – Resource consumption**
```bash
kubectl top pods -n shopflow
kubectl top nodes
```

### Discussion questions
1. What is the difference between a liveness probe and a readiness probe?
2. Why do we need at least 2 replicas for a production service?
3. What happens if resource limits are set too low?

---

## Cleanup

### Remove from Minikube
```bash
kubectl delete namespace shopflow
```

### Remove Docker Compose
```bash
docker compose down -v
docker compose -f docker-compose.dev.yml down -v
```

### Full completion checklist

- [ ] Built images with multi-stage build
- [ ] Proved network isolation between frontend and postgres
- [ ] Proved volumes persist data after `docker compose down`
- [ ] Ran the development environment with hot-reload
- [ ] Deployed all services to Minikube
- [ ] Understood the difference between ConfigMap and Secret
- [ ] Performed a rolling update with zero downtime
- [ ] Observed self-healing of a deleted pod

---

## Kubernetes Quick Reference

```bash
# Pods
kubectl get pods -n shopflow
kubectl logs <pod> -n shopflow
kubectl exec -it <pod> -n shopflow -- sh
kubectl describe pod <pod> -n shopflow

# Deployments
kubectl get deployments -n shopflow
kubectl scale deployment <name> --replicas=N -n shopflow
kubectl rollout restart deployment/<name> -n shopflow
kubectl rollout undo deployment/<name> -n shopflow

# Services & Ingress
kubectl get svc -n shopflow
kubectl get ingress -n shopflow

# All resources
kubectl get all -n shopflow
kubectl get events -n shopflow --sort-by='.lastTimestamp'
```
