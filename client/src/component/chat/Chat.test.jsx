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
    get: jest.fn(),
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
  api.post.mockImplementation((path, payload) => {
    if (path === "/api/v1/user/getAll") {
      return Promise.resolve({
        data: { data: [{ userId: 9, userName: "member" }] },
      });
    }
    if (path === "/api/v1/conversations/direct") {
      return Promise.resolve({
        data: { data: { conversationId: 55 } },
      });
    }
    if (path === "/api/v1/conversations/55/messages") {
      return Promise.resolve({
        data: {
          data: {
            MessageId: 3,
            ConversationId: 55,
            SenderId: 7,
            MessageText: payload.message,
          },
        },
      });
    }
    return Promise.resolve({ data: { data: {} } });
  });
  api.get.mockImplementation(() =>
    Promise.resolve({
      data: {
        data: {
          items: [
            {
              MessageId: 1,
              ConversationId: 55,
              SenderId: 7,
              MessageText: "Tin nhắn của tôi",
            },
            {
              MessageId: 2,
              ConversationId: 55,
              SenderId: 9,
              MessageText: "Tin nhắn của bạn",
            },
          ],
          hasMore: false,
          nextCursor: null,
        },
      },
    }),
  );
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
    expect(api.post).toHaveBeenCalledWith("/api/v1/conversations/direct", {
      otherUserId: 9,
    });
    expect(api.get).toHaveBeenCalledWith("/api/v1/conversations/55/messages", {
      params: undefined,
    });
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

test("loads older messages on upward scroll and preserves the visible anchor", async () => {
  const makePage = (startId, endId) =>
    Array.from({ length: endId - startId + 1 }, (_, index) => {
      const MessageId = startId + index;
      return {
        MessageId,
        ConversationId: 55,
        SenderId: 9,
        MessageText: `message-${MessageId}`,
      };
    });
  api.get.mockImplementation((_path, options) => {
    const beforeMessageId = options?.params?.beforeMessageId;
    const items = beforeMessageId === 71 ? makePage(41, 70) : makePage(71, 100);
    return Promise.resolve({
      data: {
        data: {
          items,
          hasMore: true,
          nextCursor: items[0].MessageId,
        },
      },
    });
  });

  renderChat();
  fireEvent.click(await screen.findByRole("button", { name: "member" }));
  await screen.findByText("message-100");

  const messageList = screen.getByRole("log", {
    name: "Tin nhắn với member",
  });
  Object.defineProperty(messageList, "scrollHeight", {
    configurable: true,
    get: () => messageList.querySelectorAll("[data-chat-message]").length * 40,
  });
  Object.defineProperty(messageList, "clientHeight", {
    configurable: true,
    value: 200,
  });
  messageList.scrollTop = 0;
  fireEvent.scroll(messageList);

  await screen.findByText("message-41");
  await waitFor(() => {
    expect(api.get).toHaveBeenCalledWith("/api/v1/conversations/55/messages", {
      params: { beforeMessageId: 71 },
    });
    expect(messageList.scrollTop).toBe(1200);
  });
});

test("sends through the conversation API and keeps one composer focus ring", async () => {
  api.post.mockImplementation((path, payload) => {
    if (path === "/api/v1/user/getAll") {
      return Promise.resolve({
        data: { data: [{ userId: 9, userName: "member" }] },
      });
    }
    if (path === "/api/v1/conversations/direct") {
      return Promise.resolve({
        data: { data: { conversationId: 55 } },
      });
    }
    if (path === "/api/v1/conversations/55/messages") {
      return Promise.resolve({
        data: {
          data: {
            MessageId: 3,
            ConversationId: 55,
            SenderId: 7,
            MessageText: payload.message,
          },
        },
      });
    }
    return Promise.resolve({ data: { data: {} } });
  });

  renderChat();
  fireEvent.click(await screen.findByRole("button", { name: "member" }));

  const textarea = await screen.findByLabelText("Tin nhắn mới");
  const sendButton = screen.getByRole("button", { name: "Gửi" });
  await screen.findByText("Tin nhắn của tôi");
  expect(textarea).toHaveClass("focus-visible:ring-0");
  fireEvent.change(textarea, { target: { value: "Hello" } });
  await waitFor(() => expect(sendButton).toBeEnabled());
  fireEvent.click(sendButton);

  await waitFor(() => {
    expect(api.post).toHaveBeenCalledWith("/api/v1/conversations/55/messages", {
      message: "Hello",
    });
    expect(mockSocket.emit).toHaveBeenCalledWith("sendMessage", {
      receiverId: 9,
      conversationId: 55,
      message: "Hello",
      messageId: 3,
    });
  });
});
