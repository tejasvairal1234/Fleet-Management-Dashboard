# Fleet Management Dashboard

## Live URLs

Dashboard:
TBD

Backend:
TBD

WebSocket:
TBD

---

## Dashboard Output

![Fleet Management Dashboard](Output.png)

---

## 1. Project Overview

The **Fleet Management Dashboard** is a high-performance, real-time operations control room system designed to monitor and coordinate autonomous industrial robots (pickers, haulers, AMRs, sorters, carriers) moving across a warehouse floor.

The application operates on an **in-memory architecture**:
- A dedicated **Robot Simulator** generates autonomous, plausible robot movement, state transitions, and battery telemetry.
- A lightweight **Node.js Backend** receives telemetry, validates schemas, enforces out-of-order timestamp guards, maintains the authoritative fleet state in an in-memory `Map`, and broadcasts updates to connected clients over **WebSocket**.
- A responsive **React Dashboard** renders robot positions at 60fps on an HTML5 Canvas site map, providing search, status filters, attention alerts, a floating HUD unit inspector, and a live active fleet percentage trend chart.

---

## 2. Features

- **Live 60fps Canvas Map:** Viewport-optimized rendering of warehouse layout (`layout.png`, 900×560 coordinate space) with smooth pan, zoom, target reticle highlights, and pulsing warning rings for attention units.
- **Real-Time WebSocket Streaming:** Low-latency bidirectional updates (`/ws`) delivering immediate state updates and full snapshot recovery upon connection.
- **In-Memory Authoritative State:** $O(1)$ fast lookups with sub-millisecond retrieval and zero database disk bottlenecks.
- **Out-of-Order & Late Event Protection:** Automatic drop of stale telemetry ($t \le \text{lastAcceptedT}$) to prevent state or coordinate regression.
- **Automated Stale/Offline Detection:** Background sweeper checks robot heartbeats every 3 seconds and marks units exceeding the 10-second timeout as `offline`.
- **Search & Filter Sidebar:** Instant fuzzy searching by robot ID or type, with quick-filter chips and live attention count badges.
- **Interactive Detail HUD:** Inspect battery levels, status badges, exact coordinates $(X, Y)$, simulation time $(t)$, heartbeat age, diagnostic faults, and a "Focus" tool to center the map.
- **Active Fleet Trend Chart:** Rolling time-series chart of working fleet percentage (`active` + `on_mission`) with selectable time windows (`1m`, `5m`, `15m`, `30m`, `1h`) backed by a bounded in-memory buffer.
- **Protected Runtime Admin Controls:** Dynamic reconfiguration of fleet size (1 to 10,000) and update cadence (100ms to 60,000ms) without restarting or redeploying any service.

---

## 3. Technology Stack

- **Frontend:** React 18, JavaScript (ES Modules), Vite, Recharts, HTML5 Canvas API
- **Backend:** Node.js, Express, `ws` (WebSocket)
- **Simulator:** Node.js, `ws` client
- **Current State Store:** In-memory `Map<robot_id, RobotState>`
- **Trend Storage:** Bounded in-memory rolling time-series buffer (client-side)
- **Database:** None (pure in-memory architecture)
- **Styling:** Vanilla CSS (Dark Control Room Theme)
- **Testing:** Jest, Supertest
- **Containerization:** Docker, Docker Compose

---

## 4. Architecture Overview

```
                    ┌──────────────────────┐
                    │   Robot Simulator    │
                    │   Node.js / JS       │
                    └──────────┬───────────┘
                               │
                         Robot Updates (POST /ingest)
                               │
                               ▼
                    ┌──────────────────────┐
                    │      Backend         │
                    │   Node.js / Express  │
                    │   WebSocket (/ws)    │
                    └──────────┬───────────┘
                               │
                         Validate & Guard (t > lastT)
                               │
                               ▼
                    ┌──────────────────────┐
                    │   In-Memory Map      │
                    │   (Current State)    │
                    └──────────┬───────────┘
                               │
                         Live Broadcast ({ type: "update" })
                               │
                               ▼
                    ┌──────────────────────┐
                    │   React Dashboard    │
                    │   (Canvas + HUD)     │
                    └──────────┬───────────┘
                               │
                         Rolling Buffer
                               │
                               ▼
                    ┌──────────────────────┐
                    │ Bounded Trend Chart  │
                    │ (Active Fleet %)     │
                    └──────────────────────┘
```

---

## 5. How the Simulator Works

The simulator (`simulator/src/index.js`) autonomously models robot behavior rather than replaying static log files:
1. Initializes initial robots from `data/robots.json` (the 8 canonical seed units).
2. If `FLEET_SIZE > 8`, dynamically provisions additional agents (`robot_9`, `robot_10`, ...) with random waypoints and assigned types (`picker`, `hauler`, `AMR`, `sorter`, `carrier`).
3. Each agent runs an independent state machine (`RobotAgent.js`):
   - **Movement:** Interpolates position smoothly toward target waypoints within the $900 \times 560$ map boundary.
   - **Battery Dynamics:** Drains battery during `active` and `on_mission` states; recharges when `charging`; clamps values between 0% and 100%.
   - **Status Transitions:** Probabilistically transitions across `idle`, `active`, `on_mission`, `charging`, `blocked`, `error`, and `maintenance`.
4. Dispatches batched updates via HTTP `POST /ingest` at the configured `UPDATE_INTERVAL_MS` interval.
5. Connects as a WebSocket client to `ws://localhost:3000/ws` to receive runtime admin config changes dynamically.

---

## 6. How the Backend Works

The backend (`backend/src/server.js`) coordinates ingestion and broadcasting:
1. **Validation (`validator.js`):** Enforces schema constraints (non-empty ID, $x \in [0, 900]$, $y \in [0, 560]$, $\text{battery} \in [0, 100]$, valid status enum, $t \ge 0$).
2. **Out-of-Order Guard:** Compares incoming timestamp $t$ against the per-robot `lastTimestamps` cache. If $t \le \text{lastAcceptedT}$, the update is rejected with HTTP 400.
3. **In-Memory State Store (`robotState.js`):** Upserts accepted state into `Map<robot_id, RobotState>` and computes the `needsAttention` flag.
4. **WebSocket Broadcast (`wsServer.js`):** Dispatches `{ type: "update", robot }` messages to all connected dashboard clients immediately.
5. **Periodic Stale Sweep:** Runs every 3 seconds. Any robot with no updates for $>10\text{s}$ is updated to `status: 'offline', isStale: true` and broadcast over WebSocket.

---

## 7. How the React Dashboard Works

The frontend (`frontend/src/App.jsx`) is optimized for responsiveness:
- **WebSocket Hook (`useWebSocket.js`):** Manages connection lifecycle with automatic exponential backoff (200ms to 30s) and applies full snapshot synchronization upon connecting.
- **Fleet State Hook (`useFleetState.js`):** Maintains the local `Map` and derives fleet KPI metrics (`Total`, `Working`, `Idle`, `Charging`, `Attention`, `Offline`).
- **Canvas Site Map (`SiteMap.jsx`):** Renders the warehouse map and robots on an HTML5 `<canvas>` inside a 60fps `requestAnimationFrame` loop, supporting wheel zoom, dragging pan, and auto-fit scaling.
- **Sidebar (`RobotList.jsx`):** Filterable, searchable list with battery gauges and attention badges.
- **Detail HUD (`RobotDetail.jsx`):** Displays telemetry metrics and provides a "Focus" action to pan/zoom directly to the selected robot.
- **Trend Chart (`TrendChart.jsx`):** Visualizes the percentage of active fleet over time using Recharts.

---

## 8. In-Memory State Design

- **Current State:** Stored exclusively in an in-memory `Map<robot_id, RobotState>`.
- **Lookup Complexity:** $O(1)$ read and write operations.
- **No Database Dependency:** The backend does not require MongoDB, PostgreSQL, or any external database service.
- **Persistence Boundary:** Current state resides strictly in volatile memory. Restarting the backend resets the map; the state repopulates automatically within 1 tick as the simulator publishes data.

---

## 9. WebSocket Communication

**Endpoint:** `ws://localhost:3000/ws`

### Protocol Messages
- **Connection Snapshot (Server → Client):**
  ```json
  { "type": "snapshot", "robots": [...all current robot states...], "timestamp": 1788350617454 }
  ```
- **Live Update (Server → Client):**
  ```json
  { "type": "update", "robot": { "robot_id": "r1", "x": 120.4, "y": 88.2, "battery": 94.2, "status": "on_mission", "t": 45.0, ... } }
  ```
- **Config Broadcast (Server → Simulator / Clients):**
  ```json
  { "type": "config", "config": { "fleetSize": 100, "updateIntervalMs": 1000 } }
  ```

---

## 10. Admin Controls & Security

Runtime reconfiguration allows operators to scale the fleet and adjust update cadence without restarting or rebuilding containers:
- **UI Modal:** Accessible via the **⚙ Admin** button in the header.
- **API Endpoints:** `GET /config` and `POST /config`.
- **Security:**
  - Protected via `ADMIN_TOKEN` (`Bearer <token>`).
  - The token is defined in the backend environment (`.env`) and is never hard-coded in client bundles.
  - Rate-limited to 60 requests/minute to prevent brute-force attacks.

```bash
# Example: Change fleet size to 500 and cadence to 500ms via API
curl -X POST http://localhost:3000/config \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer changeme-admin-token" \
  -d '{"fleetSize": 500, "updateIntervalMs": 500}'
```

---

## 11. Configuration & Environment Variables

### Backend (`backend/.env`)

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | Port for Express HTTP and WebSocket server |
| `ADMIN_TOKEN` | `changeme-admin-token` | Secret Bearer token for admin endpoints |
| `ROBOT_STALE_TIMEOUT_MS` | `10000` | Inactivity timeout (ms) before marking robot offline |
| `CORS_ORIGIN` | `http://localhost:5173` | Allowed CORS origins |

### Simulator (`simulator/.env`)

| Variable | Default | Description |
|---|---|---|
| `BACKEND_URL` | `http://localhost:3000` | Backend base URL for ingestion and WebSocket |
| `FLEET_SIZE` | `8` | Initial number of robots to simulate |
| `UPDATE_INTERVAL_MS` | `1000` | Telemetry publishing interval per robot (ms) |
| `PAYLOAD_SIZE` | `512` | Target event payload size in bytes (pads payload) |

---

## 12. Local Setup

### Prerequisites
- Node.js 18+ (tested on Node 20 and 22)
- npm 9+

### Install Dependencies
```bash
cd backend && npm install
cd ../simulator && npm install
cd ../frontend && npm install
cd ..
```

### Environment Setup
```bash
cp .env.example backend/.env
cp simulator/.env.example simulator/.env
```

---

## 13. Running Frontend
```bash
cd frontend
npm run dev
```
Runs Vite dev server on `http://localhost:5173`.

---

## 14. Running Backend
```bash
cd backend
npm run dev
```
Starts Express & WebSocket server on `http://localhost:3000`.

---

## 15. Running Simulator
```bash
cd simulator
npm run dev
```
Starts the autonomous robot simulation.

---

## 16. Automated Testing

Run the full unit and integration test suite:
```bash
cd backend
npm test
```
*Executes 29 automated tests verifying schema validation, boundary conditions, out-of-order rejection, in-memory state management, stale detection sweeps, rate limiting, and admin authentication.*

---

## 17. Automated Performance Benchmarking

Run the automated load test suite across fleet sizes:
```bash
cd simulator
node benchmark.js
```
*Tests configurations from 8 to 2,000 robots, measuring updates/second and round-trip batch latency.*

---

## 18. Running with Docker Compose

To build and run all services:
```bash
docker compose up --build
```
Access the dashboard at `http://localhost:5173`.

---

## 19. Limitations

1. **Volatile State:** Because current state is stored strictly in memory, restarting the backend clears the state cache until the simulator sends the next tick.
2. **Single-Instance Authority:** State is contained within a single Node.js process memory space; horizontal backend clustering requires an external distributed cache (e.g. Redis).
3. **No Historical Database:** Telemetry is streamed live; querying past historical tracks prior to the browser session is not supported.

---

## 20. Optional Stretch Goal Status

- **Persistent Database History:** Intentionally **not implemented**. The project adheres to a pure in-memory state architecture for simplicity, deterministic low latency, and zero database dependencies.
- **Client Trend Buffer:** The Active Fleet % chart uses a bounded in-memory circular buffer (`MAX_BUFFER = 2000`) on the client to prevent unbounded memory growth while providing dynamic time-window filtering.
