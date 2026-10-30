import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from PIL import Image

from scripts import setup_assets


class SetupAssetsTests(unittest.TestCase):
    def setUp(self):
        runtime = Path(__file__).resolve().parents[1] / '.runtime'
        runtime.mkdir(exist_ok=True)
        self.temp = tempfile.TemporaryDirectory(dir=runtime)
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.source = self.root / 'source'
        (self.source / 'data').mkdir(parents=True)
        (self.source / 'img').mkdir()
        self.catalog = [{'id': 'sample_front'}]
        (self.source / 'data' / 'pose-zh.json').write_text(json.dumps(self.catalog), encoding='utf-8')
        (self.source / 'data' / 'pose.json').write_text(json.dumps([
            {'id': 'sample_front', 'ポーズ名': '立つ', 'アングル': '正面'}
        ]), encoding='utf-8')
        with Image.new('RGB', (30, 40), 'red') as image:
            image.save(self.source / 'img' / 'sample_front.png')
        self.destination = self.root / 'assets'

    def test_offline_import_and_resume_preserve_existing_files(self):
        with patch.object(setup_assets, 'read_url', side_effect=AssertionError('network called')):
            self.assertEqual(setup_assets.prepare(self.source, self.destination), 1)
            self.assertEqual(setup_assets.prepare(self.source, self.destination), 1)
        self.assertEqual(json.loads((self.destination / 'pose-ja.json').read_text(encoding='utf-8'))['sample_front']['name'], '立つ')
        with Image.open(self.destination / 'thumbs' / 'sample_front.jpg') as image:
            self.assertEqual(image.format, 'JPEG')
        self.assertFalse(list(self.destination.rglob('*.part')))

    def test_import_refuses_conflicting_original(self):
        setup_assets.prepare(self.source, self.destination)
        with Image.new('RGB', (30, 40), 'blue') as image:
            image.save(self.source / 'img' / 'sample_front.png')
        with self.assertRaisesRegex(RuntimeError, 'Refusing to overwrite'):
            setup_assets.prepare(self.source, self.destination)

    def test_download_resumes_without_fetching_existing_image(self):
        data = (self.source / 'img' / 'sample_front.png').read_bytes()
        payloads = {'data/pose-zh.json': json.dumps(self.catalog).encode(),
                    'data/pose.json': b'[]', 'img/sample_front.png': data}
        with patch.object(setup_assets, 'read_url', side_effect=lambda path, limit: payloads[path]) as fetch:
            setup_assets.prepare(None, self.destination, download=True)
            setup_assets.prepare(None, self.destination, download=True)
        self.assertEqual(fetch.call_count, 3)

    def test_rejects_unsafe_catalogue_id(self):
        (self.source / 'data' / 'pose-zh.json').write_text('[{"id":"../escape"}]', encoding='utf-8')
        with self.assertRaisesRegex(ValueError, 'Unsafe'):
            setup_assets.prepare(self.source, self.destination)


if __name__ == '__main__':
    unittest.main()
