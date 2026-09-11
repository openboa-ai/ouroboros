"""Create separate disposable resource databases at an explicitly selected endpoint."""

# Allow direct fixture execution without ambient PYTHONPATH or installation.
if __package__ in (None, ""):
    import sys
    from pathlib import Path
    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

import argparse, json, secrets, subprocess
from tests.support.fixture_config import clean_environment, load_config

args, fixture = load_config(argparse.ArgumentParser())
fixture.require_database()
meta = fixture.metadata()
root = fixture.create_root()
host = '[' + meta['host'] + ']' if ':' in meta['host'] else meta['host']
for kind in ['company', 'catalog']:
    name = 'ouro_' + kind + '_' + secrets.token_hex(4)
    pw = secrets.token_hex(24)
    fixture.sql(f"CREATE ROLE {name} LOGIN PASSWORD '{pw}';\nCREATE DATABASE {name} OWNER {name};\n")
    path = root / (kind + '.url')
    with path.open('x') as out:
        out.write(f"postgresql://{name}:{pw}@{host}:{meta['port']}/{name}?sslmode=disable\n")
    path.chmod(0o600)
    if kind == 'catalog':
        # Dedicated receipt tests seed through the owner, then exercise a credential that
        # cannot replace its own storage identity. Never run the Catalog as the DB owner.
        subprocess.run([str(fixture.binary/'ouroboros-resource-migrate'),'--role','catalog',
                        '--database-url-file',str(path)],check=True,timeout=30,
                       env=clean_environment(),stdout=subprocess.PIPE,stderr=subprocess.PIPE)
        worker='ouro_catalog_worker_'+secrets.token_hex(4)
        worker_password=secrets.token_hex(24)
        fixture.sql(f"CREATE ROLE {worker} LOGIN PASSWORD '{worker_password}';\n"
                    f"GRANT CONNECT ON DATABASE {name} TO {worker};\n"
                    f"GRANT USAGE ON SCHEMA public TO {worker};\n"
                    f"GRANT SELECT,INSERT,UPDATE ON workspaces,workspace_snapshots,uploads,publication_receipts,upload_staging TO {worker};\n"
                    f"GRANT SELECT,INSERT,UPDATE ON blob_objects TO {worker};\n"
                    f"GRANT SELECT,INSERT,UPDATE ON upload_object_holds,revision_object_holds TO {worker};\n"
                    f"GRANT SELECT,INSERT ON workspace_create_receipts,catalog_retirements TO {worker};\n"
                    f"GRANT SELECT,INSERT,UPDATE ON catalog_collections TO {worker};\n"
                    f"GRANT SELECT ON storage_binding TO {worker};\n"
                    f"GRANT EXECUTE ON FUNCTION check_storage_binding(uuid,uuid,uuid) TO {worker};\n",name)
        worker_path=root/'catalog-worker.url'
        with worker_path.open('x') as out:
            out.write(f'postgresql://{worker}:{worker_password}@{host}:{meta["port"]}/{name}?sslmode=disable\n')
        worker_path.chmod(0o600)
print(json.dumps({'result': 'PREPARED', 'fixture_id': fixture.identity, 'stores': ['company', 'catalog']}))
