import { useId, useRef, useState } from "react";
import type { ViewProps } from "@/app/contracts";
import { validateComposition, type CompanyComposition, type ModuleDefinition } from "@/contracts/modules";
import { Facts, Status } from "@/ui/components/patterns";
import { Button } from "@/ui/primitives/button";

export interface CompositionActivationContext {
  expectedRevision: number | null;
  requestKey: string;
}
interface Candidate { fileName: string; composition: CompanyComposition; requestKey: string }
export interface ModuleSettingsProps extends ViewProps {
  modules: readonly ModuleDefinition[];
  scope: string;
  /** Supplied by the company bootstrap/observation path, not by local file import. */
  current?: CompanyComposition | null;
  /** Resolves only after the caller has observed activation; a submission receipt is insufficient. */
  onActivate?: (candidate: CompanyComposition, context: CompositionActivationContext) => Promise<CompanyComposition>;
}

/** Imports only presentation configuration. Executable modules still enter through the app build. */
export function ModuleSettings({ modules, scope, current, onActivate }: ModuleSettingsProps) {
  const inputId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [imported, setCandidate] = useState<Candidate | null>(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const active = current?.companyId === scope ? current : null;
  const candidate = imported?.composition.companyId === scope ? imported : null;
  const selected = candidate?.composition;
  const superseded = !!selected && !!active && selected.revision <= active.revision;

  async function importFile(file: File | undefined) {
    if (!file || busy) return;
    setCandidate(null); setStatus(""); setError(""); setAttempted(false); setBusy(true);
    try {
      if (file.size > 256 * 1024) throw new Error("Choose a configuration file smaller than 256 KB.");
      const value: unknown = JSON.parse(await file.text());
      const composition = validateComposition(value, scope, modules);
      setCandidate({ fileName: file.name, composition, requestKey: crypto.randomUUID() });
    } catch (error) {
      setError(error instanceof SyntaxError ? "This file does not contain valid JSON configuration." : error instanceof Error ? error.message : "The configuration file could not be read.");
    } finally { setBusy(false); if (input.current) input.current.value = ""; }
  }
  async function activate() {
    if (!candidate || !onActivate || busy || superseded || attempted) return;
    setBusy(true); setError(""); setStatus(""); setAttempted(true);
    try {
      // The trusted caller performs publication, optimistic revision checks, and observation.
      const activated = validateComposition(await onActivate(candidate.composition, { expectedRevision: active?.revision ?? null, requestKey: candidate.requestKey }), scope, modules);
      if (activated.revision < candidate.composition.revision || (activated.revision === candidate.composition.revision && JSON.stringify(activated.pages) !== JSON.stringify(candidate.composition.pages))) throw new Error("Activation returned a different configuration.");
      setStatus(activated.revision === candidate.composition.revision ? `Activation confirmed for revision ${activated.revision}.` : `Revision ${candidate.composition.revision} was published. Newer company revision ${activated.revision} is now current.`);
    } catch {
      setError("Activation could not be confirmed. Refresh the company configuration to check the original request; it has not been retried.");
    } finally { setBusy(false); }
  }

  return <div className="home-screen settings-page">
    <section aria-labelledby={`${inputId}-current`}>
      <h2 id={`${inputId}-current`} className="type-section">Company configuration</h2>
      {active ? <Facts rows={[["Current revision",String(active.revision)],["Declared author",active.author],["Pages",String(active.pages.length)],["Publication",active.publication ? `${active.publication.workspace} · Revision ${active.publication.revision} · ${active.publication.path}` : "Reference not provided"]]} /> : <p className="type-data muted">No active configuration is available for this company.</p>}
    </section>

    <section className="home-widget" aria-labelledby={`${inputId}-import`}>
      <div className="home-toolbar"><div><h2 id={`${inputId}-import`} className="type-section">Import configuration</h2><p className="type-meta muted">Preview company pages before changing the active configuration. Your personal Home layout stays unchanged.</p></div>
        <Button variant="secondary" disabled={busy} onClick={() => input.current?.click()}>Choose file</Button>
        <input ref={input} id={inputId} type="file" accept=".json,application/json" hidden aria-label="Import company configuration" onChange={event => void importFile(event.currentTarget.files?.[0])} />
      </div>
      {candidate && <>
        <div className="home-toolbar"><span className="type-control">{candidate.fileName}</span><Status>Compatible with this build</Status></div>
        <Facts rows={[["Candidate revision",String(candidate.composition.revision)],["Declared author",candidate.composition.author],["Change",`${active?.pages.length ?? 0} → ${candidate.composition.pages.length} company pages`],["Import result","Compatibility checked"]]} />
        <div>{candidate.composition.pages.map(page => <div className="record-link record-link--row" key={page.id}><span className="record-copy"><span className="type-control">{page.title}</span><span className="type-meta muted">{modules.find(module => module.id === page.module)?.name} · {page.screen ? "Registered screen" : `${page.widgets.length} widgets`}</span></span></div>)}</div>
        {superseded && <p className="type-data muted">This revision is already current or older. Import a newer revision to make a change.</p>}
        {onActivate ? <div><Button disabled={busy || superseded || attempted} onClick={() => void activate()}>{busy ? "Applying configuration…" : "Activate configuration"}</Button></div> : <p className="type-meta muted">Activation is unavailable for this connection. This file has not been published or activated by importing it.</p>}
      </>}
      {error && <p role="alert" className="type-data">{error}</p>}
      {status && <p role="status" className="type-data">{status}</p>}
    </section>


  </div>;
}
