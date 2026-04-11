use std::collections::BTreeSet;
use std::fs;
use std::path::Path;

use super::*;

impl WorkspaceRepository {
    pub(in crate::workspace) fn compare_workspace_roots(
        &self,
        base_root: &Path,
        target_root: &Path,
    ) -> Result<WorkspaceDiffState, String> {
        let base_files = list_relative_files(base_root, ".")?;
        let target_files = list_relative_files(target_root, ".")?;
        let mut file_keys = BTreeSet::new();
        for file in &base_files {
            file_keys.insert(file.clone());
        }
        for file in &target_files {
            file_keys.insert(file.clone());
        }

        let mut files = Vec::new();
        let mut changed_count = 0;
        let mut added_count = 0;
        let mut removed_count = 0;

        for relative_path in file_keys {
            let relative = relative_path.trim_start_matches("./");
            let base_path = base_root.join(relative);
            let target_path = target_root.join(relative);
            let base_exists = base_path.exists();
            let target_exists = target_path.exists();

            let status = match (base_exists, target_exists) {
                (true, true) => {
                    let left = fs::read(&base_path).map_err(|error| {
                        format!("failed to read {}: {error}", base_path.display())
                    })?;
                    let right = fs::read(&target_path).map_err(|error| {
                        format!("failed to read {}: {error}", target_path.display())
                    })?;
                    if left == right {
                        continue;
                    }
                    changed_count += 1;
                    "changed"
                }
                (true, false) => {
                    removed_count += 1;
                    "removed"
                }
                (false, true) => {
                    added_count += 1;
                    "added"
                }
                (false, false) => continue,
            };

            files.push(CheckpointComparisonFileState {
                relative_path: relative.into(),
                status: status.into(),
                base_ref: base_exists.then(|| self.display_path(&base_path)),
                target_ref: target_exists.then(|| self.display_path(&target_path)),
            });
        }

        Ok(WorkspaceDiffState {
            files,
            changed_count,
            added_count,
            removed_count,
        })
    }
}
