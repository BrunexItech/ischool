from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql://ischool:ischool@localhost:5432/ischool"
    secret_key: str = "change-me-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24
    cors_origins: list[str] = ["http://localhost:3000"]

    livekit_api_key: str = "devkey"
    livekit_api_secret: str = "secret"
    livekit_url: str = "ws://localhost:7880"

    # Email — unset by default; the mailer logs instead of sending until these are provided.
    smtp_host: str | None = None
    smtp_port: int = 587
    smtp_user: str | None = None
    smtp_password: str | None = None
    smtp_from: str = "iSchool <noreply@ischool.local>"

    frontend_url: str = "http://localhost:3000"
    backend_url: str = "http://localhost:8000"

    # Symmetric key for encrypting per-school payment credentials at rest.
    # Deliberately no default — a shared hardcoded key baked into source control
    # would defeat the point of encrypting anything with it. Generate one with:
    # python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
    encryption_key: str | None = None

    @property
    def email_enabled(self) -> bool:
        return bool(self.smtp_host and self.smtp_user and self.smtp_password)


settings = Settings()
