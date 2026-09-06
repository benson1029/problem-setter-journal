# The Problem Setter's Journal

A static home page for *The Problem Setter's Journal*.

The repository also contains a browser-only reading edition. It renders shuffled
image fragments into a canvas rather than publishing a full-book PDF.

## Local preview

Open `index.html` in a browser, or from PowerShell run:

```powershell
python -m http.server 8000
```

Then visit `http://localhost:8000`.

## Build the browser reading edition

The full source PDF must stay outside this public repository. To generate the
public reader assets from a private source PDF, install Poppler and Pillow, then
run:

```powershell
python scripts/build_reader_assets.py "C:\path\to\benson_problem_setting_journal_b5.pdf"
```

This writes shuffled WebP atlas files and a compact coordinate map to
`assets/book/`. The public viewer in `reader.html` loads only the atlases needed
for the page being read. It is a copying deterrent, not DRM: a determined person
can still inspect the public reader code and browser requests.
