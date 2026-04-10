import type {
  WorkspaceCatalogEntry,
  WorkspaceDocumentState,
  WorkspaceSearchResultState
} from "../lib/service-contract";
import { Badge } from "./ui/badge";
import { Card } from "./ui/card";

type WorkspaceDocumentPanelProps = {
  documents: WorkspaceCatalogEntry[];
  searchQuery: string;
  searchResults: WorkspaceSearchResultState[] | null;
  selectedDocumentId: string | null;
  documentDetail: WorkspaceDocumentState | null;
  onSearchQueryChange: (query: string) => void;
  onSelectDocument: (documentId: string, pathRef: string) => void;
};

export function WorkspaceDocumentPanel({
  documents,
  searchQuery,
  searchResults,
  selectedDocumentId,
  documentDetail,
  onSearchQueryChange,
  onSelectDocument
}: WorkspaceDocumentPanelProps) {
  const filteredDocuments =
    searchQuery.trim().length > 0 && searchResults
      ? searchResults.map((result) => ({
          id: result.id,
          category: result.category,
          label: result.label,
          description: result.excerpt
            ? `${result.description} Match: ${result.excerpt}`
            : result.description,
          pathRef: result.pathRef
        }))
      : documents;

  const selected =
    filteredDocuments.find((item) => item.id === selectedDocumentId) ??
    documents.find((item) => item.id === selectedDocumentId) ??
    filteredDocuments[0] ??
    documents[0] ??
    null;

  return (
    <Card
      title="Workspace Documents"
      description="Official clients inspect workspace files through the service layer instead of reading the asset directly."
    >
      <div className="grid gap-5 xl:grid-cols-[minmax(0,280px)_1fr]">
        <div className="space-y-3">
          <input
            value={searchQuery}
            onChange={(event) => onSearchQueryChange(event.target.value)}
            placeholder="Search workspace docs"
            className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-ink-50 outline-none transition placeholder:text-ink-400 focus:border-accent-teal/40"
          />
          {filteredDocuments.map((document) => {
            const isSelected = document.id === selected?.id;
            return (
              <button
                key={document.id}
                type="button"
                onClick={() => onSelectDocument(document.id, document.pathRef)}
                className={[
                  "w-full rounded-2xl border px-4 py-3 text-left transition",
                  isSelected
                    ? "border-accent-teal/40 bg-accent-teal/10 shadow-panel"
                    : "border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.05]"
                ].join(" ")}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium text-ink-50">{document.label}</p>
                  <Badge tone="neutral">{document.category}</Badge>
                </div>
                <p className="mt-1 text-xs leading-5 text-ink-300">{document.description}</p>
              </button>
            );
          })}
          {filteredDocuments.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-4 text-sm text-ink-300">
              No workspace documents match this filter.
            </div>
          ) : null}
        </div>

        {documentDetail ? (
          <div className="space-y-4 rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="neutral">{documentDetail.format}</Badge>
              <Badge tone="neutral">{documentDetail.lineCount} lines</Badge>
              <Badge tone="neutral">{documentDetail.byteLength} bytes</Badge>
              <Badge tone="neutral">{documentDetail.backlinks.length} backlinks</Badge>
            </div>
            <p className="break-all text-xs leading-5 text-ink-300">{documentDetail.pathRef}</p>
            {documentDetail.backlinks.length > 0 ? (
              <div className="space-y-2 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                <p className="text-xs uppercase tracking-[0.16em] text-ink-300">Referenced By</p>
                {documentDetail.backlinks.map((backlink) => (
                  <button
                    key={`${backlink.pathRef}-${backlink.reason}`}
                    type="button"
                    onClick={() =>
                      onSelectDocument(`ref:${backlink.pathRef}`, backlink.pathRef)
                    }
                    className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-left transition hover:border-white/20 hover:bg-white/[0.05]"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="neutral">{backlink.category}</Badge>
                      <p className="text-sm font-medium text-ink-50">{backlink.label}</p>
                    </div>
                    <p className="mt-1 text-xs leading-5 text-ink-300">{backlink.reason}</p>
                    <p className="mt-2 break-all text-[11px] leading-5 text-ink-400">
                      {backlink.pathRef}
                    </p>
                  </button>
                ))}
              </div>
            ) : null}
            <pre className="max-h-96 overflow-auto rounded-xl bg-shell-950/80 p-3 text-xs leading-6 text-ink-100">
              {documentDetail.contentText}
            </pre>
          </div>
        ) : null}
      </div>
    </Card>
  );
}
