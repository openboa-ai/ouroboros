import type { ModuleDefinition } from "./modules";
/** Agent modules are source artifacts compiled against this explicit public SDK. */
export function defineCompanyModule(definition: ModuleDefinition): ModuleDefinition {
 if(!/^[a-z][a-z0-9-]+$/.test(definition.id) || !definition.version)throw new Error("Invalid module identity.");
 if(definition.widgets.some(w=>!w.id.startsWith(`${definition.id}.`)))throw new Error("Widget IDs must belong to their module.");
 return Object.freeze(definition);
}
