# ShopFlow – מעבדת Docker + Kubernetes

> **רמה:** מתחיל-בינוני | **זמן כולל:** ~4 שעות | **דרישות:** Docker, Docker Compose, Minikube, kubectl

---

## סקירת הפרויקט

ShopFlow היא אפליקציית חנות מקוונת המורכבת מ-4 שירותים:

| שירות | טכנולוגיה | תפקיד |
|--------|------------|--------|
| frontend | Nginx + HTML | ממשק משתמש |
| backend | Node.js + Express | REST API |
| postgres | PostgreSQL 16 | מסד נתונים ראשי |
| redis | Redis 7 | Cache שכבה שנייה |

---

## Phase 1 – Docker Build ומולטי-סטייג' (45 דק')

### מטרה
להבין multi-stage builds, network isolation ו-image layers.

### שלבים

**1.1 – בנייה והפעלה**
```bash
cd shopflow
docker compose up --build
```

פתחו דפדפן על `http://localhost:8080` וודאו שהחנות עולה.

**1.2 – השוואת גדלי images**
```bash
# גדל לפני multi-stage (stage builder בלבד):
docker build --target builder -t shopflow-backend:fat ./backend
docker images shopflow-backend:fat

# גדל אחרי multi-stage (production):
docker images shopflow-backend
```
> **שאלה:** כמה MB חסכתם? מה הסיבה לחיסכון?

**1.3 – הוכחת network isolation**
```bash
# ה-frontend לא אמור לתקשר ישירות עם postgres:
docker exec shopflow-frontend ping postgres
# צפוי: Name or service not known

# ה-backend כן:
docker exec shopflow-backend ping postgres
# צפוי: תגובה תקינה
```

**1.4 – בדיקת healthchecks**
```bash
docker compose ps
# וודאו שכל שירות מראה "healthy"
```

### פקודות לאימות
```bash
docker compose ps
docker compose logs backend --tail=20
docker network ls
docker network inspect shopflow_backend-net
```

### שאלות לדיון
1. למה מפרידים בין `frontend-net` ל-`backend-net`?
2. מה קורה אם מוחקים את `depends_on`?
3. מה ההבדל בין `COPY` ל-`ADD` ב-Dockerfile?

---

## Phase 2 – Cache בפעולה (30 דק')

### מטרה
לראות את Redis cache בזמן אמת ולהבין cache invalidation.

### שלבים

**2.1 – פתיחת האפליקציה**

גשו ל-`http://localhost:8080` ושימו לב ל-badge בפינה:
- 🗄 **POSTGRES** = נתונים הגיעו ישירות מה-DB (cache miss)
- ⚡ **REDIS CACHE** = נתונים הגיעו מה-cache (cache hit)

**2.2 – מעקב אחרי logs בזמן אמת**
```bash
docker compose logs -f backend
```

רעננו את הדף (F5) מספר פעמים וצפו בשינוי בין:
```
🟡 Cache MISS
🔵 Cache HIT
```

**2.3 – cache invalidation**

לחצו על **BUY NOW** על מוצר כלשהו:
1. הבקשה שולחת `PATCH /products/:id/stock`
2. Backend מוחק את מפתח `products:all` מ-Redis
3. הבקשה הבאה ל-`GET /products` תבצע cache miss ותלך ל-Postgres

**2.4 – בדיקה ידנית עם Redis CLI**
```bash
docker exec -it shopflow-redis redis-cli
> KEYS *
> GET products:all
> TTL products:all
> EXIT
```

### שאלות לדיון
1. מה הוא TTL (Time To Live) ולמה הוגדר ל-60 שניות?
2. מה קורה אם Redis נופל? האם האפליקציה ממשיכה לעבוד?
3. מתי Redis Cache יכול להחזיר נתונים "ישנים"?

---

## Phase 3 – Kubernetes Namespace + Deployments (45 דק')

### מטרה
לפרוס את ShopFlow על Minikube עם כל הרכיבים.

### דרישות מקדימות
```bash
minikube start
minikube status
```

### שלבים

**3.1 – יצירת Namespace**
```bash
kubectl apply -f k8s/namespace.yaml
kubectl get namespaces | grep shopflow
```

**3.2 – בנייה לתוך Minikube**
```bash
# חיבור Docker daemon של Minikube
eval $(minikube docker-env)

# בנייה מחדש (הפעם בתוך Minikube)
docker build -t shopflow-backend:latest ./backend
docker build -t shopflow-frontend:latest ./frontend

# אימות
docker images | grep shopflow
```

**3.3 – פריסת Postgres**
```bash
kubectl apply -f k8s/postgres/secret.yaml
kubectl apply -f k8s/postgres/pvc.yaml
kubectl apply -f k8s/postgres/deployment.yaml
kubectl apply -f k8s/postgres/service.yaml

# המתנה ל-Ready
kubectl rollout status deployment/postgres -n shopflow
```

**3.4 – פריסת Redis**
```bash
kubectl apply -f k8s/redis/deployment.yaml
kubectl apply -f k8s/redis/service.yaml
kubectl rollout status deployment/redis -n shopflow
```

**3.5 – פריסת Backend**
```bash
kubectl apply -f k8s/backend/configmap.yaml
kubectl apply -f k8s/backend/secret.yaml
kubectl apply -f k8s/backend/deployment.yaml
kubectl apply -f k8s/backend/service.yaml
kubectl rollout status deployment/backend -n shopflow
```

**3.6 – פריסת Frontend**
```bash
kubectl apply -f k8s/frontend/deployment.yaml
kubectl apply -f k8s/frontend/service.yaml
kubectl rollout status deployment/frontend -n shopflow
```

**3.7 – אימות כללי**
```bash
kubectl get all -n shopflow
```

### שאלות לדיון
1. למה `imagePullPolicy: Never` נדרש ב-Minikube?
2. מה ההבדל בין `kubectl apply` ל-`kubectl create`?
3. מה קורה אם פורסים backend לפני שהmysql Postgres מוכן?

---

## Phase 4 – ConfigMaps, Secrets ו-PVC (45 דק')

### מטרה
להבין את ההבדל בין ConfigMap, Secret ו-PersistentVolumeClaim.

### ההבדל בין ConfigMap ל-Secret

| | ConfigMap | Secret |
|---|---|---|
| מטרה | קונפיגורציה לא-רגישה | מידע רגיש |
| קידוד | טקסט רגיל | base64 |
| גישה | env, volume | env, volume |
| דוגמה | NODE_ENV, PORT | סיסמאות, API keys |

### שלבים

**4.1 – בדיקת ConfigMap**
```bash
kubectl get configmap backend-config -n shopflow -o yaml
kubectl describe configmap backend-config -n shopflow
```

**4.2 – בדיקת Secret**
```bash
kubectl get secret backend-secret -n shopflow -o yaml
# הערך מופיע כ-base64

# פענוח ידני:
kubectl get secret backend-secret -n shopflow \
  -o jsonpath='{.data.DB_PASSWORD}' | base64 -d
```

**4.3 – הוכחת PVC persistence**
```bash
# זיהוי שם ה-pod
kubectl get pods -n shopflow -l app=postgres

# מחיקת ה-pod (Deployment ייצור חדש אוטומטית)
kubectl delete pod <postgres-pod-name> -n shopflow

# המתנה לפוד חדש
kubectl rollout status deployment/postgres -n shopflow

# אימות: הנתונים עדיין קיימים
kubectl exec -n shopflow deployment/backend -- \
  wget -qO- http://localhost:3000/products
```

**4.4 – בדיקת PVC**
```bash
kubectl get pvc -n shopflow
kubectl describe pvc postgres-pvc -n shopflow
```

### שאלות לדיון
1. מה יקרה לנתונים בלי PVC אם ה-pod נמחק?
2. למה לא שומרים סיסמאות ב-ConfigMap?
3. מה ההבדל בין `stringData` ל-`data` ב-Secret?

---

## Phase 5 – Ingress + Rolling Update (45 דק')

### מטרה
לחשוף את האפליקציה דרך Ingress ולבצע rolling update ללא downtime.

### שלבים

**5.1 – הפעלת Ingress Controller**
```bash
minikube addons enable ingress
kubectl get pods -n ingress-nginx
```

**5.2 – פריסת Ingress**
```bash
kubectl apply -f k8s/ingress.yaml
kubectl get ingress -n shopflow
```

**5.3 – הוספת DNS מקומי**
```bash
# קבלת IP של Minikube
minikube ip

# הוספה ל-/etc/hosts (החליפו <MINIKUBE_IP>):
echo "<MINIKUBE_IP> shopflow.local" | sudo tee -a /etc/hosts
```

פתחו דפדפן על `http://shopflow.local`

**5.4 – Rolling Update**

ערכו את ה-Deployment של backend:
```bash
kubectl set image deployment/backend \
  backend=shopflow-backend:latest -n shopflow

# מעקב אחרי ה-rollout:
kubectl rollout status deployment/backend -n shopflow

# היסטוריית rollout:
kubectl rollout history deployment/backend -n shopflow
```

**5.5 – שינוי מספר replicas**
```bash
kubectl scale deployment backend --replicas=4 -n shopflow
kubectl get pods -n shopflow -l app=backend -w
```

**5.6 – Rollback**
```bash
kubectl rollout undo deployment/backend -n shopflow
kubectl rollout status deployment/backend -n shopflow
```

### שאלות לדיון
1. מה ה-strategy ברירת המחדל של rolling update?
2. כמה pods יהיו unavailable בזמן update עם 2 replicas?
3. מה ההבדל בין Ingress ל-LoadBalancer Service?

---

## Phase 6 – Bonus: כשל ו-Self-Healing (30 דק')

### מטרה
להבין את יכולת ה-self-healing של Kubernetes.

### שלבים

**6.1 – מחיקת pod ומעקב אחרי יצירה מחדש**
```bash
# פתחו terminal נוסף עם:
kubectl get pods -n shopflow -w

# ב-terminal הראשי, מחקו pod:
kubectl delete pod <backend-pod-name> -n shopflow

# צפו כיצד Kubernetes יוצר pod חדש אוטומטית
```

**6.2 – Scale to zero – מה קורה לאפליקציה?**
```bash
kubectl scale deployment backend --replicas=0 -n shopflow

# נסו לגשת ל-http://shopflow.local
# מה רואים? (error banner האדום)

# השבת:
kubectl scale deployment backend --replicas=2 -n shopflow
```

**6.3 – בדיקת liveness probe**
```bash
kubectl describe pod <backend-pod> -n shopflow | grep -A 10 "Liveness"
kubectl describe pod <backend-pod> -n shopflow | grep "Restart Count"
```

**6.4 – בדיקת Events**
```bash
kubectl get events -n shopflow --sort-by='.lastTimestamp' | tail -20
```

**6.5 – Resource consumption**
```bash
kubectl top pods -n shopflow
kubectl top nodes
```

### שאלות לדיון
1. מה ההבדל בין liveness probe ל-readiness probe?
2. מדוע אנחנו צריכים לפחות 2 replicas לשירות production?
3. מה יקרה אם נגדיר resource limits נמוכים מדי?

---

## סיכום ו-Cleanup

### הסרת הסביבה מ-Minikube
```bash
kubectl delete namespace shopflow
```

### הסרת Docker Compose
```bash
docker compose down -v
# -v מסיר גם volumes (מחק את כל הנתונים!)
```

### Checklist סיכום

- [ ] הצלחתי לבנות images עם multi-stage build
- [ ] ראיתי את ה-cache badge משתנה בין Redis ל-Postgres
- [ ] פרסתי את כל השירותים על Minikube
- [ ] הבנתי את ההבדל בין ConfigMap ל-Secret
- [ ] ביצעתי rolling update ללא downtime
- [ ] ראיתי self-healing של pod שנמחק

---

## רפרנס מהיר

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

# Services & Ingress
kubectl get svc -n shopflow
kubectl get ingress -n shopflow

# Docker Compose
docker compose up --build -d
docker compose logs -f
docker compose down
```
