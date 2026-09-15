from pydantic import BaseModel


class CommunicationConfigUpdate(BaseModel):
    mobilesasa_api_token: str | None = None
    mobilesasa_sender_id: str | None = None


class CommunicationConfigOut(BaseModel):
    sms_configured: bool
    mobilesasa_sender_id: str | None = None
    balance: int | None = None
