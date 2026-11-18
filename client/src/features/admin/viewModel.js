export const eventLabels = {
  "user.registered": "Đăng ký",
  "auth.login.succeeded": "Đăng nhập thành công",
  "auth.login.failed": "Đăng nhập thất bại",
  "auth.logout": "Đăng xuất",
  "presence.connected": "Online",
  "presence.disconnected": "Offline",
  "message.sent": "Gửi tin nhắn (chỉ metadata)",
  "admin.users.viewed": "Xem danh sách người dùng",
  "admin.audit_logs.viewed": "Xem audit log",
};

export const eventOptions = [
  { value: "", label: "Tất cả sự kiện" },
  ...Object.entries(eventLabels).map(([value, label]) => ({ value, label })),
];

export function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Không xác định";
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function getActorName(log) {
  return (
    log.actorUserName ||
    (log.actorUserId ? `ID ${log.actorUserId}` : "Không xác định")
  );
}

export function getOutcomeLabel(outcome) {
  if (outcome === "failure") {
    return { label: "Thất bại", className: "font-semibold text-danger" };
  }
  if (outcome === "success") {
    return { label: "Thành công", className: "font-semibold text-success" };
  }
  return { label: "Không rõ", className: "text-muted" };
}
