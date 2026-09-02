# Findings & Engineering Decisions

---

## 1. Architecture and Transport Decisions

### Why Node.js for the Backend
I chose **Node.js** for the ingestion backend due to its non-blocking, event-driven I/O model. In an IoT and robotics telemetry context, the workload consists of hundreds or thousands of high-frequency, lightweight HTTP POST payloads arriving concurrently. Node.js handles asynchronous network streams with minimal memory overhead compared to thread-per-request architectures.

### Why WebSocket for Live Dashboard Updates
For sub-second fleet visibility, HTTP polling was rejected due to header overhead, connection churn, and artificial latency. **WebSocket** (`ws://localhost:3000/ws`) establishes a persistent, low-overhead bidirectional TCP connection:
- Allows the backend to push updates immediately upon ingestion ($< 1\text{ms}$ fan-out delay).
- Drastically reduces HTTP connection handshake overhead.
- Supports automatic full snapshot synchronization on initial connection or reconnection.

### Why In-Memory Map for Current State
I selected a native JavaScript `Map<string, RobotState>` as the authoritative current state store:
- **$O(1)$ Time Complexity:** Inserting, updating, and reading robot state requires sub-millisecond execution.
- **Zero Disk I/O Bottlenecks:** Telemetry ingestion never blocks on disk serialization or database connection pool limits.
- **Simplicity:** No external database daemon setup, zero configuration overhead, and trivial local development.

**Costs of In-Memory State:**
- State is volatile; restarting the backend process clears the map (though the continuous simulator repopulates state within one tick).
- No historical time-series queries (persistent history is not stored).
- Horizontal scaling across multiple backend instances would require an external shared memory layer (such as Redis).

### Why JavaScript Was Chosen (No TypeScript)
The project was constructed in standard **Modern JavaScript (ES6+ / CommonJS in Backend, ESM in Frontend)**:
- Eliminates transpilation toolchain complexity, build step slowdowns, and configuration friction.
- Enables rapid iteration and immediate execution across standard Node.js and Vite runtimes.

---

## 2. What Degrades as Fleet Size Increases

### Measured Benchmark Observations

I executed an automated load benchmark (`node simulator/benchmark.js`) testing 5 distinct fleet configurations under live conditions.

#### Summary Table of Measured Benchmarks:

| Configuration | Fleet Size | Interval (ms) | Total Events | Updates / Sec | Avg Latency (ms) | Min Latency (ms) | Max Latency (ms) | Ingestion Failures | Backend Memory State |
|---|---|---|---|---|---|---|---|---|---|
| **Baseline** | 8 | 1,000 | 112 | 7 | 17.5 | 3 | 182 | 0 | 8 units |
| **Light** | 100 | 500 | 2,900 | 193 | 10.4 | 8 | 16 | 0 | 100 units |
| **Medium** | 500 | 1,000 | 9,500 | 475 | 33.7 | 29 | 38 | 0 | 500 units |
| **High** | 1,000 | 1,000 | 19,000 | 949 | 47.4 | 36 | 72 | 0 | 1,000 units |
| **Stress** | 2,000 | 2,000 | 18,000 | 900 | 123.9 | 85 | 303 | 0 | 2,000 units |

### Key Bottleneck Analysis

1. **Observed vs. Expected Latency Curve:**
   - Up to **1,000 robots**, ingestion latency remained extremely low and predictable ($10\text{ms} - 47\text{ms}$).
   - At **2,000 robots**, average batch latency climbed to **123.9ms**, with peak bursts reaching $303\text{ms}$.
2. **Simulator CPU:**
   - In the current single-threaded simulator, running kinematic math and status probabilities for 2,000 agents in one tick accounts for the majority of the latency spike.
3. **WebSocket Broadcast Cost:**
   - Dispatching 1,000+ individual JSON frames per second creates TCP socket buffering on the server event loop.
4. **Frontend Rendering (Canvas vs. DOM/SVG):**
   - Utilizing an **HTML5 Canvas** instead of individual React DOM or SVG nodes maintains smooth 60fps animation even at 1,000 units. DOM-based nodes would cause severe layout thrashing at this scale.
5. **Trend Buffer Memory:**
   - The client trend buffer is strictly capped at `MAX_BUFFER = 2000` data points ($< 1\text{ MB}$ memory footprint), preventing browser memory leaks during prolonged sessions.

---

## 3. What Was Cut

1. **Persistent MongoDB History:**
   - Intentionally **removed** from the application.
   - *Rationale:* Eliminates disk write latency and removes external daemon dependencies, yielding a lean, deterministic real-time streaming pipeline.
2. **Historical Time-Series Query Endpoint (`/robots/history`):**
   - Removed since persistent historical logs are not stored.
3. **Optional Persistent History Stretch Goal:**
   - Declared out of scope to focus entirely on sub-second live state streaming and 60fps visualization.

---

## 4. What I Would Build Next

1. **Delta Batching & Message Coalescing:**
   - Buffer incoming state updates into 50ms time windows on the backend and broadcast a single array frame `[{ id, x, y, status }, ...]` over WebSocket, reducing message count by over 90%.
2. **Shared State & Event Streaming (Horizontal Scaling):**
   - Introduce **Redis Pub/Sub** or **NATS** if scaling across multiple backend instances is required.
3. **Persistent Historical Telemetry Layer:**
   - If historical replay is needed in the future, integrate a dedicated time-series database (such as TimescaleDB or ClickHouse) via an asynchronous background worker queue (e.g. BullMQ / Kafka).
4. **Spatial Canvas Culling & Level of Detail (LoD):**
   - Render only robots within the active zoom/pan bounding box, and cluster dense robot groups into heatmaps when zoomed out.
5. **Connection Backpressure & Observability:**
   - Implement WebSocket backpressure monitoring and Prometheus metrics for telemetry ingest rate, queue depth, and WebSocket fan-out lag.

---

## 5. Failure Handling

### Stale Robot Heartbeat
- Backend background sweeper checks all robots every 3 seconds.
- Inactivity $>10\text{s}$ triggers transition to `isStale: true, status: 'offline', needsAttention: true`, immediately broadcasting an update to the dashboard.

### Robot Disconnect
- Last known coordinates are retained on the canvas map while the robot is flagged as offline with a red status indicator.

### Out-of-Order Events
- `robotState.upsert()` evaluates incoming $t$ against the per-robot timestamp cache.
- Updates where $t \le \text{lastAcceptedT}$ are rejected with HTTP 400, preventing stale data from overwriting newer telemetry.

### Dashboard Reconnect
- On WebSocket connection open, the backend automatically transmits a `{ type: 'snapshot', robots: [...] }` message containing all current in-memory robot states.
- The client atomically synchronizes its local state.

### Backend Restart
- In-memory `Map` resets on process termination.
- Upon restart, the connected simulator automatically repopulates the entire fleet state within one simulation tick.

---

## 6. Security & Hardening

- **Admin Authentication:** Runtime configuration endpoints (`GET /config`, `POST /config`) require a Bearer token matching `ADMIN_TOKEN`.
- **Environment Isolation:** Secrets and configuration tokens are loaded via environment variables (`.env`) and never hard-coded in client bundles or committed to Git.
- **CORS Protection:** Configured via `CORS_ORIGIN` to restrict cross-origin access in production.
- **Ingestion & Admin Rate Limiting:** Rate limiters protect the backend against denial-of-service and brute-force token scanning.
