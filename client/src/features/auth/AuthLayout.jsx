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
        className="mx-auto grid min-h-[calc(100dvh-4.5rem)] max-w-7xl grid-cols-1 items-center gap-5 px-4 py-6 sm:px-8 sm:py-8 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:gap-12 lg:px-10"
      >
        <section className="order-1 mx-auto w-full max-w-xl py-4 lg:mx-0 lg:py-6">
          <div className="mb-8 animate-fade-up">
            <p className="text-sm font-semibold text-accent">{eyebrow}</p>
            <h1 className="mt-3 text-3xl font-semibold text-ink text-balance sm:text-4xl">
              {title}
            </h1>
            <p className="mt-3 text-sm leading-6 text-muted text-pretty">
              {description}
            </p>
          </div>
          {children}
        </section>

        <aside
          aria-label="Giới thiệu về Chat"
          className="relative order-2 flex w-full max-w-xl items-center gap-4 overflow-hidden rounded-2xl border border-line bg-surface-muted p-5 text-ink lg:min-h-[36rem] lg:max-w-none lg:flex-col lg:items-start lg:rounded-[2rem] lg:border-0 lg:bg-accent lg:p-10 lg:text-accent-foreground lg:shadow-panel xl:p-14"
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-24 -top-24 hidden size-80 rounded-full border border-accent-foreground/10 lg:block"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-32 -right-10 hidden size-80 rounded-full bg-accent-foreground/[0.05] lg:block"
          />
          <div className="relative grid size-11 shrink-0 place-items-center rounded-xl bg-accent text-accent-foreground lg:size-14 lg:rounded-2xl lg:border lg:border-accent-foreground/15 lg:bg-accent-foreground/10">
            <IoChatbubblesOutline aria-hidden="true" className="size-7" />
          </div>
          <div className="relative lg:mt-16 lg:max-w-xl">
            <p className="text-xs font-semibold text-muted lg:text-sm lg:text-accent-foreground/75">
              Giao tiếp theo cách của bạn
            </p>
            <h2 className="mt-2 text-base font-semibold text-ink text-balance lg:mt-4 lg:text-4xl lg:leading-[1.08] lg:text-accent-foreground xl:text-5xl">
              Những cuộc trò chuyện đáng giữ lại.
            </h2>
            <p className="mt-2 hidden max-w-md text-base leading-7 text-pretty text-accent-foreground/80 lg:mt-6 lg:block">
              Nhắn tin trực tiếp, kết nối nhanh và theo dõi mọi cuộc trò chuyện
              trong một không gian gọn gàng.
            </p>
          </div>
          <div className="relative mt-auto hidden border-t border-accent-foreground/15 pt-5 text-sm text-accent-foreground/70 lg:block">
            Nhắn tin và cuộc gọi, luôn trong tầm tay.
          </div>
        </aside>
      </main>
    </div>
  );
}

export default AuthLayout;
