use super::*;

impl WorkspaceRepository {
    pub fn load_collection_detail(
        &self,
        collection_id: &str,
    ) -> Result<CollectionDetailState, String> {
        let collection_path = self.collection_file_path(collection_id);
        let collection = self.read_json_path::<CollectionRecordFile>(&collection_path)?;
        let entry_shard_path = self.resolve_ref(&collection_path, &collection.entry_shard_ref);
        let entries = self.read_ndjson_path::<CollectionEntryFile>(&entry_shard_path)?;

        Ok(CollectionDetailState {
            id: collection.collection_id.clone(),
            kind: collection.kind,
            source_ref: collection.source_ref,
            time_bucket: collection.time_bucket,
            time_range_label: format!(
                "{} -> {}",
                collection.time_range.start, collection.time_range.end
            ),
            entry_count: collection.entry_count,
            content_hash: collection.content_hash,
            collection_ref: self.display_path(&collection_path),
            entry_shard_ref: self.display_path(&entry_shard_path),
            notes: collection.notes,
            entries: entries
                .into_iter()
                .map(|entry| CollectionEntryState {
                    id: entry.entry_id.clone(),
                    source_ref: entry.source_ref,
                    event_time: entry.event_time,
                    ingested_at: entry.ingested_at,
                    content_hash: entry.content_hash,
                    preview: entry.preview,
                    entry_path_ref: self.display_path(&self.collection_entry_document_path(
                        &collection.collection_id,
                        &entry.entry_id,
                    )),
                    blob_ref: entry.blob_ref.clone(),
                    blob_path_ref: entry
                        .blob_ref
                        .as_ref()
                        .map(|blob_ref| self.display_path(&self.blob_path(blob_ref))),
                })
                .collect(),
        })
    }
}
