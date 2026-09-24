"""Portable repository/document checks; no local research or installed deployment required."""

import ast
import re
import subprocess
import unicodedata
from pathlib import Path
from urllib.parse import unquote


def check(root):
    root = Path(root).resolve(strict=True)
    errors = []
    paths = subprocess.check_output(['git', 'ls-files', '-c', '-o', '--exclude-standard', '-z'], cwd=root).decode().split('\0')
    documents = sorted(root / name for name in set(paths) if name.endswith('.md') and (root / name).is_file())

    def prose(text):
        return re.sub(r'(?ms)^```[^\n]*\n.*?^```[^\n]*$', '', text)

    def anchors(path):
        text = prose(path.read_text())
        found, counts = set(), {}
        for heading in re.findall(r'(?m)^#{1,6} (.+)$', text):
            slug = heading.strip().lower().replace('`', '').replace('<', '').replace('>', '')
            slug = ''.join(c for c in slug if not unicodedata.category(c).startswith('P') or c in '_-')
            slug = slug.replace(' ', '-')
            index = counts.get(slug, 0)
            counts[slug] = index + 1
            found.add(slug + (f'-{index}' if index else ''))
        found.update(re.findall(r'(?:id|name)=["\']([^"\']+)["\']', text))
        return found

    links = 0
    for path in documents:
        text = prose(path.read_text())
        width = None
        for line in text.splitlines():
            if line.startswith('|') and line.rstrip().endswith('|'):
                count = len(re.split(r'(?<!\\)\|', line))
                if width is not None and width != count:
                    errors.append(f'{path.relative_to(root)}: inconsistent table')
                width = count
            else:
                width = None
        for target in re.findall(r'(?<!!)\[[^]\n]+\]\(([^)]+)\)', text):
            target = target.strip().strip('<>')
            if re.match(r'^[a-zA-Z][a-zA-Z0-9+.-]*:', target):
                continue
            name, _, anchor = unquote(target).partition('#')
            linked = path.parent / name if name else path
            if not linked.exists() or (anchor and linked.suffix == '.md' and anchor not in anchors(linked)):
                errors.append(f'{path.relative_to(root)}: broken relative link')
            links += 1
    required = ['README.md', 'SECURITY.md', 'CODEOWNERS', 'CORE_DOCTRINE.md', 'WHITEPAPER.md',
                'PRODUCT_SPECIFICATION.md', 'AGENTS.md', 'SOVEREIGN.md', 'Cargo.toml', 'Cargo.lock']
    for name in required:
        if not (root / name).is_file() or not (root / name).stat().st_size:
            errors.append(f'{name}: missing required file')
    for path in [*(root / 'scripts').rglob('*.py'), *(root / 'tests').rglob('*.py')]:
        ast.parse(path.read_text(), filename=str(path.relative_to(root)))
    # Check the prospective source set as well as the index, including this uncommitted implementation.
    paths = subprocess.check_output(['git', 'ls-files', '-c', '-o', '--exclude-standard', '-z'], cwd=root).decode().split('\0')
    for name in filter(None, paths):
        path = Path(name)
        if path.name != '.env.example' and (path.name in ('.env', '.envrc', 'id_rsa', 'id_ed25519', 'id_dsa', 'id_ecdsa')
                or path.name.startswith('.env.') or path.suffix in ('.pem', '.key', '.p12', '.pfx')):
            errors.append(f'{name}: secret path in source set')
        absolute = root / path
        if absolute.is_file() and path.suffix in ('.rs', '.py', '.sh', '.md', '.toml', '.yml', '.yaml', '.sql'):
            text = absolute.read_text()
            # Personal host paths are environment inputs, never checked-in deployment defaults.
            if re.search(r'/' + r'Users/[^/\s]+/|/' + r'Volumes/Work/|/' + r'home/[^/\s]+\.guest/', text):
                errors.append(f'{name}: personal deployment path')
    if subprocess.run(['git', 'diff', '--check'], cwd=root, capture_output=True).returncode:
        errors.append('diff whitespace failed')
    return {'status': 'PASS' if not errors else 'FAIL', 'documents': len(documents), 'links': links, 'errors': errors}
