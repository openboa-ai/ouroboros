#!/usr/bin/env python3
"""Bounded synthetic-only age adapter qualification; never reads company secrets."""

# Allow direct fixture execution without ambient PYTHONPATH or installation.
if __package__ in (None, ""):
    import sys
    from pathlib import Path
    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

import argparse
import hashlib
import json
import os
from pathlib import Path
import subprocess
import tempfile


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--seal", type=Path, required=True)
    parser.add_argument("--open", type=Path, required=True)
    parser.add_argument("--age", type=Path, required=True)
    parser.add_argument("--keygen", type=Path, required=True)
    parser.add_argument("--fixture-parent", type=Path, required=True)
    args = parser.parse_args()
    seal, age, keygen = [str(p.resolve(strict=True)) for p in (args.seal, args.age, args.keygen)]
    opener = str(args.open.resolve(strict=True))
    tool_hash = hashlib.sha256(Path(age).read_bytes()).hexdigest()

    def run(command, success=True):
        result = subprocess.run(command, capture_output=True, timeout=40, check=False)
        if (result.returncode == 0) != success:
            # Never include tool output: key-generation output may contain identity material.
            raise AssertionError("unexpected bounded tool exit")
        return result

    with tempfile.TemporaryDirectory(prefix="backup-seal-fixture-", dir=args.fixture_parent.resolve(strict=True)) as temporary:
        root = Path(temporary).resolve()
        identity, recipient, source = [root / name for name in ("identity", "recipient", "input")]
        run([keygen, "-o", str(identity)])
        os.chmod(identity, 0o600)
        recipient.write_bytes(run([keygen, "-y", str(identity)]).stdout)
        os.chmod(recipient, 0o600)
        source.write_bytes(bytes(range(256)) * 4096)
        os.chmod(source, 0o600)
        original = hashlib.sha256(source.read_bytes()).hexdigest()

        def encrypt(name, digest=tool_hash, maximum=1048576, input_path=source):
            return [seal, "--age-binary", age, "--age-sha256", digest,
                    "--recipient-file", str(recipient), "--input", str(input_path),
                    "--output", str(root / name), "--max-bytes", str(maximum),
                    "--timeout-seconds", "20"]

        report = json.loads(run(encrypt("sealed.age")).stdout)
        ciphertext = root / "sealed.age"
        cipher_hash = hashlib.sha256(ciphertext.read_bytes()).hexdigest()
        assert report["status"] == "sealed_candidate"
        assert report["ciphertext_sha256"] == cipher_hash
        assert report["ciphertext_bytes"] == ciphertext.stat().st_size
        assert ciphertext.stat().st_mode & 0o777 == 0o600
        assert not (root / "sealed.age.partial").exists()
        assert all(report[key] is False for key in (
            "coherent_backup_verified", "independent_destination_verified", "restore_verified", "authority_granted"))
        restored = run([age, "--decrypt", "--identity", str(identity), str(ciphertext)]).stdout
        assert hashlib.sha256(restored).hexdigest() == original

        def decrypt(name, input_path=ciphertext, digest=original, size=1048576):
            return [opener, "--age-binary", age, "--age-sha256", tool_hash,
                    "--identity-file", str(identity), "--input", str(input_path),
                    "--output", str(root / name), "--max-bytes", "1048576",
                    "--plaintext-bytes", str(size), "--plaintext-sha256", digest,
                    "--timeout-seconds", "20"]

        opened = json.loads(run(decrypt("restored")).stdout)
        assert opened["status"] == "restored_candidate"
        assert opened["stream_authentication_verified"] is True
        assert opened["authority_granted"] is False
        assert hashlib.sha256((root / "restored").read_bytes()).hexdigest() == original
        assert (root / "restored").stat().st_mode & 0o777 == 0o600
        run(decrypt("restored"), False)
        run(decrypt("wrong-expected", digest="0" * 64), False)
        run(decrypt("wrong-length", size=1048575), False)
        for name in ("wrong-expected", "wrong-length"):
            assert not (root / name).exists()
            assert (root / (name + ".partial")).stat().st_mode & 0o777 == 0o600
        run(encrypt("sealed.age"), False)
        assert hashlib.sha256(ciphertext.read_bytes()).hexdigest() == cipher_hash
        run(encrypt("wrong-tool.age", digest="0" * 64), False)
        run(encrypt("too-large.age", maximum=1024), False)
        os.chmod(source, 0o644)
        run(encrypt("unprotected.age"), False)
        os.chmod(source, 0o600)
        link = root / "linked-input"
        link.symlink_to(source)
        run(encrypt("symlink.age", input_path=link), False)
        for name in ("wrong-tool.age", "too-large.age", "unprotected.age", "symlink.age"):
            assert not (root / name).exists()
            assert not (root / (name + ".partial")).exists()
        corrupted = bytearray(ciphertext.read_bytes())
        corrupted[-1] ^= 1
        tampered = root / "tampered.age"
        tampered.write_bytes(corrupted)
        tampered.chmod(0o600)
        run([age, "--decrypt", "--identity", str(identity), str(tampered)], False)
        run(decrypt("tampered-restored", input_path=tampered), False)
        assert not (root / "tampered-restored").exists()
        tampered.write_bytes(ciphertext.read_bytes()[:-32])
        run([age, "--decrypt", "--identity", str(identity), str(tampered)], False)
        run(decrypt("truncated-restored", input_path=tampered), False)
        assert not (root / "truncated-restored").exists()
        print(json.dumps({"status": "PASS", "source": "synthetic_1MiB", "cases": [
            "native_age_roundtrip", "receipt_digest", "private_ciphertext", "no_overwrite",
            "wrong_tool_digest", "size_limit", "private_input", "symlink_rejection",
            "tamper_rejection", "truncation_rejection", "authenticated_restore_publication",
            "restore_no_overwrite", "expected_plaintext_match", "partial_plaintext_not_published"],
            "coherent_backup": "NOT RUN", "independent_destination": "NOT RUN",
            "company_restore": "NOT RUN"}))


if __name__ == "__main__":
    main()
