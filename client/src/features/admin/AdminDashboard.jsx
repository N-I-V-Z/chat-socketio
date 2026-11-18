import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useSelector } from "react-redux";
import { useQuery } from "@tanstack/react-query";
import { getAuditLogs, listAdminUsers } from "./api";
import { eventOptions, toAuditItem } from "./viewModel";
import { queryKeys } from "../../shared/api/queryKeys";
import Button from "../../shared/ui/Button";
import { cn } from "../../shared/ui/cn";

const PAGE_SIZE = 25;

function UserRole({ role }) {
  return (
    <span
      className={cn(
        "inline-flex min-h-7 items-center rounded-lg px-2.5 text-xs font-semibold",
        role === "admin"
          ? "bg-accent/10 text-accent"
          : "bg-surface-muted text-muted",
      )}
    >
      {role === "admin" ? "Admin" : "User"}
    </span>
  );
}

function UserPresence({ isOnline }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span
        aria-hidden="true"
        className={cn(
          "size-2 rounded-full",
          isOnline ? "bg-success" : "bg-surface-muted",
        )}
      />
      <span className={isOnline ? "font-medium text-success" : "text-muted"}>
        {isOnline ? "Đang online" : "Offline"}
      </span>
    </span>
  );
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

function LoadingCards() {
  return (
    <div className="grid gap-3 py-4" role="status">
      {[0, 1, 2].map((row) => (
        <span
          aria-hidden="true"
          className="block h-24 animate-pulse rounded-xl bg-surface-muted motion-reduce:animate-none"
          key={row}
        />
      ))}
      <span className="sr-only">Đang tải dữ liệu</span>
    </div>
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
    queryFn: listAdminUsers,
    enabled: activeTab === "users",
    staleTime: 5_000,
  });
  const logsQuery = useQuery({
    queryKey: queryKeys.adminLogs(page, PAGE_SIZE, eventType),
    queryFn: () => getAuditLogs(page, PAGE_SIZE, eventType),
    enabled: activeTab === "logs",
  });
  const users = usersQuery.data || [];
  const logs = logsQuery.data || { items: [], total: 0 };
  const auditItems = logs.items.map(toAuditItem);
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
    <main className="h-full min-h-0 overflow-y-auto bg-canvas">
      <header className="bg-canvas">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 pb-5 pt-8 sm:px-6 sm:pb-7 sm:pt-10 md:flex-row md:items-end md:justify-between lg:px-8">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-accent">
              Không gian quản trị
            </p>
            <h1 className="mt-3 text-balance text-3xl font-bold tracking-[-0.05em] text-ink sm:text-4xl">
              Bảng điều khiển
            </h1>
            <p className="mt-3 max-w-prose text-pretty text-sm leading-6 text-muted">
              Xin chào {user?.userName}. Audit log được lưu trong 30 ngày.
            </p>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 pb-10 pt-3 sm:px-6 sm:pb-12 lg:px-8">
        <div
          aria-label="Khu vực quản trị"
          className="mb-6 flex w-full gap-1 rounded-xl border border-line bg-surface p-1 shadow-panel sm:w-fit"
          role="group"
        >
          <button
            type="button"
            aria-pressed={activeTab === "users"}
            onClick={() => changeTab("users")}
            className={cn(
              "min-h-11 flex-1 rounded-lg px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent sm:flex-none",
              activeTab === "users"
                ? "bg-accent/10 text-accent"
                : "text-muted hover:text-ink",
            )}
          >
            Người dùng
          </button>
          <button
            type="button"
            aria-pressed={activeTab === "logs"}
            onClick={() => changeTab("logs")}
            className={cn(
              "min-h-11 flex-1 rounded-lg px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent sm:flex-none",
              activeTab === "logs"
                ? "bg-accent/10 text-accent"
                : "text-muted hover:text-ink",
            )}
          >
            Audit log
          </button>
        </div>

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
          {activeTab === "users" ? (
            <div>
              <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
                <div>
                  <h2 className="text-balance text-lg font-bold tracking-[-0.025em] text-ink">
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
              <div className="px-4 pb-4 xl:hidden">
                {activeQueryLoading ? (
                  <LoadingCards />
                ) : activeQueryError && users.length === 0 ? (
                  <p
                    className="rounded-xl border border-line p-5 text-center text-sm text-muted"
                    role="alert"
                  >
                    Danh sách người dùng hiện chưa khả dụng.
                  </p>
                ) : users.length === 0 ? (
                  <div className="rounded-xl border border-line p-5 text-center">
                    <p className="font-semibold text-ink">
                      Chưa có người dùng.
                    </p>
                    <p className="mt-1 text-sm text-muted">
                      Dữ liệu sẽ xuất hiện tại đây.
                    </p>
                    <Link
                      to="/chat"
                      className="mt-4 inline-block text-sm font-semibold text-accent underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    >
                      Quay lại trò chuyện
                    </Link>
                  </div>
                ) : (
                  <ul aria-label="Tài khoản người dùng" className="grid gap-3">
                    {users.map((listedUser) => (
                      <li
                        key={listedUser.userId}
                        className="rounded-xl border border-line bg-canvas/60 p-4"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <h3 className="break-words font-semibold text-ink">
                              {listedUser.userName}
                            </h3>
                            <div className="mt-2">
                              <UserRole role={listedUser.role} />
                            </div>
                          </div>
                          <UserPresence isOnline={listedUser.isOnline} />
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="hidden overflow-x-auto xl:block">
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
                        <tr
                          key={listedUser.userId}
                          className="transition-colors hover:bg-surface-muted/50"
                        >
                          <th
                            className="px-5 py-4 font-semibold text-ink"
                            scope="row"
                          >
                            {listedUser.userName}
                          </th>
                          <td className="px-5 py-4">
                            <UserRole role={listedUser.role} />
                          </td>
                          <td className="px-5 py-4">
                            <UserPresence isOnline={listedUser.isOnline} />
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
                  <h2 className="text-balance text-lg font-bold tracking-[-0.025em] text-ink">
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
                    className="min-h-11 w-full min-w-56 rounded-lg border border-line bg-surface px-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent/30"
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
              <div className="px-4 pb-4 xl:hidden">
                {activeQueryLoading ? (
                  <LoadingCards />
                ) : activeQueryError && logs.items.length === 0 ? (
                  <p
                    className="rounded-xl border border-line p-5 text-center text-sm text-muted"
                    role="alert"
                  >
                    Audit log hiện chưa khả dụng.
                  </p>
                ) : logs.items.length === 0 ? (
                  <div className="rounded-xl border border-line p-5 text-center">
                    <p className="font-semibold text-ink">Chưa có audit log.</p>
                    <p className="mt-1 text-sm text-muted">
                      Dữ liệu sẽ xuất hiện tại đây.
                    </p>
                    {eventType ? (
                      <button
                        type="button"
                        onClick={() => {
                          setEventType("");
                          setPage(1);
                        }}
                        className="mt-4 text-sm font-semibold text-accent underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                      >
                        Xóa bộ lọc
                      </button>
                    ) : (
                      <Link
                        to="/chat"
                        className="mt-4 inline-block text-sm font-semibold text-accent underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                      >
                        Quay lại trò chuyện
                      </Link>
                    )}
                  </div>
                ) : (
                  <ul aria-label="Lịch sử audit" className="grid gap-3">
                    {auditItems.map((log) => {
                      const outcome = log.outcome;
                      return (
                        <li
                          key={log.eventId}
                          className="rounded-xl border border-line bg-canvas/60 p-4"
                        >
                          <article>
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="min-w-0">
                                <h3 className="break-words text-sm font-bold text-ink">
                                  {log.eventLabel}
                                </h3>
                                <time
                                  dateTime={log.occurredAt}
                                  className="mt-1 block text-xs text-muted"
                                >
                                  {log.occurredAtLabel}
                                </time>
                              </div>
                              <span
                                className={cn(
                                  "shrink-0 text-sm",
                                  outcome.className,
                                )}
                              >
                                {outcome.label}
                              </span>
                            </div>
                            <dl className="mt-4 grid gap-3 border-t border-line pt-3 text-sm">
                              <div className="grid gap-1">
                                <dt className="text-xs font-semibold text-muted">
                                  Người thực hiện
                                </dt>
                                <dd className="break-words text-ink">
                                  {log.actorName}
                                </dd>
                              </div>
                              <div className="grid gap-1">
                                <dt className="text-xs font-semibold text-muted">
                                  Người liên quan
                                </dt>
                                <dd className="break-words text-muted">
                                  {log.targetLabel}
                                </dd>
                              </div>
                            </dl>
                          </article>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
              <div className="hidden overflow-x-auto xl:block">
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
                      auditItems.map((log) => (
                        <tr
                          key={log.eventId}
                          className="transition-colors hover:bg-surface-muted/50"
                        >
                          <td className="whitespace-nowrap px-5 py-4 text-muted">
                            {log.occurredAtLabel}
                          </td>
                          <th
                            className="px-5 py-4 font-semibold text-ink"
                            scope="row"
                          >
                            {log.eventLabel}
                          </th>
                          <td className="px-5 py-4 text-ink">
                            {log.actorName}
                          </td>
                          <td className="px-5 py-4 text-muted">
                            {log.targetLabel}
                          </td>
                          <td className="px-5 py-4">
                            <span className={log.outcome.className}>
                              {log.outcome.label}
                            </span>
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
