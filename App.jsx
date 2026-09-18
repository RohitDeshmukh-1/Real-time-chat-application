import { useEffect, useRef, useState } from "react";

const rawWsUrl = import.meta.env.VITE_WS_URL || "ws://localhost:8000";
const WS_URL = rawWsUrl.replace(/\/+$/, "");

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function App() {
  const [username, setUsername] = useState("");
  const [joined, setJoined] = useState(false);
  const [status, setStatus] = useState("disconnected");
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");

  const socketRef = useRef(null);
  const bottomRef = useRef(null);

  useEffect(() => {
    if (!joined) return;

    let isCancelled = false;
    let reconnectTimer = null;
    let pingInterval = null;

    function connect() {
      if (isCancelled) return;
      setStatus("connecting");

      const socket = new WebSocket(`${WS_URL}/ws/${encodeURIComponent(username)}`);
      socketRef.current = socket;

      socket.onopen = () => {
        setStatus("connected");
        // Keep-alive heartbeat every 25 seconds for cloud hosting (Render/Cloudflare)
        pingInterval = setInterval(() => {
          if (socket.readyState === WebSocket.OPEN) {
            socket.send("ping");
          }
        }, 25000);
      };

      socket.onmessage = (raw) => {
        try {
          const data = JSON.parse(raw.data);
          setMessages((prev) => [...prev, data]);
        } catch {
          // ignore non-JSON messages
        }
      };

      socket.onclose = () => {
        clearInterval(pingInterval);
        setStatus("disconnected");
        // Auto-reconnect after 2 seconds if still joined
        if (!isCancelled) {
          reconnectTimer = setTimeout(connect, 2000);
        }
      };

      socket.onerror = () => {
        setStatus("error");
      };
    }

    connect();

    return () => {
      isCancelled = true;
      clearInterval(pingInterval);
      clearTimeout(reconnectTimer);
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, [joined, username]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  function join(e) {
    e.preventDefault();
    if (username.trim()) setJoined(true);
  }

  function send(e) {
    e.preventDefault();
    const socket = socketRef.current;
    if (!draft.trim() || socket?.readyState !== WebSocket.OPEN) return;
    socket.send(draft);
    setDraft("");
  }

  if (!joined) {
    return (
      <main className="screen">
        <form className="join" onSubmit={join}>
          <h1>Chat</h1>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Your name"
            maxLength={20}
            autoFocus
          />
          <button type="submit">Join chat</button>
        </form>
      </main>
    );
  }

  return (
    <main className="screen">
      <header className="bar">
        <span>{username}</span>
        <span className={`status status-${status}`}>{status}</span>
      </header>

      <ul className="messages">
        {messages.map((m, i) =>
          m.type === "system" ? (
            <li key={i} className="system">
              {m.text}
            </li>
          ) : (
            <li key={i} className={m.sender === username ? "mine" : ""}>
              <div className="meta">
                {m.sender} · {formatTime(m.timestamp)}
              </div>
              <div className="bubble">{m.text}</div>
            </li>
          )
        )}
        <div ref={bottomRef} />
      </ul>

      <form className="composer" onSubmit={send}>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={
            status === "connected" ? "Write a message" : "Waiting for connection"
          }
          disabled={status !== "connected"}
        />
        <button type="submit" disabled={status !== "connected"}>
          Send
        </button>
      </form>
    </main>
  );
}
