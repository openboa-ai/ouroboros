//! Inventory-bound prepared recovery sets. This command never stops or starts a company.
use anyhow::{Result, ensure};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{
    collections::BTreeMap,
    fs::{self, File, Metadata, OpenOptions},
    io::{Read, Write},
    os::unix::fs::{DirBuilderExt, MetadataExt, OpenOptionsExt},
    path::{Component, Path, PathBuf},
};

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Spec {
    firm_id: uuid::Uuid,
    generation: uuid::Uuid,
    cutoff_record: String,
    roots: BTreeMap<String, PathBuf>,
    max_bytes: u64,
    max_entries: usize,
}
#[derive(Serialize, Deserialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
struct Entry {
    directory: bool,
    bytes: u64,
    sha256: Option<String>,
    mode: u32,
    uid: u32,
    gid: u32,
}
#[derive(Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct Inventory {
    format: String,
    firm_id: uuid::Uuid,
    generation: uuid::Uuid,
    cutoff_record: String,
    entries: BTreeMap<String, Entry>,
}
fn bounds(bytes: u64, entries: usize) -> Result<()> {
    ensure!(
        (1..=1_099_511_627_776).contains(&bytes) && (1..=100_000).contains(&entries),
        "finite recovery limits required"
    );
    Ok(())
}
fn safe_name(s: &str) -> bool {
    !s.is_empty()
        && s.len() <= 4096
        && !s.contains('\\')
        && !s.chars().any(char::is_control)
        && Path::new(s)
            .components()
            .all(|c| matches!(c, Component::Normal(_)))
        && !Path::new(s).is_absolute()
}
fn open(path: &Path) -> Result<File> {
    ensure!(
        path.is_absolute() && path.canonicalize()? == path,
        "exact absolute regular-file path required"
    );
    let f = OpenOptions::new()
        .read(true)
        .custom_flags(libc::O_NOFOLLOW | libc::O_NONBLOCK)
        .open(path)?;
    let m = f.metadata()?;
    ensure!(
        m.is_file()
            && m.mode() & 0o022 == 0
            && (m.uid() == unsafe { libc::geteuid() }
                || m.uid() == 0
                || unsafe { libc::geteuid() } == 0),
        "protected regular file required"
    );
    Ok(f)
}
fn hash(mut reader: impl Read) -> Result<String> {
    let mut h = Sha256::new();
    std::io::copy(&mut reader, &mut h)?;
    Ok(format!("{:x}", h.finalize()))
}
fn identity(m: &Metadata) -> (u64, u64, u64, i64, i64, i64, i64) {
    (
        m.dev(),
        m.ino(),
        m.len(),
        m.mtime(),
        m.mtime_nsec(),
        m.ctime(),
        m.ctime_nsec(),
    )
}
fn walk(
    path: &Path,
    name: &str,
    spec: &Spec,
    entries: &mut BTreeMap<String, Entry>,
    paths: &mut BTreeMap<String, PathBuf>,
    total: &mut u64,
) -> Result<()> {
    ensure!(
        safe_name(name) && entries.len() < spec.max_entries,
        "invalid path or entry bound exceeded"
    );
    let m = fs::symlink_metadata(path)?;
    ensure!(
        (m.is_dir() || m.is_file())
            && m.mode() & 0o022 == 0
            && (m.uid() == unsafe { libc::geteuid() } || unsafe { libc::geteuid() } == 0),
        "unsupported or unprotected recovery entry"
    );
    let digest = if m.is_file() {
        *total = total
            .checked_add(m.len())
            .ok_or_else(|| anyhow::anyhow!("size overflow"))?;
        ensure!(*total <= spec.max_bytes, "recovery size bound exceeded");
        let mut f = open(path)?;
        ensure!(identity(&f.metadata()?) == identity(&m), "source replaced");
        let digest = hash((&mut f).take(m.len() + 1))?;
        ensure!(identity(&f.metadata()?) == identity(&m), "source changed");
        Some(digest)
    } else {
        None
    };
    entries.insert(
        name.into(),
        Entry {
            directory: m.is_dir(),
            bytes: if m.is_dir() { 0 } else { m.len() },
            sha256: digest,
            mode: m.mode() & 0o777,
            uid: m.uid(),
            gid: m.gid(),
        },
    );
    paths.insert(name.into(), path.into());
    if m.is_dir() {
        let mut children = fs::read_dir(path)?.collect::<std::io::Result<Vec<_>>>()?;
        children.sort_by_key(|e| e.file_name());
        for child in children {
            let child_name = child
                .file_name()
                .into_string()
                .map_err(|_| anyhow::anyhow!("UTF-8 recovery path required"))?;
            walk(
                &child.path(),
                &format!("{name}/{child_name}"),
                spec,
                entries,
                paths,
                total,
            )?;
        }
        ensure!(
            identity(&fs::symlink_metadata(path)?) == identity(&m),
            "source directory changed"
        );
    }
    Ok(())
}
fn inventory(spec: &Spec) -> Result<(Inventory, BTreeMap<String, PathBuf>)> {
    bounds(spec.max_bytes, spec.max_entries)?;
    ensure!(
        !spec.firm_id.is_nil()
            && !spec.generation.is_nil()
            && !spec.cutoff_record.is_empty()
            && spec.cutoff_record.len() <= 1024,
        "recovery identity and cutoff reference required"
    );
    ensure!(
        ["postgres", "content", "configuration", "recovery"]
            .iter()
            .all(|n| spec.roots.contains_key(*n))
            && spec.roots.len() == 4,
        "complete four-root recovery selection required"
    );
    let mut entries = BTreeMap::new();
    let mut paths = BTreeMap::new();
    let mut total = 0;
    for (name, root) in &spec.roots {
        ensure!(
            root.is_absolute() && root.canonicalize()? == *root && root.is_dir(),
            "exact recovery root required"
        );
        walk(root, name, spec, &mut entries, &mut paths, &mut total)?;
    }
    Ok((
        Inventory {
            format: "ouroboros-prepared-recovery-1".into(),
            firm_id: spec.firm_id,
            generation: spec.generation,
            cutoff_record: spec.cutoff_record.clone(),
            entries,
        },
        paths,
    ))
}
fn verify(path: &Path, expected: &str, max_bytes: u64, max_entries: usize) -> Result<Inventory> {
    bounds(max_bytes, max_entries)?;
    let file = open(path)?;
    let before = file.metadata()?;
    ensure!(
        before.len() <= max_bytes + max_entries as u64 * 8192 + 32 * 1024 * 1024,
        "archive exceeds byte envelope"
    );
    ensure!(hash(file)? == expected, "archive digest mismatch");
    // The normal TAR iterator materializes GNU/PAX extension payloads before returning entries.
    // Bound raw metadata first, using seeks over content rather than allocating extension bodies.
    let mut raw = tar::Archive::new(open(path)?);
    for (index, entry) in raw.entries_with_seek()?.raw(true).enumerate() {
        ensure!(
            index < max_entries * 2 + 1,
            "raw archive entry bound exceeded"
        );
        let entry = entry?;
        let kind = entry.header().entry_type();
        ensure!(
            kind.is_file() || kind.is_dir() || kind.is_gnu_longname(),
            "unsupported recovery metadata"
        );
        if kind.is_gnu_longname() {
            ensure!(
                entry.size() <= 4097,
                "archive pathname metadata exceeds bound"
            );
        } else {
            ensure!(
                entry.size() <= max_bytes.max(16 * 1024 * 1024),
                "archive entry size exceeds bound"
            );
        }
    }
    let mut archive = tar::Archive::new(open(path)?);
    let mut items = archive.entries()?;
    let mut first = items
        .next()
        .ok_or_else(|| anyhow::anyhow!("missing inventory"))??;
    ensure!(
        first.path()?.as_ref() == Path::new("inventory.json")
            && first.header().entry_type().is_file()
            && first.size() <= 16 * 1024 * 1024,
        "invalid recovery inventory entry"
    );
    let mut bytes = Vec::new();
    first.read_to_end(&mut bytes)?;
    let inv: Inventory = serde_json::from_slice(&bytes)?;
    ensure!(
        inv.format == "ouroboros-prepared-recovery-1"
            && inv.entries.len() <= max_entries
            && !inv.firm_id.is_nil()
            && !inv.generation.is_nil(),
        "invalid recovery inventory"
    );
    let roots = ["postgres", "content", "configuration", "recovery"];
    ensure!(
        roots
            .iter()
            .all(|name| inv.entries.get(*name).is_some_and(|e| e.directory)),
        "missing recovery root"
    );
    for (name, entry) in &inv.entries {
        ensure!(
            safe_name(name)
                && roots.contains(&name.split('/').next().unwrap())
                && entry.mode <= 0o777
                && entry.mode & 0o022 == 0
                && (!entry.directory || (entry.bytes == 0 && entry.sha256.is_none())),
            "invalid inventory member"
        );
        if let Some(parent) = Path::new(name)
            .parent()
            .filter(|p| !p.as_os_str().is_empty())
        {
            ensure!(
                inv.entries
                    .get(parent.to_str().unwrap())
                    .is_some_and(|e| e.directory),
                "missing directory ancestor"
            );
        }
    }
    let mut observed = BTreeMap::new();
    let mut total = 0u64;
    for item in items {
        let mut item = item?;
        let name = item
            .path()?
            .to_str()
            .ok_or_else(|| anyhow::anyhow!("UTF-8 entry required"))?
            .to_owned();
        ensure!(
            safe_name(&name) && !observed.contains_key(&name) && observed.len() < max_entries,
            "duplicate or unsafe entry"
        );
        let e = inv
            .entries
            .get(&name)
            .ok_or_else(|| anyhow::anyhow!("unlisted archive entry"))?;
        let h = item.header();
        ensure!(
            (e.directory && h.entry_type().is_dir()) || (!e.directory && h.entry_type().is_file()),
            "entry type mismatch"
        );
        ensure!(
            h.size()? == e.bytes
                && h.mode()? == e.mode
                && h.uid()? == u64::from(e.uid)
                && h.gid()? == u64::from(e.gid),
            "entry metadata mismatch"
        );
        total = total
            .checked_add(e.bytes)
            .ok_or_else(|| anyhow::anyhow!("size overflow"))?;
        ensure!(total <= max_bytes, "content bound exceeded");
        let digest = if e.directory {
            None
        } else {
            Some(hash(&mut item)?)
        };
        ensure!(digest == e.sha256, "entry content mismatch");
        observed.insert(name, ());
    }
    ensure!(
        observed.len() == inv.entries.len(),
        "missing recovery entries"
    );
    ensure!(
        identity(&open(path)?.metadata()?) == identity(&before),
        "archive changed during verification"
    );
    Ok(inv)
}

/// Verify the complete inventory before creating any isolated output path.
pub(crate) fn stage(
    archive: &Path,
    expected_sha256: &str,
    max_bytes: u64,
    max_entries: usize,
    staging_directory: &Path,
) -> Result<serde_json::Value> {
    let inv = verify(archive, expected_sha256, max_bytes, max_entries)?;
    ensure!(
        staging_directory.is_absolute() && !staging_directory.exists(),
        "new isolated staging directory required"
    );
    let parent = staging_directory
        .parent()
        .ok_or_else(|| anyhow::anyhow!("staging parent required"))?;
    ensure!(
        parent.canonicalize()? == parent,
        "exact staging parent required"
    );
    let parent_file = File::open(parent)?;
    let m = parent_file.metadata()?;
    ensure!(
        m.is_dir() && m.uid() == unsafe { libc::geteuid() } && m.mode() & 0o077 == 0,
        "private staging parent required"
    );
    fs::DirBuilder::new()
        .mode(0o700)
        .create(staging_directory)?;
    parent_file.sync_all()?;
    // Create only verified directories. Never apply archived ownership or executable modes.
    for (name, e) in &inv.entries {
        if e.directory {
            fs::DirBuilder::new()
                .mode(0o700)
                .create(staging_directory.join(name))?;
        }
    }
    let mut tar = tar::Archive::new(open(archive)?);
    let mut items = tar.entries()?;
    let first = items
        .next()
        .ok_or_else(|| anyhow::anyhow!("inventory disappeared"))??;
    ensure!(
        first.path()?.as_ref() == Path::new("inventory.json"),
        "inventory changed"
    );
    drop(first);
    let mut seen = BTreeMap::new();
    for item in items {
        let mut item = item?;
        let name = item
            .path()?
            .to_str()
            .ok_or_else(|| anyhow::anyhow!("UTF-8 entry required"))?
            .to_owned();
        let e = inv
            .entries
            .get(&name)
            .ok_or_else(|| anyhow::anyhow!("archive changed membership"))?;
        ensure!(
            !seen.contains_key(&name)
                && item.size() == e.bytes
                && ((e.directory && item.header().entry_type().is_dir())
                    || (!e.directory && item.header().entry_type().is_file())),
            "archive changed entry"
        );
        if !e.directory {
            let target = staging_directory.join(&name);
            let mut file = OpenOptions::new()
                .write(true)
                .create_new(true)
                .mode(0o600)
                .open(&target)?;
            ensure!(
                std::io::copy(&mut item, &mut file)? == e.bytes,
                "staged length mismatch"
            );
            file.sync_all()?;
            ensure!(
                Some(hash(open(&target)?)?) == e.sha256,
                "staged content mismatch"
            );
        }
        seen.insert(name, ());
    }
    ensure!(
        seen.len() == inv.entries.len() && hash(open(archive)?)? == expected_sha256,
        "archive changed during staging"
    );
    let inventory_bytes = serde_json::to_vec(&inv)?;
    let mut record = OpenOptions::new()
        .write(true)
        .create_new(true)
        .mode(0o600)
        .open(staging_directory.join("inventory.json"))?;
    record.write_all(&inventory_bytes)?;
    record.sync_all()?;
    for (name, e) in inv.entries.iter().rev() {
        if e.directory {
            File::open(staging_directory.join(name))?.sync_all()?;
        }
    }
    let directory = File::open(staging_directory)?;
    directory.sync_all()?;
    let receipt = serde_json::json!({"status":"staged_candidate", "archive_sha256":expected_sha256,
    "entries":inv.entries.len(),"firm_id":inv.firm_id,"generation":inv.generation,
    "archived_ownership_applied":false,"services_started":false,"coherence_verified":false,"authority_granted":false});
    let mut record = OpenOptions::new()
        .write(true)
        .create_new(true)
        .mode(0o600)
        .open(staging_directory.join("STAGED.json"))?;
    record.write_all(&serde_json::to_vec(&receipt)?)?;
    record.sync_all()?;
    directory.sync_all()?;
    Ok(receipt)
}

pub(crate) fn create(spec: &Path, output: &Path) -> Result<serde_json::Value> {
    let input = open(spec)?;
    ensure!(input.metadata()?.len() <= 65536, "spec too large");
    let spec: Spec = serde_json::from_reader(input)?;
    let (inv, paths) = inventory(&spec)?;
    ensure!(
        output.is_absolute() && !output.exists(),
        "new absolute archive destination required"
    );
    let parent = output
        .parent()
        .ok_or_else(|| anyhow::anyhow!("destination parent required"))?;
    ensure!(
        parent.canonicalize()? == parent && !spec.roots.values().any(|p| parent.starts_with(p)),
        "archive destination must be outside source roots"
    );
    let directory = File::open(parent)?;
    let m = directory.metadata()?;
    ensure!(
        m.is_dir() && m.uid() == unsafe { libc::geteuid() } && m.mode() & 0o077 == 0,
        "private destination required"
    );
    let mut name = output.as_os_str().to_owned();
    name.push(".partial");
    let partial = PathBuf::from(name);
    let f = OpenOptions::new()
        .write(true)
        .create_new(true)
        .mode(0o600)
        .open(&partial)?;
    let mut tar = tar::Builder::new(f);
    let bytes = serde_json::to_vec(&inv)?;
    ensure!(bytes.len() <= 16 * 1024 * 1024, "inventory exceeds bound");
    let mut h = tar::Header::new_gnu();
    h.set_size(bytes.len() as u64);
    h.set_mode(0o600);
    h.set_cksum();
    tar.append_data(&mut h, "inventory.json", &bytes[..])?;
    for (name, e) in &inv.entries {
        let mut h = tar::Header::new_gnu();
        h.set_size(e.bytes);
        h.set_mode(e.mode);
        h.set_uid(e.uid.into());
        h.set_gid(e.gid.into());
        h.set_entry_type(if e.directory {
            tar::EntryType::Directory
        } else {
            tar::EntryType::Regular
        });
        h.set_cksum();
        if e.directory {
            tar.append_data(&mut h, name, std::io::empty())?;
        } else {
            tar.append_data(&mut h, name, open(&paths[name])?)?;
        }
    }
    tar.finish()?;
    let mut f = tar.into_inner()?;
    f.flush()?;
    f.sync_all()?;
    drop(f);
    let digest = hash(open(&partial)?)?;
    verify(&partial, &digest, spec.max_bytes, spec.max_entries)?;
    ensure!(
        inventory(&spec)?.0.entries == inv.entries,
        "source inventory changed during archive creation"
    );
    fs::hard_link(&partial, output)?;
    directory.sync_all()?;
    fs::remove_file(&partial)?;
    directory.sync_all()?;
    Ok(
        serde_json::json!({"status":"prepared_recovery_candidate","sha256":digest,"bytes":fs::metadata(output)?.len(),"entries":inv.entries.len(),"coherence_verified":false,"independent_destination_verified":false,"authority_granted":false}),
    )
}

pub(crate) fn verify_report(
    archive: &Path,
    expected_sha256: &str,
    max_bytes: u64,
    max_entries: usize,
) -> Result<serde_json::Value> {
    let inv = verify(archive, expected_sha256, max_bytes, max_entries)?;
    Ok(
        serde_json::json!({"status":"inventory_verified","entries":inv.entries.len(),"firm_id":inv.firm_id,"generation":inv.generation,"coherence_verified":false,"authority_granted":false}),
    )
}
