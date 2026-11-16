import os
from pathlib import Path
from pydantic import BaseModel

BASE_DIR = Path(__file__).resolve().parent.parent

class Settings(BaseModel):
    PROJECT_NAME: str = "NurtureAISpace (Sol-450 Engine)"
    PROJECT_VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    DATA_DIR: Path = BASE_DIR / "data"
    # Browsers allowed to call the API: the GitHub Pages site (dashboard + /app/) and the local dev/preview servers.
    # (The laptop demo's phones go through the Vite proxy, same origin, so they need no entry.)
    CORS_ORIGINS: list[str] = [
        "https://nurtureaispace.github.io",
        *(f"http://{host}:{port}" for host in ("localhost", "127.0.0.1") for port in (3000, 3001, 4173, 5173)),
    ]
    NOMINAL_MISSION_SOLS: int = 450
    EXTENDED_MISSION_SOLS: int = 1000
    DEFAULT_CREW_SIZE: int = 4

settings = Settings()
