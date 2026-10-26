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
    # Where this server reaches LiveKit for room controls. Empty = derive it from livekit_url.
    livekit_api_url: str = ""

    # Email — unset by default; the mailer logs instead of sending until these are provided.
    smtp_host: str | None = None
    smtp_port: int = 587
    smtp_user: str | None = None
    smtp_password: str | None = None
    smtp_from: str = "Milai Group of Schools <noreply@ischool.local>"

    frontend_url: str = "http://localhost:3000"
    backend_url: str = "http://localhost:8000"

    # Symmetric key for encrypting per-school payment credentials at rest.
    # Deliberately no default — a shared hardcoded key baked into source control
    # would defeat the point of encrypting anything with it. Generate one with:
    # python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
    encryption_key: str | None = None

    # Error tracking — unset by default; the app runs identically without
    # it, just with nothing watching for crashes in production.
    sentry_dsn: str | None = None
    environment: str = "development"

    # AI-written narrative commentary for weekly reports — unset by default;
    # reports fall back to plain templated text instead of failing.
    openai_api_key: str | None = None
    openai_model: str = "gpt-4o-mini"

    @property
    def email_enabled(self) -> bool:
        return bool(self.smtp_host and self.smtp_user and self.smtp_password)

    @property
    def ai_enabled(self) -> bool:
        return bool(self.openai_api_key)


settings = Settings()
