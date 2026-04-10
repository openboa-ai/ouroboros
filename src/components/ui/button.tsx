import type { ButtonHTMLAttributes, PropsWithChildren } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

type ButtonProps = PropsWithChildren<
  ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: ButtonVariant;
  }
>;

const variantClasses: Record<ButtonVariant, string> = {
  primary: "bg-accent-teal text-shell-950 hover:bg-[#47ddb9]",
  secondary: "bg-white/[0.08] text-ink-50 hover:bg-white/[0.14]",
  ghost: "bg-transparent text-ink-100 hover:bg-white/[0.06]",
  danger: "bg-accent-red text-white hover:bg-[#ff7b7b]"
};

export function Button({
  children,
  className = "",
  type = "button",
  variant = "primary",
  ...props
}: ButtonProps) {
  return (
    <button
      className={[
        "inline-flex items-center justify-center rounded-2xl px-4 py-3 text-sm font-medium transition-colors",
        variantClasses[variant],
        className
      ].join(" ")}
      type={type}
      {...props}
    >
      {children}
    </button>
  );
}
