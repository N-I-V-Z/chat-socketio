function toValidDate(value) {
  if (value === null || value === undefined || value === "") return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getLocalDateKey(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function getMessageDayLabel(value, now = new Date()) {
  const date = toValidDate(value);
  if (!date) return "Không rõ thời gian";

  const today = toValidDate(now) || new Date();
  const todayOrdinal = Date.UTC(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );
  const messageOrdinal = Date.UTC(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  );
  const daysAgo = Math.floor((todayOrdinal - messageOrdinal) / 86_400_000);

  if (daysAgo === 0) return "Hôm nay";
  if (daysAgo === 1) return "Hôm qua";
  if (daysAgo > 1 && daysAgo < 7) {
    const weekday = new Intl.DateTimeFormat("vi-VN", {
      weekday: "long",
    }).format(date);
    return weekday.replace(/^./u, (character) =>
      character.toLocaleUpperCase("vi-VN"),
    );
  }

  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function formatMessageTime(value) {
  const date = toValidDate(value);
  if (!date) return null;

  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

function groupMessagesByDay(messages, now = new Date()) {
  const groups = [];
  for (const message of messages) {
    const date = toValidDate(message.Timestamp);
    const key = date ? getLocalDateKey(date) : "unknown";
    const label = getMessageDayLabel(date, now);
    const currentGroup = groups[groups.length - 1];

    if (currentGroup?.key === key) {
      currentGroup.messages.push(message);
    } else {
      groups.push({ key, label, messages: [message] });
    }
  }
  return groups;
}

export {
  formatMessageTime,
  getMessageDayLabel,
  groupMessagesByDay,
  toValidDate,
};
