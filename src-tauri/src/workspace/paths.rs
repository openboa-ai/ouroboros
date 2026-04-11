use std::fs;
use std::path::{Path, PathBuf};

use serde::de::DeserializeOwned;
use serde::Serialize;

use super::*;

impl WorkspaceRepository {
    pub(super) fn checkpoint_file_path(&self, checkpoint_id: &str) -> PathBuf {
        self.root
            .join("checkpoints")
            .join("items")
            .join(checkpoint_id)
            .join("checkpoint.json")
    }

    pub(super) fn checkpoint_snapshot_path(&self, checkpoint_id: &str) -> PathBuf {
        self.root
            .join("checkpoints")
            .join("items")
            .join(checkpoint_id)
            .join("workspace")
    }

    pub(super) fn export_bundle_path(&self, checkpoint_id: &str) -> PathBuf {
        self.root
            .join("exports")
            .join("generated")
            .join(checkpoint_id)
            .join("export.json")
    }

    pub(super) fn imports_index_path(&self) -> PathBuf {
        self.root.join("imports").join("index.json")
    }

    pub(super) fn evaluations_index_path(&self) -> PathBuf {
        self.root.join("evaluations").join("index.json")
    }

    pub(super) fn evaluation_run_root_path(&self, run_id: &str) -> PathBuf {
        self.root.join("evaluations").join("items").join(run_id)
    }

    pub(super) fn evaluation_run_file_path(&self, run_id: &str) -> PathBuf {
        self.evaluation_run_root_path(run_id).join("run.json")
    }

    pub(super) fn operations_index_path(&self) -> PathBuf {
        self.root.join("operations").join("index.json")
    }

    pub(super) fn operation_root_path(&self, operation_id: &str) -> PathBuf {
        self.root
            .join("operations")
            .join("items")
            .join(operation_id)
    }

    pub(super) fn operation_file_path(&self, operation_id: &str) -> PathBuf {
        self.operation_root_path(operation_id)
            .join("operation.json")
    }

    pub(super) fn import_root_path(&self, import_id: &str) -> PathBuf {
        self.root.join("imports").join("items").join(import_id)
    }

    pub(super) fn import_file_path(&self, import_id: &str) -> PathBuf {
        self.import_root_path(import_id).join("import.json")
    }

    pub(super) fn collection_file_path(&self, collection_id: &str) -> PathBuf {
        self.root
            .join("collections")
            .join("items")
            .join(collection_id)
            .join("collection.json")
    }

    pub(super) fn collection_entries_path(&self, collection_id: &str) -> PathBuf {
        self.root
            .join("collections")
            .join("items")
            .join(collection_id)
            .join("entries.ndjson")
    }

    pub(super) fn collection_entry_document_path(
        &self,
        collection_id: &str,
        entry_id: &str,
    ) -> PathBuf {
        collection_entry_document_path_for_root(&self.root, collection_id, entry_id)
    }

    pub(super) fn export_workspace_path(&self, checkpoint_id: &str) -> PathBuf {
        self.root
            .join("exports")
            .join("generated")
            .join(checkpoint_id)
            .join("workspace")
    }

    pub(super) fn blob_path(&self, blob_id: &str) -> PathBuf {
        let (algorithm, digest) = blob_id.split_once(':').unwrap_or(("sha256", blob_id));
        self.root
            .join("blobs")
            .join(algorithm)
            .join(format!("{digest}.txt"))
    }

    pub(super) fn resolve_import_bundle_ref(&self, bundle_ref: &str) -> Result<PathBuf, String> {
        let candidate = PathBuf::from(bundle_ref);
        let path = if candidate.is_absolute() {
            candidate
        } else {
            self.project_root().join(bundle_ref)
        };
        path.canonicalize().map_err(|error| {
            format!(
                "failed to resolve import bundle {}: {error}",
                path.display()
            )
        })
    }

    pub(super) fn resolve_workspace_document_ref(
        &self,
        document_ref: &str,
    ) -> Result<PathBuf, String> {
        let project_root = self.project_root();
        let candidate = project_root.join(document_ref);
        let canonical = candidate.canonicalize().map_err(|error| {
            format!(
                "failed to resolve workspace document {}: {error}",
                candidate.display()
            )
        })?;
        let root = self.root.canonicalize().map_err(|error| {
            format!(
                "failed to resolve workspace root {}: {error}",
                self.root.display()
            )
        })?;

        if !canonical.starts_with(&root) {
            return Err(format!(
                "document ref must stay inside workspace root: {}",
                document_ref
            ));
        }

        Ok(canonical)
    }

    pub(super) fn display_path(&self, path: &Path) -> String {
        let project_root = self.project_root();
        path.strip_prefix(&project_root)
            .map(|relative| relative.to_string_lossy().replace('\\', "/"))
            .unwrap_or_else(|_| path.to_string_lossy().replace('\\', "/"))
    }

    pub(super) fn list_display_files(&self, root: &Path) -> Result<Vec<String>, String> {
        let mut items = Vec::new();
        self.collect_display_files(root, &mut items)?;
        items.sort();
        Ok(items)
    }

    pub(super) fn collect_display_files(
        &self,
        current: &Path,
        items: &mut Vec<String>,
    ) -> Result<(), String> {
        for entry in fs::read_dir(current)
            .map_err(|error| format!("failed to read {}: {error}", current.display()))?
        {
            let entry = entry.map_err(|error| format!("failed to read entry: {error}"))?;
            let path = entry.path();
            if path.is_dir() {
                self.collect_display_files(&path, items)?;
                continue;
            }
            items.push(self.display_path(&path));
        }

        Ok(())
    }

    pub(super) fn project_root(&self) -> PathBuf {
        PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("..")
    }

    pub(super) fn resolve_ref(&self, base_file: &Path, reference: &str) -> PathBuf {
        let clean_reference = reference.split('#').next().unwrap_or(reference);
        let base_dir = base_file
            .parent()
            .map(Path::to_path_buf)
            .unwrap_or_else(|| self.root.clone());
        base_dir.join(clean_reference)
    }

    pub(super) fn resolve_optional_ref(
        &self,
        base_file: &Path,
        reference: Option<&str>,
        fallback: &str,
    ) -> PathBuf {
        self.resolve_ref(base_file, reference.unwrap_or(fallback))
    }

    pub(super) fn read_json_path<T: DeserializeOwned>(&self, path: &Path) -> Result<T, String> {
        FileWorkspaceStore::read_json_path(path)
    }

    pub(super) fn read_ndjson_path<T: DeserializeOwned>(
        &self,
        path: &Path,
    ) -> Result<Vec<T>, String> {
        FileWorkspaceStore::read_ndjson_path(path)
    }

    pub(super) fn write_json_path<T: Serialize>(
        &self,
        path: &Path,
        value: &T,
    ) -> Result<(), String> {
        FileWorkspaceStore::write_json_path(path, value)
    }
}
