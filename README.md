# Fleet Management Dashboard

> A production-quality real-time fleet management system for warehouse robots.

## Live URLs

Dashboard: `http://localhost:5173` (development)  
Backend: `http://localhost:5000` (development)

---

## Project Overview

This system provides a real-time operations control center for managing a fleet of autonomous warehouse robots. It simulates robot movement, tracks status transitions, and displays live data on an interactive dashboard.

## Architecture

```
Robot Simulator (Node.js)
       ↓
Express Backend (Port 5000)
  ├── Validation
  ├── Fleet State Manager (Map<robot_id, state>)
  ├── Offline Detection
  └── WebSocket Server (/ws)
       ↓
React Frontend (Port 5173)
  ├── useWebSocket (auto-reconnect with exponential backoff)
  ├── FleetContext (global state)
  ├── KPI Cards
  ├── Robot List (filterable/searchable)
  ├── Canvas Map (hardware-accelerated, zoom/pan)
  └── Live Trend Chart
```

## Features

- **Live robot tracking**: 200+ robots with real-time position, status, battery
- **Canvas map**: Hardware-accelerated rendering, zoom/pan, click detection
- **KPI cards**: Total, Working, Idle, Charging, Attention, Offline counts
- **Sidebar**: Search, filter by status, live counts
- **Robot details**: Battery, coordinates, heartbeat, connection state
- **Trend chart**: Active fleet % over 1m/5m/15m/30m/1h windows
- **Admin panel**: Change fleet size and update interval at runtime
- **Auto-reconnect**: Exponential backoff (2s → 4s → 8s → ... → 30s)
- **Offline detection**: Robots marked offline after ROBOT_TIMEOUT_MS
- **Out-of-order handling**: Stale events rejected

## Status Definitions

| Category | Statuses |
|----------|----------|
| **WORKING** | `active`, `on_mission` |
| **ATTENTION** | `blocked`, `error`, `maintenance`, `offline`, battery < 20% |

### All Valid Statuses

| Status | Color | Description |
|--------|-------|-------------|
| `idle` | Gray | Robot waiting for assignment |
| `active` | Blue | Robot performing work |
| `on_mission` | Green | Robot on active mission |
| `charging` | Purple | Robot at charging station |
| `blocked` | Orange | Robot path blocked |
| `error` | Red | Robot in error state |
| `maintenance` | Yellow | Robot under maintenance |
| `offline` | Dark Gray | Robot not responding |

## Tech Stack

**Backend**
- Node.js + Express
- WebSocket (ws library)
- helmet, cors, express-rate-limit

**Frontend**
- React 18 + Vite
- HTML Canvas (robot rendering)
- Recharts (trend chart)
- CSS custom properties

## Local Setup

### Prerequisites
- Node.js >= 18.0.0
- npm >= 9.0.0

### Backend

```bash
cd backend
cp .env.example .env
# Edit .env as needed
npm install
npm run dev
```

### Frontend

```bash
cd frontend
cp .env.example .env
# Edit VITE_API_URL and VITE_WS_URL if backend is not on localhost:5000
npm install
npm run dev
```

Open http://localhost:5173

## Environment Variables

### Backend (.env)

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `5000` | HTTP server port |
| `FLEET_SIZE` | `200` | Initial number of robots |
| `UPDATE_INTERVAL_MS` | `1000` | Simulation tick interval |
| `PAYLOAD_SIZE` | `512` | Event payload size hint |
| `ROBOT_TIMEOUT_MS` | `10000` | Time before robot marked offline |
| `ADMIN_API_KEY` | (required) | Key for admin endpoints |
| `CORS_ORIGIN` | `http://localhost:5173` | Allowed frontend origin |

### Frontend (.env)

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_URL` | `http://localhost:5000` | Backend REST URL |
| `VITE_WS_URL` | `ws://localhost:5000/ws` | WebSocket URL |

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/health` | Health check + fleet stats |
| `GET` | `/api/robots` | All robot states |
| `GET` | `/api/robots/:id` | Single robot state |
| `POST` | `/api/robots/events` | Ingest robot event(s) |
| `GET` | `/api/simulator/config` | Current simulator config |
| `PUT` | `/api/simulator/config` | Update config (requires X-Admin-Key) |

## WebSocket

Connect to: `ws://localhost:5000/ws`

### Messages from server:

```json
// Full snapshot (on connect)
{ "type": "snapshot", "robots": [...] }

// Individual robot update
{ "type": "robot_update", "robot": { "robot_id": "r1", "x": 123, ... } }
```

## Simulator Configuration

At runtime, administrators can change:
- **Fleet Size**: 1–2000 robots
- **Update Interval**: 100ms–60000ms

Changes take effect immediately without redeploying.

## Admin Controls

In the dashboard, click **Admin** (top right). Enter:
- New fleet size
- New update interval  
- Admin API key (matches `ADMIN_API_KEY` in backend `.env`)

## Out-of-Order Event Handling

Events with `t < current_t` for a robot are rejected with status 400:

```
Stale event: incoming t=102 < current t=105
```

## Performance Testing

See [FINDINGS.md](./FINDINGS.md) for actual performance results.

## Deployment

### Backend (production)
```bash
NODE_ENV=production PORT=5000 ADMIN_API_KEY=... node src/server.js
```

### Frontend (production build)
```bash
cd frontend
VITE_API_URL=https://your-backend.com VITE_WS_URL=wss://your-backend.com/ws npm run build
# Serve dist/ with any static file server
```

**Note**: Production WebSocket uses `wss://` (secure). Never hardcode localhost in production.

## Known Limitations

- Robot positions on restart are reset (no persistent storage)
- Site map obstacles are visual only (robots do not avoid them)
- Admin key is sent in HTTP header (use HTTPS in production)
- No authentication for dashboard access (add auth layer for production)

## Performance Recommendations

For 1000+ robots:
- Increase server CPU and RAM
- Consider reducing UPDATE_INTERVAL_MS to 2000ms
- Enable Node.js cluster mode for multi-core utilization
- Use Redis pub/sub for multi-instance deployment
