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

// Lazy-loaded earth frames (loaded on first home screen visit)
let _earthFramesCache = null;
function _getEarthFrames() {
  if (_earthFramesCache) return Promise.resolve(_earthFramesCache);
  if (typeof EARTH_FRAMES !== "undefined") {
    _earthFramesCache = EARTH_FRAMES;
    return Promise.resolve(_earthFramesCache);
  }
  return new Promise((resolve) => {
    const s = document.createElement("script");
    s.src = "js/earth.js";
    s.onload = () => {
      _earthFramesCache =
        typeof EARTH_FRAMES !== "undefined" ? EARTH_FRAMES : [];
      resolve(_earthFramesCache);
    };
    s.onerror = () => {
      _earthFramesCache = [];
      resolve(_earthFramesCache);
    };
    document.head.appendChild(s);
  });
}

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
  return location.hash.replace(/^#\/?/, "/").replace(/\/+$/, "") || "/";
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
    desc: "cyan on black",
  },
  { id: "monokai", name: "Monokai Pro", desc: "green & orange" },
  {
    id: "bloodmoon",
    name: "Bloodmoon",
    desc: "crimson on void",
  },
  { id: "acid", name: "Acid", desc: "neon green" },
  {
    id: "vaporwave",
    name: "Vaporwave",
    desc: "pink & purple",
  },
  {
    id: "frozen",
    name: "Frozen",
    desc: "ice white on blue",
  },
  {
    id: "paper",
    name: "Paper",
    desc: "ink on white",
  },
  {
    id: "cinnamon",
    name: "Cinnamon",
    desc: "warm spice on dark",
  },
  {
    id: "barbie",
    name: "Barbie",
    desc: "pink on dark pink",
  },
];

const FONTS = [
  { id: "fira-code", name: "Fira Code", desc: "ligatures, designed for code" },
  {
    id: "inconsolata",
    name: "Inconsolata",
    desc: "clean, open-source",
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

// Content registry is in js/manifest.js (SLUGS array)

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
let _scrollRafPending = false;
function _scheduleScroll() {
  if (!_scrollRafPending) {
    _scrollRafPending = true;
    requestAnimationFrame(() => {
      terminal.scrollTop = terminal.scrollHeight;
      _scrollRafPending = false;
    });
  }
}

function printLine(text = "", cls = "") {
  const div = document.createElement("div");
  if (cls) div.className = cls;
  div.textContent = text;
  output.appendChild(div);
  _scheduleScroll();
}

function printBlank() {
  const div = document.createElement("div");
  div.className = "spacer";
  output.appendChild(div);
  _scheduleScroll();
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
// IP fetch is deferred to boot — see end of file

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
      c(g, "   ;,    ,;     "),
      c(g, "  ';.-----.;'   "),
      c(g, "  | ") +
        c("var(--white)", "O") +
        c(g, "     ") +
        c("var(--white)", "O") +
        c(g, " |   "),
      c(g, "  |         |   "),
      c(g, "  |         |   "),
      c(g, "  '---------'   "),
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
    const logoRaw = i < osLogo.length ? osLogo[i] : " ".repeat(LW);
    const logo = `<span class="nf-logo-col">${logoRaw}</span>`;
    const inf = i < infoLines.length ? infoLines[i] : "";
    const infoVis = strip(inf).length;
    const gap = Math.max(0, W - 4 - LW - 1 - infoVis);
    NF.push(fr("│") + " " + logo + " " + inf + " ".repeat(gap) + " " + fr("│"));
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

  const H = 24;
  const fr = (s) => `<span class="sb-frame">${s}</span>`;
  const strip = (s) => s.replace(/<[^>]*>/g, "");
  const mkPad = (w, inner) => {
    const vis = strip(inner).length;
    const gap = Math.max(0, w - 4 - vis);
    return fr("│") + " " + inner + " ".repeat(gap) + " " + fr("│");
  };
  const hpad = (inner) => mkPad(H, inner);

  let orbitStep = 0;
  let tickCount = 0;

  // Pre-compute orbit ellipse points once (never changes)
  const OW = 19,
    OH = 7,
    cx = 9,
    cy = 3,
    rx = 8,
    ry = 3;
  const _orbitDots = [];
  for (let a = 0; a < 360; a += 4) {
    const rad = (a * Math.PI) / 180;
    const px = Math.round(cx + rx * Math.cos(rad));
    const py = Math.round(cy + ry * Math.sin(rad));
    if (px >= 0 && px < OW && py >= 0 && py < OH) _orbitDots.push([px, py]);
  }

  // Cache DOM lookups
  const _uptimeEl = sb.querySelector("#sb-uptime-val");
  const _ipEl = sb.querySelector("#sb-ip-val");
  const _clockEl = sb.querySelector("#sb-clock-line");
  const _orbitEl = sb.querySelector("#sb-orbit-lines");

  window._sidebarInterval = setInterval(() => {
    // Skip all work when tab is hidden
    if (document.hidden) return;

    tickCount++;

    // Refresh weather every 10 minutes
    if (tickCount % 600 === 0) fetchRealWeather();

    // Update uptime — value is padEnd(16) so line width stays constant
    if (_uptimeEl) {
      const sec = Math.floor((Date.now() - startTime) / 1000);
      const h = Math.floor(sec / 3600);
      const m = Math.floor((sec % 3600) / 60);
      const s = sec % 60;
      const uptimeStr =
        h > 0 ? `${h}h ${m}m ${s}s` : m > 0 ? `${m}m ${s}s` : `${s}s`;
      _uptimeEl.textContent = uptimeStr.padEnd(16);
    }

    // Update IP — value is padEnd(16) so line width stays constant
    if (window._visitorIP && _ipEl && !_ipEl._done) {
      _ipEl.textContent = window._visitorIP.padEnd(16);
      _ipEl._done = true;
    }

    // Update clock
    if (_clockEl) {
      const now = new Date();
      const timeStr = now.toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        timeZone: "Europe/Helsinki",
      });
      _clockEl.innerHTML = hpad(`<span class="sb-val">${timeStr}</span>`);
    }

    // Animate orbit — advance earth position using pre-computed ellipse
    orbitStep++;
    if (_orbitEl) {
      const now = new Date();
      const startOfYear = new Date(now.getFullYear(), 0, 1);
      const dayOfYear = Math.floor((now - startOfYear) / 864e5) + 1;
      const totalDays = now.getFullYear() % 4 === 0 ? 366 : 365;
      const baseAngle = (dayOfYear / totalDays) * 2 * Math.PI - Math.PI / 2;
      const animAngle = baseAngle + orbitStep * 0.05;

      // Build grid from pre-computed dots
      let grid = [];
      for (let y = 0; y < OH; y++) {
        grid[y] = new Array(OW).fill(" ");
      }
      for (const [px, py] of _orbitDots) {
        if (grid[py][px] === " ") grid[py][px] = "·";
      }
      grid[cy][cx] = "S";
      const ex = Math.round(cx + rx * Math.cos(animAngle));
      const ey = Math.round(cy + ry * Math.sin(animAngle));
      if (ex >= 0 && ex < OW && ey >= 0 && ey < OH) {
        grid[ey][ex] = "E";
      }
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
      _orbitEl.innerHTML = html;
    }
  }, 1000);
}

// ── Render the full blog page ──────────────────
// Cache for ASCII art thumbnails so they don't re-fetch on every render
const _thumbCache = {};

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

    // Load ASCII art thumbnail (cached to prevent blink on re-render)
    if (item.image && item.image.endsWith(".txt")) {
      const thumb = row.querySelector(".elr-thumb");
      const _applyThumb = (txt) => {
        if (!txt || !thumb) return;
        const pre = document.createElement("pre");
        pre.className = "elr-thumb-art";
        pre.style.fontSize = "10px";
        pre.textContent = txt;
        thumb.appendChild(pre);
        requestAnimationFrame(() => {
          const natW = pre.scrollWidth;
          const natH = pre.scrollHeight;
          if (natW && natH) {
            const scale = Math.min(28 / natW, 20 / natH);
            pre.style.transform = `scale(${scale})`;
          }
        });
      };
      if (_thumbCache[item.image]) {
        _applyThumb(_thumbCache[item.image]);
      } else {
        fetch(item.image)
          .then((r) => (r.ok ? r.text() : null))
          .then((txt) => {
            if (txt) _thumbCache[item.image] = txt;
            _applyThumb(txt);
          })
          .catch(() => {});
      }
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

  // Add spacer without triggering auto-scroll-to-bottom
  const spacer = document.createElement("div");
  spacer.className = "spacer";
  output.appendChild(spacer);

  // Scroll to top of post — use rAF to run after any pending _scheduleScroll
  requestAnimationFrame(() => {
    terminal.scrollTop = 0;
  });
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
    /!\[([^\]]*)\]\(([^)]*(?:\([^)]*\)[^)]*)*)\)/g,
    '<img class="post-inline-img" src="$2" alt="$1">',
  );
  // links: [text](url)
  text = text.replace(
    /\[([^\]]+)\]\(([^)]*(?:\([^)]*\)[^)]*)*)\)/g,
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
        html += ch === " " ? " " : light.has(ch) ? "·" : ch;
      }
      if (cur) html += "</span>";
      return html;
    })
    .join("\n");
}

// Scramble-decode animation for header ASCII art
// Characters start random and resolve into the real art
function _scrambleReveal(container, txt, colorizer, charColorFn) {
  const finalColorize = colorizer || _colorizeAsciiArt;
  const getColor = charColorFn || _artCharColor;
  const glyphs = "·:;-~+='`";
  const glyphsLen = glyphs.length;
  const lines = txt.split("\n");
  const DIM = "var(--grey-dim)";

  // Build a flat array for each non-space cell
  const pending = [];
  for (let r = 0; r < lines.length; r++) {
    for (let c = 0; c < lines[r].length; c++) {
      if (lines[r][c] !== " ") pending.push({ r, c, ch: lines[r][c] });
    }
  }
  // Shuffle resolve order
  for (let i = pending.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    const tmp = pending[i];
    pending[i] = pending[j];
    pending[j] = tmp;
  }

  // Mutable grid of characters — spaces stay, rest start as random glyphs
  const grid = lines.map((line) => {
    const row = new Array(line.length);
    for (let i = 0; i < line.length; i++) {
      row[i] = line[i] === " " ? " " : glyphs[(Math.random() * glyphsLen) | 0];
    }
    return row;
  });

  // Pre-compute the final color for each cell (never changes)
  const colorGrid = lines.map((line) => {
    const row = new Array(line.length);
    for (let i = 0; i < line.length; i++) {
      row[i] = line[i] === " " ? null : getColor(line[i]);
    }
    return row;
  });

  // Track which cells are resolved
  const resolvedGrid = lines.map((line) => {
    const row = new Array(line.length);
    for (let i = 0; i < line.length; i++) row[i] = false;
    return row;
  });

  const duration = 900;
  const resolvePerFrame = Math.ceil(pending.length / (duration / 16.7));
  const mutationsPerFrame = Math.max(2, (pending.length / 10) | 0);
  let resolved = 0;
  let lastTime = 0;
  const frameInterval = 33; // ~30fps cap

  // Render with colors: resolved cells get theme color, unresolved get dim
  function render() {
    let html = "";
    for (let r = 0; r < grid.length; r++) {
      if (r > 0) html += "\n";
      const row = grid[r];
      const cRow = colorGrid[r];
      const rRow = resolvedGrid[r];
      let cur = null;
      for (let c = 0; c < row.length; c++) {
        const ch = row[c];
        if (ch === " ") {
          if (cur) {
            html += "</span>";
            cur = null;
          }
          html += " ";
          continue;
        }
        const color = rRow[c] ? cRow[c] : DIM;
        if (color !== cur) {
          if (cur) html += "</span>";
          html += '<span style="color:' + color + '">';
          cur = color;
        }
        html += ch;
      }
      if (cur) html += "</span>";
    }
    container.innerHTML = html;
  }

  render();

  function tick(now) {
    if (now - lastTime < frameInterval) {
      requestAnimationFrame(tick);
      return;
    }
    lastTime = now;

    // Resolve a batch of cells to their real character
    const batch = Math.min(resolvePerFrame, pending.length - resolved);
    for (let i = 0; i < batch; i++) {
      const cell = pending[resolved++];
      grid[cell.r][cell.c] = cell.ch;
      resolvedGrid[cell.r][cell.c] = true;
    }
    // Mutate some still-scrambled cells
    const remaining = pending.length - resolved;
    const mutations = Math.min(mutationsPerFrame, remaining);
    for (let i = 0; i < mutations; i++) {
      const cell = pending[resolved + ((Math.random() * remaining) | 0)];
      grid[cell.r][cell.c] = glyphs[(Math.random() * glyphsLen) | 0];
    }

    if (resolved >= pending.length) {
      // Final frame: apply full colorizer for any special replacements (e.g. · for dots)
      container.innerHTML = finalColorize(txt);
      return;
    }

    render();
    requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);
}

// Per-character color lookup for generic ASCII art (matches _colorizeAsciiArt)
function _artCharColor(ch) {
  if (".·\u00B7".includes(ch)) return "var(--grey-dim)";
  if ("-~:;,`'".includes(ch)) return "var(--grey)";
  if ("+=#%&@*^".includes(ch)) return "var(--cyan)";
  const code = ch.charCodeAt(0) | 32; // lowercase
  if (code >= 97 && code <= 109) return "var(--cyan-dim)"; // a-m
  if (code >= 110 && code <= 122) return "var(--cyan)"; // n-z
  if (ch >= "0" && ch <= "9") return "var(--purple)";
  return "var(--grey)";
}

// Per-character color lookup for the portrait (matches _colorizeAsciiPortrait)
function _portraitCharColor(ch) {
  const map = {
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
  return map[ch] || "var(--grey-dim)";
}

// Fetch a .txt file and render as themed ASCII art into a container element
function _renderAsciiArtInto(container, src) {
  container.textContent = "loading…";
  fetch(src)
    .then((r) => (r.ok ? r.text() : Promise.reject()))
    .then((txt) => {
      container.textContent = "";
      // Header cover art: scramble-reveal animation
      if (container.classList.contains("post-header-ascii")) {
        if (window.matchMedia("(max-width: 768px)").matches) {
          _fitAsciiArt(container, txt);
        }
        _scrambleReveal(container, txt);
      }
      // Body inline art: animate when scrolled into view
      else if (container.classList.contains("post-ascii-art")) {
        const observer = new IntersectionObserver(
          (entries) => {
            for (const entry of entries) {
              if (entry.isIntersecting) {
                observer.disconnect();
                _fitAsciiArt(container, txt);
                _scrambleReveal(container, txt);
              }
            }
          },
          { threshold: 0.1 },
        );
        observer.observe(container);
      } else {
        container.innerHTML = _colorizeAsciiArt(txt);
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
  const _REVEAL_CAP = 10; // max elements that animate; rest appear instantly

  function _revealDelay() {
    const delay = _revealIdx < _REVEAL_CAP ? _revealIdx * 25 + "ms" : "0ms";
    _revealIdx++;
    return delay;
  }

  function appendEl(cls, html) {
    const div = document.createElement("div");
    if (_revealIdx < _REVEAL_CAP) {
      if (cls) div.className = cls + " term-reveal";
      else div.className = "term-reveal";
      div.style.animationDelay = _revealDelay();
    } else {
      if (cls) div.className = cls;
      _revealIdx++;
    }
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
  crumb.className =
    "post-breadcrumb" + (_revealIdx < _REVEAL_CAP ? " term-reveal" : "");
  if (_revealIdx < _REVEAL_CAP) crumb.style.animationDelay = _revealDelay();
  else _revealIdx++;
  crumb.innerHTML =
    '<span class="bc-seg">blog</span>' +
    ' <span class="bc-seg">/</span> ' +
    '<span class="bc-seg">' +
    category +
    "</span>";
  output.appendChild(crumb);

  // ── Post header card — date on top, no left border ──
  const headerBox = document.createElement("div");
  headerBox.className =
    "post-header-box" + (_revealIdx < _REVEAL_CAP ? " term-reveal" : "");
  if (_revealIdx < _REVEAL_CAP) headerBox.style.animationDelay = _revealDelay();
  else _revealIdx++;

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
    } else if (/^!\[([^\]]*)\]\((.+)\)\s*$/.test(raw.trim())) {
      // Block-level image: ![alt](url) — greedy to support parens in filenames
      flushPara(paraBuf);
      paraBuf = [];
      const imgMatch = raw.trim().match(/^!\[([^\]]*)\]\((.+)\)$/);
      const imgAlt = imgMatch[1];
      const imgSrc = imgMatch[2];
      if (imgSrc.endsWith(".txt")) {
        const artPre = document.createElement("pre");
        artPre.className =
          "post-ascii-art" + (_revealIdx < _REVEAL_CAP ? " term-reveal" : "");
        if (_revealIdx < _REVEAL_CAP)
          artPre.style.animationDelay = _revealDelay();
        else _revealIdx++;
        output.appendChild(artPre);
        _renderAsciiArtInto(artPre, imgSrc);
      } else {
        const imgDiv = document.createElement("div");
        imgDiv.className =
          "post-image" + (_revealIdx < _REVEAL_CAP ? " term-reveal" : "");
        if (_revealIdx < _REVEAL_CAP)
          imgDiv.style.animationDelay = _revealDelay();
        else _revealIdx++;
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
  _scheduleScroll();
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

  // Earth globe (animated — lazy-loaded)
  const earthPre = document.createElement("pre");
  earthPre.className = "earth-globe";
  earthPre.textContent = ""; // placeholder until frames load
  hero.appendChild(earthPre);

  // Load earth frames async, then start animation
  _getEarthFrames().then((frames) => {
    if (!frames.length) return;
    earthPre.textContent = frames[0].join("\n");
    let earthFrame = 0;
    const earthInterval = setInterval(() => {
      earthFrame = (earthFrame + 1) % frames.length;
      earthPre.textContent = frames[earthFrame].join("\n");
    }, 250);
    window._earthInterval = earthInterval;
  });
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
  sub.textContent = "Dad · Journalist · Builder of things";
  info.appendChild(sub);

  hero.appendChild(info);
  homeMain.appendChild(hero);

  // Build sidebar with live-updating references
  const sb = buildSidebar(ALL);
  homeWrap.appendChild(homeMain);
  homeWrap.appendChild(sb);
  output.appendChild(homeWrap);

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
        ["blog category", "filter by category"],
        ["projects", "projects & repos"],
        ["cmatrix", "digital rain screensaver"],
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
      const items = ALL.filter(
        (p) =>
          p.category === "project" || p.category === "projects" || p.isRepo,
      );
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

      // ── Neofetch layout: info on top, portrait below ──
      const neoWrap = el("div", "neofetch-wrap");
      const portraitPre = el(
        "pre",
        "about-portrait neofetch-art",
        "loading...",
      );

      const info = el("div", "neofetch-info");

      // Title line
      info.appendChild(
        htmlDiv(
          "nf-title",
          '<span class="c-green">ariana</span><span class="c-white">@</span><span class="c-green">yekrangi</span>',
        ),
      );
      info.appendChild(el("div", "nf-sep", "─────────────────────────────"));

      // Key-value pairs
      const fields = [
        ["Name", "Ariana Yekrangi"],
        ["Role", "Dad · Journalist · Builder of things"],
        ["Location", "Helsinki, Finland"],
        [
          "Interests",
          "Human rights, Intl. law, journalism, contemporary classical music, design",
        ],
        ["Email", "yekrangiariana@gmail.com"],
        ["GitHub", "github.com/yekrangiariana"],
      ];
      fields.forEach(([key, val]) => {
        info.appendChild(
          htmlDiv(
            "nf-row",
            `<span class="nf-key c-info">${key}</span><span class="c-white">${val}</span>`,
          ),
        );
      });

      // Color blocks (like neofetch)
      info.appendChild(el("div", "spacer-half"));
      info.appendChild(
        htmlDiv(
          "nf-colors",
          [
            "c-red",
            "c-yellow",
            "c-green",
            "c-info",
            "c-blue",
            "c-purple",
            "c-pink",
            "c-white",
          ]
            .map((c) => `<span class="${c}">███</span>`)
            .join(""),
        ),
      );

      neoWrap.appendChild(info);
      aboutMain.appendChild(neoWrap);
      aboutMain.appendChild(el("div", "spacer"));

      // ── Bio with portrait floated inside ──
      const bio = el("div", "about-bio");
      portraitPre.className = "about-portrait neofetch-art bio-portrait";
      bio.appendChild(portraitPre);
      const paragraphs = [
        "Independent journalist and editor based in Helsinki. From 2016 to 2025, I chaired UN-aligned, a Finland-based NGO working to reform the United Nations, and served as Editor of The Gordian, its monthly publication. I led the publication of works on world peace, human rights, animal welfare and environmental issues.",
        "I specialise in research, fact-checking and shaping stories that are both meaningful and impactful. Over the years I have worked across various media platforms, refining messages and overseeing editorial processes. I take pride in managing teams, and have received awards for mentoring interns.",
        "Beyond journalism, I explore digital media and design, always looking for new ways to tell stories and engage audiences. Outside of work, I compose contemporary classical music.",
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
          _scrambleReveal(
            portraitPre,
            txt,
            _colorizeAsciiPortrait,
            _portraitCharColor,
          );
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
        "Israel is a terrorist state.",
        "There is no cloud, only other people's computers.",
        "chmod 777 is not a solution. It is a prayer.",
        "If it works, don't grep it.",
        "Donald Trump is a wanker",
        "In the beginning was the command line.",
        "All happy terminals are alike; every unhappy terminal is unhappy in its own way.",
        "The truth is out there. It is in /var/log/syslog.",
        "Your partner never makes sense. Just accept it.",
        "Real programmers count from zero.",
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

  // ── Touch/click support for config options ──
  const opts = _configEl.querySelectorAll(".cfg-option");
  opts.forEach((el, i) => {
    el.style.cursor = "pointer";
    el.addEventListener("click", () => {
      if (i < THEMES.length) {
        _configSection = 0;
        _configIdx = i;
        applyTheme(THEMES[i].id);
        printLine(`  theme → ${THEMES[i].name}`, "c-info");
      } else {
        _configSection = 1;
        _configIdx = i - THEMES.length;
        applyFont(FONTS[_configIdx].id);
        printLine(`  font → ${FONTS[_configIdx].name}`, "c-info");
      }
      _renderConfig();
    });
  });
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
  // On mobile, default to GUI mode unless user explicitly came from desktop
  const _isMobileDevice =
    /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent,
    ) ||
    (navigator.maxTouchPoints > 0 && window.innerWidth <= 768);
  if (
    _isMobileDevice &&
    !sessionStorage.getItem("preferTerminal") &&
    !location.hash
  ) {
    window.location.href = "desktop.html";
    return;
  }

  await loadContent();

  // Route based on hash, fallback to home
  const path = getRoutePath();
  if (path !== "/") {
    handleRoute(path);
  } else {
    printHome();
  }

  terminal.scrollTop = 0;
  input.focus();

  // Defer non-critical network calls until after first paint
  const _deferNetworkCalls = () => {
    fetchVisitorIP();
    fetchAndInjectRepos();
    fetchRealWeather();
  };
  if (typeof requestIdleCallback === "function") {
    requestIdleCallback(_deferNetworkCalls);
  } else {
    setTimeout(_deferNetworkCalls, 200);
  }

  // Mobile keyboard viewport fix: keep input visible when virtual keyboard opens
  if (window.visualViewport) {
    const vv = window.visualViewport;
    function onViewportResize() {
      const offsetY = window.innerHeight - vv.height;
      if (offsetY > 50) {
        // Keyboard is open — scroll input into view
        terminal.style.paddingBottom = offsetY + "px";
        requestAnimationFrame(() => {
          input.scrollIntoView({ block: "nearest", behavior: "smooth" });
        });
      } else {
        terminal.style.paddingBottom = "";
      }
    }
    vv.addEventListener("resize", onViewportResize);
  }
})();

// Browser back/forward
window.addEventListener("hashchange", () => {
  handleRoute();
});
