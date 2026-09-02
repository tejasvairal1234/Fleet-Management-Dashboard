# Fleet Management Dashboard

## Deployment URLs

```
Dashboard URL:  http://localhost:5173
Backend URL:    http://localhost:3000
WebSocket URL:  ws://localhost:3000/ws
```

> Production environments: Set `CORS_ORIGIN` and `ADMIN_TOKEN` via environment variables.

---

## Project Overview

A high-performance, real-time Fleet Management Dashboard for monitoring, visualizing, and controlling autonomous warehouse robots (pickers, haulers, AMRs, sorters, carriers). The system operates on a pure **in-memory** state architecture:

1. **Robot Simulator** — High-fidelity state machine that autonomously generates realistic robot movement, waypoint navigation, battery drain/recharge cycles, and stochastic status transitions based on the `robots.json` roster.
2. **Backend Ingestion Pipeline** — High-throughput Node.js/Express server that validates robot telemetry, enforces out-of-order timestamp guards, maintains an $O(1)$ in-memory current state cache (`Map<robot_id, RobotState>`), and broadcasts live updates via WebSocket.
3. **Control Room Dashboard** — High-performance React 18 frontend with a 60fps HTML5 Canvas site map, live target reticles, zoom/pan navigation, searchable robot sidebar, instant status filters, floating HUD detail drawers, active fleet trend charts, and runtime admin controls.

---

## Target Architecture

```
┌────────────────────────────────────────────────────────┐
│               Autonomous Robot Simulator               │
│               (Node.js / State Machines)               │
└───────────────────────────┬────────────────────────────┘
                            │ HTTP POST /ingest (batch or single)
                            ▼
┌────────────────────────────────────────────────────────┐
│                    Backend Server                      │
│                 (Node.js / Express)                    │
│                                                        │
│  ├─ 1. Payload & Coordinate Schema Validation          │
│  ├─ 2. Out-of-Order Rejection (t <= lastAcceptedT)     │
│  ├─ 3. In-Memory Map (Map<robot_id, RobotState>)       │
│  ├─ 4. Periodic Stale Heartbeat Sweep (3s interval)    │
│  └─ 5. Real-Time Broadcast ──────────────► WebSocket   │
└───────────────────────────┬────────────────────────────┘
                            │ ws://localhost:3000/ws
                            ▼
┌────────────────────────────────────────────────────────┐
│                Operations Dashboard                    │
│           (React 18 / Vite / HTML5 Canvas)             │
│                                                        │
│  ├─ Header & Live Heartbeat Counter                    │
│  ├─ 6-KPI Summary Metric Bar                           │
│  ├─ Searchable & Filterable Robot Sidebar              │
│  ├─ Viewport-Optimized 60fps Canvas Site Map           │
│  ├─ Selected Robot HUD & Focus Tool                    │
│  └─ Collapsible Active Fleet % Trend Chart             │
└────────────────────────────────────────────────────────┘
```

> **Note on Storage:** All current state is stored exclusively in memory. No persistent database (MongoDB, SQL, etc.) is required. Restarting the backend resets current state, which repopulates within one tick as the simulator publishes updates.

---

## Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Frontend** | React 18, Vite, Recharts, Canvas API | Real-time 60fps operations dashboard |
| **Backend** | Node.js, Express, `ws` (WebSocket) | High-throughput ingestion & live broadcast |
| **Simulator** | Node.js, `ws` client | Autonomous robot state machines & movement |
| **Current State** | In-Memory `Map<robot_id, RobotState>` | Microsecond $O(1)$ read/write & snapshotting |
| **Styling** | Vanilla CSS (Dark Control Room Theme) | Zero-overhead, high-density responsive layout |
| **Testing** | Jest, Supertest | Unit, schema, and API integration testing |
| **Containerization** | Docker, Docker Compose | Production multi-container orchestration |

---

## Local Setup & Quick Start

### Prerequisites
- Node.js 18+ (tested on Node 20/22)
- npm 9+

### Step 1: Install Dependencies
```bash
# Install backend, simulator, and frontend packages
cd backend && npm install
cd ../simulator && npm install
cd ../frontend && npm install
cd ..
```

### Step 2: Configure Environment
```bash
# Copy default environment templates
cp .env.example backend/.env
cp simulator/.env.example simulator/.env
```

### Step 3: Run Application Services
Open 3 terminal windows:

```bash
# Terminal 1 — Backend API & WebSocket Server
cd backend && npm run dev

# Terminal 2 — Autonomous Simulator
cd simulator && npm run dev

# Terminal 3 — React Dashboard
cd frontend && npm run dev
```

Open **`http://localhost:5173`** in your browser.

---

## Running with Docker Compose

To spin up the entire cluster (Backend, Simulator, Frontend Nginx):

```bash
docker compose up --build
```

Access the dashboard at `http://localhost:5173`.

---

## Configuration & Environment Variables

### Backend Configuration (`backend/.env`)

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | Port for the Express HTTP server and WebSocket |
| `ADMIN_TOKEN` | `changeme-admin-token` | Secret Bearer token for runtime admin control |
| `ROBOT_STALE_TIMEOUT_MS` | `10000` | Inactivity duration (ms) before marking robot offline |
| `CORS_ORIGIN` | `http://localhost:5173` | Allowed CORS origin |

### Simulator Configuration (`simulator/.env`)

| Variable | Default | Description |
|---|---|---|
| `BACKEND_URL` | `http://localhost:3000` | Backend API base URL |
| `FLEET_SIZE` | `8` | Initial number of robots to simulate |
| `UPDATE_INTERVAL_MS` | `1000` | Telemetry publishing interval per robot (ms) |
| `PAYLOAD_SIZE` | `512` | Target event payload size in bytes |

---

## Runtime Controls (Zero-Downtime Reconfiguration)

The system supports adjusting fleet size (1 to 10,000 robots) and telemetry cadence (100ms to 60,000ms) on live instances without restarting or redeploying.

### Option A: UI Admin Panel
1. Click the **⚙ Admin** button in the top-right header of the dashboard.
2. Enter the admin token (`changeme-admin-token`).
3. Set the desired **Fleet Size** and **Update Interval**.
4. Click **Apply Changes**. The simulator dynamically adds/trims robots and updates its tick cadence via WebSocket broadcast.

### Option B: Protected Admin REST API
```bash
# 1. Fetch current runtime configuration
curl -H "Authorization: Bearer changeme-admin-token" http://localhost:3000/config

# 2. Update fleet size to 500 and cadence to 500ms
curl -X POST http://localhost:3000/config \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer changeme-admin-token" \
  -d '{"fleetSize": 500, "updateIntervalMs": 500}'
```

---

## API Reference

### REST Endpoints

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/health` | Public | Health check: uptime, in-memory count, WS clients |
| `GET` | `/robots` | Public | Full current fleet snapshot from in-memory Map |
| `GET` | `/robots/:robotId` | Public | Current state of a specific robot |
| `POST` | `/ingest` | Public / Rate-limited | Ingest robot telemetry (accepts single event or batch array) |
| `GET` | `/config` | Bearer Token | Retrieve runtime configuration |
| `POST` | `/config` | Bearer Token | Update runtime fleet size and cadence |

### WebSocket API (`ws://localhost:3000/ws`)

- **On Connection:** Server transmits `{ "type": "snapshot", "robots": [...] }`
- **On Telemetry Update:** Server broadcasts `{ "type": "update", "robot": {...} }`
- **On Runtime Config Change:** Server broadcasts `{ "type": "config", "config": {...} }`

---

## Automated Testing & Benchmarking

### Run Automated Unit & Integration Tests
```bash
cd backend
npm test
```
*Tests cover payload validation, coordinate boundaries, status enums, out-of-order event rejection, stale heartbeat sweeps, attention classification, and admin auth.*

### Run Automated Performance Benchmark
```bash
cd simulator
node benchmark.js
```
*Executes load tests across 8, 100, 500, 1000, and 2000 robot configurations, outputting exact measured throughput and batch latency.*
