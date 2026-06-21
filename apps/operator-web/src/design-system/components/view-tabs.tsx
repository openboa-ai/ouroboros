import type { ComponentProps, ReactNode } from "react";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger
} from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { OPERATOR_DESIGN_TOKENS } from "../tokens";
import { OperatorTabBadge } from "./tab-badge";

export function OperatorTabs({
  className,
  ...props
}: ComponentProps<typeof Tabs>) {
  return (
    <Tabs
      data-operator-ui="tabs"
      className={cn("min-w-0 max-w-full", className)}
      {...props}
    />
  );
}

export interface OperatorViewTabItem<TValue extends string = string> {
  value: TValue;
  label: ReactNode;
  badge?: ReactNode;
  badgeAriaLabel?: string;
}

export function OperatorViewTabs<TValue extends string = string>({
  items,
  className,
  ...props
}: {
  items: OperatorViewTabItem<TValue>[];
  className?: string;
} & Omit<ComponentProps<typeof TabsList>, "className" | "children">) {
  return (
    <TabsList
      {...props}
      data-operator-ui="view-tabs"
      className={cn(OPERATOR_DESIGN_TOKENS.layout.viewTabsList, className)}
    >
      {items.map((item) => (
        <TabsTrigger key={item.value} value={item.value}>
          <span>{item.label}</span>
          {item.badge && (
            <OperatorTabBadge aria-label={item.badgeAriaLabel}>
              {item.badge}
            </OperatorTabBadge>
          )}
        </TabsTrigger>
      ))}
    </TabsList>
  );
}

export function OperatorTabPanel({
  children,
  className,
  ...props
}: {
  children: ReactNode;
  className?: string;
} & Omit<ComponentProps<typeof TabsContent>, "className" | "children">) {
  return (
    <TabsContent
      {...props}
      data-operator-ui="tab-panel"
      className={cn(OPERATOR_DESIGN_TOKENS.layout.tabPanel, className)}
    >
      {children}
    </TabsContent>
  );
}
