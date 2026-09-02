# System Architecture & Technical Specifications

## 1. High-Level Architecture Diagram

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
                    │     WebSocket        │
                    └──────────┬───────────┘
                               │
                         Validate Update (validator.js)
                               │
                               ▼
                    ┌──────────────────────┐
                    │   In-Memory Map      │
                    │   Current State      │
                    └──────────┬───────────┘
                               │
                         Live Broadcast ({ type: "update" })
                               │
                               ▼
                    ┌──────────────────────┐
                    │   React Dashboard    │
                    │     JavaScript       │
                    └──────────┬───────────┘
                               │
                         Rolling Buffer
                               │
                               ▼
                    ┌──────────────────────┐
                    │ Bounded Trend Chart  │
                    │ (In-Memory Buffer)   │
                    └──────────────────────┘
```

---

## 2. Complete Event Flow

The real-time lifecycle from telemetry generation to screen rendering follows these 10 steps:

1. **Simulator Generates Updates:** Autonomous `RobotAgent` state machines calculate coordinate updates, battery discharge/charge, and status transitions, advancing simulation time $t$.
2. **Backend Receives Updates:** `FleetSimulator` batches events and posts them via HTTP `POST /ingest` (or individual JSON payloads).
3. **Backend Validates Payload:** `validator.js` enforces schema types, ensuring $x \in [0, 900]$, $y \in [0, 560]$, $\text{battery} \in [0, 100]$, and `status` is a recognized enum value.
4. **Backend Checks Timestamp Ordering:** The out-of-order guard compares incoming $t$ against the per-robot `lastTimestamps` record. If $t \le \text{lastAcceptedT}$, the update is rejected to prevent older data from overwriting newer state.
5. **Valid Updates Update In-Memory Map:** Accepted updates modify the authoritative `Map<robot_id, RobotState>`, updating `updatedAt`, resetting `isStale` to `false`, and computing the `needsAttention` flag.
6. **Stale/Offline Detection Operates on In-Memory State:** A background interval timer (every 3s) scans the map. Any robot with no updates for $>10\text{s}$ is marked `status: 'offline', isStale: true, needsAttention: true`.
7. **Backend Broadcasts Live State:** The WebSocket engine (`wsServer.js`) broadcasts `{ type: 'update', robot }` frames to all connected dashboard clients and config listeners.
8. **React Receives the Update:** The client `useWebSocket` hook parses the incoming message and hands it to `useFleetState`.
9. **Dashboard Updates UI:** The 60fps HTML5 Canvas map re-renders the robot marker, reticle, and status glow; the sidebar and KPI counters update reactively.
10. **Trend Data Buffering:** The client appends the current working percentage (`(active + on_mission) / total * 100`) to a bounded rolling buffer (`MAX_BUFFER = 2000`) for the Active Fleet % trend chart.

---

## 3. Major System Components

### A. Autonomous Robot Simulator (`simulator/`)
- **`RobotAgent.js`:** Pure JavaScript state machine implementing kinematics, waypoint navigation, battery drain/recharging curves, and stochastic status transitions (`idle`, `active`, `on_mission`, `charging`, `blocked`, `error`, `maintenance`).
- **`FleetSimulator.js`:** Orchestrator that provisions $N$ agents, manages tick intervals, batches telemetry, and dispatches HTTP requests.
- **WebSocket Listener:** Connects to the backend WebSocket stream to receive zero-downtime runtime configuration updates (`fleetSize`, `updateIntervalMs`).

### B. Backend Ingestion & Broadcast Engine (`backend/`)
- **`server.js` & `app.js`:** Express application with security headers, CORS configuration, and rate limiters.
- **`validator.js`:** Fast, synchronous schema and coordinate boundary validation.
- **`robotState.js`:** In-memory store wrapping `Map<string, RobotState>`, sequence timestamp tracker, and the background stale heartbeat sweeper.
- **`wsServer.js`:** WebSocket server on `/ws` handling client connection lifecycles, initial snapshot distribution, and non-blocking broadcasting.
- **`routes/index.js`:** Public API routes (`GET /health`, `GET /robots`, `GET /robots/:robotId`, `POST /ingest`) and admin-protected routes (`GET /config`, `POST /config`).

### C. React Control Room Dashboard (`frontend/`)
- **`useWebSocket.js`:** WebSocket hook with exponential backoff reconnects and connection state tracking (`connected`, `reconnecting`, `disconnected`).
- **`useFleetState.js`:** In-memory local fleet state manager that computes derived KPI metrics and attention counts.
- **`SiteMap.jsx`:** High-performance HTML5 Canvas renderer executing inside a `requestAnimationFrame` loop for silky 60fps animations with zoom, pan, and unit focus.
- **`TrendChart.jsx`:** Recharts-based area chart consuming a client-side bounded buffer with selectable time windows (`1m` to `1h`).
- **`AdminModal.jsx`:** Protected management modal for runtime fleet sizing and cadence tuning.

---

## 4. Why In-Memory State Was Selected

1. **Ultra-Low Latency:** Ingesting, validating, and retrieving current state runs in sub-millisecond $O(1)$ memory operations with zero disk I/O overhead.
2. **Architectural Simplicity:** Eliminates database daemon dependencies, connection pool tuning, and migration scripts.
3. **High Throughput:** Avoids database write contention during high-frequency telemetry bursts (handling 1,000+ updates/second effortlessly).
4. **Frictionless Setup:** Developers can clone and run the application instantly without provisioning local or cloud databases.

---

## 5. Failure Scenarios & Edge Cases

### 1. A Robot Dies During a Mission
- **Behavior:** The robot hardware halts and abruptly stops transmitting telemetry.
- **Handling:** The backend's background heartbeat sweeper (`sweepStale`) inspects the in-memory `Map` every 3 seconds. When `Date.now() - robot.updatedAt > 10000ms`, the robot is marked `isStale: true, status: 'offline', needsAttention: true`.
- **UI Update:** The sweeper emits `{ type: 'update', robot }` over WebSocket. The dashboard updates the robot's badge to `OFFLINE`, highlights it in red, and increments the Attention counter.

### 2. A Robot Stops Sending Updates
- **Behavior:** Network loss or packet drop causes a temporary telemetry gap.
- **Handling:** Position is retained at the last known coordinates on the map. If the gap exceeds 10 seconds, the stale detector transitions the robot to `offline`.

### 3. Updates Arrive Late
- **Behavior:** A delayed telemetry packet reaches the backend after a lag spike.
- **Handling:** The timestamp $t$ is evaluated against `lastTimestamps.get(robot_id)`. If $t > \text{lastAcceptedT}$, the state is updated normally; if $t \le \text{lastAcceptedT}$, it is discarded.

### 4. Updates Arrive Out of Order
- **Behavior:** Due to network routing fluctuations, update $t=50$ arrives after update $t=51$.
- **Handling:** Update $t=51$ was already accepted (`lastAcceptedT = 51`). When $t=50$ arrives, `50 <= 51` evaluates to true; the backend rejects it with HTTP 400 (`Out-of-order update rejected`).
- **Result:** Newer coordinates and status are preserved without regression.

### 5. A Robot Reconnects
- **Behavior:** An offline robot resumes connectivity and transmits a fresh packet with $t > \text{lastAcceptedT}$.
- **Handling:** `robotState.upsert()` accepts the update, clears `isStale: false`, sets the newly reported status (e.g. `active`), and updates `updatedAt`.
- **UI Update:** The live WebSocket message restores normal status rendering and clears the alert ring.

### 6. The Dashboard Disconnects
- **Behavior:** The client browser loses internet connection or closes the laptop lid.
- **Handling:** `useWebSocket` catches the socket termination and updates the status indicator to `● RECONNECTING...`.
- **Recovery:** An exponential backoff loop (200ms → 400ms → 800ms ... up to 30s) automatically retries until connectivity returns.

### 7. The Dashboard Reconnects
- **Behavior:** The browser establishes a fresh WebSocket connection.
- **Handling:** The backend immediately sends `{ type: 'snapshot', robots: [...] }` containing the complete, authoritative in-memory fleet state.
- **UI Update:** `useFleetState.applySnapshot()` atomically overwrites local state, instantly synchronizing all robot coordinates and statuses.

### 8. The Backend Restarts
- **Behavior:** The Node.js backend process is killed and restarted.
- **Handling:** The in-memory `Map` is initialized empty. The frontend automatically reconnects via its backoff loop.
- **State Recovery:** As the continuous simulator sends its next tick (within 1 second), the in-memory `Map` repopulates and broadcasts the new state to all clients.

---

## 6. Scaling 10x (10,000+ Robots)

Scaling from the tested 2,000-robot threshold to **10,000+ active robots** requires addressing several architectural bottlenecks:

### 1. In-Memory State Limitations & Horizontal Clustering
- **Current:** Single Node.js process holds the authoritative state in memory.
- **10x Requirement:** A single process cannot handle tens of thousands of concurrent connections. Horizontally scaling across multiple backend instances requires a shared distributed state or event bus (e.g., **Redis Pub/Sub**, **NATS**, or **Apache Kafka**) so all instances observe identical fleet state.

### 2. WebSocket Fan-Out & Message Coalescing
- **Current:** Dispatches 1 individual JSON WebSocket message per robot update ($10,000\text{ msgs/s}$ at $10,000$ robots).
- **10x Requirement:** Implement delta batching—coalescing updates into 50ms time windows and broadcasting a single array payload `[{ id, x, y, status }, ...]`, cutting network frame overhead by 90%+.

### 3. CPU & Memory Utilization
- **Backend:** Validation and JSON parsing for 10,000 req/sec will saturate a single Node.js event loop thread. Utilize the Node.js `cluster` module or a reverse proxy load balancer (Nginx / Envoy) distributing traffic across CPU cores.
- **Memory:** 10,000 robot records require $\sim 50\text{ MB}$ of memory—heap memory remains low, but garbage collection pause times must be monitored.

### 4. Simulator Load
- **Current:** A single simulator process runs all robot state machines sequentially in an event loop tick.
- **10x Requirement:** Partition simulated robots across worker threads (`worker_threads`) or multiple simulator container instances.

### 5. Frontend Canvas Rendering & Culling
- **Current:** Canvas iterates and renders all robots on screen.
- **10x Requirement:** Implement **Spatial Viewport Culling** (only rendering robots within the visible camera rectangle) and **Level-of-Detail (LoD) Clustering** (rendering dense clusters as aggregated heatmaps or hexbins when zoomed out).

### 6. Bounded Trend Storage
- Client-side trend buffer must maintain its strict cap (`MAX_BUFFER = 2000`) and subsample older points to prevent browser memory bloat during prolonged operator sessions.
