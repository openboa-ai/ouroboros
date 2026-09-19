import type { CompanyComposition, ModuleDefinition } from "@/contracts/modules";
import { EmptyState, Facts, Status } from "@/ui/components/patterns";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/ui/primitives/table";
import "@/features/home/home.css";

interface ModuleInventoryProps {
  modules: readonly ModuleDefinition[];
  scope: string;
  error?: string;
  current?: CompanyComposition | null;
  configurationLabel?: string;
}

/** UX: ../../../../docs/design/UI_PURPOSE_CONTRACT.md#n-10
 * Build metadata and configuration references only; this screen never renders or activates module code.
 */
export function ModuleInventory({ modules, scope, current, error, configurationLabel = "Company configuration" }: ModuleInventoryProps) {
  const active = current?.companyId === scope ? current : null;

  return <div className="home-screen settings-page">
    <div>
      <h2 className="type-section">Verified company packages</h2>
      <p className="type-meta muted">{active ? configurationLabel + " · Revision " + active.revision : "Current company usage is not observed"}</p>
    </div>
    {error && <p role="alert" className="type-data">{error}</p>}
    {!modules.length && <EmptyState title="No packages verified" detail="Publish a company package and reference its revision in Company configuration." />}
    {modules.map(module => {
      const pages = active?.pages.filter(page => page.module === module.id);
      const usage = !pages ? "Usage not observed" : pages.length ? "Selected by company pages" : "Not selected by company pages";
      return <section key={module.id} className="home-widget" aria-label={module.name + " module"}>
        <div className="home-toolbar">
          <h2 className="type-section">{module.name}</h2>
          <span className="type-meta muted">Version {module.version}</span>
        </div>
        <Facts rows={[
          ["Company use", <Status key="usage">{usage}</Status>],
          ...(pages?.length ? [["Selected pages", pages.map(page => page.title).join(", ")] as [string, string]] : []),
        ]} />
        {module.pages.length || module.widgets.length ? <Table aria-label={module.name + " definitions"}>
          <TableHeader><TableRow><TableHead>Definition</TableHead><TableHead>Kind</TableHead><TableHead>Supported format</TableHead></TableRow></TableHeader>
          <TableBody>
            {module.pages.map(page => <TableRow key={"page:" + page.id}>
              <TableCell><span className="type-data">{page.title}</span></TableCell>
              <TableCell><span className="type-data">{page.Screen ? "Screen" : "Page"}</span></TableCell>
              <TableCell><span className="type-data">{page.Screen ? "Compiled screen" : "Widget composition"}</span></TableCell>
            </TableRow>)}
            {module.widgets.map(widget => <TableRow key={"widget:" + widget.id}>
              <TableCell><div className="record-copy"><span className="type-data">{widget.title}</span>{widget.description && <span className="type-meta muted">{widget.description}</span>}</div></TableCell>
              <TableCell><span className="type-data">Widget</span></TableCell>
              <TableCell><span className="type-data">{widget.sizes.map(size => size[0].toUpperCase() + size.slice(1)).join(" / ")}</span></TableCell>
            </TableRow>)}
          </TableBody>
        </Table> : <p className="type-data muted">No screen or widget definitions in this package.</p>}
      </section>;
    })}
  </div>;
}
