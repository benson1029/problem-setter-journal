(() => {
  const book = window.__PROBLEM_SETTER_JOURNAL__;
  const stage = document.getElementById("book-stage");
  const single = document.getElementById("single-page");
  const left = document.getElementById("left-page");
  const right = document.getElementById("right-page");
  const turningLeaf = document.getElementById("turning-leaf");
  const turningFront = document.getElementById("turning-front");
  const turningBack = document.getElementById("turning-back");
  const linkLayer = document.getElementById("link-layer");
  const solutionLayer = document.getElementById("solution-layer");
  const errataLayer = document.getElementById("errata-layer");
  const previous = document.getElementById("previous-page");
  const next = document.getElementById("next-page");
  const zoomOut = document.getElementById("zoom-out");
  const zoomIn = document.getElementById("zoom-in");
  const zoomLevel = document.getElementById("zoom-level");
  const tocToggle = document.getElementById("toc-toggle");
  const tocPanel = document.getElementById("toc-panel");
  const tocClose = document.getElementById("toc-close");
  const label = document.getElementById("page-label");
  const status = document.getElementById("reader-status");
  const imageCache = new Map();
  const renderCache = new Map();
  const maxRenderedPages = 6;
  const zoomSteps = [1, 1.25, 1.5, 1.75, 2, 2.5, 3];
  const pageLinks = {
    1: [[742.03, 1100.75, 101.26, 19.63, "https://creativecommons.org/licenses/by-sa/4.0/"], [62.16, 1123.57, 372.75, 18.74, "https://creativecommons.org/licenses/by-sa/4.0/"]],
    32: [[563.01, 183.63, 47.02, 19.67, "https://www.nerdlegame.com/?gp=&st=0&v002&loaded=1"], [102.71, 206.45, 80.2, 19.67, "https://www.nerdlegame.com/?gp=&st=0&v002&loaded=1"]],
    36: [[766.08, 823.15, 117.76, 18.02, "https://www.youtube.com/@hongkongolympiadininformatics"], [626.33, 842.71, 57.9, 14.19, "https://www.youtube.com/@hongkongolympiadininformatics"]],
    41: [[634.49, 454.18, 118.54, 19.67, "https://en.wikipedia.org/wiki/Pancake_sorting"]],
    47: [[607.54, 631.52, 232.87, 19.67, "https://pgpr.nus.edu.sg/"]],
    52: [[264.17, 434.65, 71.34, 19.67, "https://i4ds.github.io/CargoBot"]],
    80: [[734.6, 416.94, 149.24, 18.02, "https://www.youtube.com/watch?v=ka4JmkhfiZs"], [626.33, 436.5, 39.81, 17.19, "https://www.youtube.com/watch?v=ka4JmkhfiZs"]],
    86: [[516.4, 370.33, 93.64, 19.67, "https://codeforces.com/blog/entry/53626"], [102.71, 393.15, 154.07, 19.67, "https://codeforces.com/blog/entry/53626"]],
    89: [[547.71, 297.73, 120.98, 18.74, "https://oj.uz/problem/view/IOI11_parrots"]],
    90: [[556.5, 726.16, 241.37, 17.99, "https://en.wikipedia.org/wiki/100_prisoners_problem"]],
    92: [[652.72, 1137.66, 69.12, 18, "https://www.sciencedirect.com/science/article/pii/S0196885897905674/pdf?md5=5027d90db8bfb8883990fb8c88a49ef4&pid=1-s2.0-S0196885897905674-main.pdf"]],
  };
  // Click targets on the book's printed contents page (source page index 2).
  // Coordinates use the unscaled source PDF page, as do pageLinks above.
  const printedContentsTargets = {
    2: [
      [72, 214, 96, 28, 4, "Preface"],
      [72, 253, 190, 28, 8, "How do I set problems?"],
      [72, 292, 190, 28, 12, "How to Use This Journal"],
      [52, 330, 180, 28, 16, "The Journey Begins"],
      [52, 369, 265, 28, 36, "Entering The World of Algorithms"],
      [52, 407, 220, 28, 62, "Towards IOI - The Toolkits"],
      [52, 445, 245, 28, 86, "Towards IOI - Non-batch Tasks"],
      [72, 483, 115, 28, 112, "Postlude"],
    ],
  };
  const sourcePageSize = { width: 515.8072, height: 725.6693 };
  // [displayed book page, puzzle heading position in the reader source, label].
  // Displayed numbering begins after the cover and publication-information
  // pages, matching the replacement supplement.
  const solutionSlots = {
    16: [[15, 751, "Warm-up puzzle"]],
    17: [[16, 482, "Try it out"]], 19: [[18, 895, "Try it out"]],
    22: [[21, 154, "Try it out"]], 24: [[23, 768, "Try it out"]],
    36: [[35, 909, "Warm-up puzzle"]], 37: [[36, 673, "Try it out"]],
    44: [[43, 526, "Try it out"]], 48: [[46, 907, "Try it out"]],
    55: [[54, 561, "Try it out"]], 56: [[55, 154, "Try it out"]],
    57: [[56, 154, "Try it out"]], 62: [[61, 931, "Warm-up puzzle"]],
    65: [[64, 600, "Try it out"]], 67: [[66, 1049, "Try it out"]],
    69: [[68, 1138, "Try it out"]], 75: [[74, 445, "Try it out"]],
    79: [[78, 764, "Try it out"]], 83: [[82, 1053, "Try it out"]],
    86: [[85, 912, "Warm-up puzzle"]], 92: [[91, 323, "Try it out"]],
    96: [[95, 978, "Try it out"]], 99: [[98, 992, "Try it out"]],
    101: [[100, 1040, "Try it out"]], 105: [[104, 293, "Try it out"]],
  };
  // [displayed book page, optional horizontal position, affected location,
  // short description]. Explicit horizontal positions place badges beside the
  // affected figure; null uses the standard spread-gutter placement.
  const errataSlots = {
    22: [[21, null, 920, "Figure 1.8"]],
    37: [[36, null, 460, "Second example"]],
    39: [[38, null, 287, "Figure 2.4"]],
  };
  let focus = 0, isSpread = false, busy = false, zoom = 1, panX = 0, panY = 0, drag = null, edgeClickTimer = null;
  let openSolution = null;
  let solutionPosition = null, solutionDrag = null;
  let openErratum = null, errataPosition = null, errataDrag = null;
  let wheelDelta = 0;

  if (!book) {
    status.textContent = "The reading edition has not been published yet.";
    previous.disabled = true; next.disabled = true; zoomOut.disabled = true; zoomIn.disabled = true;
    return;
  }

  const loadImage = (index) => {
    if (imageCache.has(index)) return imageCache.get(index);
    const promise = new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Could not load a book fragment."));
      image.src = `assets/book/${book.assets[index]}`;
    });
    imageCache.set(index, promise);
    return promise;
  };

  function assemble(page) {
    const cached = renderCache.get(page);
    if (cached) {
      renderCache.delete(page); renderCache.set(page, cached);
      return cached;
    }
    const rendering = (async () => {
      const rendered = document.createElement("canvas");
      rendered.width = book.width; rendered.height = book.height;
      const context = rendered.getContext("2d", { alpha: false });
      context.fillStyle = "#fff"; context.fillRect(0, 0, book.width, book.height);
      const pieces = book.pages[page];
      const images = new Map(await Promise.all([...new Set(pieces.map((piece) => piece[0]))].map(async (index) => [index, await loadImage(index)])));
      for (const [asset, sx, sy, width, height, dx, dy] of pieces) context.drawImage(images.get(asset), sx, sy, width, height, dx, dy, width, height);
      return rendered;
    })();
    renderCache.set(page, rendering);
    void rendering.catch(() => { if (renderCache.get(page) === rendering) renderCache.delete(page); });
    while (renderCache.size > maxRenderedPages) renderCache.delete(renderCache.keys().next().value);
    return rendering;
  }

  function copy(target, rendered) {
    target.width = rendered.width; target.height = rendered.height;
    target.getContext("2d", { alpha: false }).drawImage(rendered, 0, 0);
  }

  function snapshot(canvas) {
    const rendered = document.createElement("canvas");
    rendered.width = canvas.width; rendered.height = canvas.height;
    rendered.getContext("2d", { alpha: false }).drawImage(canvas, 0, 0);
    return rendered;
  }

  function blank(canvas, rendered) {
    canvas.width = rendered.width; canvas.height = rendered.height;
    const context = canvas.getContext("2d", { alpha: false });
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
  }

  function paintView({ pages, rendered }) {
    if (pages.length === 2) { copy(left, rendered[0]); copy(right, rendered[1]); }
    else copy(single, rendered[0]);
  }

  function renderLinks(pages) {
    linkLayer.replaceChildren();
    const stageBounds = stage.getBoundingClientRect();
    pages.forEach((page, index) => {
      const links = pageLinks[page] ?? [];
      const canvas = pages.length === 2 ? (index === 0 ? left : right) : single;
      const canvasBounds = canvas.getBoundingClientRect();
      const canvasLeft = (canvasBounds.left - stageBounds.left) / zoom;
      const canvasTop = (canvasBounds.top - stageBounds.top) / zoom;
      const canvasWidth = canvasBounds.width / zoom;
      const canvasHeight = canvasBounds.height / zoom;
      links.forEach(([x, y, width, height, url]) => {
        const link = document.createElement("a");
        link.className = "page-link";
        link.href = url; link.target = "_blank"; link.rel = "noopener noreferrer";
        link.title = url; link.setAttribute("aria-label", `Open ${url} in a new tab`);
        link.style.left = `${canvasLeft + x / book.width * canvasWidth}px`;
        link.style.top = `${canvasTop + y / book.height * canvasHeight}px`;
        link.style.width = `${width / book.width * canvasWidth}px`;
        link.style.height = `${height / book.height * canvasHeight}px`;
        linkLayer.append(link);
      });
      const contentsEntries = printedContentsTargets[page];
      if (contentsEntries) contentsEntries.forEach(([x, y, width, height, target, entryLabel]) => {
        const entry = document.createElement("button");
        entry.className = "page-toc-link";
        entry.type = "button";
        entry.title = `Go to ${entryLabel}`;
        entry.setAttribute("aria-label", `Go to ${entryLabel}`);
        entry.style.left = `${canvasLeft + x / sourcePageSize.width * canvasWidth}px`;
        entry.style.top = `${canvasTop + y / sourcePageSize.height * canvasHeight}px`;
        entry.style.width = `${width / sourcePageSize.width * canvasWidth}px`;
        entry.style.height = `${height / sourcePageSize.height * canvasHeight}px`;
        entry.addEventListener("click", () => jumpTo(target));
        linkLayer.append(entry);
      });
    });
    linkLayer.hidden = false;
  }

  function renderSolutionPopover(slot) {
    const [number, , labelText] = slot;
    const width = Math.min(760, Math.max(280, window.innerWidth - 32));
    const left = Math.max(6, Math.min(window.innerWidth - width - 6, solutionPosition?.left ?? (window.innerWidth - width) / 2));
    const top = Math.max(6, Math.min(window.innerHeight - 166, solutionPosition?.top ?? 24));
    const popover = document.createElement("section");
    popover.className = "solution-popover";
    popover.setAttribute("role", "dialog");
    popover.setAttribute("aria-label", `Solution for ${labelText}`);
    popover.style.left = `${left}px`;
    popover.style.top = `${top}px`;
    popover.style.width = `${width}px`;

    const header = document.createElement("div");
    header.className = "solution-popover-header";
    header.dataset.solutionDragHandle = "";
    header.append(`Solution - ${labelText}`);
    const close = document.createElement("button");
    close.className = "solution-close";
    close.type = "button";
    close.dataset.closeSolution = "";
    close.setAttribute("aria-label", "Close solution");
    close.textContent = "×";
    header.append(close);
    const body = document.createElement("div");
    body.className = "solution-popover-body";
    const image = document.createElement("img");
    image.src = `assets/solutions/p${number}.webp`;
    image.alt = `Solution for ${labelText}`;
    body.append(image);
    popover.append(header, body);
    solutionLayer.append(popover);
  }

  function renderSolutions(pages) {
    solutionLayer.replaceChildren();
    let shownOpenSolution = false;
    pages.forEach((page, index) => {
      const slots = solutionSlots[page];
      if (!slots) return;
      const canvas = pages.length === 2 ? (index === 0 ? left : right) : single;
      const canvasBounds = canvas.getBoundingClientRect();
      const metrics = { left: canvasBounds.left, top: canvasBounds.top, width: canvasBounds.width, height: canvasBounds.height };
      slots.forEach((slot) => {
        const [number, headingY, labelText] = slot;
        const button = document.createElement("button");
        button.className = "solution-trigger";
        button.type = "button";
        button.dataset.solutionPage = String(page);
        button.dataset.solutionNumber = String(number);
        button.dataset.solutionLabel = labelText;
        const icon = document.createElement("span");
        icon.className = "solution-icon";
        icon.setAttribute("aria-hidden", "true");
        icon.innerHTML = '<svg viewBox="0 0 24 24"><path d="M9 18h6M10 21h4M8.7 14.4A6 6 0 1 1 15.3 14.4c-.8.7-1.3 1.5-1.3 2.6h-4c0-1.1-.5-1.9-1.3-2.6Z" /></svg>';
        const buttonLabel = document.createElement("span");
        buttonLabel.textContent = "Solution";
        button.append(icon, buttonLabel);
        const buttonWidth = 54;
        button.style.width = `${buttonWidth}px`;
        const buttonLeft = pages.length === 2
          ? (index === 0 ? metrics.left + metrics.width - buttonWidth + 4 : metrics.left - 4)
          : metrics.left + metrics.width - buttonWidth - 10;
        button.style.left = `${buttonLeft}px`;
        button.style.top = `${Math.min(metrics.top + metrics.height - 64, Math.max(metrics.top + 7, metrics.top + headingY / book.height * metrics.height - 7))}px`;
        solutionLayer.append(button);
        // Warm the small image while the reader is settled, so opening an
        // answer does not wait for a round trip.
        const preloaded = new Image();
        preloaded.src = `assets/solutions/p${number}.webp`;
        if (openSolution?.page === page && openSolution.number === number) {
          renderSolutionPopover(slot);
          shownOpenSolution = true;
        }
      });
    });
    if (!shownOpenSolution) { openSolution = null; solutionPosition = null; }
    solutionLayer.hidden = false;
  }

  function renderErratumPopover(slot) {
    const [number, , , labelText] = slot;
    const width = Math.min(760, Math.max(280, window.innerWidth - 32));
    const left = Math.max(6, Math.min(window.innerWidth - width - 6, errataPosition?.left ?? (window.innerWidth - width) / 2));
    const top = Math.max(6, Math.min(window.innerHeight - 166, errataPosition?.top ?? 24));
    const popover = document.createElement("section");
    popover.className = "errata-popover";
    popover.setAttribute("role", "dialog");
    popover.setAttribute("aria-label", `Erratum for ${labelText}`);
    popover.style.left = `${left}px`;
    popover.style.top = `${top}px`;
    popover.style.width = `${width}px`;

    const header = document.createElement("div");
    header.className = "solution-popover-header";
    header.dataset.errataDragHandle = "";
    header.append(`Erratum - ${labelText}`);
    const close = document.createElement("button");
    close.className = "solution-close";
    close.type = "button";
    close.dataset.closeErratum = "";
    close.setAttribute("aria-label", "Close erratum");
    close.textContent = "×";
    header.append(close);
    const body = document.createElement("div");
    body.className = "solution-popover-body";
    const image = document.createElement("img");
    image.src = `assets/errata/p${number}.webp`;
    image.alt = `Erratum for ${labelText}`;
    body.append(image);
    popover.append(header, body);
    errataLayer.append(popover);
  }

  function renderErrata(pages) {
    errataLayer.replaceChildren();
    let shownOpenErratum = false;
    pages.forEach((page, index) => {
      const slots = errataSlots[page];
      if (!slots) return;
      const canvas = pages.length === 2 ? (index === 0 ? left : right) : single;
      const canvasBounds = canvas.getBoundingClientRect();
      const metrics = { left: canvasBounds.left, top: canvasBounds.top, width: canvasBounds.width, height: canvasBounds.height };
      slots.forEach((slot) => {
        const [number, affectedX, affectedY, labelText] = slot;
        const button = document.createElement("button");
        button.className = "errata-trigger";
        button.type = "button";
        button.dataset.errataPage = String(page);
        button.dataset.errataNumber = String(number);
        button.dataset.errataLabel = labelText;
        const icon = document.createElement("span");
        icon.className = "errata-icon";
        icon.setAttribute("aria-hidden", "true");
        icon.innerHTML = '<svg viewBox="0 0 24 24"><path d="M12 7v6M12 17h.01M10.3 3.8 3.8 15.1a2 2 0 0 0 1.7 3h13a2 2 0 0 0 1.7-3L13.7 3.8a2 2 0 0 0-3.4 0Z" /></svg>';
        const buttonLabel = document.createElement("span");
        buttonLabel.textContent = "Errata";
        button.append(icon, buttonLabel);
        const buttonWidth = 54;
        button.style.width = `${buttonWidth}px`;
        const buttonLeft = affectedX !== null
          ? metrics.left + affectedX / book.width * metrics.width
          : (pages.length === 2
            ? (index === 0 ? metrics.left + metrics.width - buttonWidth + 4 : metrics.left - 4)
            : metrics.left + metrics.width - buttonWidth - 10);
        button.style.left = `${buttonLeft}px`;
        button.style.top = `${Math.min(metrics.top + metrics.height - 64, Math.max(metrics.top + 7, metrics.top + affectedY / book.height * metrics.height - 7))}px`;
        errataLayer.append(button);
        const preloaded = new Image();
        preloaded.src = `assets/errata/p${number}.webp`;
        if (openErratum?.page === page && openErratum.number === number) {
          renderErratumPopover(slot);
          shownOpenErratum = true;
        }
      });
    });
    if (!shownOpenErratum) { openErratum = null; errataPosition = null; }
    errataLayer.hidden = false;
    window.dispatchEvent(new CustomEvent('journal:view', { detail: {
      pages, canvases: pages.length === 2 ? [left, right] : [single],
    } }));
  }

  function updateCoverTurnOffset(pages) {
    const page = pages.length === 2 ? left : single;
    const stageWidth = stage.getBoundingClientRect().width;
    // The legacy spread fit lets each rendered page extend slightly past the
    // stage. Keep that fit, while giving cover-boundary leaves the same offset.
    const overflow = Math.max(0, (page.getBoundingClientRect().width * 2 + 4 - stageWidth) / 2);
    stage.style.setProperty("--cover-turn-offset", `${overflow}px`);
  }

  function normalize() { if (isSpread && focus !== 0 && focus !== book.pages.length - 1) focus = focus % 2 ? focus : focus - 1; }
  function pagesForView() { return !isSpread || focus === 0 || focus === book.pages.length - 1 ? [focus] : [focus, focus + 1]; }

  function pagesForFocus(candidate) {
    if (!isSpread || candidate === 0 || candidate === book.pages.length - 1) return [candidate];
    const start = candidate % 2 ? candidate : candidate - 1;
    return [start, start + 1];
  }

  function schedulePrefetch() {
    if (navigator.connection?.saveData) return;
    const targets = [nextFocus(1), nextFocus(-1)].filter((candidate) => candidate !== focus);
    const pages = [...new Set(targets.flatMap(pagesForFocus))];
    const assets = new Set(pages.flatMap((page) => book.pages[page].map(([asset]) => asset)));
    const prefetch = () => {
      void Promise.all([...assets].map(loadImage)).catch(() => {});
      void Promise.all(pages.map(assemble)).catch(() => {});
    };
    if ("requestIdleCallback" in window) window.requestIdleCallback(prefetch, { timeout: 1000 });
    else window.setTimeout(prefetch, 150);
  }

  function updateControls() {
    const visible = pagesForView();
    previous.disabled = focus === 0 || busy;
    next.disabled = visible.at(-1) === book.pages.length - 1 || busy;
    const frontMatterNames = ["Cover", "Publication information"];
    if (visible.every((page) => page >= 2)) {
      const displayed = visible.map((page) => page - 1);
      label.textContent = displayed.length === 1 ? `Page ${displayed[0]} of ${book.pages.length - 2}` : `Pages ${displayed.join("–")} of ${book.pages.length - 2}`;
    } else {
      label.textContent = visible.map((page) => page < 2 ? frontMatterNames[page] : `Page ${page - 1}`).join(" · ");
    }
    zoomOut.disabled = zoom <= zoomSteps[0];
    zoomIn.disabled = zoom >= zoomSteps.at(-1);
    zoomLevel.textContent = `${Math.round(zoom * 100)}%`;
    status.textContent = "";
  }

  function settleView(view) {
    paintView(view);
    updateCoverTurnOffset(view.pages);
    renderLinks(view.pages);
    renderSolutions(view.pages);
    renderErrata(view.pages);
    updateControls();
    schedulePrefetch();
  }

  async function drawView({ deferPaint = false } = {}) {
    normalize();
    const pages = pagesForView();
    const rendered = await Promise.all(pages.map(assemble));
    stage.classList.toggle("is-spread", pages.length === 2);
    stage.classList.toggle("is-single", pages.length !== 2);
    stage.classList.toggle("is-cover", isSpread && pages.length === 1);
    stage.classList.toggle("is-front-cover", isSpread && pages[0] === 0);
    stage.classList.toggle("is-back-cover", isSpread && pages[0] === book.pages.length - 1);
    updateCoverTurnOffset(pages);
    const view = { pages, rendered };
    if (!deferPaint) settleView(view);
    return view;
  }

  function nextFocus(direction) {
    if (!isSpread) return Math.max(0, Math.min(book.pages.length - 1, focus + direction));
    if (direction > 0) return focus === 0 ? 1 : Math.min(book.pages.length - 1, focus + 2);
    return focus <= 1 ? 0 : focus - 2;
  }

  function applyZoom() {
    stage.classList.toggle("is-zoomed", zoom > 1);
    stage.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;
    zoomOut.disabled = zoom <= zoomSteps[0];
    zoomIn.disabled = zoom >= zoomSteps.at(-1);
    zoomLevel.textContent = `${Math.round(zoom * 100)}%`;
    if (!busy) { renderLinks(pagesForView()); renderSolutions(pagesForView()); renderErrata(pagesForView()); }
  }

  function setZoom(nextZoom, { anchor, resetPan = false } = {}) {
    const next = Math.max(zoomSteps[0], Math.min(zoomSteps.at(-1), nextZoom));
    if (resetPan || next === zoomSteps[0]) {
      panX = 0; panY = 0;
    } else if (next !== zoom) {
      const bounds = stage.getBoundingClientRect();
      // Transform origin is the page centre. Preserve the document coordinate
      // under the anchor (the pointer for wheel/double-click, otherwise centre).
      const point = anchor ?? { x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2 };
      const originX = bounds.left + bounds.width / 2 - panX;
      const originY = bounds.top + bounds.height / 2 - panY;
      const pageX = (point.x - originX - panX) / zoom;
      const pageY = (point.y - originY - panY) / zoom;
      panX = point.x - originX - pageX * next;
      panY = point.y - originY - pageY * next;
    }
    zoom = next;
    applyZoom();
  }

  function changeZoom(direction, anchor) {
    const current = zoomSteps.findIndex((step) => step >= zoom - .01);
    const nextIndex = Math.max(0, Math.min(zoomSteps.length - 1, current + direction));
    setZoom(zoomSteps[nextIndex], { anchor });
  }

  async function go(direction) {
    const target = nextFocus(direction);
    if (busy || target === focus) return;
    busy = true; updateControls();
    const usesSinglePageTurn = !isSpread;
    const currentPages = pagesForView();
    const source = isSpread && currentPages.length === 2 ? (direction > 0 ? right : left) : single;
    const stationaryPage = currentPages.length === 2 ? snapshot(direction > 0 ? left : right) : null;
    // Preserve the outgoing leaf before the target view changes its layout. This
    // is essential at the covers, where the outgoing canvas is otherwise hidden.
    const sourceWidth = source.getBoundingClientRect().width;
    copy(turningFront, source);
    linkLayer.hidden = true;
    solutionLayer.hidden = true;
    errataLayer.hidden = true;
    window.dispatchEvent(new CustomEvent('journal:view', { detail: { hidden: true } }));
    openSolution = null;
    solutionPosition = null;
    openErratum = null;
    errataPosition = null;
    const startFocus = focus;
    focus = target;
    let nextView;
    try {
      nextView = await drawView({ deferPaint: true }); // Fully assemble the target before the turn, without revealing it.
      if (usesSinglePageTurn) {
        // On a forward mobile turn, paint the incoming page underneath the
        // outgoing leaf before starting the animation. This lets the new page
        // appear naturally as the old leaf swings away, instead of revealing
        // a blank canvas until animationend. A backward turn still returns the
        // target page on the leaf itself over a blank canvas.
        if (direction > 0) copy(single, nextView.rendered[0]);
        else blank(single, nextView.rendered[0]);
        if (direction < 0) copy(turningFront, nextView.rendered[0]);
        blank(turningBack, nextView.rendered[0]);
      } else {
        const reverse = direction > 0 ? nextView.rendered[0] : nextView.rendered.at(-1);
        copy(turningBack, reverse);
      }
      // The page beneath the leaf can update immediately in spread mode; the
      // leaf's landing page stays deferred until the animation finishes.
      if (!usesSinglePageTurn && currentPages.length === 2 && nextView.pages.length === 1) {
        copy(single, stationaryPage);
      } else if (!usesSinglePageTurn && currentPages.length === 2) {
        if (direction > 0) copy(right, nextView.rendered[1]);
        else copy(left, nextView.rendered[0]);
      } else if (!usesSinglePageTurn && currentPages.length === 1 && nextView.pages.length === 2) {
        if (direction > 0) {
          blank(left, nextView.rendered[0]);
          copy(right, nextView.rendered[1]);
        } else {
          copy(left, nextView.rendered[0]);
          blank(right, nextView.rendered[1]);
        }
      }
      turningLeaf.style.width = `${sourceWidth}px`;
      stage.classList.toggle("turning-back", direction < 0);
      stage.classList.toggle("turning-forward", direction > 0);
      stage.classList.toggle("single-return", usesSinglePageTurn && direction < 0);
      // Give the browser a painted 0° leaf before starting the keyframes. Without
      // this frame boundary, cover-to-spread changes can be coalesced and look
      // like an instant page swap on slower devices.
      turningLeaf.classList.add("is-prepared");
      void turningLeaf.offsetWidth;
      turningLeaf.classList.add("is-turning");
      await new Promise((resolve) => turningLeaf.addEventListener("animationend", resolve, { once: true }));
    } catch (error) {
      focus = startFocus;
      status.textContent = "This page could not be assembled. Please refresh and try again.";
      console.error(error);
    } finally {
      if (nextView) settleView(nextView);
      else { renderLinks(pagesForView()); renderSolutions(pagesForView()); renderErrata(pagesForView()); }
      turningLeaf.classList.remove("is-turning");
      turningLeaf.classList.remove("is-prepared");
      stage.classList.remove("turning-back", "turning-forward", "single-return");
      busy = false; updateControls();
    }
  }

  async function jumpTo(page) {
    if (busy || page < 0 || page >= book.pages.length) return;
    busy = true; updateControls(); focus = page; setZoom(1, { resetPan: true }); tocPanel.hidden = true; tocToggle.setAttribute("aria-expanded", "false");
    try { await drawView(); } catch (error) { status.textContent = "This page could not be assembled. Please refresh and try again."; console.error(error); }
    finally { busy = false; updateControls(); }
  }

  function setMode() {
    const nextMode = window.innerWidth > 720;
    if (nextMode === isSpread) return;
    isSpread = nextMode;
    setZoom(1, { resetPan: true });
    drawView().catch((error) => { status.textContent = "This page could not be assembled. Please refresh and try again."; console.error(error); });
  }

  previous.addEventListener("click", () => go(-1));
  next.addEventListener("click", () => go(1));
  zoomOut.addEventListener("click", () => changeZoom(-1));
  zoomIn.addEventListener("click", () => changeZoom(1));
  stage.addEventListener("dblclick", (event) => {
    if (event.target.closest(".page-link, .page-toc-link, .solution-layer")) return;
    event.preventDefault();
    clearTimeout(edgeClickTimer);
    edgeClickTimer = null;
    setZoom(zoom === 1 ? 1.75 : 1, zoom === 1 ? { anchor: { x: event.clientX, y: event.clientY } } : { resetPan: true });
  });
  stage.addEventListener("wheel", (event) => {
    event.preventDefault();
    if (busy) return;
    wheelDelta += event.deltaY;
    if (Math.abs(wheelDelta) < 40) return;
    changeZoom(wheelDelta < 0 ? 1 : -1, { x: event.clientX, y: event.clientY });
    wheelDelta = 0;
  }, { passive: false });
  stage.addEventListener("click", (event) => {
    if (event.target.closest(".page-link, .page-toc-link, .solution-layer") || zoom > 1 || busy || event.detail > 1) return;
    const bounds = stage.getBoundingClientRect();
    const position = (event.clientX - bounds.left) / bounds.width;
    const direction = position <= 0.12 ? -1 : position >= 0.88 ? 1 : 0;
    if (!direction) return;
    clearTimeout(edgeClickTimer);
    edgeClickTimer = setTimeout(() => { edgeClickTimer = null; go(direction); }, 240);
  });
  stage.addEventListener("pointerdown", (event) => { if (!event.target.closest(".page-link, .page-toc-link, .solution-layer") && zoom > 1) { drag = { x: event.clientX, y: event.clientY, panX, panY }; stage.setPointerCapture(event.pointerId); stage.classList.add("is-panning"); } });
  stage.addEventListener("pointermove", (event) => { if (drag) { panX = drag.panX + event.clientX - drag.x; panY = drag.panY + event.clientY - drag.y; applyZoom(); } });
  stage.addEventListener("pointerup", () => { drag = null; stage.classList.remove("is-panning"); });
  document.addEventListener("keydown", (event) => { if (event.key === "ArrowLeft") go(-1); if (event.key === "ArrowRight") go(1); if (event.key === "Escape" && zoom > 1) setZoom(1, { resetPan: true }); });
  document.addEventListener("contextmenu", (event) => { if (event.target.closest(".reader-shell")) event.preventDefault(); });
  document.addEventListener("dragstart", (event) => { if (event.target.closest(".reader-shell")) event.preventDefault(); });
  tocToggle.addEventListener("click", () => { tocPanel.hidden = !tocPanel.hidden; tocToggle.setAttribute("aria-expanded", String(!tocPanel.hidden)); });
  tocClose.addEventListener("click", () => { tocPanel.hidden = true; tocToggle.setAttribute("aria-expanded", "false"); });
  tocPanel.addEventListener("click", (event) => { const button = event.target.closest("button[data-page]"); if (button) jumpTo(Number(button.dataset.page)); });
  solutionLayer.addEventListener("click", (event) => {
    // Rendering the overlay replaces the clicked node. Stop the event here so
    // it cannot then be mistaken for a page-edge click by the book stage.
    event.stopPropagation();
    if (event.target.closest("[data-close-solution]")) {
      openSolution = null;
      solutionPosition = null;
      renderSolutions(pagesForView());
      return;
    }
    const trigger = event.target.closest("button[data-solution-number]");
    if (!trigger) return;
    openSolution = {
      page: Number(trigger.dataset.solutionPage),
      number: Number(trigger.dataset.solutionNumber),
    };
    solutionPosition = null;
    openErratum = null;
    errataPosition = null;
    renderSolutions(pagesForView());
    renderErrata(pagesForView());
  });
  solutionLayer.addEventListener("pointerdown", (event) => {
    const handle = event.target.closest("[data-solution-drag-handle]");
    if (!handle || event.target.closest("[data-close-solution]")) return;
    const popover = handle.closest(".solution-popover");
    if (!popover) return;
    solutionDrag = {
      pointerId: event.pointerId,
      popover,
      x: event.clientX,
      y: event.clientY,
      left: parseFloat(popover.style.left),
      top: parseFloat(popover.style.top),
    };
    solutionLayer.setPointerCapture(event.pointerId);
    event.preventDefault();
    event.stopPropagation();
  });
  solutionLayer.addEventListener("pointermove", (event) => {
    if (!solutionDrag || event.pointerId !== solutionDrag.pointerId) return;
    const panelWidth = solutionDrag.popover.offsetWidth;
    const panelHeight = solutionDrag.popover.offsetHeight;
    const left = Math.max(6, Math.min(window.innerWidth - panelWidth - 6, solutionDrag.left + event.clientX - solutionDrag.x));
    const top = Math.max(6, Math.min(window.innerHeight - panelHeight - 6, solutionDrag.top + event.clientY - solutionDrag.y));
    solutionDrag.popover.style.left = `${left}px`;
    solutionDrag.popover.style.top = `${top}px`;
    solutionPosition = { left, top };
    event.preventDefault();
    event.stopPropagation();
  });
  solutionLayer.addEventListener("pointerup", (event) => {
    if (!solutionDrag || event.pointerId !== solutionDrag.pointerId) return;
    solutionLayer.releasePointerCapture(event.pointerId);
    solutionDrag = null;
    event.stopPropagation();
  });
  errataLayer.addEventListener("click", (event) => {
    if (event.target.closest("[data-close-erratum]")) {
      openErratum = null;
      errataPosition = null;
      renderErrata(pagesForView());
      return;
    }
    const trigger = event.target.closest("button[data-errata-number]");
    if (!trigger) return;
    openErratum = {
      page: Number(trigger.dataset.errataPage),
      number: Number(trigger.dataset.errataNumber),
    };
    errataPosition = null;
    openSolution = null;
    solutionPosition = null;
    renderErrata(pagesForView());
    renderSolutions(pagesForView());
  });
  errataLayer.addEventListener("pointerdown", (event) => {
    const handle = event.target.closest("[data-errata-drag-handle]");
    if (!handle || event.target.closest("[data-close-erratum]")) return;
    const popover = handle.closest(".errata-popover");
    if (!popover) return;
    errataDrag = {
      pointerId: event.pointerId,
      popover,
      x: event.clientX,
      y: event.clientY,
      left: parseFloat(popover.style.left),
      top: parseFloat(popover.style.top),
    };
    errataLayer.setPointerCapture(event.pointerId);
    event.preventDefault();
  });
  errataLayer.addEventListener("pointermove", (event) => {
    if (!errataDrag || event.pointerId !== errataDrag.pointerId) return;
    const panelWidth = errataDrag.popover.offsetWidth;
    const panelHeight = errataDrag.popover.offsetHeight;
    const left = Math.max(6, Math.min(window.innerWidth - panelWidth - 6, errataDrag.left + event.clientX - errataDrag.x));
    const top = Math.max(6, Math.min(window.innerHeight - panelHeight - 6, errataDrag.top + event.clientY - errataDrag.y));
    errataDrag.popover.style.left = `${left}px`;
    errataDrag.popover.style.top = `${top}px`;
    errataPosition = { left, top };
    event.preventDefault();
  });
  errataLayer.addEventListener("pointerup", (event) => {
    if (!errataDrag || event.pointerId !== errataDrag.pointerId) return;
    errataLayer.releasePointerCapture(event.pointerId);
    errataDrag = null;
  });
  window.addEventListener("resize", () => { setMode(); if (!busy) { renderLinks(pagesForView()); renderSolutions(pagesForView()); renderErrata(pagesForView()); } });
  isSpread = window.innerWidth > 720;
  drawView().catch((error) => { status.textContent = "This page could not be assembled. Please refresh and try again."; console.error(error); });
})();
