import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { configureStore } from "@reduxjs/toolkit";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import io from "socket.io-client";
import api from "../../api/client";
import rootReducer from "../store/reduces/rootReducer";
import { ToastProvider } from "../ui/ToastProvider";
import Chat from "./Chat";

jest.mock("socket.io-client", () => ({
  __esModule: true,
  default: jest.fn(),
}));

jest.mock("../ui/Dialog", () => {
  const React = require("react");
  return {
    __esModule: true,
    default: ({ open, title, description, children, footer }) =>
      open
        ? React.createElement(
            "section",
            { role: "dialog", "aria-label": title },
            React.createElement("p", null, description),
            children,
            footer,
          )
        : null,
  };
});

jest.mock("../../api/client", () => ({
  __esModule: true,
  default: {
    post: jest.fn(),
  },
  clearAccessToken: jest.fn(),
  getAccessToken: jest.fn(),
  refreshAccessToken: jest.fn(),
}));

const mockSocket = {
  on: jest.fn(),
  off: jest.fn(),
  connect: jest.fn(),
  disconnect: jest.fn(),
  emit: jest.fn(),
};

let queryClient;

function renderChat() {
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const store = configureStore({
    reducer: rootReducer,
    preloadedState: {
      auth: {
        isLoggedIn: true,
        user: { userId: 7, userName: "nivz", role: "user" },
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <Provider store={store}>
        <MemoryRouter>
          <ToastProvider>
            <Chat />
          </ToastProvider>
        </MemoryRouter>
      </Provider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: () => ({
      matches: false,
      addListener() {},
      removeListener() {},
      addEventListener() {},
      removeEventListener() {},
    }),
  });
  io.mockReturnValue(mockSocket);
  api.post.mockImplementation((path) => {
    if (path === "/api/v1/user/getAll") {
      return Promise.resolve({
        data: { data: [{ userId: 9, userName: "member" }] },
      });
    }
    if (path === "/api/v1/message/getAllMessageOfRoom") {
      return Promise.resolve({
        data: {
          data: [
            { MessageId: 1, SenderId: 7, MessageText: "Tin nhắn của tôi" },
            { MessageId: 2, SenderId: 9, MessageText: "Tin nhắn của bạn" },
          ],
        },
      });
    }
    return Promise.resolve({ data: { data: {} } });
  });
  Element.prototype.scrollIntoView = jest.fn();
});

afterEach(() => {
  queryClient?.clear();
  jest.clearAllMocks();
});

test("keeps sent and received messages on their respective sides", async () => {
  renderChat();

  fireEvent.click(await screen.findByRole("button", { name: "member" }));

  const sentMessage = await screen.findByText("Tin nhắn của tôi");
  const receivedMessage = await screen.findByText("Tin nhắn của bạn");

  expect(sentMessage.parentElement).toHaveClass("justify-end");
  expect(receivedMessage.parentElement).toHaveClass("justify-start");
  await waitFor(() => {
    expect(api.post).toHaveBeenCalledWith(
      "/api/v1/message/getAllMessageOfRoom",
      { receiverId: 9 },
    );
  });
});

test("switches between the contact list and conversation view", async () => {
  renderChat();

  const contacts = await screen.findByRole("complementary", {
    name: "Danh sách liên hệ",
  });
  const conversation = screen.getByRole("region", {
    name: "Cuộc trò chuyện",
  });

  expect(contacts).not.toHaveClass("hidden");
  expect(conversation).toHaveClass("hidden");

  fireEvent.click(await screen.findByRole("button", { name: "member" }));

  expect(contacts).toHaveClass("hidden");
  expect(conversation).toHaveClass("flex");
  expect(
    screen.getByRole("button", { name: "Quay lại danh sách liên hệ" }),
  ).toBeInTheDocument();

  fireEvent.click(
    screen.getByRole("button", { name: "Quay lại danh sách liên hệ" }),
  );

  expect(contacts).not.toHaveClass("hidden");
  expect(conversation).toHaveClass("hidden");
});
