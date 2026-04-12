// ─────────────────────────────────────────────
// cmatrix — Matrix digital rain (theme-aware)
// Renders inside #terminal using a monospaced character grid
// ─────────────────────────────────────────────
(function () {
  "use strict";

  const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789{}<>|/\\=+*&^%$#@!?";
  const IDLE_TIMEOUT = 60_000; // 1 minute
  const FONT_SIZE = 14;
  const LINE_HEIGHT = 1.25;
  const CELL_H = Math.round(FONT_SIZE * LINE_HEIGHT);
  const TICK_MS = 50;

  let grid = []; // 2D array [row][col] = { ch, age }
  let columns = 0;
  let rows = 0;
  let drops = []; // per-column state
  let intervalId = null;
  let container = null; // the <pre> we render into
  let idleTimer = null;
  let active = false;

  function randChar() {
    return CHARS[Math.floor(Math.random() * CHARS.length)];
  }

  function getColors() {
    const s = getComputedStyle(document.documentElement);
    return {
      bright: s.getPropertyValue("--cyan").trim() || "#00ffd5",
      mid: s.getPropertyValue("--cyan-dim").trim() || "#00b396",
      dim: s.getPropertyValue("--grey").trim() || "#3d4f4a",
      bg: s.getPropertyValue("--bg-term").trim() || "#060d0b",
      white: s.getPropertyValue("--white").trim() || "#d4dbd8",
    };
  }

  function setup() {
    const terminal = document.getElementById("terminal");
    const rect = terminal.getBoundingClientRect();
    const charW = FONT_SIZE * 0.6; // monospace approx
    columns = Math.floor(rect.width / charW);
    rows = Math.floor(rect.height / CELL_H);

    grid = [];
    for (let r = 0; r < rows; r++) {
      grid[r] = [];
      for (let c = 0; c < columns; c++) {
        grid[r][c] = { ch: " ", age: -1 };
      }
    }

    drops = [];
    for (let c = 0; c < columns; c++) {
      drops[c] = {
        y: Math.floor(Math.random() * -rows),
        speed: 1 + Math.floor(Math.random() * 2),
        len: 6 + Math.floor(Math.random() * 14),
        tick: 0,
      };
    }
  }

  function tick() {
    // Age all cells
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < columns; c++) {
        if (grid[r][c].age >= 0) grid[r][c].age++;
      }
    }

    // Advance drops
    for (let c = 0; c < columns; c++) {
      const d = drops[c];
      d.tick++;
      if (d.tick < d.speed) continue;
      d.tick = 0;
      d.y++;

      // Write head character
      if (d.y >= 0 && d.y < rows) {
        grid[d.y][c] = { ch: randChar(), age: 0 };
      }

      // Erase tail
      const tailRow = d.y - d.len;
      if (tailRow >= 0 && tailRow < rows) {
        grid[tailRow][c] = { ch: " ", age: -1 };
      }

      // Randomly mutate a mid-trail character
      const mutRow = d.y - 1 - Math.floor(Math.random() * Math.min(d.len, d.y));
      if (mutRow >= 0 && mutRow < rows && Math.random() < 0.15) {
        grid[mutRow][c].ch = randChar();
      }

      // Reset when fully off screen
      if (d.y - d.len > rows) {
        d.y = Math.floor(Math.random() * -8);
        d.speed = 1 + Math.floor(Math.random() * 2);
        d.len = 6 + Math.floor(Math.random() * 14);
      }
    }

    render();
  }

  function render() {
    const colors = getColors();
    const lines = [];

    for (let r = 0; r < rows; r++) {
      let line = "";
      for (let c = 0; c < columns; c++) {
        const cell = grid[r][c];
        if (cell.age < 0) {
          line += " ";
        } else if (cell.age === 0) {
          // Head — brightest
          line += `<span style="color:${colors.white};text-shadow:0 0 8px ${colors.bright}">${cell.ch}</span>`;
        } else if (cell.age < 4) {
          line += `<span style="color:${colors.bright}">${cell.ch}</span>`;
        } else if (cell.age < 10) {
          line += `<span style="color:${colors.mid}">${cell.ch}</span>`;
        } else {
          line += `<span style="color:${colors.dim}">${cell.ch}</span>`;
        }
      }
      lines.push(line);
    }

    container.innerHTML = lines.join("\n");
  }

  // ── Public: start ──
  function start() {
    if (active) return;
    active = true;

    const terminal = document.getElementById("terminal");
    const output = document.getElementById("output");
    const inputLine = document.getElementById("input-line");
    const tabHints = document.getElementById("tab-hints");

    // Hide normal terminal content
    if (output) output.style.display = "none";
    if (inputLine) inputLine.style.display = "none";
    if (tabHints) tabHints.style.display = "none";

    // Create render container
    container = document.createElement("pre");
    container.id = "cmatrix-rain";
    terminal.appendChild(container);

    setup();

    // Initial fill
    render();
    requestAnimationFrame(() => container.classList.add("visible"));

    intervalId = setInterval(tick, TICK_MS);

    window._cmatrixResize = () => {
      if (!active) return;
      setup();
    };
    window.addEventListener("resize", window._cmatrixResize);
  }

  // ── Public: stop ──
  function stop() {
    if (!active) return;
    active = false;

    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }

    if (container) {
      container.classList.remove("visible");
      setTimeout(() => {
        if (container) {
          container.remove();
          container = null;
        }
      }, 300);
    }

    // Restore terminal content
    const output = document.getElementById("output");
    const inputLine = document.getElementById("input-line");
    const tabHints = document.getElementById("tab-hints");
    if (output) output.style.display = "";
    if (inputLine) inputLine.style.display = "";
    if (tabHints) tabHints.style.display = "";

    if (window._cmatrixResize) {
      window.removeEventListener("resize", window._cmatrixResize);
      delete window._cmatrixResize;
    }
  }

  // ── Dismiss on any key or click ──
  document.addEventListener(
    "keydown",
    (e) => {
      if (active) {
        e.preventDefault();
        e.stopPropagation();
        stop();
        const inp = document.getElementById("command-input");
        if (inp) inp.focus();
      }
    },
    true,
  );

  document.addEventListener("click", () => {
    if (active) {
      stop();
      const inp = document.getElementById("command-input");
      if (inp) inp.focus();
    }
  });

  // ── Idle screensaver timer ──
  function resetIdleTimer() {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      if (!active && document.getElementById("terminal-wrapper")) {
        start();
      }
    }, IDLE_TIMEOUT);
  }

  ["keydown", "mousemove", "mousedown", "touchstart", "scroll"].forEach(
    (evt) => {
      document.addEventListener(evt, resetIdleTimer, { passive: true });
    },
  );

  resetIdleTimer();

  window.cmatrix = { start, stop, isActive: () => active };
})();
