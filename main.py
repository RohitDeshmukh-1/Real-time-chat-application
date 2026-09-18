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
        self.connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        self.connections.append(websocket)

    def disconnect(self, websocket: WebSocket) -> None:
        if websocket in self.connections:
            self.connections.remove(websocket)

    async def broadcast(self, payload: dict) -> None:
        dead: list[WebSocket] = []
        for websocket in list(self.connections):
            try:
                await websocket.send_json(payload)
            except Exception:
                dead.append(websocket)
        for websocket in dead:
            self.disconnect(websocket)


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
    await manager.connect(websocket)
    await manager.broadcast(event("system", "server", f"{username} joined"))
    try:
        while True:
            text = await websocket.receive_text()
            # Ignore heartbeat pings
            if text == "ping":
                continue
            if text.strip():
                await manager.broadcast(event("message", username, text))
    except WebSocketDisconnect:
        pass
    finally:
        manager.disconnect(websocket)
        await manager.broadcast(event("system", "server", f"{username} left"))
