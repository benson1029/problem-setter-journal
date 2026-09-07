(() => {
  "use strict";

  // Seats are zero-based, as in section 3.4. Only occupied positions matter
  // when finding the next person's legal choices.
  function seatOptions(size, history) {
    const occupied = new Set(history);
    const distances = Array.from({ length: size }, (_, seat) => occupied.has(seat)
      ? null
      : history.length ? Math.min(...history.map((other) => Math.abs(seat - other))) : Infinity);
    const best = Math.max(-1, ...distances.filter((distance) => distance !== null));
    return { distances, choices: distances.flatMap((distance, seat) => distance === best ? [seat] : []) };
  }

  function countContinuations(size, history) {
    const memo = new Map();
    function count(mask) {
      if (memo.has(mask)) return memo.get(mask);
      const occupied = Array.from({ length: size }, (_, seat) => seat).filter((seat) => mask & (1 << seat));
      const choices = seatOptions(size, occupied).choices;
      const result = choices.length ? choices.reduce((sum, seat) => sum + count(mask | (1 << seat)), 0) : 1;
      memo.set(mask, result);
      return result;
    }
    return count(history.reduce((mask, seat) => mask | (1 << seat), 0));
  }

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function mountSeating(container) {
    const events = new AbortController();
    const listen = (node, type, callback) => node.addEventListener(type, callback, { signal: events.signal });
    let size = 8, first = 5, history = [5], highlight = true;
    const root = element("div", "extra-seating");
    root.append(element("p", "extra-intro", "Choose the next introvert's seat. After the first person, every choice must maximize the distance to the nearest occupied seat. Ties are allowed. Seats are numbered from 0."));

    const setup = element("div", "extra-controls");
    const sizeLabel = element("label", "", "Seats ");
    const sizeInput = element("select");
    [5, 8, 10, 12].forEach((value) => {
      const option = element("option", "", String(value)); option.value = String(value); sizeInput.append(option);
    });
    sizeInput.value = "8"; sizeLabel.append(sizeInput);
    const firstLabel = element("label", "", "First seat ");
    const firstInput = element("select");
    firstLabel.append(firstInput);
    function fillFirstSeats() {
      firstInput.replaceChildren();
      for (let seat = 0; seat < size; seat++) {
        const option = element("option", "", String(seat)); option.value = String(seat); firstInput.append(option);
      }
      firstInput.value = String(first);
    }
    fillFirstSeats();
    const reset = element("button", "", "Reset"); reset.type = "button";
    const bookExample = element("button", "", "Book example"); bookExample.type = "button";
    setup.append(sizeLabel, firstLabel, reset, bookExample); root.append(setup);

    const hintLabel = element("label", "extra-hint");
    const hint = element("input"); hint.type = "checkbox"; hint.checked = true;
    hintLabel.append(hint, document.createTextNode(" Highlight valid next seats")); root.append(hintLabel);
    const scroll = element("div", "extra-seat-scroll");
    const row = element("div", "extra-seat-row"); row.setAttribute("aria-label", "Seats and nearest occupied-seat distances");
    scroll.append(row); root.append(scroll);
    root.append(element("p", "extra-legend", "Top: seat number · Middle: arrival order or empty seat · Bottom: distance to the nearest person"));

    const status = element("p", "extra-status"); status.setAttribute("role", "status"); status.setAttribute("aria-live", "polite"); root.append(status);
    const actions = element("div", "extra-controls");
    const undo = element("button", "", "Undo"); undo.type = "button";
    const smallest = element("button", "", "Choose leftmost valid"); smallest.type = "button";
    const largest = element("button", "", "Choose rightmost valid"); largest.type = "button";
    actions.append(undo, smallest, largest); root.append(actions);
    root.append(element("p", "extra-note", "Repeatedly choosing the leftmost or rightmost valid seat gives the lexicographically smallest or largest continuation."));

    const traceScroll = element("div", "extra-trace-scroll");
    const trace = element("table", "extra-trace");
    trace.append(element("caption", "", "Your seating sequence")); traceScroll.append(trace); root.append(traceScroll);
    const countButton = element("button", "extra-count", "Count possible continuations"); countButton.type = "button";
    const countResult = element("p", "extra-count-result"); countResult.setAttribute("aria-live", "polite");
    root.append(countButton, countResult);
    container.append(root);

    function choose(seat) {
      const options = seatOptions(size, history);
      if (!options.choices.includes(seat)) {
        status.textContent = `Seat ${seat} is only ${options.distances[seat]} away from the nearest person. Choose a seat at distance ${options.distances[options.choices[0]]}.`;
        return;
      }
      history.push(seat); render();
    }
    function render() {
      const { distances, choices } = seatOptions(size, history);
      row.style.setProperty("--extra-seats", size);
      row.replaceChildren();
      for (let seat = 0; seat < size; seat++) {
        const arrival = history.indexOf(seat);
        const button = element("button", "extra-seat"); button.type = "button"; button.disabled = arrival !== -1;
        if (arrival !== -1) button.classList.add("extra-occupied");
        if (highlight && choices.includes(seat)) button.classList.add("extra-eligible");
        if (seat === history.at(-1)) button.classList.add("extra-latest");
        button.append(element("span", "extra-seat-number", String(seat)));
        button.append(element("span", "extra-seat-person", arrival === -1 ? "—" : `#${arrival + 1}`));
        button.append(element("span", "extra-seat-distance", arrival === -1 ? `d=${distances[seat]}` : "taken"));
        button.setAttribute("aria-label", arrival === -1
          ? `Seat ${seat}, distance ${distances[seat]}${highlight && choices.includes(seat) ? ", valid next choice" : ""}`
          : `Seat ${seat}, person ${arrival + 1}`);
        listen(button, "click", () => choose(seat)); row.append(button);
      }
      status.textContent = choices.length
        ? `Person ${history.length + 1} enters. The greatest available distance is ${distances[choices[0]]}.`
        : `All ${size} people are seated. Reset or undo to explore a different sequence.`;
      undo.disabled = history.length <= 1;
      smallest.disabled = largest.disabled = choices.length === 0;
      trace.querySelectorAll("tbody").forEach((node) => node.remove());
      const body = element("tbody");
      [["Seat", history], ["Distance", history.map((seat, index) => index ? seatOptions(size, history.slice(0, index)).distances[seat] : "∞")]].forEach(([label, values]) => {
        const tr = element("tr"); const th = element("th", "", label); th.scope = "row"; tr.append(th);
        values.forEach((value) => tr.append(element("td", "", String(value)))); body.append(tr);
      });
      trace.append(body); countResult.textContent = "";
    }
    listen(sizeInput, "change", () => { size = Number(sizeInput.value); first = Math.min(first, size - 1); fillFirstSeats(); history = [first]; render(); });
    listen(firstInput, "change", () => { first = Number(firstInput.value); history = [first]; render(); });
    listen(reset, "click", () => { history = [first]; render(); });
    listen(bookExample, "click", () => { size = 8; first = 5; sizeInput.value = "8"; fillFirstSeats(); history = [first]; render(); });
    listen(hint, "change", () => { highlight = hint.checked; render(); });
    listen(undo, "click", () => { if (history.length > 1) history.pop(); render(); });
    listen(smallest, "click", () => { const choices = seatOptions(size, history).choices; if (choices.length) choose(choices[0]); });
    listen(largest, "click", () => { const choices = seatOptions(size, history).choices; if (choices.length) choose(choices.at(-1)); });
    listen(countButton, "click", () => {
      const count = countContinuations(size, history);
      countResult.textContent = `${count.toLocaleString()} valid ${count === 1 ? "completion" : "completions"} from this state${history.length === size ? " (the completed sequence itself)" : ""}.`;
    });
    render();
    return () => { events.abort(); root.remove(); };
  }

  window.JournalWidgets = window.JournalWidgets || [];
  window.JournalWidgets.push({
    id: "introvert-seating", title: "Introvert Seating", pages: [79], y: 0.69, mount: mountSeating,
  });
})();
