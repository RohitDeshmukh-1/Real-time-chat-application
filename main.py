import json
from datetime import datetime, timezone

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Realtime Chat MVP")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class ConnectionManager:
    """Manages active WebSocket connections and user presence in memory."""

    def __init__(self) -> None:
        # username -> set of active WebSockets for that user (supports multiple tabs)
        self.users: dict[str, set[WebSocket]] = {}
        # websocket -> username
        self.sockets: dict[WebSocket, str] = {}

    async def connect(self, username: str, websocket: WebSocket) -> None:
        await websocket.accept()
        if username not in self.users:
            self.users[username] = set()
        self.users[username].add(websocket)
        self.sockets[websocket] = username

    def disconnect(self, websocket: WebSocket) -> str | None:
        username = self.sockets.pop(websocket, None)
        if username and username in self.users:
            self.users[username].discard(websocket)
            if not self.users[username]:
                del self.users[username]
        return username

    def get_online_users(self) -> list[str]:
        return sorted(list(self.users.keys()))

    async def broadcast(self, payload: dict) -> None:
        dead: list[WebSocket] = []
        for ws in list(self.sockets.keys()):
            try:
                await ws.send_json(payload)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws)

    async def broadcast_user_list(self) -> None:
        await self.broadcast({
            "type": "user_list",
            "users": self.get_online_users(),
        })

    async def send_direct(self, sender: str, recipient: str, text: str) -> None:
        payload = event("message", sender, text, recipient=recipient)
        # Send to recipient's active sockets
        if recipient in self.users:
            for ws in list(self.users[recipient]):
                try:
                    await ws.send_json(payload)
                except Exception:
                    self.disconnect(ws)
        # Also echo back to sender's active sockets (so sender sees their message in DM thread)
        if sender != recipient and sender in self.users:
            for ws in list(self.users[sender]):
                try:
                    await ws.send_json(payload)
                except Exception:
                    self.disconnect(ws)

    async def send_to_socket(self, websocket: WebSocket, payload: dict) -> None:
        try:
            await websocket.send_json(payload)
        except Exception:
            self.disconnect(websocket)


manager = ConnectionManager()


def event(kind: str, sender: str, text: str, recipient: str = "all") -> dict:
    return {
        "type": kind,
        "sender": sender,
        "recipient": recipient,
        "text": text,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@app.get("/")
def health() -> dict:
    return {"status": "ok", "online_users": manager.get_online_users()}


@app.websocket("/ws/{username}")
async def chat(websocket: WebSocket, username: str) -> None:
    await manager.connect(username, websocket)
    await manager.broadcast_user_list()
    await manager.broadcast(event("system", "server", f"{username} joined"))

    try:
        while True:
            raw_text = await websocket.receive_text()
            if raw_text == "ping":
                continue

            try:
                data = json.loads(raw_text)
                if isinstance(data, dict) and data.get("type") == "get_users":
                    await manager.send_to_socket(
                        websocket,
                        {
                            "type": "user_list",
                            "users": manager.get_online_users(),
                        },
                    )
                    continue

                recipient = data.get("recipient", "all") if isinstance(data, dict) else "all"
                text = str(data.get("text", "")).strip() if isinstance(data, dict) else str(data).strip()
            except (json.JSONDecodeError, AttributeError):
                recipient = "all"
                text = raw_text.strip()

            if not text:
                continue

            if recipient == "all":
                await manager.broadcast(event("message", username, text, recipient="all"))
            else:
                if recipient not in manager.users:
                    await manager.send_to_socket(
                        websocket,
                        event("system", "server", f"@{recipient} is currently offline", recipient=recipient),
                    )
                else:
                    await manager.send_direct(username, recipient, text)
    except WebSocketDisconnect:
        pass
    finally:
        user = manager.disconnect(websocket)
        if user and user not in manager.users:
            await manager.broadcast_user_list()
            await manager.broadcast(event("system", "server", f"{user} left"))
