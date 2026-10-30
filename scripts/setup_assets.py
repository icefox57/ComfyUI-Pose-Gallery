"""Prepare gallery files once. Normal plugin operation is entirely offline."""
from __future__ import annotations

import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
import io
import json
import os
from pathlib import Path
import re
import tempfile
from urllib.request import Request, urlopen

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SITE = 'https://ai-pose-gallery.anhao.app/'
ID = re.compile(r'^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$')
MAX_IMAGE = 16 * 1024 * 1024
MAX_CATALOG = 4 * 1024 * 1024


def read_url(path, limit):
    request = Request(SITE + path, headers={'User-Agent': 'ComfyUI-Pose-Gallery asset setup'})
    with urlopen(request, timeout=60) as response:
        data = response.read(limit + 1)
    if not data or len(data) > limit:
        raise ValueError(f'Empty or oversized response: {path}')
    return data


def ids_for(catalog):
    if not isinstance(catalog, list) or not catalog or len(catalog) > 20000:
        raise ValueError('Invalid Chinese catalogue')
    ids = [row.get('id') if isinstance(row, dict) else None for row in catalog]
    if any(not isinstance(value, str) or not ID.fullmatch(value) for value in ids) or len(set(ids)) != len(ids):
        raise ValueError('Unsafe or duplicate pose ID')
    return ids


def valid_image(data, format_name):
    if not data or len(data) > MAX_IMAGE:
        raise ValueError('Image is empty or exceeds the size limit')
    with Image.open(io.BytesIO(data)) as image:
        if image.format != format_name or image.width * image.height > 24000000:
            raise ValueError('Unsupported or oversized image')
        image.verify()


def atomic_write(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, name = tempfile.mkstemp(prefix='.pose-gallery-', suffix='.part', dir=path.parent)
    try:
        with os.fdopen(fd, 'wb') as stream:
            stream.write(data)
        os.replace(name, path)
    finally:
        Path(name).unlink(missing_ok=True)


def prepare(source, destination, download=False):
    source = Path(source).expanduser().resolve() if source else None
    destination = Path(destination).expanduser().resolve()
    if download:
        existing = destination / 'pose-zh.json'
        data = existing.read_bytes() if existing.exists() else read_url('data/pose-zh.json', MAX_CATALOG)
    else:
        candidates = [source / 'data' / 'pose-zh.json', source / 'pose-zh.json']
        path = next((candidate for candidate in candidates if candidate.is_file()), None)
        if path is None:
            raise FileNotFoundError('Source must contain data/pose-zh.json and img/')
        data = path.read_bytes()
    if len(data) > MAX_CATALOG:
        raise ValueError('Catalogue exceeds the size limit')
    catalog = json.loads(data.decode('utf-8-sig'))
    ids = ids_for(catalog)
    destination.mkdir(parents=True, exist_ok=True)
    catalog_path = destination / 'pose-zh.json'
    if catalog_path.exists():
        if json.loads(catalog_path.read_text(encoding='utf-8-sig')) != catalog:
            raise FileExistsError(f'Refusing to overwrite different catalogue: {catalog_path}')
    else:
        atomic_write(catalog_path, data)

    labels_path = destination / 'pose-ja.json'
    if not labels_path.exists():
        try:
            if download:
                labels_data = read_url('data/pose.json', MAX_CATALOG)
            else:
                options = [source / 'data' / 'pose.json', source / 'pose-ja.json']
                labels_data = next(path.read_bytes() for path in options if path.is_file())
            if len(labels_data) > MAX_CATALOG:
                raise ValueError('Japanese labels exceed the size limit')
            raw = json.loads(labels_data.decode('utf-8-sig'))
            if isinstance(raw, list):
                labels = {r['id']: {'name': r.get('ポーズ名', ''), 'angle': r.get('アングル', '')}
                          for r in raw if isinstance(r, dict) and r.get('id') in ids}
            elif isinstance(raw, dict):
                labels = {key: value for key, value in raw.items() if key in ids}
            else:
                raise ValueError('Invalid Japanese labels')
            atomic_write(labels_path, json.dumps(labels, ensure_ascii=False).encode('utf-8'))
        except (OSError, ValueError, StopIteration) as error:
            print(f'Japanese names unavailable; Chinese titles will be used: {error}', flush=True)

    def one(pose_id):
        original = destination / 'img' / (pose_id + '.png')
        thumbnail = destination / 'thumbs' / (pose_id + '.jpg')
        source_file = source / 'img' / (pose_id + '.png') if source else None
        if original.exists():
            image_data = original.read_bytes()
            valid_image(image_data, 'PNG')
            if source_file and source_file.resolve() != original.resolve() and image_data != source_file.read_bytes():
                raise FileExistsError(f'Refusing to overwrite different image: {original}')
        else:
            image_data = read_url('img/' + pose_id + '.png', MAX_IMAGE) if download else source_file.read_bytes()
            valid_image(image_data, 'PNG')
            atomic_write(original, image_data)
        if thumbnail.exists():
            valid_image(thumbnail.read_bytes(), 'JPEG')
        else:
            output = io.BytesIO()
            with Image.open(io.BytesIO(image_data)) as image:
                image.thumbnail((300, 400), Image.Resampling.LANCZOS)
                image.convert('RGB').save(output, format='JPEG', quality=85)
            atomic_write(thumbnail, output.getvalue())

    failures = []
    with ThreadPoolExecutor(max_workers=4) as pool:
        futures = {pool.submit(one, pose_id): pose_id for pose_id in ids}
        for count, future in enumerate(as_completed(futures), 1):
            try:
                future.result()
            except Exception as error:
                failures.append(f'{futures[future]}: {error}')
            if count % 100 == 0 or count == len(ids):
                print(f'Processed {count}/{len(ids)}; errors: {len(failures)}', flush=True)
    if failures:
        raise RuntimeError(f'Setup incomplete; rerun to resume. First error: {failures[0]}')
    return len(ids)


def main():
    parser = argparse.ArgumentParser(description='Prepare local Chinese gallery assets once.')
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument('--download', action='store_true', help='Download the gallery (approximately 638 MiB)')
    mode.add_argument('--from-directory', type=Path, help='Import an existing gallery offline')
    parser.add_argument('--destination', type=Path, default=ROOT / 'assets' / 'zh')
    args = parser.parse_args()
    try:
        count = prepare(args.from_directory, args.destination, args.download)
        print(f'Local gallery ready: {count} images in {args.destination}')
    except (OSError, ValueError, RuntimeError) as error:
        parser.exit(1, f'Setup failed: {error}\n')


if __name__ == '__main__':
    main()
