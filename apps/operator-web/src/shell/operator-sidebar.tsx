import {
  ActivityIcon,
  BarChart3Icon,
  FlaskConicalIcon,
  ListChecksIcon,
  PanelLeftIcon,
  ShieldCheckIcon
} from "lucide-react";
import {
  OperatorSidebarContent,
  OperatorSidebarFooter,
  OperatorSidebarFrame,
  OperatorSidebarGroup,
  OperatorSidebarGroupContent,
  OperatorSidebarGroupLabel,
  OperatorSidebarHeader,
  OperatorSidebarMenu,
  OperatorSidebarMenuBadge,
  OperatorSidebarMenuButton,
  OperatorSidebarMenuItem,
  OperatorSidebarMenuSkeleton,
  OperatorSidebarRail
} from "@/design-system";

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
    <OperatorSidebarFrame data-operator-ui="operator-sidebar" collapsible="icon" variant="inset">
      <OperatorSidebarHeader>
        <OperatorSidebarMenu>
          <OperatorSidebarMenuItem>
            <OperatorSidebarMenuButton size="lg" isActive tooltip="Ouroboros">
              <ShieldCheckIcon />
              <span>Ouroboros</span>
            </OperatorSidebarMenuButton>
          </OperatorSidebarMenuItem>
        </OperatorSidebarMenu>
      </OperatorSidebarHeader>
      <OperatorSidebarContent>
        <OperatorSidebarGroup>
          <OperatorSidebarGroupLabel>Operator workspace</OperatorSidebarGroupLabel>
          <OperatorSidebarGroupContent>
            <OperatorSidebarMenu>
              {navigationItems.map((item) => {
                const Icon = item.icon;
                return (
                  <OperatorSidebarMenuItem key={item.view}>
                    <OperatorSidebarMenuButton
                      isActive={activeView === item.view}
                      onClick={() => onSelectView(item.view)}
                      tooltip={item.label}
                    >
                      <Icon />
                      <span>{item.label}</span>
                    </OperatorSidebarMenuButton>
                    {item.count && <OperatorSidebarMenuBadge>{item.count}</OperatorSidebarMenuBadge>}
                  </OperatorSidebarMenuItem>
                );
              })}
            </OperatorSidebarMenu>
          </OperatorSidebarGroupContent>
        </OperatorSidebarGroup>

        <OperatorSidebarGroup>
          <OperatorSidebarGroupLabel>Trading Systems</OperatorSidebarGroupLabel>
          <OperatorSidebarGroupContent>
            <OperatorSidebarMenu>
              {loading && (
                <>
                  <OperatorSidebarMenuItem>
                    <OperatorSidebarMenuSkeleton showIcon />
                  </OperatorSidebarMenuItem>
                  <OperatorSidebarMenuItem>
                    <OperatorSidebarMenuSkeleton showIcon />
                  </OperatorSidebarMenuItem>
                </>
              )}
              {!loading && candidates.map((candidate) => (
                <OperatorSidebarMenuItem key={candidate.candidateId}>
                  <OperatorSidebarMenuButton
                    isActive={selectedCandidateId === candidate.candidateId}
                    onClick={() => {
                      onSelectCandidate(candidate.candidateId);
                      onSelectView("arena");
                    }}
                    tooltip={candidate.displayName}
                  >
                    <BarChart3Icon />
                    <span title={candidate.displayName}>{candidate.displayName}</span>
                  </OperatorSidebarMenuButton>
                </OperatorSidebarMenuItem>
              ))}
            </OperatorSidebarMenu>
          </OperatorSidebarGroupContent>
        </OperatorSidebarGroup>
      </OperatorSidebarContent>
      <OperatorSidebarFooter>
        <OperatorSidebarMenu>
          <OperatorSidebarMenuItem>
            <OperatorSidebarMenuButton tooltip={selectedName}>
              <PanelLeftIcon />
              <span>{selectedName}</span>
            </OperatorSidebarMenuButton>
          </OperatorSidebarMenuItem>
        </OperatorSidebarMenu>
      </OperatorSidebarFooter>
      <OperatorSidebarRail />
    </OperatorSidebarFrame>
  );
}
