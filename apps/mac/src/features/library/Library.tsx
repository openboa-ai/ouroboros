import { materialTarget, type Material } from "./model";
import { useState } from "react";
import { ArrowRight, FileJson2, FileText, Search } from "lucide-react";
import { Button } from "@/ui/primitives/button";
import { Input } from "@/ui/primitives/input";
import { Tabs, TabsList, TabsTrigger } from "@/ui/primitives/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/ui/primitives/table";
import {
  EmptyState,
  Member,
  RecordLink,
  SectionHeading,
  Status,
} from "@/ui/components/patterns";
import type { ViewProps } from "@/app/contracts";
import "@/ui/layouts/communication.css";

type MaterialKind = "all" | "reports" | "data";
export function LibraryScreen({
  open,
  discuss,
  scenario,
  materials,
  sourceLabel = "Sample records",
}: ViewProps & { materials: readonly Material[]; sourceLabel?: string }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<MaterialKind>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const available = scenario === "empty" ? [] : materials;
  const visible = available.filter(
    (file) =>
      (filter === "all" || file.kind === filter) &&
      `${file.title} ${file.path} ${file.author} ${file.purpose} ${file.workLabel} ${file.format}`
        .toLowerCase()
        .includes(query.trim().toLowerCase()),
  );
  const selected = available.find((file) => file.id === selectedId);

  // UX: ../../../../../docs/design/COMMUNICATION_AND_LIBRARY_EXPERIENCE.md#a-04
  // Preview and discussion keep the exact publication and its governed read scope.
  function preview(file: (typeof materials)[number]) {
    setSelectedId(file.id);
    open(materialTarget(file));
  }

  return (
    <div className="library-screen">
      {/* UX: ../../../../../docs/design/COMMUNICATION_AND_LIBRARY_EXPERIENCE.md#a-01 */}
      <div className="library-toolbar">
        <div className="library-search-field">
          <label className="type-meta muted" htmlFor="material-search">
            Find a material
          </label>
          <div className="library-search">
            <Search size={16} aria-hidden="true" />
            <Input
              id="material-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Name, author, or related work"
            />
          </div>
        </div>
        <Tabs
          value={filter}
          onValueChange={(value) => setFilter(value as MaterialKind)}
        >
          <TabsList aria-label="Material type">
            <TabsTrigger value="all">All files</TabsTrigger>
            <TabsTrigger value="reports">Reports</TabsTrigger>
            <TabsTrigger value="data">Data</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      <div className="library-list-heading">
        <SectionHeading title="Published materials" />
        <span className="type-meta muted">
          {visible.length} {visible.length === 1 ? "material" : "materials"} ·
          {sourceLabel}
        </span>
      </div>

      {/* UX: ../../../../../docs/design/COMMUNICATION_AND_LIBRARY_EXPERIENCE.md#a-03 */}
      {visible.length ? (
        <Table className="library-table">
          <TableHeader>
            <TableRow>
              <TableHead>Material</TableHead>
              <TableHead>Author</TableHead>
              <TableHead>Related work</TableHead>
              <TableHead>Revision</TableHead>
              <TableHead className="text-right">Published</TableHead>
              <TableHead>
                <span className="sr-only">Preview</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.map((file) => (
              <TableRow
                key={file.id}
                data-state={selectedId === file.id ? "selected" : undefined}
              >
                <TableCell>
                  <Button
                    variant="ghost"
                    className="library-file-button"
                    onClick={() => preview(file)}
                  >
                    <span className="library-file-symbol" aria-hidden="true">
                      {file.kind === "data" ? (
                        <FileJson2 size={20} />
                      ) : (
                        <FileText size={20} />
                      )}
                    </span>
                    <span className="library-file-copy">
                      <span className="type-control">{file.title}</span>
                      <span className="type-meta muted">{file.purpose}</span>
                      <span className="type-meta muted library-format">
                        {file.format}
                      </span>
                    </span>
                  </Button>
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    className="library-author"
                    onClick={() =>
                      open({
                        kind: "member",
                        id: file.authorId ?? file.author.toLowerCase(),
                      })
                    }
                  >
                    <Member name={file.author} role={file.role} compact />
                  </Button>
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    className="library-work"
                    onClick={() => open({ kind: "work", id: file.work })}
                  >
                    {file.workLabel}
                  </Button>
                </TableCell>
                <TableCell>
                  <span className="type-data tabular-nums">
                    {file.revision}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <span className="type-data tabular-nums">
                    {scenario === "delayed"
                      ? file.id === "weekly-review"
                        ? "18:20"
                        : file.time.replace("20:", "17:")
                      : file.time}
                  </span>
                  <div className="type-meta muted">
                    {file.date ?? "Sep 13 · Sample"}
                  </div>
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Preview ${file.title}, revision ${file.revision}`}
                    onClick={() => preview(file)}
                  >
                    <ArrowRight size={16} />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <EmptyState
          title={
            available.length ? "No matching materials" : "No materials yet"
          }
          detail={
            available.length
              ? "Try a different name, author, or work."
              : "Published files will appear here when records are available."
          }
          action={
            available.length ? (
              <Button
                variant="secondary"
                onClick={() => {
                  setQuery("");
                  setFilter("all");
                }}
              >
                Clear filters
              </Button>
            ) : undefined
          }
        />
      )}

      {selected && (
        <section className="library-selection" aria-label="Selected material">
          <div className="library-selection-heading">
            <div>
              <span className="type-meta muted">Selected material</span>
              <h2 className="type-section">
                {selected.title} · revision {selected.revision}
              </h2>
            </div>
            <Status>{sourceLabel}</Status>
          </div>
          <div className="library-selection-actions">
            <RecordLink
              title="Inspect this revision"
              meta="Preview and exact source reference"
              icon={<FileText size={18} />}
              onClick={() => preview(selected)}
            />
            <RecordLink
              title={selected.workLabel}
              meta="Related company work"
              onClick={() => open({ kind: "work", id: selected.work })}
            />
            <Button
              variant="secondary"
              onClick={() =>
                discuss({
                  label: `${selected.title} · ${selected.workspace ?? "Published file"} / revision ${selected.revision} / ${selected.path}`,
                  target: materialTarget(selected),
                })
              }
            >
              Discuss this file
              <ArrowRight size={14} />
            </Button>
          </div>
        </section>
      )}
      <p className="type-meta muted library-footnote">
        Search covers names and metadata. Opening a file keeps its selected
        revision.
      </p>
    </div>
  );
}
