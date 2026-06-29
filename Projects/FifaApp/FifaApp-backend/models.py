from pydantic import BaseModel


class Player(BaseModel):
    name: str
    team: str
    position: str
    rating: int
