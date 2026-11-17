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

test("conversation query keys are shared by both participants", () => {
  expect(queryKeys.conversation(9, 4)).toEqual(queryKeys.conversation(4, 9));
});

test("Socket.IO message updates the corresponding cached conversation once", () => {
  const queryKey = queryKeys.conversation(4, 9);
  const existing = [{ MessageId: 1, senderId: 4, message: "first" }];
  const queryClient = createQueryClient(queryKey, existing);
  const event = {
    senderId: 9,
    receiverId: 4,
    messageId: 2,
    message: "reply",
  };

  expect(appendSocketMessage(queryClient, 4, event)).toBe(true);
  expect(queryClient.getQueryData(queryKey)).toEqual([
    ...existing,
    { MessageId: 2, senderId: 9, message: "reply" },
  ]);
  expect(appendSocketMessage(queryClient, 4, event)).toBe(true);
  expect(queryClient.getQueryData(queryKey)).toHaveLength(2);
});

test("Socket.IO message for a room not yet cached does not create partial history", () => {
  const queryKey = queryKeys.conversation(4, 9);
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
      messageId: 2,
      message: "reply",
    })
  ).toBe(false);
  expect(queryKey).toEqual(["conversation", 4, 9]);
});
