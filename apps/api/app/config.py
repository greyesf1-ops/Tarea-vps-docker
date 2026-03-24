from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    openai_api_key: str | None = None
    openai_model: str = "gpt-4.1-mini"
    upload_dir: str = "storage/uploads"
    max_upload_size_mb: int = 10
    allow_mock_llm: bool = False

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def upload_path(self) -> Path:
        return Path(self.upload_dir)


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
