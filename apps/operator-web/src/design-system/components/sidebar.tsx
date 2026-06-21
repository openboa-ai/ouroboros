import type { ComponentProps } from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarRail
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { OPERATOR_DESIGN_TOKENS } from "../tokens";

export function OperatorSidebarFrame({
  className,
  ...props
}: ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar
      data-operator-ui="sidebar"
      className={cn(OPERATOR_DESIGN_TOKENS.layout.sidebarFrame, className)}
      {...props}
    />
  );
}

export function OperatorSidebarHeader(props: ComponentProps<typeof SidebarHeader>) {
  return <SidebarHeader {...props} />;
}

export function OperatorSidebarContent(props: ComponentProps<typeof SidebarContent>) {
  return <SidebarContent {...props} />;
}

export function OperatorSidebarFooter(props: ComponentProps<typeof SidebarFooter>) {
  return <SidebarFooter {...props} />;
}

export function OperatorSidebarGroup(props: ComponentProps<typeof SidebarGroup>) {
  return <SidebarGroup {...props} />;
}

export function OperatorSidebarGroupContent(props: ComponentProps<typeof SidebarGroupContent>) {
  return <SidebarGroupContent {...props} />;
}

export function OperatorSidebarGroupLabel({
  className,
  ...props
}: ComponentProps<typeof SidebarGroupLabel>) {
  return (
    <SidebarGroupLabel
      className={cn(OPERATOR_DESIGN_TOKENS.layout.sidebarGroupLabel, className)}
      {...props}
    />
  );
}

export function OperatorSidebarMenu(props: ComponentProps<typeof SidebarMenu>) {
  return <SidebarMenu {...props} />;
}

export function OperatorSidebarMenuItem(props: ComponentProps<typeof SidebarMenuItem>) {
  return <SidebarMenuItem {...props} />;
}

export function OperatorSidebarMenuButton({
  className,
  ...props
}: ComponentProps<typeof SidebarMenuButton>) {
  return (
    <SidebarMenuButton
      className={cn(OPERATOR_DESIGN_TOKENS.layout.sidebarMenuButton, className)}
      {...props}
    />
  );
}

export function OperatorSidebarMenuBadge({
  className,
  ...props
}: ComponentProps<typeof SidebarMenuBadge>) {
  return (
    <SidebarMenuBadge
      className={cn(OPERATOR_DESIGN_TOKENS.layout.sidebarMenuBadge, className)}
      {...props}
    />
  );
}

export function OperatorSidebarMenuSkeleton({
  className,
  ...props
}: ComponentProps<typeof SidebarMenuSkeleton>) {
  return (
    <SidebarMenuSkeleton
      className={cn(OPERATOR_DESIGN_TOKENS.layout.sidebarMenuSkeleton, className)}
      {...props}
    />
  );
}

export function OperatorSidebarRail(props: ComponentProps<typeof SidebarRail>) {
  return <SidebarRail {...props} />;
}
