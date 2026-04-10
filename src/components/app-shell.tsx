import type { PropsWithChildren, ReactNode } from "react";

type AppShellProps = PropsWithChildren<{
  title: string;
  subtitle: string;
  aside?: ReactNode;
}>;

export function AppShell({ aside, children, subtitle, title }: AppShellProps) {
  return (
    <main className="min-h-screen bg-shell-950 text-ink-50">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute inset-x-0 top-[-18rem] h-[32rem] rounded-full bg-[radial-gradient(circle_at_top,rgba(49,208,170,0.22),transparent_58%)]" />
        <div className="absolute right-[-10rem] top-[12rem] h-[28rem] w-[28rem] rounded-full bg-[radial-gradient(circle,rgba(103,166,255,0.16),transparent_62%)]" />
      </div>
      <div className="relative mx-auto flex max-w-[1600px] flex-col gap-8 px-4 py-6 lg:px-8">
        <header className="flex flex-col gap-2 border-b border-white/10 pb-6">
          <p className="text-xs uppercase tracking-[0.26em] text-ink-300">Desktop Trading Client</p>
          <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-4xl font-semibold tracking-tight">{title}</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-ink-200">{subtitle}</p>
            </div>
          </div>
        </header>
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div>{children}</div>
          <aside>{aside}</aside>
        </div>
      </div>
    </main>
  );
}
