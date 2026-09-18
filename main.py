from datetime import datetime, timezone

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Realtime Chat MVP")

# WebSockets are not subject to CORS, but this keeps the health check
# usable from the browser during debugging.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class ConnectionManager:
    """Keeps every live WebSocket in memory. No database, no Redis."""

    def __init__(self) -> None:
        self.connections: dict[str, WebSocket] = {}

    async def connect(self, username: str, websocket: WebSocket) -> None:
        await websocket.accept()
        self.connections[username] = websocket

    def disconnect(self, username: str) -> None:
        self.connections.pop(username, None)

    async def broadcast(self, payload: dict) -> None:
        dead = []
        for username, websocket in self.connections.items():
            try:
                await websocket.send_json(payload)
            except Exception:
                dead.append(username)
        for username in dead:
            self.disconnect(username)


manager = ConnectionManager()


def event(kind: str, sender: str, text: str) -> dict:
    return {
        "type": kind,
        "sender": sender,
        "text": text,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@app.get("/")
def health() -> dict:
    return {"status": "ok", "online": len(manager.connections)}


@app.websocket("/ws/{username}")
async def chat(websocket: WebSocket, username: str) -> None:
    await manager.connect(username, websocket)
    await manager.broadcast(event("system", "server", f"{username} joined"))
    try:
        while True:
            text = await websocket.receive_text()
            if text.strip():
                await manager.broadcast(event("message", username, text))
    except WebSocketDisconnect:
        pass
    finally:
        manager.disconnect(username)
        await manager.broadcast(event("system", "server", f"{username} left"))
