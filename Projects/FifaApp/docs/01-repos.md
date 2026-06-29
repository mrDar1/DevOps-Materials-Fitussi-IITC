# Stage 1 — Create Your Repos

## Goal
Set up two separate GitHub repositories — one per service. This mirrors real-world microservices where each component has its own lifecycle and version history.

## What you'll have at the end
- `FifaApp-frontend` repo on GitHub with the React app
- `FifaApp-backend` repo on GitHub with the FastAPI app
- Both passing their unit tests locally

---

## Step 1 — Create the repos on GitHub

Create two **new, empty** GitHub repos:
- `FifaApp-frontend`
- `FifaApp-backend`

Leave them empty (no README, no `.gitignore`).

---

## Step 2 — Clone and copy the starter code

```bash
# Clone the two new repos
git clone https://github.com/<your-username>/FifaApp-frontend
git clone https://github.com/<your-username>/FifaApp-backend

# Copy the starter code from the course materials
cp -r <course-materials>/Projects/FifaApp/FifaApp-frontend/. FifaApp-frontend/
cp -r <course-materials>/Projects/FifaApp/FifaApp-backend/. FifaApp-backend/
```

---

## Step 3 — Initial commit and push (frontend)

```bash
cd FifaApp-frontend
git add .
git commit -m "Initial commit: React + Vite FIFA players app"
git push -u origin main
```

---

## Step 4 — Initial commit and push (backend)

```bash
cd ../FifaApp-backend
git add .
git commit -m "Initial commit: FastAPI FIFA players backend"
git push -u origin main
```

---

## Step 5 — Run the tests

Verify the starter code works before moving on.

**Backend tests:**
```bash
cd FifaApp-backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
pytest tests/ -v
```

Expected output:
```
tests/test_health.py::test_health_returns_ok PASSED
tests/test_players.py::test_get_players_returns_list PASSED
tests/test_players.py::test_get_players_empty PASSED
tests/test_players.py::test_create_player_returns_id PASSED
tests/test_players.py::test_delete_player_returns_message PASSED
tests/test_players.py::test_delete_player_invalid_id PASSED
```

**Frontend tests:**
```bash
cd ../FifaApp-frontend
npm install
npm run test
```

Expected output:
```
✓ Players component > renders the player list fetched from the API
✓ Players component > shows a message when no players exist
✓ Players component > submits the add-player form and refreshes the list
✓ Players component > calls DELETE and refreshes when the delete button is clicked
```

---

## What you've done
- Created two independent repos (a real microservices pattern)
- Confirmed the app logic works in isolation via unit tests
- Ready to wire things up with a real database in Stage 2
