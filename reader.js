(() => {
  const book = window.__PROBLEM_SETTER_JOURNAL__;
  const stage = document.getElementById("book-stage");
  const single = document.getElementById("single-page");
  const left = document.getElementById("left-page");
  const right = document.getElementById("right-page");
  const turning = document.getElementById("turning-page");
  const previous = document.getElementById("previous-page");
  const next = document.getElementById("next-page");
  const zoomToggle = document.getElementById("zoom-toggle");
  const tocToggle = document.getElementById("toc-toggle");
  const tocPanel = document.getElementById("toc-panel");
  const tocClose = document.getElementById("toc-close");
  const label = document.getElementById("page-label");
  const status = document.getElementById("reader-status");
  const imageCache = new Map();
  let focus = 0, isSpread = false, busy = false, zoom = 1, panX = 0, panY = 0, drag = null, edgeClickTimer = null;

  if (!book) {
    status.textContent = "The reading edition has not been published yet.";
    previous.disabled = true; next.disabled = true; zoomToggle.disabled = true;
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

  function normalize() { if (isSpread && focus !== 0 && focus !== book.pages.length - 1) focus = focus % 2 ? focus : focus - 1; }
  function pagesForView() { return !isSpread || focus === 0 || focus === book.pages.length - 1 ? [focus] : [focus, focus + 1]; }

  function updateControls() {
    const visible = pagesForView();
    previous.disabled = focus === 0 || busy;
    next.disabled = visible.at(-1) === book.pages.length - 1 || busy;
    const displayed = visible.map((page) => page + 1);
    label.textContent = displayed.length === 1 ? `Page ${displayed[0]} of ${book.pages.length}` : `Pages ${displayed.join("–")} of ${book.pages.length}`;
    zoomToggle.textContent = zoom === 1 ? "Zoom" : "Fit page";
    status.textContent = "";
  }

  async function drawView() {
    normalize();
    const pages = pagesForView();
    const rendered = await Promise.all(pages.map(assemble));
    stage.classList.toggle("is-spread", pages.length === 2);
    stage.classList.toggle("is-single", pages.length !== 2);
    if (pages.length === 2) { copy(left, rendered[0]); copy(right, rendered[1]); }
    else copy(single, rendered[0]);
    updateControls();
  }

  function nextFocus(direction) {
    if (!isSpread) return Math.max(0, Math.min(book.pages.length - 1, focus + direction));
    if (direction > 0) return focus === 0 ? 1 : Math.min(book.pages.length - 1, focus + 2);
    return focus <= 1 ? 0 : focus - 2;
  }

  function applyZoom() {
    stage.classList.toggle("is-zoomed", zoom > 1);
    stage.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;
    zoomToggle.textContent = zoom === 1 ? "Zoom" : "Fit page";
  }

  function setZoom(nextZoom) {
    zoom = nextZoom; panX = 0; panY = 0; applyZoom();
  }

  async function go(direction) {
    const target = nextFocus(direction);
    if (busy || target === focus) return;
    busy = true; updateControls();
    const source = isSpread && pagesForView().length === 2 ? (direction > 0 ? right : left) : single;
    turning.width = source.width; turning.height = source.height;
    turning.getContext("2d", { alpha: false }).drawImage(source, 0, 0);
    focus = target;
    try {
      await drawView(); // The next spread is fully assembled before the turn starts.
      stage.classList.toggle("turning-back", direction < 0);
      turning.classList.add("is-turning");
      await new Promise((resolve) => turning.addEventListener("animationend", resolve, { once: true }));
    } catch (error) {
      status.textContent = "This page could not be assembled. Please refresh and try again.";
      console.error(error);
    } finally {
      turning.classList.remove("is-turning"); stage.classList.remove("turning-back");
      busy = false; updateControls();
    }
  }

  async function jumpTo(page) {
    if (busy || page < 0 || page >= book.pages.length) return;
    busy = true; updateControls(); focus = page; setZoom(1); tocPanel.hidden = true; tocToggle.setAttribute("aria-expanded", "false");
    try { await drawView(); } catch (error) { status.textContent = "This page could not be assembled. Please refresh and try again."; console.error(error); }
    finally { busy = false; updateControls(); }
  }

  function setMode() {
    const nextMode = window.innerWidth > 720;
    if (nextMode === isSpread) return;
    isSpread = nextMode;
    setZoom(1);
    drawView().catch((error) => { status.textContent = "This page could not be assembled. Please refresh and try again."; console.error(error); });
  }

  previous.addEventListener("click", () => go(-1));
  next.addEventListener("click", () => go(1));
  zoomToggle.addEventListener("click", () => setZoom(zoom === 1 ? 1.75 : 1));
  stage.addEventListener("dblclick", (event) => {
    event.preventDefault();
    clearTimeout(edgeClickTimer);
    edgeClickTimer = null;
    setZoom(zoom === 1 ? 1.75 : 1);
  });
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
  document.addEventListener("keydown", (event) => { if (event.key === "ArrowLeft") go(-1); if (event.key === "ArrowRight") go(1); if (event.key === "Escape" && zoom > 1) setZoom(1); });
  document.addEventListener("contextmenu", (event) => { if (event.target.closest(".reader-shell")) event.preventDefault(); });
  document.addEventListener("dragstart", (event) => { if (event.target.closest(".reader-shell")) event.preventDefault(); });
  tocToggle.addEventListener("click", () => { tocPanel.hidden = !tocPanel.hidden; tocToggle.setAttribute("aria-expanded", String(!tocPanel.hidden)); });
  tocClose.addEventListener("click", () => { tocPanel.hidden = true; tocToggle.setAttribute("aria-expanded", "false"); });
  tocPanel.addEventListener("click", (event) => { const button = event.target.closest("button[data-page]"); if (button) jumpTo(Number(button.dataset.page)); });
  window.addEventListener("resize", setMode);
  isSpread = window.innerWidth > 720;
  drawView().catch((error) => { status.textContent = "This page could not be assembled. Please refresh and try again."; console.error(error); });
})();
