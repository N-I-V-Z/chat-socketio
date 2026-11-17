import { IoChatbubblesOutline } from "react-icons/io5";
import Header from "../layout/Header";

function AuthLayout({ eyebrow, title, description, children }) {
  return (
    <div className="min-h-dvh bg-canvas">
      <Header />
      <main className="mx-auto grid min-h-[calc(100dvh-4.5rem)] max-w-7xl grid-cols-1 items-center gap-8 px-4 py-8 sm:px-8 lg:grid-cols-[1.08fr_0.92fr] lg:gap-12 lg:px-10">
        <section
          aria-label="Giới thiệu"
          className="relative hidden min-h-[36rem] overflow-hidden rounded-[2rem] bg-accent p-10 text-accent-foreground shadow-panel lg:flex lg:flex-col xl:p-14"
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-24 -top-24 size-80 rounded-full border border-accent-foreground/10"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-32 -right-10 size-80 rounded-full bg-accent-foreground/[0.05]"
          />
          <div className="relative grid size-14 place-items-center rounded-2xl border border-accent-foreground/15 bg-accent-foreground/10">
            <IoChatbubblesOutline aria-hidden="true" className="size-7" />
          </div>
          <div className="relative mt-16 max-w-xl">
            <p className="text-sm font-semibold text-accent-foreground/75">
              Giao tiếp theo cách của bạn
            </p>
            <h1 className="mt-4 text-4xl font-semibold leading-[1.08] tracking-[-0.04em] xl:text-5xl">
              Những cuộc trò chuyện đáng giữ lại.
            </h1>
            <p className="mt-6 max-w-md text-base leading-7 text-accent-foreground/80">
              Nhắn tin trực tiếp, kết nối nhanh và theo dõi mọi cuộc trò chuyện
              trong một không gian gọn gàng.
            </p>
          </div>
          <div className="relative mt-auto border-t border-accent-foreground/15 pt-5 text-sm text-accent-foreground/70">
            Tin nhắn và cuộc gọi, luôn trong tầm tay.
          </div>
        </section>

        <section className="mx-auto w-full max-w-md py-6 lg:px-6">
          <div className="mb-8 animate-fade-up">
            <p className="text-sm font-semibold text-accent">{eyebrow}</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.035em] text-ink sm:text-4xl">
              {title}
            </h2>
            <p className="mt-3 text-sm leading-6 text-muted">{description}</p>
          </div>
          {children}
        </section>
      </main>
    </div>
  );
}

export default AuthLayout;
