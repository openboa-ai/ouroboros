import type { ViewProps } from "@/app/contracts";
import type { CompanyComposition, ModuleDefinition } from "@/contracts/modules";
import { EmptyState } from "@/ui/components/EmptyState";
import { ModuleBoundary } from "@/app/ModuleBoundary";
import "@/features/home/home.css";

/** Published page selection does not alter the owner's personal Home layout. */
export function CompanyPageScreen({ pageId, modules, composition, scope, ...view }: ViewProps & {
  pageId: string;
  modules: readonly ModuleDefinition[];
  composition?: CompanyComposition | null;
  scope: string;
}) {
  if (!composition || composition.companyId !== scope) return <EmptyState title="Company view unavailable" detail="No active company configuration is available for this company." />;
  const page = composition.pages.find(page => page.id === pageId);
  if (!page) return <EmptyState title="Page not in this revision" detail="This page is not part of the company's active configuration." />;
  const matches = modules.filter(module => module.id === page.module);
  const module = matches.length === 1 ? matches[0] : undefined;
  if (!module) return <EmptyState title="Company module unavailable" detail={`This page needs ${page.module}, which is not available in this app build. The published page reference is retained.`} />;
  if (page.screen) {
    const screens = module.pages.filter(screen => screen.id === page.screen);
    const Screen = screens.length === 1 ? screens[0].Screen : undefined;
    return Screen ? <ModuleBoundary key={`${composition.revision}:${page.id}`}><Screen {...view} /></ModuleBoundary> : <EmptyState title="Company screen unavailable" detail="The screen selected by this configuration is not included in the registered module." />;
  }
  return <div className="home-screen">
    <p className="type-meta muted">{module.name} · Configuration revision {composition.revision}</p>
    {!page.widgets.length && <EmptyState title="No widgets on this page" detail="This company page has no widgets in its active configuration." />}
    <div className="widget-grid">{page.widgets.map(instance => {
      const matches = module.widgets.filter(widget => widget.id === instance.widget);
      const definition = matches.length === 1 ? matches[0] : undefined;
      const Widget = definition?.sizes.includes(instance.size) ? definition.Component : undefined;
      return <section key={instance.id} className={`home-widget widget-${instance.size}`} aria-label={definition?.title ?? instance.widget}>
        <h2 className="type-section">{definition?.title ?? instance.widget}</h2>
        <ModuleBoundary key={`${composition.revision}:${instance.id}`}>
          {Widget ? <Widget {...view} /> : <EmptyState title="Widget unavailable" detail="This widget or its selected size is unavailable in the registered module. Its place is preserved." />}
        </ModuleBoundary>
      </section>;
    })}</div>
  </div>;
}
