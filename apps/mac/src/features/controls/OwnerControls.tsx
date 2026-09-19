import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/ui/primitives/tabs";
import { Button } from "@/ui/primitives/button";
import {
  Facts,
  Status,
  RecordLink,
  EmptyState,
} from "@/ui/components/patterns";
import { DetailSection } from "@/ui/components/DetailSection";
import { ActivityTimeline } from "@/ui/components/ActivityTimeline";
import type { InspectorProps } from "@/app/contracts";
import type { ControlOption } from "./model";
/** UX T-01–T-06: distinct exact-scope controls, review before any effect, receipts independent of requests. */
export function OwnerControls({
  target,
  open,
  scenario,
  options,
}: InspectorProps & { options: readonly ControlOption[] }) {
  const [reviewed, setReviewed] = useState(false);
  const selected = options.find(
    (x) => x.id === target.id || x.target === target.id,
  );
  if (target.id && !selected)
    return (
      <div className="inspector-content">
        <EmptyState
          title="Control target unavailable"
          detail="No control was selected for a different target."
        />
      </div>
    );
  if (selected)
    return (
      <div className="inspector-content">
        <div className="detail-caption">
          <span className="type-section">{selected.title}</span>
          <Status>Preview only</Status>
        </div>
        <p className="type-body muted">{selected.scope}</p>
        <DetailSection title="Exact scope">
          <Facts
            rows={[
              ["Target", selected.target],
              ["Version", selected.revision],
              ["Authority required", selected.authority],
              ["Current observation", selected.before],
              ["Requested outcome", selected.after],
            ]}
          />
        </DetailSection>
        <DetailSection title="Remaining obligations">
          <p className="type-body">{selected.remains}</p>
        </DetailSection>
        <div className="detail-choice">
          <Button variant="secondary" onClick={() => setReviewed(true)}>
            Review this scope
          </Button>
          {reviewed && (
            <div role="status" className="detail-note type-data">
              Scope reviewed locally. No request was submitted. Connect a
              verified company environment to apply a control.
            </div>
          )}
          <Button disabled>Submit unavailable in sample company</Button>
        </div>
        <RecordLink
          title="Inspect required connection"
          onClick={() => open({ kind: "connections" })}
        />
      </div>
    );
  return (
    <div className="inspector-content">
      <div className="detail-caption">
        <ShieldCheck size={20} />
        <Status>
          {scenario === "restricted" ? "Authority limited" : "Sample authority"}
        </Status>
      </div>
      <Tabs defaultValue={target.tab === "requests" ? "history" : "actions"}>
        <TabsList aria-label="Owner control views">
          <TabsTrigger value="actions">Controls</TabsTrigger>
          <TabsTrigger value="delegation">Delegation</TabsTrigger>
          <TabsTrigger value="history">Requests</TabsTrigger>
        </TabsList>
        <TabsContent value="actions">
          <div className="control-groups">
            {["Investment", "Control plane"].map((domain) => (
              <section
                className="control-group"
                key={domain}
                aria-label={domain}
              >
                <h3 className="type-meta muted">{domain}</h3>
                {options
                  .filter(
                    (x) =>
                      x.domain === domain &&
                      (scenario !== "empty" || x.id === "shutdown"),
                  )
                  .map((x) => (
                    <RecordLink
                      key={x.id}
                      variant="row"
                      title={x.title}
                      meta={x.scope}
                      onClick={() => open({ kind: "controls", id: x.id })}
                    />
                  ))}
              </section>
            ))}
          </div>
        </TabsContent>
        <TabsContent value="delegation">
          <DetailSection title="Operating responsibility">
            <Facts
              rows={[
                ["Responsible member", "Not observed"],
                ["Assignment", "Version 3 · sample"],
                ["Purpose", "Operate within recorded company delegation"],
                ["Financial limits", "Not configured for live operation"],
                ["Authority source", "No live authority connected"],
              ]}
            />
            <p className="type-data muted">
              Everyday work within an existing delegation does not require a new
              owner decision.
            </p>
          </DetailSection>
          <RecordLink
            title="Review authority withdrawal"
            onClick={() => open({ kind: "controls", id: "revoke" })}
          />
        </TabsContent>
        <TabsContent value="history">
          {scenario === "uncertain" ? (
            <ActivityTimeline
              label="Unresolved control request"
              items={[
                {
                  id: "requested",
                  time: "20:49",
                  title: "Cancellation requested",
                  detail:
                    "Original request cancel-sample-04 · sample-buy-order",
                  state: "observed",
                },
                {
                  id: "unknown",
                  time: "Unconfirmed",
                  title: "Exchange outcome unknown",
                  detail:
                    "No replacement request. Reconcile the original identifier before further action.",
                  state: "unknown",
                  action: (
                    <RecordLink
                      title="Inspect original order"
                      onClick={() => open({ kind: "order", id: "buy" })}
                    />
                  ),
                },
              ]}
            />
          ) : (
            <EmptyState
              title="No submitted requests"
              detail="Local scope reviews do not create control requests or change authority."
            />
          )}
        </TabsContent>
      </Tabs>
      <p className="type-meta muted">
        Closing this window does not stop the company. Each control has a
        separate target and effect.
      </p>
    </div>
  );
}
