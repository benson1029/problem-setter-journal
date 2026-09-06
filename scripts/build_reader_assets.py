#!/usr/bin/env python3
"""Create shuffled WebP atlas assets for the browser reading edition.

The source PDF is intentionally read from outside this public repository. The
generated files contain image fragments only; there is no public full-page
image or PDF in the output.
"""

from __future__ import annotations

import argparse
import base64
import hashlib
import json
import random
import shutil
import subprocess
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUTPUT = ROOT / "assets" / "book"


def parse_arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("pdf", type=Path, help="Path to the private source PDF")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--dpi", type=int, default=132, help="Raster resolution")
    parser.add_argument("--seed", default="psj-reading-edition-2026")
    parser.add_argument("--pdftoppm", default="pdftoppm", help="Poppler renderer executable")
    return parser.parse_args()


def fragment_page(image: Image.Image, page: int, rng: random.Random) -> list[dict]:
    width, height = image.size
    columns, rows = 3, 4
    overlap_x, overlap_y = round(width * 0.035), round(height * 0.025)
    fragments: list[dict] = []

    for row in range(rows):
        for column in range(columns):
            core_left = round(column * width / columns)
            core_top = round(row * height / rows)
            core_right = round((column + 1) * width / columns)
            core_bottom = round((row + 1) * height / rows)
            left = max(0, core_left - (overlap_x if column else 0))
            top = max(0, core_top - (overlap_y if row else 0))
            right = min(width, core_right + (overlap_x if column < columns - 1 else 0))
            bottom = min(height, core_bottom + (overlap_y if row < rows - 1 else 0))
            fragments.append({
                "page": page,
                "image": image.crop((left, top, right, bottom)),
                "target": (left, top),
                "size": (right - left, bottom - top),
            })
    rng.shuffle(fragments)
    return fragments


def draw_decoy_background(draw: ImageDraw.ImageDraw, box: tuple[int, int, int, int], rng: random.Random) -> None:
    left, top, right, bottom = box
    draw.rectangle(box, fill=(29, 37, 48))
    for _ in range(70):
        x = rng.randint(left, right - 1)
        y = rng.randint(top, bottom - 1)
        shade = rng.randint(50, 125)
        draw.rectangle((x, y, min(right, x + rng.randint(1, 7)), min(bottom, y + rng.randint(1, 7))), fill=(shade, shade, shade + 6))


def build_atlases(fragments: list[dict], output: Path, rng: random.Random) -> tuple[list[str], dict[int, list[list[int]]]]:
    groups = [fragments[index:index + 4] for index in range(0, len(fragments), 4)]
    rng.shuffle(groups)
    arranged = [fragment for group in groups for fragment in group]
    maximum_width = max(fragment["size"][0] for fragment in arranged)
    maximum_height = max(fragment["size"][1] for fragment in arranged)
    pad, gutter, slots = 10, 14, 16
    cell_width = maximum_width + pad * 2
    cell_height = maximum_height + pad * 2
    atlas_width = cell_width * 4 + gutter * 5
    atlas_height = cell_height * 4 + gutter * 5
    assets: list[str] = []
    pages: dict[int, list[list[int]]] = {}

    for atlas_number, start in enumerate(range(0, len(arranged), slots)):
        batch = arranged[start:start + slots]
        atlas = Image.new("RGB", (atlas_width, atlas_height), (29, 37, 48))
        draw = ImageDraw.Draw(atlas)
        filename = f"{hashlib.sha256(f'{rng.random():.16f}-{atlas_number}'.encode()).hexdigest()[:18]}.webp"

        for slot, fragment in enumerate(batch):
            row, column = divmod(slot, 4)
            cell_left = gutter + column * (cell_width + gutter)
            cell_top = gutter + row * (cell_height + gutter)
            draw_decoy_background(draw, (cell_left, cell_top, cell_left + cell_width, cell_top + cell_height), rng)
            piece = fragment["image"]
            source_x = cell_left + pad + (maximum_width - piece.width) // 2
            source_y = cell_top + pad + (maximum_height - piece.height) // 2
            atlas.paste(piece, (source_x, source_y))
            target_x, target_y = fragment["target"]
            width, height = fragment["size"]
            pages.setdefault(fragment["page"], []).append([atlas_number, source_x, source_y, width, height, target_x, target_y])

        atlas.save(output / filename, "WEBP", lossless=True, method=0)
        assets.append(filename)

    return assets, pages


def main() -> None:
    arguments = parse_arguments()
    source_pdf = arguments.pdf.resolve()
    output = arguments.output.resolve()
    if not source_pdf.is_file():
        raise SystemExit(f"Source PDF was not found: {source_pdf}")
    if output == ROOT or ROOT not in output.parents:
        raise SystemExit("Output must be inside this repository.")

    rng = random.Random(arguments.seed)
    shutil.rmtree(output, ignore_errors=True)
    output.mkdir(parents=True, exist_ok=True)

    with tempfile.TemporaryDirectory(prefix="psj-reader-") as temporary:
        prefix = Path(temporary) / "page"
        subprocess.run([arguments.pdftoppm, "-jpeg", "-jpegopt", "quality=92", "-r", str(arguments.dpi), str(source_pdf), str(prefix)], check=True)
        page_files = sorted(Path(temporary).glob("page-*.jpg"), key=lambda item: int(item.stem.rsplit("-", 1)[1]))
        if not page_files:
            raise SystemExit("Poppler did not produce any page images.")
        source_pages = [Image.open(page_file).convert("RGB") for page_file in page_files]
        first_width, first_height = source_pages[0].size
        if any(image.size != (first_width, first_height) for image in source_pages):
            raise SystemExit("All source pages must have identical dimensions.")

        fragments = [fragment for page, image in enumerate(source_pages) for fragment in fragment_page(image, page, rng)]
        assets, pages_by_number = build_atlases(fragments, output, rng)

    manifest = {
        "version": 1,
        "width": first_width,
        "height": first_height,
        "assets": assets,
        "pages": [pages_by_number[index] for index in range(len(source_pages))],
    }
    encoded = base64.b64encode(json.dumps(manifest, separators=(",", ":")).encode()).decode()
    (output / "reader-data.js").write_text(f'window.__PROBLEM_SETTER_JOURNAL__=JSON.parse(atob("{encoded}"));\n', encoding="utf-8")
    print(f"Published {len(source_pages)} pages as {len(assets)} shuffled atlases in {output}")


if __name__ == "__main__":
    main()
