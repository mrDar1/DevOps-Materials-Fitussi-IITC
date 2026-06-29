# Stage 2 — Run Locally

## Goal
Run both services on your machine against a real MongoDB Atlas database.  
You'll pass environment variables and see the full stack working before adding any Docker or infrastructure.

---

## Step 1 — Set up MongoDB Atlas

1. Go to [cloud.mongodb.com](https://cloud.mongodb.com) and sign up / log in
2. Create a **free (M0) cluster** — choose any region
3. Create a database user: **Database Access → Add New Database User**
   - Username: `fifaapp`
   - Password: choose a strong password, save it
4. Allow network access: **Network Access → Add IP Address → Allow Access from Anywhere** (for now)
5. Get the connection string: **Connect → Drivers → Copy the URI**
   - It looks like: `mongodb+srv://fifaapp:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority`

---

## Step 2 — Configure the backend

```bash
cd FifaApp-backend
cp .env.example .env
```

Edit `.env` and paste your Atlas URI:
```
MONGO_URI=mongodb+srv://fifaapp:<password>@cluster0.xxxxx.mongodb.net/fifaapp?retryWrites=true&w=majority
```

> Make sure `.env` is in `.gitignore` — never commit secrets!

---

## Step 3 — Run the backend

Open a terminal window and run:

```bash
cd FifaApp-backend
source .venv/bin/activate   # activate the virtualenv created in Stage 1
uvicorn main:app --reload --port 8000
```

Test it:
```bash
curl http://localhost:8000/health
# {"status":"ok"}

curl http://localhost:8000/api/players
# []  (empty at first)
```

You can also open the auto-generated API docs at [http://localhost:8000/docs](http://localhost:8000/docs)

---

## Step 4 — Run the frontend

Open a **second** terminal window:

```bash
cd FifaApp-frontend
npm run dev
```

Vite starts on [http://localhost:5173](http://localhost:5173).  
API calls to `/api/*` are proxied to `http://localhost:8000` automatically (configured in `vite.config.js`).

---

## Step 5 — Verify the full stack

1. Open [http://localhost:5173](http://localhost:5173)
2. Add a player (e.g. Messi, Inter Miami, Forward, 91)
3. The player appears in the list
4. Delete it — it disappears
5. Check your Atlas cluster → **Browse Collections** → you should see the `fifaapp.players` collection

---

## What you've done
- Connected the frontend and backend over localhost
- Used environment variables to pass the MongoDB connection string (no secrets in code)
- Verified the full CRUD cycle works end to end

**Next:** Package each service in a Docker container (Stage 3)
