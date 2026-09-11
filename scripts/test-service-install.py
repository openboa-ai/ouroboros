"""Finite root-owned installation rehearsal; creates only a new explicit fixture directory."""
import argparse, hashlib, json, os, subprocess
from pathlib import Path
from fixture_config import clean_environment
if not __debug__:
    raise RuntimeError('optimized Python disables behavioral assertions and is not a test profile')
p=argparse.ArgumentParser();p.add_argument('--binary',type=Path,required=True);p.add_argument('--bundle',type=Path,required=True);p.add_argument('--root',type=Path,required=True);p.add_argument('--faults',action='store_true');a=p.parse_args()
assert os.geteuid()==0 and all(x.is_absolute() for x in [a.binary,a.bundle,a.root])
a.root.mkdir(mode=0o700)
units=a.root/'units';receipts=a.root/'receipts';units.mkdir(mode=0o700);receipts.mkdir(mode=0o700)
env=clean_environment()
def call(args):return subprocess.run([str(a.binary),*args],capture_output=True,env=env,timeout=10)
preview=call(['--bundle',str(a.bundle)]);assert preview.returncode==0
report=json.loads(preview.stdout);digest=report['bundle_sha256']
args=['--bundle',str(a.bundle),'--install-directory',str(units),'--receipt-directory',str(receipts),'--reviewed-sha256',digest]
wrong=args.copy();wrong[-1]='0'*64
assert call(wrong).returncode!=0 and not list(units.iterdir()) and not list(receipts.iterdir())
first=units/report['units'][0]['name'];first.write_bytes(b'preexisting fixture sentinel')
assert call(args).returncode!=0 and first.read_bytes()==b'preexisting fixture sentinel' and len(list(units.iterdir()))==1 and not list(receipts.iterdir())
first.unlink();first.symlink_to(a.bundle)
assert call(args).returncode!=0 and first.is_symlink() and not list(receipts.iterdir())
first.unlink()
result=call(args);assert result.returncode==0,result.stderr.decode()
outcome=json.loads(result.stdout);assert outcome['status']=='installed_not_started' and outcome['reload_required']
for entry in report['units']:
 path=units/entry['name'];stat=path.stat()
 assert path.is_file() and not path.is_symlink() and stat.st_uid==0 and stat.st_nlink==1 and stat.st_mode&0o022==0
 assert hashlib.sha256(path.read_bytes()).hexdigest()==entry['sha256']
assert len(list(units.iterdir()))==len(report['units'])
assert len(list(receipts.iterdir()))==2*len(report['units'])+2
inventory={str(p.relative_to(a.root)):hashlib.sha256(p.read_bytes()).hexdigest() for p in a.root.rglob('*') if p.is_file()}
assert call(args).returncode!=0
assert inventory=={str(p.relative_to(a.root)):hashlib.sha256(p.read_bytes()).hexdigest() for p in a.root.rglob('*') if p.is_file()}
resume=call([*args,'--resume-install']);assert resume.returncode==0,resume.stderr.decode()
assert inventory=={str(p.relative_to(a.root)):hashlib.sha256(p.read_bytes()).hexdigest() for p in a.root.rglob('*') if p.is_file()}
faults=[]
if a.faults:
    source=a.root/'fsync-fault.c';library=a.root/'fsync-fault.so'
    source.write_text('#define _GNU_SOURCE\n#include <dlfcn.h>\n#include <errno.h>\n#include <stdlib.h>\nint fsync(int fd) { static int n; int (*real)(int)=dlsym(RTLD_NEXT,"fsync"); const char *s=getenv("OURO_TEST_FAIL_FSYNC"); if(s && ++n==atoi(s)){errno=EIO;return -1;} return real(fd); }\n')
    subprocess.run(['/usr/bin/cc','-shared','-fPIC','-O2',str(source),'-ldl','-o',str(library)],env=env,capture_output=True,check=True,timeout=20)
    for point in [1,3,7,9,13]:
        scenario=a.root/('fault-'+str(point));scenario.mkdir(mode=0o700)
        target=scenario/'units';logs=scenario/'receipts';target.mkdir(mode=0o700);logs.mkdir(mode=0o700)
        request=['--bundle',str(a.bundle),'--install-directory',str(target),'--receipt-directory',str(logs),'--reviewed-sha256',digest]
        fault_env={**env,'LD_PRELOAD':str(library),'OURO_TEST_FAIL_FSYNC':str(point)}
        failed=subprocess.run([str(a.binary),*request],env=fault_env,capture_output=True,timeout=10)
        assert failed.returncode!=0 and not (logs/('install-'+digest+'.complete.json')).exists()
        if point==9:
            original=target/report['units'][0]['name'];saved=scenario/'original-unit'
            original.rename(saved);original.write_bytes(saved.read_bytes())
            assert call([*request,'--resume-install']).returncode!=0
            original.unlink();saved.rename(original)
        recovered=call([*request,'--resume-install']);assert recovered.returncode==0,recovered.stderr.decode()
        for entry in report['units']:assert hashlib.sha256((target/entry['name']).read_bytes()).hexdigest()==entry['sha256']
        assert (logs/('install-'+digest+'.complete.json')).exists()
        old=scenario/'units-original';target.rename(old);target.mkdir(mode=0o700)
        assert call([*request,'--resume-install']).returncode!=0 and not list(target.iterdir())
        target.rmdir();old.rename(target)
        faults.append(point)
summary={'result':'PASS','units':len(report['units']),'wrong_review_rejected':True,'existing_file_preserved':True,'symlink_rejected':True,'receipts_verified':True,'repeat_did_not_overwrite':True,'services_started':False,'explicit_resume_verified':True,'fsync_fault_points':faults}
(a.root/'result.json').write_text(json.dumps(summary,indent=2)+'\n');print(json.dumps(summary))
