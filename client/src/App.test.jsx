import React, { act } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { configureStore } from "@reduxjs/toolkit";
import { Provider } from "react-redux";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import api, { refreshAccessToken } from "./api/client";
import rootReducer from "./component/store/reduces/rootReducer";
import { ToastProvider } from "./component/ui/ToastProvider";
import App from "./App";

jest.mock("./api/client", () => ({
  __esModule: true,
  default: {
    post: jest.fn(),
  },
  clearAccessToken: jest.fn(),
  refreshAccessToken: jest.fn(),
}));

jest.mock("./component/auth/Login", () => {
  const React = jest.requireActual("react");
  return {
    __esModule: true,
    default: () => React.createElement("p", null, "Login screen"),
  };
});

jest.mock("./component/auth/Register", () => {
  const React = jest.requireActual("react");
  return {
    __esModule: true,
    default: () => React.createElement("p", null, "Register screen"),
  };
});

jest.mock("./component/chat/Chat", () => {
  const React = jest.requireActual("react");
  return {
    __esModule: true,
    default: () => React.createElement("p", null, "Chat screen"),
  };
});

jest.mock("./component/admin/AdminDashboard", () => {
  const React = jest.requireActual("react");
  return {
    __esModule: true,
    default: () => React.createElement("p", null, "Admin screen"),
  };
});

jest.mock("./component/ui/Dialog", () => {
  const React = jest.requireActual("react");
  return {
    __esModule: true,
    default: () => React.createElement(React.Fragment),
  };
});

async function renderApp(path) {
  window.history.pushState({}, "", path);
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const store = configureStore({ reducer: rootReducer });

  const view = render(
    <QueryClientProvider client={queryClient}>
      <Provider store={store}>
        <ToastProvider>
          <App />
        </ToastProvider>
      </Provider>
    </QueryClientProvider>,
  );

  await act(async () => {
    await Promise.resolve();
  });

  return {
    queryClient,
    ...view,
  };
}

beforeEach(() => {
  api.post.mockReset();
  refreshAccessToken.mockReset();
  window.history.pushState({}, "", "/");
});

afterEach(() => {
  cleanup();
});

test("redirects a signed-in non-admin away from the admin route", async () => {
  refreshAccessToken.mockResolvedValue({
    user: { userId: 9, userName: "member", role: "user" },
  });

  await renderApp("/admin");

  expect(await screen.findByText("Chat screen")).toBeInTheDocument();
  expect(screen.queryAllByRole("link", { name: "Quản trị" })).toHaveLength(0);
});

test("allows an admin to open the admin route inside the shared shell", async () => {
  refreshAccessToken.mockResolvedValue({
    user: { userId: 7, userName: "nivz", role: "admin" },
  });

  await renderApp("/admin");

  expect(await screen.findByText("Admin screen")).toBeInTheDocument();
  expect(screen.getAllByRole("link", { name: "Quản trị" })).toHaveLength(2);
});

test("redirects unauthenticated visitors to login from the admin route", async () => {
  refreshAccessToken.mockRejectedValue({ response: { status: 401 } });

  await renderApp("/admin");

  expect(await screen.findByText("Login screen")).toBeInTheDocument();
});
