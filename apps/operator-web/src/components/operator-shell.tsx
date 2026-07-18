import type { ReactNode } from "react";
import {
  Activity,
  CandlestickChart,
  Files,
  FlaskConical,
  Orbit,
  RefreshCw,
  Settings2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
  useSidebar
} from "@/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { OperatorCommandState } from "@/app/use-operator-runtime";
import { OPERATOR_SECTIONS, operatorRouteHref, type OperatorRoute, type OperatorSection } from "@/app/operator-route";
import { formatTimestamp } from "@/lib/operator-format";
import { StatusBadge } from "@/components/operator-status";
import { cn } from "@/lib/utils";

const SECTION_META: Record<OperatorSection, {
  label: string;
  description: string;
  icon: typeof Activity;
}> = {
  arena: {
    label: "Arena",
    description: "Paper TradingSystems",
    icon: Activity
  },
  research: {
    label: "Research",
    description: "Methodology sessions",
    icon: FlaskConical
  },
  trading: {
    label: "Trading",
    description: "Selected paper handoff",
    icon: CandlestickChart
  },
  evidence: {
    label: "Evidence",
    description: "Evaluation and provenance",
    icon: Files
  },
  system: {
    label: "System",
    description: "Runtime and providers",
    icon: Settings2
  }
};

export function OperatorShell({
  route,
  runtimeStatus,
  lastOperatorReadAt,
  refreshing,
  command,
  onRefresh,
  children
}: {
  route: OperatorRoute;
  runtimeStatus: string;
  lastOperatorReadAt?: string;
  refreshing: boolean;
  command: OperatorCommandState;
  onRefresh: () => void;
  children: ReactNode;
}) {
  const section = SECTION_META[route.section];

  return (
    <TooltipProvider delayDuration={350}>
      <SidebarProvider>
        <Sidebar collapsible="icon">
          <SidebarHeader className="border-b px-2 py-2">
            <a
              className="flex h-10 min-w-0 items-center gap-2 rounded-md px-1.5 outline-none focus-visible:ring-2 focus-visible:ring-ring"
              href="#/arena"
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-brand text-brand-foreground">
                <Orbit aria-hidden="true" className="size-4" />
              </span>
              <span className="min-w-0 group-data-[collapsible=icon]:hidden">
                <span className="block truncate text-sm font-semibold">Ouroboros</span>
                <span className="block truncate text-[11px] text-muted-foreground">Operator</span>
              </span>
            </a>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Operations</SidebarGroupLabel>
              <SidebarGroupContent>
                <OperatorNavigation activeSection={route.section} />
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
          <SidebarFooter className="border-t p-2">
            <div className="flex min-w-0 items-center gap-2 px-1.5 py-1 group-data-[collapsible=icon]:justify-center">
              <span className="size-2 shrink-0 rounded-full bg-brand" aria-hidden="true" />
              <span className="truncate text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
                Paper authority only
              </span>
            </div>
          </SidebarFooter>
          <SidebarRail />
        </Sidebar>

        <SidebarInset className="min-w-0 bg-background">
          <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b bg-background/92 px-3 backdrop-blur-md sm:px-4">
            <SidebarTrigger className="shrink-0" />
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-sm font-semibold">{section.label}</h1>
              <p className="truncate text-xs text-muted-foreground">{section.description}</p>
            </div>
            <div className="hidden min-w-0 items-center gap-2 sm:flex">
              <StatusBadge status={runtimeStatus} />
              <span className="max-w-44 truncate text-xs text-muted-foreground tabular-nums">
                Read {formatTimestamp(lastOperatorReadAt)}
              </span>
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  aria-label="Refresh operator state"
                  size="icon"
                  variant="ghost"
                  onClick={onRefresh}
                  disabled={refreshing}
                >
                  <RefreshCw aria-hidden="true" className={cn(refreshing && "animate-spin")} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Refresh operator state</TooltipContent>
            </Tooltip>
          </header>

          {command.message ? (
            <div
              aria-live="polite"
              className={cn(
                "border-b px-4 py-2 text-xs [overflow-wrap:anywhere]",
                command.status === "failed"
                  ? "bg-destructive/8 text-destructive"
                  : command.status === "succeeded"
                    ? "bg-success/8 text-foreground"
                    : "bg-muted/50 text-muted-foreground"
              )}
              role="status"
            >
              <span className="font-medium">{command.label ? `${command.label}: ` : ""}</span>
              {command.message}
            </div>
          ) : null}

          <main className="min-w-0 flex-1">{children}</main>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}

function OperatorNavigation({ activeSection }: { activeSection: OperatorSection }) {
  const { setOpenMobile } = useSidebar();
  return (
    <SidebarMenu>
      {OPERATOR_SECTIONS.map((section) => {
        const meta = SECTION_META[section];
        const Icon = meta.icon;
        return (
          <SidebarMenuItem key={section}>
            <SidebarMenuButton
              asChild
              isActive={section === activeSection}
              tooltip={meta.label}
            >
              <a
                href={operatorRouteHref({ section })}
                onClick={() => setOpenMobile(false)}
              >
                <Icon aria-hidden="true" />
                <span>{meta.label}</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        );
      })}
    </SidebarMenu>
  );
}

export function OperatorLoadingShell() {
  return (
    <div className="grid min-h-svh place-items-center bg-background px-6">
      <div className="flex max-w-sm items-center gap-3" role="status">
        <span className="flex size-9 items-center justify-center rounded-md bg-brand text-brand-foreground">
          <Orbit aria-hidden="true" className="size-5 animate-spin" />
        </span>
        <div>
          <p className="text-sm font-semibold">Ouroboros Operator</p>
          <p className="text-xs text-muted-foreground">Loading current runtime evidence</p>
        </div>
      </div>
    </div>
  );
}

export function OperatorUnavailableShell({ error }: { error: string }) {
  return (
    <div className="grid min-h-svh place-items-center bg-background px-6">
      <div className="w-full max-w-lg border-y py-8">
        <p className="text-sm font-semibold">Operator read model unavailable</p>
        <p className="mt-2 break-words text-sm text-muted-foreground [overflow-wrap:anywhere]">{error}</p>
        <p className="mt-4 text-xs text-muted-foreground">
          No healthy empty state is inferred without runtime evidence.
        </p>
      </div>
    </div>
  );
}
