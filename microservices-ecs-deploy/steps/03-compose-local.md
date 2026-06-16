# Step 03 — Run both locally with Compose

**Goal:** write `docker-compose.yml` **yourself** that runs both containers
together and proves the cross-service call works locally — the same dependency
you'll later prove in production.

No compose file is provided — you write `docker-compose.yml` at the **repo
root**.

---

## A. Build the compose file one piece at a time

Create an empty `docker-compose.yml` at the **repo root** and write it yourself
as you work through the steps below — add one piece at a time so you understand
why each key is there. No skeleton is given on purpose; look up the exact YAML
keys in the
[Compose file reference](https://docs.docker.com/reference/compose-file/services/)
when you need the syntax.

### A.1 — Start the skeleton

A compose file is a single top-level `services` map, and each key directly under
it names one container. Add the two services you need — `inventory` and
`orders` — as empty keys for now. (You don't need a `version` line; modern
Compose ignores it.)

### A.2 — Tell Compose how to build each image

In [Step 02](02-containerize.md) you built images by hand with
`docker build -t inventory-service ./inventory-service`. Compose does that for
you. Under **each** service, add the key that points at the folder holding that
service's `Dockerfile` — `./inventory-service` for one, `./orders-service` for
the other. That folder is the **build context**: the directory Compose hands to
Docker, which then runs the `Dockerfile` inside it. Once both services have it,
`docker compose build` builds both images.

### A.3 — Publish only the service you curl

Recall from Step 02 that the app inside **both** containers listens on `8080`.
Here you only need to reach `orders` from your host — `inventory` is called
**by `orders`**, not by you. So add a published-ports entry to **`orders` only**,
mapping host `8080` to the container's `8080`.

Leave `inventory` with **no** ports entry. It's still reachable *inside* the
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

It reads an environment variable. Set that variable on the `orders` service in
compose — name `INVENTORY_URL`, value `http://inventory:8080` — so the wiring is
explicit rather than relying on the code default.

> **Why the hostname `inventory`?** Compose puts both containers on one network
> and gives each a DNS name equal to its **service name**. So `orders` reaches
> the other container at the hostname `inventory` on its container port `8080`.
> This mirrors ECS Service Connect, where the same call becomes
> `http://inventory.microsvc.local:8080` — same idea, different DNS namespace.

### A.5 — Make startup order explicit

`orders` depends on `inventory` being up. Add the dependency key to `orders`
that lists `inventory`, so Compose starts `inventory` first.

> That dependency only waits for the container to **start**, not for the app
> inside to be ready to serve. That's fine here — `orders` calls inventory on
> demand and the 503 path (Section C) handles inventory being unreachable.

### A.6 — Optional: name the containers

Giving each service an explicit container-name key is optional but makes
`docker compose logs` and `docker ps` easier to read (otherwise Compose
auto-generates names like `microservices-ecs-deploy-orders-1`).

When you've added all of the above, you have a complete `docker-compose.yml`:
`inventory` with just a build context, and `orders` with a build context, a
published port, the `INVENTORY_URL` variable, and a dependency on `inventory`.

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
