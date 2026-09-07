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

## Interactive exercises

Use the **Explore** badge in the reader to open a movable, resizable exercise.
Mechanical Grid is available on displayed pages 36–39, with the two book
examples, shuffled grids, animated rectangle rotations, exact-target and
book-sorting goals, undo, and reset. Introvert Seating is available on page 78,
including the eight-seat exercise and configurable small examples.

Additional task widgets let readers explore ambiguous base-11 numbers
(page 16), step through Cargo Sorting (page 47), and follow locker
cycles in Prisoners’ Gamble (pages 89–91). They run entirely in the browser;
no account, external service, or extra deployment step is needed.

Widgets register with `window.JournalWidgets` and provide `id`, `title`,
`pages` (zero-based source PDF indices), `y` (relative page height), and
`mount(container)`, which returns a cleanup function. The shared host owns
the modal, keyboard isolation, resizing, and page badges. Optional `offsetY`
adds a screen-space offset to avoid another badge. Displayed page numbers
are two less than physical PDF page numbers.

Run the Mechanical Grid rule checks with `node scripts/check_mechanical_grid.cjs`.
The new widget rule checks are `scripts/check_undecimal.cjs`,
`scripts/check_cargo.cjs`, and `scripts/check_prisoners.cjs` (also run with Node).
With Playwright available and the preview running on port 8765, run
`node scripts/check_widgets_browser.cjs` for desktop and phone integration
checks. `READER_URL` and `BROWSER_CHANNEL` can override the preview URL and
browser channel (Microsoft Edge by default).
