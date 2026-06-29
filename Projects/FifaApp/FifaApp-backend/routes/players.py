from fastapi import APIRouter, HTTPException
from bson import ObjectId
from bson.errors import InvalidId
from database import players_collection
from models import Player

router = APIRouter()


@router.get("/players")
async def get_players():
    players = []
    async for player in players_collection.find():
        player["_id"] = str(player["_id"])
        players.append(player)
    return players


@router.post("/players", status_code=201)
async def create_player(player: Player):
    result = await players_collection.insert_one(player.model_dump())
    return {"id": str(result.inserted_id)}


@router.delete("/players/{player_id}")
async def delete_player(player_id: str):
    try:
        oid = ObjectId(player_id)
    except InvalidId:
        raise HTTPException(status_code=400, detail="Invalid player id")
    await players_collection.delete_one({"_id": oid})
    return {"message": "Player deleted"}
