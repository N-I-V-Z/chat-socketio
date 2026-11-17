import {
  formatMessageTime,
  getMessageDayLabel,
  groupMessagesByDay,
} from "./messageDateFormat";

test("labels today, yesterday, weekdays, older dates, and missing timestamps", () => {
  const now = new Date(2026, 0, 12, 12, 0);

  expect(getMessageDayLabel(new Date(2026, 0, 12, 8), now)).toBe("Hôm nay");
  expect(getMessageDayLabel(new Date(2026, 0, 11, 23), now)).toBe("Hôm qua");
  expect(
    getMessageDayLabel(new Date(2026, 0, 9, 10), now).toLocaleLowerCase(
      "vi-VN",
    ),
  ).toMatch(/^thứ/);
  expect(getMessageDayLabel(new Date(2026, 0, 1, 10), now)).toMatch(
    /^\d{2}\/\d{2}\/\d{4}$/,
  );
  expect(getMessageDayLabel(null, now)).toBe("Không rõ thời gian");
});

test("formats time with the browser's local clock and 24-hour notation", () => {
  expect(formatMessageTime(new Date(2026, 0, 2, 8, 5))).toBe("08:05");
  expect(formatMessageTime(null)).toBeNull();
});

test("groups adjacent messages by local calendar day without reordering", () => {
  const messages = [
    { MessageId: 1, Timestamp: new Date(2026, 0, 12, 9) },
    { MessageId: 2, Timestamp: new Date(2026, 0, 12, 10) },
    { MessageId: 3, Timestamp: null },
    { MessageId: 4, Timestamp: null },
    { MessageId: 5, Timestamp: new Date(2026, 0, 11, 23) },
  ];

  const groups = groupMessagesByDay(messages, new Date(2026, 0, 12, 12));

  expect(groups.map(({ label }) => label)).toEqual([
    "Hôm nay",
    "Không rõ thời gian",
    "Hôm qua",
  ]);
  expect(groups.flatMap(({ messages: items }) => items)).toEqual(messages);
});
