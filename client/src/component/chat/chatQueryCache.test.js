import { queryKeys } from "../../api/queryKeys";
import { appendSocketMessage } from "./chatQueryCache";

function createQueryClient(initialKey, initialValue) {
  const cache = new Map([[JSON.stringify(initialKey), initialValue]]);
  return {
    cache,
    getQueryData(key) {
      return cache.get(JSON.stringify(key));
    },
    setQueryData(key, value) {
      cache.set(JSON.stringify(key), value);
    },
  };
}

test("direct conversation query keys are shared by both participants", () => {
  expect(queryKeys.directConversation(9, 4)).toEqual(
    queryKeys.directConversation(4, 9),
  );
});

test("Socket.IO message updates the corresponding cached conversation once", () => {
  const queryKey = queryKeys.conversation(44);
  const existing = [
    { MessageId: 1, SenderId: 4, MessageText: "first", ConversationId: 44 },
  ];
  const queryClient = createQueryClient(queryKey, {
    pages: [{ items: existing, hasMore: false, nextCursor: null }],
    pageParams: [null],
  });
  const event = {
    senderId: 9,
    receiverId: 4,
    conversationId: 44,
    messageId: 2,
    message: "reply",
  };

  expect(appendSocketMessage(queryClient, 4, event)).toBe(true);
  expect(queryClient.getQueryData(queryKey).pages[0].items).toEqual([
    ...existing,
    {
      MessageId: 2,
      ConversationId: 44,
      SenderId: 9,
      MessageText: "reply",
    },
  ]);
  expect(appendSocketMessage(queryClient, 4, event)).toBe(true);
  expect(queryClient.getQueryData(queryKey).pages[0].items).toHaveLength(2);
});

test("Socket.IO message for a room not yet cached does not create partial history", () => {
  const queryKey = queryKeys.conversation(44);
  const queryClient = {
    getQueryData: () => undefined,
    setQueryData: () => {
      throw new Error("Uncached room must not be initialized from one message");
    },
  };

  expect(
    appendSocketMessage(queryClient, 4, {
      senderId: 9,
      receiverId: 4,
      conversationId: 44,
      messageId: 2,
      message: "reply",
    }),
  ).toBe(false);
  expect(queryKey).toEqual(["conversation", 44]);
});
