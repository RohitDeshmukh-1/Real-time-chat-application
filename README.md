# Real-Time Chat Prototype

A lightweight, real-time WebSocket chat application built with **FastAPI** on the backend and **React (Vite)** on the frontend. Designed for rapid prototyping with in-memory connection handling and zero database setup.

---

## Features

- ⚡ **Real-Time Messaging**: Bidirectional WebSocket communication.
- 👥 **Presence & Status**: Real-time user join/leave alerts and online counter.
- 🎨 **Minimal Modern UI**: Clean interface built with React & custom CSS.
- 🚀 **Zero Database**: Pure in-memory session handling for fast local development.

---

## Project Structure

```
├── App.jsx              # Main React chat component
├── main.jsx             # React entry point
├── index.html           # HTML template
├── styles.css           # Chat UI styling
├── vite.config.js       # Vite configuration
├── package.json         # Frontend dependencies & scripts
├── main.py              # FastAPI server & WebSocket ConnectionManager
├── requirements.txt     # Python backend dependencies
├── .env.example         # Environment variable template
└── .gitignore           # Git ignore rules
```

---

## Getting Started

### 1. Prerequisites
- **Python** 3.10+
- **Node.js** 18+ and npm

---

### 2. Configure Environment

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Ensure `.env` contains:
```env
VITE_WS_URL=ws://localhost:8000
```

---

### 3. Run the Backend (FastAPI)

Open a terminal in this directory:

**Windows (PowerShell):**
```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

**macOS / Linux:**
```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

> Backend will be running at `http://localhost:8000` (Health check: `http://localhost:8000/`).

---

### 4. Run the Frontend (React + Vite)

Open a second terminal in this directory:

```bash
npm install
npm run dev
```

> Frontend will be running at `http://localhost:5173`.

---

## Testing

1. Open `http://localhost:5173` in two different browser windows or tabs.
2. Enter a unique username in each window and click **Join**.
3. Send messages back and forth to see real-time broadcasting and join/leave events.

---

## Deployment

### 1. Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/<your-username>/<your-repo>.git
git push -u origin main
```

### 2. Backend — Render

1. Go to [Render Dashboard](https://dashboard.render.com/) → **New** → **Blueprint**.
2. Select your GitHub repository. It will automatically detect [`render.yaml`](file:///c:/Users/rohit/Swastham-Projects/Community-feature/chat-prototype/render.yaml).
3. Once deployed, copy the service URL (e.g., `https://chat-backend.onrender.com`).

### 3. Frontend — Vercel

1. Go to [Vercel Dashboard](https://vercel.com/) → **Add New** → **Project** → Import your GitHub repository.
2. Under **Environment Variables**, add:
   - **Key**: `VITE_WS_URL`
   - **Value**: `wss://chat-backend.onrender.com` *(use `wss://`, your Render URL, with no trailing slash)*
3. Click **Deploy**.

