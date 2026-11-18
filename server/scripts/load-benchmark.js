const { performance } = require("node:perf_hooks");
const { io } = require("socket.io-client");

const base = process.env.LOAD_TEST_URL || "http://localhost:5000";
const token = process.env.LOAD_TEST_TOKEN;
const clients = Number(process.env.LOAD_TEST_CLIENTS || 25);
const durationMs = Number(process.env.LOAD_TEST_DURATION_MS || 30000);
if (
  !token ||
  !Number.isSafeInteger(clients) ||
  clients < 1 ||
  clients > 500 ||
  !Number.isSafeInteger(durationMs) ||
  durationMs < 1000
) {
  throw new Error(
    "Set LOAD_TEST_TOKEN, LOAD_TEST_CLIENTS (1-500), and LOAD_TEST_DURATION_MS (>=1000).",
  );
}

const sockets = [];
const latencies = [];
let failures = 0;
async function connectOne() {
  const started = performance.now();
  const socket = io(base, {
    auth: { token },
    transports: ["websocket"],
    reconnection: false,
    timeout: 5000,
  });
  sockets.push(socket);
  await new Promise((resolve) => {
    socket.once("connect", () => {
      latencies.push(performance.now() - started);
      resolve();
    });
    socket.once("connect_error", () => {
      failures++;
      resolve();
    });
  });
}

async function main() {
  const started = performance.now();
  try {
    await Promise.all(Array.from({ length: clients }, () => connectOne()));
    while (performance.now() - started < durationMs) {
      const response = await fetch(`${base}/livez`);
      if (!response.ok) failures++;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    latencies.sort((a, b) => a - b);
    const p95 =
      latencies[
        Math.min(latencies.length - 1, Math.floor(latencies.length * 0.95))
      ] ?? null;
    process.stdout.write(
      JSON.stringify({
        clients,
        connected: latencies.length,
        failures,
        connectP95Ms: p95,
        elapsedMs: Math.round(performance.now() - started),
      }) + "\n",
    );
  } finally {
    for (const socket of sockets) socket.disconnect();
  }
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
