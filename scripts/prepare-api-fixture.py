"""Local synthetic principals and short-lived test certificates; no owner designation."""
import argparse,hashlib,json,os,secrets,subprocess,uuid
from pathlib import Path
from fixture_config import clean_environment, load_config
args,fixture=load_config(argparse.ArgumentParser())
fixture.require_ports('core','gateway');fixture.require_database();meta=fixture.metadata()
p=fixture.create_root()
def run(*cmd):return subprocess.run(cmd,check=True,stdout=subprocess.PIPE,stderr=subprocess.PIPE,env=clean_environment()).stdout
def key(name):
 run('openssl','genpkey','-algorithm','ED25519','-out',str(p/(name+'.key')))
 os.chmod(p/(name+'.key'),0o600)
key('ca')
run('openssl','req','-x509','-new','-key',str(p/'ca.key'),'-subj','/CN=Ouroboros fixture CA','-days','1','-addext','basicConstraints=critical,CA:TRUE','-addext','keyUsage=critical,keyCertSign,cRLSign','-out',str(p/'ca.pem'))
(p/'cert.ext').write_text(fixture.cert_extensions())
fps={}
for name in ['core','gateway','gateway-service','human','unregistered']:
 key(name);run('openssl','req','-new','-key',str(p/(name+'.key')),'-subj','/CN='+name,'-out',str(p/(name+'.csr')))
 run('openssl','x509','-req','-in',str(p/(name+'.csr')),'-CA',str(p/'ca.pem'),'-CAkey',str(p/'ca.key'),'-CAcreateserial','-days','1','-extfile',str(p/'cert.ext'),'-out',str(p/(name+'.pem')))
 fps[name]=hashlib.sha256(run('openssl','x509','-in',str(p/(name+'.pem')),'-outform','DER')).hexdigest()
firm,principal,work_grant,control_grant=[str(uuid.uuid4()) for _ in range(4)]
role='ouro_core_'+secrets.token_hex(4);pw=secrets.token_hex(24)
sql=f"""CREATE ROLE {role} LOGIN PASSWORD '{pw}';
GRANT CONNECT ON DATABASE {meta['database']} TO {role};
GRANT USAGE ON SCHEMA public TO {role};
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO {role};
INSERT INTO firms(id) VALUES('{firm}');
INSERT INTO principals VALUES('{firm}','{principal}','human',true);
INSERT INTO credentials VALUES('{fps['human']}','{firm}','{principal}',true,clock_timestamp()+interval '1 hour');
INSERT INTO delegations(firm_id,id,principal_id,actions,expires_at) VALUES
('{firm}','{work_grant}','{principal}',ARRAY['work.create','execution.start'],clock_timestamp()+interval '1 hour'),
('{firm}','{control_grant}','{principal}',ARRAY['inspect','execution.stop','delegation.revoke'],clock_timestamp()+interval '1 hour');
INSERT INTO limits VALUES('{firm}','compute',100,0);
INSERT INTO profiles VALUES('{firm}','fixture-no-payload',true,100,60);
"""
fixture.sql(sql,meta['database'])
urlfile=p/'core-database.url';urlfile.write_text(f"postgresql://{role}:{pw}@{('['+meta['host']+']') if ':' in meta['host'] else meta['host']}:{meta['port']}/{meta['database']}?sslmode=disable\n");os.chmod(urlfile,0o600)
def tls(name):return {'certificate':str(p/(name+'.pem')),'private_key':str(p/(name+'.key')),'ca':str(p/'ca.pem')}
def write(name,obj):(p/name).write_text(json.dumps(obj,indent=2)+'\n')
write('core.json',{'listen':fixture.endpoint('core'),'tls':tls('core'),'database_url_file':str(urlfile),'firm_id':firm,'gateway_fingerprint':fps['gateway-service']})
write('gateway.json',{'listen':fixture.endpoint('gateway'),'tls':tls('gateway'),'core_url':fixture.url('core'),'core_client':tls('gateway-service')})
write('cli.json',{'gateway_url':fixture.url('gateway'),'tls':tls('human')})
write('fixture.json',{'firm_id':firm,'principal_id':principal,'delegation_id':work_grant,'control_grant':control_grant,'fingerprints':fps})
print(json.dumps({'result':'PREPARED','fixture_id':fixture.identity,'authority':'synthetic; no sovereign or provider account'}))
