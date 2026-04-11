import { useMemo, useState } from "react";
import type { IngestSourceEntryInput } from "../lib/service-contract";
import { Button } from "./ui/button";
import { Card } from "./ui/card";

type SourceIngestPanelProps = {
  onSubmit: (input: IngestSourceEntryInput) => Promise<void>;
};

type SourceKind = IngestSourceEntryInput["kind"];

export function SourceIngestPanel({ onSubmit }: SourceIngestPanelProps) {
  const [kind, setKind] = useState<SourceKind>("raw");
  const [sourceRef, setSourceRef] = useState("notes:operator:runtime");
  const [eventTimeInput, setEventTimeInput] = useState(nowLocalInputValue());
  const [preview, setPreview] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const helperLabel = useMemo(() => {
    if (kind === "canonical") {
      return "Canonical collections are still source-centered. Use them for transformed or normalized material only.";
    }

    return "Raw collections preserve source-native payloads and let the service materialize collection, entry, and blob artifacts.";
  }, [kind]);

  async function handleSubmit() {
    const trimmedSourceRef = sourceRef.trim();
    const trimmedPreview = preview.trim();
    const trimmedBodyText = bodyText.trim();

    if (!trimmedSourceRef) {
      setLocalError("Source ref is required.");
      return;
    }

    if (!trimmedPreview && !trimmedBodyText) {
      setLocalError("Provide either a preview or a body payload before ingesting.");
      return;
    }

    const eventTime = localInputToIso(eventTimeInput);
    if (!eventTime) {
      setLocalError("Event time must be a valid timestamp.");
      return;
    }

    setSubmitting(true);
    setLocalError(null);

    try {
      await onSubmit({
        kind,
        sourceRef: trimmedSourceRef,
        eventTime,
        ingestedAt: new Date().toISOString(),
        preview: trimmedPreview || undefined,
        bodyText: trimmedBodyText || undefined
      });
      if (trimmedBodyText) {
        setBodyText("");
      }
      if (trimmedPreview) {
        setPreview("");
      }
      setEventTimeInput(nowLocalInputValue());
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : String(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card
      title="Source Ingest"
      description="Create source-centered workspace material through the service layer instead of relying on a hardcoded sample."
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-2 text-sm text-ink-200">
            <span className="text-[11px] uppercase tracking-[0.18em] text-ink-300">Kind</span>
            <select
              value={kind}
              onChange={(event) => setKind(event.target.value as SourceKind)}
              className="rounded-2xl border border-white/10 bg-black/20 px-3 py-3 text-sm text-ink-50 outline-none transition focus:border-accent-teal/50"
            >
              <option value="raw">raw</option>
              <option value="canonical">canonical</option>
            </select>
          </label>
          <label className="grid gap-2 text-sm text-ink-200">
            <span className="text-[11px] uppercase tracking-[0.18em] text-ink-300">Event Time</span>
            <input
              type="datetime-local"
              value={eventTimeInput}
              onChange={(event) => setEventTimeInput(event.target.value)}
              className="rounded-2xl border border-white/10 bg-black/20 px-3 py-3 text-sm text-ink-50 outline-none transition focus:border-accent-teal/50"
            />
          </label>
        </div>

        <label className="grid gap-2 text-sm text-ink-200">
          <span className="text-[11px] uppercase tracking-[0.18em] text-ink-300">Source Ref</span>
          <input
            type="text"
            value={sourceRef}
            onChange={(event) => setSourceRef(event.target.value)}
            placeholder="news:macro:cpi"
            className="rounded-2xl border border-white/10 bg-black/20 px-3 py-3 text-sm text-ink-50 outline-none transition focus:border-accent-teal/50"
          />
        </label>

        <label className="grid gap-2 text-sm text-ink-200">
          <span className="text-[11px] uppercase tracking-[0.18em] text-ink-300">Preview</span>
          <input
            type="text"
            value={preview}
            onChange={(event) => setPreview(event.target.value)}
            placeholder="Short summary or headline"
            className="rounded-2xl border border-white/10 bg-black/20 px-3 py-3 text-sm text-ink-50 outline-none transition focus:border-accent-teal/50"
          />
        </label>

        <label className="grid gap-2 text-sm text-ink-200">
          <span className="text-[11px] uppercase tracking-[0.18em] text-ink-300">Body</span>
          <textarea
            value={bodyText}
            onChange={(event) => setBodyText(event.target.value)}
            rows={6}
            placeholder="Paste the source payload, note, article body, transcript, or normalized content."
            className="rounded-2xl border border-white/10 bg-black/20 px-3 py-3 text-sm leading-6 text-ink-50 outline-none transition focus:border-accent-teal/50"
          />
        </label>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-3 text-sm leading-6 text-ink-300">
          {helperLabel}
        </div>

        {localError ? (
          <div className="rounded-2xl border border-accent-red/40 bg-accent-red/10 px-3 py-3 text-sm leading-6 text-ink-50">
            {localError}
          </div>
        ) : null}

        <Button
          variant="secondary"
          onClick={() => {
            void handleSubmit();
          }}
          disabled={submitting}
        >
          {submitting ? "Ingesting..." : "Ingest Source Entry"}
        </Button>
      </div>
    </Card>
  );
}

function nowLocalInputValue() {
  const now = new Date();
  const offsetMs = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offsetMs).toISOString().slice(0, 16);
}

function localInputToIso(value: string) {
  const candidate = new Date(value);
  if (Number.isNaN(candidate.getTime())) {
    return null;
  }

  return candidate.toISOString();
}
