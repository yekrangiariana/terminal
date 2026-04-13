// ─────────────────────────────────────────────
// DOM — declared FIRST, used everywhere below
// ─────────────────────────────────────────────
const terminal = document.getElementById("terminal");
const output = document.getElementById("output");
const input = document.getElementById("command-input");
const tabHints = document.getElementById("tab-hints");
const palette = document.getElementById("palette");
const paletteInput = document.getElementById("palette-input");
const paletteRes = document.getElementById("palette-results");
const clockEl = document.getElementById("clock-display");
const titleText = document.getElementById("title-text");
const sbMode = document.getElementById("sb-mode");
const sbStatus = document.getElementById("sb-status");

// ─────────────────────────────────────────────
// State
// ─────────────────────────────────────────────
let cmdHistory = [];
let historyIdx = -1;
let savedInput = "";
let blogMode = false;
let readerMode = false; // true when reading a post opened from the blog list
let selectedPost = 0;
let listItems = [];
let listEl = null;
const startTime = Date.now();

// ─────────────────────────────────────────────
// URL routing helpers (hash-based)
// ─────────────────────────────────────────────
let _suppressPush = false;

function pushRoute(path) {
  if (_suppressPush) return;
  const target = path === "/" ? "" : path;
  if (location.hash.replace(/^#/, "") !== target) {
    location.hash = target ? "#" + target : "";
  }
}

function getRoutePath() {
  return (location.hash.replace(/^#\/?/, "/").replace(/\/+$/, "")) || "/";
}

function handleRoute(path) {
  path = (path || getRoutePath()).replace(/\/+$/, "") || "/";
  _suppressPush = true;
  try {
    if (path === "/about") {
      commands.about.execute();
      return true;
    }

    // /blog or /blog/[category]
    if (path === "/blog") {
      commands.blog.execute();
      return true;
    }
    const blogCat = path.match(/^\/blog\/([^\/]+)$/);
    if (blogCat) {
      const cat = blogCat[1];
      if (cat === "projects") {
        commands.projects.execute();
      } else {
        commands.blog.execute(cat);
      }
      return true;
    }

    // /category/slug (post)
    const m = path.match(/^\/([^\/]+)\/([^\/]+)$/);
    if (m) {
      const [, cat, slug] = m;
      const post = ALL.find((p) => p.slug === slug && p.category === cat);
      if (post) {
        clearOutput();
        const blogItems = ALL.filter((p) => !p.isRepo);
        listItems = byDate(blogItems);
        selectedPost = listItems.indexOf(post);
        if (selectedPost === -1) selectedPost = 0;
        openPost(post, true);
        return true;
      }
    }

    // Default → home
    clearOutput();
    printHome();
    return false;
  } finally {
    _suppressPush = false;
  }
}

// ─────────────────────────────────────────────
// Settings — themes & fonts (persisted in localStorage)
// ─────────────────────────────────────────────
const THEMES = [
  {
    id: "phosphor",
    name: "Phosphor",
    desc: "cyan on deep black — the default",
  },
  { id: "monokai", name: "Monokai Pro", desc: "vibrant green & orange" },
  {
    id: "bloodmoon",
    name: "Bloodmoon",
    desc: "crimson on void — all red everything",
  },
  { id: "acid", name: "Acid", desc: "neon green on pure black — hacker mode" },
  {
    id: "vaporwave",
    name: "Vaporwave",
    desc: "hot pink & purple — aesthetic overload",
  },
  {
    id: "frozen",
    name: "Frozen",
    desc: "ice white on abyss blue — monochrome cold",
  },
  {
    id: "paper",
    name: "Paper",
    desc: "dark ink on warm white — the light one",
  },
];

const FONTS = [
  { id: "fira-code", name: "Fira Code", desc: "ligatures, designed for code" },
  {
    id: "system-mono",
    name: "System Mono",
    desc: "SF Mono / Cascadia / Consolas",
  },
];

function getActiveTheme() {
  try {
    return localStorage.getItem("term-theme") || "phosphor";
  } catch {
    return "phosphor";
  }
}
function getActiveFont() {
  try {
    return localStorage.getItem("term-font") || "fira-code";
  } catch {
    return "fira-code";
  }
}

function applyTheme(id) {
  const root = document.documentElement;
  if (id === "phosphor") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", id);
  try {
    localStorage.setItem("term-theme", id);
  } catch {}
  // Live-update sidebar theme name
  const el = document.getElementById("sb-theme-val");
  if (el)
    el.textContent = (
      THEMES.find((t) => t.id === id) || THEMES[0]
    ).name.toLowerCase();
}

function applyFont(id) {
  const root = document.documentElement;
  if (id === "fira-code") root.removeAttribute("data-font");
  else root.setAttribute("data-font", id);
  try {
    localStorage.setItem("term-font", id);
  } catch {}
}

// Apply saved settings immediately (reset unknown themes to default)
const _validThemeIds = THEMES.map((t) => t.id);
const _savedTheme = getActiveTheme();
applyTheme(_validThemeIds.includes(_savedTheme) ? _savedTheme : "phosphor");
applyFont(getActiveFont());

// Content registry is in js/shared.js (SLUGS array)

let ALL = [];

const CAT_COLORS = {
  writing: "c-info",
  journalism: "c-blue",
  project: "c-purple",
};

async function loadContent() {
  const results = await Promise.all(
    SLUGS.map((slug) =>
      fetch(`blog/${slug}.md`)
        .then((r) => (r.ok ? r.text() : null))
        .then((md) => {
          if (!md) return null;
          const { meta, body } = parseFrontmatter(md);
          return { slug, content: body, ...meta };
        })
        .catch(() => null),
    ),
  );
  ALL = results.filter(Boolean);
}

// ─────────────────────────────────────────────
// Fetch GitHub repos → inject as project items
// ─────────────────────────────────────────────
async function fetchAndInjectRepos() {
  try {
    const r = await fetch(
      "https://api.github.com/users/yekrangiariana/repos?sort=updated&per_page=100&type=public",
      { headers: { Accept: "application/vnd.github+json" } },
    );
    if (!r.ok) return;
    const repos = (await r.json())
      .filter((repo) => !repo.fork)
      .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
    for (const repo of repos) {
      const item = {
        slug: "gh-" + repo.name,
        title: repo.name,
        category: "project",
        date: repo.updated_at.slice(0, 10),
        description: repo.description || "",
        url: repo.html_url,
        isRepo: true,
        content: null,
      };
      ALL.push(item);
    }
  } catch (_) {
    /* GitHub API unavailable */
  }
}

// ─────────────────────────────────────────────
// Output helpers
// ─────────────────────────────────────────────
function printLine(text = "", cls = "") {
  const div = document.createElement("div");
  if (cls) div.className = cls;
  div.textContent = text;
  output.appendChild(div);
  terminal.scrollTop = terminal.scrollHeight;
}

function printBlank() {
  const div = document.createElement("div");
  div.className = "spacer";
  output.appendChild(div);
  terminal.scrollTop = terminal.scrollHeight;
}

function printBox(lines) {
  const maxLen = Math.max(...lines.map((l) => l.length));
  const w = maxLen + 4;
  printLine("╔" + "═".repeat(w) + "╗", "c-green");
  for (const line of lines) {
    const pad = w - line.length - 2;
    printLine(
      "║  " + line + " ".repeat(pad) + "║",
      line === "" ? "c-green" : "",
    );
  }
  printLine("╚" + "═".repeat(w) + "╝", "c-green");
}

function clearOutput() {
  if (window._earthInterval) {
    clearInterval(window._earthInterval);
    window._earthInterval = null;
  }
  if (window._sidebarInterval) {
    clearInterval(window._sidebarInterval);
    window._sidebarInterval = null;
  }
  if (window._postScrollHandler) {
    terminal.removeEventListener("scroll", window._postScrollHandler);
    window._postScrollHandler = null;
  }
  output.innerHTML = "";
  blogMode = false;
  readerMode = false;
  _configMode = false;
  _configEl = null;
  listEl = null;
  if (titleText) titleText.textContent = "visitor@ariana:~";
  if (sbMode) sbMode.textContent = "TERMINAL";
  if (sbStatus) sbStatus.textContent = "ready";
}

// ─────────────────────────────────────────────
// Navigable list — terminal blog with sidebar
// ─────────────────────────────────────────────
// ASCII title banners
const ASCII_TITLES = {
  BLOG: [" █▀▄ █   ▄▀▄ ▄▀▀", " █▀▄ █   █ █ █ █", " ▀▀  ▀▀▀ ▀▀▀ ▀▀▀"],
  PROJECTS: [
    " █▀▄ █▀▄ ▄▀▄  ▀ █▀▀ ▄▀▀ ▀█▀ ▄▀▀",
    " █▀  █▀▄ █ █ ░█ █▀▀ █ █  █  ▀▄▄",
    " ▀   ▀ ▀ ▀▀▀ ▀▀ ▀▀▀ ▀▀▀  ▀  ▄▄▀",
  ],
};

function showList(items, heading, titleKey) {
  blogMode = true;
  if (sbMode) sbMode.textContent = "BROWSING";
  if (sbStatus) sbStatus.textContent = "navigate with ↑↓  Enter=open  ESC=exit";
  listItems = items;
  selectedPost = 0;
  _currentHeading = heading;
  _currentTitleKey = titleKey || "BLOG";

  listEl = document.createElement("div");
  listEl.id = "entry-list";
  output.appendChild(listEl);
  renderNewspaper(heading);
  terminal.scrollTop = 0;
}

// Categories rendered as flat terminal list
const CAT_LABELS = {
  writing: "WRITING",
  journalism: "JOURNALISM",
  project: "PROJECTS",
};

// ── Fetch visitor IP (free, no key) ─────────────────────────────────
window._visitorIP = null;
async function fetchVisitorIP() {
  try {
    const r = await fetch("https://api.ipify.org?format=json");
    if (r.ok) {
      const data = await r.json();
      window._visitorIP = data.ip;
    }
  } catch (_) {
    /* silently fail */
  }
}
fetchVisitorIP();

// ── Real weather via geolocation + Open-Meteo (free, no API key) ────
window._weatherData = null;
window._climateData = null; // { monthTemps: [12 floats], city, tMin, tMax, avg }

async function fetchRealWeather() {
  try {
    const pos = await new Promise((resolve, reject) =>
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        timeout: 8000,
      }),
    );
    const { latitude: lat, longitude: lon } = pos.coords;

    const [wx, geo, climate] = await Promise.all([
      fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m`,
      ).then((r) => r.json()),
      fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`,
        {
          headers: {
            "Accept-Language": "en",
            "User-Agent": "ariana-terminal/2.0",
          },
        },
      ).then((r) => r.json()),
      fetch(
        `https://climate-api.open-meteo.com/v1/climate?latitude=${lat}&longitude=${lon}&models=EC_Earth3P_HR&monthly=temperature_2m_mean&start_date=2010-01-01&end_date=2019-12-01`,
      )
        .then((r) => r.json())
        .catch(() => null),
    ]);

    const temp = Math.round(wx.current.temperature_2m);
    const addr = geo.address || {};
    const city =
      addr.city || addr.town || addr.village || addr.county || "unknown";
    const country = (addr.country_code || "").toUpperCase();

    window._weatherData = { temp, city, country };

    // Process climate normals: average each month across all years
    if (climate && climate.monthly && climate.monthly.temperature_2m_mean) {
      const vals = climate.monthly.temperature_2m_mean;
      const monthSums = new Array(12).fill(0);
      const monthCounts = new Array(12).fill(0);
      const dates = climate.monthly.time;
      for (let i = 0; i < vals.length; i++) {
        if (vals[i] != null) {
          const m = new Date(dates[i]).getMonth();
          monthSums[m] += vals[i];
          monthCounts[m]++;
        }
      }
      const monthTemps = monthSums.map((s, i) =>
        monthCounts[i] ? Math.round(s / monthCounts[i]) : 0,
      );
      const tMin = Math.min(...monthTemps);
      const tMax = Math.max(...monthTemps);
      const avg = Math.round(monthTemps.reduce((a, b) => a + b, 0) / 12);
      window._climateData = { monthTemps, tMin, tMax, avg, city };

      // Live-update the TEMP widget if rendered
      const tmEl = document.getElementById("sb-temp-widget");
      if (tmEl) tmEl.dataset.ready = "1";
    }

    // Update sidebar lines if already rendered
    const tEl = document.getElementById("sb-temp-line");
    if (tEl) {
      const H = 24;
      const fr = (s) => `<span class="sb-frame">${s}</span>`;
      const strip = (s) => s.replace(/<[^>]*>/g, "");
      const hpad = (inner) => {
        const vis = strip(inner).length;
        const gap = Math.max(0, H - 4 - vis);
        return fr("│") + " " + inner + " ".repeat(gap) + " " + fr("│");
      };
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "unknown";
      const tzShort = tz.split("/").pop() || tz;
      const col =
        temp > 15
          ? "var(--amber)"
          : temp > 5
            ? "var(--yellow)"
            : temp > -5
              ? "var(--blue)"
              : "var(--purple)";
      tEl.innerHTML = hpad(
        `<span style="color:${col}">${temp}°C</span> <span class="sb-dim">${tzShort}</span>`,
      );
    }
  } catch (_) {
    // silently fall back to seasonal estimate
  }
}

// ── Sidebar stats panel ────────────────────────
function buildSidebar(items) {
  const now = new Date();
  const sb = document.createElement("div");
  sb.className = "blog-sidebar";

  const sidebarItems = items || listItems;
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const dayOfYear = Math.floor((now - startOfYear) / 864e5) + 1;
  const totalDays = now.getFullYear() % 4 === 0 ? 366 : 365;
  const yearPct = Math.round((dayOfYear / totalDays) * 100);

  // Helsinki time
  const timeStr = now.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "Europe/Helsinki",
  });
  const dateStr = now.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Europe/Helsinki",
  });
  const hHour = parseInt(
    now.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      hour12: false,
      timeZone: "Europe/Helsinki",
    }),
  );
  const hMin = parseInt(
    now.toLocaleTimeString("en-GB", {
      minute: "2-digit",
      timeZone: "Europe/Helsinki",
    }),
  );
  const dayPct = Math.round((hHour * 60 + hMin) / 14.4);
  const dayFill = Math.round(dayPct / 10);
  const dayBar = "█".repeat(dayFill) + "░".repeat(10 - dayFill);

  // Temperature — real if available, seasonal estimate as fallback
  const tempPhase = ((dayOfYear - 105) / totalDays) * 2 * Math.PI;
  const estimatedTemp = Math.round(5.5 + 12 * Math.sin(tempPhase));
  const temp = window._weatherData?.temp ?? estimatedTemp;
  const tempPrefix = window._weatherData ? "" : "~";
  const monthTemps = [-5, -6, -2, 4, 10, 15, 18, 16, 11, 5, 0, -3];
  const tMin = -6,
    tMax = 18;
  const sparkChars = " ▁▂▃▄▅▆▇█";
  const sparkline = monthTemps
    .map((t) => {
      const idx = Math.round(
        ((t - tMin) / (tMax - tMin)) * (sparkChars.length - 1),
      );
      return sparkChars[Math.max(0, Math.min(sparkChars.length - 1, idx))];
    })
    .join("");
  const currentMonth = now.getMonth();
  const monthLabels = "JFMAMJJASOND";

  // Earth orbit — real calculation based on day of year
  const orbitDeg = Math.round((dayOfYear / totalDays) * 360);
  const orbitAngle = (dayOfYear / totalDays) * 2 * Math.PI - Math.PI / 2;
  // Season (Northern Hemisphere)
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

  // Build ASCII orbit with sun and earth glyphs
  // Ellipse: 19 wide, 7 tall
  const OW = 19,
    OH = 7;
  let orbitGrid = [];
  for (let y = 0; y < OH; y++) {
    let row = [];
    for (let x = 0; x < OW; x++) row.push(" ");
    orbitGrid.push(row);
  }
  // Draw orbit ellipse
  const cx = 9,
    cy = 3,
    rx = 8,
    ry = 3;
  for (let a = 0; a < 360; a += 4) {
    const rad = (a * Math.PI) / 180;
    const px = Math.round(cx + rx * Math.cos(rad));
    const py = Math.round(cy + ry * Math.sin(rad));
    if (px >= 0 && px < OW && py >= 0 && py < OH && orbitGrid[py][px] === " ") {
      orbitGrid[py][px] = "·";
    }
  }
  // Place sun at center
  orbitGrid[cy][cx] = "S";
  // Place earth on orbit
  const ex = Math.round(cx + rx * Math.cos(orbitAngle));
  const ey = Math.round(cy + ry * Math.sin(orbitAngle));
  if (ex >= 0 && ex < OW && ey >= 0 && ey < OH) {
    orbitGrid[ey][ex] = "E";
  }
  // Place moon orbiting earth
  const moonAngle = (dayOfYear / 29.53) * 2 * Math.PI;
  const mx = Math.max(
    0,
    Math.min(OW - 1, Math.round(ex + 2 * Math.cos(moonAngle))),
  );
  const my = Math.max(
    0,
    Math.min(OH - 1, Math.round(ey + 1 * Math.sin(moonAngle))),
  );
  if (orbitGrid[my][mx] === "·" || orbitGrid[my][mx] === " ") {
    orbitGrid[my][mx] = "o";
  }
  const orbitLines = orbitGrid.map((r) => r.join(""));

  // Session uptime — real
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

  // Real visitor info
  const screenRes = `${screen.width}×${screen.height}`;
  const viewportRes = `${window.innerWidth}×${window.innerHeight}`;
  const colorDepth = screen.colorDepth + "bit";
  const lang = navigator.language || "en";
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "unknown";
  const tzShort = tz.split("/").pop() || tz;
  const proto = location.protocol === "https:" ? "HTTPS" : "HTTP";
  const ua = navigator.userAgent;
  let browser = "unknown";
  if (ua.includes("Firefox")) browser = "Firefox";
  else if (ua.includes("Edg")) browser = "Edge";
  else if (ua.includes("Chrome")) browser = "Chrome";
  else if (ua.includes("Safari")) browser = "Safari";
  const platform = navigator.platform || "unknown";
  const online = navigator.onLine ? "online" : "offline";
  const cores = navigator.hardwareConcurrency || "?";

  // Category breakdown — real
  const cats = {};
  for (const item of sidebarItems) {
    cats[item.category] = (cats[item.category] || 0) + 1;
  }
  const catEntries = Object.entries(cats).sort((a, b) => b[1] - a[1]);
  const maxCat = catEntries.length ? catEntries[0][1] : 1;

  // ── Width constants ──
  const W = 48; // full-width (neofetch) — matches 2 × H
  const H = 24; // half-width (panels)

  // ── Helpers ──
  const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const fr = (s) => `<span class="sb-frame">${s}</span>`;
  const strip = (s) => s.replace(/<[^>]*>/g, "");
  const mkSep = (w) => fr("│") + " ".repeat(w - 2) + fr("│");
  const mkPad = (w, inner) => {
    const vis = strip(inner).length;
    const gap = Math.max(0, w - 4 - vis);
    return fr("│") + " " + inner + " ".repeat(gap) + " " + fr("│");
  };
  const sep = () => mkSep(W);
  const pad = (inner) => mkPad(W, inner);
  const hsep = () => mkSep(H);
  const hpad = (inner) => mkPad(H, inner);

  const SB_CAT_COLORS = {
    writing: "var(--cyan)",
    journalism: "var(--blue)",
    project: "var(--purple)",
  };

  // ═══════════════════════════════════════
  // NEOFETCH (full-width)
  // ═══════════════════════════════════════
  let NF = [];
  NF.push(fr("┌" + "─".repeat(W - 2) + "┐"));
  NF.push(sep());

  const info = [
    ["OS", `ariana-web <span class="sb-dim">2.0</span>`],
    [
      "Host",
      window._weatherData
        ? `${window._weatherData.city}, <span class="sb-val">${window._weatherData.country}</span>`
        : `Helsinki, <span class="sb-val">FI</span>`,
    ],
    [
      "Uptime",
      `<span class="sb-val" id="sb-uptime-val">${uptimeStr.padEnd(16)}</span>`,
    ],
    [
      "IP",
      `<span class="sb-val" id="sb-ip-val">${(window._visitorIP || "fetching…").padEnd(16)}</span>`,
    ],
    [
      "Theme",
      `<span id="sb-theme-val">${(THEMES.find((t) => t.id === getActiveTheme()) || THEMES[0]).name.toLowerCase()}</span> <span class="sb-dim">[dark]</span>`,
    ],
    [
      "Display",
      `<span class="sb-val">${screenRes}</span> <span class="sb-dim">${colorDepth}</span>`,
    ],
    ["Viewport", `<span class="sb-val">${viewportRes}</span>`],
    ["Cores", `<span class="sb-val">${cores}</span>`],
    ["Locale", `<span class="sb-val">${lang}</span>`],
    [
      "Browser",
      `<span class="sb-val">${browser}</span> <span class="sb-dim">${proto}</span>`,
    ],
  ];

  // Detect OS from UA
  const uaLower = ua.toLowerCase();
  let osName = "unknown";
  let osLogo = [];
  const LW = 16;
  const c = (color, text) => `<span style="color:${color}">${esc(text)}</span>`;

  if (uaLower.includes("android")) {
    osName = "Android";
    const g = "var(--cyan)";
    osLogo = [
      c(g, "  ;,           ,;"),
      c(g, "  ';,.-----.,;' "),
      c(g, "  ,'           ',"),
      c(g, "  /  ") +
        c("var(--white)", "O") +
        c(g, "       ") +
        c("var(--white)", "O") +
        c(g, "  \\"),
      c(g, "  |               |"),
      c(g, "  '-----------'   "),
    ];
  } else if (
    uaLower.includes("iphone") ||
    uaLower.includes("ipad") ||
    uaLower.includes("mac")
  ) {
    osName = "macOS";
    const g = "var(--cyan)";
    const y = "var(--yellow)";
    const r = "var(--red)";
    const m = "var(--purple)";
    const b = "var(--blue)";
    osLogo = [
      c(g, "        .:'     "),
      c(g, "    _ :'_       "),
      c(y, " .'`_`-'_``.    "),
      c(y, " :________.-'   "),
      c(r, " :_______:      "),
      c(m, " :_______:      "),
      c(m, "  :_______`-;   "),
      c(b, "   `._.-._.'    "),
    ];
  } else if (uaLower.includes("win")) {
    osName = "Windows";
    const b = "var(--blue)";
    osLogo = [
      c(b, "  ####  ####    "),
      c(b, "  ####  ####    "),
      c(b, "  ####  ####    "),
      c(b, "                "),
      c(b, "  ####  ####    "),
      c(b, "  ####  ####    "),
      c(b, "  ####  ####    "),
    ];
  } else if (uaLower.includes("linux") || uaLower.includes("x11")) {
    osName = "Linux";
    const w = "var(--white)";
    const y = "var(--yellow)";
    osLogo = [
      "      " + c(w, ".--.") + "      ",
      "     " +
        c(w, "|") +
        c(y, "o") +
        c(w, "_") +
        c(y, "o") +
        c(w, " |") +
        "     ",
      "     " + c(w, "|") + c(y, ":_/ ") + c(w, "|") + "     ",
      "    " + c(y, "//") + c(w, "   \\ \\") + "    ",
      "   " + c(y, "(|") + c(w, "     | )") + "   ",
      "  " + c(y, "/'\\") + c(w, "_   _/") + c(y, "`\\") + "  ",
      "  " + c(y, "\\___)") + c(w, "=(") + c(y, "___/") + "  ",
    ];
  } else {
    osName = "Web";
    const c1 = "var(--cyan)";
    osLogo = [
      c(c1, "     .---.      "),
      c(c1, "    /     \\     "),
      c(c1, "   | ") + c("var(--white)", "o   o") + c(c1, " |    "),
      c(c1, "   |  ") + c("var(--white)", " > ") + c(c1, "  |    "),
      c(c1, "    \\_____/     "),
    ];
  }

  // Normalize: pad each line to LW visible chars
  osLogo = osLogo.map((l) => {
    const vis = strip(l).length;
    if (vis >= LW) return l;
    return l + " ".repeat(LW - vis);
  });

  // Build neofetch: logo on left, info on right
  const infoLines = [
    `<span class="sb-nf-user">visitor</span><span class="sb-dim">@</span><span class="sb-nf-host">ariana</span>`,
    `<span class="sb-dim">${"─".repeat(20)}</span>`,
  ];
  for (const [key, val] of info) {
    infoLines.push(
      `<span class="sb-nf-key">${key.padEnd(8)}</span><span class="sb-dim">:</span> ${val}`,
    );
  }
  // Color palette row
  const colors = [
    "var(--cyan)",
    "var(--blue)",
    "var(--purple)",
    "var(--pink)",
    "var(--red)",
    "var(--amber)",
    "var(--yellow)",
    "var(--white)",
  ];
  infoLines.push("");
  infoLines.push(
    colors.map((c) => `<span style="color:${c}">██</span>`).join(""),
  );

  const maxNF = Math.max(osLogo.length, infoLines.length);
  for (let i = 0; i < maxNF; i++) {
    const logo = i < osLogo.length ? osLogo[i] : " ".repeat(LW);
    const inf = i < infoLines.length ? infoLines[i] : "";
    NF.push(pad(logo + " " + inf));
  }

  NF.push(sep());
  NF.push(fr("└" + "─".repeat(W - 2) + "┘"));

  const nfEl = document.createElement("div");
  nfEl.className = "sb-full";
  nfEl.innerHTML = NF.join("\n");
  sb.appendChild(nfEl);

  // ═══════════════════════════════════════
  // ROW 1: CLOCK + ORBIT
  // ═══════════════════════════════════════
  let CL = [];
  CL.push(fr("┌" + "─".repeat(H - 2) + "┐"));
  CL.push(hsep());
  CL.push(hpad(`<span class="sb-label">CLOCK</span>`));
  CL.push(hsep());
  CL.push(
    `<span id="sb-clock-line">${hpad(`<span class="sb-val">${timeStr}</span>`)}</span>`,
  );
  CL.push(hpad(`<span class="sb-dim">${dateStr}</span>`));
  const tempColor =
    temp > 15
      ? "var(--amber)"
      : temp > 5
        ? "var(--yellow)"
        : temp > -5
          ? "var(--blue)"
          : "var(--purple)";
  CL.push(
    `<span id="sb-temp-line">${hpad(`<span style="color:${tempColor}">${tempPrefix}${temp}°C</span> <span class="sb-dim">${esc(tzShort)}</span>`)}</span>`,
  );
  CL.push(hsep());
  CL.push(
    hpad(
      `<span class="sb-dim">day</span> <span class="sb-bar">${dayBar}</span> <span class="sb-val">${dayPct}%</span>`,
    ),
  );
  CL.push(
    hpad(
      `<span class="sb-dim">yr</span>  <span class="sb-val">${dayOfYear}</span><span class="sb-dim">/${totalDays}</span> <span class="sb-val">${yearPct}%</span>`,
    ),
  );
  CL.push(hsep());
  CL.push(fr("└" + "─".repeat(H - 2) + "┘"));

  let OR = [];
  OR.push(fr("┌" + "─".repeat(H - 2) + "┐"));
  OR.push(hsep());
  OR.push(
    hpad(
      `<span class="sb-label">ORBIT</span> <span class="sb-val">${orbitDeg}°</span> <span class="sb-dim">${season}</span>`,
    ),
  );
  OR.push(hsep());
  const orbitLinesHTML = [];
  for (const ol of orbitLines) {
    const colored = ol
      .replace("S", `<span class="sb-sun">*</span>`)
      .replace("E", `<span class="sb-earth">⊕</span>`)
      .replace("o", `<span class="sb-moon">o</span>`);
    orbitLinesHTML.push(hpad(colored));
  }
  // Push each orbit line individually so array length = visual line count
  OR.push(`<span id="sb-orbit-lines">${orbitLinesHTML[0]}`);
  for (let i = 1; i < orbitLinesHTML.length - 1; i++)
    OR.push(orbitLinesHTML[i]);
  OR.push(`${orbitLinesHTML[orbitLinesHTML.length - 1]}</span>`);
  OR.push(hsep());
  OR.push(fr("└" + "─".repeat(H - 2) + "┘"));

  // Equalize heights
  while (CL.length < OR.length) CL.splice(CL.length - 1, 0, hsep());
  while (OR.length < CL.length) OR.splice(OR.length - 1, 0, hsep());

  const row1 = document.createElement("div");
  row1.className = "sb-row";
  const clDiv = document.createElement("div");
  clDiv.className = "sb-half";
  clDiv.innerHTML = CL.join("\n");
  const orDiv = document.createElement("div");
  orDiv.className = "sb-half";
  orDiv.innerHTML = OR.join("\n");
  row1.appendChild(clDiv);
  row1.appendChild(orDiv);
  sb.appendChild(row1);

  // ═══════════════════════════════════════
  // ROW 2: ARCHIVE + TEMP
  // ═══════════════════════════════════════
  let AR = [];
  AR.push(fr("┌" + "─".repeat(H - 2) + "┐"));
  AR.push(hsep());
  AR.push(
    hpad(
      `<span class="sb-label">ARCHIVE</span> <span class="sb-val">${sidebarItems.length}</span>`,
    ),
  );
  AR.push(hsep());
  for (const [cat, count] of catEntries) {
    const barLen = Math.round((count / maxCat) * 6);
    const catCol = SB_CAT_COLORS[cat] || "var(--cyan)";
    const catBar = `<span style="color:${catCol}">${"█".repeat(barLen)}</span><span class="sb-dim">${"░".repeat(6 - barLen)}</span>`;
    AR.push(
      hpad(
        `<span style="color:${catCol}">${esc(cat).padEnd(8)}</span>${catBar} <span class="sb-val">${String(count).padStart(2)}</span>`,
      ),
    );
  }
  AR.push(hsep());
  AR.push(fr("└" + "─".repeat(H - 2) + "┘"));

  let TM = [];
  TM.push(fr("┌" + "─".repeat(H - 2) + "┐"));
  TM.push(hsep());
  // Use real climate data if available, else Helsinki defaults
  const cd = window._climateData;
  const tmTemps = cd ? cd.monthTemps : monthTemps;
  const tmMin = cd ? cd.tMin : tMin;
  const tmMax = cd ? cd.tMax : tMax;
  const tmAvg = cd
    ? cd.avg
    : Math.round(monthTemps.reduce((a, b) => a + b, 0) / monthTemps.length);
  const tmCity = cd ? cd.city : "Helsinki";
  const tmSparkChars = " ▁▂▃▄▅▆▇█";
  const tmSparkline = tmTemps
    .map((t) => {
      const idx = Math.round(
        ((t - tmMin) / Math.max(tmMax - tmMin, 1)) * (tmSparkChars.length - 1),
      );
      return tmSparkChars[Math.max(0, Math.min(tmSparkChars.length - 1, idx))];
    })
    .join("");
  TM.push(
    hpad(
      `<span class="sb-label">TEMP</span> <span class="sb-dim">${esc(tmCity)}</span>`,
    ),
  );
  TM.push(hsep());
  let coloredSparkline = "";
  for (let m = 0; m < 12; m++) {
    const t = tmTemps[m];
    const col =
      t > 15
        ? "var(--amber)"
        : t > 5
          ? "var(--yellow)"
          : t > -5
            ? "var(--cyan-dim)"
            : "var(--blue)";
    const highlight = m === currentMonth ? "font-weight:bold" : "";
    coloredSparkline += `<span style="color:${col};${highlight}">${tmSparkline[m]}</span>`;
  }
  TM.push(hpad(`<span class="sb-dim">${monthLabels}</span>`));
  TM.push(`<span id="sb-sparkline">${hpad(coloredSparkline)}</span>`);
  TM.push(
    hpad(
      `<span class="sb-dim">yr avg</span> <span class="sb-val">${tmAvg}°</span> <span class="sb-dim">${tmMin}°→${tmMax}°</span>`,
    ),
  );
  TM.push(hsep());
  TM.push(fr("└" + "─".repeat(H - 2) + "┘"));

  // Equalize heights
  while (AR.length < TM.length) AR.splice(AR.length - 1, 0, hsep());
  while (TM.length < AR.length) TM.splice(TM.length - 1, 0, hsep());

  const row2 = document.createElement("div");
  row2.className = "sb-row";
  const arDiv = document.createElement("div");
  arDiv.className = "sb-half";
  arDiv.innerHTML = AR.join("\n");
  const tmDiv = document.createElement("div");
  tmDiv.className = "sb-half";
  tmDiv.innerHTML = TM.join("\n");
  row2.appendChild(arDiv);
  row2.appendChild(tmDiv);
  sb.appendChild(row2);

  return sb;
}

// ── Live sidebar updates (clock + orbit animation) ──
function startSidebarUpdates(sb) {
  if (window._sidebarInterval) clearInterval(window._sidebarInterval);

  const W = 48;
  const H = 24;
  const LW = 16;
  const fr = (s) => `<span class="sb-frame">${s}</span>`;
  const strip = (s) => s.replace(/<[^>]*>/g, "");
  const mkPad = (w, inner) => {
    const vis = strip(inner).length;
    const gap = Math.max(0, w - 4 - vis);
    return fr("│") + " " + inner + " ".repeat(gap) + " " + fr("│");
  };
  const hpad = (inner) => mkPad(H, inner);
  const pad = (inner) => mkPad(W, inner);

  // Build a full neofetch info line (logo col + key: val) with correct padding
  // (Not needed — values are fixed-width padded in their spans)

  let orbitStep = 0;
  let tickCount = 0;

  window._sidebarInterval = setInterval(() => {
    tickCount++;

    // Refresh weather every 10 minutes
    if (tickCount % 600 === 0) fetchRealWeather();

    // Update uptime — value is padEnd(16) so line width stays constant
    const uptimeEl = sb.querySelector("#sb-uptime-val");
    if (uptimeEl) {
      const sec = Math.floor((Date.now() - startTime) / 1000);
      const h = Math.floor(sec / 3600);
      const m = Math.floor((sec % 3600) / 60);
      const s = sec % 60;
      const uptimeStr =
        h > 0 ? `${h}h ${m}m ${s}s` : m > 0 ? `${m}m ${s}s` : `${s}s`;
      uptimeEl.textContent = uptimeStr.padEnd(16);
    }

    // Update IP — value is padEnd(16) so line width stays constant
    if (window._visitorIP) {
      const ipEl = sb.querySelector("#sb-ip-val");
      if (ipEl && !ipEl._done) {
        ipEl.textContent = window._visitorIP.padEnd(16);
        ipEl._done = true;
      }
    }

    // Update clock
    const clockEl = sb.querySelector("#sb-clock-line");
    if (clockEl) {
      const now = new Date();
      const timeStr = now.toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        timeZone: "Europe/Helsinki",
      });
      clockEl.innerHTML = hpad(`<span class="sb-val">${timeStr}</span>`);
    }

    // Animate orbit — advance earth position
    orbitStep++;
    const orbitEl = sb.querySelector("#sb-orbit-lines");
    if (orbitEl) {
      const now = new Date();
      const startOfYear = new Date(now.getFullYear(), 0, 1);
      const dayOfYear = Math.floor((now - startOfYear) / 864e5) + 1;
      const totalDays = now.getFullYear() % 4 === 0 ? 366 : 365;
      // Base angle from real day + slow animated offset
      const baseAngle = (dayOfYear / totalDays) * 2 * Math.PI - Math.PI / 2;
      const animAngle = baseAngle + orbitStep * 0.05;

      const OW = 19,
        OH = 7;
      const cx = 9,
        cy = 3,
        rx = 8,
        ry = 3;
      let grid = [];
      for (let y = 0; y < OH; y++) {
        let row = [];
        for (let x = 0; x < OW; x++) row.push(" ");
        grid.push(row);
      }
      for (let a = 0; a < 360; a += 4) {
        const rad = (a * Math.PI) / 180;
        const px = Math.round(cx + rx * Math.cos(rad));
        const py = Math.round(cy + ry * Math.sin(rad));
        if (px >= 0 && px < OW && py >= 0 && py < OH && grid[py][px] === " ") {
          grid[py][px] = "·";
        }
      }
      grid[cy][cx] = "S";
      const ex = Math.round(cx + rx * Math.cos(animAngle));
      const ey = Math.round(cy + ry * Math.sin(animAngle));
      if (ex >= 0 && ex < OW && ey >= 0 && ey < OH) {
        grid[ey][ex] = "E";
      }
      // Moon orbiting earth — spins ~12× faster than earth
      const moonAngle = animAngle * 12;
      const mxPos = Math.max(
        0,
        Math.min(OW - 1, Math.round(ex + 2 * Math.cos(moonAngle))),
      );
      const myPos = Math.max(
        0,
        Math.min(OH - 1, Math.round(ey + 1 * Math.sin(moonAngle))),
      );
      if (grid[myPos][mxPos] === "·" || grid[myPos][mxPos] === " ") {
        grid[myPos][mxPos] = "o";
      }
      const lines = grid.map((r) => r.join(""));
      const html = lines
        .map((ol) => {
          const colored = ol
            .replace("S", `<span class="sb-sun">*</span>`)
            .replace("E", `<span class="sb-earth">⊕</span>`)
            .replace("o", `<span class="sb-moon">o</span>`);
          return hpad(colored);
        })
        .join("\n");
      orbitEl.innerHTML = html;
    }
  }, 1000);
}

// ── Render the full blog page ──────────────────
function renderNewspaper(heading) {
  if (!listEl) return;
  if (titleText)
    titleText.textContent = `visitor@ariana:~  [ ${selectedPost + 1} / ${listItems.length} ]`;
  listEl.innerHTML = "";

  // Wrapper: list left, sidebar right
  const wrap = document.createElement("div");
  wrap.className = "blog-wrap";

  // ── Article list (left column) ──
  const listPane = document.createElement("div");
  listPane.className = "blog-list-pane";

  // ASCII title — inside left column
  const titleArt = ASCII_TITLES[_currentTitleKey] || ASCII_TITLES.BLOG;
  const title = document.createElement("pre");
  title.className = "blog-title";
  title.textContent = titleArt.join("\n");
  listPane.appendChild(title);

  // Heading banner if filtered (e.g. "BLOG / WRITING")
  if (heading !== "BLOG" && heading !== "PROJECTS") {
    const hBanner = document.createElement("div");
    hBanner.className = "blog-filter-label";
    hBanner.textContent = `  ▸ ${heading}`;
    listPane.appendChild(hBanner);
  }

  const sep = document.createElement("div");
  sep.className = "blog-rule";
  sep.textContent = "─".repeat(48);
  listPane.appendChild(sep);

  for (let idx = 0; idx < listItems.length; idx++) {
    const item = listItems[idx];
    const cat = item.category;
    const isSelected = idx === selectedPost;

    const row = document.createElement("div");
    row.className = "elist-row" + (isSelected ? " active" : "");
    row.dataset.idx = idx;

    const cursor = isSelected ? "▸" : " ";
    const date = (item.date || "").slice(0, 10);
    const title = item.title || "—";
    const isRepo = item.isRepo ? " ↗" : "";
    const catLabel = (CAT_LABELS[cat] || cat || "").toLowerCase();
    const catCls = CAT_COLORS[cat] || "c-info";

    row.innerHTML =
      `<span class="elr-cursor">${cursor}</span>` +
      (item.image
        ? `<span class="elr-thumb" data-src="${item.image}"></span>`
        : `<span class="elr-thumb elr-thumb-empty"></span>`) +
      `<span class="elr-title">${title}${isRepo}</span>` +
      `<span class="elr-cat ${catCls}">${catLabel}</span>` +
      `<span class="elr-date">${date}</span>`;

    // Load ASCII art thumbnail asynchronously
    if (item.image && item.image.endsWith(".txt")) {
      const thumb = row.querySelector(".elr-thumb");
      fetch(item.image)
        .then((r) => (r.ok ? r.text() : null))
        .then((txt) => {
          if (txt && thumb) {
            const pre = document.createElement("pre");
            pre.className = "elr-thumb-art";
            pre.style.fontSize = "10px";
            pre.textContent = txt;
            thumb.appendChild(pre);
            // Scale to fit the thumbnail box after render
            requestAnimationFrame(() => {
              const natW = pre.scrollWidth;
              const natH = pre.scrollHeight;
              if (natW && natH) {
                const scale = Math.min(28 / natW, 20 / natH);
                pre.style.transform = `scale(${scale})`;
              }
            });
          }
        })
        .catch(() => {});
    }

    row.addEventListener("click", () => {
      selectedPost = idx;
      renderNewspaper(heading);
      openPost(item);
    });
    if (isSelected)
      setTimeout(
        () => row.scrollIntoView({ block: "nearest", behavior: "smooth" }),
        0,
      );
    listPane.appendChild(row);
  }

  const foot = document.createElement("div");
  foot.className = "blog-rule";
  foot.textContent = "─".repeat(48);
  listPane.appendChild(foot);

  const hint = document.createElement("div");
  hint.className = "elist-footer";
  hint.textContent = `${listItems.length} entries  ·  ↑↓ navigate  ·  Enter read  ·  ESC exit`;
  listPane.appendChild(hint);

  wrap.appendChild(listPane);

  // ── Sidebar ──
  wrap.appendChild(buildSidebar());

  listEl.appendChild(wrap);
}

// Alias for keyboard nav — calls renderNewspaper with stored heading
let _currentHeading = "BLOG";
let _currentTitleKey = "BLOG";
function renderList() {
  renderNewspaper(_currentHeading);
}

// parseFrontmatter is in js/shared.js

// ── Post-specific sidebar with nerdy stats ──────
function buildPostSidebar(post) {
  const md = post.content || "";
  const plainText = md
    .replace(/^#+\s.*/gm, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*_`~>#\-]/g, "")
    .trim();

  const words = plainText.split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const charCount = plainText.length;
  const charNoSpaces = plainText.replace(/\s/g, "").length;
  const sentences = plainText.split(/[.!?]+/).filter((s) => s.trim()).length;
  const paragraphs = md.split(/\n\s*\n/).filter((p) => p.trim()).length;
  const headings = (md.match(/^#{1,6}\s/gm) || []).length;
  const links = (md.match(/\[([^\]]+)\]\(/g) || []).length;
  const codeBlocks = (md.match(/`[^`]+`/g) || []).length;
  const readMin = Math.max(1, Math.ceil(wordCount / 238));
  const avgWordLen = wordCount ? (charNoSpaces / wordCount).toFixed(1) : "0";
  const avgSentLen = sentences ? Math.round(wordCount / sentences) : 0;

  // Lexical diversity (type-token ratio)
  const uniqueWords = new Set(words.map((w) => w.toLowerCase()));
  const lexDiv = wordCount
    ? ((uniqueWords.size / wordCount) * 100).toFixed(0)
    : "0";

  // Word frequency — top 5 longest common words
  const freq = {};
  for (const w of words) {
    const lw = w.toLowerCase().replace(/[^a-z]/g, "");
    if (lw.length > 3) freq[lw] = (freq[lw] || 0) + 1;
  }
  const topWords = Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  const topMax = topWords.length ? topWords[0][1] : 1;

  const sb = document.createElement("div");
  sb.className = "blog-sidebar post-sidebar";

  // ── Same dimensions as main sidebar ──
  const W = 48; // full-width
  const H = 24; // half-width (matches main sidebar exactly)

  const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const fr = (s) => `<span class="sb-frame">${s}</span>`;
  const strip = (s) => s.replace(/<[^>]*>/g, "");
  const mkSep = (w) => fr("│") + " ".repeat(w - 2) + fr("│");
  const mkPad = (w, inner) => {
    const vis = strip(inner).length;
    const gap = Math.max(0, w - 4 - vis);
    return fr("│") + " " + inner + " ".repeat(gap) + " " + fr("│");
  };
  const sep = () => mkSep(W);
  const pad = (inner) => mkPad(W, inner);
  const hsep = () => mkSep(H);
  const hpad = (inner) => mkPad(H, inner);

  // ═══════════════════════════════════════
  // FULL-WIDTH: POST OVERVIEW
  // ═══════════════════════════════════════
  let OV = [];
  OV.push(fr("┌" + "─".repeat(W - 2) + "┐"));
  OV.push(sep());
  OV.push(pad(`<span class="sb-label">POST</span>`));
  OV.push(sep());
  OV.push(
    pad(
      `<span class="sb-val">${wordCount.toLocaleString()}</span> <span class="sb-dim">words</span>  ·  <span class="sb-val">~${readMin} min</span> <span class="sb-dim">read</span>`,
    ),
  );
  OV.push(
    pad(
      `<span class="sb-val">${charCount.toLocaleString()}</span> <span class="sb-dim">chars</span>  ·  <span class="sb-val">${charNoSpaces.toLocaleString()}</span> <span class="sb-dim">no-space</span>`,
    ),
  );
  OV.push(sep());

  // Reading progress bar (full-width)
  OV.push(pad(`<span class="sb-label">PROGRESS</span>`));
  OV.push(sep());
  OV.push(
    `<span id="sb-read-progress">${pad(`<span class="sb-bar">░░░░░░░░░░░░░░░░░░░░</span> <span class="sb-val"> 0%</span>`)}</span>`,
  );
  OV.push(sep());
  OV.push(fr("└" + "─".repeat(W - 2) + "┘"));

  const ovEl = document.createElement("div");
  ovEl.className = "sb-full";
  ovEl.innerHTML = OV.join("\n");
  sb.appendChild(ovEl);

  // ═══════════════════════════════════════
  // ROW 1: STRUCTURE + LEXICON
  // ═══════════════════════════════════════
  let ST = [];
  ST.push(fr("┌" + "─".repeat(H - 2) + "┐"));
  ST.push(hsep());
  ST.push(hpad(`<span class="sb-label">STRUCTURE</span>`));
  ST.push(hsep());
  ST.push(
    hpad(
      `<span class="sb-dim">¶ paras</span>  <span class="sb-val">${paragraphs}</span>`,
    ),
  );
  ST.push(
    hpad(
      `<span class="sb-dim">§ heads</span>  <span class="sb-val">${headings}</span>`,
    ),
  );
  ST.push(
    hpad(
      `<span class="sb-dim">. sents</span>  <span class="sb-val">${sentences}</span>`,
    ),
  );
  ST.push(
    hpad(
      `<span class="sb-dim">~ links</span>  <span class="sb-val">${links}</span>`,
    ),
  );
  ST.push(
    hpad(
      `<span class="sb-dim">\` code</span>   <span class="sb-val">${codeBlocks}</span>`,
    ),
  );
  ST.push(hsep());
  ST.push(fr("└" + "─".repeat(H - 2) + "┘"));

  let LX = [];
  LX.push(fr("┌" + "─".repeat(H - 2) + "┐"));
  LX.push(hsep());
  LX.push(hpad(`<span class="sb-label">LEXICON</span>`));
  LX.push(hsep());
  LX.push(
    hpad(
      `<span class="sb-dim">avg word</span> <span class="sb-val">${avgWordLen} ch</span>`,
    ),
  );
  LX.push(
    hpad(
      `<span class="sb-dim">avg sent</span> <span class="sb-val">${avgSentLen} w</span>`,
    ),
  );
  LX.push(
    hpad(
      `<span class="sb-dim">unique</span>   <span class="sb-val">${uniqueWords.size.toLocaleString()}</span>`,
    ),
  );
  LX.push(
    hpad(
      `<span class="sb-dim">diversity</span><span class="sb-val">${lexDiv}%</span>`,
    ),
  );
  LX.push(hsep());
  LX.push(fr("└" + "─".repeat(H - 2) + "┘"));

  // Equalize heights
  while (ST.length < LX.length) ST.splice(ST.length - 1, 0, hsep());
  while (LX.length < ST.length) LX.splice(LX.length - 1, 0, hsep());

  const row1 = document.createElement("div");
  row1.className = "sb-row";
  const stDiv = document.createElement("div");
  stDiv.className = "sb-half";
  stDiv.innerHTML = ST.join("\n");
  const lxDiv = document.createElement("div");
  lxDiv.className = "sb-half";
  lxDiv.innerHTML = LX.join("\n");
  row1.appendChild(stDiv);
  row1.appendChild(lxDiv);
  sb.appendChild(row1);

  // ═══════════════════════════════════════
  // ROW 2: META + TOP WORDS
  // ═══════════════════════════════════════
  let MT = [];
  MT.push(fr("┌" + "─".repeat(H - 2) + "┐"));
  MT.push(hsep());
  MT.push(hpad(`<span class="sb-label">META</span>`));
  MT.push(hsep());
  if (post.category) {
    const catCol =
      {
        writing: "var(--cyan)",
        journalism: "var(--blue)",
        project: "var(--purple)",
      }[post.category] || "var(--cyan)";
    MT.push(
      hpad(
        `<span class="sb-dim">cat</span>  <span style="color:${catCol}">${esc(post.category)}</span>`,
      ),
    );
  }
  if (post.date)
    MT.push(
      hpad(
        `<span class="sb-dim">date</span> <span class="sb-val">${post.date.slice(0, 10)}</span>`,
      ),
    );
  if (post.tags && post.tags.length) {
    const tagsArr = Array.isArray(post.tags) ? post.tags : [post.tags];
    for (const t of tagsArr) {
      MT.push(
        hpad(
          `<span class="sb-dim">tag</span>  <span style="color:var(--purple)">${esc(t)}</span>`,
        ),
      );
    }
  }
  MT.push(hsep());
  MT.push(fr("└" + "─".repeat(H - 2) + "┘"));

  let TW = [];
  TW.push(fr("┌" + "─".repeat(H - 2) + "┐"));
  TW.push(hsep());
  TW.push(hpad(`<span class="sb-label">TOP WORDS</span>`));
  TW.push(hsep());
  for (const [w, n] of topWords) {
    const barLen = Math.round((n / topMax) * 6);
    const twBar = `<span class="sb-bar">${"█".repeat(barLen)}</span><span class="sb-dim">${"░".repeat(6 - barLen)}</span>`;
    TW.push(
      hpad(
        `<span class="sb-val">${esc(w).padEnd(8)}</span>${twBar} <span class="sb-val">${String(n).padStart(2)}</span>`,
      ),
    );
  }
  TW.push(hsep());
  TW.push(fr("└" + "─".repeat(H - 2) + "┘"));

  // Equalize heights
  while (MT.length < TW.length) MT.splice(MT.length - 1, 0, hsep());
  while (TW.length < MT.length) TW.splice(TW.length - 1, 0, hsep());

  const row2 = document.createElement("div");
  row2.className = "sb-row";
  const mtDiv = document.createElement("div");
  mtDiv.className = "sb-half";
  mtDiv.innerHTML = MT.join("\n");
  const twDiv = document.createElement("div");
  twDiv.className = "sb-half";
  twDiv.innerHTML = TW.join("\n");
  row2.appendChild(mtDiv);
  row2.appendChild(twDiv);
  sb.appendChild(row2);

  return sb;
}

// ── Update reading progress on scroll ──
function startPostProgressUpdates(postSb) {
  const W = 48;
  const fr = (s) => `<span class="sb-frame">${s}</span>`;
  const strip = (s) => s.replace(/<[^>]*>/g, "");
  const pad = (inner) => {
    const vis = strip(inner).length;
    const gap = Math.max(0, W - 4 - vis);
    return fr("│") + " " + inner + " ".repeat(gap) + " " + fr("│");
  };

  function update() {
    const el = document.getElementById("sb-read-progress");
    if (!el) return;
    const scrollTop = terminal.scrollTop;
    const scrollHeight = terminal.scrollHeight - terminal.clientHeight;
    const pct =
      scrollHeight > 0 ? Math.round((scrollTop / scrollHeight) * 100) : 0;
    const fill = Math.round(pct / 5);
    const bar = "█".repeat(fill) + "░".repeat(20 - fill);
    el.innerHTML = pad(
      `<span class="sb-bar">${bar}</span> <span class="sb-val">${String(pct).padStart(3)}%</span>`,
    );
  }

  terminal.addEventListener("scroll", update);
  // Store cleanup ref on window
  window._postScrollHandler = update;
}

// ─────────────────────────────────────────────
// Render a post (content pre-loaded in loadContent)
// ─────────────────────────────────────────────
function openPost(post, _skipPush) {
  if (post.isRepo) {
    printLine("↗ " + post.title + "  —  opening on GitHub…", "c-info");
    window.open(post.url, "_blank");
    return;
  }
  blogMode = false;
  clearOutput(); // resets readerMode; set it back below
  readerMode = true;
  if (!_skipPush && post.category && post.slug) {
    pushRoute("/" + post.category + "/" + post.slug);
  }
  if (sbMode) sbMode.textContent = "READING";
  if (sbStatus) sbStatus.textContent = post.title || "";
  if (titleText && listItems.length) {
    titleText.textContent = `visitor@ariana:~  [ ${selectedPost + 1} / ${listItems.length} ]`;
  }
  if (!post.content) {
    printLine(`  ✗ content not available for: ${post.slug}`, "c-error");
    return;
  }

  // ── Two-column layout: post content + post stats sidebar ──
  renderMarkdown(post.content, post);

  // Collect all rendered elements and move them into a two-column wrap
  const postWrap = document.createElement("div");
  postWrap.className = "blog-wrap post-wrap";

  const postMain = document.createElement("div");
  postMain.className = "blog-list-pane";

  // Move all children from output into postMain
  while (output.firstChild) {
    postMain.appendChild(output.firstChild);
  }

  // Add hint line inside post column
  const hintDiv = document.createElement("div");
  hintDiv.className = "c-dim";
  hintDiv.style.lineHeight = "1.75";
  hintDiv.style.minHeight = "1.5em";
  hintDiv.style.whiteSpace = "pre-wrap";
  hintDiv.textContent =
    "  ↑↓ prev/next  ·  type 'blog' for list  ·  'home' to go back";
  postMain.appendChild(hintDiv);

  postWrap.appendChild(postMain);

  // Post stats sidebar
  const postSb = buildPostSidebar(post);
  postWrap.appendChild(postSb);

  output.appendChild(postWrap);

  // Start scroll progress tracking
  startPostProgressUpdates(postSb);

  printBlank();
  // Scroll to top of post, not bottom
  terminal.scrollTop = 0;
}

// ─────────────────────────────────────────────
// Inline markdown → safe HTML spans
// ─────────────────────────────────────────────
function inlineMarkdown(text) {
  // Escape any existing HTML entities first
  text = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  // inline code: `code`
  text = text.replace(/`([^`]+)`/g, '<span class="post-code">$1</span>');
  // bold: **text**
  text = text.replace(
    /\*\*([^*]+)\*\*/g,
    '<span class="c-yellow" style="font-weight:600">$1</span>',
  );
  // italic: *text* (not preceded/followed by another *)
  text = text.replace(
    /(?<!\*)\*(?!\*)([^*]+)(?<!\*)\*(?!\*)/g,
    '<span class="c-info">$1</span>',
  );
  // inline images: ![alt](url) — must come before link regex
  text = text.replace(
    /!\[([^\]]*)\]\(([^)]+)\)/g,
    '<img class="post-inline-img" src="$2" alt="$1">',
  );
  // links: [text](url)
  text = text.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a class="post-link" href="$2" target="_blank" rel="noopener">$1</a>',
  );
  return text;
}

// ─────────────────────────────────────────────
// Generic ASCII art colorizer — theme-aware
// Maps character density to CSS color variables
// ─────────────────────────────────────────────
function _colorizeAsciiArt(txt) {
  // Group characters by visual "weight" → theme color
  const light = new Set(" .·\u00B7");
  const mid = new Set("-~:;,`'");
  const heavy = new Set("+=#%&@*^");
  // Letters: A-M = mid-heavy, N-Z = heavy
  return txt
    .split("\n")
    .map((line) => {
      let html = "",
        cur = null;
      for (const ch of line) {
        let c;
        if (light.has(ch)) c = "var(--grey-dim)";
        else if (mid.has(ch)) c = "var(--grey)";
        else if (heavy.has(ch)) c = "var(--cyan)";
        else if (/[a-mA-M]/.test(ch)) c = "var(--cyan-dim)";
        else if (/[n-zN-Z]/.test(ch)) c = "var(--cyan)";
        else if (/[0-9]/.test(ch)) c = "var(--purple)";
        else c = "var(--grey)";
        if (c !== cur) {
          if (cur) html += "</span>";
          html += `<span style="color:${c}">`;
          cur = c;
        }
        html += light.has(ch) ? "·" : ch;
      }
      if (cur) html += "</span>";
      return html;
    })
    .join("\n");
}

// Fetch a .txt file and render as themed ASCII art into a container element
function _renderAsciiArtInto(container, src) {
  container.textContent = "loading…";
  fetch(src)
    .then((r) => (r.ok ? r.text() : Promise.reject()))
    .then((txt) => {
      container.textContent = "";
      container.innerHTML = _colorizeAsciiArt(txt);
      // Auto-fit font size only for body art, not header cover
      if (container.classList.contains("post-ascii-art")) {
        _fitAsciiArt(container, txt);
      }
    })
    .catch(() => {
      container.textContent = "[ascii art not found]";
    });
}

// Scale ASCII art font-size so the widest line fills the container
function _fitAsciiArt(el, txt) {
  const lines = txt.split("\n");
  const maxCols = Math.max(...lines.map((l) => l.length));
  if (!maxCols) return;
  // Measure with a probe span at 10px to get char width ratio
  const probe = document.createElement("span");
  probe.style.cssText =
    "position:absolute;visibility:hidden;white-space:pre;font-family:" +
    getComputedStyle(el).fontFamily +
    ";font-size:10px";
  probe.textContent = "M";
  document.body.appendChild(probe);
  const charW = probe.getBoundingClientRect().width;
  document.body.removeChild(probe);
  // Container width
  const containerW = el.parentElement
    ? el.parentElement.getBoundingClientRect().width
    : el.getBoundingClientRect().width;
  if (!containerW || !charW) return;
  // fontSize = containerW / (maxCols * charWidthPerPx)
  const fontSize = containerW / (maxCols * (charW / 10));
  el.style.fontSize = Math.min(fontSize, 14) + "px";
}

// ─────────────────────────────────────────────
// Markdown renderer — blog post style
// ─────────────────────────────────────────────
function renderMarkdown(md, post) {
  let isFirstPara = true;

  let _revealIdx = 0;

  function appendEl(cls, html) {
    const div = document.createElement("div");
    if (cls) div.className = cls + " term-reveal";
    else div.className = "term-reveal";
    div.style.animationDelay = _revealIdx * 25 + "ms";
    _revealIdx++;
    div.innerHTML = html;
    output.appendChild(div);
  }

  function flushPara(buf) {
    if (!buf.length) return;
    const cls = isFirstPara ? "post-para drop-cap" : "post-para";
    appendEl(cls, inlineMarkdown(buf.join(" ")));
    isFirstPara = false;
  }

  printBlank();

  // ── Breadcrumb path with file icons ──
  const category = post.category || "blog";
  const crumb = document.createElement("div");
  crumb.className = "post-breadcrumb term-reveal";
  crumb.style.animationDelay = _revealIdx * 25 + "ms";
  _revealIdx++;
  crumb.innerHTML =
    '<span class="bc-seg">blog</span>' +
    ' <span class="bc-seg">/</span> ' +
    '<span class="bc-seg">' +
    category +
    "</span>";
  output.appendChild(crumb);

  // ── Post header card — date on top, no left border ──
  const headerBox = document.createElement("div");
  headerBox.className = "post-header-box term-reveal";
  headerBox.style.animationDelay = _revealIdx * 25 + "ms";
  _revealIdx++;

  // Set label from first tag, fallback to "POST"
  const tagsArr = Array.isArray(post.tags)
    ? post.tags
    : post.tags
      ? [post.tags]
      : [];
  const labelTag = tagsArr.length ? tagsArr[0].toUpperCase() : "POST";
  headerBox.setAttribute("data-label", `[ ${labelTag} ]`);

  // ── Header text column (left) ──
  const headerText = document.createElement("div");
  headerText.className = "post-header-text";

  const titleEl = document.createElement("div");
  titleEl.className = "post-header-title";
  titleEl.textContent = post.title || "";
  headerText.appendChild(titleEl);

  if (post.description) {
    const descEl = document.createElement("div");
    descEl.className = "post-header-desc";
    descEl.textContent = post.description;
    headerText.appendChild(descEl);
  }
  headerBox.appendChild(headerText);

  // ── Cover art (right) ──
  if (post.image) {
    if (post.image.endsWith(".txt")) {
      const artPre = document.createElement("pre");
      artPre.className = "post-header-ascii";
      headerBox.appendChild(artPre);
      _renderAsciiArtInto(artPre, post.image);
    } else {
      const img = document.createElement("img");
      img.className = "post-header-img";
      img.src = post.image;
      img.alt = post.title || "";
      headerBox.appendChild(img);
    }
  }
  output.appendChild(headerBox);

  printBlank();

  // ── Normalize title for h1 de-duplication ──
  const normTitle = (post.title || "").trim().toLowerCase();

  const lines = md.split("\n");
  let paraBuf = [];

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];

    if (raw.startsWith("# ")) {
      flushPara(paraBuf);
      paraBuf = [];
      // Skip h1 if it matches the post title (already in header card)
      const h1Text = raw.slice(2).trim().toLowerCase();
      if (h1Text === normTitle) continue;
      printBlank();
      appendEl("c-header", inlineMarkdown(raw.slice(2)));
      printBlank();
    } else if (raw.startsWith("## ")) {
      flushPara(paraBuf);
      paraBuf = [];
      printBlank();
      appendEl("c-sub", inlineMarkdown(raw.slice(3)));
    } else if (raw.startsWith("### ")) {
      flushPara(paraBuf);
      paraBuf = [];
      appendEl("c-blue", inlineMarkdown(raw.slice(4)));
    } else if (raw.startsWith("> ")) {
      flushPara(paraBuf);
      paraBuf = [];
      const bqDiv = document.createElement("div");
      bqDiv.className = "post-blockquote";
      bqDiv.innerHTML =
        '<span class="c-dim">  \u2502 </span>' +
        '<span class="c-info">' +
        inlineMarkdown(raw.slice(2)) +
        "</span>";
      output.appendChild(bqDiv);
    } else if (raw.match(/^[\-\*\+] /)) {
      flushPara(paraBuf);
      paraBuf = [];
      appendEl(
        "c-white",
        '  <span class="c-green">▸</span> ' + inlineMarkdown(raw.slice(2)),
      );
    } else if (raw.match(/^\d+\. /)) {
      flushPara(paraBuf);
      paraBuf = [];
      const num = raw.match(/^\d+/)[0];
      appendEl(
        "c-white",
        '  <span class="c-dim">' +
          num +
          ".</span> " +
          inlineMarkdown(raw.replace(/^\d+\. /, "")),
      );
    } else if (/^!\[([^\]]*)\]\(([^)]+)\)\s*$/.test(raw.trim())) {
      // Block-level image: ![alt](url)
      flushPara(paraBuf);
      paraBuf = [];
      const imgMatch = raw.trim().match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
      const imgAlt = imgMatch[1];
      const imgSrc = imgMatch[2];
      if (imgSrc.endsWith(".txt")) {
        const artPre = document.createElement("pre");
        artPre.className = "post-ascii-art term-reveal";
        artPre.style.animationDelay = _revealIdx * 25 + "ms";
        _revealIdx++;
        output.appendChild(artPre);
        _renderAsciiArtInto(artPre, imgSrc);
      } else {
        const imgDiv = document.createElement("div");
        imgDiv.className = "post-image term-reveal";
        imgDiv.style.animationDelay = _revealIdx * 25 + "ms";
        _revealIdx++;
        imgDiv.innerHTML = `<img src="${imgSrc}" alt="${imgAlt}">`;
        output.appendChild(imgDiv);
      }
    } else if (
      raw.match(/^[-*_]{3,}$/) &&
      raw
        .trim()
        .split("")
        .every((c) => c === raw.trim()[0])
    ) {
      flushPara(paraBuf);
      paraBuf = [];
      appendEl("post-divider", "─".repeat(48));
    } else if (raw.trim() === "") {
      flushPara(paraBuf);
      paraBuf = [];
      printBlank();
    } else {
      paraBuf.push(raw);
    }
  }
  flushPara(paraBuf);
}

// ─────────────────────────────────────────────
// Home screen
// ─────────────────────────────────────────────
function printHTML(html, cls = "") {
  const div = document.createElement("div");
  if (cls) div.className = cls;
  div.innerHTML = html;
  output.appendChild(div);
  terminal.scrollTop = terminal.scrollHeight;
}

function printHome() {
  printBlank();

  // ── Two-column layout: left (hero + commands), right (sidebar) ──
  const homeWrap = document.createElement("div");
  homeWrap.className = "home-wrap";

  const homeMain = document.createElement("div");
  homeMain.className = "home-main";

  // ── Earth + Name hero section (side by side) ──
  const hero = document.createElement("div");
  hero.className = "home-hero";

  // Earth globe (animated)
  const earthPre = document.createElement("pre");
  earthPre.className = "earth-globe";
  earthPre.textContent = EARTH_FRAMES[0].join("\n");
  hero.appendChild(earthPre);

  // Right side: name + subtitle
  const info = document.createElement("div");
  info.className = "home-hero-info";

  const banner = [
    "   ▄▀▄ █▀▄ █ ▄▀▄ █▄ █ ▄▀▄   █ █ █▀▀ █▄▀ █▀▄ ▄▀▄ █▄ █ ▄▀▀ █",
    "   █▀█ █▀▄ █ █▀█ █ ▀█ █▀█   ▀▄▀ █▀▀ █ █ █▀▄ █▀█ █ ▀█ █ █ █",
    "   ▀ ▀ ▀ ▀ ▀ ▀ ▀ ▀  ▀ ▀ ▀    ▀  ▀▀▀ ▀ ▀ ▀ ▀ ▀ ▀ ▀  ▀ ▀▀▀ ▀",
  ];
  const bannerPre = document.createElement("pre");
  bannerPre.className = "ascii-glow";
  bannerPre.textContent = banner.join("\n");
  info.appendChild(bannerPre);

  const sub = document.createElement("pre");
  sub.className = "c-dim";
  sub.textContent = "   journalist · editor · builder";
  info.appendChild(sub);

  hero.appendChild(info);
  homeMain.appendChild(hero);

  // Build sidebar with live-updating references
  const sb = buildSidebar(ALL);
  homeWrap.appendChild(homeMain);
  homeWrap.appendChild(sb);
  output.appendChild(homeWrap);

  // Start earth animation
  let earthFrame = 0;
  const earthInterval = setInterval(() => {
    earthFrame = (earthFrame + 1) % EARTH_FRAMES.length;
    earthPre.textContent = EARTH_FRAMES[earthFrame].join("\n");
  }, 250);
  window._earthInterval = earthInterval;

  // Start sidebar live updates (clock tick + orbit animation)
  startSidebarUpdates(sb);

  const lines = [
    ["", ""],
    ["  Welcome. This is my personal site — a space for writing,", "c-white"],
    ["  journalism and projects I build in the quiet hours.", "c-white"],
    ["", ""],
    ["   ┌────────────────────────────────────────────────┐", "c-dim"],
    ["", ""],
  ];

  const cmds = [
    ["blog", "writing & journalism"],
    ["projects", "projects & repos"],
    ["whoami", "a bit more about me"],
    ["fortune", "wisdom from the machine"],
    ["config", "theme & font settings"],
    ["cmatrix", "digital rain screensaver"],
    ["gui", "switch to desktop mode"],
    ["help", "all commands"],
  ];

  for (const [name, desc] of cmds) {
    lines.push([
      `   <span class="c-dim">│</span>  <span class="hc-name">${name.padEnd(12)}</span> <span class="hc-arrow">→</span>  <span class="hc-desc">${desc}</span>`,
      "home-cmd-line",
    ]);
  }

  lines.push(["", ""]);
  lines.push([
    "   └────────────────────────────────────────────────┘",
    "c-dim",
  ]);
  lines.push(["", ""]);
  lines.push([
    "   ░▒▓ type a command and press Enter to navigate ▓▒░",
    "c-info",
  ]);

  let i = 0;
  function next() {
    if (i >= lines.length) return;
    const [text, cls] = lines[i];
    const div = document.createElement("div");
    if (cls) div.className = cls;
    if (cls === "home-cmd-line") {
      div.innerHTML = text;
    } else {
      div.textContent = text;
      if (!text) {
        div.className = "spacer";
      }
    }
    homeMain.appendChild(div);
    i++;
    setTimeout(next, 35);
  }
  next();
}

// ─────────────────────────────────────────────
// ASCII portrait colorizer
// ─────────────────────────────────────────────
function _colorizeAsciiPortrait(txt) {
  const colors = {
    " ": "var(--grey-dim)",
    "-": "var(--grey-dim)",
    ":": "var(--grey)",
    ".": "var(--grey)",
    "+": "var(--cyan-dim)",
    "=": "var(--cyan-dim)",
    "*": "var(--purple)",
    "#": "var(--purple)",
    "%": "var(--cyan)",
    "&": "var(--cyan)",
    "@": "var(--white)",
  };
  const bg = new Set([" ", "-"]);

  return txt
    .split("\n")
    .map((line) => {
      let html = "",
        cur = null;
      for (const ch of line) {
        const c = colors[ch] || "var(--grey-dim)";
        if (c !== cur) {
          if (cur) html += "</span>";
          html += `<span style="color:${c}">`;
          cur = c;
        }
        html += bg.has(ch) ? "·" : ch;
      }
      if (cur) html += "</span>";
      return html;
    })
    .join("\n");
}

// ─────────────────────────────────────────────
// Command registry
// ─────────────────────────────────────────────
const commands = {
  help: {
    description: "Show available commands",
    execute() {
      printLine(
        "   ┌────────────────────────────────────────────────┐",
        "c-dim",
      );
      printBlank();

      const helpCmds = [
        ["blog", "writing & journalism"],
        ["blog [category]", "filter by category"],
        ["projects", "projects & repos"],
        ["ls", "quick text listing by category"],
        ["about / whoami", "about me"],
      ];
      printLine("   │  Content", "c-dim");
      for (const [n, d] of helpCmds) {
        printHTML(
          `   <span class="c-dim">│</span>  <span class="hc-name">${n.padEnd(16)}</span> <span class="hc-arrow">→</span>  <span class="hc-desc">${d}</span>`,
          "home-cmd-line",
        );
      }
      printBlank();

      const termCmds = [
        ["home / exit", "return home"],
        ["gui", "switch to desktop (XP) mode"],
        ["config", "terminal settings — theme & font"],
        ["clear", "clear screen"],
        ["cmatrix", "digital rain screensaver"],
        ["fortune", "wisdom from the machine"],
      ];
      printLine("   │  Terminal", "c-dim");
      for (const [n, d] of termCmds) {
        printHTML(
          `   <span class="c-dim">│</span>  <span class="hc-name">${n.padEnd(16)}</span> <span class="hc-arrow">→</span>  <span class="hc-desc">${d}</span>`,
          "home-cmd-line",
        );
      }
      printBlank();

      const keyCmds = [
        ["Tab", "autocomplete"],
        ["↑ ↓", "scroll / history / list nav"],
        ["← →", "prev / next post"],
        ["Enter", "open selected item"],
        ["ESC", "exit list mode"],
      ];
      printLine("   │  Keys", "c-dim");
      for (const [n, d] of keyCmds) {
        printHTML(
          `   <span class="c-dim">│</span>  <span class="hc-name">${n.padEnd(16)}</span> <span class="hc-arrow">→</span>  <span class="hc-desc">${d}</span>`,
          "home-cmd-line",
        );
      }
      printBlank();
      printLine(
        "   └────────────────────────────────────────────────┘",
        "c-dim",
      );
      printBlank();
    },
  },

  cheatsheet: {
    description: "Full command reference",
    execute() {
      commands.help.execute();
    },
  },

  blog: {
    description: "Browse writing & journalism",
    execute(args) {
      clearOutput();
      const blogItems = ALL.filter((p) => !p.isRepo);
      let items = byDate(blogItems);
      let heading = "BLOG";
      if (args) {
        const cat = args.toLowerCase().trim();
        const filtered = blogItems.filter((p) => p.category === cat);
        if (filtered.length) {
          items = byDate(filtered);
          heading = "BLOG / " + cat.toUpperCase();
          pushRoute("/blog/" + cat);
        } else {
          printLine(`no entries found for category: ${cat}`, "c-error");
          const cats = [
            ...new Set(blogItems.map((p) => p.category).filter(Boolean)),
          ];
          printLine(`available: ${cats.join(", ")}`, "c-info");
          return;
        }
      } else {
        pushRoute("/blog");
      }
      showList(items, heading, "BLOG");
    },
  },

  projects: {
    description: "Browse projects & repos",
    execute() {
      clearOutput();
      pushRoute("/blog/projects");
      const items = ALL.filter((p) => p.category === "project" || p.isRepo);
      showList(byDate(items), "PROJECTS", "PROJECTS");
    },
  },

  about: {
    description: "About me",
    execute() {
      clearOutput();
      pushRoute("/about");
      printBlank();

      const aboutWrap = document.createElement("div");
      aboutWrap.className = "home-wrap";
      const aboutMain = document.createElement("div");
      aboutMain.className = "home-main";

      // ── helpers ──
      const el = (tag, cls, text) => {
        const e = document.createElement(tag);
        if (cls) e.className = cls;
        if (text != null) e.textContent = text;
        return e;
      };
      const htmlDiv = (cls, html) => {
        const d = document.createElement("div");
        if (cls) d.className = cls;
        d.innerHTML = html;
        return d;
      };

      // ── Name banner ──
      const bannerPre = el(
        "pre",
        "ascii-glow",
        "   ▄▀▄ █▀▄ █ ▄▀▄ █▄ █ ▄▀▄   █ █ █▀▀ █▄▀ █▀▄ ▄▀▄ █▄ █ ▄▀▀ █\n" +
          "   █▀█ █▀▄ █ █▀█ █ ▀█ █▀█   ▀▄▀ █▀▀ █ █ █▀▄ █▀█ █ ▀█ █ █ █\n" +
          "   ▀ ▀ ▀ ▀ ▀ ▀ ▀ ▀  ▀ ▀ ▀    ▀  ▀▀▀ ▀ ▀ ▀ ▀ ▀ ▀ ▀  ▀ ▀▀▀ ▀",
      );
      aboutMain.appendChild(bannerPre);
      aboutMain.appendChild(
        el("pre", "c-dim", "   journalist · editor · builder"),
      );
      aboutMain.appendChild(el("div", "spacer"));

      // ── Portrait + interests/contact ──
      const bottom = el("div", "about-bottom");

      const portraitPre = el("pre", "about-portrait", "loading...");
      bottom.appendChild(portraitPre);

      const info = el("div", "about-bottom-info");

      info.appendChild(el("div", "c-info", "── INTERESTS ──"));
      ["Human rights", "International law", "Computational journalism"].forEach(
        (t) =>
          info.appendChild(
            htmlDiv(
              null,
              `<span class="c-green">▸</span>  <span class="c-white">${t}</span>`,
            ),
          ),
      );
      info.appendChild(el("div", "spacer"));
      info.appendChild(el("div", "c-info", "── CONTACT ──"));
      ["yekrangiariana@gmail.com", "github.com/arianayekrangi"].forEach((t) =>
        info.appendChild(
          htmlDiv(
            null,
            `<span class="c-green">▸</span>  <span class="c-white">${t}</span>`,
          ),
        ),
      );

      bottom.appendChild(info);
      aboutMain.appendChild(bottom);
      aboutMain.appendChild(el("div", "spacer"));

      // ── Bio ──
      const bio = el("div", "about-bio");
      const paragraphs = [
        "I am Ariana Yekrangi, an independent journalist and editor, based in Helsinki. From 2016 to 2025, I was the Chair of UN-aligned, a Finland-based NGO working to reform the United Nations, and also served as the Editor of The Gordian, the organisation\u2019s monthly publication. In this role, I led the publication of insightful pieces on world peace, human rights, animal welfare and environmental issues.",
        "I specialise in research, fact-checking and shaping stories that are both meaningful and impactful. Over the years, I have worked across various media platforms, refining messages and overseeing editorial processes. I take pride in managing teams, and I have received awards for mentoring interns and helping them develop their skills and confidence.",
        "In addition to my work in journalism, I have an interest in digital media and design, always looking for new ways to tell stories and engage audiences. Outside of work, I compose contemporary classical music, offering me a different way to express and shape ideas.",
        "If you would like to get in touch, collaborate or discuss potential opportunities, feel free to reach out.",
      ];
      paragraphs.forEach((p, i) => {
        if (i > 0) bio.appendChild(el("div", "spacer-half"));
        bio.appendChild(el("div", "c-white", p));
      });
      aboutMain.appendChild(bio);
      aboutMain.appendChild(el("div", "spacer"));
      aboutMain.appendChild(
        el("div", "c-dim", "    ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░"),
      );

      aboutWrap.appendChild(aboutMain);

      const sb = buildSidebar(ALL);
      aboutWrap.appendChild(sb);
      output.appendChild(aboutWrap);
      startSidebarUpdates(sb);

      fetch("assets/ariana-ascii.txt")
        .then((r) => (r.ok ? r.text() : null))
        .then((txt) => {
          if (!txt) {
            portraitPre.textContent = "";
            return;
          }
          portraitPre.innerHTML = _colorizeAsciiPortrait(txt);
        })
        .catch(() => {
          portraitPre.textContent = "";
        });

      printBlank();
    },
  },

  whoami: {
    description: "About me",
    execute() {
      commands.about.execute();
    },
  },

  home: {
    description: "Return to home screen",
    execute() {
      clearOutput();
      pushRoute("/");
      printHome();
    },
  },

  cmatrix: {
    description: "Digital rain screensaver",
    execute() {
      if (window.cmatrix) window.cmatrix.start();
    },
  },

  clear: {
    description: "Clear the terminal",
    execute() {
      terminal.classList.add("flash");
      setTimeout(clearOutput, 80);
      setTimeout(() => terminal.classList.remove("flash"), 160);
    },
  },

  exit: {
    description: "Return to home",
    execute() {
      clearOutput();
      pushRoute("/");
      printHome();
    },
  },

  // ── Easter eggs ──────────────────────────────
  ls: {
    description: "List all content by category",
    execute() {
      const cats = [...new Set(ALL.map((p) => p.category).filter(Boolean))];
      for (const cat of cats) {
        const items = byDate(ALL.filter((p) => p.category === cat));
        if (!items.length) continue;
        const color = CAT_COLORS[cat] || "c-info";
        printLine(`  ${cat}/`, color);
        for (const item of items) {
          const right =
            item.pub || (item.tags && item.tags[0]) || item.date || "";
          const slug = item.slug.padEnd(44, " ");
          printLine(`    ${slug}  ${right}`, "c-dim");
        }
        printBlank();
      }
      printLine("  'blog' to browse interactively", "c-info");
    },
  },

  fortune: {
    description: "Wisdom from the machine",
    execute() {
      const fortunes = [
        "The network is the computer. The computer is the network.",
        "There is no cloud, only other people's computers.",
        "chmod 777 is not a solution. It is a prayer.",
        "The best documentation is the code that doesn't need it.",
        "If it works, don't grep it.",
        "In the beginning was the command line.",
        "All happy terminals are alike; every unhappy terminal is unhappy in its own way.",
        "The truth is out there. It is in /var/log/syslog.",
        "Simplicity is a great virtue but it requires hard work to achieve it.",
        "Real programmers count from zero.",
        "Israel is a terrorist state.",
        "Your partner never makes sense. Just accept it.",
      ];
      const f = fortunes[Math.floor(Math.random() * fortunes.length)];
      printLine("  ░▒▓━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━▓▒░", "c-dim");
      printLine(`  ${f}`, "c-white");
      printLine("  ░▒▓━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━▓▒░", "c-dim");
      printBlank();
    },
  },

  // ── Easter eggs ──────────────────────────────
  sudo: {
    description: "Run as superuser",
    execute() {
      printLine("  Permission denied.", "c-error");
      setTimeout(() => printLine("  (nice try though.)", "c-info"), 600);
    },
  },

  rm: {
    description: "Remove files",
    execute(args) {
      if (args && args.includes("-rf")) {
        printLine("  ✗ catastrophic deletion aborted.", "c-error");
        setTimeout(
          () => printLine("  the internet thanks you.", "c-info"),
          500,
        );
      } else {
        printLine("  rm: no targets specified", "c-error");
      }
    },
  },

  hello: {
    description: "Say hello",
    execute() {
      printLine("  hello.", "c-white");
      setTimeout(() => printLine("  glad you're here.", "c-info"), 450);
    },
  },

  matrix: {
    description: "...",
    execute() {
      printLine("  follow the white rabbit.", "c-info");
    },
  },

  theme: {
    description: "Open config (alias)",
    execute(args) {
      commands.config.execute(args);
    },
  },

  config: {
    description: "Terminal settings — theme & font",
    execute(args) {
      // Direct shortcut: config theme <name> / config font <name>
      if (args) {
        const parts = args.trim().split(/\s+/);
        if (parts[0] === "theme" && parts[1]) {
          const match = THEMES.find(
            (t) =>
              t.id === parts[1] ||
              t.name.toLowerCase() === parts.slice(1).join(" ").toLowerCase(),
          );
          if (match) {
            applyTheme(match.id);
            printLine(`  theme → ${match.name}`, "c-info");
            return;
          }
          printLine(`  unknown theme: ${parts[1]}`, "c-error");
          printLine(
            `  available: ${THEMES.map((t) => t.id).join(", ")}`,
            "c-dim",
          );
          return;
        }
        if (parts[0] === "font" && parts[1]) {
          const match = FONTS.find(
            (f) =>
              f.id === parts[1] ||
              f.name.toLowerCase() === parts.slice(1).join(" ").toLowerCase(),
          );
          if (match) {
            applyFont(match.id);
            printLine(`  font → ${match.name}`, "c-info");
            return;
          }
          printLine(`  unknown font: ${parts[1]}`, "c-error");
          return;
        }
      }

      // Interactive config menu
      _openConfigMenu();
    },
  },

  settings: {
    description: "Open config (alias)",
    execute(args) {
      commands.config.execute(args);
    },
  },

  gui: {
    description: "Switch to desktop (Windows XP) mode",
    execute() {
      printLine("  launching desktop mode…", "c-info");
      setTimeout(() => {
        window.location.href = "desktop.html";
      }, 600);
    },
  },
};

// ─────────────────────────────────────────────
// Interactive Config Menu
// ─────────────────────────────────────────────
let _configMode = false;
let _configSection = 0; // 0 = theme, 1 = font
let _configIdx = 0;
let _configEl = null;

function _openConfigMenu() {
  _configMode = true;
  _configSection = 0;
  _configIdx = THEMES.findIndex((t) => t.id === getActiveTheme());
  if (_configIdx < 0) _configIdx = 0;
  if (sbMode) sbMode.textContent = "CONFIG";
  if (sbStatus)
    sbStatus.textContent = "↑↓ navigate  Enter=select  Tab=section  ESC=close";

  _configEl = document.createElement("div");
  _configEl.id = "config-menu";
  output.appendChild(_configEl);
  _renderConfig();
  terminal.scrollTop = terminal.scrollHeight;
}

function _closeConfigMenu() {
  _configMode = false;
  _configEl = null;
  if (sbMode) sbMode.textContent = "TERMINAL";
  if (sbStatus) sbStatus.textContent = "ready";
}

function _renderConfig() {
  if (!_configEl) return;
  const activeTheme = getActiveTheme();
  const activeFont = getActiveFont();

  let html = "";
  html += "\n";
  html +=
    '  <span class="c-cyan">┌─ CONFIG ─────────────────────────────────────────┐</span>\n';
  html += '  <span class="c-cyan">│</span>\n';

  // ── THEME section ──
  const themeActive = _configSection === 0;
  html +=
    '  <span class="c-cyan">│</span>  <span class="cfg-section">' +
    (themeActive ? "▸ " : "  ") +
    "THEME</span>\n";
  html += '  <span class="c-cyan">│</span>\n';
  THEMES.forEach((t, i) => {
    const isCurrent = t.id === activeTheme;
    const isSelected = themeActive && i === _configIdx;
    const cls = isSelected ? "cfg-option active" : "cfg-option";
    const cursor = isSelected ? "▸" : " ";
    const check = isCurrent ? "●" : "○";
    const checkCls = isCurrent ? "cfg-check checked" : "cfg-check";
    html += `  <span class="c-cyan">│</span>  <span class="${cls}"><span class="cfg-cursor">${cursor}</span><span class="${checkCls}">${check}</span> <span class="cfg-label">${t.name.padEnd(16)}</span><span class="c-dim">${t.desc}</span></span>\n`;
  });

  html += '  <span class="c-cyan">│</span>\n';

  // ── FONT section ──
  const fontActive = _configSection === 1;
  html +=
    '  <span class="c-cyan">│</span>  <span class="cfg-section">' +
    (fontActive ? "▸ " : "  ") +
    "FONT</span>\n";
  html += '  <span class="c-cyan">│</span>\n';
  FONTS.forEach((f, i) => {
    const isCurrent = f.id === activeFont;
    const isSelected = fontActive && i === _configIdx;
    const cls = isSelected ? "cfg-option active" : "cfg-option";
    const cursor = isSelected ? "▸" : " ";
    const check = isCurrent ? "●" : "○";
    const checkCls = isCurrent ? "cfg-check checked" : "cfg-check";
    html += `  <span class="c-cyan">│</span>  <span class="${cls}"><span class="cfg-cursor">${cursor}</span><span class="${checkCls}">${check}</span> <span class="cfg-label">${f.name.padEnd(16)}</span><span class="c-dim">${f.desc}</span></span>\n`;
  });

  html += '  <span class="c-cyan">│</span>\n';
  html +=
    '  <span class="c-cyan">└──────────────────────────────────────────────────┘</span>\n';
  html +=
    '  <span class="c-dim">  ↑↓ navigate · Tab switch section · Enter apply · ESC close</span>';

  _configEl.innerHTML = html;
}

function _configKeyHandler(e) {
  if (!_configMode) return false;

  const items = _configSection === 0 ? THEMES : FONTS;

  if (e.key === "ArrowUp") {
    e.preventDefault();
    if (_configIdx > 0) {
      _configIdx--;
    } else if (_configSection === 1) {
      // Jump up from first font → last theme
      _configSection = 0;
      _configIdx = THEMES.length - 1;
    }
    _renderConfig();
    return true;
  }
  if (e.key === "ArrowDown") {
    e.preventDefault();
    if (_configIdx < items.length - 1) {
      _configIdx++;
    } else if (_configSection === 0) {
      // Jump down from last theme → first font
      _configSection = 1;
      _configIdx = 0;
    }
    _renderConfig();
    return true;
  }
  if (e.key === "Tab") {
    e.preventDefault();
    if (_configSection === 0) {
      _configSection = 1;
      _configIdx = FONTS.findIndex((f) => f.id === getActiveFont());
      if (_configIdx < 0) _configIdx = 0;
    } else {
      _configSection = 0;
      _configIdx = THEMES.findIndex((t) => t.id === getActiveTheme());
      if (_configIdx < 0) _configIdx = 0;
    }
    _renderConfig();
    return true;
  }
  if (e.key === "Enter") {
    e.preventDefault();
    const selected = items[_configIdx];
    if (_configSection === 0) {
      applyTheme(selected.id);
      printLine(`  theme → ${selected.name}`, "c-info");
    } else {
      applyFont(selected.id);
      printLine(`  font → ${selected.name}`, "c-info");
    }
    _renderConfig();
    return true;
  }
  if (e.key === "Escape") {
    e.preventDefault();
    _closeConfigMenu();
    printLine("  (config closed)", "c-dim");
    return true;
  }
  return false;
}

// ─────────────────────────────────────────────
// Tab Autocomplete
// ─────────────────────────────────────────────
function handleTab(e) {
  e.preventDefault();
  const val = input.value.trim().toLowerCase();
  if (!val) {
    hideTabHints();
    return;
  }

  const matches = Object.keys(commands).filter((c) => c.startsWith(val));

  if (matches.length === 0) {
    hideTabHints();
  } else if (matches.length === 1) {
    input.value = matches[0] + " ";
    hideTabHints();
  } else {
    // Show options inline below the output
    tabHints.innerHTML = matches
      .map(
        (m) =>
          `<span onclick="input.value='${m} '; hideTabHints(); input.focus();">${m}</span>`,
      )
      .join("");
    tabHints.classList.add("visible");
  }
}

function hideTabHints() {
  tabHints.classList.remove("visible");
  tabHints.innerHTML = "";
}

// ─────────────────────────────────────────────
// Execute a raw command string
// ─────────────────────────────────────────────
function executeCommand(raw) {
  const parts = raw.trim().split(/\s+/);
  const cmd = parts[0].toLowerCase();
  const args = parts.slice(1).join(" ") || null;
  const def = commands[cmd];

  if (def) {
    def.execute(args);
  } else {
    printLine(`command not found: ${cmd}`, "c-error");
    const close = Object.keys(commands).find((c) => levenshtein(c, cmd) <= 2);
    if (close) printLine(`did you mean: ${close}?`, "c-info");
    else printLine(`type 'help' to see available commands`, "c-info");
  }
}

// Simple Levenshtein for "did you mean"
function levenshtein(a, b) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) =>
      i === 0 ? j : j === 0 ? i : 0,
    ),
  );
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
  return dp[a.length][b.length];
}

// ─────────────────────────────────────────────
// Command Palette
// ─────────────────────────────────────────────
let paletteIdx = 0;
let palFiltered = [];

function openPalette() {
  palette.classList.add("open");
  paletteInput.value = "";
  paletteIdx = 0;
  renderPalette("");
  paletteInput.focus();
}

function closePalette() {
  palette.classList.remove("open");
  input.focus();
}

function renderPalette(query) {
  palFiltered = Object.entries(commands).filter(
    ([cmd, def]) =>
      cmd.includes(query) || def.description.toLowerCase().includes(query),
  );
  paletteRes.innerHTML = "";
  palFiltered.forEach(([cmd, def], i) => {
    const item = document.createElement("div");
    item.className = "palette-item" + (i === paletteIdx ? " active" : "");
    item.innerHTML = `<span class="palette-cmd">${cmd}</span><span class="palette-desc">${def.description}</span>`;
    item.addEventListener("click", () => {
      closePalette();
      runFromPalette(cmd);
    });
    paletteRes.appendChild(item);
  });
}

function runFromPalette(cmd) {
  printHTML(`<span class="c-cyan">visitor@ariana:~$</span> ${cmd}`);
  executeCommand(cmd);
}

paletteInput.addEventListener("input", () => {
  paletteIdx = 0;
  renderPalette(paletteInput.value.toLowerCase());
});

paletteInput.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closePalette();
    return;
  }
  if (e.key === "ArrowDown") {
    e.preventDefault();
    paletteIdx = Math.min(paletteIdx + 1, palFiltered.length - 1);
    renderPalette(paletteInput.value);
  }
  if (e.key === "ArrowUp") {
    e.preventDefault();
    paletteIdx = Math.max(paletteIdx - 1, 0);
    renderPalette(paletteInput.value);
  }
  if (e.key === "Enter") {
    const chosen = palFiltered[paletteIdx];
    if (chosen) {
      closePalette();
      runFromPalette(chosen[0]);
    }
  }
});

// ─────────────────────────────────────────────
// Main keyboard handler
// ─────────────────────────────────────────────
input.addEventListener("keydown", (e) => {
  // Config menu: intercept nav keys, but let typed text + Enter through
  if (_configMode) {
    if (e.key === "Enter" && input.value.trim()) {
      _closeConfigMenu();
      // fall through to normal Enter handler below
    } else if (_configKeyHandler(e)) {
      return;
    }
  }

  // Tab autocomplete
  if (e.key === "Tab") {
    handleTab(e);
    return;
  }

  // Any other key hides tab hints
  if (e.key !== "Tab") hideTabHints();

  // Blog list navigation
  if (blogMode) {
    if (e.key === "ArrowUp" || (e.key === "ArrowLeft" && !input.value)) {
      e.preventDefault();
      selectedPost = Math.max(0, selectedPost - 1);
      renderList();
      return;
    }
    if (e.key === "ArrowDown" || (e.key === "ArrowRight" && !input.value)) {
      e.preventDefault();
      selectedPost = Math.min(listItems.length - 1, selectedPost + 1);
      renderList();
      return;
    }
    if (e.key === "Enter" && !input.value.trim()) {
      e.preventDefault();
      openPost(listItems[selectedPost]);
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      blogMode = false;
      if (titleText) titleText.textContent = "visitor@ariana:~";
      printLine("  (exited list)", "c-info");
      return;
    }
  }

  // Reader mode: arrow keys scroll, left/right navigate prev/next post
  if (readerMode) {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      terminal.scrollBy({ top: -80, behavior: "smooth" });
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      terminal.scrollBy({ top: 80, behavior: "smooth" });
      return;
    }
    if (e.key === "ArrowLeft" && !input.value && listItems.length) {
      e.preventDefault();
      if (selectedPost > 0) {
        selectedPost--;
        openPost(listItems[selectedPost]);
      }
      return;
    }
    if (e.key === "ArrowRight" && !input.value && listItems.length) {
      e.preventDefault();
      if (selectedPost < listItems.length - 1) {
        selectedPost++;
        openPost(listItems[selectedPost]);
      }
      return;
    }
  }

  // Command history (only when not in list mode)
  if (!blogMode) {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (historyIdx === -1) savedInput = input.value;
      historyIdx = Math.min(historyIdx + 1, cmdHistory.length - 1);
      input.value = cmdHistory[historyIdx] ?? savedInput;
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      historyIdx = Math.max(historyIdx - 1, -1);
      input.value = historyIdx === -1 ? savedInput : cmdHistory[historyIdx];
      return;
    }
  } // end !blogMode

  // Execute
  if (e.key === "Enter") {
    const raw = input.value.trim();
    input.value = "";
    historyIdx = -1;
    savedInput = "";
    if (!raw) return;
    cmdHistory.unshift(raw);
    printHTML(`<span class="c-cyan">visitor@ariana:~$</span> ${raw}`);
    executeCommand(raw);
  }
});

// Keep input always focused
input.addEventListener("blur", (e) => {
  if (e.relatedTarget && e.relatedTarget.tagName === "A") return;
  setTimeout(() => input.focus(), 0);
});

// Refocus on click
terminal.addEventListener("click", () => {
  if (!window.getSelection().toString()) input.focus();
});

// Global Escape closes palette if open
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && palette.classList.contains("open")) closePalette();
});

// ─────────────────────────────────────────────
// Clock ticker
// ─────────────────────────────────────────────
setInterval(() => {
  if (clockEl) clockEl.textContent = new Date().toLocaleTimeString("en-GB");
}, 1000);
if (clockEl) clockEl.textContent = new Date().toLocaleTimeString("en-GB");

// ─────────────────────────────────────────────
// Terminal window controls (named globals — same pattern as desktop.js)
// ─────────────────────────────────────────────
let _termMaximised = false;

function minimizeWindow() {
  window.location.href = "desktop.html";
}

function maximizeWindow() {
  const wrapper = document.getElementById("terminal-wrapper");
  _termMaximised = !_termMaximised;
  if (_termMaximised) {
    wrapper.style.cssText = "width:100%;max-width:100%;height:100vh;margin:0;";
    document.body.style.padding = "0";
  } else {
    wrapper.style.cssText = "";
    document.body.style.padding = "";
  }
}

function closeWindow() {
  window.location.href = "desktop.html";
}

// ─────────────────────────────────────────────
// Boot sequence → home
// ─────────────────────────────────────────────
(async function boot() {
  await loadContent();
  fetchAndInjectRepos();
  fetchRealWeather();

  // Route based on hash, fallback to home
  const path = getRoutePath();
  if (path !== "/") {
    handleRoute(path);
  } else {
    printHome();
  }

  terminal.scrollTop = 0;
  input.focus();
})();

// Browser back/forward
window.addEventListener("hashchange", () => {
  handleRoute();
});
