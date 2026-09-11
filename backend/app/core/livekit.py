import time

from jose import jwt

from app.core.config import settings

TOKEN_TTL_SECONDS = 60 * 60 * 4  # 4 hours — long enough for any single class session


def generate_room_token(*, room: str, identity: str, name: str, can_publish: bool = True) -> str:
    """Builds a LiveKit access token (a plain HS256 JWT per LiveKit's spec) without
    pulling in the full livekit-server-sdk, which drags in grpc and friends."""
    now = int(time.time())
    payload = {
        "iss": settings.livekit_api_key,
        "sub": identity,
        "name": name,
        "nbf": now,
        "exp": now + TOKEN_TTL_SECONDS,
        "video": {
            "room": room,
            "roomJoin": True,
            "canPublish": can_publish,
            "canSubscribe": True,
            "canPublishData": True,
        },
    }
    return jwt.encode(payload, settings.livekit_api_secret, algorithm="HS256")
