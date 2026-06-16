# Step 03 — Run both locally with Compose

**Goal:** write `docker-compose.yml` **yourself** that runs both containers
together and proves the cross-service call works locally — the same dependency
you'll later prove in production.

No compose file is provided — you write `docker-compose.yml` at the **repo
root**.

---

## A. Build the compose file one piece at a time

Create an empty `docker-compose.yml` at the **repo root** and add to it as you
work through the steps below. Don't paste a finished file — build it up so you
understand why each line is there.

### A.1 — Start the skeleton

A compose file is a top-level `services:` map. Each key under it is one
container. Start with the two service names you need and nothing else:

```yaml
services:
  inventory:
  orders:
```

> No `version:` line is needed — modern Compose ignores it.

### A.2 — Tell Compose how to build each image

In [Step 02](02-containerize.md) you built images by hand with
`docker build -t inventory-service ./inventory-service`. Compose does that for
you: point each service at the folder holding its `Dockerfile` with `build:`.

```yaml
services:
  inventory:
    build: ./inventory-service
  orders:
    build: ./orders-service
```

Now `docker compose build` would build both images. `./inventory-service` is the
**build context** — the folder Compose hands to Docker, which then runs the
`Dockerfile` inside it.

### A.3 — Publish only the service you curl

Recall from Step 02 that the app inside **both** containers listens on `8080`.
Here you only need to reach `orders` from your host — `inventory` is called
**by `orders`**, not by you. So publish a host port for `orders` only:

```yaml
  orders:
    build: ./orders-service
    ports:
      - "8080:8080"      # host 8080 -> orders container 8080
```

Leave `inventory` with **no** `ports:` block. It's still reachable *inside* the
compose network (next step) — it just isn't exposed to your laptop. This mirrors
production, where `inventory` is private and only `orders` sits behind the load
balancer.

> Unlike Step 02 — where you ran both standalone and had to pick *different* host
> ports (`8081`, `8082`) to avoid a collision — here only one service publishes a
> port, so `orders` can take the clean `8080`.

### A.4 — Wire orders to inventory by service name

Look at how `orders` finds inventory in [orders-service/app.py](../orders-service/app.py):

```python
INVENTORY_URL = os.environ.get("INVENTORY_URL", "http://inventory:8080")
```

It reads an env var. Set it in compose so the wiring is explicit:

```yaml
  orders:
    build: ./orders-service
    ports:
      - "8080:8080"
    environment:
      INVENTORY_URL: http://inventory:8080
```

> **Why the hostname `inventory`?** Compose puts both containers on one network
> and gives each a DNS name equal to its **service name**. So `orders` reaches
> the other container at the hostname `inventory` on its container port `8080`.
> This mirrors ECS Service Connect, where the same call becomes
> `http://inventory.microsvc.local:8080` — same idea, different DNS namespace.

### A.5 — Make startup order explicit

`orders` depends on `inventory` being up. Add `depends_on` so Compose starts
`inventory` first:

```yaml
  orders:
    build: ./orders-service
    ports:
      - "8080:8080"
    environment:
      INVENTORY_URL: http://inventory:8080
    depends_on:
      - inventory
```

> `depends_on` only waits for the container to **start**, not for the app inside
> to be ready to serve. That's fine here — `orders` retries on demand and the
> 503 path (Section C) handles inventory being unreachable.

### A.6 — Optional: name the containers

Giving each service an explicit `container_name` is optional but makes
`docker compose logs` and `docker ps` easier to read:

```yaml
services:
  inventory:
    build: ./inventory-service
    container_name: inventory
  orders:
    build: ./orders-service
    container_name: orders
    ports:
      - "8080:8080"
    environment:
      INVENTORY_URL: http://inventory:8080
    depends_on:
      - inventory
```

That last block is your complete `docker-compose.yml`.

*Self-check questions:*
- Why does `inventory` **not** publish a host port, while `orders` does?
- If you renamed the `inventory` service, what else would have to change?
  (Hint: look at `INVENTORY_URL`.)

---

## B. Run it

```bash
docker compose up --build -d

curl -sX POST localhost:8080/orders -H 'content-type: application/json' \
     -d '{"sku":"widget","quantity":2}'    # expect status "confirmed"
curl -sX POST localhost:8080/orders -H 'content-type: application/json' \
     -d '{"sku":"gadget","quantity":2}'    # expect status "backordered"

docker compose logs orders                 # see the request hit inventory
docker compose down
```

`widget` has quantity 10 (≥ 2 → **confirmed**); `gadget` has quantity 0
(< 2 → **backordered**). If both behave as described, your two containers are
talking to each other over the compose network.

---

## C. Prove the dependency locally (optional but recommended)

Stop just inventory and watch orders fail loudly:

```bash
docker compose up --build -d
docker compose stop inventory
curl -isX POST localhost:8080/orders -H 'content-type: application/json' \
     -d '{"sku":"widget","quantity":1}'    # expect HTTP 503
docker compose down
```

This is the exact failure mode you'll reproduce in production in
[Step 06](06-deploy-and-verify.md). If it does **not** return `503`, your
`orders` app is swallowing the connection error instead of surfacing it.

---

## What you learned

- Containers reach each other by **service name** on the compose network — the
  same name-as-hostname idea ECS Service Connect uses. Proving the cross-service
  call (and its failure mode) locally means every later failure is a deploy
  problem, not an app problem.

## Checklist

- [ ] `docker-compose.yml` exists at the repo root with `inventory` + `orders`
- [ ] `orders` has `INVENTORY_URL`, `depends_on: [inventory]`, and publishes `8080`
- [ ] `inventory` does **not** publish a host port
- [ ] `widget` → `confirmed`, `gadget` → `backordered`
- [ ] Stopping inventory makes `/orders` return `503`

## Next

→ [Step 04 — Prepare the GitHub repo](04-github-repo.md)
