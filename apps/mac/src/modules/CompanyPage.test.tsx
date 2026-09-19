import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { CompanyComposition, ModuleDefinition } from "@/contracts/modules";
import { CompanyPageScreen } from "./CompanyPage";

const modules: ModuleDefinition[] = [{ id: "research", version: "1", name: "Research", pages: [{ id: "full", title: "Full research screen", Screen: () => <span>Screen evidence</span> }], widgets: [
  { id: "research.first", title: "First widget", description: "", provider: "Research", sizes: ["small"], Component: () => <span>First evidence</span> },
  { id: "research.second", title: "Second widget", description: "", provider: "Research", sizes: ["wide"], Component: () => <span>Second evidence</span> },
] }];
const composition: CompanyComposition = { schemaVersion: 1, companyId: "company-a", revision: 3, author: "Atlas", pages: [{ id: "chosen", title: "Chosen view", module: "research", widgets: [{ id: "second", widget: "research.second", size: "wide" }] }] };
const view = { scenario: "observed" as const, open: () => undefined, discuss: () => undefined };
function render(current: CompanyComposition | null = composition, registry = modules) {
  return renderToStaticMarkup(<CompanyPageScreen {...view} scope="company-a" pageId="chosen" composition={current} modules={registry} />);
}
describe("published company page rendering", () => {
  it("renders only the selected instances at their selected sizes", () => {
    const html = render();
    expect(html).toContain("Second evidence");
    expect(html).toContain("widget-wide");
    expect(html).not.toContain("First evidence");
    expect(html).not.toContain("Screen evidence");
  });
  it("does not infer a page from compiled module inventory when configuration is absent", () => {
    expect(render(null)).toContain("Company view unavailable");
    expect(render({ ...composition, pages: [] })).toContain("Page not in this revision");
    expect(render({ ...composition, companyId: "other" })).toContain("Company view unavailable");
  });
  it("keeps explicit unavailable states for missing modules and widgets", () => {
    expect(render(composition, [])).toContain("Company module unavailable");
    expect(render(composition, [{ ...modules[0], widgets: [] }])).toContain("Widget unavailable");
    expect(render(composition, [{ ...modules[0], widgets: [] }])).toContain("widget-wide");
  });
  it("renders a compiled screen only when the active composition explicitly selects it", () => {
    expect(render({ ...composition, pages: [{ ...composition.pages[0], screen: "full", widgets: [] }] })).toContain("Screen evidence");
    expect(render({ ...composition, pages: [{ ...composition.pages[0], screen: "missing", widgets: [] }] })).toContain("Company screen unavailable");
  });
});
