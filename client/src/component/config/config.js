const runtimeApiRoot =
  typeof window !== "undefined" ? window.__APP_CONFIG__?.API_ROOT : undefined;

const config = {
  API_ROOT:
    typeof runtimeApiRoot === "string"
      ? runtimeApiRoot
      : process.env.REACT_APP_API_ROOT || "http://localhost:5000",
};

module.exports = config;
