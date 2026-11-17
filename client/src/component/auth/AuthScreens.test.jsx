import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { configureStore } from "@reduxjs/toolkit";
import { Provider } from "react-redux";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import api, { setAccessToken } from "../../api/client";
import rootReducer from "../store/reduces/rootReducer";
import { ToastProvider } from "../ui/ToastProvider";
import Login from "./Login";
import Register from "./Register";

jest.mock("../../api/client", () => ({
  __esModule: true,
  default: {
    post: jest.fn(),
  },
  setAccessToken: jest.fn(),
}));

function renderAuth(initialPath = "/") {
  const store = configureStore({ reducer: rootReducer });

  return {
    store,
    ...render(
      <Provider store={store}>
        <MemoryRouter initialEntries={[initialPath]}>
          <ToastProvider>
            <Routes>
              <Route path="/" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/chat" element={<p>Chat đã sẵn sàng</p>} />
            </Routes>
          </ToastProvider>
        </MemoryRouter>
      </Provider>,
    ),
  };
}

beforeEach(() => {
  api.post.mockReset();
  setAccessToken.mockReset();
});

test("login shows field errors and does not send an incomplete request", () => {
  renderAuth();

  expect(
    screen.getByRole("link", { name: "Bỏ qua điều hướng" }),
  ).toHaveAttribute("href", "#auth-content");
  expect(
    screen.getByRole("heading", { name: "Đăng nhập", level: 1 }),
  ).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: /đăng nhập/i }));

  expect(screen.getByText("Nhập tên người dùng.")).toBeInTheDocument();
  expect(screen.getByText("Nhập mật khẩu.")).toBeInTheDocument();
  expect(api.post).not.toHaveBeenCalled();
});

test("registration explains when the confirmation password does not match", () => {
  renderAuth("/register");
  fireEvent.change(screen.getByLabelText(/Tên người dùng/), {
    target: { value: "nivz" },
  });
  fireEvent.change(screen.getByLabelText(/^Mật khẩu/), {
    target: { value: "password" },
  });
  fireEvent.change(screen.getByLabelText(/Xác nhận mật khẩu/), {
    target: { value: "different" },
  });

  fireEvent.click(screen.getByRole("button", { name: /tạo tài khoản/i }));

  expect(screen.getByText("Mật khẩu xác nhận chưa khớp.")).toBeInTheDocument();
  expect(api.post).not.toHaveBeenCalled();
});

test("successful login stores the access token and navigates to chat", async () => {
  api.post.mockResolvedValue({
    data: {
      data: {
        accessToken: "access-token",
        user: { userId: 7, userName: "nivz", role: "admin" },
      },
    },
  });
  const { store } = renderAuth();

  fireEvent.change(screen.getByLabelText(/Tên người dùng/), {
    target: { value: "nivz" },
  });
  fireEvent.change(screen.getByLabelText(/^Mật khẩu/), {
    target: { value: "password" },
  });
  fireEvent.click(screen.getByRole("button", { name: /đăng nhập/i }));

  expect(await screen.findByText("Chat đã sẵn sàng")).toBeInTheDocument();
  expect(setAccessToken).toHaveBeenCalledWith("access-token");
  expect(store.getState().auth.user).toMatchObject({
    userId: 7,
    userName: "nivz",
    role: "admin",
  });
});
