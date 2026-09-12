(() => {
  "use strict";

  const ASSETS = "assets/widgets/";
  const key = (r, c) => `${r},${c}`;
  const parseKey = (value) => value.split(",").map(Number);
  const displayCell = (value) => parseKey(value).map((part) => part + 1).join(", ");
  const make = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const listen = (events, node, type, fn) => node.addEventListener(type, fn, { signal: events.signal });

  function neighbours(cell, rows, columns, available) {
    const [r, c] = cell;
    return [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]]
      .filter(([nr, nc]) => nr >= 0 && nr < rows && nc >= 0 && nc < columns && available.has(key(nr, nc)));
  }

  function walk(positions, steps, rows, columns, available) {
    let current = new Set(positions);
    for (let step = 0; step < steps; step += 1) {
      const next = new Set();
      current.forEach((value) => neighbours(parseKey(value), rows, columns, available)
        .forEach(([r, c]) => next.add(key(r, c))));
      current = next;
      if (!current.size) break;
    }
    return current;
  }

  function hasAnyLegalMove(positions, rows, columns, available) {
    for (const value of positions) if (neighbours(parseKey(value), rows, columns, available).length) return true;
    return false;
  }

  function canCompleteMove(positions, steps, rows, columns, available) {
    let current = new Set(positions);
    for (let step = 0; step < steps; step += 1) {
      if (!current.size || [...current].some((value) => !neighbours(parseKey(value), rows, columns, available).length)) return false;
      current = walk(current, 1, rows, columns, available);
    }
    return current.size > 0;
  }

  function snapshot(state) {
    return { rows: state.rows, columns: state.columns, target: [...state.target], available: new Set(state.available), positions: new Set(state.positions), x: state.x, moves: state.moves, log: state.log.map((entry) => ({ ...entry, positions: entry.positions ? [...entry.positions] : undefined })), turn: state.turn, locked: state.locked, won: state.won, failure: state.failure ? { ...state.failure, positions: [...state.failure.positions] } : null };
  }

  function restore(state, saved) {
    state.rows = saved.rows; state.columns = saved.columns; state.target = [...saved.target];
    state.available = new Set(saved.available); state.positions = new Set(saved.positions);
    state.x = saved.x; state.moves = saved.moves; state.log = saved.log.map((entry) => ({ ...entry, positions: entry.positions ? [...entry.positions] : undefined }));
    state.turn = saved.turn || "move"; state.locked = saved.locked; state.won = saved.won; state.failure = saved.failure ? { ...saved.failure, positions: [...saved.failure.positions] } : null;
  }

  function createImage(src, className, alt) {
    const image = document.createElement("img");
    image.src = ASSETS + src; image.className = className; image.alt = alt;
    image.draggable = false;
    return image;
  }

  function mountRobot(container, options = {}) {
    const events = new AbortController();
    const root = make("section", "at-root at-game");
    const intro = make("p", "at-intro", "Play blind: move, destroy one cell, and repeat.");
    root.append(intro);

    const state = { rows: 2, columns: 2, target: [1, 1], available: new Set(), positions: new Set(), x: 1, moves: 0, history: [], log: [], turn: "move", locked: false, won: false, failure: null, failureFrame: null };
    const setup = make("div", "at-toolbar");
    const caseHost = make("div"); root.append(caseHost);
    let config = options.config || { rows: 2, cols: 2, target: [1, 1] };
    options.config = config;
    const xLabel = make("label", "at-label", "Moves ");
    const xInput = make("input", "at-number"); xInput.type = "number"; xInput.min = "1"; xInput.max = "400"; xInput.value = "1"; xInput.inputMode = "numeric";
    xLabel.append(xInput);
    const advance = make("button", "at-primary", "Move robot"); advance.type = "button";
    const undo = make("button", "", "Undo"); undo.type = "button";
    const reset = make("button", "", "Reset"); reset.type = "button";
    const replaySpeedLabel = make("label", "at-label", "Replay speed");
    const replaySpeed = make("select", "at-select");
    replaySpeed.innerHTML = '<option value=".5">½×</option><option value="1" selected>1×</option><option value="2">2×</option><option value="3">3×</option>';
    replaySpeed.title = "Change the speed of the failure replay";
    replaySpeedLabel.append(replaySpeed);
    const visibilityLabel = make("label", "at-check");
    const visibility = make("input"); visibility.type = "checkbox"; visibility.checked = false; visibility.setAttribute("aria-label", "Show possible robot positions");
    visibilityLabel.append(visibility, make("span", "", "Show possible positions"));
    setup.append(xLabel, advance, undo, reset, replaySpeedLabel, visibilityLabel); root.append(setup);

    const board = make("div", "at-board"); board.setAttribute("role", "grid"); board.setAttribute("aria-label", "Arctic island grid");
    const status = make("p", "at-status"); status.setAttribute("role", "status"); status.setAttribute("aria-live", "polite"); root.append(status);
    const legend = make("div", "at-legend");
    legend.append(make("span", "at-legend-item", "Target"), make("span", "at-legend-item", "Reachable"), make("span", "at-legend-item", "Destroyed"));
    const note = make("details", "at-details");
    const summary = make("summary", "", "What counts as safe?");
    note.append(summary, make("p", "at-detail-copy", "A destruction is safe only if no possible robot is on that cell."));
    const gameLayout = make("div", "at-game-layout");
    const boardScroll = make("div", "arctic-board-scroll"); boardScroll.tabIndex = 0; boardScroll.setAttribute("aria-label", "Scrollable Arctic grid"); boardScroll.append(board);
    const gameMain = make("div", "at-game-main"); gameMain.append(boardScroll, status, legend, note);
    const historyPanel = make("aside", "at-history"); historyPanel.append(make("h3", "", "History"));
    const historyList = make("ol", "at-history-list"); historyPanel.append(historyList);
    gameLayout.append(gameMain, historyPanel); root.append(gameLayout);
    const failurePanel = make("section", "at-failure"); failurePanel.hidden = true;
    const failureTitle = make("h3", "at-failure-title");
    failurePanel.append(failureTitle); gameMain.append(failurePanel);
    container.append(root);
    let failureTimer = null, replayCache = null;
    const controls = window.ArcticSetup.mount(caseHost, config, next => { config = next; options.config = next; loadCase(); });

    function fitBoard() {
      const width = Math.max(160, boardScroll.clientWidth - 6);
      const height = Math.max(160, Math.min(460, Math.round(window.innerHeight * .5)));
      const largestDimension = Math.max(state.rows, state.columns);
      const minimum = largestDimension >= 24 ? 20 : largestDimension >= 12 ? 28 : 36;
      const cell = Math.floor(Math.max(minimum, Math.min(96, width / state.columns, height / state.rows)));
      board.style.setProperty("--arctic-fit-cell", `${cell}px`);
    }
    const boardObserver = "ResizeObserver" in window ? new ResizeObserver(fitBoard) : null;
    boardObserver?.observe(boardScroll);

    function loadCase() {
      state.rows = config.rows; state.columns = config.cols; state.target = [...config.target];
      state.available = new Set();
      for (let r = 0; r < state.rows; r += 1) for (let c = 0; c < state.columns; c += 1) state.available.add(key(r, c));
      clearFailureReplay();
      state.positions = new Set([key(0, 0)]); state.x = 1; state.moves = 0; state.history = []; state.log = []; state.turn = "move"; state.locked = false; state.won = false; state.failure = null;
      if (state.rows * state.columns === 1) state.won = state.locked = true;
      boardScroll.scrollTop = boardScroll.scrollLeft = 0;
      xInput.value = "1"; render();
    }
    function save() { state.history.push(snapshot(state)); if (state.history.length > 20) state.history.shift(); }
    function chooseCell(value) {
      if (state.locked || state.turn !== "destroy" || !state.available.has(value) || value === key(...state.target)) return;
      save();
      const occupied = state.positions.has(value);
      state.available.delete(value); state.moves += 1;
      state.log.push({ kind: "destroy", cell: value, occupied });
      if (occupied) {
        state.failure = { reason: "destroyed", cell: value, positions: [...state.positions] }; state.locked = true;
      } else if ([...state.available].every((cell) => cell === key(...state.target)) && state.positions.has(key(...state.target))) {
        state.won = true; state.locked = true;
      } else if (!hasAnyLegalMove(state.positions, state.rows, state.columns, state.available)) {
        state.failure = { reason: "stuck", positions: [...state.positions], amount: 0, trigger: "destroy" }; state.locked = true;
      } else {
        state.turn = "move";
      }
      render(); if (state.failure) startFailureReplay();
    }
    function render() {
      board.style.setProperty("--at-columns", state.columns);
      board.style.setProperty("--arctic-cols", state.columns);
      board.style.setProperty("--at-rows", state.rows);
      board.replaceChildren();
      const frames = state.failure ? failureFrames() : [];
      const replayFrame = Number.isInteger(state.failureFrame) ? frames[state.failureFrame] : null;
      const frameAvailable = replayFrame?.available || state.available;
      for (let r = 0; r < state.rows; r += 1) for (let c = 0; c < state.columns; c += 1) {
        const value = key(r, c); const cell = make("button", "at-cell"); cell.type = "button"; cell.setAttribute("role", "gridcell"); cell.dataset.cell = value;
        const target = r === state.target[0] && c === state.target[1];
        const available = frameAvailable.has(value); const reachable = replayFrame ? replayFrame.robot === value : state.positions.has(value); const showReachable = reachable && (visibility.checked || !!replayFrame);
        const failureActive = !!replayFrame?.failureKind && (replayFrame.robot === value || replayFrame.failureCell === value);
        cell.classList.toggle("is-target", target); cell.classList.toggle("is-reachable", showReachable); cell.classList.toggle("is-destroyed", !available); cell.classList.toggle("is-failure-active", failureActive);
        cell.disabled = !available || target || state.locked || state.turn !== "destroy";
        cell.setAttribute("aria-label", `${target ? "Target, " : ""}cell ${r + 1}, ${c + 1}${!available ? ", destroyed" : reachable ? ", possible robot position" : ", safe to destroy"}`);
        if (target) {
          cell.append(createImage("flag.png", "at-flag", "Target"));
          if (failureActive) cell.append(createImage("robot.png", "at-robot at-failure-robot", "Robot trapped on target cell"));
          else if (showReachable) cell.append(createImage("robot.png", "at-robot", replayFrame ? "Robot in replay" : "Possible robot position"));
        }
        else if (!available) cell.append(createImage("destroyed.png", "at-destroyed", "Destroyed"));
        else if (failureActive) cell.append(createImage("robot.png", "at-robot at-failure-robot", "Robot in failure replay"));
        else if (showReachable) cell.append(createImage("robot.png", "at-robot", replayFrame ? "Robot in replay" : "Possible robot position"));
        if (!available && failureActive) cell.append(createImage("robot.png", "at-robot at-failure-robot", "Robot on destroyed cell"));
        cell.append(make("span", "at-coord", `${r + 1},${c + 1}`));
        board.append(cell);
      }
      const targetKey = key(...state.target);
      const remaining = [...state.available].filter((cell) => cell !== targetKey).length;
      if (state.failure) status.textContent = state.failure.reason === "destroyed" ? "Game over: a possible robot position was destroyed." : "Game over: the robot has no legal move.";
      else if (state.won) status.textContent = "Target secured.";
      else status.textContent = `${state.positions.size} possible position${state.positions.size === 1 ? "" : "s"}; ${remaining} cell${remaining === 1 ? "" : "s"} left to destroy. ${state.turn === "move" ? "Move the robot." : "Destroy one cell."}`;
      undo.disabled = !state.history.length;
      advance.disabled = state.locked || state.turn !== "move";
      renderHistory(); renderFailurePanel();
      requestAnimationFrame(fitBoard);
    }
    function advanceRobot() {
      if (state.locked || state.turn !== "move") return;
      const amount = Math.max(1, Math.min(400, Math.floor(Number(xInput.value)) || 1)); xInput.value = amount;
      const next = walk(state.positions, amount, state.rows, state.columns, state.available);
      save(); state.x = amount; state.moves += 1;
      if (!canCompleteMove(state.positions, amount, state.rows, state.columns, state.available) || !next.size) {
        state.log.push({ kind: "move", amount, positions: [...state.positions], stuck: true });
        state.failure = { reason: "stuck", positions: [...state.positions], amount }; state.locked = true;
        render(); startFailureReplay(); return;
      }
      state.positions = next; state.turn = "destroy"; state.log.push({ kind: "move", amount, positions: [...next], stuck: false }); render();
    }
    function renderHistory() {
      historyList.replaceChildren();
      if (!state.log.length) { historyList.append(make("li", "at-history-empty", "No moves yet.")); return; }
      const frames = state.failure ? failureFrames() : [];
      const replayFrame = Number.isInteger(state.failureFrame) ? frames[state.failureFrame] : null;
      state.log.forEach((entry, index) => {
        const item = make("li", entry.occupied ? "is-danger" : "", entry.kind === "move"
          ? `${entry.amount} move${entry.amount === 1 ? "" : "s"}${entry.stuck ? " · no legal move" : ` · ${entry.positions.length} possible`}`
          : `Destroy ${displayCell(entry.cell)}${entry.occupied ? " · robot could be here" : " · safe"}`);
        const active = replayFrame?.operationIndex === index;
        item.classList.toggle("is-replay-active", active);
        if (active) item.setAttribute("aria-current", "step");
        historyList.append(item);
      });
    }
    function movePaths(start, steps, available) {
      let routes = new Map([[start, [start]]]);
      for (let step = 0; step < steps; step += 1) {
        const next = new Map();
        routes.forEach((path, position) => neighbours(parseKey(position), state.rows, state.columns, available).forEach(([r, c]) => {
          const value = key(r, c); if (!next.has(value)) next.set(value, [...path, value]);
        }));
        routes = next;
      }
      return routes;
    }
    function pathToFailure(start, steps, available) {
      const visited = new Set();
      function search(position, step, path) {
        if (step >= steps) return null;
        const visitKey = `${position}|${step}`;
        if (visited.has(visitKey)) return null;
        visited.add(visitKey);
        const next = neighbours(parseKey(position), state.rows, state.columns, available);
        if (!next.length) return path;
        for (const [r, c] of next) {
          const result = search(key(r, c), step + 1, [...path, key(r, c)]);
          if (result) return result;
        }
        return null;
      }
      return search(start, 0, [start]);
    }
    function failureFrames() {
      if (!state.failure) return [];
      if (replayCache?.failure === state.failure) return replayCache.frames;
      const available = new Set();
      for (let r = 0; r < state.rows; r += 1) for (let c = 0; c < state.columns; c += 1) available.add(key(r, c));
      const startFrame = { label: "Start · clean grid", kind: "start", operationIndex: null, available: new Set(available), robot: key(0, 0) };
      const memo = new Map();
      function search(operationIndex, robot, currentAvailable) {
        const memoKey = `${operationIndex}|${robot}`;
        if (memo.has(memoKey)) return memo.get(memoKey);
        if (operationIndex >= state.log.length) return null;
        const entry = state.log[operationIndex];
        if (entry.kind === "move") {
          if (entry.stuck) {
            const path = pathToFailure(robot, entry.amount, currentAvailable);
            if (!path) return null;
            const frames = path.slice(1).map((position, step) => ({ label: `Move ${entry.amount} · step ${step + 1}`, kind: "move", operationIndex, available: new Set(currentAvailable), robot: position }));
            const trappedAt = path[path.length - 1];
            frames.push({ label: `Move ${entry.amount}: trapped at ${displayCell(trappedAt)}`, kind: "move", operationIndex, available: new Set(currentAvailable), robot: trappedAt, failureKind: "stuck", failureCell: trappedAt });
            const result = { frames }; memo.set(memoKey, result); return result;
          }
          for (const [end, path] of movePaths(robot, entry.amount, currentAvailable)) {
            const tail = search(operationIndex + 1, end, currentAvailable);
            if (tail) {
              const frames = path.slice(1).map((position, step) => ({ label: `Move ${entry.amount} · step ${step + 1}`, kind: "move", operationIndex, available: new Set(currentAvailable), robot: position }));
              const result = { frames: [...frames, ...tail.frames] }; memo.set(memoKey, result); return result;
            }
          }
        } else if (entry.kind === "destroy") {
          const after = new Set(currentAvailable); after.delete(entry.cell);
          if (entry.occupied) {
            if (robot !== entry.cell) return null;
            const result = { frames: [{ label: `Destroy ${displayCell(entry.cell)} · failure`, kind: "destroy", operationIndex, available: new Set(after), robot, failureKind: "destroyed", failureCell: entry.cell }] };
            memo.set(memoKey, result); return result;
          }
          if (robot === entry.cell) return null;
          const trapped = operationIndex === state.log.length - 1 && state.failure.reason === "stuck" && !hasAnyLegalMove(new Set([robot]), state.rows, state.columns, after);
          const frame = { label: `Destroy ${displayCell(entry.cell)}${trapped ? " · failure" : ""}`, kind: "destroy", operationIndex, available: new Set(after), robot, failureKind: trapped ? "stuck" : null, failureCell: trapped ? robot : null };
          if (trapped) { const result = { frames: [frame] }; memo.set(memoKey, result); return result; }
          const tail = search(operationIndex + 1, robot, after);
          if (tail) { const result = { frames: [frame, ...tail.frames] }; memo.set(memoKey, result); return result; }
        }
        memo.set(memoKey, null); return null;
      }
      const route = search(0, key(0, 0), available);
      const frames = route ? [startFrame, ...route.frames] : [startFrame];
      replayCache = { failure: state.failure, frames }; return frames;
    }
    function renderFailurePanel() {
      if (!state.failure) { failurePanel.hidden = true; return; }
      failurePanel.hidden = false;
      failureTitle.textContent = state.failure.reason === "destroyed" ? "Failure replay: destroyed cell" : "Failure replay: trapped robot";
    }
    function clearFailureReplay() { if (failureTimer) { clearInterval(failureTimer); failureTimer = null; } state.failureFrame = null; }
    function startFailureReplay(startAt = 0) {
      clearFailureReplay(); const frames = failureFrames(); if (!frames.length) return;
      let frame = Math.min(startAt, frames.length - 1); state.failureFrame = frame; render();
      const delay = Math.round(650 / Number(replaySpeed.value));
      failureTimer = setInterval(() => { frame += 1; if (frame >= frames.length) { clearFailureReplay(); state.failureFrame = frames.length - 1; render(); return; } state.failureFrame = frame; render(); }, delay);
    }
    listen(events, board, "click", event => { const cell = event.target.closest('[data-cell]'); if (cell && !cell.disabled) chooseCell(cell.dataset.cell); });
    listen(events, advance, "click", advanceRobot);
    listen(events, undo, "click", () => { const saved = state.history.pop(); if (saved) { clearFailureReplay(); restore(state, saved); render(); } });
    listen(events, reset, "click", loadCase);
    listen(events, visibility, "change", render);
    listen(events, replaySpeed, "change", () => { if (failureTimer) startFailureReplay(state.failureFrame ?? 0); });
    loadCase();
    return () => { clearFailureReplay(); boardObserver?.disconnect(); controls.destroy(); events.abort(); root.remove(); };
  }

  window.JournalWidgets = window.JournalWidgets || [];
  window.JournalWidgets.push({ id: "arctic-technology", title: "Arctic Technology", pages: [19, 20, 21, 22, 23], badge: { page: 19, y: .58 }, mount: mountRobot });
})();
