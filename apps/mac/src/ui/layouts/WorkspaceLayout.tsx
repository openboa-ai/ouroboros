import type { ReactNode, CSSProperties } from "react";
import {
  Search,
  ShieldCheck,
  SlidersHorizontal,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/ui/primitives/button";
import { UnreadBadge } from "@/ui/components/UnreadBadge";
import { Avatar, AvatarFallback } from "@/ui/primitives/avatar";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "@/ui/primitives/sidebar";
export interface NavigationItem {
  id: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
}
export interface WorkspaceLayoutProps {
  company: string;
  owner: string;
  source: string;
  subtitle: string;
  items: readonly NavigationItem[];
  active: string;
  onNavigate: (id: string) => void;
  onSearch: () => void;
  onControls: () => void;
  onSettings: () => void;
  companyItems?: readonly NavigationItem[];
  title?: string;
  headerAccessory?: ReactNode;
  children: ReactNode;
  notice?: boolean;
  badges?: Readonly<Record<string, number>>;
}
/** UX: ../../../../../docs/design/UI_PURPOSE_CONTRACT.md#shell
 * Layout owns density, navigation and protected controls. Feature content has no control-slot API.
 */
export function WorkspaceLayout(p: WorkspaceLayoutProps) {
  return (
    <SidebarProvider
      className="product-shell"
      style={
        { "--sidebar-width": "var(--ob-layout-sidebar-width)" } as CSSProperties
      }
    >
      <Sidebar collapsible="none" className="product-sidebar">
        <SidebarHeader>
          <div className="brand">
            <img src="/brand/openboa-symbol-primary.svg" alt="OpenBoa" />
            <span className="type-section">Ouroboros</span>
          </div>
          <div className="company-identity" title={p.subtitle}>
            <span className="type-control">{p.company}</span>
            <span className="company-source type-meta muted">{p.source}</span>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <div className="navigation-group-label type-meta muted">Workspace</div>
          <SidebarMenu>
            {p.items.map((item) => (
              <SidebarMenuItem key={item.id}>
                <SidebarMenuButton
                  isActive={p.active === item.id}
                  onClick={() => p.onNavigate(item.id)}
                >
                  <item.icon />
                  <span>{item.label}</span>
                  <UnreadBadge count={p.badges?.[item.id] ?? item.badge} />
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
          <div className="navigation-group-label company-navigation-label type-meta muted">Company</div>
          <SidebarMenu>
            {p.companyItems?.map(item => <SidebarMenuItem key={item.id}><SidebarMenuButton isActive={p.active===item.id} onClick={()=>p.onNavigate(item.id)}><item.icon/><span>{item.label}</span><UnreadBadge count={p.badges?.[item.id] ?? item.badge}/></SidebarMenuButton></SidebarMenuItem>)}
          </SidebarMenu>
          {!p.companyItems?.length && <p className="navigation-empty type-meta muted">No company views published</p>}
        </SidebarContent>
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton onClick={p.onControls}>
                <ShieldCheck />
                <span>Owner controls</span>
                <UnreadBadge count={p.badges?.controls} />
                {p.notice && (
                  <span
                    className="control-notice"
                    aria-label="1 unconfirmed control"
                  >
                    1
                  </span>
                )}
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton onClick={p.onSettings} isActive={p.active.startsWith("settings/")}>
                <SlidersHorizontal />
                <span>Settings</span>
                <UnreadBadge count={p.badges?.settings} />
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
          <div className="owner-row">
            <Avatar size="sm">
              <AvatarFallback>{p.owner[0]}</AvatarFallback>
            </Avatar>
            <div>
              <span className="type-control">{p.owner}</span>
              <span className="type-meta muted">Owner</span>
            </div>
          </div>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset className="workspace">
        <header className="workspace-header">
          <h1 className="type-title">
            {p.title ?? p.items.find((x) => x.id === p.active)?.label}
          </h1>
          <div className="header-actions">
            {p.headerAccessory}
            <Button
              variant="ghost"
              size="icon"
              aria-label="Search company records"
              onClick={p.onSearch}
            >
              <Search />
            </Button>
          </div>
        </header>
        {p.children}
      </SidebarInset>
    </SidebarProvider>
  );
}
