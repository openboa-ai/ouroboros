"""Install current SQL migrations and synthetic continuity rows in an isolated rehearsal."""

import hashlib
import re
import uuid


def prepare(sql, source):
    locations = {
        'fixture_control': source / 'crates/core/migrations',
        'fixture_catalog': source / 'crates/resources/migrations/catalog',
        'fixture_company': source / 'crates/resources/migrations/company',
        'fixture_custody': source / 'crates/resources/migrations/custody',
    }
    for database, directory in locations.items():
        role = database + '_owner'
        sql('postgres', 'CREATE ROLE ' + role + ' NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION')
        sql('postgres', 'CREATE DATABASE ' + database + ' OWNER ' + role)
        files = sorted(directory.glob('*.sql'))
        assert 1 <= len(files) <= 100
        sql(database, 'SET ROLE ' + role + '; CREATE TABLE _sqlx_migrations (version BIGINT PRIMARY KEY, description TEXT NOT NULL, installed_on TIMESTAMPTZ NOT NULL DEFAULT now(), success BOOLEAN NOT NULL, checksum BYTEA NOT NULL, execution_time BIGINT NOT NULL)')
        for file in files:
            assert re.fullmatch(r'[0-9]+_[a-z0-9_]+\.sql', file.name)
            raw = file.read_bytes()
            assert len(raw) <= 1024 * 1024
            version, description = file.stem.split('_', 1)
            checksum = hashlib.sha384(raw).hexdigest()
            sql(database, 'BEGIN; SET LOCAL ROLE ' + role + ';' + raw.decode() +
                f"\nINSERT INTO _sqlx_migrations(version,description,success,checksum,execution_time) VALUES ({int(version)},'{description.replace('_', ' ')}',true,decode('{checksum}','hex'),0); COMMIT;")
    firm, principal, grant, intent, attempt, result, workspace, publication = [str(uuid.uuid4()) for _ in range(8)]
    sql('fixture_control', f"""
        INSERT INTO firms(id,admission_paused) VALUES ('{firm}',true);
        INSERT INTO principals(firm_id,id,kind,enabled) VALUES ('{firm}','{principal}','agent',true);
        INSERT INTO delegations(firm_id,id,principal_id,actions,expires_at,revoked) VALUES ('{firm}','{grant}','{principal}',ARRAY['resource.read'],now()+interval '1 hour',true);
        INSERT INTO limits(firm_id,id,capacity,committed) VALUES ('{firm}','fixture_budget',100,70);
        INSERT INTO intents(firm_id,id,principal_id,operation,request_key,input,resource_id,delegation_id,state) VALUES ('{firm}','{intent}','{principal}','fixture.pending','recovery-unresolved','{{}}','{result}','{grant}','unresolved');
        INSERT INTO reservations(firm_id,intent_id,limit_id,units,settled) VALUES ('{firm}','{intent}','fixture_budget',70,false);
        INSERT INTO outbox(firm_id,intent_id,claimed) VALUES ('{firm}','{intent}',true);
        INSERT INTO attempts(firm_id,id,intent_id,worker_id,state) VALUES ('{firm}','{attempt}','{intent}','fixture-worker','unresolved');
    """)
    sql('fixture_company', f"""BEGIN;
        INSERT INTO results(firm_id,id,content) VALUES ('{firm}','{result}','{{"synthetic":"retained"}}');
        INSERT INTO effect_receipts(firm_id,intent_id,input,result_id) VALUES ('{firm}','{intent}','{{}}','{result}'); COMMIT;""")
    sql('fixture_catalog', f"""BEGIN;
        INSERT INTO workspaces(firm_id,id,revision,manifest) VALUES ('{firm}','{workspace}',0,'{{}}');
        INSERT INTO workspace_snapshots(firm_id,workspace_id,revision,manifest) VALUES ('{firm}','{workspace}',0,'{{}}');
        INSERT INTO publication_receipts(firm_id,intent_id,workspace_id,input,revision) VALUES ('{firm}','{publication}','{workspace}','{{}}',0); COMMIT;""")
    return tuple(locations)


def snapshot(sql, databases):
    result = {'tables': {}, 'schema': {}, 'roles': {}}
    for database in databases:
        tables = sql(database, "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename").decode().splitlines()
        assert 1 <= len(tables) <= 200
        for table in tables:
            assert re.fullmatch('[a-z_][a-z0-9_]*', table)
            rows = sql(database, f'SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text),\'[]\'::jsonb)::text FROM "{table}" t')
            assert len(rows) <= 8 * 1024 * 1024
            result['tables'][database + '/' + table] = hashlib.sha256(rows).hexdigest()
        result['schema'][database] = sql(database, "SELECT tablename,tableowner FROM pg_tables WHERE schemaname='public' ORDER BY tablename").decode()
        result['roles'][database] = sql(database, "SELECT rolname,rolsuper,rolcreaterole,rolcreatedb,rolcanlogin FROM pg_roles WHERE rolname='" + database + "_owner'").decode()
        # Owner of company tables cannot read control records through SET ROLE.
        if database == 'fixture_control':
            assert sql(database, "SELECT has_table_privilege('fixture_company_owner','firms','SELECT')") == b'f'
            assert sql(database, "SELECT admission_paused FROM firms") == b't'
            assert sql(database, "SELECT revoked FROM delegations WHERE 'resource.read'=ANY(actions)") == b't'
            assert sql(database, "SELECT committed FROM limits") == b'70'
            assert sql(database, "SELECT units,settled FROM reservations") == b'70|f'
            assert sql(database, "SELECT state FROM intents") == b'unresolved'
    return result
