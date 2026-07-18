export const OPERATOR_SECTIONS = [
  "arena",
  "research",
  "trading",
  "evidence",
  "system"
] as const;

export type OperatorSection = (typeof OPERATOR_SECTIONS)[number];

export interface OperatorRoute {
  section: OperatorSection;
  selectedId?: string;
}

const OPERATOR_SECTION_SET = new Set<string>(OPERATOR_SECTIONS);

export function parseOperatorRoute(hash: string): OperatorRoute {
  const normalized = hash.startsWith("#") ? hash.slice(1) : hash;
  const [pathname = "", query = ""] = normalized.split("?", 2);
  const candidateSection = pathname.replace(/^\/+/, "");
  const hasKnownSection = OPERATOR_SECTION_SET.has(candidateSection);
  const section = hasKnownSection
    ? candidateSection as OperatorSection
    : "arena";

  if (!hasKnownSection) {
    return { section };
  }

  if (section !== "arena" && section !== "research") {
    return { section };
  }

  const parameter = section === "arena" ? "system" : "session";
  const selectedId = new URLSearchParams(query).get(parameter)?.trim();
  return selectedId ? { section, selectedId } : { section };
}

export function operatorRouteHref(route: OperatorRoute): string {
  const base = `#/${route.section}`;
  if (!route.selectedId || (route.section !== "arena" && route.section !== "research")) {
    return base;
  }

  const query = new URLSearchParams();
  query.set(route.section === "arena" ? "system" : "session", route.selectedId);
  return `${base}?${query.toString()}`;
}
