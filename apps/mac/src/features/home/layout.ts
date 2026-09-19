import type { WidgetDefinition, WidgetInstance } from "@/contracts/modules";
export function readLayout(raw: string | null, defaults: WidgetInstance[]): WidgetInstance[] {
  if (!raw) return defaults;
  try {
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data) || data.length > 24) return defaults;
    const ids = new Set();
    for (const i of data) {
      if (!i || typeof i.id !== "string" || typeof i.widget !== "string" || !["small", "medium", "wide"].includes(i.size) || ids.has(i.id)) return defaults;
      ids.add(i.id);
    }
    return data;
  } catch { return defaults; }
}
export function moveWidget(items: WidgetInstance[], id: string, by: number) {
  const next = [...items], index = next.findIndex(x => x.id === id);
  if (index < 0 || index + by < 0 || index + by >= next.length) return next;
  [next[index], next[index + by]] = [next[index + by], next[index]];
  return next;
}
export function defaultLayout(widgets: readonly WidgetDefinition[]): WidgetInstance[] {
  return widgets.slice(0,6).map((w, i) => ({id: `default-${w.id}`, widget:w.id, size:w.sizes.includes("medium") && i < 2 ? "medium" : w.sizes[0]}));
}
