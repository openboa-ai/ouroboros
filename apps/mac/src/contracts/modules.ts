import type { ComponentType } from "react";
import type { ViewProps } from "@/app/contracts";

export type WidgetSize = "small" | "medium" | "wide";
export interface WidgetDefinition {
  id: string;
  title: string;
  description: string;
  provider: string;
  sizes: readonly WidgetSize[];
  Component: ComponentType<ViewProps>;
}
export interface WidgetInstance { id: string; widget: string; size: WidgetSize; }
export interface CompanyPage {
  id: string;
  title: string;
  module: string;
  /** Optional compiled screen; otherwise this page renders only its selected widgets. */
  screen?: string;
  widgets: WidgetInstance[];
}
export interface CompanyComposition {
  schemaVersion: 1 | 2;
  packages?: {id:string;path:string;revision:number;sha256:string}[];
  companyId: string;
  revision: number;
  author: string;
  pages: CompanyPage[];
  /** A reference, not proof of publication or activation when imported from a local file. */
  publication?: { workspace: string; revision: number; path: string; executionId: string };
}
export interface ModuleDefinition {
  id: string;
  version: string;
  name: string;
  widgets: readonly WidgetDefinition[];
  pages: readonly { id: string; title: string; Screen?: ComponentType<ViewProps> }[];
}

const identifier = /^[a-z][a-z0-9-]{0,63}$/;
const instanceIdentifier = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/;
const widgetIdentifier = /^[a-z][a-z0-9-]{0,63}\.[a-z][a-z0-9.-]{0,127}$/;
const forbiddenPageIds = new Set(["home", "work", "agents", "system", "conversations", "library", "settings", "controls", "notifications"]);
function object(value: unknown, allowed: readonly string[], label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(value)) ||
      Object.keys(value).some(key => !allowed.includes(key))) {
    throw new Error(`${label} has an invalid structure or unsupported fields.`);
  }
  return value as Record<string, unknown>;
}
function text(value: unknown, max: number, label: string): string {
  if (typeof value !== "string" || !value.trim() || value.length > max || Array.from(value).some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)) {
    throw new Error(`${label} must be nonempty text of at most ${max} characters.`);
  }
  return value;
}
function revision(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1) throw new Error(`${label} must be a positive revision.`);
  return value;
}

/** Validates stored configuration without claiming its referenced modules are installed. */
export function readCompanyComposition(value: unknown, company: string): CompanyComposition {
  const c = object(value, ["schemaVersion", "companyId", "revision", "author", "pages", "publication", "packages"], "Company configuration");
  if ((c.schemaVersion !== 1 && c.schemaVersion !== 2) || c.companyId !== company || !company.trim()) throw new Error("Company identity or schema version does not match.");
  if (!Array.isArray(c.pages) || c.pages.length > 24) throw new Error("Company configuration supports at most 24 pages.");
  const pageIds = new Set<string>();
  const pages: CompanyPage[] = c.pages.map(value => {
    const p = object(value, ["id", "title", "module", "screen", "widgets"], "Company page");
    if (typeof p.id !== "string" || !identifier.test(p.id) || forbiddenPageIds.has(p.id) || pageIds.has(p.id)) throw new Error("Company page identity is invalid, duplicated, or reserved by the app.");
    if (typeof p.module !== "string" || !identifier.test(p.module)) throw new Error("Company page module identity is invalid.");
    if (!Array.isArray(p.widgets) || p.widgets.length > 16) throw new Error("A company page supports at most 16 widgets.");
    pageIds.add(p.id);
    const instances = new Set<string>();
    const widgets: WidgetInstance[] = p.widgets.map(value => {
      const i = object(value, ["id", "widget", "size"], "Widget instance");
      if (typeof i.id !== "string" || !instanceIdentifier.test(i.id) || instances.has(i.id)) throw new Error("Widget instance identity is invalid or duplicated.");
      if (typeof i.widget !== "string" || !widgetIdentifier.test(i.widget) || !i.widget.startsWith(`${p.module}.`)) throw new Error("Widget identity must belong to its page module.");
      if (i.size !== "small" && i.size !== "medium" && i.size !== "wide") throw new Error("Widget size is invalid.");
      instances.add(i.id);
      return { id: i.id, widget: i.widget, size: i.size };
    });
    let screen: string | undefined;
    if (p.screen !== undefined) {
      if (typeof p.screen !== "string" || !identifier.test(p.screen)) throw new Error("Screen identity is invalid.");
      if (widgets.length) throw new Error("Choose a compiled screen or widget composition for a page, not both.");
      screen = p.screen;
    }
    return { id: p.id, title: text(p.title, 60, "Page title"), module: p.module, ...(screen ? { screen } : {}), widgets };
  });
  const result: CompanyComposition = { schemaVersion: c.schemaVersion, companyId: company, revision: revision(c.revision, "Company configuration revision"), author: text(c.author, 120, "Author"), pages };
  if(c.packages!==undefined){
    if(c.schemaVersion!==2||!Array.isArray(c.packages)||c.packages.length>24)throw new Error("Company packages require schema 2.");
    const ids=new Set<string>();
    result.packages=c.packages.map(value=>{
      const p=object(value,["id","path","revision","sha256"],"Package reference");
      if(typeof p.id!=="string"||!identifier.test(p.id)||ids.has(p.id))throw new Error("Invalid package identity");
      const path=text(p.path,512,"Package path");
      if(path.startsWith("/")||path.includes("\\")||path.includes(":")||path.split("/").some(x=>!x||x==="."||x==="..")||typeof p.sha256!=="string"||!/^[a-f0-9]{64}$/.test(p.sha256))throw new Error("Invalid package reference");
      ids.add(p.id);return {id:p.id,path,revision:revision(p.revision,"Package revision"),sha256:p.sha256};
    });
  }
  if (c.publication !== undefined) {
    const p = object(c.publication, ["workspace", "revision", "path", "executionId"], "Publication reference");
    const path = text(p.path, 512, "Publication path");
    if (path.startsWith("/") || path.includes("\\") || path.includes(":") || path.split("/").some(part => !part || part === "." || part === "..")) throw new Error("Publication path must be a relative file path.");
    result.publication = { workspace: text(p.workspace, 128, "Publication workspace"), revision: revision(p.revision, "Publication revision"), path, executionId: text(p.executionId, 128, "Publication execution") };
  }
  return result;
}

/** Compatibility checks select compiled definitions; they never install code or activate configuration. */
export function validateComposition(value: unknown, company: string, modules: readonly ModuleDefinition[]): CompanyComposition {
  const composition = readCompanyComposition(value, company);
  for (const page of composition.pages) {
    const matches = modules.filter(module => module.id === page.module);
    if (matches.length !== 1) throw new Error(`Module ${page.module} is unavailable or registered more than once.`);
    const module = matches[0];
    if (page.screen) {
      const matches = module.pages.filter(screen => screen.id === page.screen);
      if (matches.length !== 1 || !matches[0].Screen) throw new Error(`Screen ${page.screen} is unavailable in ${module.name}.`);
    }
    for (const instance of page.widgets) {
      const matches = module.widgets.filter(widget => widget.id === instance.widget);
      if (matches.length !== 1 || !matches[0].sizes.includes(instance.size)) throw new Error(`Widget ${instance.widget} or its selected size is unavailable in ${module.name}.`);
    }
  }
  return composition;
}

/** Navigation comes from the active, published configuration, never the executable module inventory. */
export function companyPageEntries(composition: CompanyComposition | null | undefined) {
  return composition?.pages.map(page => ({ id: `company/${page.id}`, label: page.title })) ?? [];
}
