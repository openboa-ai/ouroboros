"""Release reuse/corruption tests; no service, VM, credential or model starts."""
import hashlib
import os
from pathlib import Path
import shutil
import tempfile
import unittest
from unittest.mock import patch
from fixture_release import install


class Releases(unittest.TestCase):
    def setUp(self):
        # Require the same non-shared parent boundary as the release store.
        self.base=Path(tempfile.mkdtemp(prefix='.release-test-',dir=Path.cwd())).resolve()
        self.source=self.base/'source';self.source.mkdir()
        self.store=self.base/'releases'
        self.binary=self.source/'ouroboros-example';self.binary.write_bytes(b'one')
        self.manifest={'ouroboros-example':hashlib.sha256(b'one').hexdigest()}
        self.addCleanup(self.remove)

    def remove(self):
        for root,dirs,files in os.walk(self.base):os.chmod(root,0o700)
        shutil.rmtree(self.base)

    def put(self):return install(self.source,self.store,self.manifest,os.geteuid())

    def test_reuses_exact_release_without_source_dependency(self):
        one=self.put();path=Path(one['bin_dir']);inode=(path/self.binary.name).stat().st_ino
        self.binary.write_bytes(b'changed source after installation')
        two=self.put()
        self.assertFalse(one['reused']);self.assertTrue(two['reused'])
        self.assertEqual(one['release_id'],two['release_id'])
        self.assertEqual((path/self.binary.name).stat().st_ino,inode)
        self.assertEqual((path/self.binary.name).read_bytes(),b'one')

    def test_corruption_is_rejected_and_not_overwritten(self):
        path=Path(self.put()['bin_dir'])/self.binary.name
        path.chmod(0o755);path.write_bytes(b'bad');path.chmod(0o555)
        with self.assertRaises(ValueError):self.put()
        self.assertEqual(path.read_bytes(),b'bad')

    def test_interrupted_publication_stays_private_and_cannot_be_reused(self):
        rename = os.rename
        published = []
        def interrupted(source, target):
            self.assertEqual(source.stat().st_mode & 0o777, 0o700)
            rename(source, target)
            published.append(target)
            raise OSError('synthetic interruption before sealing')
        with patch('fixture_release.os.rename', side_effect=interrupted):
            with self.assertRaises(OSError):self.put()
        target = published[0]
        self.assertEqual(target.stat().st_mode & 0o777, 0o700)
        self.assertEqual((target/self.binary.name).read_bytes(), b'one')
        with self.assertRaises(ValueError):self.put()
        self.assertEqual(target.stat().st_mode & 0o777, 0o700)

    def test_mismatch_cleans_only_its_staging(self):
        self.binary.write_bytes(b'wrong')
        with self.assertRaises(ValueError):self.put()
        self.assertEqual([p.name for p in self.store.iterdir()],['.install.lock'])

    def test_source_symlink_and_mutable_store_are_rejected(self):
        self.binary.unlink();self.binary.symlink_to('/dev/null')
        with self.assertRaises(OSError):self.put()
        self.store.chmod(0o777)
        with self.assertRaises(ValueError):self.put()

    def test_release_symlink_and_added_files_are_rejected(self):
        one=self.put();path=Path(one['bin_dir'])
        path.chmod(0o755);(path/'unexpected').write_bytes(b'x');path.chmod(0o555)
        with self.assertRaises(ValueError):self.put()
        path.chmod(0o755);(path/'unexpected').unlink();path.chmod(0o555)
        moved=path.with_name('preserved');path.rename(moved);path.symlink_to(moved,target_is_directory=True)
        with self.assertRaises(ValueError):self.put()
        path.unlink()


if __name__=='__main__':unittest.main()
