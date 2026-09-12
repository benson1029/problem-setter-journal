"""Build compact contextual overlays from a journal companion PDF.

The public reader only receives the resulting WebP crops. Each crop starts at
the source's ``P.<page>`` heading and ends just before the next entry, so
diagrams and mathematical notation retain their original layout.
"""

from __future__ import annotations

import argparse
import re
import subprocess
import tempfile
from pathlib import Path

import pdfplumber
from PIL import Image


HEADING = re.compile(r"^P\.(\d+)$")

# The entries below end far above the next heading or the bottom of their
# companion-PDF page.  An explicit lower bound keeps a useful breathing room
# after the last line without showing a large blank panel. P.56 also stops
# before the next chapter title in the companion PDF.
CROP_BOTTOM_OVERRIDES = {
    23: 676,
    43: 619,
    56: 520,
    61: 695,
    82: 626,
    104: 695,
}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("supplement", type=Path)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--dpi", type=int, default=180)
    parser.add_argument("--pdftoppm", default="pdftoppm")
    args = parser.parse_args()

    if not args.supplement.is_file():
        raise SystemExit(f"Supplement not found: {args.supplement}")
    args.output.mkdir(parents=True, exist_ok=True)

    headings: list[tuple[int, int, float, float, float]] = []
    with pdfplumber.open(args.supplement) as pdf:
        dimensions = [(page.width, page.height) for page in pdf.pages]
        for page_index, page in enumerate(pdf.pages):
            for word in page.extract_words():
                match = HEADING.fullmatch(word["text"])
                if match:
                    headings.append((page_index, int(match.group(1)), word["top"], page.width, page.height))

    if not headings:
        raise SystemExit("No P.<page> solution headings were found.")

    with tempfile.TemporaryDirectory(prefix="journal-solutions-") as temporary:
        temporary_path = Path(temporary)
        prefix = temporary_path / "supplement"
        subprocess.run(
            [args.pdftoppm, "-png", "-r", str(args.dpi), str(args.supplement), str(prefix)],
            check=True,
        )

        by_page: dict[int, list[tuple[int, float, float, float]]] = {}
        for page_index, number, top, width, height in headings:
            by_page.setdefault(page_index, []).append((number, top, width, height))

        for page_index, page_headings in by_page.items():
            page_headings.sort(key=lambda item: item[1])
            rendered = Image.open(temporary_path / f"supplement-{page_index + 1}.png")
            scale = args.dpi / 72
            _, page_height = dimensions[page_index]
            for index, (number, top, page_width, _) in enumerate(page_headings):
                next_top = page_headings[index + 1][1] if index + 1 < len(page_headings) else page_height - 8
                # A small leading margin keeps the problem-page label legible;
                # horizontal margins remove the supplement's page furniture.
                crop_bottom = min(next_top - 2, CROP_BOTTOM_OVERRIDES.get(number, next_top - 2))
                crop = rendered.crop((
                    round(34 * scale),
                    max(0, round((top - 7) * scale)),
                    round((page_width - 34) * scale),
                    # Retain the lower leading below the final line.  This is
                    # especially important for descenders and underlines.
                    max(1, round(crop_bottom * scale)),
                ))
                crop.save(args.output / f"p{number}.webp", "WEBP", lossless=True, method=6)
            rendered.close()

    print(f"Built {len(headings)} contextual overlays in {args.output}")


if __name__ == "__main__":
    main()
