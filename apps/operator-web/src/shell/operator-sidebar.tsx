import {
  ActivityIcon,
  BarChart3Icon,
  FlaskConicalIcon,
  ListChecksIcon,
  PanelLeftIcon,
  ShieldCheckIcon
} from "lucide-react";
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

export type OperatorView = "trading" | "arena" | "research" | "details";

export const OPERATOR_VIEWS: OperatorView[] = ["trading", "arena", "research", "details"];

export interface OperatorSidebarCandidate {
  candidateId: string;
  displayName: string;
}

interface OperatorNavigationItem {
  view: OperatorView;
  label: string;
  count?: string;
  icon: typeof ActivityIcon;
}

export function OperatorSidebar({
  activeView,
  candidates,
  loading,
  selectedCandidateId,
  selectedCandidateName,
  onSelectCandidate,
  onSelectView
}: {
  activeView: OperatorView;
  candidates: OperatorSidebarCandidate[];
  loading: boolean;
  selectedCandidateId?: string;
  selectedCandidateName?: string;
  onSelectCandidate: (candidateId: string) => void;
  onSelectView: (view: OperatorView) => void;
}) {
  const candidateCountLabel = loading ? "..." : String(candidates.length);
  const selectedName = loading ? "Loading workspace" : selectedCandidateName ?? "No Trading System selected";
  const navigationItems: OperatorNavigationItem[] = [
    { view: "trading", label: "Trading", count: "1", icon: ActivityIcon },
    { view: "arena", label: "Arena", count: candidateCountLabel, icon: BarChart3Icon },
    { view: "research", label: "Research", count: candidateCountLabel, icon: FlaskConicalIcon },
    { view: "details", label: "Details", icon: ListChecksIcon }
  ];

  return (
    <Sidebar data-operator-ui="operator-sidebar" collapsible="icon" variant="inset">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" isActive tooltip="Ouroboros">
              <ShieldCheckIcon />
              <span>Ouroboros</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Operator workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigationItems.map((item) => {
                const Icon = item.icon;
                return (
                  <SidebarMenuItem key={item.view}>
                    <SidebarMenuButton
                      isActive={activeView === item.view}
                      onClick={() => onSelectView(item.view)}
                      tooltip={item.label}
                    >
                      <Icon />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                    {item.count && <SidebarMenuBadge>{item.count}</SidebarMenuBadge>}
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Trading Systems</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {loading && (
                <>
                  <SidebarMenuItem>
                    <SidebarMenuSkeleton showIcon />
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuSkeleton showIcon />
                  </SidebarMenuItem>
                </>
              )}
              {!loading && candidates.map((candidate) => (
                <SidebarMenuItem key={candidate.candidateId}>
                  <SidebarMenuButton
                    isActive={selectedCandidateId === candidate.candidateId}
                    onClick={() => {
                      onSelectCandidate(candidate.candidateId);
                      onSelectView("arena");
                    }}
                    tooltip={candidate.displayName}
                  >
                    <BarChart3Icon />
                    <span title={candidate.displayName}>{candidate.displayName}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip={selectedName}>
              <PanelLeftIcon />
              <span>{selectedName}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
