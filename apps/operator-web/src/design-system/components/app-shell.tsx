import type { ComponentProps, ReactNode } from "react";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger
} from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { OPERATOR_DESIGN_TOKENS } from "../tokens";

export function OperatorAppShell({
  sidebar,
  children,
  className,
  ...props
}: {
  sidebar: ReactNode;
  children: ReactNode;
  className?: string;
} & Omit<ComponentProps<"div">, "className" | "children">) {
  return (
    <TooltipProvider>
      <SidebarProvider
        data-operator-ui="app-shell"
        className={cn(OPERATOR_DESIGN_TOKENS.layout.appShell, className)}
        {...props}
      >
        {sidebar}
        <SidebarInset>
          {children}
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}

export function OperatorAppHeader({
  title,
  subtitle,
  className
}: {
  title: string;
  subtitle: string;
  className?: string;
}) {
  return (
    <header data-operator-ui="app-header" className={cn(OPERATOR_DESIGN_TOKENS.layout.appHeader, className)}>
      <SidebarTrigger />
      <Separator orientation="vertical" className={OPERATOR_DESIGN_TOKENS.layout.appHeaderSeparator} />
      <div className={OPERATOR_DESIGN_TOKENS.layout.appHeaderCopy}>
        <p className={OPERATOR_DESIGN_TOKENS.typography.appTitle}>{title}</p>
        <p className={OPERATOR_DESIGN_TOKENS.typography.appSubtitle}>{subtitle}</p>
      </div>
    </header>
  );
}

export function OperatorAppMain({
  children,
  className,
  ...props
}: {
  children: ReactNode;
  className?: string;
} & Omit<ComponentProps<"main">, "className" | "children">) {
  return (
    <main
      data-operator-ui="app-main"
      className={cn(OPERATOR_DESIGN_TOKENS.layout.appMain, className)}
      {...props}
    >
      {children}
    </main>
  );
}
