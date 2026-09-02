# System Architecture & Technical Specifications

## 1. High-Level Architecture Diagram

```
┌────────────────────────────────────────────────────────────────────────┐
│                       Autonomous Robot Simulator                       │
│                           (Node.js Engine)                             │
│                                                                        │
│   RobotAgent × N ───► FleetSimulator ───► HTTP POST /ingest           │
│   (State Machine)      (Orchestrator)      (Batch / Single JSON)       │
│         ▲                                                              │
│         └─────────── WebSocket /ws (Config Broadcast) ◄────────────┐   │
└────────────────────────────────────────────────────────────────────┼───┘
                                                                     │
                                                                     │
                                     ┌───────────────────────────────┘
                                     │
                                     ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        Backend API Server                              │
│                       (Node.js / Express)                              │
│                                                                        │
│  1. Ingestion Rate Limiter & Body Parser                               │
│  2. Payload & Boundary Validator (validator.js)                        │
│  3. Out-of-Order Timestamp Guard (t <= lastAcceptedT dropped)          │
│  4. In-Memory State Store (Map<robot_id, RobotState>)                  │
│  5. Background Stale Heartbeat Sweeper (3s cadence)                    │
│  6. Real-Time WebSocket Engine (wsServer.js)                           │
│  7. Protected Admin Control Route (POST /config)                       │
└──────────────────┬─────────────────────────────────────────────────────┘
                   │
                   │ WebSocket (/ws)
                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        Operations Dashboard                            │
│                  (React 18 / Vite / HTML5 Canvas)                      │
│                                                                        │
│  ├─ Header & Live Heartbeat Counter                                    │
│  ├─ 6-KPI Summary Metric Bar                                           │
│  ├─ Filterable Robot Sidebar                                           │
│  ├─ 60fps HTML5 Canvas Site Map                                        │
│  ├─ Selected Robot HUD & Focus Tool                                    │
│  └─ Collapsible Trend Chart Dock (In-Memory Buffer)                    │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Complete Event Lifecycle

> **From Telemetry Generation to Visual Screen Update**

1. **State Machine Tick:** `RobotAgent.tick(intervalMs)` calculates battery drain/charging, evaluates stochastic status transition probabilities, updates physical coordinates `(x, y)` toward waypoint targets with smooth jitter, and increments monotonic simulation time `t`.
2. **Batch Dispatch:** `FleetSimulator` aggregates individual robot payloads into a JSON array and transmits via HTTP `POST /ingest` to the backend.
3. **Ingestion & Validation:** `validator.js` asserts schema integrity: `robot_id` format, `x` in $[0, 900]$, `y` in $[0, 560]$, `battery` in $[0, 100]$, and `status` in valid enum values.
4. **Out-of-Order Guard:** `robotState.upsert()` queries `lastTimestamps.get(robot_id)`. If incoming `t <= lastAcceptedT`, the update is rejected to prevent state regression.
5. **In-Memory Cache Update:** The valid state is stored in the $O(1)$ `robotMap`, updating `updatedAt` to current epoch time, clearing `isStale`, and computing `needsAttention`.
6. **Live WebSocket Broadcast:** `wsServer.broadcast({ type: 'update', robot })` pushes the JSON payload to all connected dashboard clients and simulator config listeners.
7. **Client Ingestion:** React's `useWebSocket` hook parses the incoming message and updates local state via `applyUpdate(robot)`.
8. **Visual Rendering:** The Canvas render loop (`requestAnimationFrame`) queries the updated robot coordinates and renders the robot marker, status color glow, and target reticle at 60fps.

---

## 3. Comprehensive Failure Scenarios & Self-Healing Behaviors

### 1. Robot Dies Mid-Task (Silent Failure)
- **Failure:** A robot on mission stops publishing telemetry due to hardware or network failure.
- **Handling:** The backend's background sweep (`sweepStale`) checks all units every 3 seconds. Once inactivity exceeds `ROBOT_STALE_TIMEOUT_MS` (default 10s), the robot is marked `isStale: true, status: 'offline', needsAttention: true`.
- **Dashboard Response:** The sweeper broadcasts an immediate `{ type: 'update', robot }` WebSocket message. The dashboard marks the robot offline, retains its last known coordinates on the map, and places it in the Attention list.

### 2. Robot Reconnects / Recovers
- **Event:** A previously offline robot resumes transmitting telemetry with `t > lastAcceptedT`.
- **Handling:** `robotState.upsert()` accepts the fresh payload, resets `isStale: false`, updates status to the reported value (e.g. `idle` or `active`), and updates position.
- **Dashboard Response:** Real-time WebSocket message clears the attention flag and restores live movement.

### 3. Out-of-Order Events
- **Failure:** Network jitter causes message `t=101` to arrive before delayed message `t=100`.
- **Handling:** Message `t=101` is accepted and records `lastAcceptedT = 101`. When `t=100` arrives, `100 <= 101` evaluates to true; the payload is rejected with HTTP 400.
- **Result:** No coordinate or battery regression occurs.

### 4. Late Events (Lagging Telemetry)
- **Failure:** An update buffered on a lagging cellular link arrives 30 seconds late.
- **Handling:** Evaluated against `lastAcceptedT`. If older than the current in-memory timestamp, it is discarded. If newer, it updates the state normally.

### 5. Dashboard Disconnects (Browser Client Side)
- **Failure:** The user's browser loses network connectivity or closes the laptop lid.
- **Handling:** `useWebSocket` detects `ws.onclose` and transitions UI status badge to `● RECONNECTING...` (Amber).
- **Auto-Recovery:** An exponential backoff reconnect loop (200ms → 400ms → 800ms ... up to 30s) automatically retries until connection is re-established.

### 6. Dashboard Reconnects
- **Recovery:** Upon WebSocket `onopen`, the backend automatically transmits a `{ type: 'snapshot', robots: [...] }` payload containing the entire current in-memory fleet state.
- **Dashboard Response:** `applySnapshot()` atomically replaces local state, ensuring zero data loss or duplicate entries.

### 7. Runtime Fleet Resize / Cadence Modification
- **Event:** Operator uses Admin Panel or `POST /config` to change fleet size from 8 to 1,000 robots at runtime.
- **Handling:** Backend updates `runtimeConfig` and broadcasts `{ type: 'config', config }` over WebSocket.
- **Simulator Response:** The autonomous simulator receives the broadcast and dynamically calls `setFleetSize(1000)` and `setInterval(newMs)` without process restarts or dropped frames.

---

## 4. Scalability Analysis: "What Would We Change First for a 10x Fleet (10,000+ Robots)?"

If the fleet scales by 10x to **10,000+ active robots**:

1. **WebSocket Delta Frame Coalescing:**
   - *Current:* 1 WebSocket message per robot update ($1,000\text{ msgs/sec}$ at $1,000$ robots).
   - *10x Solution:* Buffer incoming updates into 50ms time windows and dispatch a single combined array frame `[{id, x, y, ...}]`, reducing network frame overhead by 95%.
2. **Canvas Viewport Culling & Level of Detail (LoD):**
   - *Current:* Canvas renders all robots in the in-memory Map.
   - *10x Solution:* Only render robots whose coordinates intersect the current canvas viewport bounding box, and cluster dense regions into H3 hexbin density heatmaps when zoomed out.
3. **Ingestion Partitioning & Worker Clusters:**
   - Deploy Node.js Cluster mode or distribute `/ingest` endpoints across a load balancer with a Redis / NATS stream message queue.
