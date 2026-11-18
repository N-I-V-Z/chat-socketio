import { IoChatbubblesOutline } from "react-icons/io5";
import Header from "../../shared/layout/Header";

function AuthLayout({ eyebrow, title, description, children }) {
  return (
    <div className="min-h-dvh bg-canvas">
      <a
        href="#auth-content"
        className="fixed left-3 top-3 z-50 -translate-y-20 rounded-lg bg-surface px-4 py-3 text-sm font-semibold text-ink shadow-panel transition-transform focus:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        Bỏ qua điều hướng
      </a>
      <Header />
      <main
        id="auth-content"
        tabIndex="-1"
        className="mx-auto grid min-h-[calc(100dvh-4.5rem)] max-w-7xl grid-cols-1 items-center gap-8 px-5 py-10 sm:px-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-16 lg:px-10 lg:py-8"
      >
        <section className="order-1 mx-auto w-full max-w-md py-4 lg:mx-0 lg:py-10">
          <div className="mb-9 animate-fade-up">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-accent">
              {eyebrow}
            </p>
            <h1 className="mt-4 text-4xl font-bold tracking-[-0.055em] text-ink text-balance sm:text-5xl">
              {title}
            </h1>
            <p className="mt-4 text-base leading-7 text-muted text-pretty">
              {description}
            </p>
          </div>
          {children}
        </section>

        <aside
          aria-label="Giới thiệu về Chat"
          className="relative order-2 hidden w-full overflow-hidden rounded-panel bg-accent p-10 text-accent-foreground shadow-panel lg:flex lg:min-h-[38rem] lg:flex-col lg:items-start xl:p-14"
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-20 -top-24 size-80 rounded-full border border-accent-foreground/10"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-32 -right-10 size-80 rounded-full border border-accent-foreground/10"
          />
          <div className="relative grid size-14 shrink-0 place-items-center rounded-2xl border border-accent-foreground/15 bg-accent-foreground/10">
            <IoChatbubblesOutline aria-hidden="true" className="size-7" />
          </div>
          <div className="relative mt-auto max-w-xl pb-6">
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-accent-foreground/75">
              Chat · Không gian kết nối
            </p>
            <h2 className="mt-5 text-4xl font-bold leading-[1.08] tracking-[-0.055em] text-accent-foreground text-balance xl:text-5xl">
              Những cuộc trò chuyện đáng giữ lại.
            </h2>
            <p className="mt-6 max-w-md text-base leading-7 text-pretty text-accent-foreground/80">
              Nhắn tin và gọi cho những người quan trọng, trong một nơi thật dễ
              dùng.
            </p>
          </div>
        </aside>
      </main>
    </div>
  );
}

export default AuthLayout;
