#!/usr/bin/env python3
"""One deterministic plan/run/report entry point for local checks and CI.

Reports are evidence about this exact source set. They do not enroll a deployment,
authorize a provider call, or substitute for testing on the required platform.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import signal
import secrets
import subprocess
import sys
import time

from check_catalog import aggregate_results, build_plan, catalog, validate_plan
from check_integrity import check as integrity

ROOT = Path(__file__).resolve().parent.parent


def git(*arguments):
    return subprocess.check_output(['git', '-c', 'safe.directory=' + str(ROOT), *arguments], cwd=ROOT).decode()


def source_digest():
    names = set(git('ls-files', '-c', '-o', '--exclude-standard', '-z').split('\0'))
    digest = hashlib.sha256()
    for name in sorted(filter(None, names)):
        path = ROOT / name
        if path.is_symlink():
            digest.update(name.encode() + b'\0link\0' + os.fsencode(os.readlink(path)) + b'\0')
        elif path.is_file():
            executable = b'x' if path.stat().st_mode & 0o111 else b'-'
            digest.update(name.encode() + b'\0file\0' + executable + hashlib.sha256(path.read_bytes()).digest())
    return digest.hexdigest()


def write_json(path, data):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    # Reports contain no raw fixture output; underlying logs stay local and private.
    with path.open('x') as output:
        os.fchmod(output.fileno(), 0o600)
        json.dump(data, output, indent=2)
        output.write('\n')


def environment(path):
    if path is None:
        return {}
    value = json.loads(Path(path).read_text())
    if not isinstance(value, dict):
        raise ValueError('environment must be an object')
    return value


def configured(config, name, *, directory=True):
    path = Path(config[name])
    if not path.is_absolute() or path.resolve(strict=True) != path:
        raise ValueError(f'{name} requires an exact existing absolute path')
    if directory and not path.is_dir():
        raise ValueError(f'{name} requires a directory')
    return str(path)


def commands(identifier, config):
    python = sys.executable
    scripts = ROOT / 'scripts'
    if identifier == 'rust.invariants':
        target = configured(config, 'target_dir')
        common = ['--workspace', '--all-targets', '--locked', '--offline', '--target-dir', target]
        return [(['cargo', 'fmt', '--all', '--check'], 120),
                (['cargo', 'clippy', *common, '--all-features', '--', '-D', 'warnings'], 1200),
                (['cargo', 'test', *common], 1200),
                (['cargo', 'build', '--workspace', '--bins', '--locked', '--offline', '--target-dir', target], 1200)]
    if identifier == 'tooling.contracts':
        names = ['test-build-profile.py', 'test-fixture-config.py', 'test-fixture-release.py',
                 'test-check-catalog.py', 'test-check-runner.py', 'test-check-build.py',
                 'test-ci-environment.py', 'test-postgres-suite.py', 'test-native-suite-contract.py']
        return [([python, str(scripts / name)], 180) for name in names]
    if identifier == 'config.startup':
        require_build(config)
        return [([python, str(scripts / 'test-config-startup.py'), '--bin-dir', configured(config, 'bin_dir')], 180)]
    if identifier in ('core.transactions', 'core.mutations', 'resources.receipts', 'ingress.api_cli', 'resources.api', 'conversations.api', 'wake.api'):
        require_build(config)
        suite = {'core.transactions': 'core-db', 'core.mutations': 'control-mutations', 'resources.receipts': 'resources-db', 'ingress.api_cli': 'api-cli',
                 'resources.api': 'resource-api', 'conversations.api': 'conversation-api', 'wake.api': 'wake-api'}[identifier]
        return [([python, str(scripts / 'run-postgres-suite.py'), '--source-root', str(ROOT),
                  '--binary-dir', configured(config, 'bin_dir'), '--pg-bin', configured(config, 'pg_bin'),
                  '--scratch-root', configured(config, 'scratch_root'), '--suite', suite, '--offline'], 1500)]
    if identifier.startswith('native.'):
        native_path = configured(config, 'native_environment', directory=False)
        native = environment(native_path)
        if Path(native.get('source_root', '')).resolve() != ROOT:
            raise ValueError('native source root must be this checkout')
        return [([python, str(scripts / 'run-native-suite.py'), '--environment',
                  native_path, '--scenario', identifier,
                  '--run-name', identifier.replace('.', '-')[:23] + '-' + secrets.token_hex(4)], 1800)]
    if identifier.startswith('recovery.'):
        require_build(config)
        binary = Path(configured(config, 'bin_dir'))
        paths = [('seal', binary / 'ouroboros-backup-seal'), ('open', binary / 'ouroboros-backup-open'),
                 ('age', configured(config, 'age', directory=False)), ('keygen', configured(config, 'keygen', directory=False)),
                 ('fixture-parent', configured(config, 'scratch_root'))]
        script = {'recovery.crypto': 'test-backup-seal.py', 'recovery.archive': 'test-recovery-archive.py',
                  'recovery.postgres': 'test-recovery-postgres.py'}[identifier]
        if identifier != 'recovery.crypto':
            paths.append(('archive', binary / 'ouroboros-recovery-archive'))
        if identifier == 'recovery.postgres':
            paths.extend([('pg-bin', configured(config, 'pg_bin')), ('source-root', ROOT)])
        cmd = [python, str(scripts / script)]
        for name, path in paths:
            cmd.extend(['--' + name, str(path)])
        if identifier == 'recovery.postgres':
            cmd.append('--inspection')
        return [(cmd, 300)]
    raise ValueError('scenario has no executable driver')


def require_build(config):
    from check_build import validate_build
    return validate_build(ROOT, config, source_digest())


def execute(command, timeout, log):
    # Build tool locations are environment inputs; Python/account/proxy/DB settings
    # are not. In particular optimization must never remove an assertion oracle.
    allowed = {'PATH', 'HOME', 'TMPDIR', 'TEMP', 'TMP', 'CARGO_HOME', 'RUSTUP_HOME',
               'RUSTUP_TOOLCHAIN', 'CARGO_INCREMENTAL', 'CARGO_PROFILE_DEV_DEBUG', 'CARGO_PROFILE_TEST_DEBUG',
               'LANG', 'LC_ALL', 'SYSTEMROOT', 'SDKROOT', 'DEVELOPER_DIR'}
    env = {key: value for key, value in os.environ.items() if key in allowed}
    child = subprocess.Popen(command, cwd=ROOT, env=env, stdin=subprocess.DEVNULL,
                             stdout=log, stderr=log, start_new_session=True)
    try:
        return child.wait(timeout=timeout)
    except (subprocess.TimeoutExpired, KeyboardInterrupt):
        try:
            os.killpg(child.pid, signal.SIGTERM)
        except ProcessLookupError:
            pass
        try:
            child.wait(timeout=90)
        except subprocess.TimeoutExpired:
            pass
        # The leader may exit while a descendant ignores TERM. Address the group,
        # not just the leader, before reporting the bounded invocation as finished.
        try:
            os.killpg(child.pid, signal.SIGKILL)
        except ProcessLookupError:
            pass
        child.wait(timeout=5)
        raise


def run(plan, lane, config, result_file):
    current = source_digest()
    validate_plan(plan, source_digest=current)
    definitions = catalog()
    selected = [name for name in plan['selected'] if definitions[name]['lane'] == lane]
    if not selected:
        raise ValueError('requested lane has no selected scenarios')
    if Path(result_file).exists() or Path(result_file).is_symlink():
        raise FileExistsError('result already exists')
    results = []
    source_changed = False
    native_failed = False
    for identifier in selected:
        start = time.monotonic()
        record = dict(id=identifier, status='FAIL', plan_digest=plan['plan_digest'], source_digest=current)
        log_path = Path(result_file).parent / (identifier + '.private.log')
        log_path.parent.mkdir(parents=True, exist_ok=True)
        try:
            if native_failed:
                record.update(status='NOT RUN', failure_kind='prior_native_failure')
            elif source_changed or source_digest() != current:
                source_changed = True
                record.update(status='NOT RUN', failure_kind='source_changed')
            elif identifier == 'repository.integrity':
                record['status'] = integrity(ROOT)['status']
            else:
                if identifier.startswith('native.'):
                    require_build(config)
                    native = environment(configured(config, 'native_environment', directory=False))
                    if native.get('bin_dir') != configured(config, 'bin_dir'):
                        raise ValueError('native binaries must match the verified build')
                with log_path.open('xb') as log:
                    os.fchmod(log.fileno(), 0o600)
                    for command, timeout in commands(identifier, config):
                        if source_digest() != current:
                            source_changed = True
                            record['failure_kind'] = 'source_changed'
                            break
                        result = execute(command, timeout, log)
                        if source_digest() != current:
                            source_changed = True
                            record['failure_kind'] = 'source_changed'
                            break
                        if result:
                            record['exit_code'] = result
                            break
                    else:
                        record['status'] = 'PASS'
        except (OSError, ValueError, KeyError, subprocess.TimeoutExpired) as error:
            record['failure_kind'] = type(error).__name__
        record['duration_seconds'] = round(time.monotonic() - start, 3)
        if source_digest() != current:
            source_changed = True
            if record['status'] != 'NOT RUN':
                record.update(status='FAIL', failure_kind='source_changed')
        results.append(record)
        if lane == 'native' and record['status'] != 'PASS':
            # A native failure may include incomplete host-level cleanup. Do not
            # launch another fixture on the same host until it is reconciled.
            native_failed = True
        print(json.dumps(record), flush=True)
    write_json(result_file, results)
    return all(result['status'] == 'PASS' for result in results)


def main():
    if not __debug__:
        raise ValueError('optimized Python cannot execute validation')
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest='command', required=True)
    plan = sub.add_parser('plan')
    plan.add_argument('--base')
    plan.add_argument('--head', default='HEAD')
    plan.add_argument('--full', action='store_true')
    plan.add_argument('--output', required=True, type=Path)
    run_parser = sub.add_parser('run')
    run_parser.add_argument('--plan', required=True, type=Path)
    run_parser.add_argument('--lane', required=True, choices=['integrity', 'fast', 'postgres', 'native', 'recovery'])
    run_parser.add_argument('--environment', type=Path)
    run_parser.add_argument('--output', required=True, type=Path)
    report = sub.add_parser('report')
    report.add_argument('--plan', required=True, type=Path)
    report.add_argument('--results', required=True, nargs='+', type=Path)
    report.add_argument('--output', required=True, type=Path)
    builder = sub.add_parser('build')
    builder.add_argument('--environment', required=True, type=Path)
    builder.add_argument('--output', required=True, type=Path)
    packager = sub.add_parser('package')
    packager.add_argument('--plan', required=True, type=Path)
    packager.add_argument('--summary', required=True, type=Path)
    packager.add_argument('--build-manifest', required=True, type=Path)
    packager.add_argument('--environment', required=True, type=Path)
    packager.add_argument('--output', required=True, type=Path)
    args = parser.parse_args()
    if args.command == 'build':
        from check_build import build
        config = environment(args.environment)
        config['build_manifest'] = str(args.output.resolve())
        result = build(ROOT, config, source_digest, execute)
        print(json.dumps(result))
        return 0
    if args.command == 'plan':
        head = git('rev-parse', '--verify', args.head + '^{commit}').strip()
        if head != git('rev-parse', '--verify', 'HEAD^{commit}').strip():
            raise ValueError('head must identify the checked-out source')
        base = git('rev-parse', '--verify', args.base + '^{commit}').strip() if args.base else head
        if args.full:
            paths = []
        elif args.base:
            # --no-renames includes both endpoints as deletion+addition, not only the new name.
            paths = (git('diff', '--name-only', '--no-renames', '-z', base, head) +
                     git('diff', 'HEAD', '--name-only', '--no-renames', '-z') +
                     git('ls-files', '--others', '--exclude-standard', '-z')).split('\0')
        else:
            paths = (git('diff', 'HEAD', '--name-only', '--no-renames', '-z') +
                     git('ls-files', '--others', '--exclude-standard', '-z')).split('\0')
        value = build_plan(sorted(set(filter(None, paths))), base=base, head=head,
                           source_digest=source_digest(), mode='full' if args.full else 'affected')
        write_json(args.output, value)
        print(json.dumps(value))
        return 0
    value = json.loads(args.plan.read_text())
    if args.command == 'package':
        from check_build import package, validate_build
        current = source_digest()
        config = environment(args.environment)
        config['build_manifest'] = str(args.build_manifest.resolve(strict=True))
        manifest = validate_build(ROOT, config, current)
        summary = json.loads(args.summary.read_text())
        output = args.output.absolute()
        package(ROOT, config, value, summary, manifest, output)
        if source_digest() != current:
            # This output was exclusively created here. Do not leave a usable
            # installation artifact after its evidence became stale.
            output.unlink()
            raise ValueError('source changed during packaging')
        print(json.dumps({'status': 'PASS', 'source_digest': current, 'plan_digest': value['plan_digest']}))
        return 0
    if args.command == 'run':
        return 0 if run(value, args.lane, environment(args.environment), args.output) else 1
    results = []
    for path in args.results:
        results.extend(json.loads(path.read_text()))
    summary = aggregate_results(value, results, source_digest=source_digest())
    write_json(args.output, summary)
    print(json.dumps(summary))
    return 0 if summary['status'] == 'PASS' else 1


if __name__ == '__main__':
    try:
        raise SystemExit(main())
    except (OSError, ValueError, KeyError, subprocess.SubprocessError):
        print('check failed: invalid selection, environment, source or required evidence', file=sys.stderr)
        raise SystemExit(1)
