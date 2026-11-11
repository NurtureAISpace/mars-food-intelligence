import os
from pathlib import Path
from pydantic import BaseModel

BASE_DIR = Path(__file__).resolve().parent.parent

class Settings(BaseModel):
    PROJECT_NAME: str = "NurtureAISpace (Sol-450 Engine)"
    PROJECT_VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    DATA_DIR: Path = BASE_DIR / "data"
    CORS_ORIGINS: list[str] = ["*"]
    NOMINAL_MISSION_SOLS: int = 450
    EXTENDED_MISSION_SOLS: int = 1000
    DEFAULT_CREW_SIZE: int = 4

settings = Settings()
