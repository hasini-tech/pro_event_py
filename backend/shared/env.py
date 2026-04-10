from __future__ import annotations

from pathlib import Path

from dotenv import load_dotenv


_BACKEND_ENV_PATH = Path(__file__).resolve().parents[1] / ".env"


def load_backend_env() -> None:
    load_dotenv(_BACKEND_ENV_PATH, override=False)
