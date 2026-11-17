function loadConfig() {
  jest.resetModules();
  return require("./config");
}

describe("client API configuration", () => {
  const originalBuildApiRoot = process.env.REACT_APP_API_ROOT;
  let originalRuntimeConfig;

  beforeEach(() => {
    originalRuntimeConfig = window.__APP_CONFIG__;
    delete window.__APP_CONFIG__;
  });

  afterEach(() => {
    if (originalBuildApiRoot === undefined) {
      delete process.env.REACT_APP_API_ROOT;
    } else {
      process.env.REACT_APP_API_ROOT = originalBuildApiRoot;
    }

    if (originalRuntimeConfig === undefined) {
      delete window.__APP_CONFIG__;
    } else {
      window.__APP_CONFIG__ = originalRuntimeConfig;
    }
  });

  test("prefers runtime configuration over the build-time value", () => {
    process.env.REACT_APP_API_ROOT = "https://build.example.com";
    window.__APP_CONFIG__ = { API_ROOT: "https://runtime.example.com" };

    expect(loadConfig().API_ROOT).toBe("https://runtime.example.com");
  });

  test("allows an empty runtime value for same-origin API requests", () => {
    process.env.REACT_APP_API_ROOT = "https://build.example.com";
    window.__APP_CONFIG__ = { API_ROOT: "" };

    expect(loadConfig().API_ROOT).toBe("");
  });

  test("falls back to the build value and then localhost in development", () => {
    process.env.REACT_APP_API_ROOT = "https://build.example.com";
    expect(loadConfig().API_ROOT).toBe("https://build.example.com");

    delete process.env.REACT_APP_API_ROOT;
    expect(loadConfig().API_ROOT).toBe("http://localhost:5000");
  });
});
