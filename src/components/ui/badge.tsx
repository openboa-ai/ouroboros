import type { LucideIcon } from "lucide-react";
import type { PropsWithChildren } from "react";

type BadgeTone = "live" | "paper" | "observer" | "positive" | "warning" | "danger" | "neutral";

type BadgeProps = PropsWithChildren<{
  tone: BadgeTone;
  icon?: LucideIcon;
}>;

const toneClasses: Record<BadgeTone, string> = {
  live: "border-red-400/30 bg-red-400/15 text-red-100",
  paper: "border-accent-amber/30 bg-accent-amber/15 text-amber-100",
  observer: "border-accent-blue/30 bg-accent-blue/15 text-blue-100",
  positive: "border-accent-teal/30 bg-accent-teal/15 text-emerald-100",
  warning: "border-accent-amber/30 bg-accent-amber/15 text-amber-100",
  danger: "border-accent-red/30 bg-accent-red/15 text-rose-100",
  neutral: "border-white/10 bg-white/[0.04] text-ink-100"
};

export function Badge({ children, icon: Icon, tone }: BadgeProps) {
  return (
    <span
      className={[
        "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium uppercase tracking-[0.16em]",
        toneClasses[tone]
      ].join(" ")}
    >
      {Icon ? <Icon className="size-3.5" /> : null}
      {children}
    </span>
  );
}
