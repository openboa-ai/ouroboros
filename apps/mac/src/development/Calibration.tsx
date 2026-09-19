import { useState } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/ui/primitives/tabs";
import { TooltipProvider } from "@/ui/primitives/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/ui/primitives/select";
import { ThemeToggle } from "@/ui/components/ThemeToggle";
import { ComponentSpec } from "./ComponentSpec";
import typography from "@/ui/tokens/typography.json";
import { SampleWorkspace as ProductScreen } from "./SampleWorkspace";
import type { Scenario } from "@/app/contracts";
const scenarios = [
  { value: "observed", label: "Observed" },
  { value: "delayed", label: "Delayed data" },
  { value: "uncertain", label: "Unconfirmed order" },
  { value: "restricted", label: "Restricted account" },
  { value: "empty", label: "Empty company" },
];
// UX: ../../../../docs/design/UI_PURPOSE_CONTRACT.md#c-01 — development reference for the complete role recipes.
function TypeSpec() {
  return (
    <main className="spec-page">
      <div className="spec-heading">
        <span className="type-meta muted">Design system</span>
        <h1 className="type-title">Typography</h1>
        <p className="type-data muted">
          Complete OpenBoa roles, consistent across every composition.
        </p>
      </div>
      <div className="type-spec-list">
        {Object.entries(typography).map(([role, entry]) => (
          <div className="type-spec-row" key={role}>
            <div>
              <div className="type-control">{role}</div>
              <div className="type-meta muted">
                {entry.size}px / {entry.lineHeightPx}px · {entry.weight}
              </div>
            </div>
            <div className={`type-${role}`} data-type={role}>
              A clear view of your capital{" "}
              <span className="tabular-nums">113,650.00</span>
            </div>
          </div>
        ))}
      </div>
      <p className="type-meta muted">
        Martian Grotesk · Tabular figures · OpenBoa 2026.08.23
      </p>
    </main>
  );
}

// UX: ../../../../docs/design/UI_PURPOSE_CONTRACT.md#s-10 — explicit development controls, not product navigation.
export function App() {
  const [view, setView] = useState("screen");
  const [scenario, setScenario] = useState<Scenario>("observed");
  return (
    <TooltipProvider>
      <div className="calibration-workspace">
        <div className="calibration-toolbar">
          <span className="type-meta muted">
            Ouroboros <span className="toolbar-divider">/</span> Design preview{" "}
            <span className="revision-tag">03</span>
          </span>
          <div className="calibration-tools">
            <Select
              value={scenario}
              onValueChange={(v) => v && setScenario(v as Scenario)}
              items={scenarios}
            >
              <SelectTrigger aria-label="Preview data state">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {scenarios.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Tabs value={view} onValueChange={setView}>
              <TabsList aria-label="Design preview views">
                <TabsTrigger value="screen">App</TabsTrigger>
                <TabsTrigger value="components">Components</TabsTrigger>
                <TabsTrigger value="type">Typography</TabsTrigger>
              </TabsList>
            </Tabs>
            <ThemeToggle />
          </div>
        </div>
        <div hidden={view !== "screen"}>
          <ProductScreen scenario={scenario} />
        </div>
        {view === "components" && <ComponentSpec />}
        {view === "type" && <TypeSpec />}
      </div>
    </TooltipProvider>
  );
}
export default App;
