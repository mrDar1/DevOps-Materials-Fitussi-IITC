from unittest.mock import AsyncMock, MagicMock, patch
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

SAMPLE_PLAYER = {
    "_id": "507f1f77bcf86cd799439011",
    "name": "Lionel Messi",
    "team": "Inter Miami",
    "position": "Forward",
    "rating": 91,
}

NEW_PLAYER = {
    "name": "Cristiano Ronaldo",
    "team": "Al-Nassr",
    "position": "Forward",
    "rating": 88,
}


class AsyncCursor:
    """Minimal async iterator for mocking Motor cursors."""

    def __init__(self, items):
        self.items = list(items)

    def __aiter__(self):
        self._iter = iter(self.items)
        return self

    async def __anext__(self):
        try:
            return next(self._iter)
        except StopIteration:
            raise StopAsyncIteration


def test_get_players_returns_list():
    with patch("routes.players.players_collection") as mock_col:
        mock_col.find.return_value = AsyncCursor([SAMPLE_PLAYER.copy()])
        response = client.get("/api/players")

    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["name"] == "Lionel Messi"
    assert data[0]["_id"] == "507f1f77bcf86cd799439011"


def test_get_players_empty():
    with patch("routes.players.players_collection") as mock_col:
        mock_col.find.return_value = AsyncCursor([])
        response = client.get("/api/players")

    assert response.status_code == 200
    assert response.json() == []


def test_create_player_returns_id():
    inserted_id = "507f1f77bcf86cd799439012"
    with patch("routes.players.players_collection") as mock_col:
        mock_col.insert_one = AsyncMock(
            return_value=MagicMock(inserted_id=inserted_id)
        )
        response = client.post("/api/players", json=NEW_PLAYER)

    assert response.status_code == 201
    assert response.json() == {"id": inserted_id}


def test_delete_player_returns_message():
    with patch("routes.players.players_collection") as mock_col:
        mock_col.delete_one = AsyncMock(return_value=MagicMock())
        response = client.delete("/api/players/507f1f77bcf86cd799439011")

    assert response.status_code == 200
    assert response.json() == {"message": "Player deleted"}


def test_delete_player_invalid_id():
    response = client.delete("/api/players/not-a-valid-id")
    assert response.status_code == 400
