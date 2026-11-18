const client = require("prom-client");

const register = new client.Registry();
client.collectDefaultMetrics({ register });
const sockets = new client.Gauge({
  name: "chat_socket_connections",
  help: "Current connected Socket.IO clients",
  registers: [register],
});
const socketRejected = new client.Counter({
  name: "chat_socket_events_rejected_total",
  help: "Rejected Socket.IO events",
  labelNames: ["event", "reason"],
  registers: [register],
});
const kafkaLag = new client.Gauge({
  name: "chat_kafka_consumer_lag",
  help: "Committed consumer lag in records",
  labelNames: ["topic", "partition"],
  registers: [register],
});
const dependencyReady = new client.Gauge({
  name: "chat_dependency_ready",
  help: "Dependency readiness",
  labelNames: ["dependency"],
  registers: [register],
});
const rateLimited = new client.Counter({
  name: "chat_rate_limited_total",
  help: "Rate limited requests or events",
  labelNames: ["kind"],
  registers: [register],
});

module.exports = {
  register,
  sockets,
  socketRejected,
  kafkaLag,
  dependencyReady,
  rateLimited,
};
