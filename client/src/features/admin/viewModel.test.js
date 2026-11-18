import { toAuditItem } from "./viewModel";

test("prepares one audit record for both mobile and desktop views", () => {
  const item = toAuditItem({
    eventId: 12,
    eventType: "auth.login.failed",
    occurredAt: "invalid-date",
    actorUserId: 7,
    targetUserId: 9,
    outcome: "failure",
  });

  expect(item).toMatchObject({
    eventId: 12,
    eventLabel: "Đăng nhập thất bại",
    occurredAtLabel: "Không xác định",
    actorName: "ID 7",
    targetLabel: "ID 9",
    outcome: { label: "Thất bại", className: "font-semibold text-danger" },
  });
});
