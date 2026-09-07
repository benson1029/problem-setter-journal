"""Build tightly cropped reader overlays from the errata PDF."""

from __future__ import annotations

import argparse
import subprocess
import tempfile
from pathlib import Path

import pdfplumber
from PIL import Image


# PDF-space crop bounds, chosen to retain the complete correction without
# pulling in the following section heading or page whitespace.
CROPS = {
    21: (142, 298),
    36: (330, 425),
    38: (420, 505),
}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--dpi", type=int, default=180)
    parser.add_argument("--pdftoppm", default="pdftoppm")
    args = parser.parse_args()
    if not args.source.is_file():
        raise SystemExit(f"Errata PDF not found: {args.source}")
    args.output.mkdir(parents=True, exist_ok=True)

    with pdfplumber.open(args.source) as pdf:
        width, _ = pdf.pages[0].width, pdf.pages[0].height

    with tempfile.TemporaryDirectory(prefix="journal-errata-") as temporary:
        prefix = Path(temporary) / "errata"
        subprocess.run(
            [args.pdftoppm, "-png", "-r", str(args.dpi), str(args.source), str(prefix)],
            check=True,
        )
        image = Image.open(Path(temporary) / "errata-1.png")
        scale = args.dpi / 72
        for page, (top, bottom) in CROPS.items():
            crop = image.crop((
                round(34 * scale), round(top * scale),
                round((width - 34) * scale), round(bottom * scale),
            ))
            crop.save(args.output / f"p{page}.webp", "WEBP", lossless=True, method=6)
        image.close()

    print(f"Built {len(CROPS)} errata overlays in {args.output}")


if __name__ == "__main__":
    main()
