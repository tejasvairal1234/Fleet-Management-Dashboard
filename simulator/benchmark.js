'use strict';
const fetch = require('node-fetch');
const { FleetSimulator } = require('./src/simulator/FleetSimulator');

const CONFIGS = [
  { name: 'Baseline', fleetSize: 8, intervalMs: 1000, durationSec: 15 },
  { name: 'Light', fleetSize: 100, intervalMs: 500, durationSec: 15 },
  { name: 'Medium', fleetSize: 500, intervalMs: 1000, durationSec: 20 },
  { name: 'High', fleetSize: 1000, intervalMs: 1000, durationSec: 20 },
  { name: 'Stress', fleetSize: 2000, intervalMs: 2000, durationSec: 20 },
];

async function runBenchmark() {
  console.log('═════════════════════════════════════════════════════════════════════════');
  console.log('  FLEET MANAGEMENT DASHBOARD — AUTOMATED PERFORMANCE BENCHMARK');
  console.log('═════════════════════════════════════════════════════════════════════════\n');

  const results = [];

  for (const cfg of CONFIGS) {
    console.log(`▶ Running benchmark: ${cfg.name} (${cfg.fleetSize} robots @ ${cfg.intervalMs}ms interval for ${cfg.durationSec}s)...`);

    const latencies = [];
    const sim = new FleetSimulator({
      backendUrl: 'http://localhost:3000',
      fleetSize: cfg.fleetSize,
      intervalMs: cfg.intervalMs,
      payloadSize: 512,
    });

    sim.initialize();

    // Hook into _tick to capture exact batch latencies
    const originalTick = sim._tick.bind(sim);
    sim._tick = async function () {
      await originalTick();
      if (sim.stats.lastBatchMs > 0) {
        latencies.push(sim.stats.lastBatchMs);
      }
    };

    const startTime = Date.now();
    sim.start();

    await new Promise((resolve) => setTimeout(resolve, cfg.durationSec * 1000));
    sim.stop();

    const elapsedSec = (Date.now() - startTime) / 1000;
    const totalEvents = sim.stats.sent;
    const updatesPerSec = Math.round(totalEvents / elapsedSec);
    const avgLatency = latencies.length > 0 ? (latencies.reduce((a, b) => a + b, 0) / latencies.length).toFixed(1) : 0;
    const minLatency = latencies.length > 0 ? Math.min(...latencies) : 0;
    const maxLatency = latencies.length > 0 ? Math.max(...latencies) : 0;

    // Check backend health for memory
    let backendMem = 'N/A';
    try {
      const hRes = await fetch('http://localhost:3000/health');
      const hData = await hRes.json();
      backendMem = `${hData.robots} robots cached`;
    } catch {}

    const result = {
      name: cfg.name,
      fleetSize: cfg.fleetSize,
      intervalMs: cfg.intervalMs,
      totalEvents,
      updatesPerSec,
      avgLatencyMs: avgLatency,
      minLatencyMs: minLatency,
      maxLatencyMs: maxLatency,
      failed: sim.stats.failed,
      backendMem,
    };

    results.push(result);
    console.log(`  ✓ Completed: ${totalEvents.toLocaleString()} events sent | Rate: ${updatesPerSec}/sec | Avg Latency: ${avgLatency}ms (min: ${minLatency}ms, max: ${maxLatency}ms) | Failures: ${sim.stats.failed}\n`);

    // Cooldown
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }

  console.log('═════════════════════════════════════════════════════════════════════════');
  console.log('  FINAL OBSERVED MEASUREMENTS');
  console.log('═════════════════════════════════════════════════════════════════════════');
  console.table(results);
}

runBenchmark().catch(console.error);
