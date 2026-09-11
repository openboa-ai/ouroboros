#!/usr/bin/env python3
"""Black-box configuration rejection on compiled services; no DB/server/provider is started."""

# Allow direct fixture execution without ambient PYTHONPATH or installation.
if __package__ in (None, ""):
    import sys
    from pathlib import Path
    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

import argparse
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

parser = argparse.ArgumentParser()
parser.add_argument('--bin-dir', required=True, type=Path)
args, remaining = parser.parse_known_args()
if not args.bin_dir.is_absolute() or not args.bin_dir.is_dir():
    parser.error('--bin-dir must be an explicit existing absolute directory')
BINARY = args.bin_dir


class ConfigurationStartup(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='ouro-startup-')
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name).resolve()
        self.env = {k: v for k, v in os.environ.items() if not k.startswith('PG')}
        self.env['HOME'] = str(self.root)
        (self.root / '.pgpass').write_text('*:*:*:*:secret-canary')
        (self.root / '.pgpass').chmod(0o600)

    def invoke(self, binary, *arguments, extra_env=None):
        result = subprocess.run([str(BINARY / binary), *arguments],
                                cwd=self.root, env=self.env | (extra_env or {}),
                                text=True, capture_output=True, timeout=5)
        self.assertNotEqual(result.returncode, 0)
        self.assertNotIn('secret-canary', result.stdout + result.stderr)
        return result.stdout + result.stderr

    def test_invalid_and_missing_config_rejected_by_actual_consumers(self):
        selected = self.root / 'selected.json'
        for binary in ('ouroboros-core', 'ouroboros-gateway', 'ouroboros-resources', 'ouroboros-cli'):
            tail = ['conditions'] if binary == 'ouroboros-cli' else []
            with self.subTest(binary=binary, kind='missing'):
                self.invoke(binary, '--config', str(self.root / 'missing.json'), *tail)
            for content in ('{"listen":"a","listen":"b"}',
                            '{"unknown":"secret-canary"}', '[]'):
                selected.write_text(content)
                with self.subTest(binary=binary, content=content):
                    self.invoke(binary, '--config', str(selected), *tail)
        self.assertEqual({p.name for p in self.root.iterdir()}, {'.pgpass', 'selected.json'})

    @unittest.skipUnless(hasattr(os, 'mkfifo'), 'requires Unix FIFO support')
    def test_fifo_config_cannot_hang_startup(self):
        selected = self.root / 'fifo'
        os.mkfifo(selected, 0o600)
        self.invoke('ouroboros-core', '--config', str(selected))

    def test_database_defaults_and_query_overrides_are_rejected_before_connect(self):
        selected = self.root / 'database.url'
        for url in ('postgresql:///company',
                    'postgresql://worker@127.0.0.1:9/company?sslmode=disable',
                    'postgresql://worker:secret-canary@127.0.0.1:9/company?sslmode=disable&host=other',
                    'postgresql://worker:secret-canary@127.0.0.1:9/company?sslmode=prefer'):
            selected.write_text(url)
            for binary, tail in (('ouroboros-migrate', []),
                                 ('ouroboros-resource-migrate', ['--role', 'catalog'])):
                with self.subTest(binary=binary, url=url):
                    output = self.invoke(binary, '--database-url-file', str(selected), *tail)
                    self.assertNotIn('database unavailable', output)
                    self.assertNotIn('migration DB unavailable', output)

    def test_ambient_database_options_cannot_change_service_or_migration(self):
        selected = self.root / 'database.url'
        selected.write_text('postgresql://worker:explicit@127.0.0.1:9/company?sslmode=disable')
        tls = {'certificate': 'not-read.pem', 'private_key': 'not-read.key', 'ca': 'not-read-ca.pem'}
        config = self.root / 'core.json'
        config.write_text(json.dumps({'listen': '127.0.0.1:9', 'tls': tls,
            'database_url_file': 'database.url', 'firm_id': '00000000-0000-0000-0000-000000000001',
            'gateway_fingerprint': '0' * 64}))
        for variable in ('PGHOST', 'PGPORT', 'PGPASSWORD', 'PGOPTIONS', 'PGPASSFILE', 'PGSSLROOTCERT'):
            env = {variable: 'secret-canary'}
            output = self.invoke('ouroboros-core', '--config', str(config), extra_env=env)
            self.assertIn('ambient PostgreSQL settings are not accepted', output)
            output = self.invoke('ouroboros-migrate', '--database-url-file', str(selected), extra_env=env)
            self.assertIn('ambient PostgreSQL settings are not accepted', output)


if __name__ == '__main__':
    unittest.main(argv=[sys.argv[0], *remaining])
