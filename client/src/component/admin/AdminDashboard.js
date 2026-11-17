import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useSelector } from "react-redux";
import { useQuery } from "@tanstack/react-query";
import api from "../../api/client";
import { queryKeys } from "../../api/queryKeys";
import Button from "../ui/Button";
import { cn } from "../ui/cn";

const PAGE_SIZE = 25;

const eventLabels = {
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

const eventOptions = [
  { value: "", label: "Tất cả sự kiện" },
  ...Object.entries(eventLabels).map(([value, label]) => ({ value, label })),
];

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Không xác định";
  }
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function LoadingRows({ columns }) {
  return (
    <tr>
      <td className="px-5 py-5" colSpan={columns}>
        <div className="grid gap-4" role="status">
          {[0, 1, 2, 3].map((row) => (
            <span
              aria-hidden="true"
              className="block h-10 animate-pulse rounded-lg bg-surface-muted motion-reduce:animate-none"
              key={row}
            />
          ))}
          <span className="sr-only">Đang tải dữ liệu</span>
        </div>
      </td>
    </tr>
  );
}

function EmptyState({ children, columns, action }) {
  return (
    <tr>
      <td className="px-5 py-14 text-center" colSpan={columns}>
        <p className="font-semibold text-ink">{children}</p>
        <p className="mt-1 text-sm text-muted">Dữ liệu sẽ xuất hiện tại đây.</p>
        <div className="mt-4">{action}</div>
      </td>
    </tr>
  );
}

function AdminDashboard() {
  const user = useSelector((state) => state.auth.user);
  const [activeTab, setActiveTab] = useState("users");
  const [page, setPage] = useState(1);
  const [eventType, setEventType] = useState("");
  const [errorDismissed, setErrorDismissed] = useState(false);
  const usersQuery = useQuery({
    queryKey: queryKeys.adminUsers,
    queryFn: async () => {
      const response = await api.get("/api/v1/admin/users");
      return response.data.data;
    },
    enabled: activeTab === "users",
    staleTime: 5_000,
  });
  const logsQuery = useQuery({
    queryKey: queryKeys.adminLogs(page, PAGE_SIZE, eventType),
    queryFn: async () => {
      const response = await api.get("/api/v1/admin/logs", {
        params: {
          page,
          pageSize: PAGE_SIZE,
          ...(eventType ? { eventType } : {}),
        },
      });
      return response.data.data;
    },
    enabled: activeTab === "logs",
  });
  const users = usersQuery.data || [];
  const logs = logsQuery.data || { items: [], total: 0 };
  const activeQueryError =
    activeTab === "users" ? usersQuery.isError : logsQuery.isError;
  const activeQueryLoading =
    activeTab === "users" ? usersQuery.isPending : logsQuery.isPending;
  const pageCount = Math.max(1, Math.ceil(logs.total / PAGE_SIZE));

  const changeTab = (tab) => {
    setErrorDismissed(false);
    setActiveTab(tab);
  };

  return (
    <main className="min-h-dvh bg-canvas">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-6 sm:px-6 sm:py-8 md:flex-row md:items-center md:justify-between lg:px-8">
          <div className="min-w-0">
            <h1 className="text-balance text-2xl font-bold text-ink sm:text-3xl">
              Bảng điều khiển
            </h1>
            <p className="mt-2 max-w-prose text-pretty text-sm leading-6 text-muted">
              Xin chào {user?.userName}. Audit log được lưu trong 30 ngày.
            </p>
          </div>
          <Link
            to="/chat"
            className="inline-flex min-h-11 w-fit items-center justify-center rounded-xl border border-line bg-surface px-4 py-2 text-sm font-semibold text-ink transition hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            Quay lại chat
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-8 lg:px-8">
        {activeQueryError && !errorDismissed && (
          <div
            className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger"
            role="alert"
          >
            <p>
              {activeTab === "users"
                ? "Không thể tải danh sách người dùng."
                : "Không thể tải audit log."}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  activeTab === "users"
                    ? usersQuery.refetch()
                    : logsQuery.refetch()
                }
                className="rounded-lg px-2 py-1 font-semibold underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger"
              >
                Thử lại
              </button>
              <button
                type="button"
                aria-label="Ẩn thông báo lỗi"
                onClick={() => setErrorDismissed(true)}
                className="grid size-8 place-items-center rounded-lg text-lg leading-none hover:bg-danger/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger"
              >
                <span aria-hidden="true">×</span>
              </button>
            </div>
          </div>
        )}

        <section className="overflow-hidden rounded-panel border border-line bg-surface shadow-panel">
          <div
            aria-label="Khu vực quản trị"
            className="flex gap-1 border-b border-line px-3 pt-3 sm:px-5"
            role="group"
          >
            <button
              type="button"
              aria-pressed={activeTab === "users"}
              onClick={() => changeTab("users")}
              className={cn(
                "min-h-11 rounded-t-xl border-b-2 px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                activeTab === "users"
                  ? "border-accent text-accent"
                  : "border-transparent text-muted hover:text-ink",
              )}
            >
              Người dùng
            </button>
            <button
              type="button"
              aria-pressed={activeTab === "logs"}
              onClick={() => changeTab("logs")}
              className={cn(
                "min-h-11 rounded-t-xl border-b-2 px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                activeTab === "logs"
                  ? "border-accent text-accent"
                  : "border-transparent text-muted hover:text-ink",
              )}
            >
              Audit log
            </button>
          </div>

          {activeTab === "users" ? (
            <div>
              <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
                <div>
                  <h2 className="text-balance text-base font-bold text-ink">
                    Tài khoản người dùng
                  </h2>
                  <p className="mt-1 text-sm text-muted">
                    Tên tài khoản, quyền truy cập và trạng thái kết nối.
                  </p>
                </div>
                <p className="tabular-nums text-sm text-muted">
                  {users.length} người dùng
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
                  <thead className="bg-surface-muted/70 text-xs font-semibold text-muted">
                    <tr>
                      <th className="px-5 py-3" scope="col">
                        Tên người dùng
                      </th>
                      <th className="px-5 py-3" scope="col">
                        Quyền
                      </th>
                      <th className="px-5 py-3" scope="col">
                        Trạng thái
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {activeQueryLoading ? (
                      <LoadingRows columns={3} />
                    ) : activeQueryError && users.length === 0 ? (
                      <tr>
                        <td
                          className="px-5 py-14 text-center text-sm text-muted"
                          colSpan={3}
                        >
                          Danh sách người dùng hiện chưa khả dụng.
                        </td>
                      </tr>
                    ) : users.length === 0 ? (
                      <EmptyState
                        columns={3}
                        action={
                          <Link
                            to="/chat"
                            className="text-sm font-semibold text-accent underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                          >
                            Quay lại trò chuyện
                          </Link>
                        }
                      >
                        Chưa có người dùng.
                      </EmptyState>
                    ) : (
                      users.map((listedUser) => (
                        <tr key={listedUser.userId}>
                          <th
                            className="px-5 py-4 font-semibold text-ink"
                            scope="row"
                          >
                            {listedUser.userName}
                          </th>
                          <td className="px-5 py-4">
                            <span
                              className={cn(
                                "inline-flex min-h-7 items-center rounded-lg px-2.5 text-xs font-semibold",
                                listedUser.role === "admin"
                                  ? "bg-accent/10 text-accent"
                                  : "bg-surface-muted text-muted",
                              )}
                            >
                              {listedUser.role === "admin" ? "Admin" : "User"}
                            </span>
                          </td>
                          <td className="px-5 py-4">
                            <span className="inline-flex items-center gap-2">
                              <span
                                aria-hidden="true"
                                className={cn(
                                  "size-2 rounded-full",
                                  listedUser.isOnline
                                    ? "bg-success"
                                    : "bg-surface-muted",
                                )}
                              />
                              <span
                                className={
                                  listedUser.isOnline
                                    ? "font-medium text-success"
                                    : "text-muted"
                                }
                              >
                                {listedUser.isOnline
                                  ? "Đang online"
                                  : "Offline"}
                              </span>
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div>
              <div className="flex flex-col gap-4 px-4 py-4 sm:px-6 md:flex-row md:items-end md:justify-between">
                <div>
                  <h2 className="text-balance text-base font-bold text-ink">
                    Lịch sử hoạt động
                  </h2>
                  <p className="mt-1 text-sm text-muted">
                    Lịch sử hoạt động, không bao gồm nội dung tin nhắn.
                  </p>
                </div>
                <div className="grid gap-1.5">
                  <label
                    className="text-xs font-semibold text-muted"
                    htmlFor="event-filter"
                  >
                    Lọc theo sự kiện
                  </label>
                  <select
                    id="event-filter"
                    value={eventType}
                    onChange={(event) => {
                      setErrorDismissed(false);
                      setPage(1);
                      setEventType(event.target.value);
                    }}
                    className="min-h-11 w-full min-w-56 rounded-xl border border-line bg-surface px-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent"
                  >
                    {eventOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 border-y border-line bg-surface-muted/40 px-4 py-3 text-sm text-muted sm:px-6">
                <p className="tabular-nums">
                  {logs.total} sự kiện trong hệ thống
                </p>
                {logsQuery.isFetching && !activeQueryLoading && (
                  <span role="status">Đang cập nhật...</span>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[58rem] border-collapse text-left text-sm">
                  <thead className="bg-surface-muted/70 text-xs font-semibold text-muted">
                    <tr>
                      <th className="px-5 py-3" scope="col">
                        Thời gian
                      </th>
                      <th className="px-5 py-3" scope="col">
                        Sự kiện
                      </th>
                      <th className="px-5 py-3" scope="col">
                        Người thực hiện
                      </th>
                      <th className="px-5 py-3" scope="col">
                        Người liên quan
                      </th>
                      <th className="px-5 py-3" scope="col">
                        Kết quả
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {activeQueryLoading ? (
                      <LoadingRows columns={5} />
                    ) : activeQueryError && logs.items.length === 0 ? (
                      <tr>
                        <td
                          className="px-5 py-14 text-center text-sm text-muted"
                          colSpan={5}
                        >
                          Audit log hiện chưa khả dụng.
                        </td>
                      </tr>
                    ) : logs.items.length === 0 ? (
                      <EmptyState
                        columns={5}
                        action={
                          eventType ? (
                            <button
                              type="button"
                              onClick={() => {
                                setEventType("");
                                setPage(1);
                              }}
                              className="text-sm font-semibold text-accent underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                            >
                              Xóa bộ lọc
                            </button>
                          ) : (
                            <Link
                              to="/chat"
                              className="text-sm font-semibold text-accent underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                            >
                              Quay lại trò chuyện
                            </Link>
                          )
                        }
                      >
                        Chưa có audit log.
                      </EmptyState>
                    ) : (
                      logs.items.map((log) => (
                        <tr key={log.eventId}>
                          <td className="whitespace-nowrap px-5 py-4 text-muted">
                            {formatDate(log.occurredAt)}
                          </td>
                          <th
                            className="px-5 py-4 font-semibold text-ink"
                            scope="row"
                          >
                            {eventLabels[log.eventType] || log.eventType}
                          </th>
                          <td className="px-5 py-4 text-ink">
                            {log.actorUserName ||
                              (log.actorUserId
                                ? `ID ${log.actorUserId}`
                                : "Không xác định")}
                          </td>
                          <td className="px-5 py-4 text-muted">
                            {log.targetUserId
                              ? `ID ${log.targetUserId}`
                              : "Không có"}
                          </td>
                          <td className="px-5 py-4">
                            {log.outcome === "failure" ? (
                              <span className="font-semibold text-danger">
                                Thất bại
                              </span>
                            ) : log.outcome === "success" ? (
                              <span className="font-semibold text-success">
                                Thành công
                              </span>
                            ) : (
                              <span className="text-muted">Không rõ</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <nav
                aria-label="Phân trang audit log"
                className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-4 sm:px-6"
              >
                <p className="tabular-nums text-sm text-muted">
                  Trang {page} / {pageCount}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    disabled={page <= 1 || logsQuery.isFetching}
                    onClick={() => {
                      setErrorDismissed(false);
                      setPage((currentPage) => currentPage - 1);
                    }}
                    className="min-h-10 rounded-lg px-3"
                  >
                    Trước
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={page >= pageCount || logsQuery.isFetching}
                    onClick={() => {
                      setErrorDismissed(false);
                      setPage((currentPage) => currentPage + 1);
                    }}
                    className="min-h-10 rounded-lg px-3"
                  >
                    Tiếp
                  </Button>
                </div>
              </nav>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

export default AdminDashboard;
