// ─────────────────────────────────────────────
// furrow — The Furrow ASCII art gallery
// Canvas-based renderer, theme-aware, ← → to browse
// ─────────────────────────────────────────────
(function () {
  "use strict";

  // ── Concept presets ──────────────────────────
  const CONCEPTS = [
    {
      name: "Center Spiral",
      pattern: "centerSpiral",
      charset: "░▒▓░▒▓░░▒▓░▒▓░░▒▓░▒▓░░▒▓░▒▓░░▒▓░▒▓░░▒▓░▒▓░░▒▓░▒▓░",
      colors: ["#43BFD4", "#BC7ED2", "#9EE1EF", "#C3ECF0", "#B9AAF3"],
      xConstant: 554.8,
      yConstant: 0.73,
      frameMultiplier: -0.001,
      animationSpeed: 0.02,
      mirrorAxis: "x",
      chaos: 0,
      globalVal: 5,
      colored: true,
    },
    {
      name: "Golden Spiral",
      pattern: "centerSpiral",
      charset: "░▒▓░▒▓฿",
      colors: ["#ff9500", "#fed50b", "#ffea00", "#0055ff", "#003d9e"],
      xConstant: -0.01,
      yConstant: 50,
      frameMultiplier: 0.1,
      animationSpeed: 0.1,
      mirrorAxis: "y",
      chaos: 0,
      globalVal: 5,
      colored: true,
    },
    {
      name: "Circular",
      pattern: "circular",
      charset: "░▒▓┃┏┓┛┗┙┘━",
      colors: ["#dad677", "#5778db", "#f039f3", "#9d27dd", "#f1f2ed"],
      xConstant: -0.001,
      yConstant: 9997777777776.8,
      frameMultiplier: 0.071,
      animationSpeed: 0.4,
      mirrorAxis: "none",
      chaos: 0,
      globalVal: 5,
      colored: true,
    },
    {
      name: "Mosaic",
      pattern: "mosaic",
      charset: "░│││___...●●",
      colors: ["#37FF6E", "#B24EFF", "#97D299", "#89DE93", "#7DE6E5"],
      xConstant: 99999.01,
      yConstant: 0.04,
      frameMultiplier: 0.01,
      animationSpeed: 0.4,
      mirrorAxis: "x",
      chaos: 0,
      globalVal: 1,
      colored: true,
    },
    {
      name: "Ember Spiral",
      pattern: "centerSpiral",
      charset: "╬╬╪╪╫╫",
      colors: ["#B87418", "#6456BC", "#A671BC", "#B75053", "#B83D2B"],
      xConstant: 0.21,
      yConstant: 0.5,
      frameMultiplier: 0.04,
      animationSpeed: 0.1,
      mirrorAxis: "none",
      chaos: 0,
      globalVal: 1.5,
      colored: true,
    },
    {
      name: "Green Mosaic",
      pattern: "mosaic",
      charset: "⏐⏐⠈⠈⠈⤠⏐⏐",
      colors: ["#26B479", "#49BF7D", "#9DDAC8", "#52FF6D", "#8F1AFF"],
      xConstant: 99998.97,
      yConstant: 0.0311111,
      frameMultiplier: 0.01,
      animationSpeed: 0.4,
      mirrorAxis: "y",
      chaos: 0,
      globalVal: 1,
      colored: true,
    },
    {
      name: "Fire Spiral",
      pattern: "centerSpiral",
      charset: "_░░████░▒▓░▒",
      colors: ["#FF7700", "#F88826", "#FF6900", "#9800FF", "#7600FF"],
      xConstant: 0.05,
      yConstant: 19.1,
      frameMultiplier: 0.019,
      animationSpeed: 0.4,
      mirrorAxis: "x",
      chaos: 0,
      globalVal: 3.8,
      colored: true,
    },
    {
      name: "Cross",
      pattern: "cross",
      charset: "\".-_,- '`-._,-'\".-_,-'",
      colors: null,
      xConstant: 0.0002,
      yConstant: 0.1,
      frameMultiplier: 0.1,
      animationSpeed: 0.15,
      mirrorAxis: "none",
      chaos: 0.001,
      globalVal: 0,
      colored: false,
    },
    {
      name: "Checkerboard",
      pattern: "checkerboard",
      charset: "⠈⠸⠈ ⠈⠤⠈ ⠈⠐⠈",
      colors: null,
      xConstant: 100000,
      yConstant: 1,
      frameMultiplier: 0.01,
      animationSpeed: 0.15,
      mirrorAxis: "none",
      chaos: 0.0001,
      globalVal: 0,
      colored: false,
    },
    {
      name: "Atomic",
      pattern: "atomic",
      charset: "·∙○◎●◉○∙·  ",
      colors: ["#00CFFF", "#0088DD", "#44EEFF", "#AAEEFF", "#006699"],
      xConstant: 3,
      yConstant: 2,
      frameMultiplier: 0.07,
      animationSpeed: 0.5,
      mirrorAxis: "none",
      chaos: 0,
      globalVal: 0.4,
      colored: true,
    },
    {
      name: "Mitosis",
      pattern: "mitosis",
      charset: "  ..··:∙∘○◎●",
      colors: ["#00FF88", "#22DDAA", "#44FFBB", "#88FFCC", "#00CC66"],
      xConstant: 0,
      yConstant: 0,
      frameMultiplier: 0.05,
      animationSpeed: 0.8,
      mirrorAxis: "none",
      chaos: 0,
      globalVal: 0,
      colored: true,
    },
    {
      name: "Pollock",
      pattern: "pollock",
      charset: ".,;:!|/\\~=#%@&*",
      colors: [
        "#FF2020", "#FF6600", "#FFCC00", "#FFFFFF",
        "#2288FF", "#00BBFF", "#22FF66", "#FF44AA",
        "#CC44FF", "#FF8800", "#44DDDD", "#FFEE55",
      ],
      xConstant: 7,
      yConstant: 5,
      frameMultiplier: 0.08,
      animationSpeed: 0.6,
      mirrorAxis: "none",
      chaos: 0,
      globalVal: 0,
      colored: true,
    },
  ];

  let active = false;
  let currentIdx = 0;
  let time = 0;
  let rafId = null;
  let canvas = null;
  let ctx = null;
  let columns = 0;
  let rows = 0;
  let charW = 0;
  let cellH = 0;
  const FONT_SIZE = 14;
  const LINE_HEIGHT = 1.15;
  const TICK_MS = 33; // ~30 fps
  const SPEED_SCALE = 0.03; // global slowdown multiplier
  let lastTick = 0;
  let cachedTheme = null;
  let _onStop = null;

  // ── Mitosis cell state (precomputed per frame) ──
  let _mitCells = []; // [[x, y, opacity], ...]

  function _frand(n) {
    const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return s - Math.floor(s);
  }

  function _updateMitCells(fw, fh) {
    var phase = time * 0.05;
    var maxGen = 5; // up to 32 cells
    var cycleLen = maxGen + 2; // pause at max before restart
    var cp = phase % cycleLen;
    var gen = Math.min(Math.floor(cp), maxGen);
    var t = cp - gen; // 0..1 within this generation

    // Fade-out at end of cycle
    if (cp > maxGen + 1) {
      _mitCells = [];
      return;
    }

    var cx = fw / 2;
    var cy = fh / 2;

    // Compute final position for cell index at a given generation
    function pos(idx, g) {
      var x = cx, y = cy;
      for (var lvl = 0; lvl < g; lvl++) {
        var bit = (idx >> (g - 1 - lvl)) & 1;
        var dir = bit * 2 - 1;
        var a = _frand(lvl * 137.3 + 7.1) * 6.2832;
        var r = 7 + lvl * 2.5 + _frand(lvl * 43.7 + 13.3) * 2;
        x += dir * Math.cos(a) * r;
        y += dir * Math.sin(a) * r * 0.55;
      }
      // Gentle drift
      x += Math.sin(time * 0.008 + idx * 1.7) * 0.8;
      y += Math.cos(time * 0.008 + idx * 2.3) * 0.4;
      return [x, y];
    }

    _mitCells = [];
    var count = 1 << gen;

    // Easing for split interpolation
    var ease = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) * (-2 * t + 2) / 2;

    for (var i = 0; i < count; i++) {
      var final = pos(i, gen);
      var opacity = 1;

      if (gen === 0 && cp < 1) {
        // First cell fading in
        opacity = Math.min(cp * 1.5, 1);
        _mitCells.push([cx, cy, opacity]);
      } else {
        // Interpolate from parent to final position
        var parent = gen > 0 ? pos(i >> 1, gen - 1) : [cx, cy];
        var x = parent[0] + (final[0] - parent[0]) * ease;
        var y = parent[1] + (final[1] - parent[1]) * ease;
        _mitCells.push([x, y, opacity]);
      }
    }
  }

  // ── Pattern math ─────────────────────────────
  function computeValue(pattern, mx, my, fw, fh, c) {
    switch (pattern) {
      case "centerSpiral": {
        const dx = mx - fw / 2;
        const dy = my - fh / 2;
        const theta = Math.atan2(dy, dx) + c.xConstant;
        const curvature = Math.sin(theta * c.yConstant);
        const wave = c.globalVal * Math.sin(mx * c.xConstant + time);
        const density = Math.sin(theta * c.frameMultiplier);
        const localSpeed = Math.sin(mx * c.xConstant + my * c.yConstant);
        const r =
          (theta + (time + localSpeed) * c.frameMultiplier + curvature + wave) *
          (1 + density);
        return Math.sin(r);
      }
      case "circular":
        return Math.sin(
          (mx - fw / 2) * (mx - fw / 2) * c.xConstant +
            (my - fh / 2) * (my - fh / 2) * c.yConstant +
            time * c.frameMultiplier,
        );
      case "mosaic":
        return (
          Math.sin(mx * c.xConstant + time) * Math.sin(my * c.yConstant + time)
        );
      case "cross":
        return (
          Math.sin(
            (mx - fw / 2) * (mx - fw / 2) * c.xConstant +
              time * c.frameMultiplier,
          ) +
          Math.cos(
            (my - fh / 2) * (my - fh / 2) * c.yConstant +
              time * c.frameMultiplier,
          )
        );
      case "checkerboard":
        return Math.sin(mx * c.xConstant) * Math.sin(my * c.yConstant + time);
      case "atomic": {
        const cx = fw / 2;
        const cy = fh / 2;
        const dx = mx - cx;
        const dy = (my - cy) * 1.8; // stretch to compensate for char aspect ratio
        const dist = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx);
        // Nucleus glow — dense at center
        const nucleus = Math.exp(-dist * dist * 0.02) * 2;
        // Electron shells — concentric rings that pulse
        const shell1 = Math.sin(dist * 0.5 - time * c.frameMultiplier * 3) *
                        Math.exp(-Math.abs(dist - 8) * 0.15);
        const shell2 = Math.sin(dist * 0.5 - time * c.frameMultiplier * 2 + 2) *
                        Math.exp(-Math.abs(dist - 16) * 0.12);
        const shell3 = Math.sin(dist * 0.5 - time * c.frameMultiplier * 1.5 + 4) *
                        Math.exp(-Math.abs(dist - 26) * 0.1);
        // Orbiting electrons — bright dots on each shell
        const e1 = Math.exp(-Math.pow(dist - 8, 2) * 0.3) *
                   Math.exp(-Math.pow(angle - time * c.frameMultiplier * 5, 2) * 2);
        const e2 = Math.exp(-Math.pow(dist - 16, 2) * 0.2) *
                   Math.exp(-Math.pow(angle + time * c.frameMultiplier * 3 + 1, 2) * 1.5);
        const e3 = Math.exp(-Math.pow(dist - 26, 2) * 0.15) *
                   Math.exp(-Math.pow(angle - time * c.frameMultiplier * 2 + 3, 2) * 1.2);
        // Cloud probability field
        const cloud = Math.sin(angle * c.xConstant + dist * 0.3 + time * c.frameMultiplier) *
                      c.globalVal * Math.exp(-dist * 0.03);
        return nucleus + shell1 + shell2 + shell3 + (e1 + e2 + e3) * 3 + cloud;
      }
      case "mitosis": {
        // Starfield background
        var hash = _frand(mx * 0.731 + my * 3.117 + 0.5);
        var star = hash > 0.992 ? 0.5 : 0;

        if (_mitCells.length === 0) return star - 2;

        // Metaball field — sum contributions from all cells
        var field = 0;
        for (var ci = 0; ci < _mitCells.length; ci++) {
          var cX = _mitCells[ci][0];
          var cY = _mitCells[ci][1];
          var cO = _mitCells[ci][2];
          var ddx = mx - cX;
          var ddy = (my - cY) * 1.8; // aspect ratio
          var d2 = ddx * ddx + ddy * ddy;
          field += cO * 18 / (1 + d2 * 0.12);
        }

        // Map to -2..+2 range for charset
        return Math.min(field, 4) - 2 + star;
      }
      case "pollock": {
        // Multiple chaotic "drip" layers at different scales and speeds
        var t1 = time * c.frameMultiplier;
        var t2 = t1 * 1.7;
        var t3 = t1 * 0.6;

        // Hash for spatial noise — gives gritty splatter texture
        var h = _frand(mx * 13.71 + my * 7.93 + Math.floor(t1 * 0.3) * 99.1);

        // Drip strands — vertical-ish chaotic curves
        var drip1 = Math.sin(mx * 0.4 + Math.sin(my * 0.15 + t1) * c.xConstant + t1) *
                    Math.cos(my * 0.08 + t2 * 0.5);
        var drip2 = Math.sin(mx * 0.25 - t2 + Math.sin(my * 0.3 + t1 * 1.3) * 3) *
                    Math.cos(my * 0.12 - mx * 0.06 + t1);
        var drip3 = Math.cos(mx * 0.6 + my * 0.1 + t3) *
                    Math.sin(my * 0.2 + Math.cos(mx * 0.08 + t2) * c.yConstant);

        // Splatter blobs — sudden bursts
        var blob1 = Math.sin(mx * 0.9 + t1 * 3) * Math.sin(my * 0.7 - t2 * 2);
        var blob2 = Math.cos(mx * 0.5 - my * 0.8 + t3 * 4) *
                    Math.sin(mx * 0.3 + my * 0.4 + t1 * 2);

        // Sweeping arcs — broad gestural strokes
        var arc = Math.sin((mx + my) * 0.12 + t1 * 0.7) *
                  Math.cos((mx - my * 1.5) * 0.08 + t2 * 0.4);

        // Combine layers — the chaos
        var val = drip1 * 0.8 + drip2 * 0.7 + drip3 * 0.6 +
                  blob1 * 0.5 + blob2 * 0.4 + arc * 0.6;

        // Threshold splatter — sharp paint-or-no-paint edges
        var splat = h > 0.6 ? (h - 0.6) * 2.5 : 0;
        val += splat * Math.sin(mx * 1.3 + my * 0.9 + t1 * 5) * 0.8;

        return val;
      }
      default:
        return 0;
    }
  }

  // ── Theme colors ─────────────────────────────
  function refreshThemeCache() {
    const s = getComputedStyle(document.documentElement);
    cachedTheme = {
      cyan: s.getPropertyValue("--cyan").trim() || "#00ffd5",
      dim: s.getPropertyValue("--cyan-dim").trim() || "#00b396",
      bg: s.getPropertyValue("--bg-term").trim() || "#060d0b",
      white: s.getPropertyValue("--white").trim() || "#d4dbd8",
      grey: s.getPropertyValue("--grey").trim() || "#3d4f4a",
    };
  }

  // ── Setup canvas ─────────────────────────────
  function setup() {
    const dpr = window.devicePixelRatio || 1;
    // Read display size from the laid-out canvas (CSS: position absolute, inset 0)
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;

    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);

    const fontFamily =
      getComputedStyle(document.documentElement)
        .getPropertyValue("--font-mono")
        .trim() || "monospace";
    ctx.font = FONT_SIZE + "px " + fontFamily;
    ctx.textBaseline = "top";

    // Measure real character width instead of guessing
    charW = ctx.measureText("M").width;
    cellH = Math.round(FONT_SIZE * LINE_HEIGHT);
    // +2 to ensure characters cover every pixel at the edges
    columns = Math.ceil(w / charW) + 2;
    rows = Math.ceil(h / cellH) + 2;
  }

  // ── Render one frame ─────────────────────────
  function render() {
    const c = CONCEPTS[currentIdx];
    const theme = cachedTheme;
    const fw = columns;
    const fh = rows;

    // Precompute mitosis cell positions once per frame
    if (c.pattern === "mitosis") _updateMitCells(fw, fh);

    const charset = c.charset;
    const csLen = charset.length;
    const colors = c.colors;
    const colLen = colors ? colors.length : 0;
    const colored = c.colored;
    const mirrorX = c.mirrorAxis === "x";
    const mirrorY = c.mirrorAxis === "y";
    const halfW = fw >> 1;
    const halfH = fh >> 1;
    const pattern = c.pattern;
    const cw = charW;
    const ch = cellH;

    ctx.fillStyle = theme.bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    let prevFill = theme.bg;

    for (let y = 0; y < fh; y++) {
      const py = y * ch;
      for (let x = 0; x < fw; x++) {
        const mx = mirrorX && x > halfW ? fw - x : x;
        const my = mirrorY && y > halfH ? fh - y : y;

        const value = computeValue(pattern, mx, my, fw, fh, c);

        const idx = ((value + 2) * csLen * 0.25) | 0;
        const glyph = charset[idx < 0 ? 0 : idx >= csLen ? csLen - 1 : idx];

        let fill;
        if (colored) {
          fill = colors[((idx % colLen) + colLen) % colLen];
        } else {
          const brightness = (value + 2) * 0.25;
          fill =
            brightness > 0.65
              ? theme.cyan
              : brightness > 0.4
                ? theme.dim
                : theme.grey;
        }

        if (fill !== prevFill) {
          ctx.fillStyle = fill;
          prevFill = fill;
        }

        ctx.fillText(glyph, x * cw, py);
      }
    }
  }

  // ── Status bar update ────────────────────────
  let _sbMode = null;
  let _sbStatus = null;
  function updateStatusBar() {
    const c = CONCEPTS[currentIdx];
    if (!_sbMode) _sbMode = document.getElementById("sb-mode");
    if (!_sbStatus) _sbStatus = document.getElementById("sb-status");
    if (_sbMode)
      _sbMode.textContent =
        c.name + " [" + (currentIdx + 1) + "/" + CONCEPTS.length + "]";
    if (_sbStatus) _sbStatus.textContent = "← → browse · ESC exit";
  }

  // ── Animation loop ───────────────────────────
  function animLoop(ts) {
    if (!active) return;
    if (ts - lastTick >= TICK_MS) {
      time += CONCEPTS[currentIdx].animationSpeed * SPEED_SCALE;
      render();
      lastTick = ts;
    }
    rafId = requestAnimationFrame(animLoop);
  }

  // ── Public: start ────────────────────────────
  function start(idx) {
    if (active) return;
    active = true;
    time = 0;
    if (typeof idx === "number" && idx >= 0 && idx < CONCEPTS.length) {
      currentIdx = idx;
    }

    const terminal = document.getElementById("terminal");
    const outputEl = document.getElementById("output");
    const inputLine = document.getElementById("input-line");
    const tabHints = document.getElementById("tab-hints");

    if (outputEl) outputEl.style.display = "none";
    if (inputLine) inputLine.style.display = "none";
    if (tabHints) tabHints.style.display = "none";

    // Hide scrollbar and padding while fullscreen
    terminal.classList.add("furrow-active");

    // Canvas
    canvas = document.createElement("canvas");
    canvas.id = "furrow-canvas";
    terminal.appendChild(canvas);

    setup();
    refreshThemeCache();
    render();
    updateStatusBar();

    lastTick = performance.now();
    rafId = requestAnimationFrame(animLoop);

    window._furrowResize = () => {
      if (!active) return;
      setup();
      refreshThemeCache();
    };
    window.addEventListener("resize", window._furrowResize);
  }

  // ── Public: stop ─────────────────────────────
  function stop() {
    if (!active) return;
    active = false;

    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }

    if (canvas) {
      canvas.remove();
      canvas = null;
      ctx = null;
    }

    const terminal = document.getElementById("terminal");
    if (terminal) terminal.classList.remove("furrow-active");

    const outputEl = document.getElementById("output");
    const inputLine = document.getElementById("input-line");
    const tabHints = document.getElementById("tab-hints");
    if (outputEl) outputEl.style.display = "";
    if (inputLine) {
      inputLine.classList.remove("furrow-typing");
      inputLine.style.display = "";
    }
    if (tabHints) tabHints.style.display = "";
    _typing = false;

    if (window._furrowResize) {
      window.removeEventListener("resize", window._furrowResize);
      delete window._furrowResize;
    }

    const sbMode = document.getElementById("sb-mode");
    const sbStatus = document.getElementById("sb-status");
    if (sbMode) sbMode.textContent = "TERMINAL";
    if (sbStatus) sbStatus.textContent = "ready";

    const inp = document.getElementById("command-input");
    if (inp) inp.focus();

    if (_onStop) {
      _onStop();
      _onStop = null;
    }
  }

  let _typing = false; // true when input line is overlaid on the animation

  function _showInputLine() {
    if (_typing) return;
    _typing = true;
    const inputLine = document.getElementById("input-line");
    if (inputLine) {
      inputLine.style.display = "";
      inputLine.classList.add("furrow-typing");
    }
    const inp = document.getElementById("command-input");
    if (inp) inp.focus();
  }

  function _hideInputLine() {
    if (!_typing) return;
    _typing = false;
    const inputLine = document.getElementById("input-line");
    if (inputLine) {
      inputLine.classList.remove("furrow-typing");
      inputLine.style.display = "none";
    }
    const inp = document.getElementById("command-input");
    if (inp) inp.value = "";
  }

  // ── Keyboard handling ────────────────────────
  document.addEventListener(
    "keydown",
    (e) => {
      if (!active) return;

      // Arrow keys — browse concepts (only when not typing)
      if (!_typing && e.key === "ArrowLeft") {
        e.preventDefault();
        e.stopPropagation();
        currentIdx = (currentIdx - 1 + CONCEPTS.length) % CONCEPTS.length;
        time = 0;
        updateStatusBar();
        return;
      }
      if (!_typing && e.key === "ArrowRight") {
        e.preventDefault();
        e.stopPropagation();
        currentIdx = (currentIdx + 1) % CONCEPTS.length;
        time = 0;
        updateStatusBar();
        return;
      }

      // Escape — if typing, dismiss input; otherwise exit furrow
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        if (_typing) {
          _hideInputLine();
        } else {
          stop();
        }
        return;
      }

      // Enter while typing — stop furrow and let terminal.js execute the command
      if (_typing && e.key === "Enter") {
        const inp = document.getElementById("command-input");
        const cmd = inp ? inp.value.trim() : "";
        _typing = false;
        const inputLine = document.getElementById("input-line");
        if (inputLine) inputLine.classList.remove("furrow-typing");
        stop();
        // Put the command back and let terminal handle it
        if (inp && cmd) {
          inp.value = cmd;
          inp.focus();
        }
        // Don't prevent/stop — let the event bubble to terminal's Enter handler
        return;
      }

      // Printable character — show input overlay and let keystroke through
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (!_typing) {
          _showInputLine();
        }
        // Don't prevent/stop — let the character reach the input field
        return;
      }

      // Backspace while typing — if input empty, dismiss overlay
      if (_typing && e.key === "Backspace") {
        const inp = document.getElementById("command-input");
        if (inp && inp.value === "") {
          e.preventDefault();
          e.stopPropagation();
          _hideInputLine();
        }
        // Otherwise let backspace reach the input normally
        return;
      }
    },
    true,
  );

  document.addEventListener("click", () => {
    // Don't dismiss on click — user might tap to focus; use ESC/q only
  });

  // ── Expose globally ──────────────────────────
  window.furrow = {
    start,
    stop,
    onStop(fn) {
      _onStop = fn;
    },
    getNames() {
      return CONCEPTS.map((c) => c.name);
    },
    isActive() {
      return active;
    },
  };
})();
