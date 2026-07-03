from datetime import datetime, timedelta, timezone
from typing import Any

import jwt
from fastapi import Header, HTTPException, Query, WebSocket

from app.config import Settings


def verify_bearer(authorization: str | None, settings: Settings) -> None:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")
    token = authorization.removeprefix("Bearer ").strip()
    if token != settings.api_key:
        raise HTTPException(status_code=401, detail="Invalid API key")


def issue_ws_token(session_id: str, user_id: str, source: str, settings: Settings) -> str:
    payload = {
        "session_id": session_id,
        "user_id": user_id,
        "source": source,
        "exp": datetime.now(timezone.utc) + timedelta(hours=2),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm="HS256")


def decode_ws_token(token: str, settings: Settings) -> dict[str, Any]:
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
    except jwt.PyJWTError as exc:
        raise HTTPException(status_code=401, detail="Invalid WS token") from exc


async def verify_ws_token(websocket: WebSocket, settings: Settings) -> dict[str, Any]:
    token = websocket.query_params.get("token")
    if not token:
        await websocket.close(code=4401)
        raise HTTPException(status_code=401, detail="Missing WS token")
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
    except jwt.PyJWTError:
        await websocket.close(code=4401)
        raise HTTPException(status_code=401, detail="Invalid WS token")
