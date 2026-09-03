# Fleet Management Dashboard

Dashboard: [https://fleet-management-dashboard-frontend.vercel.app/](https://fleet-management-dashboard-frontend.vercel.app/)  
Backend: [https://fleet-management-dashboard.onrender.com](https://fleet-management-dashboard.onrender.com)
Admin API Key: 5c739bc1bed3067de8e6fb9c76ae594c35b5985f1e785502249f2e3053f4025b

> A complete production-quality real-time operations control center and robot fleet management system for autonomous warehouse robots.

---

## Dashboard Preview

![Fleet Operations Control Center Output](./data/Output.png)

---

## Project Overview

The **Fleet Management Dashboard** is an industrial-grade operations control center designed to monitor, track, and manage fleets of autonomous warehouse robots (e.g. Pickers, Haulers, Carriers) in real time.

The system incorporates:
- A physics-based continuous robot simulator with state-machine behaviors
- An Express.js backend managing authoritative fleet state in `Map<robot_id, robotState>`
- Live WebSocket streaming with incremental deltas and full snapshot synchronization
- Hardware-accelerated HTML Canvas rendering for smooth 60 FPS site map visualization across fleets of 8, 100, 500, and 1,000+ robots
- Live KPI monitoring, searchable/filterable robot roster, robot detail inspect & focus, and real-time active fleet utilization trending

---

## Architecture

```
                 ┌─────────────────────────────────────┐
                 │           Robot Simulator           │
                 │  N robots (configurable: 1–2000)    │
                 │  Single central simulation loop     │
                 │  Realistic physics & state machine  │
                 └──────────────────┬──────────────────┘
                                    │ Batch events
                                    ▼
                 ┌─────────────────────────────────────┐
                 │         Express Backend             │
                 │  • Input & schema validation        │
                 │  • Out-of-order rejection (t check) │
                 │  • Authoritative State Map<id, state│
                 │  • Offline detector (heartbeat)     │
                 │  • REST API endpoints               │
                 │  • WebSocket Server (/ws)           │
                 └──────────────────┬──────────────────┘
                                    │ WebSocket
                                    ▼
                 ┌─────────────────────────────────────┐
                 │          React Frontend             │
                 │  • useWebSocket (backoff reconnect) │
                 │  • FleetContext (useReducer state)  │
                 │  • Responsive Hardware Canvas Map   │
                 │  • 6 Live KPI Metric Cards          │
                 │  • Searchable & Filterable Sidebar  │
                 │  • Robot Details Panel with Focus   │
                 │  • Real-Time Utilization Trend Line │
                 │  • Runtime Admin Control Panel      │
                 └─────────────────────────────────────┘
```

For comprehensive architectural design and scaling analysis, see [ARCHITECTURE.md](./ARCHITECTURE.md).

---

## Features

- **Live Robot Telemetry**: Real-time position tracking, battery level, status transitions, and heartbeat monitoring.
- **Hardware-Accelerated Canvas Map**:
  - High-performance HTML Canvas rendering capable of handling 1,000+ robots at 60 FPS.
  - Native pixel-accurate coordinate mapping directly over the warehouse `layout.png`.
  - Unified coordinate transform `{ scale, offsetX, offsetY, zoomLevel }` ensuring layout and robot markers zoom/pan in perfect synchronization.
  - Automatic initial viewport fitting (`fitToSite`) with padding.
  - Interactive zoom (`+`, `−`, focal-point preserved wheel) and pan (drag).
  - Accurate click hit-testing converting screen pixels to site coordinates.
  - One-click **Focus** button centering the robot and zooming to 2.0x.
  - Adaptive label density (full labels for fleets $\le 100$; targeted labels for selected/hovered/attention robots for fleets $> 100$).
- **Live KPI Status Cards**: Total Fleet, Working, Idle, Charging, Attention, and Offline counts with dynamic percentage calculations.
- **Interactive Sidebar & Roster**:
  - Search by robot ID (`r1`, `robot_143`) or type (`picker`, `hauler`, `carrier`).
  - 6 status filter tabs with live counters: All, Attention, Working, Idle, Charging, Offline.
- **Real-Time Active Fleet Trend Chart**: Dynamic line chart tracking Working % (`Active` + `On Mission`) with selectable time windows: 1m, 5m, 15m, 30m, 1h.
- **Runtime Admin Configuration Panel**:
  - Change Fleet Size (1–2,000 robots) and Update Interval (100ms–60,000ms) on the fly without redeployment.
  - Protected by `X-Admin-Key` header authentication.
- **Robust Failure Handling**:
  - Out-of-order event rejection (`incoming.t >= current.t`).
  - Automatic offline detection when heartbeat exceeds `ROBOT_TIMEOUT_MS`.
  - Automatic reconnection with exponential backoff (2s → 4s → 8s → 16s → 30s max).
  - Instant snapshot recovery upon reconnect.

---

## Tech Stack

### Backend
- **Runtime**: Node.js (v18+)
- **Framework**: Express.js
- **Real-time Protocol**: WebSocket (`ws` library)
- **Security & Reliability**: `helmet`, `cors`, `express-rate-limit`, centralized error handling

### Frontend
- **Framework**: React 18
- **Build Tool**: Vite
- **Map Engine**: HTML5 Canvas with requestAnimationFrame rendering
- **Charts**: Recharts
- **Styling**: Vanilla CSS with modern industrial dark theme design tokens

---

## Project Structure

```
Fleet Management Dashboard/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   └── config.js              # Environment & site configurations
│   │   ├── controllers/
│   │   │   ├── robotController.js      # REST controllers for robots & events
│   │   │   └── simulatorController.js  # Runtime simulator configuration
│   │   ├── middleware/
│   │   │   ├── auth.js                 # Admin API key authentication
│   │   │   └── errorHandler.js         # Centralized error & 404 handlers
│   │   ├── routes/
│   │   │   ├── robotRoutes.js          # /api/robots routes
│   │   │   └── simulatorRoutes.js      # /api/simulator routes
│   │   ├── services/
│   │   │   ├── fleetService.js         # State map, validation, offline detector
│   │   │   └── simulatorService.js     # Simulator ingestion pipeline bridge
│   │   ├── simulator/
│   │   │   ├── Robot.js                # State machine & battery dynamics
│   │   │   ├── movement.js             # Physics-based smooth continuous vector motion
│   │   │   └── robotSimulator.js       # Central scalable simulation loop
│   │   ├── utils/
│   │   │   └── logger.js               # Structured logger
│   │   ├── websocket/
│   │   │   └── websocketServer.js      # WebSocket server, heartbeat & broadcast
│   │   ├── app.js                      # Express app configuration
│   │   └── server.js                   # Server bootstrap & graceful shutdown
│   ├── .env.example
│   └── package.json
│
├── frontend/
│   ├── public/
│   │   └── layout.png                  # Site layout image
│   ├── src/
│   │   ├── components/
│   │   │   ├── Charts/
│   │   │   │   └── ActiveFleetChart.jsx # Real-time active fleet line chart
│   │   │   ├── Common/
│   │   │   │   └── AdminPanel.jsx       # Simulator configuration modal
│   │   │   ├── Layout/
│   │   │   │   └── Header.jsx           # Top navigation & connection badge
│   │   │   ├── Map/
│   │   │   │   └── CanvasMap.jsx        # Responsive Canvas site map
│   │   │   ├── Robots/
│   │   │   │   ├── RobotDetailPanel.jsx # Selected robot telemetry & focus
│   │   │   │   └── Sidebar.jsx          # Search, filters, and robot list
│   │   │   └── Stats/
│   │   │       └── KpiCards.jsx         # 6 KPI metric overview cards
│   │   ├── context/
│   │   │   └── FleetContext.jsx         # Centralized fleet state & reducers
│   │   ├── hooks/
│   │   │   ├── useFleet.js              # Hook for consuming FleetContext
│   │   │   ├── useRobotFilters.js       # Search & filter hook
│   │   │   └── useWebSocket.js          # Auto-reconnecting WebSocket hook
│   │   ├── services/
│   │   │   └── api.js                   # HTTP client service
│   │   ├── utils/
│   │   │   ├── format.js                # Timestamp, battery, coordinate formatters
│   │   │   └── status.js                # Status definitions, colors, badges
│   │   ├── App.jsx                      # Main dashboard layout shell
│   │   ├── index.css                    # Design tokens & responsive styles
│   │   └── main.jsx                     # React entry point
│   ├── .env.example
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
│
├── data/
│   ├── events.jsonl                     # Reference data contract events
│   ├── layout.png                       # Warehouse site layout map
│   ├── Output.png                       # Dashboard preview reference
│   └── robots.json                      # Seed robot roster
│
├── ARCHITECTURE.md                      # System architecture & scalability documentation
├── FINDINGS.md                          # Benchmark findings & test performance data
├── Output.png                           # Dashboard screenshot preview
└── README.md
```

---

## Status Definitions

| Category | Definition Criteria |
|---|---|
| **WORKING** | `active` OR `on_mission` |
| **ATTENTION** | `blocked` OR `error` OR `maintenance` OR `offline` OR `battery < 20%` |

### Status Reference & Palette

| Status | Color | Hex Code | Description |
|---|---|---|---|
| `idle` | Slate Gray | `#94a3b8` | Robot stationary, ready for mission assignment |
| `active` | Bright Blue | `#3b82f6` | Robot actively moving and executing work |
| `on_mission` | Emerald Green | `#10b981` | Robot engaged in priority mission |
| `charging` | Purple | `#8b5cf6` | Robot docked and recharging battery |
| `blocked` | Amber Orange | `#f59e0b` | Robot encountered an obstacle in its path |
| `error` | Crimson Red | `#ef4444` | Robot hardware or software fault detected |
| `maintenance` | Golden Yellow | `#eab308` | Robot scheduled for or undergoing service |
| `offline` | Dark Slate | `#475569` | Robot connection lost / heartbeat timed out |

---

## Local Setup

### Prerequisites
- **Node.js**: `>= 18.0.0`
- **npm**: `>= 9.0.0`

### 1. Backend Setup

```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

The backend server will start on `http://localhost:5000` and listen for WebSocket connections at `ws://localhost:5000/ws`.

### 2. Frontend Setup

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

Open your browser at `http://localhost:5173`.

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Default | Description |
|---|---|---|
| `PORT` | `5000` | HTTP and WebSocket port |
| `FLEET_SIZE` | `200` | Default initial robot count |
| `UPDATE_INTERVAL_MS` | `1000` | Central simulation tick rate in milliseconds |
| `PAYLOAD_SIZE` | `512` | Payload size guidance in bytes |
| `ROBOT_TIMEOUT_MS` | `10000` | Inactivity threshold before marking robot as `offline` |
| `ADMIN_API_KEY` | `fleet-admin-secret-2024` | Secret key required for admin configuration endpoints |
| `CORS_ORIGIN` | `http://localhost:5173` | Allowed CORS origin |
| `NODE_ENV` | `development` | Runtime environment mode |

### Frontend (`frontend/.env`)

| Variable | Default | Description |
|---|---|---|
| `VITE_API_URL` | `http://localhost:5000` | Backend REST API URL |
| `VITE_WS_URL` | `ws://localhost:5000/ws` | WebSocket server URL |

---

## REST API Endpoints

| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `GET` | `/api/health` | Health check, server uptime, fleet size, connected clients | No |
| `GET` | `/api/robots` | Full list of all current robot states | No |
| `GET` | `/api/robots/:robotId` | State of a specific robot by ID | No |
| `POST` | `/api/robots/events` | Ingest single or batch telemetry event(s) | No |
| `GET` | `/api/simulator/config` | Retrieve current simulator configuration and status | No |
| `PUT` | `/api/simulator/config` | Update fleet size and update interval dynamically | Yes (`X-Admin-Key`) |

### Example Event Ingestion (`POST /api/robots/events`):
```json
{
  "t": 1050,
  "robot_id": "r1",
  "robot_type": "picker",
  "x": 580.2,
  "y": 145.8,
  "status": "active",
  "battery": 82.5
}
```

---

## WebSocket Protocol

Clients connect to `ws://localhost:5000/ws` (or `wss://...` in production).

1. **Initial Snapshot** (sent immediately upon connection):
```json
{
  "type": "snapshot",
  "robots": [
    {
      "robot_id": "r1",
      "robot_type": "picker",
      "x": 569.9,
      "y": 33.0,
      "status": "idle",
      "battery": 84.4,
      "t": 0,
      "last_seen": 1725350000000
    }
  ]
}
```

2. **Incremental Update** (broadcast upon every state change):
```json
{
  "type": "robot_update",
  "robot": {
    "robot_id": "r1",
    "robot_type": "picker",
    "x": 574.1,
    "y": 36.2,
    "status": "active",
    "battery": 83.8,
    "t": 5,
    "last_seen": 1725350005000
  }
}
```

---

## Runtime Admin Controls

To reconfigure simulation parameters without restarting servers:
1. Click the **Admin** button in the top-right corner of the dashboard.
2. Enter desired **Fleet Size** (e.g., `8`, `100`, `500`, or `1000`).
3. Enter desired **Update Interval** (e.g., `1000`, `500`, or `250` ms).
4. Provide the Admin API Key (`fleet-admin-secret-2024` by default).
5. Click **Apply**. The simulator will dynamically scale and broadcast state changes seamlessly.

---

## Performance Testing

Benchmark tests conducted on the real-time simulation pipeline:

| Fleet Size | Interval | Process Memory | Update Rate | WebSocket Throughput / Client |
|---|---|---|---|---|
| **200 robots** | 1,000 ms | ~76 MB | 200 updates/s | ~30 KB/s |
| **500 robots** | 1,000 ms | ~76 MB | 500 updates/s | ~75 KB/s |
| **1,000 robots** | 1,000 ms | ~70 MB | 1,000 updates/s | ~147 KB/s |
| **1,000 robots** | 500 ms | ~70 MB | 2,000 updates/s | ~294 KB/s |
| **1,000 robots** | 250 ms | ~75 MB | 4,000 updates/s | ~586 KB/s |

Detailed benchmark methodology, bottleneck analysis, and scaling recommendations are documented in [FINDINGS.md](./FINDINGS.md).

---

## Production Deployment

### Backend
```bash
cd backend
NODE_ENV=production PORT=5000 ADMIN_API_KEY=your-secure-key node src/server.js
```

### Frontend
```bash
cd frontend
VITE_API_URL=https://api.yourdomain.com VITE_WS_URL=wss://api.yourdomain.com/ws npm run build
```
Serve the generated `frontend/dist/` directory with any static web server (Nginx, Caddy, Cloudflare Pages, S3/CloudFront).

---

## Known Limitations

- Simulation positions re-randomize on server restart (in-memory state without persistent database).
- Obstacles depicted on `layout.png` are visual context; robots navigate within the perimeter without A* collision avoidance.
- Authentication for the frontend admin panel uses a pre-shared API key; enterprise multi-tenant deployments should integrate SSO/OAuth2.
