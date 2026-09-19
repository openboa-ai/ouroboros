import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { CompanyComposition, ModuleDefinition } from "@/contracts/modules";
import { ModuleInventory } from "./ModuleInventory";
import { ModuleSettings } from "./ModuleSettings";

const modules: ModuleDefinition[] = [{
  id: "research", version: "2.4", name: "Research",
  pages: [{ id: "review", title: "Research review", Screen: () => { throw new Error("Inventory must not execute module code"); } }],
  widgets: [{ id: "research.summary", title: "Research summary", description: "Retained evidence", provider: "Research", sizes: ["small", "wide"], Component: () => { throw new Error("Inventory must not execute widget code"); } }],
}];
const composition: CompanyComposition = {
  schemaVersion: 1, companyId: "company-a", revision: 4, author: "Atlas",
  pages: [{ id: "review", title: "Owner research view", module: "research", screen: "review", widgets: [] }],
};
function render(current?: CompanyComposition | null, registry = modules) {
  return renderToStaticMarkup(<ModuleInventory modules={registry} scope="company-a" current={current} />);
}
describe("separate module inventory and company configuration", () => {
  it("shows build definitions and company references without executing modules or offering activation", () => {
    const html = render(composition);
    for (const text of ["Version 2.4", "Research review", "Research summary", "Small / Wide", "Selected by company pages", "Owner research view"]) expect(html).toContain(text);
    for (const text of ["Import configuration", "Choose file", "Activate configuration", "<input", "<button"]) expect(html).not.toContain(text);
  });
  it("distinguishes known non-use from missing configuration", () => {
    expect(render({ ...composition, pages: [] })).toContain("Not selected by company pages");
    expect(render(null)).toContain("Usage not observed");
    expect(render(null)).not.toContain("Not selected by company pages");
  });
  it("never exposes another company's page names as current usage", () => {
    const html = render({ ...composition, companyId: "other-company" });
    expect(html).toContain("Usage not observed");
    expect(html).not.toContain("Owner research view");
  });
  it("keeps an empty build inventory explicit", () => {
    expect(render(composition, [])).toContain("No packages verified");
  });
  it("keeps import in Company without copying the build inventory there", () => {
    const html = renderToStaticMarkup(<ModuleSettings modules={modules} scope="company-a" current={composition} scenario="observed" open={() => undefined} discuss={() => undefined} />);
    expect(html).toContain("Import configuration");
    expect(html).toContain("Choose file");
    expect(html).not.toContain("Available modules");
    expect(html).not.toContain("Research summary");
  });
});
