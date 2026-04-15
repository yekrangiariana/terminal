// ════════════════════════════════════════════════════════════════
// widgets.js — System Monitor Dashboard (htop / sysmon)
// Full-page widget grid with ASCII art, variable sizing,
// and live-updating system diagnostics.
//
// ALL single-width widgets = exactly 12 lines (H12)
// ALL double-width widgets = exactly 12 lines (H12)
// FULL-width banner        = exactly 8 lines
// FULL-width footer        = exactly 4 lines
// Grid: every row fills all 3 columns.
// ════════════════════════════════════════════════════════════════

// ── Widget state ──────────────────────────────────────────────
let _wActive = false;
let _wFpsHistory = [];
let _wLastFrameTime = 0;
let _wFpsRafId = null;
let _wCurrentFps = 0;
let _wFrameDelta = 0;
let _wMemPeak = 0;
let _wMemHistory = [];
let _wIdleSeconds = 0;
let _wLastActivity = Date.now();
let _wKeyActive = false;
let _wBatteryData = null;
let _wGridEl = null;
let _wTickCount = 0;
let _wOrbitStep = 0;
let _wPageEl = null;
let _wBannerPid = 0;

// ── FPS tracking via requestAnimationFrame ───────────────────
function _wFpsLoop(now) {
  if (!_wActive) return;
  if (_wLastFrameTime) {
    const delta = now - _wLastFrameTime;
    _wFrameDelta = delta;
    const fps = Math.min(144, Math.round(1000 / delta));
    _wFpsHistory.push(fps);
    if (_wFpsHistory.length > 60) _wFpsHistory.shift();
    _wCurrentFps = fps;
  }
  _wLastFrameTime = now;
  _wFpsRafId = requestAnimationFrame(_wFpsLoop);
}

// ── Activity tracking ────────────────────────────────────────
function _wOnActivity(e) {
  _wLastActivity = Date.now();
  _wKeyActive = true;
  if (e && e.type === "click")
    window._wClickCount = (window._wClickCount || 0) + 1;
  clearTimeout(window._wKeyTimeout);
  window._wKeyTimeout = setTimeout(() => {
    _wKeyActive = false;
  }, 2000);
}

// ── Battery (optional) ──────────────────────────────────────
async function _wFetchBattery() {
  try {
    if (navigator.getBattery) {
      const b = await navigator.getBattery();
      _wBatteryData = {
        level: Math.round(b.level * 100),
        charging: b.charging,
      };
      b.addEventListener("levelchange", () => {
        _wBatteryData.level = Math.round(b.level * 100);
      });
      b.addEventListener("chargingchange", () => {
        _wBatteryData.charging = b.charging;
      });
    }
  } catch (_) {}
}

// ══════════════════════════════════════════════════════════════
// Box helpers — 3 widths: S (single), D (double), F (full/triple)
// Character widths chosen so 3 singles = 1 full, 1 double + 1 single = 1 full
// ══════════════════════════════════════════════════════════════
const _WS = 26; // single-col widget
const _WD = 54; // double-col widget (2 × 26 + 2 gap chars)
const _WF = 82; // full-width (3 × 26 + 4 gap chars)

const _wesc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
const _wfr = (s) => `<span class="sb-frame">${s}</span>`;
const _wstrip = (s) => s.replace(/<[^>]*>/g, "");

function _wmkSep(w) {
  return _wfr("│") + " ".repeat(w - 2) + _wfr("│");
}
function _wmkPad(w, inner) {
  const vis = _wstrip(inner).length;
  const gap = Math.max(0, w - 4 - vis);
  return _wfr("│") + " " + inner + " ".repeat(gap) + " " + _wfr("│");
}
function _wmkTop(w) {
  return _wfr("┌" + "─".repeat(w - 2) + "┐");
}
function _wmkBot(w) {
  return _wfr("└" + "─".repeat(w - 2) + "┘");
}

// Single-col shortcuts (S = 26)
const _wsep = () => _wmkSep(_WS);
const _wpad = (inner) => _wmkPad(_WS, inner);
const _wtop = () => _wmkTop(_WS);
const _wbot = () => _wmkBot(_WS);

// Double-col shortcuts (D = 54)
const _wdsep = () => _wmkSep(_WD);
const _wdpad = (inner) => _wmkPad(_WD, inner);
const _wdtop = () => _wmkTop(_WD);
const _wdbot = () => _wmkBot(_WD);

// Full-width shortcuts (F = 82)
const _wfsep = () => _wmkSep(_WF);
const _wfpad = (inner) => _wmkPad(_WF, inner);
const _wftop = () => _wmkTop(_WF);
const _wfbot = () => _wmkBot(_WF);

// Labelled row — always 8ch label pad for singles
function _wrow(label, valueHtml) {
  const padLabel = _wesc(label).padEnd(8);
  return _wpad(`<span class="sb-dim">${padLabel} : </span>${valueHtml}`);
}

// Shorthand value wrappers
const _wval = (t) => `<span class="sb-val">${t}</span>`;
const _wcol = (color, t) => `<span style="color:${color}">${t}</span>`;

// Sparkline
function _wsparkline(values, maxVal, len) {
  len = len || 8;
  const sparkChars = "▁▂▃▄▅▆▇█";
  if (!values.length) return `<span class="sb-dim">${"─".repeat(len)}</span>`;
  const max = maxVal || Math.max(...values, 1);
  const recent = values.slice(-len);
  let html = "";
  for (const v of recent) {
    const idx = Math.round((v / max) * (sparkChars.length - 1));
    const ch = sparkChars[Math.max(0, Math.min(sparkChars.length - 1, idx))];
    const col =
      idx >= 6 ? "var(--cyan)" : idx >= 3 ? "var(--yellow)" : "var(--red)";
    html += `<span style="color:${col}">${ch}</span>`;
  }
  const diff = len - recent.length;
  if (diff > 0) html += `<span class="sb-dim">${"─".repeat(diff)}</span>`;
  return html;
}

// Bar
function _wbar(pct, len) {
  len = len || 8;
  const fill = Math.round((pct / 100) * len);
  return `<span class="sb-bar">${"█".repeat(fill)}</span><span class="sb-dim">${"░".repeat(len - fill)}</span>`;
}

// ══════════════════════════════════════════════════════════════
// FULL-WIDTH: ASCII HEADER BANNER  (8 lines)
// ══════════════════════════════════════════════════════════════
function _wBanner() {
  const uptimeSec = Math.floor((Date.now() - startTime) / 1000);
  const uptimeH = Math.floor(uptimeSec / 3600);
  const uptimeM = Math.floor((uptimeSec % 3600) / 60);
  const uptimeS = uptimeSec % 60;
  const uptimeStr =
    uptimeH > 0
      ? `${uptimeH}h ${uptimeM}m ${uptimeS}s`
      : uptimeM > 0
        ? `${uptimeM}m ${uptimeS}s`
        : `${uptimeS}s`;

  const L = [];
  L.push(_wftop()); // 1
  L.push(_wfsep()); // 2
  L.push(
    _wfpad(
      _wcol("var(--purple)", "UP") +
        ` ${_wval(uptimeStr)}  ` +
        _wcol("var(--amber)", "PID") +
        ` ${_wval(_wBannerPid)}`,
    ),
  ); // 3
  L.push(_wfsep()); // 4
  L.push(_wfbot()); // 5
  return { html: L.join("\n"), size: "full" };
}

// ══════════════════════════════════════════════════════════════
// FULL-WIDTH: FOOTER STATUS BAR  (4 lines)
// ══════════════════════════════════════════════════════════════
function _wFooter() {
  const nodes = document.querySelectorAll("*").length;
  const scripts = document.querySelectorAll("script").length;
  const stylesheets =
    document.querySelectorAll("link[rel=stylesheet]").length +
    document.querySelectorAll("style").length;
  const fps = _wCurrentFps || 0;
  const ticks = _wTickCount;

  const L = [];
  L.push(_wftop()); // 1
  L.push(
    _wfpad(
      // 2
      _wcol("var(--cyan)", "NODES") +
        ` ${_wval(nodes)}  ` +
        _wcol("var(--blue)", "SCRIPTS") +
        ` ${_wval(scripts)}  ` +
        _wcol("var(--purple)", "CSS") +
        ` ${_wval(stylesheets)}  ` +
        _wcol("var(--amber)", "FPS") +
        ` ${_wval(fps)}  ` +
        _wcol("var(--pink)", "TICKS") +
        ` ${_wval(ticks)}`,
    ),
  );
  L.push(_wfsep()); // 3
  L.push(_wfbot()); // 4
  return { html: L.join("\n"), size: "full" };
}

// ══════════════════════════════════════════════════════════════
// DOUBLE-WIDTH: TEMP + ARCHIVE  (12 lines)
// ══════════════════════════════════════════════════════════════
function _wTempArchive() {
  const CL = 25; // left column visible width before │
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const dayOfYear = Math.floor((now - startOfYear) / 864e5) + 1;
  const totalDays = now.getFullYear() % 4 === 0 ? 366 : 365;
  const currentMonth = now.getMonth();
  const monthLabels = "JFMAMJJASOND";

  const cd = window._climateData;
  const monthTemps = cd
    ? cd.monthTemps
    : [-5, -6, -2, 4, 10, 15, 18, 16, 11, 5, 0, -3];
  const tMin = cd ? cd.tMin : -6;
  const tMax = cd ? cd.tMax : 18;
  const avg = cd
    ? cd.avg
    : Math.round(monthTemps.reduce((a, b) => a + b, 0) / 12);
  const city = cd
    ? cd.city
    : window._weatherData
      ? window._weatherData.city
      : "Helsinki";

  const tempPhase = ((dayOfYear - 105) / totalDays) * 2 * Math.PI;
  const estimatedTemp = Math.round(5.5 + 12 * Math.sin(tempPhase));
  const temp = window._weatherData?.temp ?? estimatedTemp;
  const tempPrefix = window._weatherData ? "" : "~";

  const sparkChars = " ▁▂▃▄▅▆▇█";
  let sparkline = "";
  for (let m = 0; m < 12; m++) {
    const t = monthTemps[m];
    const idx = Math.round(
      ((t - tMin) / Math.max(tMax - tMin, 1)) * (sparkChars.length - 1),
    );
    const ch = sparkChars[Math.max(0, Math.min(sparkChars.length - 1, idx))];
    const col =
      t > 15
        ? "var(--amber)"
        : t > 5
          ? "var(--yellow)"
          : t > -5
            ? "var(--cyan-dim)"
            : "var(--blue)";
    const bold = m === currentMonth ? "font-weight:bold" : "";
    sparkline += `<span style="color:${col};${bold}">${ch}</span>`;
  }

  const archiveItems = typeof ALL !== "undefined" ? ALL : [];
  const cats = {};
  for (const item of archiveItems) {
    cats[item.category] = (cats[item.category] || 0) + 1;
  }
  const catEntries = Object.entries(cats).sort((a, b) => b[1] - a[1]);
  const maxCat = catEntries.length ? catEntries[0][1] : 1;
  const CAT_COL = {
    writing: "var(--cyan)",
    journalism: "var(--blue)",
    project: "var(--purple)",
  };

  const tempCol =
    temp > 15
      ? "var(--amber)"
      : temp > 5
        ? "var(--yellow)"
        : temp > -5
          ? "var(--blue)"
          : "var(--purple)";

  // Left column: 6 content rows (each ≤ CL visible chars)
  const tempLines = [
    `  ${_wcol(tempCol, tempPrefix + temp + "°C")} <span class="sb-dim">now</span>`,
    ``,
    `  <span class="sb-dim">${monthLabels}</span>`,
    `  ${sparkline}`,
    `  <span class="sb-dim">avg</span> ${_wval(avg + "°")} <span class="sb-dim">${tMin}°→${tMax}°</span>`,
    ``,
  ];

  // Right column: category bars (pad to 6)
  const archiveLines = [];
  for (const [cat, count] of catEntries.slice(0, 5)) {
    const barLen = Math.round((count / maxCat) * 6);
    const catCol = CAT_COL[cat] || "var(--cyan)";
    archiveLines.push(
      ` ${_wcol(catCol, _wesc(cat).padEnd(10))}` +
        `<span style="color:${catCol}">${"█".repeat(barLen)}</span><span class="sb-dim">${"░".repeat(6 - barLen)}</span>` +
        ` ${_wval(String(count).padStart(2))}`,
    );
  }
  while (archiveLines.length < 6) archiveLines.push("");

  // Helper: pad left to CL, then │ + space + right
  function _tmpRow(left, right) {
    const lVis = _wstrip(left).length;
    const pad = Math.max(0, CL - lVis);
    return _wdpad(
      left + " ".repeat(pad) + _wcol("var(--grey)", "│") + " " + right,
    );
  }

  // Label row: pad left label to CL before │
  const cityTrunc = city.length > 13 ? city.slice(0, 12) + "…" : city;
  const lblLeft = `<span class="sb-label">TEMP</span> <span class="sb-dim">${_wesc(cityTrunc)}</span>`;
  const lblLeftVis = _wstrip(lblLeft).length;
  const lblRight = `<span class="sb-label">ARCHIVE</span> ${_wval(archiveItems.length)}`;

  const L = [];
  L.push(_wdtop()); // 1
  L.push(_wdsep()); // 2
  L.push(
    _wdpad(
      lblLeft +
        " ".repeat(Math.max(0, CL - lblLeftVis)) +
        _wcol("var(--grey)", "│") +
        " " +
        lblRight,
    ),
  ); // 3
  L.push(
    _wdpad(
      `<span class="sb-dim">${"─".repeat(CL)}</span>${_wcol("var(--grey)", "│")}<span class="sb-dim">${"─".repeat(50 - CL - 1)}</span>`,
    ),
  ); // 4

  for (let i = 0; i < 6; i++) {
    // 5-10
    L.push(_tmpRow(tempLines[i] || "", archiveLines[i] || ""));
  }

  L.push(_wdsep()); // 11
  L.push(_wdbot()); // 12
  return { html: L.join("\n"), size: "double" };
}

// ══════════════════════════════════════════════════════════════
// S I N G L E - W I D T H   W I D G E T S   (all exactly 12 lines)
//
// Pattern:  ┌──┐ sep ▸LABEL sep  6×row  sep └──┘  = 12
//  or:      ┌──┐ sep ▸LABEL sep  7×row      └──┘  = 12
// ══════════════════════════════════════════════════════════════

function _wSystemCore() {
  const mem = navigator.deviceMemory ? navigator.deviceMemory + " GB" : "—";
  const online = navigator.onLine;
  const lang = navigator.language || "en";
  const dpr = (window.devicePixelRatio || 1).toFixed(1);
  const proto = location.protocol === "https:" ? "TLS" : "HTTP";
  const cookies = navigator.cookieEnabled ? "ON" : "OFF";

  return {
    html: [
      _wtop(), // 1
      _wsep(), // 2
      _wpad(`<span class="sb-label">SYSTEM CORE</span>`), // 3
      _wsep(), // 4
      _wrow("MEMORY", _wval(_wesc(mem))), // 5
      _wrow("DPR", _wval(dpr)), // 6
      _wrow("LOCALE", _wval(_wesc(lang))), // 7
      _wrow("PROTO", _wval(proto)), // 8
      _wrow("COOKIES", _wval(cookies)), // 9
      _wrow(
        "STATUS",
        online
          ? _wcol("var(--cyan)", "ONLINE")
          : _wcol("var(--red)", "OFFLINE"),
      ), // 10
      _wsep(), // 11
      _wbot(), // 12
    ].join("\n"),
    size: "single",
  };
}

function _wRenderEngine() {
  const fps = _wCurrentFps;
  const delta = _wFrameDelta ? _wFrameDelta.toFixed(1) + "ms" : "—";
  const load =
    fps >= 55 ? "LOW" : fps >= 30 ? "MED" : fps > 0 ? "HIGH" : "IDLE";
  const loadCol =
    fps >= 55
      ? "var(--cyan)"
      : fps >= 30
        ? "var(--yellow)"
        : fps > 0
          ? "var(--red)"
          : "var(--grey)";
  const fpsCol =
    fps >= 55 ? "var(--cyan)" : fps >= 30 ? "var(--yellow)" : "var(--red)";
  const spark = _wsparkline(_wFpsHistory, 70);
  const avg = _wFpsHistory.length
    ? Math.round(_wFpsHistory.reduce((a, b) => a + b, 0) / _wFpsHistory.length)
    : 0;
  const minFps = _wFpsHistory.length ? Math.min(..._wFpsHistory) : 0;

  return {
    html: [
      _wtop(), // 1
      _wsep(), // 2
      _wpad(`<span class="sb-label">RENDER ENGINE</span>`), // 3
      _wsep(), // 4
      _wrow("FPS", _wcol(fpsCol, fps)), // 5
      _wrow("AVG", _wval(avg)), // 6
      _wrow("MIN", _wcol(minFps < 30 ? "var(--red)" : "var(--cyan)", minFps)), // 7
      _wrow("LOAD", _wcol(loadCol, load)), // 8
      _wrow("FRAME Δ", _wval(_wesc(delta))), // 9
      _wrow("GRAPH", spark), // 10
      _wsep(), // 11
      _wbot(), // 12
    ].join("\n"),
    size: "single",
  };
}

function _wMemory() {
  let used = "—",
    total = "—",
    trend = "—",
    trendCol = "var(--grey)",
    pct = 0;

  if (performance.memory) {
    const usedMB = Math.round(performance.memory.usedJSHeapSize / 1048576);
    const totalMB = Math.round(performance.memory.totalJSHeapSize / 1048576);
    used = usedMB + " MB";
    total = totalMB + " MB";
    _wMemHistory.push(usedMB);
    if (_wMemHistory.length > 20) _wMemHistory.shift();
    if (usedMB > _wMemPeak) {
      trend = "↑";
      trendCol = "var(--amber)";
      _wMemPeak = usedMB;
    } else if (usedMB < _wMemPeak - 5) {
      trend = "↓";
      trendCol = "var(--cyan)";
    } else {
      trend = "→";
      trendCol = "var(--grey)";
    }
    pct = Math.min(100, Math.round((usedMB / Math.max(totalMB, 1)) * 100));
  } else {
    const nodes = document.querySelectorAll("*").length;
    const estMB = Math.round(8 + nodes * 0.005 + Math.random() * 2);
    used = "~" + estMB + " MB";
    total = "est.";
    _wMemHistory.push(estMB);
    if (_wMemHistory.length > 20) _wMemHistory.shift();
    if (estMB > _wMemPeak) {
      trend = "↑";
      trendCol = "var(--amber)";
      _wMemPeak = estMB;
    } else {
      trend = "→";
      trendCol = "var(--grey)";
    }
    pct = Math.min(100, Math.round((estMB / 80) * 100));
  }
  const spark = _wsparkline(_wMemHistory, 0, 8);

  return {
    html: [
      _wtop(), // 1
      _wsep(), // 2
      _wpad(`<span class="sb-label">MEMORY</span>`), // 3
      _wsep(), // 4
      _wrow("USED", _wcol("var(--amber)", _wesc(used))), // 5
      _wrow("TOTAL", _wval(_wesc(total))), // 6
      _wrow("PEAK", _wval(_wMemPeak + " MB")), // 7
      _wrow("TREND", _wcol(trendCol, trend)), // 8
      _wrow("GRAPH", spark), // 9
      _wrow("BUFFER", _wbar(pct)), // 10
      _wsep(), // 11
      _wbot(), // 12
    ].join("\n"),
    size: "single",
  };
}

function _wNetwork() {
  const conn = navigator.connection || navigator.mozConnection || null;
  let type, downlink, latency, status, statusCol, saveData;
  if (conn) {
    type = (conn.effectiveType || "?").toUpperCase();
    downlink = conn.downlink ? conn.downlink + " Mbps" : "—";
    latency = conn.rtt != null ? conn.rtt + " ms" : "—";
    saveData = conn.saveData ? "ON" : "OFF";
    if (conn.rtt != null) {
      if (conn.rtt > 200) {
        status = "SLOW";
        statusCol = "var(--red)";
      } else if (conn.rtt > 100) {
        status = "FAIR";
        statusCol = "var(--yellow)";
      } else {
        status = "STABLE";
        statusCol = "var(--cyan)";
      }
    } else {
      status = "OK";
      statusCol = "var(--cyan)";
    }
  } else {
    type = navigator.onLine ? "WIRED" : "NONE";
    downlink = "—";
    latency = "—";
    saveData = "—";
    status = navigator.onLine ? "ONLINE" : "OFFLINE";
    statusCol = navigator.onLine ? "var(--cyan)" : "var(--red)";
  }
  if (!navigator.onLine) {
    status = "OFFLINE";
    statusCol = "var(--red)";
  }

  const proto = location.protocol === "https:" ? "TLS" : "HTTP";

  return {
    html: [
      _wtop(), // 1
      _wsep(), // 2
      _wpad(`<span class="sb-label">NETWORK LINK</span>`), // 3
      _wsep(), // 4
      _wrow("TYPE", _wcol("var(--blue)", _wesc(type))), // 5
      _wrow("DOWNLINK", _wval(_wesc(downlink))), // 6
      _wrow("LATENCY", _wval(_wesc(latency))), // 7
      _wrow("SAVER", _wval(saveData)), // 8
      _wrow("PROTO", _wval(proto)), // 9
      _wrow("STATUS", _wcol(statusCol, _wesc(status))), // 10
      _wsep(), // 11
      _wbot(), // 12
    ].join("\n"),
    size: "single",
  };
}

function _wDisplay() {
  const res = screen.width + "×" + screen.height;
  const vp = window.innerWidth + "×" + window.innerHeight;
  const depth = screen.colorDepth + "bit";
  const orient = screen.orientation
    ? screen.orientation.type.split("-")[0].toUpperCase()
    : "—";
  const pixelRatio = screen.width * screen.height;
  const mpx = (pixelRatio / 1e6).toFixed(1) + " MP";

  return {
    html: [
      _wtop(), // 1
      _wsep(), // 2
      _wpad(`<span class="sb-label">DISPLAY UNIT</span>`), // 3
      _wsep(), // 4
      _wrow("RES", _wcol("var(--pink)", _wesc(res))), // 5
      _wrow("VIEWPORT", _wval(_wesc(vp))), // 6
      _wrow("DEPTH", _wcol("var(--blue)", _wesc(depth))), // 7
      _wrow("ORIENT", _wval(orient)), // 8
      _wrow("PIXELS", _wval(_wesc(mpx))), // 9
      _wrow(
        "REFRESH",
        _wval(screen.refreshRate ? screen.refreshRate + "Hz" : "—"),
      ), // 10
      _wsep(), // 11
      _wbot(), // 12
    ].join("\n"),
    size: "single",
  };
}

function _wPresence() {
  _wIdleSeconds = Math.floor((Date.now() - _wLastActivity) / 1000);
  const visible = !document.hidden;
  const focused = document.hasFocus();
  const status = visible && focused ? "ACTIVE" : visible ? "IDLE" : "HIDDEN";
  const statusCol =
    status === "ACTIVE"
      ? "var(--cyan)"
      : status === "IDLE"
        ? "var(--yellow)"
        : "var(--grey)";
  const idleStr =
    _wIdleSeconds >= 60
      ? Math.floor(_wIdleSeconds / 60) + "m " + (_wIdleSeconds % 60) + "s"
      : _wIdleSeconds + "s";
  const scrollY = Math.round(window.scrollY || terminal.scrollTop || 0);

  return {
    html: [
      _wtop(), // 1
      _wsep(), // 2
      _wpad(`<span class="sb-label">USER PRESENCE</span>`), // 3
      _wsep(), // 4
      _wrow("STATUS", _wcol(statusCol, status)), // 5
      _wrow(
        "FOCUS",
        focused ? _wcol("var(--cyan)", "TRUE") : _wcol("var(--grey)", "FALSE"),
      ), // 6
      _wrow(
        "IDLE",
        _wcol(
          _wIdleSeconds > 30 ? "var(--amber)" : "var(--cyan)",
          _wesc(idleStr),
        ),
      ), // 7
      _wrow("SCROLL", _wval(scrollY + "px")), // 8
      _wrow("CLICKS", _wval(window._wClickCount || 0)), // 9
      _wrow("TRACKING", _wcol("var(--cyan)", "ON")), // 10
      _wsep(), // 11
      _wbot(), // 12
    ].join("\n"),
    size: "single",
  };
}

function _wInput() {
  const pointer = window.matchMedia("(pointer: fine)").matches
    ? "MOUSE"
    : window.matchMedia("(pointer: coarse)").matches
      ? "TOUCH"
      : "NONE";
  const touch =
    "ontouchstart" in window || navigator.maxTouchPoints > 0 ? "YES" : "NO";
  const keys = _wKeyActive ? "ACTIVE" : "IDLE";
  const keyCol = _wKeyActive ? "var(--cyan)" : "var(--grey)";
  const touchPts = navigator.maxTouchPoints || 0;
  const gamepad = navigator.getGamepads
    ? Array.from(navigator.getGamepads()).filter(Boolean).length > 0
      ? "YES"
      : "NO"
    : "—";

  return {
    html: [
      _wtop(), // 1
      _wsep(), // 2
      _wpad(`<span class="sb-label">INPUT DEVICES</span>`), // 3
      _wsep(), // 4
      _wrow("POINTER", _wcol("var(--pink)", pointer)), // 5
      _wrow("TOUCH", _wval(touch)), // 6
      _wrow("POINTS", _wval(touchPts)), // 7
      _wrow("KEYS", _wcol(keyCol, keys)), // 8
      _wrow("GAMEPAD", _wval(gamepad)), // 9
      _wrow("EVENTS", _wcol("var(--cyan)", "LIVE")), // 10
      _wsep(), // 11
      _wbot(), // 12
    ].join("\n"),
    size: "single",
  };
}

// New: DOM / document stats widget (12 lines)
function _wDomStats() {
  const nodes = document.querySelectorAll("*").length;
  const scripts = document.querySelectorAll("script").length;
  const imgs = document.querySelectorAll("img").length;
  const links = document.querySelectorAll("a").length;
  const styles = document.querySelectorAll("link[rel=stylesheet],style").length;
  const forms = document.querySelectorAll("input,textarea,select").length;

  return {
    html: [
      _wtop(), // 1
      _wsep(), // 2
      _wpad(`<span class="sb-label">DOM INSPECTOR</span>`), // 3
      _wsep(), // 4
      _wrow("NODES", _wcol("var(--cyan)", nodes)), // 5
      _wrow("SCRIPTS", _wval(scripts)), // 6
      _wrow("STYLES", _wcol("var(--purple)", styles)), // 7
      _wrow("LINKS", _wval(links)), // 8
      _wrow("IMAGES", _wval(imgs)), // 9
      _wrow("INPUTS", _wcol("var(--amber)", forms)), // 10
      _wsep(), // 11
      _wbot(), // 12
    ].join("\n"),
    size: "single",
  };
}

// Storage / cache stats widget (12 lines)
function _wStorage() {
  let lsUsed = "—",
    ssUsed = "—",
    lsCount = 0,
    ssCount = 0;
  try {
    lsCount = localStorage.length;
    let lsBytes = 0;
    for (let i = 0; i < lsCount; i++) {
      const k = localStorage.key(i);
      lsBytes += (k.length + (localStorage.getItem(k) || "").length) * 2;
    }
    lsUsed =
      lsBytes < 1024 ? lsBytes + " B" : (lsBytes / 1024).toFixed(1) + " KB";
  } catch (_) {}
  try {
    ssCount = sessionStorage.length;
    let ssBytes = 0;
    for (let i = 0; i < ssCount; i++) {
      const k = sessionStorage.key(i);
      ssBytes += (k.length + (sessionStorage.getItem(k) || "").length) * 2;
    }
    ssUsed =
      ssBytes < 1024 ? ssBytes + " B" : (ssBytes / 1024).toFixed(1) + " KB";
  } catch (_) {}

  const cacheApi = "caches" in window ? "YES" : "NO";
  const sw = navigator.serviceWorker ? "REG" : "NONE";
  const cookies = navigator.cookieEnabled ? "ON" : "OFF";
  const pct = Math.min(100, Math.round((lsCount / 50) * 100));

  return {
    html: [
      _wtop(), // 1
      _wsep(), // 2
      _wpad(`<span class="sb-label">STORAGE I/O</span>`), // 3
      _wsep(), // 4
      _wrow("LOCAL", _wcol("var(--amber)", _wesc(lsUsed))), // 5
      _wrow("KEYS", _wval(lsCount)), // 6
      _wrow("SESSION", _wcol("var(--blue)", _wesc(ssUsed))), // 7
      _wrow("S-KEYS", _wval(ssCount)), // 8
      _wrow("CACHE", _wval(cacheApi)), // 9
      _wrow("QUOTA", _wbar(pct)), // 10
      _wsep(), // 11
      _wbot(), // 12
    ].join("\n"),
    size: "single",
  };
}

// ══════════════════════════════════════════════════════════════
// SINGLE-WIDTH: CLOCK ORBIT  (12 lines)
// Animated earth/sun/moon orbit
// ══════════════════════════════════════════════════════════════
function _wClockOrbit() {
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const dayOfYear = Math.floor((now - startOfYear) / 864e5) + 1;
  const totalDays = now.getFullYear() % 4 === 0 ? 366 : 365;
  const orbitDeg = Math.round((dayOfYear / totalDays) * 360);
  const baseAngle = (dayOfYear / totalDays) * 2 * Math.PI - Math.PI / 2;
  const animAngle = baseAngle + _wOrbitStep * 0.05;

  const seasons = [
    [80, "spring"],
    [172, "summer"],
    [266, "autumn"],
    [355, "winter"],
  ];
  let season = "winter";
  for (const [start, name] of seasons) {
    if (dayOfYear >= start) season = name;
  }

  // Build orbit grid (19×7 ellipse)
  const OW = 19,
    OH = 7,
    cx = 9,
    cy = 3,
    rx = 8,
    ry = 3;
  const grid = [];
  for (let y = 0; y < OH; y++) {
    grid[y] = new Array(OW).fill(" ");
  }
  for (let a = 0; a < 360; a += 4) {
    const rad = (a * Math.PI) / 180;
    const px = Math.round(cx + rx * Math.cos(rad));
    const py = Math.round(cy + ry * Math.sin(rad));
    if (px >= 0 && px < OW && py >= 0 && py < OH && grid[py][px] === " ")
      grid[py][px] = "·";
  }
  grid[cy][cx] = "S";
  const ex = Math.round(cx + rx * Math.cos(animAngle));
  const ey = Math.round(cy + ry * Math.sin(animAngle));
  if (ex >= 0 && ex < OW && ey >= 0 && ey < OH) grid[ey][ex] = "E";
  const moonAngle = animAngle * 12;
  const mx = Math.max(
    0,
    Math.min(OW - 1, Math.round(ex + 2 * Math.cos(moonAngle))),
  );
  const my = Math.max(
    0,
    Math.min(OH - 1, Math.round(ey + 1 * Math.sin(moonAngle))),
  );
  if (grid[my][mx] === "·" || grid[my][mx] === " ") grid[my][mx] = "o";

  const orbitLines = grid.map((r) => r.join(""));

  // Space facts
  const sp = _spaceData();
  const mw = window._marsWeather;
  const marsLabel = mw ? `sol ${mw.sol}` : `sol ${sp.marsSol}`;
  const marsLine2 = mw
    ? `${mw.minTemp}/${mw.maxTemp}°C ${mw.opacity.toLowerCase()}`
    : `${sp.marsTemp}°C ${sp.marsSeason}`;

  // Double-width layout: orbit left, info right (same as clock widget)
  const CL = 25;
  const infoLines = [
    ``,
    ` <span class="sb-label">MARS</span> <span class="sb-dim">${marsLabel}</span>`,
    ` <span style="color:var(--blue)">${marsLine2}</span>`,
    ``,
    ` <span class="sb-label">MOON</span> <span class="sb-dim">${sp.moonIcon} ${sp.moonName}</span>`,
    ` <span class="sb-label">SUN</span>  <span class="sb-dim">${sp.zodiacName}</span>`,
    ` <span class="sb-dim">${sp.nextEvent}</span> ${_wval(sp.nextDays + "d")}`,
  ];

  function _orbRow(left, right) {
    const lVis = _wstrip(left).length;
    const pad = Math.max(0, CL - lVis);
    const combined = left + " ".repeat(pad) + _wcol("var(--grey)", "│") + right;
    return _wdpad(combined);
  }

  const L = [];
  L.push(_wdtop()); // 1
  L.push(
    _orbRow(
      "",
      ` <span class="sb-label">ORBIT</span> ${_wval(orbitDeg + "°")} <span class="sb-dim">${season}</span>`,
    ),
  ); // 2

  for (let i = 0; i < 7; i++) {
    // 3-9
    const raw = (orbitLines[i] || "")
      .replace("S", `<span class="sb-sun">*</span>`)
      .replace("E", `<span class="sb-earth">⊕</span>`)
      .replace("o", `<span class="sb-moon">o</span>`);
    const left = "  " + raw;
    const right = infoLines[i] || "";
    L.push(_orbRow(left, right));
  }

  L.push(_orbRow("", "")); // 10
  L.push(_wdsep()); // 11
  L.push(_wdbot()); // 12
  return { html: L.join("\n"), size: "double" };
}

// ══════════════════════════════════════════════════════════════
// DOUBLE-WIDTH: NEOFETCH  (12 lines)
// ══════════════════════════════════════════════════════════════
function _wNeofetch() {
  const ua = navigator.userAgent;
  const uaLower = ua.toLowerCase();
  let osName = "Web";
  const c = (color, text) =>
    `<span style="color:${color}">${_wesc(text)}</span>`;

  let osLogo = [];
  if (uaLower.includes("android")) {
    osName = "Android";
    osLogo = [
      c("var(--cyan)", "   ;,    ,;   "),
      c("var(--cyan)", "  ';.-----.;' "),
      c("var(--cyan)", "  | ") +
        c("var(--white)", "O     O") +
        c("var(--cyan)", " | "),
      c("var(--cyan)", "  |         | "),
      c("var(--cyan)", "  '---------' "),
    ];
  } else if (
    uaLower.includes("iphone") ||
    uaLower.includes("ipad") ||
    uaLower.includes("mac")
  ) {
    osName = "macOS";
    osLogo = [
      c("var(--cyan)", "       .:'    "),
      c("var(--cyan)", "   _ :'_      "),
      c("var(--yellow)", ".'`_`-'_``.   "),
      c("var(--yellow)", ":________.-'  "),
      c("var(--red)", ":_______:     "),
      c("var(--purple)", ":_______:     "),
      c("var(--purple)", " :_______`-;  "),
      c("var(--blue)", "  `._.-._.'   "),
    ];
  } else if (uaLower.includes("win")) {
    osName = "Windows";
    osLogo = [
      c("var(--blue)", " ####  ####   "),
      c("var(--blue)", " ####  ####   "),
      c("var(--blue)", " ####  ####   "),
      c("var(--blue)", "              "),
      c("var(--blue)", " ####  ####   "),
      c("var(--blue)", " ####  ####   "),
      c("var(--blue)", " ####  ####   "),
    ];
  } else if (uaLower.includes("linux") || uaLower.includes("x11")) {
    osName = "Linux";
    osLogo = [
      "     " + c("var(--white)", ".--.") + "     ",
      "    " +
        c("var(--white)", "|") +
        c("var(--yellow)", "o") +
        c("var(--white)", "_") +
        c("var(--yellow)", "o") +
        c("var(--white)", " |") +
        "    ",
      "    " +
        c("var(--white)", "|") +
        c("var(--yellow)", ":_/ ") +
        c("var(--white)", "|") +
        "    ",
      "   " + c("var(--yellow)", "//") + c("var(--white)", "   \\ \\") + "   ",
      "  " + c("var(--yellow)", "(|") + c("var(--white)", "     | )") + "  ",
      " " +
        c("var(--yellow)", "/'\\") +
        c("var(--white)", "_   _/") +
        c("var(--yellow)", "`\\") +
        " ",
      " " +
        c("var(--yellow)", "\\___)") +
        c("var(--white)", "=(") +
        c("var(--yellow)", "___/") +
        " ",
    ];
  } else {
    osLogo = [
      c("var(--cyan)", "    .---.     "),
      c("var(--cyan)", "   /     \\    "),
      c("var(--cyan)", "  | ") +
        c("var(--white)", "o   o") +
        c("var(--cyan)", " |   "),
      c("var(--cyan)", "  |  ") +
        c("var(--white)", " > ") +
        c("var(--cyan)", "  |   "),
      c("var(--cyan)", "   \\_____/    "),
    ];
  }

  // Pad logo lines to exactly 8 rows of LW=14 visible chars
  const LW = 14;
  while (osLogo.length < 8) osLogo.push(" ".repeat(LW));
  osLogo = osLogo.slice(0, 8).map((l) => {
    const vis = _wstrip(l).length;
    return vis >= LW ? l : l + " ".repeat(LW - vis);
  });

  const cores = navigator.hardwareConcurrency || "?";
  let browser = "unknown";
  if (ua.includes("Firefox")) browser = "Firefox";
  else if (ua.includes("Edg")) browser = "Edge";
  else if (ua.includes("Chrome")) browser = "Chrome";
  else if (ua.includes("Safari")) browser = "Safari";

  const themeName =
    typeof THEMES !== "undefined" && typeof getActiveTheme === "function"
      ? (
          THEMES.find((t) => t.id === getActiveTheme()) || THEMES[0]
        ).name.toLowerCase()
      : "phosphor";

  const uptimeSec = Math.floor((Date.now() - startTime) / 1000);
  const uptimeH = Math.floor(uptimeSec / 3600);
  const uptimeM = Math.floor((uptimeSec % 3600) / 60);
  const uptimeS = uptimeSec % 60;
  const nfUptime =
    uptimeH > 0
      ? `${uptimeH}h ${uptimeM}m`
      : uptimeM > 0
        ? `${uptimeM}m ${uptimeS}s`
        : `${uptimeS}s`;

  // Exactly 8 info lines to match 8 logo lines
  const infoLines = [
    `<span class="w-nf-user">visitor</span><span class="sb-dim">@</span><span class="w-nf-host">ariana</span>`,
    `<span class="sb-dim">${"─".repeat(18)}</span>`,
    `<span class="w-nf-key">OS      </span><span class="sb-dim">:</span> ${_wval(osName)}`,
    `<span class="w-nf-key">Host    </span><span class="sb-dim">:</span> ${_wval(window._weatherData ? window._weatherData.city : "ariana-web")}`,
    `<span class="w-nf-key">Browser </span><span class="sb-dim">:</span> ${_wval(browser)}`,
    `<span class="w-nf-key">Theme   </span><span class="sb-dim">:</span> ${_wval(themeName)}`,
    `<span class="w-nf-key">Cores   </span><span class="sb-dim">:</span> ${_wval(cores)}`,
    `<span class="w-nf-key">Uptime  </span><span class="sb-dim">:</span> ${_wval(nfUptime)}`,
  ];

  // 12 lines:
  // 1   top
  // 2-9 8 logo+info rows
  // 10  sep
  // 11  color swatches row
  // 12  bot
  const swatches = [
    "var(--cyan)",
    "var(--blue)",
    "var(--purple)",
    "var(--pink)",
    "var(--red)",
    "var(--amber)",
    "var(--yellow)",
    "var(--white)",
  ]
    .map((col) => `<span style="color:${col}">██</span>`)
    .join("");

  const L = [];
  L.push(_wdtop()); // 1

  for (let i = 0; i < 8; i++) {
    // 2-9
    const logo = osLogo[i];
    const info = infoLines[i] || "";
    const infoVis = _wstrip(info).length;
    const gap = Math.max(0, _WD - 4 - LW - 1 - infoVis);
    L.push(
      _wfr("│") + " " + logo + " " + info + " ".repeat(gap) + " " + _wfr("│"),
    );
  }

  L.push(_wdsep()); // 10

  // Color swatches row
  const swatchVis = _wstrip(swatches).length;
  const swatchGap = Math.max(0, _WD - 4 - swatchVis);
  L.push(_wfr("│") + " " + swatches + " ".repeat(swatchGap) + " " + _wfr("│")); // 11

  L.push(_wdbot()); // 12
  return { html: L.join("\n"), size: "double" };
}

// ══════════════════════════════════════════════════════════════
// Boot sequence animation
// ══════════════════════════════════════════════════════════════
function _wBootSequence(container, callback) {
  const modules = [
    "SYSTEM CORE",
    "RENDER ENGINE",
    "MEMORY SCANNER",
    "NETWORK LINK",
    "DISPLAY UNIT",
    "USER PRESENCE",
    "ANALOG CLOCK",
    "CLOCK ORBIT",
    "WORLD CLOCK",
    "TEMP / ARCHIVE",
    "NEOFETCH",
    "INPUT DEVICES",
    "DOM INSPECTOR",
    "STORAGE I/O",
  ];

  const lines = [
    { text: "", delay: 50 },
    { text: "  SYSTEM MONITOR v2.1", cls: "w-boot-title", delay: 100 },
    {
      text: "  ══════════════════════════════════════",
      cls: "w-boot-rule",
      delay: 60,
    },
    { text: "", delay: 150 },
    { text: "  Initialising modules...", cls: "w-boot-dim", delay: 400 },
    { text: "", delay: 100 },
  ];

  for (const name of modules) {
    const dots = ".".repeat(Math.max(1, 28 - name.length));
    lines.push({
      text: `  Loading ${name} ${dots} `,
      module: "OK",
      delay: 60 + Math.random() * 80,
    });
  }

  lines.push({ text: "", delay: 200 });
  lines.push({ text: "  All systems nominal.", cls: "w-boot-ok", delay: 200 });
  lines.push({
    text: "  Launching dashboard...",
    cls: "w-boot-dim",
    delay: 400,
  });

  let i = 0;
  function nextLine() {
    if (i >= lines.length) {
      setTimeout(callback, 300);
      return;
    }
    const line = lines[i];
    const div = document.createElement("div");

    if (line.module) {
      div.innerHTML = `<span class="w-boot-dim">${_wesc(line.text)}</span>`;
      container.appendChild(div);
      setTimeout(() => {
        div.innerHTML = `<span class="w-boot-dim">${_wesc(line.text)}</span><span class="w-boot-ok">${line.module}</span>`;
        i++;
        setTimeout(nextLine, 40);
      }, line.delay);
    } else {
      if (line.cls)
        div.innerHTML = `<span class="${line.cls}">${_wesc(line.text)}</span>`;
      else {
        div.textContent = line.text;
        if (!line.text) div.className = "spacer";
      }
      container.appendChild(div);
      i++;
      setTimeout(nextLine, line.delay);
    }
    terminal.scrollTop = terminal.scrollHeight;
  }
  nextLine();
}

// ══════════════════════════════════════════════════════════════
// Build / rebuild the widget grid
// ══════════════════════════════════════════════════════════════
//
// Grid layout (every row = 3 columns):
//   Row 0: ─── Banner (full) ───────────────────
//   Row 1: [Neofetch (double)]  [SystemCore]     — identity
//   Row 2: [AnalogClock (double)]  [WorldClock]  — time
//   Row 3: [Memory]  [Network]  [Display]        — hardware
//   Row 4: [TempArchive (double)]  [Presence]    — environment
//   Row 5: [Orbit (double)]  [RenderEngine]      — space + perf
//   Row 6: [Input]  [DomStats]  [Storage]        — devices / io
//   Row 7: ─── Footer (full) ──────────────────
//
function _wRebuildGrid() {
  if (!_wGridEl) return;

  const widgets = [
    _wBanner(), // full  (row 0)
    _wNeofetch(),
    _wSystemCore(), // d + s (row 1)
    _wAnalogClock(),
    _wWorldClock(), // d + s (row 2) — time grouped
    _wMemory(),
    _wNetwork(),
    _wDisplay(), // s+s+s (row 3)
    _wTempArchive(),
    _wPresence(), // d + s (row 4)
    _wClockOrbit(),
    _wRenderEngine(), // d + s (row 5)
    _wInput(),
    _wDomStats(),
    _wStorage(), // s+s+s (row 6)
    _wFooter(), // full  (row 7)
  ];

  _wGridEl.innerHTML = "";
  for (const w of widgets) {
    if (!w) continue;
    const cell = document.createElement("div");
    cell.className =
      "widget-cell" +
      (w.size === "full" ? " w-full" : w.size === "double" ? " w-double" : "");
    cell.innerHTML = w.html;
    _wGridEl.appendChild(cell);
  }
}

// ══════════════════════════════════════════════════════════════
// Main render function — called from terminal.js command
// ══════════════════════════════════════════════════════════════
function renderWidgetsDashboard() {
  clearOutput();
  pushRoute("/widgets");
  if (sbStatus) sbStatus.textContent = "ESC to exit";
  if (titleText) titleText.textContent = "visitor@ariana:~";

  // Reset state
  _wActive = true;
  _wFpsHistory = [];
  _wLastFrameTime = 0;
  _wCurrentFps = 0;
  _wFrameDelta = 0;
  _wMemPeak = 0;
  _wMemHistory = [];
  _wLastActivity = Date.now();
  _wKeyActive = false;
  _wTickCount = 0;
  _wOrbitStep = 0;
  _wBannerPid = Math.floor(Math.random() * 9000 + 1000);

  // Start FPS tracking
  _wFpsRafId = requestAnimationFrame(_wFpsLoop);

  // Add activity listeners
  document.addEventListener("keydown", _wOnActivity);
  document.addEventListener("mousemove", _wOnActivity);
  document.addEventListener("click", _wOnActivity);

  // Fetch battery
  _wFetchBattery();

  // Fetch Mars weather
  if (typeof fetchMarsWeather === "function") fetchMarsWeather();

  // Page container
  _wPageEl = document.createElement("div");
  _wPageEl.className = "widgets-page";

  // Boot sequence
  const bootEl = document.createElement("div");
  bootEl.className = "widgets-boot";
  _wPageEl.appendChild(bootEl);

  // Dashboard area (hidden until boot completes)
  const dashEl = document.createElement("div");
  dashEl.className = "widgets-dash";
  dashEl.style.display = "none";
  _wPageEl.appendChild(dashEl);

  output.appendChild(_wPageEl);

  // Boot, then reveal dashboard
  _wBootSequence(bootEl, () => {
    bootEl.style.display = "none";

    // Grid
    _wGridEl = document.createElement("div");
    _wGridEl.className = "widgets-grid";
    dashEl.appendChild(_wGridEl);

    // Hint
    const hint = document.createElement("div");
    hint.className = "widgets-hint";
    hint.textContent =
      "  ESC exit · type 'home' to return · live refresh every 1s";
    dashEl.appendChild(hint);

    dashEl.style.display = "";
    _wRebuildGrid();
    terminal.scrollTop = 0;

    // Start live updates
    window._widgetsInterval = setInterval(() => {
      if (document.hidden) return;
      _wTickCount++;
      _wOrbitStep++;
      _wRebuildGrid();

      // Random flicker
      if (Math.random() < 0.03 && _wGridEl) {
        _wGridEl.classList.add("w-flicker");
        setTimeout(
          () => _wGridEl && _wGridEl.classList.remove("w-flicker"),
          80,
        );
      }
    }, 1000);
  });
}

// ── Cleanup — called from clearOutput() in terminal.js ──────
function _widgetsCleanup() {
  _wActive = false;
  if (window._widgetsInterval) {
    clearInterval(window._widgetsInterval);
    window._widgetsInterval = null;
  }
  if (_wFpsRafId) {
    cancelAnimationFrame(_wFpsRafId);
    _wFpsRafId = null;
  }
  _wGridEl = null;
  _wPageEl = null;
  document.removeEventListener("keydown", _wOnActivity);
  document.removeEventListener("mousemove", _wOnActivity);
  document.removeEventListener("click", _wOnActivity);
}
