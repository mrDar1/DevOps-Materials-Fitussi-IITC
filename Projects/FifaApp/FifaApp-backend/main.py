from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes import players

app = FastAPI(title="FifaApp API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(players.router, prefix="/api")


@app.get("/health")
def health():
    return {"status": "ok"}
