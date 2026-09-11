"""Build a network-free, test-only read barrier on an explicitly selected native image."""

# Allow direct fixture execution without ambient PYTHONPATH or installation.
if __package__ in (None, ""):
    import sys
    from pathlib import Path
    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

import argparse
import json
import re
import subprocess
import tempfile
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('--image', required=True)
parser.add_argument('--socket', required=True)
args = parser.parse_args()
assert re.fullmatch(r'sha256:[a-f0-9]{64}', args.image)
assert Path(args.socket).is_absolute()
docker = ['docker', '--host', 'unix://' + args.socket]
reference = 'localhost/ouroboros-fixture-base:' + args.image.removeprefix('sha256:')
subprocess.run([*docker, 'image', 'tag', args.image, reference], check=True, timeout=30)
observed = subprocess.check_output([*docker, 'image', 'inspect', '--format', '{{.Id}}', reference], text=True, timeout=30).strip()
if observed != args.image:
    raise ValueError('local fixture base differs from the immutable input')
with tempfile.TemporaryDirectory(prefix='ouroboros-read-fixture-') as directory:
    root = Path(directory)
    (root/'head').write_text('''#!/bin/sh
set -eu
if [ "$#" = 3 ] && [ "$1" = -c ] && [ "$3" = /workspace/state/session.jsonl ]; then
  : > /tmp/checkpoint-read-ready
  # Runtime must contain this process after revocation; never release the read.
  /bin/busybox sleep 20
  exit 71
fi
exec /bin/busybox head "$@"
''')
    (root/'head').chmod(0o755)
    (root/'Dockerfile').write_text(f'''FROM {reference}
USER 0:0
RUN rm /bin/head
COPY head /bin/head
USER 65532:65532
''')
    command=['docker','--host','unix://'+args.socket,'build','--network=none','--pull=false','--iidfile',str(root/'image-id'),str(root)]
    subprocess.run(command,check=True,timeout=60)
    print(json.dumps({'image_id':(root/'image-id').read_text().strip(),'base_image':args.image,'test_only':True,'barrier':'checkpoint-read'}))
