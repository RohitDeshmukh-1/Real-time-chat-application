import { useEffect, useRef, useState } from "react";

const rawWsUrl = import.meta.env.VITE_WS_URL || "ws://localhost:8000";
const WS_URL = rawWsUrl.replace(/\/+$/, "");

function formatTime(iso) {
  if (!iso) return "";
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
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [activeChat, setActiveChat] = useState("all"); // "all" or specific username
  const [unreadCounts, setUnreadCounts] = useState({});
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const socketRef = useRef(null);
  const bottomRef = useRef(null);
  const activeChatRef = useRef(activeChat);

  useEffect(() => {
    activeChatRef.current = activeChat;
  }, [activeChat]);

  // Clear unread counter when switching to a chat
  function selectChat(chatId) {
    setActiveChat(chatId);
    setUnreadCounts((prev) => ({ ...prev, [chatId]: 0 }));
    setIsSidebarOpen(false);
  }

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
        // Immediately request online members list
        try {
          socket.send(JSON.stringify({ type: "get_users" }));
        } catch {
          // ignore
        }
        // Keep-alive heartbeat every 25 seconds
        pingInterval = setInterval(() => {
          if (socket.readyState === WebSocket.OPEN) {
            socket.send("ping");
          }
        }, 25000);
      };

      socket.onmessage = (raw) => {
        try {
          const data = JSON.parse(raw.data);

          if (data.type === "user_list") {
            setOnlineUsers(data.users || []);
            return;
          }

          setMessages((prev) => [...prev, data]);

          // Track unread counts if message is not in active chat
          if (data.type === "message") {
            const currentChat = activeChatRef.current;
            const messageChatId =
              data.recipient === "all"
                ? "all"
                : data.sender === username
                ? data.recipient
                : data.sender;

            if (messageChatId !== currentChat && data.sender !== username) {
              setUnreadCounts((prev) => ({
                ...prev,
                [messageChatId]: (prev[messageChatId] || 0) + 1,
              }));
            }
          }
        } catch {
          // ignore non-JSON messages
        }
      };

      socket.onclose = () => {
        clearInterval(pingInterval);
        setStatus("disconnected");
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
  }, [messages, activeChat]);

  function join(e) {
    e.preventDefault();
    const clean = username.trim();
    if (clean) {
      setUsername(clean);
      setJoined(true);
    }
  }

  function send(e) {
    e.preventDefault();
    const socket = socketRef.current;
    if (!draft.trim() || socket?.readyState !== WebSocket.OPEN) return;

    const payload = {
      recipient: activeChat,
      text: draft.trim(),
    };

    socket.send(JSON.stringify(payload));
    setDraft("");
  }

  // Filter messages for current thread
  const filteredMessages = messages.filter((m) => {
    if (activeChat === "all") {
      return m.recipient === "all" || !m.recipient;
    }
    // Direct message thread between 'username' and 'activeChat'
    return (
      (m.sender === username && m.recipient === activeChat) ||
      (m.sender === activeChat && m.recipient === username) ||
      (m.type === "system" && m.recipient === activeChat)
    );
  });

  const otherUsers = onlineUsers.filter((u) => u !== username);

  if (!joined) {
    return (
      <main className="login-screen">
        <form className="login-card" onSubmit={join}>
          <div className="app-logo">💬</div>
          <h1>Join Real-Time Chat</h1>
          <p className="login-subtitle">Connect instantly with online members or chat in public.</p>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Enter your display name"
            maxLength={20}
            autoFocus
            required
          />
          <button type="submit">Join Chat</button>
        </form>
      </main>
    );
  }

  return (
    <div className="layout">
      {/* Sidebar Overlay for Mobile */}
      {isSidebarOpen && (
        <div
          className="sidebar-overlay"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`sidebar ${isSidebarOpen ? "sidebar-open" : ""}`}>
        <div className="sidebar-header">
          <div className="user-profile">
            <div className="avatar user-avatar">
              {username.charAt(0).toUpperCase()}
            </div>
            <div className="user-info">
              <span className="user-name">{username}</span>
              <span className={`status-badge status-${status}`}>
                <span className="status-dot" /> {status}
              </span>
            </div>
          </div>
        </div>

        <nav className="channels-nav">
          <div className="section-label">CHANNELS</div>
          <button
            type="button"
            className={`nav-item ${activeChat === "all" ? "active" : ""}`}
            onClick={() => selectChat("all")}
          >
            <span className="nav-icon">🌐</span>
            <span className="nav-title">General Chat</span>
            {unreadCounts["all"] > 0 && (
              <span className="unread-badge">{unreadCounts["all"]}</span>
            )}
          </button>

          <div className="section-label online-label">
            <span>ONLINE MEMBERS</span>
            <span className="online-count-tag">{onlineUsers.length}</span>
          </div>

          <div className="members-list">
            {onlineUsers.length === 0 ? (
              <div className="no-members">Connecting...</div>
            ) : (
              onlineUsers.map((user) => (
                <button
                  key={user}
                  type="button"
                  className={`nav-item member-item ${
                    activeChat === user ? "active" : ""
                  } ${user === username ? "self-item" : ""}`}
                  onClick={() => selectChat(user)}
                >
                  <div className="member-avatar-wrap">
                    <span className="avatar member-avatar">
                      {user.charAt(0).toUpperCase()}
                    </span>
                    <span className="presence-dot" />
                  </div>
                  <span className="nav-title">
                    {user} {user === username ? "(You)" : ""}
                  </span>
                  {user !== username && (
                    <span className="direct-btn-tag">
                      {activeChat === user ? "Chatting" : "Message"}
                    </span>
                  )}
                  {unreadCounts[user] > 0 && (
                    <span className="unread-badge">{unreadCounts[user]}</span>
                  )}
                </button>
              ))
            )}
          </div>
        </nav>
      </aside>

      {/* Main Chat Area */}
      <main className="chat-container">
        {/* Header */}
        <header className="chat-header">
          <button
            type="button"
            className="mobile-toggle-btn"
            onClick={() => setIsSidebarOpen((prev) => !prev)}
            aria-label="Toggle members menu"
          >
            👥 {onlineUsers.length} Online
          </button>
          <div className="chat-title-info">
            <h2>
              {activeChat === "all" ? "🌐 General Chat" : `💬 ${activeChat}`}
            </h2>
            <span className="chat-subtitle">
              {activeChat === "all"
                ? `Public room • ${onlineUsers.length} online`
                : otherUsers.includes(activeChat)
                ? "🟢 Online • Direct Message"
                : "⚪ Offline • Direct Message"}
            </span>
          </div>
        </header>

        {/* Message List */}
        <ul className="messages">
          {filteredMessages.length === 0 ? (
            <div className="empty-state">
              <span className="empty-icon">
                {activeChat === "all" ? "👋" : "💬"}
              </span>
              <p>
                {activeChat === "all"
                  ? "Welcome to General Chat! Say hello to everyone."
                  : `Start your private conversation with ${activeChat}.`}
              </p>
            </div>
          ) : (
            filteredMessages.map((m, i) =>
              m.type === "system" ? (
                <li key={i} className="system-message">
                  <span>{m.text}</span>
                </li>
              ) : (
                <li
                  key={i}
                  className={`message-row ${
                    m.sender === username ? "mine" : "theirs"
                  }`}
                >
                  {m.sender !== username && (
                    <div className="avatar sender-avatar">
                      {m.sender.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="message-content">
                    {m.sender !== username && activeChat === "all" && (
                      <span className="sender-name">{m.sender}</span>
                    )}
                    <div className="bubble">
                      <span className="message-text">{m.text}</span>
                      <span className="message-time">
                        {formatTime(m.timestamp)}
                      </span>
                    </div>
                  </div>
                </li>
              )
            )
          )}
          <div ref={bottomRef} />
        </ul>

        {/* Composer */}
        <form className="composer" onSubmit={send}>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={
              status !== "connected"
                ? "Connecting to server..."
                : activeChat === "all"
                ? "Message #general..."
                : `Send a direct message to @${activeChat}...`
            }
            disabled={status !== "connected"}
          />
          <button
            type="submit"
            disabled={status !== "connected" || !draft.trim()}
          >
            Send
          </button>
        </form>
      </main>
    </div>
  );
}
