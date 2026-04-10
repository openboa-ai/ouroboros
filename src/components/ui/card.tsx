import type { PropsWithChildren } from "react";

type CardProps = PropsWithChildren<{
  title?: string;
  description?: string;
  className?: string;
}>;

export function Card({ children, className = "", description, title }: CardProps) {
  return (
    <section
      className={[
        "rounded-[1.75rem] border border-white/10 bg-white/[0.025] p-5 shadow-panel backdrop-blur-sm",
        className
      ].join(" ")}
    >
      {title || description ? (
        <header className="mb-5">
          {title ? <h2 className="text-lg font-semibold text-ink-50">{title}</h2> : null}
          {description ? <p className="mt-1 text-sm leading-6 text-ink-300">{description}</p> : null}
        </header>
      ) : null}
      {children}
    </section>
  );
}
