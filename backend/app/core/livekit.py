import time

import httpx
from fastapi import HTTPException, status

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


def _api_base() -> str:
    base = settings.livekit_api_url or settings.livekit_url
    return base.replace("wss://", "https://").replace("ws://", "http://").rstrip("/")


def livekit_admin(method: str, body: dict, room: str) -> dict:
    """Calls LiveKit's room-control API (list, change permissions, remove) as
    a room admin. Done over its plain HTTP interface so the heavy gRPC SDK
    is not needed."""
    now = int(time.time())
    token = jwt.encode(
        {"iss": settings.livekit_api_key, "nbf": now, "exp": now + 60, "video": {"roomAdmin": True, "room": room}},
        settings.livekit_api_secret,
        algorithm="HS256",
    )
    try:
        r = httpx.post(
            f"{_api_base()}/twirp/livekit.RoomService/{method}",
            json=body,
            headers={"Authorization": f"Bearer {token}"},
            timeout=6.0,
        )
    except httpx.HTTPError:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, "The video service could not be reached. Please try again.")
    if r.status_code >= 400:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, "The video service refused that action.")
    return r.json() if r.content else {}
