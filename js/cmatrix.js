// ─────────────────────────────────────────────
// cmatrix — Matrix digital rain (theme-aware)
// Canvas-based renderer for high performance
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
  let charW = 0;
  let drops = []; // per-column state
  let rafId = null;
  let container = null; // the <canvas> we render into
  let ctx = null;
  let idleTimer = null;
  let active = false;
  let lastTick = 0;
  let cachedColors = null;

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
    const dpr = window.devicePixelRatio || 1;
    // Use clientWidth/clientHeight to exclude padding and scrollbar
    const w = terminal.clientWidth;
    const h = terminal.clientHeight;
    charW = FONT_SIZE * 0.6; // monospace approx
    columns = Math.floor(w / charW);
    rows = Math.floor(h / CELL_H);

    // Size canvas to match terminal, accounting for device pixel ratio
    container.width = w * dpr;
    container.height = h * dpr;
    container.style.width = w + "px";
    container.style.height = h + "px";
    ctx = container.getContext("2d");
    ctx.scale(dpr, dpr);
    ctx.font =
      FONT_SIZE +
      "px " +
      getComputedStyle(document.documentElement)
        .getPropertyValue("--font-mono")
        .trim();
    ctx.textBaseline = "top";

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

    cachedColors = getColors();
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
  }

  function render() {
    const colors = cachedColors;

    // Clear canvas
    ctx.fillStyle = colors.bg;
    ctx.fillRect(0, 0, container.width, container.height);

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < columns; c++) {
        const cell = grid[r][c];
        if (cell.age < 0) continue; // skip empty cells

        const x = c * charW;
        const y = r * CELL_H;

        if (cell.age === 0) {
          // Head — brightest with glow
          ctx.shadowColor = colors.bright;
          ctx.shadowBlur = 8;
          ctx.fillStyle = colors.white;
        } else if (cell.age < 4) {
          ctx.shadowBlur = 0;
          ctx.fillStyle = colors.bright;
        } else if (cell.age < 10) {
          ctx.shadowBlur = 0;
          ctx.fillStyle = colors.mid;
        } else {
          ctx.shadowBlur = 0;
          ctx.fillStyle = colors.dim;
        }

        ctx.fillText(cell.ch, x, y);
      }
    }
    // Reset shadow after drawing
    ctx.shadowBlur = 0;
  }

  // ── Animation loop using rAF ──
  function animLoop(timestamp) {
    if (!active) return;
    if (timestamp - lastTick >= TICK_MS) {
      tick();
      render();
      lastTick = timestamp;
    }
    rafId = requestAnimationFrame(animLoop);
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

    // Create canvas render container
    container = document.createElement("canvas");
    container.id = "cmatrix-rain";
    terminal.appendChild(container);

    setup();

    // Initial fill
    render();
    requestAnimationFrame(() => container.classList.add("visible"));

    lastTick = performance.now();
    rafId = requestAnimationFrame(animLoop);

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

    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }

    if (container) {
      container.classList.remove("visible");
      setTimeout(() => {
        if (container) {
          container.remove();
          container = null;
          ctx = null;
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
