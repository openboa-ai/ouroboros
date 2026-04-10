import type { CollectionDetailState, CollectionSummaryState } from "../lib/service-contract";
import { Badge } from "./ui/badge";
import { Card } from "./ui/card";

type CollectionsPanelProps = {
  collections: CollectionSummaryState[];
  selectedCollectionId: string | null;
  collectionDetail: CollectionDetailState | null;
  onSelectCollection: (collectionId: string) => void;
};

export function CollectionsPanel({
  collections,
  collectionDetail,
  onSelectCollection,
  selectedCollectionId
}: CollectionsPanelProps) {
  const selected = collections.find((item) => item.id === selectedCollectionId) ?? collections[0] ?? null;

  return (
    <Card
      title="Collections"
      description="Source-centered collections are persisted as UTC-hour shards and browsed through the service layer."
    >
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          {collections.map((collection) => {
            const isSelected = collection.id === selected?.id;
            return (
              <button
                key={collection.id}
                type="button"
                onClick={() => onSelectCollection(collection.id)}
                className={[
                  "grid w-full gap-3 rounded-2xl border p-4 text-left transition",
                  "lg:grid-cols-[1fr_auto]",
                  isSelected
                    ? "border-accent-teal/40 bg-accent-teal/10 shadow-panel"
                    : "border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.05]"
                ].join(" ")}
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium text-ink-50">{collection.sourceRef}</p>
                    <Badge tone={collection.kind === "raw" ? "warning" : "positive"}>
                      {collection.kind}
                    </Badge>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-ink-200">{collection.timeRangeLabel}</p>
                </div>
                <div className="text-right text-xs uppercase tracking-[0.16em] text-ink-300">
                  <p>{collection.timeBucket}</p>
                  <p className="mt-2">{collection.entryCount} entries</p>
                </div>
              </button>
            );
          })}
        </div>

        {selected && collectionDetail ? (
          <div className="space-y-4 rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={collectionDetail.kind === "raw" ? "warning" : "positive"}>
                  {collectionDetail.kind}
                </Badge>
                <Badge tone="neutral">{collectionDetail.entryCount} entries</Badge>
              </div>
              <p className="text-sm leading-6 text-ink-200">{collectionDetail.notes}</p>
            </div>

            <dl className="space-y-3 text-sm">
              <CollectionRow label="Collection ref" value={collectionDetail.collectionRef} />
              <CollectionRow label="Entry shard" value={collectionDetail.entryShardRef} />
              <CollectionRow label="Content hash" value={collectionDetail.contentHash} />
            </dl>

            <section className="space-y-2">
              <h3 className="text-[11px] uppercase tracking-[0.18em] text-ink-300">Entries</h3>
              <div className="space-y-2">
                {collectionDetail.entries.slice(0, 5).map((entry) => (
                  <div
                    key={entry.id}
                    className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-3"
                  >
                    <p className="text-xs uppercase tracking-[0.16em] text-ink-300">
                      {entry.eventTime}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-ink-50">{entry.preview ?? entry.id}</p>
                    {entry.blobPathRef ? (
                      <p className="mt-2 break-all text-xs leading-5 text-ink-300">{entry.blobPathRef}</p>
                    ) : null}
                  </div>
                ))}
              </div>
            </section>
          </div>
        ) : null}
      </div>
    </Card>
  );
}

function CollectionRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
      <dt className="text-[11px] uppercase tracking-[0.18em] text-ink-300">{label}</dt>
      <dd className="mt-2 break-all text-sm leading-6 text-ink-50">{value}</dd>
    </div>
  );
}
