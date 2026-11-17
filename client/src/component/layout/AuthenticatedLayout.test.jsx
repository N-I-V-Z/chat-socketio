import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import { configureStore } from "@reduxjs/toolkit";
import { Provider } from "react-redux";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import api, { clearAccessToken } from "../../api/client";
import rootReducer from "../store/reduces/rootReducer";
import { ToastProvider } from "../ui/ToastProvider";
import AuthenticatedLayout from "./AuthenticatedLayout";

jest.mock("../../api/client", () => ({
  __esModule: true,
  default: {
    post: jest.fn(),
  },
  clearAccessToken: jest.fn(),
}));

jest.mock("../ui/Dialog", () => {
  const Dialog = ({ open, title, description, children, footer }) =>
    open ? (
      <div role="dialog" aria-label={title}>
        <p>{description}</p>
        {children}
        {footer}
      </div>
    ) : null;

  return { __esModule: true, default: Dialog };
});

function renderLayout(user, initialPath = "/chat") {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const store = configureStore({
    reducer: rootReducer,
    preloadedState: {
      auth: { isLoggedIn: true, user },
    },
  });

  return {
    queryClient,
    store,
    ...render(
      <QueryClientProvider client={queryClient}>
        <Provider store={store}>
          <ToastProvider>
            <MemoryRouter initialEntries={[initialPath]}>
              <Routes>
                <Route element={<AuthenticatedLayout />}>
                  <Route path="/chat" element={<p>Khu vực trò chuyện</p>} />
                  <Route path="/admin" element={<p>Khu vực quản trị</p>} />
                </Route>
                <Route path="/" element={<p>Đã đăng xuất</p>} />
              </Routes>
            </MemoryRouter>
          </ToastProvider>
        </Provider>
      </QueryClientProvider>,
    ),
  };
}

beforeEach(() => {
  api.post.mockReset();
  clearAccessToken.mockReset();
});

test("shows the admin destination only for admin accounts", () => {
  const { unmount } = renderLayout({
    userId: 7,
    userName: "nivz",
    role: "user",
  });

  expect(screen.queryAllByRole("link", { name: "Quản trị" })).toHaveLength(0);
  unmount();

  renderLayout({ userId: 7, userName: "nivz", role: "admin" });

  expect(screen.getAllByRole("link", { name: "Quản trị" })).toHaveLength(2);
});

test("revokes the refresh token and clears the authenticated session on logout", async () => {
  api.post.mockResolvedValue({});
  const { queryClient, store } = renderLayout({
    userId: 7,
    userName: "nivz",
    role: "user",
  });
  const clearQueryCache = jest.spyOn(queryClient, "clear");

  fireEvent.click(screen.getAllByRole("button", { name: "Đăng xuất" })[0]);
  const dialog = screen.getByRole("dialog", {
    name: "Đăng xuất khỏi tài khoản?",
  });
  fireEvent.click(within(dialog).getByRole("button", { name: "Đăng xuất" }));

  expect(await screen.findByText("Đã đăng xuất")).toBeInTheDocument();
  expect(api.post).toHaveBeenCalledWith("/api/v1/user/logout");
  expect(clearAccessToken).toHaveBeenCalledTimes(1);
  expect(clearQueryCache).toHaveBeenCalledTimes(1);
  expect(store.getState().auth.isLoggedIn).toBe(false);
});

test("keeps the session active when refresh-token revocation fails", async () => {
  const consoleError = jest
    .spyOn(console, "error")
    .mockImplementation(() => {});
  api.post.mockRejectedValue(new Error("network error"));
  const { store } = renderLayout({
    userId: 7,
    userName: "nivz",
    role: "user",
  });

  fireEvent.click(screen.getAllByRole("button", { name: "Đăng xuất" })[0]);
  const dialog = screen.getByRole("dialog", {
    name: "Đăng xuất khỏi tài khoản?",
  });
  fireEvent.click(within(dialog).getByRole("button", { name: "Đăng xuất" }));

  expect(
    await screen.findByText("Đăng xuất không thành công. Vui lòng thử lại."),
  ).toBeInTheDocument();
  expect(store.getState().auth.isLoggedIn).toBe(true);
  expect(clearAccessToken).not.toHaveBeenCalled();
  consoleError.mockRestore();
});
