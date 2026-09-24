"""Complete Rust source inventory and inherited policy, without compiling dependencies."""

import re
import subprocess
import tomllib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
POLICY_PATH = 'tests/support/rust_quality.toml'
LINTS = {
    'rust': {'unused_must_use': 'deny', 'unsafe_op_in_unsafe_fn': 'deny'},
    'clippy': {'await_holding_lock': 'deny', 'undocumented_unsafe_blocks': 'deny'},
}


def policy(root=ROOT):
    return tomllib.loads((root / POLICY_PATH).read_text())


def source_paths(root):
    return sorted(set(filter(None, subprocess.check_output(
        ['git', 'ls-files', '-c', '-o', '--exclude-standard', '-z'], cwd=root,
        timeout=30).decode().split('\0'))))


def check(root=ROOT, paths=None):
    """Reject unregistered workspaces, forgotten inheritance and unaccounted ignores."""
    root = Path(root)
    rules = policy(root)
    paths = source_paths(root) if paths is None else paths
    errors = []
    manifests = {name: tomllib.loads((root / name).read_text())
                 for name in paths if Path(name).name == 'Cargo.toml'}
    configured = {entry['manifest']: entry for entry in rules['workspaces']}
    if len(configured) != len(rules['workspaces']) or set(configured) != {
            name for name, value in manifests.items() if 'workspace' in value}:
        errors.append('workspace inventory differs from source')
    if {entry['lockfile'] for entry in configured.values()} != {
            name for name in paths if Path(name).name == 'Cargo.lock'}:
        errors.append('lockfile inventory differs from source')
    toolchain = tomllib.loads((root / 'rust-toolchain.toml').read_text())['toolchain']
    if (toolchain.get('channel') != rules['rust'] or toolchain.get('profile') != 'minimal'
            or set(toolchain.get('components', [])) != {'clippy', 'rustfmt'}):
        errors.append('canonical toolchain differs from quality policy')
    if any(Path(name).name in ('rust-toolchain', 'rust-toolchain.toml')
           and name != 'rust-toolchain.toml' for name in paths):
        errors.append('nested toolchain override')
    covered = set()
    for name, entry in configured.items():
        if name not in manifests:
            errors.append('configured workspace missing: ' + name)
            continue
        definition = manifests[name]
        workspace = definition['workspace']
        if workspace.get('package', {}).get('rust-version') != rules['rust']:
            errors.append('workspace rust-version differs: ' + name)
        for group, lints in LINTS.items():
            actual = workspace.get('lints', {}).get(group, {})
            if any(actual.get(lint) != level for lint, level in lints.items()):
                errors.append('workspace required lints differ: ' + name)
        directory = root / Path(name).parent
        members = {name} if 'package' in definition else set()
        for pattern in workspace.get('members', []):
            if Path(pattern).is_absolute() or '..' in Path(pattern).parts:
                errors.append('workspace member escapes source: ' + name)
                continue
            members.update(str((path / 'Cargo.toml').relative_to(root))
                           for path in directory.glob(pattern))
        for member in members:
            if member in covered or member not in manifests or 'package' not in manifests[member]:
                errors.append('missing or multiply owned member: ' + member)
                continue
            covered.add(member)
            package = manifests[member]
            if package['package'].get('rust-version') != {'workspace': True}:
                errors.append('member must inherit rust-version: ' + member)
            if package.get('lints') != {'workspace': True}:
                errors.append('member must inherit workspace lints: ' + member)
    if covered != {name for name, value in manifests.items() if 'package' in value}:
        errors.append('package missing from workspace inventory')
    actual_features = {(name, tuple(sorted(target['required-features'])))
                       for name, value in manifests.items() for target in value.get('test', [])
                       if target.get('required-features')}
    registered_features = [(entry['manifest'], tuple(sorted(entry['features'])))
                           for entry in rules['feature_tests']]
    if set(registered_features) != actual_features or len(registered_features) != len(set(registered_features)):
        errors.append('feature-gated test inventory differs from source')
    observed = []
    for name in paths:
        if Path(name).suffix == '.rs':
            text = (root / name).read_text()
            # Include cfg_attr(ignore), bare ignore and multiline attributes. Unknown forms fail.
            for match in re.finditer(r'#\s*\[\s*(?:ignore\b[^\]]*|cfg_attr\([^\]]*\bignore\b[^\]]*)\]', text):
                function = re.match(r'\s*(?:async\s+)?fn\s+(\w+)\s*\(', text[match.end():])
                observed.append((name, function.group(1) if function else '<unrecognized>'))
    registered = [(entry['path'], entry['name'].split('::')[-1]) for entry in rules['ignored_tests']]
    if sorted(observed) != sorted(registered) or len(set(registered)) != len(registered):
        errors.append('ignored test inventory differs from source')
    from tests.support.check_catalog import catalog
    scenarios = catalog()
    for entry in [*rules['workspaces'], *rules['ignored_tests'], *rules['feature_tests']]:
        if entry['scenario'] not in scenarios:
            errors.append('inventory references an unregistered scenario')
    if any(not entry.get('reason') or entry.get('platform') not in ('Linux', 'Darwin')
           for entry in rules['ignored_tests']):
        errors.append('ignored test lacks platform or execution reason')
    return {'status': 'FAIL' if errors else 'PASS', 'errors': errors,
            'workspaces': len(configured), 'packages': len(covered), 'rust': rules['rust']}


if __name__ == '__main__':
    import json
    result = check()
    print(json.dumps(result))
    raise SystemExit(result['status'] != 'PASS')
