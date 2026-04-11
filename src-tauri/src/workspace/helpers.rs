use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use serde_json;
use sha2::{Digest, Sha256};
use uuid::Uuid;

use crate::models::{DecisionEntry, LaneEventState};

use super::contracts::{CollectionEntryFile, EvalSummaryRecord, LaneEvent, TimeRangeFile};

pub(super) fn prepend_decision(decisions: &mut Vec<DecisionEntry>, decision: DecisionEntry) {
    decisions.insert(0, decision);
}

pub(super) fn lane_event_feed(
    position_events: &[LaneEvent],
    order_events: &[LaneEvent],
) -> Vec<LaneEventState> {
    let mut items = position_events
        .iter()
        .map(|event| LaneEventState {
            id: event.event_id.clone(),
            scope: "positions".into(),
            kind: event.kind.clone(),
            summary: event.summary.clone(),
            timestamp: event.timestamp.clone(),
        })
        .chain(order_events.iter().map(|event| LaneEventState {
            id: event.event_id.clone(),
            scope: "orders".into(),
            kind: event.kind.clone(),
            summary: event.summary.clone(),
            timestamp: event.timestamp.clone(),
        }))
        .collect::<Vec<_>>();

    items.sort_by(|left, right| right.timestamp.cmp(&left.timestamp));
    items
}

pub(super) fn checkpoint_tone(checkpoint_type: &str) -> &'static str {
    match checkpoint_type {
        "promotion" => "positive",
        "incident" => "danger",
        _ => "warning",
    }
}

pub(super) fn protected_workspace_root_refs() -> &'static [&'static str] {
    &[
        "checkpoints",
        "imports",
        "operations",
        "exports/generated",
        "secrets",
        "credentials",
    ]
}

pub(super) fn default_imports_ref() -> String {
    "./imports/index.json".into()
}

pub(super) fn default_orchestrator_ref() -> String {
    "./orchestrator/orchestrator.json".into()
}

pub(super) fn default_agents_ref() -> String {
    "./agents/index.json".into()
}

pub(super) fn default_environments_ref() -> String {
    "./environments/index.json".into()
}

pub(super) fn default_operations_ref() -> String {
    "./operations/index.json".into()
}

pub(super) fn uuid_v7_string() -> String {
    Uuid::now_v7().to_string()
}

pub(super) fn blob_id_for_contents(contents: &str) -> String {
    format!("sha256:{:x}", Sha256::digest(contents.as_bytes()))
}

pub(super) fn collection_entries_hash(entries: &[CollectionEntryFile]) -> Result<String, String> {
    let mut body = String::new();
    for entry in entries {
        let line = serde_json::to_string(entry).map_err(|error| {
            format!("failed to serialize collection entry for hashing: {error}")
        })?;
        body.push_str(&line);
        body.push('\n');
    }
    Ok(blob_id_for_contents(&body))
}

pub(super) fn utc_hour_bucket(event_time: &str) -> Result<String, String> {
    if event_time.len() < 13 {
        return Err(format!(
            "event_time is too short for UTC hour bucketing: {event_time}"
        ));
    }
    let prefix = &event_time[..13];
    if !event_time.contains('T') {
        return Err(format!("event_time must contain T separator: {event_time}"));
    }
    Ok(format!("{prefix}:00:00Z"))
}

pub(super) fn merge_time_range<'a, I>(times: I) -> Result<TimeRangeFile, String>
where
    I: IntoIterator<Item = &'a str>,
{
    let mut iter = times.into_iter();
    let first = iter
        .next()
        .ok_or_else(|| "collection must contain at least one entry".to_string())?;
    let mut min = first.to_string();
    let mut max = first.to_string();

    for time in iter {
        if time < min.as_str() {
            min = time.to_string();
        }
        if time > max.as_str() {
            max = time.to_string();
        }
    }

    Ok(TimeRangeFile {
        start: min,
        end: max,
    })
}

pub(super) fn short_alias_suffix() -> String {
    Uuid::now_v7()
        .simple()
        .to_string()
        .chars()
        .take(8)
        .collect()
}

pub(super) fn short_blob_label(blob_id: &str) -> String {
    blob_id
        .split(':')
        .nth(1)
        .unwrap_or(blob_id)
        .chars()
        .take(12)
        .collect()
}

pub(super) fn collection_entry_document_path_for_root(
    workspace_root: &Path,
    collection_id: &str,
    entry_id: &str,
) -> PathBuf {
    workspace_root
        .join("collections")
        .join("items")
        .join(collection_id)
        .join("entries")
        .join(format!("{entry_id}.json"))
}

pub(super) fn collection_entry_blob_path_ref(blob_id: &str) -> String {
    let (algorithm, digest) = blob_id.split_once(':').unwrap_or(("sha256", blob_id));
    format!("../../../../blobs/{algorithm}/{digest}.txt")
}

pub(super) fn workspace_root_for_collection_path(
    collection_path: &Path,
) -> Result<PathBuf, String> {
    let collection_root = collection_path.parent().ok_or_else(|| {
        format!(
            "collection path has no parent: {}",
            collection_path.display()
        )
    })?;
    let items_root = collection_root.parent().ok_or_else(|| {
        format!(
            "collection root has no items parent: {}",
            collection_root.display()
        )
    })?;
    let collections_root = items_root.parent().ok_or_else(|| {
        format!(
            "items root has no collections parent: {}",
            items_root.display()
        )
    })?;
    collections_root
        .parent()
        .map(Path::to_path_buf)
        .ok_or_else(|| {
            format!(
                "collections root has no workspace parent: {}",
                collections_root.display()
            )
        })
}

pub(super) fn now_label() -> String {
    let seconds = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    format!("UTC epoch {seconds}")
}

pub(super) fn slugish_id(input: &str) -> String {
    let normalized = input
        .chars()
        .map(|ch| {
            if ch.is_ascii_alphanumeric() {
                ch.to_ascii_lowercase()
            } else {
                '-'
            }
        })
        .collect::<String>();
    normalized
        .split('-')
        .filter(|segment| !segment.is_empty())
        .collect::<Vec<_>>()
        .join("-")
}

pub(super) fn path_leaf_label(path_ref: &str) -> String {
    Path::new(path_ref)
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or(path_ref)
        .to_string()
}

pub(super) fn checkpoint_id_from_ref(reference: &str) -> Option<String> {
    let clean_reference = reference.split('#').next().unwrap_or(reference);
    Path::new(clean_reference)
        .parent()
        .and_then(Path::file_name)
        .and_then(|value| value.to_str())
        .map(str::to_string)
}

pub(super) fn canonicalize_or_clone(path: &Path) -> PathBuf {
    path.canonicalize().unwrap_or_else(|_| path.to_path_buf())
}

pub(super) fn paths_match(left: &Path, right: &Path) -> bool {
    canonicalize_or_clone(left) == canonicalize_or_clone(right)
}

pub(super) fn search_excerpt(content: &str, query: &str) -> Option<String> {
    content
        .lines()
        .find(|line| line.to_lowercase().contains(query))
        .map(|line| line.trim().chars().take(180).collect::<String>())
        .filter(|line| !line.is_empty())
}

pub(super) fn search_match_rank(kind: &str) -> u8 {
    match kind {
        "metadata" => 2,
        "content" => 1,
        _ => 0,
    }
}

pub(super) fn summary_position_hash(summary: &EvalSummaryRecord) -> String {
    let seed = summary
        .headline
        .as_deref()
        .or_else(|| summary.evidence_refs.first().map(String::as_str))
        .unwrap_or("summary");
    slugish_id(seed)
}
