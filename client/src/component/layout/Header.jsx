import { NavLink, Link } from "react-router-dom";
import { IoChatbubblesOutline } from "react-icons/io5";

function Header() {
  const navClassName = ({ isActive }) =>
    [
      "rounded-lg px-3 py-2 text-sm font-semibold transition duration-200",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
      isActive
        ? "bg-surface text-accent"
        : "text-muted hover:bg-surface-muted hover:text-ink",
    ].join(" ");

  return (
    <header className="border-b border-line/80 bg-canvas/90">
      <div className="mx-auto flex h-[4.5rem] max-w-7xl items-center justify-between gap-4 px-4 sm:px-8 lg:px-10">
        <Link
          to="/"
          className="flex items-center gap-3 rounded-xl text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          aria-label="Chat, trang chủ"
        >
          <span className="grid size-10 place-items-center rounded-xl bg-accent text-accent-foreground">
            <IoChatbubblesOutline aria-hidden="true" className="size-5" />
          </span>
          <span className="text-lg font-bold tracking-tight">Chat</span>
        </Link>
        <nav
          aria-label="Điều hướng tài khoản"
          className="flex items-center gap-1"
        >
          <NavLink to="/" end className={navClassName}>
            Đăng nhập
          </NavLink>
          <NavLink to="/register" className={navClassName}>
            Đăng ký
          </NavLink>
        </nav>
      </div>
    </header>
  );
}

export default Header;
