(() => {
  const book = window.__PROBLEM_SETTER_JOURNAL__;
  const stage = document.getElementById("book-stage");
  const single = document.getElementById("single-page");
  const left = document.getElementById("left-page");
  const right = document.getElementById("right-page");
  const turningLeaf = document.getElementById("turning-leaf");
  const turningFront = document.getElementById("turning-front");
  const turningBack = document.getElementById("turning-back");
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
  const zoomSteps = [1, 1.25, 1.5, 1.75, 2, 2.5, 3];
  let focus = 0, isSpread = false, busy = false, zoom = 1, panX = 0, panY = 0, drag = null, edgeClickTimer = null;
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

  async function assemble(page) {
    const rendered = document.createElement("canvas");
    rendered.width = book.width; rendered.height = book.height;
    const context = rendered.getContext("2d", { alpha: false });
    context.fillStyle = "#fff"; context.fillRect(0, 0, book.width, book.height);
    const pieces = book.pages[page];
    const images = new Map(await Promise.all([...new Set(pieces.map((piece) => piece[0]))].map(async (index) => [index, await loadImage(index)])));
    for (const [asset, sx, sy, width, height, dx, dy] of pieces) context.drawImage(images.get(asset), sx, sy, width, height, dx, dy, width, height);
    return rendered;
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
    const assets = new Set(targets.flatMap(pagesForFocus).flatMap((page) => book.pages[page].map(([asset]) => asset)));
    const prefetch = () => { void Promise.all([...assets].map(loadImage)).catch(() => {}); };
    if ("requestIdleCallback" in window) window.requestIdleCallback(prefetch, { timeout: 1000 });
    else window.setTimeout(prefetch, 150);
  }

  function updateControls() {
    const visible = pagesForView();
    previous.disabled = focus === 0 || busy;
    next.disabled = visible.at(-1) === book.pages.length - 1 || busy;
    const displayed = visible.map((page) => page + 1);
    label.textContent = displayed.length === 1 ? `Page ${displayed[0]} of ${book.pages.length}` : `Pages ${displayed.join("–")} of ${book.pages.length}`;
    zoomOut.disabled = zoom <= zoomSteps[0];
    zoomIn.disabled = zoom >= zoomSteps.at(-1);
    zoomLevel.textContent = `${Math.round(zoom * 100)}%`;
    status.textContent = "";
  }

  function settleView(view) {
    paintView(view);
    updateCoverTurnOffset(view.pages);
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
    const currentPages = pagesForView();
    const source = isSpread && currentPages.length === 2 ? (direction > 0 ? right : left) : single;
    const stationaryPage = currentPages.length === 2 ? snapshot(direction > 0 ? left : right) : null;
    // Preserve the outgoing leaf before the target view changes its layout. This
    // is essential at the covers, where the outgoing canvas is otherwise hidden.
    const sourceWidth = source.getBoundingClientRect().width;
    copy(turningFront, source);
    const startFocus = focus;
    focus = target;
    let nextView;
    try {
      nextView = await drawView({ deferPaint: true }); // Fully assemble the target before the turn, without revealing it.
      const reverse = direction > 0 ? nextView.rendered[0] : nextView.rendered.at(-1);
      copy(turningBack, reverse);
      // The page beneath the leaf can update immediately; the leaf's landing
      // page stays deferred until the animation finishes.
      if (currentPages.length === 2 && nextView.pages.length === 1) {
        copy(single, stationaryPage);
      } else if (currentPages.length === 2) {
        if (direction > 0) copy(right, nextView.rendered[1]);
        else copy(left, nextView.rendered[0]);
      } else if (currentPages.length === 1 && nextView.pages.length === 2) {
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
      turningLeaf.classList.remove("is-turning");
      turningLeaf.classList.remove("is-prepared");
      stage.classList.remove("turning-back", "turning-forward");
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
    if (zoom > 1 || busy || event.detail > 1) return;
    const bounds = stage.getBoundingClientRect();
    const position = (event.clientX - bounds.left) / bounds.width;
    const direction = position <= 0.12 ? -1 : position >= 0.88 ? 1 : 0;
    if (!direction) return;
    clearTimeout(edgeClickTimer);
    edgeClickTimer = setTimeout(() => { edgeClickTimer = null; go(direction); }, 240);
  });
  stage.addEventListener("pointerdown", (event) => { if (zoom > 1) { drag = { x: event.clientX, y: event.clientY, panX, panY }; stage.setPointerCapture(event.pointerId); stage.classList.add("is-panning"); } });
  stage.addEventListener("pointermove", (event) => { if (drag) { panX = drag.panX + event.clientX - drag.x; panY = drag.panY + event.clientY - drag.y; applyZoom(); } });
  stage.addEventListener("pointerup", () => { drag = null; stage.classList.remove("is-panning"); });
  document.addEventListener("keydown", (event) => { if (event.key === "ArrowLeft") go(-1); if (event.key === "ArrowRight") go(1); if (event.key === "Escape" && zoom > 1) setZoom(1, { resetPan: true }); });
  document.addEventListener("contextmenu", (event) => { if (event.target.closest(".reader-shell")) event.preventDefault(); });
  document.addEventListener("dragstart", (event) => { if (event.target.closest(".reader-shell")) event.preventDefault(); });
  tocToggle.addEventListener("click", () => { tocPanel.hidden = !tocPanel.hidden; tocToggle.setAttribute("aria-expanded", String(!tocPanel.hidden)); });
  tocClose.addEventListener("click", () => { tocPanel.hidden = true; tocToggle.setAttribute("aria-expanded", "false"); });
  tocPanel.addEventListener("click", (event) => { const button = event.target.closest("button[data-page]"); if (button) jumpTo(Number(button.dataset.page)); });
  window.addEventListener("resize", setMode);
  isSpread = window.innerWidth > 720;
  drawView().catch((error) => { status.textContent = "This page could not be assembled. Please refresh and try again."; console.error(error); });
})();
