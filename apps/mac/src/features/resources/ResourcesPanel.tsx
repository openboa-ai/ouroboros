import { useState } from "react";
import { Input } from "@/ui/primitives/input";
import { Tabs, TabsList, TabsTrigger } from "@/ui/primitives/tabs";
import { Button } from "@/ui/primitives/button";
import {
  Facts,
  RecordLink,
  Status,
  EmptyState,
} from "@/ui/components/patterns";
import { DetailSection } from "@/ui/components/DetailSection";
import type { InspectorProps } from "@/app/contracts";
import type { ResourceRecord } from "./model";
/** UX N-02/N-03: owner asks what is connected, what it serves and who retains its obligations. */
export function ResourcesPanel({
  target,
  open,
  records,
  scenario,
  updateDetail,
}: InspectorProps & { records: readonly ResourceRecord[] }) {
  const [category, setCategory] = useState(target.tab ?? "connection");
  const [query, setQuery] = useState(target.query ?? "");
  const selected = records.find((r) => r.id === target.id);
  if (target.id && !selected)
    return (
      <div className="inspector-content">
        <EmptyState
          title="Resource unavailable"
          detail="This exact record is not in the available source."
        />
      </div>
    );
  if (selected)
    return (
      <div className="inspector-content">
        <div className="detail-caption">
          <span className="type-section">{selected.name}</span>
          <Status>{selected.state}</Status>
        </div>
        <p className="type-body muted">{selected.purpose}</p>
        <Facts
          rows={[
            ["Responsible member", selected.owner],
            ["Observed", selected.observed],
            ...selected.facts,
          ]}
        />
        <DetailSection
          title={
            selected.category === "connection"
              ? "Connection lifecycle"
              : selected.category === "resource"
                ? "Resource lifecycle"
                : "Retention & publication"
          }
        >
          <div className="detail-records">
            {selected.stages.map((s) => (
              <div className="detail-caption" key={s.name}>
                <span className="type-data">{s.name}</span>
                <Status>{s.state}</Status>
              </div>
            ))}
          </div>
        </DetailSection>
        {selected.related && (
          <RecordLink
            title={selected.relatedLabel ?? "View related work"}
            onClick={() => open(selected.related!)}
          />
        )}
        <p className="type-meta muted">
          Local sample inventory. No credential or service is connected by this
          view.
        </p>
      </div>
    );
  const visible = records.filter(
    (r) =>
      r.category === category &&
      `${r.name} ${r.purpose} ${r.owner}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  return (
    <div className="inspector-content">
      <Tabs
        value={category}
        onValueChange={(value) => {
          setCategory(value);
          updateDetail?.({ tab: value });
        }}
      >
        <TabsList aria-label="Resource categories">
          <TabsTrigger value="connection">Connections</TabsTrigger>
          <TabsTrigger value="resource">Resources</TabsTrigger>
          <TabsTrigger value="storage">Storage</TabsTrigger>
        </TabsList>
      </Tabs>
      <Input
        aria-label="Find connection or resource"
        placeholder="Service, purpose, or member"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          updateDetail?.({ query: e.target.value });
        }}
      />
      <div className="type-meta muted">
        {visible.length} {visible.length === 1 ? "record" : "records"} · sample
        inventory
        {scenario === "delayed" ? " · observation delayed" : ""}
      </div>
      <div className="detail-records">
        {visible.map((r) => (
          <RecordLink
            key={r.id}
            variant="row"
            title={r.name}
            meta={`${r.purpose} · ${r.owner}`}
            trailing={<Status>{r.state}</Status>}
            onClick={() => open({ kind: "connections", id: r.id })}
          />
        ))}
      </div>
      {!visible.length && (
        <EmptyState
          title="No matching resources"
          detail="Try a service name or responsible member."
          action={
            <Button
              variant="secondary"
              onClick={() => {
                setQuery("");
                updateDetail?.({ query: "" });
              }}
            >
              Clear search
            </Button>
          }
        />
      )}
    </div>
  );
}
