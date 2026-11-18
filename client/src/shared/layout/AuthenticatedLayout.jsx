import { useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { useQueryClient } from "@tanstack/react-query";
import { CiLogout } from "react-icons/ci";
import {
  IoChatbubblesOutline,
  IoShieldCheckmarkOutline,
} from "react-icons/io5";
import api, { clearAccessToken } from "../api/client";
import { logout } from "../../features/auth/store/actions/authAction";
import Button from "../ui/Button";
import Dialog from "../ui/Dialog";
import { useToast } from "../ui/ToastProvider";
import { cn } from "../ui/cn";

function AuthenticatedLayout() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const queryClient = useQueryClient();
  const toast = useToast();
  const user = useSelector((state) => state.auth.user);
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
  const destinations = [
    { to: "/chat", label: "Tin nhắn", Icon: IoChatbubblesOutline },
  ];

  if (user?.role === "admin") {
    destinations.push({
      to: "/admin",
      label: "Quản trị",
      Icon: IoShieldCheckmarkOutline,
    });
  }

  const handleLogout = async () => {
    try {
      await api.post("/api/v1/auth/logout");
    } catch (error) {
      console.error("Could not revoke the refresh token", error);
      toast("Đăng xuất không thành công. Vui lòng thử lại.", "error");
      return;
    }

    clearAccessToken();
    queryClient.clear();
    dispatch(logout());
    navigate("/", { replace: true });
  };

  const desktopLinkClass = ({ isActive }) =>
    cn(
      "grid size-11 place-items-center rounded-xl text-muted transition-colors hover:bg-surface-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
      isActive && "bg-accent/10 text-accent",
    );
  const mobileLinkClass = ({ isActive }) =>
    cn(
      "flex min-h-14 flex-col items-center justify-center gap-1 px-5 text-xs font-semibold text-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent",
      isActive ? "text-accent" : "hover:text-ink",
    );
  const userInitial = user?.userName?.slice(0, 1)?.toLocaleUpperCase() || "?";

  return (
    <div className="grid h-dvh min-h-dvh grid-rows-[3.5rem_minmax(0,1fr)] overflow-hidden bg-canvas text-ink lg:grid-cols-[4.5rem_minmax(0,1fr)] lg:grid-rows-1">
      <a
        href="#main-content"
        className="fixed left-3 top-3 z-50 -translate-y-20 rounded-lg bg-surface px-4 py-3 text-sm font-semibold text-ink shadow-panel transition-transform focus:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        Bỏ qua điều hướng
      </a>

      <header className="flex items-center justify-between border-b border-line bg-surface px-4 lg:hidden">
        <Link
          to="/chat"
          aria-label="Chat, trang tin nhắn"
          className="flex min-h-11 items-center gap-2 rounded-lg text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <span className="grid size-9 place-items-center rounded-xl bg-accent text-accent-foreground">
            <IoChatbubblesOutline aria-hidden="true" className="size-5" />
          </span>
          <span className="font-bold">Chat</span>
        </Link>
        <div className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="grid size-8 place-items-center rounded-lg bg-surface-muted text-xs font-bold text-muted"
          >
            {userInitial}
          </span>
          <Button
            variant="quiet"
            aria-label="Đăng xuất"
            title="Đăng xuất"
            onClick={() => setLogoutDialogOpen(true)}
            className="size-10 min-h-10 rounded-lg px-2"
          >
            <CiLogout aria-hidden="true" className="size-5" />
          </Button>
        </div>
      </header>

      <aside className="hidden h-dvh min-h-0 flex-col items-center border-r border-line bg-surface py-4 lg:flex">
        <Link
          to="/chat"
          aria-label="Chat, trang tin nhắn"
          title="Chat"
          className="grid size-11 shrink-0 place-items-center rounded-xl bg-accent text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <IoChatbubblesOutline aria-hidden="true" className="size-6" />
        </Link>

        <nav
          aria-label="Điều hướng ứng dụng"
          className="mt-8 flex flex-col items-center gap-2"
        >
          {destinations.map(({ to, label, Icon }) => (
            <NavLink
              key={to}
              to={to}
              aria-label={label}
              title={label}
              className={desktopLinkClass}
            >
              <Icon aria-hidden="true" className="size-5" />
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto flex flex-col items-center gap-3">
          <span
            aria-label={`Đã đăng nhập với tên ${user?.userName || "người dùng"}`}
            title={user?.userName || "Tài khoản"}
            className="grid size-10 place-items-center rounded-xl bg-surface-muted text-sm font-bold text-muted"
          >
            {userInitial}
          </span>
          <Button
            variant="quiet"
            aria-label="Đăng xuất"
            title="Đăng xuất"
            onClick={() => setLogoutDialogOpen(true)}
            className="size-11 min-h-11 rounded-xl px-2"
          >
            <CiLogout aria-hidden="true" className="size-5" />
          </Button>
        </div>
      </aside>

      <div
        id="main-content"
        tabIndex="-1"
        className="min-h-0 min-w-0 overflow-hidden pb-[calc(4rem+env(safe-area-inset-bottom))] outline-none lg:pb-0"
      >
        <Outlet />
      </div>

      <nav
        aria-label="Điều hướng ứng dụng"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden"
      >
        <div
          className={cn(
            "mx-auto grid max-w-sm",
            destinations.length === 1 ? "grid-cols-1" : "grid-cols-2",
          )}
        >
          {destinations.map(({ to, label, Icon }) => (
            <NavLink key={to} to={to} className={mobileLinkClass}>
              <Icon aria-hidden="true" className="size-5" />
              <span>{label}</span>
            </NavLink>
          ))}
        </div>
      </nav>

      <Dialog
        open={logoutDialogOpen}
        onOpenChange={setLogoutDialogOpen}
        title="Đăng xuất khỏi tài khoản?"
        description="Phiên đăng nhập hiện tại sẽ được đóng an toàn."
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setLogoutDialogOpen(false)}
            >
              Ở lại
            </Button>
            <Button
              variant="secondary"
              className="text-danger"
              onClick={handleLogout}
            >
              Đăng xuất
            </Button>
          </>
        }
      >
        <p className="text-sm leading-6 text-muted">
          Bạn sẽ cần đăng nhập lại để tiếp tục trò chuyện.
        </p>
      </Dialog>
    </div>
  );
}

export default AuthenticatedLayout;
