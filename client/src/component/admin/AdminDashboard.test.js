import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { configureStore } from "@reduxjs/toolkit";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import api from "../../api/client";
import rootReducer from "../store/reduces/rootReducer";
import AdminDashboard from "./AdminDashboard";

function installMatchMediaMock() {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener() {},
      removeListener() {},
      addEventListener() {},
      removeEventListener() {},
      dispatchEvent() {},
    }),
  });
}

jest.mock("../../api/client", () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
  },
}));

let queryClient;

function renderDashboard() {
  installMatchMediaMock();
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const store = configureStore({
    reducer: rootReducer,
    preloadedState: {
      auth: {
        isLoggedIn: true,
        user: { userId: 7, userName: "nivz", role: "admin" },
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <Provider store={store}>
        <MemoryRouter>
          <AdminDashboard />
        </MemoryRouter>
      </Provider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  api.get.mockImplementation((path) =>
    Promise.resolve({
      data: {
        data:
          path === "/api/v1/admin/users"
            ? [
                {
                  userId: 9,
                  userName: "member",
                  role: "user",
                  isOnline: true,
                },
              ]
            : {
                items: [
                  {
                    eventId: 1,
                    eventType: "message.sent",
                    actorUserId: 7,
                    targetUserId: 9,
                    occurredAt: "2026-01-30T12:00:00.000Z",
                  },
                ],
                total: 1,
              },
      },
    }),
  );
});

afterEach(() => {
  queryClient?.clear();
  jest.clearAllMocks();
});

test("admin can view users and metadata-only audit events", async () => {
  renderDashboard();

  expect(await screen.findByText("member")).toBeInTheDocument();
  expect(screen.getByText("Đang online")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Audit log" }));

  expect(
    await screen.findByText("Gửi tin nhắn (chỉ metadata)"),
  ).toBeInTheDocument();
  await waitFor(() => {
    expect(api.get).toHaveBeenCalledWith(
      "/api/v1/admin/logs",
      expect.objectContaining({
        params: expect.objectContaining({ page: 1, pageSize: 25 }),
      }),
    );
  });
  expect(screen.queryByText("private message text")).not.toBeInTheDocument();
});

test("event filter and pagination update audit log query parameters", async () => {
  api.get.mockImplementation((path) =>
    Promise.resolve({
      data: {
        data:
          path === "/api/v1/admin/users"
            ? []
            : {
                items: [],
                total: 26,
              },
      },
    }),
  );
  renderDashboard();

  fireEvent.click(screen.getByRole("button", { name: "Audit log" }));
  await waitFor(() => {
    expect(api.get).toHaveBeenCalledWith(
      "/api/v1/admin/logs",
      expect.objectContaining({
        params: expect.objectContaining({ page: 1, pageSize: 25 }),
      }),
    );
  });

  fireEvent.change(screen.getByLabelText("Lọc theo sự kiện"), {
    target: { value: "message.sent" },
  });
  await waitFor(() => {
    expect(api.get).toHaveBeenCalledWith(
      "/api/v1/admin/logs",
      expect.objectContaining({
        params: expect.objectContaining({
          page: 1,
          pageSize: 25,
          eventType: "message.sent",
        }),
      }),
    );
  });

  await waitFor(() => {
    expect(screen.getByRole("button", { name: "Tiếp" })).toBeEnabled();
  });
  fireEvent.click(screen.getByRole("button", { name: "Tiếp" }));
  await waitFor(() => {
    expect(api.get).toHaveBeenCalledWith(
      "/api/v1/admin/logs",
      expect.objectContaining({
        params: expect.objectContaining({
          page: 2,
          pageSize: 25,
          eventType: "message.sent",
        }),
      }),
    );
  });
});
