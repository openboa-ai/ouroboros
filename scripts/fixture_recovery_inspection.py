"""Synthetic current observer selection for the restored control/Gateway restriction test."""
import hashlib
import http.client
import json
import os
from pathlib import Path
import secrets
import socket
import ssl
import subprocess
import time
import uuid


def free_port():
    with socket.socket() as s:
        s.bind(('127.0.0.1', 0))
        return s.getsockname()[1]


def prepare(root, sql, run):
    p = root / 'inspection'
    p.mkdir(mode=0o700)
    def key(name):
        run(['openssl', 'genpkey', '-algorithm', 'ED25519', '-out', str(p / (name + '.key'))])
        (p / (name + '.key')).chmod(0o600)
    key('ca')
    run(['openssl','req','-x509','-new','-key',str(p/'ca.key'),'-subj','/CN=Recovery fixture CA','-days','1','-addext','basicConstraints=critical,CA:TRUE','-addext','keyUsage=critical,keyCertSign,cRLSign','-out',str(p/'ca.pem')])
    (p/'cert.ext').write_text('basicConstraints=critical,CA:FALSE\nkeyUsage=critical,digitalSignature\nextendedKeyUsage=serverAuth,clientAuth\nsubjectAltName=IP:127.0.0.1\n')
    fingerprints = {}
    for name in ('core','gateway','gateway-service','observer','other'):
        key(name)
        run(['openssl','req','-new','-key',str(p/(name+'.key')),'-subj','/CN='+name,'-out',str(p/(name+'.csr'))])
        run(['openssl','x509','-req','-in',str(p/(name+'.csr')),'-CA',str(p/'ca.pem'),'-CAkey',str(p/'ca.key'),'-CAcreateserial','-days','1','-extfile',str(p/'cert.ext'),'-out',str(p/(name+'.pem'))])
        fingerprints[name] = hashlib.sha256(run(['openssl','x509','-in',str(p/(name+'.pem')),'-outform','DER'])).hexdigest()
    firm = sql('fixture_control', 'SELECT id FROM firms').decode()
    for name in ('observer','other'):
        principal, grant = str(uuid.uuid4()), str(uuid.uuid4())
        sql('fixture_control', f"INSERT INTO principals(firm_id,id,kind,enabled) VALUES ('{firm}','{principal}','human',true); INSERT INTO credentials VALUES ('{fingerprints[name]}','{firm}','{principal}',true,now()+interval '1 hour'); INSERT INTO delegations(firm_id,id,principal_id,actions,expires_at) VALUES ('{firm}','{grant}','{principal}',ARRAY['inspect'],now()+interval '1 hour');")
    password = secrets.token_hex(24)
    sql('fixture_control', "CREATE ROLE fixture_inspector LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE PASSWORD '" + password + "'; GRANT CONNECT ON DATABASE fixture_control TO fixture_inspector; GRANT USAGE ON SCHEMA public TO fixture_inspector; GRANT SELECT ON ALL TABLES IN SCHEMA public TO fixture_inspector; GRANT UPDATE ON firms TO fixture_inspector;")
    return dict(path=p, firm=firm, fingerprints=fingerprints, password=password)


def inspect(context, binaries, pg_port, env):
    p=context['path']; fps=context['fingerprints']; processes=[]
    core_port, gateway_port = free_port(), free_port()
    assert core_port != gateway_port
    def tls(name):
        return dict(certificate=str(p/(name+'.pem')),private_key=str(p/(name+'.key')),ca=str(p/'ca.pem'))
    db=p/'database.url';db.write_text(f"postgresql://fixture_inspector:{context['password']}@127.0.0.1:{pg_port}/fixture_control?sslmode=disable\n");db.chmod(0o600)
    expiry=int(time.time())+8
    restriction=dict(observer_fingerprints=[fps['observer']],expires_unix_seconds=expiry)
    configs={
        'core':dict(listen=f'127.0.0.1:{core_port}',tls=tls('core'),database_url_file=str(db),firm_id=context['firm'],gateway_fingerprint=fps['gateway-service'],recovery_inspection=restriction),
        'gateway':dict(listen=f'127.0.0.1:{gateway_port}',tls=tls('gateway'),core_url=f'https://127.0.0.1:{core_port}',core_client=tls('gateway-service'),recovery_inspection=restriction),
    }
    wrong_firm = {**configs['core'], 'firm_id': str(uuid.uuid4())}
    rejected = p / 'wrong-firm.json'
    rejected.write_text(json.dumps(wrong_firm))
    rejected.chmod(0o600)
    rejection = subprocess.run([str(binaries/'ouroboros-core'),'--config',str(rejected)],capture_output=True,timeout=3,env=env)
    assert rejection.returncode != 0 and b'restored firm must already be paused' in rejection.stderr, 'mismatched restored firm did not fail closed'
    def request(port,name,method,path,headers=None):
        ctx=ssl.create_default_context(cafile=str(p/'ca.pem'))
        ctx.load_cert_chain(str(p/(name+'.pem')),str(p/(name+'.key')))
        connection=http.client.HTTPSConnection('127.0.0.1',port,context=ctx,timeout=2)
        try:
            connection.request(method,path,headers=headers or {})
            r=connection.getresponse();data=r.read(1024*1024)
            return r.status,data
        finally:
            connection.close()
    try:
        for name,cfg in configs.items():
            file=p/(name+'.json');file.write_text(json.dumps(cfg));file.chmod(0o600)
            with (p/(name+'.log')).open('xb') as log:
                os.fchmod(log.fileno(),0o600)
                processes.append(subprocess.Popen([str(binaries/('ouroboros-'+name)),'--config',str(file)],stdout=log,stderr=log,env=env))
        for _ in range(80):
            assert all(child.poll() is None for child in processes), 'inspection service stopped'
            try:
                status,data=request(gateway_port,'observer','GET','/conditions')
                if status==200:break
            except (OSError,http.client.HTTPException):pass
            time.sleep(.05)
        else:raise AssertionError('inspection did not become ready')
        value=json.loads(data)
        assert value['execution_mode']=='recovery_inspection' and value['current_authority_verified'] is False and value['admission_paused'] is True
        assert request(gateway_port,'other','GET','/conditions')[0]==403
        for method,path in [('POST','/work'),('POST','/executions'),('POST','/environment/admission'),('GET','/events'),('GET','/conditions?extra=1'),('POST','/model/responses')]:
            assert request(gateway_port,'observer',method,path)[0]==403
        forwarded={'x-ouro-client-fingerprint':fps['observer']}
        assert request(core_port,'observer','GET','/conditions',forwarded)[0]==403
        assert request(core_port,'gateway-service','GET','/conditions',forwarded)[0]==200
        assert request(core_port,'gateway-service','POST','/environment/admission',forwarded)[0]==403
        forged={**forwarded,'x-ouro-bridge-peer':'{}'}
        assert request(core_port,'gateway-service','GET','/conditions',forged)[0]==403
        while time.time()<expiry+.1:time.sleep(.1)
        assert request(gateway_port,'observer','GET','/conditions')[0]==403
        assert request(core_port,'gateway-service','GET','/conditions',forwarded)[0]==403
        return {'mtls_inspection':'PASS','other_identity_rejected':True,'mutation_rejected_at_both_layers':True,'live_expiry_rejected':True,'wrong_firm_startup_rejected':True}
    finally:
        for child in reversed(processes):
            if child.poll() is None:child.terminate()
            try:child.wait(timeout=10)
            except subprocess.TimeoutExpired:
                child.kill();child.wait(timeout=5)
                raise AssertionError('inspection service required forced cleanup')
