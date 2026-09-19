import { useState, type ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  FileKey2,
  ShieldCheck,
  Server,
} from "lucide-react";
import { Button } from "@/ui/primitives/button";
import { Tabs, TabsList, TabsTrigger } from "@/ui/primitives/tabs";
import { Facts } from "@/ui/components/patterns";
import { ActivityTimeline } from "@/ui/components/ActivityTimeline";
/** UX B-01–B-04: existing/recovery entry without silently authorizing a new company or activity. */
export function ConnectionScreen({
  connect,
  busy,
  error,
  explore,
  footer,
}: {
  connect: (pick: boolean) => Promise<void>;
  busy: boolean;
  error: string;
  explore: () => void;
  footer: ReactNode;
}) {
  const [step, setStep] = useState<"entry" | "prepare">("entry");
  const [path, setPath] = useState("existing");
  return (
    <main className="connection-screen">
      <div className="connection-content">
        <div className="brand">
          <img src="/brand/openboa-symbol-primary.svg" alt="OpenBoa" />
          <span className="type-section">Ouroboros</span>
        </div>
        {step === "entry" ? (
          <>
            <div>
              <h1 className="type-title">Your company, in view.</h1>
              <p className="type-body muted">
                Capital, people and their work. One place to observe and
                intervene.
              </p>
            </div>
            <div className="connection-overview">
              <span>
                <Server size={18} />
                Your environment
              </span>
              <span>
                <ShieldCheck size={18} />
                Your identity
              </span>
              <span>
                <FileKey2 size={18} />
                Retained records
              </span>
            </div>
            <div className="connection-actions">
              <Button onClick={() => setStep("prepare")}>
                Connect company
                <ArrowRight size={16} />
              </Button>
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() => void connect(false)}
              >
                {busy ? "Connecting…" : "Use saved connection"}
              </Button>
              <Button variant="ghost" disabled={busy} onClick={explore}>
                Explore sample company
              </Button>
            </div>
            <p className="type-meta muted">
              Sample records are separate from your operating environment.
            </p>
          </>
        ) : (
          <>
            <Button
              variant="ghost"
              className="connection-back"
              disabled={busy}
              onClick={() => setStep("entry")}
            >
              <ArrowLeft size={14} />
              Back
            </Button>
            <h1 className="type-title">Connect your environment</h1>
            <Tabs value={path} onValueChange={setPath}>
              <TabsList aria-label="Connection path">
                <TabsTrigger value="existing">Existing company</TabsTrigger>
                <TabsTrigger value="recovery">Reconnect & recover</TabsTrigger>
              </TabsList>
            </Tabs>
            <ActivityTimeline
              label="Connection requirements"
              items={[
                {
                  id: "profile",
                  time: "1",
                  title: "Select a connection profile",
                  detail:
                    "Choose the profile prepared by your operating environment.",
                  state: "pending",
                },
                {
                  id: "identity",
                  time: "2",
                  title: "Verify identity and access",
                  detail:
                    "The Mac client uses the profile's trusted credential paths.",
                  state: "pending",
                },
                {
                  id: "records",
                  time: "3",
                  title:
                    path === "recovery"
                      ? "Reconcile retained state"
                      : "Read current company records",
                  detail:
                    path === "recovery"
                      ? "Pending requests retain their original identifiers. Reconnecting does not resubmit them."
                      : "Company records must come from the Gateway. No sample fallback.",
                  state: "pending",
                },
              ]}
            />
            <Facts
              rows={[
                [
                  "New company installation",
                  "Not available in this client yet",
                ],
                ["Operating authority", "Unchanged by connecting"],
              ]}
            />
            <Button disabled={busy} onClick={() => void connect(true)}>
              <FileKey2 size={16} />
              {busy ? "Connecting…" : "Select profile & connect"}
            </Button>
          </>
        )}
        {error && (
          <p role="alert" className="detail-note type-body">
            {error}
          </p>
        )}
        {footer}
      </div>
    </main>
  );
}
