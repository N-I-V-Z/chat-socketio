import { cn } from "../../ui/cn";

function ChatSidebar({
  isMobileConversationOpen,
  onSelectUser,
  unreadCountByPeer,
  unreadSummaryQuery,
  user,
  userList,
  userListQuery,
  selectedUserId,
}) {
  return (
    <aside
      aria-label="Danh sách liên hệ"
      className={cn(
        "min-h-0 flex-col overflow-hidden border-line bg-surface lg:rounded-panel lg:border lg:shadow-panel",
        isMobileConversationOpen ? "hidden lg:flex" : "flex",
      )}
    >
      <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">
            Tin nhắn
          </p>
          <h1 className="mt-1 text-xl font-bold tracking-tight">Trò chuyện</h1>
        </div>
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent/10 text-sm font-bold text-accent">
          {user?.userName?.slice(0, 1)?.toLocaleUpperCase() || "?"}
        </span>
      </div>

      <div className="flex items-center justify-between px-5 pb-2 pt-4">
        <h2 className="text-sm font-bold">Người dùng</h2>
        {!userListQuery.isPending && (
          <span className="text-xs text-muted">{userList.length}</span>
        )}
      </div>
      <ul
        aria-label="Danh sách người dùng"
        className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 pb-3"
      >
        {userListQuery.isPending && (
          <li className="space-y-2 px-2 py-3" role="status">
            <span className="block h-11 animate-pulse rounded-xl bg-surface-muted motion-reduce:animate-none" />
            <span className="block h-11 animate-pulse rounded-xl bg-surface-muted motion-reduce:animate-none" />
            <span className="sr-only">Đang tải danh sách người dùng</span>
          </li>
        )}
        {userListQuery.isError && (
          <li className="px-2 py-3 text-sm text-danger" role="alert">
            <p>Không thể tải danh sách người dùng.</p>
            <button
              type="button"
              onClick={() => userListQuery.refetch()}
              className="mt-2 font-semibold underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              Thử lại
            </button>
          </li>
        )}
        {userList.map((listedUser) => {
          const isSelected = Number(listedUser.userId) === selectedUserId;
          const unreadCount =
            unreadCountByPeer.get(Number(listedUser.userId)) || 0;
          return (
            <li key={listedUser.userId}>
              <button
                type="button"
                aria-current={isSelected ? "true" : undefined}
                onClick={() => onSelectUser(listedUser.userId)}
                className={[
                  "flex min-h-12 w-full items-center gap-3 rounded-xl px-3 py-2 text-left",
                  "transition duration-200 hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                  isSelected ? "bg-accent/10 text-accent" : "text-ink",
                ].join(" ")}
              >
                <span
                  aria-hidden="true"
                  className={[
                    "grid size-9 shrink-0 place-items-center rounded-xl text-sm font-bold",
                    isSelected
                      ? "bg-accent text-accent-foreground"
                      : "bg-surface-muted text-muted",
                  ].join(" ")}
                >
                  {listedUser.userName?.slice(0, 1)?.toLocaleUpperCase() || "?"}
                </span>
                <span className="truncate text-sm font-semibold">
                  {listedUser.userName}
                </span>
                {unreadCount > 0 && (
                  <span
                    aria-label={`${unreadCount} tin nhắn chưa đọc`}
                    className="ml-auto grid min-w-6 place-items-center rounded-full bg-accent px-2 py-0.5 text-xs font-bold tabular-nums text-accent-foreground"
                  >
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </button>
            </li>
          );
        })}
        {unreadSummaryQuery.isError && (
          <li className="px-2 py-3 text-sm text-danger" role="alert">
            <p>Không thể tải số tin nhắn chưa đọc.</p>
            <button
              type="button"
              onClick={() => unreadSummaryQuery.refetch()}
              className="mt-2 font-semibold underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              Thử lại
            </button>
          </li>
        )}
        {!userListQuery.isPending &&
          !userListQuery.isError &&
          userList.length === 0 && (
            <li className="px-2 py-3 text-sm text-muted">
              Chưa có người dùng khác.
            </li>
          )}
      </ul>
    </aside>
  );
}

export default ChatSidebar;
