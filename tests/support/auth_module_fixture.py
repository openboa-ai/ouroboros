"""Connected protected-module acceptance inside the existing disposable provider fixture."""
import hashlib
import json
from pathlib import Path
import subprocess


def check_auth_module(*, root, binary, env, sql, database, firm, work, credential,
                      author, author_grant, author_config, reviewer, review_grant,
                      reviewer_config, enrollment):
    def query(statement):
        return sql(statement, database)

    def request(config, path, body=None, *, key=None, grant=None, target=None, success=True):
        args = [str(binary/'ouroboros-cli'), '--config', str(config), 'request', 'POST', path]
        if body is not None:
            file = root/'auth-request.json'
            file.write_text(json.dumps(body))
            args += ['--input', str(file)]
        if key:
            args += ['--key', key]
        if grant:
            args += ['--work', work, '--delegation', grant]
        if target:
            args += ['--target', target]
        result = subprocess.run(args, env=env, capture_output=True, timeout=8)
        assert (result.returncode == 0) == success, 'auth module boundary returned unexpected status'
        assert b'synthetic-bearer' not in result.stdout + result.stderr
        return json.loads(result.stdout) if success else None

    def count():
        return json.loads((root/'observed.json').read_text())['count']

    fixture = Path(__file__).resolve().parents[1]/'fixtures/auth-bearer-v1.json'
    package = json.loads(fixture.read_text())
    selected = package['selection']
    worker = binary/'ouroboros-auth-module'
    original_binary = hashlib.sha256(worker.read_bytes()).hexdigest()
    installed = subprocess.run([str(worker), 'install', '--package', str(fixture), '--directory', str(root/'auth-modules')], env=env, capture_output=True, timeout=5)
    assert installed.returncode == 0
    assert json.loads(installed.stdout) == selected
    assert subprocess.run([str(worker), 'install', '--package', str(fixture), '--directory', str(root/'auth-modules')], env=env, capture_output=True, timeout=5).returncode != 0
    before = count()
    query(f"INSERT INTO resource_scopes VALUES('{firm}','{work}','{author_grant}','custody',ARRAY['inspect']); INSERT INTO resource_scopes VALUES('{firm}','{work}','{review_grant}','custody',ARRAY['inspect','credential.disable']);")
    proposal = {'target':'managed-model','work_id':work,'delegation_id':author_grant,
                'expected_credential_version':14,'enrollment_intent_id':enrollment,'auth_module':selected}
    request(author_config, '/connection-candidates', proposal, key='auth-propose', success=False)
    query(f"UPDATE delegations SET actions=array_append(actions,'auth-module.propose') WHERE id='{author_grant}'; UPDATE resource_scopes SET operations=array_append(operations,'auth-module.propose') WHERE delegation_id='{author_grant}' AND target_id='managed-model';")
    candidate = request(author_config, '/connection-candidates', proposal, key='auth-propose')
    assert candidate['proposed_configuration']['credential_version'] == 14
    assert candidate['proposed_configuration']['auth_module'] == selected
    prefix = '/connection-candidates/'+candidate['id']
    query(f"UPDATE delegations SET actions=actions||ARRAY['auth-module.verify','auth-module.review','credential.disable'] WHERE id='{review_grant}'; UPDATE resource_scopes SET operations=operations||ARRAY['auth-module.verify','auth-module.review'] WHERE delegation_id='{review_grant}' AND target_id='managed-model';")
    request(author_config, '/auth-module-verifications', selected, key='auth-self-verify', grant=author_grant, target='managed-model', success=False)
    invalid = dict(selected, wasm_sha256='0'*64)
    request(reviewer_config, '/auth-module-verifications', invalid, key='auth-missing-package', grant=review_grant, target='managed-model', success=False)
    verified = request(reviewer_config, '/auth-module-verifications', selected, key='auth-verify', grant=review_grant, target='managed-model')
    assert verified['verified'] and verified['module'] == selected and not verified['operating_qualification']
    assert count() == before
    verification = query("SELECT i.id FROM intents i JOIN resource_calls r ON r.intent_id=i.id WHERE r.operation='auth-module.verify' AND i.state='succeeded'")
    review = {'work_id':work,'delegation_id':review_grant,'recommendation':'recommend','rationale':'Exact package independently executed by protected Runtime verifier with fixed bounded vectors.','evidence_intent_ids':[verification]}
    reviewed = request(reviewer_config, prefix+'/reviews', review, key='auth-review')
    accept = {'work_id':work,'delegation_id':review_grant,'review_id':reviewed['id'],'max_calls':4,'lifetime_seconds':60}
    request(reviewer_config, prefix+'/acceptances', accept, key='auth-accept', success=False)
    query(f"UPDATE delegations SET actions=actions||ARRAY['auth-module.accept','auth-module.select'] WHERE id='{review_grant}'; UPDATE resource_scopes SET operations=operations||ARRAY['auth-module.accept','auth-module.select'] WHERE delegation_id='{review_grant}' AND target_id='managed-model';")
    # Enrollment success alone is not protected-code verification.
    ordinary_review = request(reviewer_config, prefix+'/reviews', dict(review, evidence_intent_ids=[enrollment]), key='auth-inadequate-review')
    request(reviewer_config, prefix+'/acceptances', dict(accept, review_id=ordinary_review['id']), key='auth-inadequate-accept', success=False)
    accepted = request(reviewer_config, prefix+'/acceptances', accept, key='auth-accept')
    activate = {'work_id':work,'delegation_id':review_grant,'acceptance_id':accepted['id']}
    activation = request(reviewer_config, prefix+'/activate', activate, key='auth-select')
    assert request(reviewer_config, prefix+'/activate', activate, key='auth-select') == activation
    assert hashlib.sha256(worker.read_bytes()).hexdigest() == original_binary
    assert count() == before
    model = {'model':'module-fixture','input':'synthetic'}
    assert request(reviewer_config, '/v1/responses', model, grant=review_grant)['model'] == 'fixture-confirmed'
    assert count() == before+1
    # Lose the completion acknowledgement after custody has committed the provider receipt.
    query("CREATE FUNCTION auth_fixture_lost() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.state='succeeded' AND NEW.operation='model.responses' THEN RAISE EXCEPTION 'disposable completion loss'; END IF; RETURN NEW; END $$; CREATE TRIGGER auth_fixture_lost BEFORE UPDATE ON intents FOR EACH ROW EXECUTE FUNCTION auth_fixture_lost();")
    request(reviewer_config, '/v1/responses', model, grant=review_grant, success=False)
    lost = query("SELECT i.id FROM intents i JOIN resource_calls r ON r.intent_id=i.id WHERE i.state='claimed' AND r.operation='model.responses' AND r.configuration ? 'auth_module'")
    assert lost and count() == before+2
    query('DROP TRIGGER auth_fixture_lost ON intents; DROP FUNCTION auth_fixture_lost();')
    recovered = request(reviewer_config, '/resource-intents/'+lost+'/reconcile', grant=review_grant)
    assert recovered['model'] == 'fixture-confirmed'
    assert count() == before+2
    # Current protected selection authority is required at subsequent admission/dispatch.
    query(f"UPDATE resource_scopes SET operations=array_remove(operations,'auth-module.select') WHERE delegation_id='{review_grant}' AND target_id='managed-model'")
    request(reviewer_config, '/v1/responses', model, grant=review_grant, success=False)
    query(f"UPDATE resource_scopes SET operations=array_append(operations,'auth-module.select') WHERE delegation_id='{review_grant}' AND target_id='managed-model'")
    request(reviewer_config, '/credential-disables', {'credential_id':credential,'version':14}, key='auth-disable', grant=review_grant, target='custody')
    request(reviewer_config, '/v1/responses', model, grant=review_grant, success=False)
    assert count() == before+2
    request(reviewer_config, prefix+'/stop', {'work_id':work,'delegation_id':review_grant,'activation_id':activation['id']}, key='auth-stop')
    request(reviewer_config, '/v1/responses', model, grant=review_grant, success=False)
    assert count() == before+2
    records = query("SELECT input::text FROM intents; SELECT reply::text FROM resource_calls;")
    assert 'synthetic-bearer' not in records
    return {'result':'PASS','module':selected,'mock_provider_calls':2,'real_provider_calls':0,
            'independent_verification_intent':verification,'candidate_id':candidate['id'],
            'recovered_intent':lost,'disable_blocks_send':True,'selection_revocation_blocks_send':True,
            'installation_without_rebuild':True}
