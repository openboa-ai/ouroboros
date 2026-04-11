use std::fs;

use super::*;

impl WorkspaceRepository {
    pub fn load_blob_detail(&self, blob_id: &str) -> Result<BlobDetailState, String> {
        let blob_path = self.blob_path(blob_id);
        let content_text = fs::read_to_string(&blob_path)
            .map_err(|error| format!("failed to read {}: {error}", blob_path.display()))?;

        Ok(BlobDetailState {
            id: blob_id.to_string(),
            blob_path_ref: self.display_path(&blob_path),
            byte_length: content_text.as_bytes().len(),
            line_count: content_text.lines().count(),
            content_text,
        })
    }
}
