"""Create an isolated test DB using one explicit disposable fixture binding."""

# Allow direct fixture execution without ambient PYTHONPATH or installation.
if __package__ in (None, ""):
    import sys
    from pathlib import Path
    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

import argparse, json, os, secrets
from tests.support.fixture_config import load_config

args, fixture = load_config(argparse.ArgumentParser())
fixture.require_database()
host, port = fixture.database_endpoint()
if 'admin_url_file' in fixture.data:
    fixture.admin_url()
else:
    fixture.ssh()
admin_binding = fixture.administration_binding()
local = fixture.create_root()
name = 'ouro_test_' + secrets.token_hex(4)
pw = secrets.token_hex(24)
fixture.sql(f"CREATE ROLE {name} LOGIN PASSWORD '{pw}';\nCREATE DATABASE {name} OWNER {name};\n")
endpoint = f'[{host}]' if ':' in host else host
with (local / 'test-database.url').open('x') as out:
    out.write(f'postgresql://{name}:{pw}@{endpoint}:{port}/{name}?sslmode=disable\n')
(local / 'test-database.url').chmod(0o600)
(local / 'test-database.json').write_text(json.dumps({
    'kind': 'ouroboros-disposable-database', 'role': name, 'database': name,
    'host': host, 'port': port, 'fixture_binding': fixture.identity,
    'administration_binding': admin_binding,
}) + '\n')
(local / 'test-database.json').chmod(0o600)
print(json.dumps({'result': 'PREPARED', 'fixture_id': fixture.identity, 'metadata': 'test-database.json'}))
