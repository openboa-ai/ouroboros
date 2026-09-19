import { describe, expect, it } from "vitest";
import { companyPageEntries, readCompanyComposition, validateComposition, type CompanyComposition, type ModuleDefinition } from "./modules";

const Empty = () => null;
const modules: ModuleDefinition[] = [{ id: "research", version: "1", name: "Research", widgets: [{ id: "research.results", title: "Results", description: "Published results", provider: "Research", sizes: ["small", "wide"], Component: Empty }], pages: [{ id: "briefing", title: "Briefing", Screen: Empty }] }];
const configuration = (): CompanyComposition => ({ schemaVersion: 1, companyId: "company-a", revision: 3, author: "Atlas", pages: [{ id: "weekly", title: "Weekly research", module: "research", widgets: [{ id: "result-1", widget: "research.results", size: "wide" }] }], publication: { workspace: "company-ui", revision: 12, path: "views/company-ui.json", executionId: "execution-a" } });

describe("company presentation configuration", () => {
  it("preserves the published selection, ordering and size without using module defaults", () => {
    const source = configuration();
    const parsed = validateComposition(source, "company-a", modules);
    expect(parsed.pages[0]).toEqual(source.pages[0]);
    expect(parsed.pages[0].id).not.toBe(modules[0].pages[0].id);
    parsed.pages[0].widgets[0].size = "small";
    expect(source.pages[0].widgets[0].size).toBe("wide");
  });
  it("rejects a different company and a malformed or unsafe revision", () => {
    expect(() => validateComposition(configuration(), "company-b", modules)).toThrow(/identity/);
    for (const revision of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, "3"]) expect(() => validateComposition({ ...configuration(), revision }, "company-a", modules)).toThrow(/revision/);
  });
  it("rejects unknown operational fields rather than importing authority or Home preferences", () => {
    for (const extra of [{ permissions: ["trade"] }, { home: [] }, { required: true }, { code: "alert(1)" }]) expect(() => validateComposition({ ...configuration(), ...extra }, "company-a", modules)).toThrow(/unsupported fields/);
    const source = configuration();
    expect(() => validateComposition({ ...source, pages: [{ ...source.pages[0], url: "https://example.invalid" }] }, "company-a", modules)).toThrow(/unsupported fields/);
  });
  it("rejects malformed records without leaking native property errors", () => {
    for (const value of [null, [], "configuration", { ...configuration(), pages: [null] }, { ...configuration(), pages: [{ ...configuration().pages[0], widgets: [null] }] }]) expect(() => validateComposition(value, "company-a", modules)).toThrow();
  });
  it("rejects blank labels, duplicate or reserved routes and traversal", () => {
    const source = configuration();
    for (const id of ["home", "system", "settings", "../controls", "company/other", ""]) expect(() => validateComposition({ ...source, pages: [{ ...source.pages[0], id }] }, "company-a", modules)).toThrow(/identity/);
    expect(() => validateComposition({ ...source, pages: [source.pages[0], source.pages[0]] }, "company-a", modules)).toThrow(/duplicated/);
    expect(() => validateComposition({ ...source, pages: [{ ...source.pages[0], title: " " }] }, "company-a", modules)).toThrow(/Page title/);
  });
  it("validates instance IDs, namespace, size and uniqueness", () => {
    const source = configuration();
    const page = source.pages[0];
    const widget = page.widgets[0];
    const invalid = [{ ...widget, id: "" }, { ...widget, id: "../result" }, { ...widget, widget: "finance.results" }, { ...widget, widget: "research.unknown" }, { ...widget, size: "medium" }, { ...widget, size: "huge" }];
    for (const instance of invalid) expect(() => validateComposition({ ...source, pages: [{ ...page, widgets: [instance] }] }, "company-a", modules)).toThrow();
    expect(() => validateComposition({ ...source, pages: [{ ...page, widgets: [widget, widget] }] }, "company-a", modules)).toThrow(/duplicated/);
  });
  it("keeps missing-module published references inspectable but rejects their import as compatible", () => {
    expect(readCompanyComposition(configuration(), "company-a").pages).toHaveLength(1);
    expect(() => validateComposition(configuration(), "company-a", [])).toThrow(/unavailable/);
    expect(() => validateComposition(configuration(), "company-a", [...modules, modules[0]])).toThrow(/more than once/);
  });
  it("requires an explicit registered executable screen and rejects silently ignored widgets", () => {
    const source = configuration();
    const page = { ...source.pages[0], screen: "briefing", widgets: [] };
    expect(validateComposition({ ...source, pages: [page] }, "company-a", modules).pages[0].screen).toBe("briefing");
    expect(() => validateComposition({ ...source, pages: [{ ...page, screen: "missing" }] }, "company-a", modules)).toThrow(/Screen/);
    expect(() => validateComposition({ ...source, pages: [{ ...page, widgets: source.pages[0].widgets }] }, "company-a", modules)).toThrow(/not both/);
    expect(() => validateComposition({ ...source, pages: [page] }, "company-a", [{ ...modules[0], pages: [{ id: "briefing", title: "Briefing" }] }])).toThrow(/Screen/);
  });
  it("enforces bounded page and widget counts", () => {
    const source = configuration();
    expect(() => validateComposition({ ...source, pages: Array.from({ length: 25 }, (_, i) => ({ ...source.pages[0], id: `page-${i}` })) }, "company-a", modules)).toThrow(/24/);
    expect(() => validateComposition({ ...source, pages: [{ ...source.pages[0], widgets: Array.from({ length: 17 }, (_, i) => ({ ...source.pages[0].widgets[0], id: `widget-${i}` })) }] }, "company-a", modules)).toThrow(/16/);
  });
  it("preserves exact publication revision and rejects unsafe file references", () => {
    const source = configuration();
    expect(validateComposition(source, "company-a", modules).publication?.revision).toBe(12);
    for (const path of ["../company-ui.json", "/company-ui.json", "views//company-ui.json", "views/./company-ui.json", "views\\company-ui.json", "https://example.invalid/file.json"]) expect(() => validateComposition({ ...source, publication: { ...source.publication, path } }, "company-a", modules)).toThrow(/relative file/);
  });
  it("derives company navigation only from the active composition", () => {
    expect(companyPageEntries(null)).toEqual([]);
    expect(companyPageEntries(configuration())).toEqual([{ id: "company/weekly", label: "Weekly research" }]);
    expect(companyPageEntries({ ...configuration(), pages: [] })).toEqual([]);
  });
});
