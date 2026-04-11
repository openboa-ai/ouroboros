import { useEffect, useRef, useState } from "react";
import { Button } from "./ui/button";
import { Card } from "./ui/card";

type BundleImportPanelProps = {
  suggestedBundleRef?: string | null;
  onSubmit: (bundleRef: string) => Promise<void>;
};

export function BundleImportPanel({
  suggestedBundleRef,
  onSubmit
}: BundleImportPanelProps) {
  const [bundleRef, setBundleRef] = useState(suggestedBundleRef ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const hasEditedRef = useRef(false);

  useEffect(() => {
    if (!hasEditedRef.current) {
      setBundleRef(suggestedBundleRef ?? "");
    }
  }, [suggestedBundleRef]);

  async function handleSubmit() {
    const trimmed = bundleRef.trim();
    if (!trimmed) {
      setLocalError("Bundle ref is required.");
      return;
    }

    setSubmitting(true);
    setLocalError(null);

    try {
      await onSubmit(trimmed);
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : String(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card
      title="Bundle Import"
      description="Stage any sanitized export bundle into imports. The ref can point at the latest local export or an external bundle path."
    >
      <div className="space-y-4">
        <label className="grid gap-2 text-sm text-ink-200">
          <span className="text-[11px] uppercase tracking-[0.18em] text-ink-300">Bundle Ref</span>
          <input
            type="text"
            value={bundleRef}
            onChange={(event) => {
              hasEditedRef.current = true;
              setBundleRef(event.target.value);
            }}
            placeholder="var/dev-workspace/exports/generated/.../export.json"
            className="rounded-2xl border border-white/10 bg-black/20 px-3 py-3 text-sm text-ink-50 outline-none transition focus:border-accent-teal/50"
          />
        </label>

        {suggestedBundleRef ? (
          <Button
            variant="ghost"
            className="justify-start"
            onClick={() => {
              hasEditedRef.current = true;
              setBundleRef(suggestedBundleRef);
              setLocalError(null);
            }}
          >
            Use Latest Export Ref
          </Button>
        ) : null}

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
          {submitting ? "Staging..." : "Stage Bundle Import"}
        </Button>
      </div>
    </Card>
  );
}
