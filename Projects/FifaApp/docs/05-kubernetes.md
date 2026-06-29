# Stage 5 — Kubernetes with Minikube

## Goal
Deploy the app to a local Kubernetes cluster.  
You'll work with Secrets, ConfigMaps, Deployments, and Services — and see how K8s service DNS replaces Docker Compose service names.

---

## Prerequisites

```bash
minikube start
```

---

## Key concept: same image, different config

In Docker Compose, the nginx proxy pointed to `http://backend:8000` (compose service name).  
In Kubernetes, the backend is reached via its **Service** DNS name: `http://fifaapp-backend-svc:8000`.

We handle this with a **ConfigMap** that overrides the nginx config inside the running container — the Docker image itself doesn't change.

---

## Build images inside minikube

Minikube has its own Docker daemon. Build inside it so the images are available to K8s without a registry:

```bash
eval $(minikube docker-env)
docker build -t fifaapp-backend:latest ./FifaApp-backend
docker build -t fifaapp-frontend:latest ./FifaApp-frontend
```

> `imagePullPolicy: Never` in the manifests tells K8s to use the locally built image.

---

## Create the manifests

Create a `k8s/` directory and add the following files:

### `k8s/namespace.yaml`
```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: fifaapp
```

### `k8s/backend/secret.yaml`
Base64-encode your Atlas URI:
```bash
echo -n "mongodb+srv://fifaapp:<password>@cluster0.xxxxx.mongodb.net/fifaapp?retryWrites=true&w=majority" | base64
```

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: fifaapp-secret
  namespace: fifaapp
type: Opaque
data:
  MONGO_URI: <paste-base64-output-here>
```

### `k8s/backend/deployment.yaml`
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: fifaapp-backend
  namespace: fifaapp
spec:
  replicas: 2
  selector:
    matchLabels:
      app: fifaapp-backend
  template:
    metadata:
      labels:
        app: fifaapp-backend
    spec:
      containers:
        - name: backend
          image: fifaapp-backend:latest
          imagePullPolicy: Never
          ports:
            - containerPort: 8000
          envFrom:
            - secretRef:
                name: fifaapp-secret
          resources:
            requests:
              cpu: "100m"
              memory: "128Mi"
            limits:
              cpu: "500m"
              memory: "256Mi"
          readinessProbe:
            httpGet:
              path: /health
              port: 8000
            initialDelaySeconds: 5
            periodSeconds: 10
```

### `k8s/backend/service.yaml`
```yaml
apiVersion: v1
kind: Service
metadata:
  name: fifaapp-backend-svc
  namespace: fifaapp
spec:
  selector:
    app: fifaapp-backend
  ports:
    - port: 8000
      targetPort: 8000
  type: ClusterIP
```

### `k8s/frontend/configmap.yaml`
This overrides the nginx.conf baked into the image, replacing `backend:8000` with the K8s service DNS:
```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: nginx-config
  namespace: fifaapp
data:
  default.conf: |
    server {
        listen 80;
        location / {
            root /usr/share/nginx/html;
            try_files $uri $uri/ /index.html;
        }
        location /api {
            proxy_pass http://fifaapp-backend-svc:8000;
        }
    }
```

### `k8s/frontend/deployment.yaml`
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: fifaapp-frontend
  namespace: fifaapp
spec:
  replicas: 2
  selector:
    matchLabels:
      app: fifaapp-frontend
  template:
    metadata:
      labels:
        app: fifaapp-frontend
    spec:
      containers:
        - name: frontend
          image: fifaapp-frontend:latest
          imagePullPolicy: Never
          ports:
            - containerPort: 80
          volumeMounts:
            - name: nginx-config
              mountPath: /etc/nginx/conf.d/default.conf
              subPath: default.conf
          resources:
            requests:
              cpu: "50m"
              memory: "64Mi"
            limits:
              cpu: "200m"
              memory: "128Mi"
      volumes:
        - name: nginx-config
          configMap:
            name: nginx-config
```

### `k8s/frontend/service.yaml`
```yaml
apiVersion: v1
kind: Service
metadata:
  name: fifaapp-frontend-svc
  namespace: fifaapp
spec:
  selector:
    app: fifaapp-frontend
  ports:
    - port: 80
      targetPort: 80
      nodePort: 30080
  type: NodePort
```

---

## Apply everything

```bash
kubectl apply -f k8s/
```

---

## Access the app

```bash
minikube service fifaapp-frontend-svc -n fifaapp
```

This opens the app in your browser.

---

## Verify

```bash
kubectl get pods -n fifaapp
kubectl get services -n fifaapp
kubectl describe pod -l app=fifaapp-backend -n fifaapp  # check readiness probe
kubectl logs -l app=fifaapp-backend -n fifaapp
```

---

## What changed vs. Stage 4

| | Docker Compose | Kubernetes |
|--|--|--|
| Backend URL in nginx | `http://backend:8000` | `http://fifaapp-backend-svc:8000` |
| Config injection | Baked into image | ConfigMap + volumeMount |
| Secret | `.env` file | K8s Secret (base64) |
| Access | `localhost:3000` | `minikube service ...` |

---

## Stuck? Check the solution
```
solutions/05-kubernetes/k8s/
```

**Next:** Replace minikube with a real AWS EKS cluster using Terraform (Stage 6)
