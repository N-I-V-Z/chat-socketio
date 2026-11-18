import React from "react";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import "@testing-library/jest-dom";
import { configureStore } from "@reduxjs/toolkit";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import io from "socket.io-client";
import api from "../../shared/api/client";
import rootReducer from "../auth/store/reduces/rootReducer";
import { ToastProvider } from "../../shared/ui/ToastProvider";
import Chat from "./Chat";

jest.mock("socket.io-client", () => ({
  __esModule: true,
  default: jest.fn(),
}));

jest.mock("../../shared/ui/Dialog", () => {
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

jest.mock("../../shared/api/client", () => ({
  __esModule: true,
  default: {
    post: jest.fn(),
    get: jest.fn(),
    put: jest.fn(),
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
let intersectionObservers;

class MockIntersectionObserver {
  constructor(callback, options) {
    this.callback = callback;
    this.options = options;
    this.targets = [];
    intersectionObservers.push(this);
  }

  observe(target) {
    this.targets.push(target);
  }

  disconnect() {}

  trigger(target, intersectionRatio = 0.75) {
    this.callback([{ target, isIntersecting: true, intersectionRatio }]);
  }
}

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
  intersectionObservers = [];
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
  Object.defineProperty(window, "IntersectionObserver", {
    configurable: true,
    writable: true,
    value: MockIntersectionObserver,
  });
  io.mockReturnValue(mockSocket);
  api.post.mockImplementation((path, payload) => {
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
  api.put.mockImplementation((_path, payload) => {
    if (_path === "/api/v1/conversations/direct/9") {
      return Promise.resolve({
        data: { data: { conversationId: 55 } },
      });
    }
    if (_path === "/api/v1/conversations/55/read-receipt") {
      return Promise.resolve({
        data: {
          data: {
            conversationId: 55,
            upToMessageId: payload.upToMessageId,
            readAt: "2026-01-02T03:04:05Z",
          },
        },
      });
    }
    return Promise.resolve({ data: { data: {} } });
  });
  api.get.mockImplementation((path) =>
    Promise.resolve({
      data: {
        data:
          path === "/api/v1/users"
            ? [{ userId: 9, userName: "member" }]
            : path === "/api/v1/conversations/unread-summary"
              ? []
              : {
                  items: [
                    {
                      MessageId: 1,
                      ConversationId: 55,
                      SenderId: 7,
                      MessageText: "Tin nhắn của tôi",
                      readReceipts: [],
                    },
                    {
                      MessageId: 2,
                      ConversationId: 55,
                      SenderId: 9,
                      MessageText: "Tin nhắn của bạn",
                      readReceipts: [],
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

  expect(sentMessage.closest("[data-chat-message]")).toHaveClass("justify-end");
  expect(receivedMessage.closest("[data-chat-message]")).toHaveClass(
    "justify-start",
  );
  await waitFor(() => {
    expect(api.put).toHaveBeenCalledWith("/api/v1/conversations/direct/9");
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
  api.get.mockImplementation((path, options) => {
    if (path === "/api/v1/users") {
      return Promise.resolve({
        data: { data: [{ userId: 9, userName: "member" }] },
      });
    }
    if (path === "/api/v1/conversations/unread-summary") {
      return Promise.resolve({ data: { data: [] } });
    }
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
  });
  expect(mockSocket.emit).not.toHaveBeenCalledWith(
    "sendMessage",
    expect.anything(),
  );
});

test("keeps a draft with its recipient when switching conversations", async () => {
  const originalGet = api.get.getMockImplementation();
  api.get.mockImplementation((path, options) =>
    path === "/api/v1/users"
      ? Promise.resolve({
          data: {
            data: [
              { userId: 9, userName: "member" },
              { userId: 10, userName: "second" },
            ],
          },
        })
      : originalGet(path, options),
  );

  renderChat();
  fireEvent.click(await screen.findByRole("button", { name: "member" }));
  fireEvent.change(screen.getByLabelText("Tin nhắn mới"), {
    target: { value: "Chỉ gửi cho member" },
  });
  fireEvent.click(screen.getByRole("button", { name: "second" }));
  expect(screen.getByLabelText("Tin nhắn mới")).toHaveValue("");
  fireEvent.click(screen.getByRole("button", { name: "member" }));
  expect(screen.getByLabelText("Tin nhắn mới")).toHaveValue(
    "Chỉ gửi cho member",
  );
});

test("restores a failed message to the original recipient", async () => {
  api.post.mockRejectedValue(new Error("network failure"));
  renderChat();
  fireEvent.click(await screen.findByRole("button", { name: "member" }));
  await screen.findByText("Tin nhắn của tôi");
  fireEvent.change(screen.getByLabelText("Tin nhắn mới"), {
    target: { value: "Thử lại" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Gửi" }));
  await waitFor(() =>
    expect(screen.getByLabelText("Tin nhắn mới")).toHaveValue("Thử lại"),
  );
});

test("stops audio tracks and closes the peer connection on unmount", async () => {
  const track = { stop: jest.fn() };
  const stream = { getTracks: () => [track] };
  const getUserMedia = jest.fn().mockResolvedValue(stream);
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia },
  });
  const connection = {
    addTrack: jest.fn(),
    close: jest.fn(),
    createOffer: jest.fn().mockResolvedValue({ type: "offer" }),
    setLocalDescription: jest.fn().mockResolvedValue(),
    signalingState: "stable",
  };
  global.RTCPeerConnection = jest.fn(() => connection);

  const view = renderChat();
  const onAccepted = mockSocket.on.mock.calls.find(
    ([event]) => event === "callAccepted",
  )[1];
  await act(async () => {
    onAccepted({ from: 9, video: false, callId: "call-1" });
  });
  await waitFor(() => expect(getUserMedia).toHaveBeenCalled());
  view.unmount();
  expect(track.stop).toHaveBeenCalledTimes(1);
  expect(connection.close).toHaveBeenCalled();
});

test("shows the unread count beside the matching contact", async () => {
  api.get.mockImplementation((path) =>
    Promise.resolve({
      data: {
        data:
          path === "/api/v1/users"
            ? [{ userId: 9, userName: "member" }]
            : path === "/api/v1/conversations/unread-summary"
              ? [{ conversationId: 55, peerUserId: 9, unreadCount: 2 }]
              : { items: [], hasMore: false, nextCursor: null },
      },
    }),
  );

  renderChat();

  expect(await screen.findByLabelText("2 tin nhắn chưa đọc")).toHaveTextContent(
    "2",
  );
});

test("marks the highest visible message read once after a short debounce", async () => {
  renderChat();
  fireEvent.click(await screen.findByRole("button", { name: /member/ }));
  await screen.findByText("Tin nhắn của bạn");

  const target = document.querySelector('[data-message-id="2"]');
  const observer = intersectionObservers.find((item) =>
    item.targets.includes(target),
  );
  expect(observer.options.root).toBe(
    screen.getByRole("log", { name: "Tin nhắn với member" }),
  );

  act(() => {
    observer.trigger(target);
    observer.trigger(target);
  });

  await waitFor(() => {
    expect(api.put).toHaveBeenCalledWith(
      "/api/v1/conversations/55/read-receipt",
      {
        upToMessageId: 2,
      },
    );
  });
  expect(
    api.put.mock.calls.filter(
      ([path]) => path === "/api/v1/conversations/55/read-receipt",
    ),
  ).toHaveLength(1);
});

test("shows seen state from read receipts in the message page", async () => {
  api.get.mockImplementation((path) =>
    Promise.resolve({
      data: {
        data:
          path === "/api/v1/users"
            ? [{ userId: 9, userName: "member" }]
            : path === "/api/v1/conversations/unread-summary"
              ? []
              : {
                  items: [
                    {
                      MessageId: 1,
                      ConversationId: 55,
                      SenderId: 7,
                      MessageText: "Tin nhắn của tôi",
                      readReceipts: [
                        { UserId: 9, readAt: "2026-01-02T03:04:05Z" },
                      ],
                    },
                    {
                      MessageId: 2,
                      ConversationId: 55,
                      SenderId: 9,
                      MessageText: "Tin nhắn của bạn",
                      readReceipts: [],
                    },
                  ],
                  hasMore: false,
                  nextCursor: null,
                },
      },
    }),
  );

  renderChat();
  fireEvent.click(await screen.findByRole("button", { name: /member/ }));

  expect(await screen.findByText("Đã xem")).toBeInTheDocument();
});

test("groups dated messages and leaves legacy null timestamps without a clock", async () => {
  const timestamp = new Date();
  timestamp.setHours(8, 5, 0, 0);
  api.get.mockImplementation((path) =>
    Promise.resolve({
      data: {
        data:
          path === "/api/v1/users"
            ? [{ userId: 9, userName: "member" }]
            : path === "/api/v1/conversations/unread-summary"
              ? []
              : {
                  items: [
                    {
                      MessageId: 1,
                      ConversationId: 55,
                      SenderId: 7,
                      MessageText: "Tin nhắn có giờ",
                      Timestamp: timestamp.toISOString(),
                      readReceipts: [],
                    },
                    {
                      MessageId: 2,
                      ConversationId: 55,
                      SenderId: 9,
                      MessageText: "Tin nhắn cũ",
                      Timestamp: null,
                      readReceipts: [],
                    },
                  ],
                  hasMore: false,
                  nextCursor: null,
                },
      },
    }),
  );

  renderChat();
  fireEvent.click(await screen.findByRole("button", { name: /member/ }));

  expect(
    await screen.findByRole("separator", { name: "Hôm nay" }),
  ).toBeInTheDocument();
  expect(screen.getByText("08:05")).toHaveAttribute(
    "dateTime",
    timestamp.toISOString(),
  );
  expect(
    screen.getByRole("separator", { name: "Không rõ thời gian" }),
  ).toBeInTheDocument();
  expect(screen.getByText("Tin nhắn cũ").parentElement).not.toHaveTextContent(
    /08:05/,
  );
});
