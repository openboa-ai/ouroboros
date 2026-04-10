use std::fs;
use std::path::{Path, PathBuf};

use serde::de::DeserializeOwned;
use serde::Serialize;

pub struct FileWorkspaceStore;

impl FileWorkspaceStore {
    pub fn read_json_path<T: DeserializeOwned>(path: &Path) -> Result<T, String> {
        let bytes =
            fs::read(path).map_err(|error| format!("failed to read {}: {error}", path.display()))?;
        serde_json::from_slice(&bytes)
            .map_err(|error| format!("failed to parse {}: {error}", path.display()))
    }

    pub fn read_ndjson_path<T: DeserializeOwned>(path: &Path) -> Result<Vec<T>, String> {
        let contents = fs::read_to_string(path)
            .map_err(|error| format!("failed to read {}: {error}", path.display()))?;
        contents
            .lines()
            .filter(|line| !line.trim().is_empty())
            .map(|line| {
                serde_json::from_str::<T>(line).map_err(|error| {
                    format!("failed to parse NDJSON line in {}: {error}", path.display())
                })
            })
            .collect()
    }

    pub fn write_json_path<T: Serialize>(path: &Path, value: &T) -> Result<(), String> {
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)
                .map_err(|error| format!("failed to create {}: {error}", parent.display()))?;
        }
        let bytes = serde_json::to_vec_pretty(value)
            .map_err(|error| format!("failed to serialize {}: {error}", path.display()))?;
        fs::write(path, bytes)
            .map_err(|error| format!("failed to write {}: {error}", path.display()))
    }

    pub fn write_ndjson_path<T: Serialize>(path: &Path, values: &[T]) -> Result<(), String> {
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)
                .map_err(|error| format!("failed to create {}: {error}", parent.display()))?;
        }

        let mut body = String::new();
        for value in values {
            let line = serde_json::to_string(value)
                .map_err(|error| format!("failed to serialize {}: {error}", path.display()))?;
            body.push_str(&line);
            body.push('\n');
        }

        fs::write(path, body)
            .map_err(|error| format!("failed to write {}: {error}", path.display()))
    }

    pub fn write_text_if_missing(path: &Path, contents: &str) -> Result<(), String> {
        if path.exists() {
            return Ok(());
        }

        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)
                .map_err(|error| format!("failed to create {}: {error}", parent.display()))?;
        }

        fs::write(path, contents)
            .map_err(|error| format!("failed to write {}: {error}", path.display()))
    }
}

pub fn list_relative_files(root: &Path, prefix: &str) -> Result<Vec<String>, String> {
    let mut items = Vec::new();
    collect_relative_files(root, root, prefix, &mut items)?;
    items.sort();
    Ok(items)
}

pub fn remove_path(path: &Path) -> Result<(), String> {
    if path.is_dir() {
        fs::remove_dir_all(path)
            .map_err(|error| format!("failed to remove {}: {error}", path.display()))
    } else {
        fs::remove_file(path)
            .map_err(|error| format!("failed to remove {}: {error}", path.display()))
    }
}

pub fn copy_tree(source: &Path, destination: &Path, relative: &Path) -> Result<(), String> {
    if should_skip_snapshot_path(relative) {
        return Ok(());
    }

    if source.is_dir() {
        fs::create_dir_all(destination)
            .map_err(|error| format!("failed to create {}: {error}", destination.display()))?;
        for entry in fs::read_dir(source)
            .map_err(|error| format!("failed to read {}: {error}", source.display()))?
        {
            let entry = entry.map_err(|error| format!("failed to read entry: {error}"))?;
            let name = entry.file_name();
            let child_relative = if relative.as_os_str().is_empty() {
                PathBuf::from(&name)
            } else {
                relative.join(&name)
            };
            copy_tree(&entry.path(), &destination.join(name), &child_relative)?;
        }
        return Ok(());
    }

    if let Some(parent) = destination.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| format!("failed to create {}: {error}", parent.display()))?;
    }
    fs::copy(source, destination).map_err(|error| {
        format!(
            "failed to copy {} to {}: {error}",
            source.display(),
            destination.display()
        )
    })?;
    Ok(())
}

pub fn copy_template_tree(source: &Path, destination: &Path) -> Result<(), String> {
    if source.is_dir() {
        fs::create_dir_all(destination)
            .map_err(|error| format!("failed to create {}: {error}", destination.display()))?;
        for entry in fs::read_dir(source)
            .map_err(|error| format!("failed to read {}: {error}", source.display()))?
        {
            let entry = entry.map_err(|error| format!("failed to read entry: {error}"))?;
            let name = entry.file_name();
            copy_template_tree(&entry.path(), &destination.join(name))?;
        }
        return Ok(());
    }

    if let Some(parent) = destination.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| format!("failed to create {}: {error}", parent.display()))?;
    }
    fs::copy(source, destination).map_err(|error| {
        format!(
            "failed to copy {} to {}: {error}",
            source.display(),
            destination.display()
        )
    })?;
    Ok(())
}

pub fn copy_missing_template_tree(source: &Path, destination: &Path) -> Result<(), String> {
    if source.is_dir() {
        fs::create_dir_all(destination)
            .map_err(|error| format!("failed to create {}: {error}", destination.display()))?;
        for entry in fs::read_dir(source)
            .map_err(|error| format!("failed to read {}: {error}", source.display()))?
        {
            let entry = entry.map_err(|error| format!("failed to read entry: {error}"))?;
            let name = entry.file_name();
            copy_missing_template_tree(&entry.path(), &destination.join(name))?;
        }
        return Ok(());
    }

    if destination.exists() {
        return Ok(());
    }

    if let Some(parent) = destination.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| format!("failed to create {}: {error}", parent.display()))?;
    }
    fs::copy(source, destination).map_err(|error| {
        format!(
            "failed to copy {} to {}: {error}",
            source.display(),
            destination.display()
        )
    })?;
    Ok(())
}

fn collect_relative_files(
    root: &Path,
    current: &Path,
    prefix: &str,
    items: &mut Vec<String>,
) -> Result<(), String> {
    for entry in fs::read_dir(current)
        .map_err(|error| format!("failed to read {}: {error}", current.display()))?
    {
        let entry = entry.map_err(|error| format!("failed to read entry: {error}"))?;
        let path = entry.path();
        if path.is_dir() {
            collect_relative_files(root, &path, prefix, items)?;
            continue;
        }

        let relative = path
            .strip_prefix(root)
            .map_err(|error| format!("failed to relativize {}: {error}", path.display()))?;
        let relative = relative.to_string_lossy().replace('\\', "/");
        items.push(format!("{prefix}/{relative}"));
    }

    Ok(())
}

fn should_skip_snapshot_path(relative: &Path) -> bool {
    relative == Path::new("checkpoints") || relative == Path::new("exports/generated")
}
