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
  output.innerHTML = "";
  blogMode = false;
  readerMode = false;
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
  BLOG: [
    " █▀▄ █   ▄▀▄ ▄▀▀",
    " █▀▄ █   █ █ █ █",
    " ▀▀  ▀▀▀ ▀▀▀ ▀▀▀",
  ],
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

// ── Real weather via geolocation + Open-Meteo (free, no API key) ────
window._weatherData = null;

async function fetchRealWeather() {
  try {
    const pos = await new Promise((resolve, reject) =>
      navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 8000 })
    );
    const { latitude: lat, longitude: lon } = pos.coords;

    const [wx, geo] = await Promise.all([
      fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m`
      ).then(r => r.json()),
      fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`,
        { headers: { 'Accept-Language': 'en', 'User-Agent': 'ariana-terminal/2.0' } }
      ).then(r => r.json()),
    ]);

    const temp = Math.round(wx.current.temperature_2m);
    const addr = geo.address || {};
    const city = addr.city || addr.town || addr.village || addr.county || "unknown";
    const country = (addr.country_code || "").toUpperCase();

    window._weatherData = { temp, city, country };

    // Update sidebar lines if already rendered
    const tEl = document.getElementById("sb-temp-line");
    if (tEl) {
      const W = 46;
      const fr = (s) => `<span class="sb-frame">${s}</span>`;
      const strip = (s) => s.replace(/<[^>]*>/g, "");
      const pad = (inner) => {
        const vis = strip(inner).length;
        const gap = Math.max(0, W - 4 - vis);
        return fr("│") + " " + inner + " ".repeat(gap) + " " + fr("│");
      };
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "unknown";
      const col = temp > 15 ? "var(--amber)" : temp > 5 ? "var(--yellow)" : temp > -5 ? "var(--blue)" : "var(--purple)";
      tEl.innerHTML = pad(`<span style="color:${col}">${temp}°C</span>  <span class="sb-dim">${tz}</span>`);
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
  const totalDays = (now.getFullYear() % 4 === 0) ? 366 : 365;
  const yearPct = Math.round((dayOfYear / totalDays) * 100);

  // Helsinki time
  const timeStr = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "Europe/Helsinki" });
  const dateStr = now.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "Europe/Helsinki" });
  const hHour = parseInt(now.toLocaleTimeString("en-GB", { hour: "2-digit", hour12: false, timeZone: "Europe/Helsinki" }));
  const hMin = parseInt(now.toLocaleTimeString("en-GB", { minute: "2-digit", timeZone: "Europe/Helsinki" }));
  const dayPct = Math.round((hHour * 60 + hMin) / 14.4);
  const dayFill = Math.round(dayPct / 5);
  const dayBar = "█".repeat(dayFill) + "░".repeat(20 - dayFill);

  // Temperature — real if available, seasonal estimate as fallback
  const tempPhase = (dayOfYear - 105) / totalDays * 2 * Math.PI;
  const estimatedTemp = Math.round(5.5 + 12 * Math.sin(tempPhase));
  const temp = window._weatherData?.temp ?? estimatedTemp;
  const tempPrefix = window._weatherData ? "" : "~";
  const monthTemps = [-5, -6, -2, 4, 10, 15, 18, 16, 11, 5, 0, -3];
  const tMin = -6, tMax = 18;
  const sparkChars = " ▁▂▃▄▅▆▇█";
  const sparkline = monthTemps.map(t => {
    const idx = Math.round(((t - tMin) / (tMax - tMin)) * (sparkChars.length - 1));
    return sparkChars[Math.max(0, Math.min(sparkChars.length - 1, idx))];
  }).join("");
  const currentMonth = now.getMonth();
  const monthLabels = "JFMAMJJASOND";

  // Earth orbit — real calculation based on day of year
  const orbitDeg = Math.round((dayOfYear / totalDays) * 360);
  const orbitAngle = (dayOfYear / totalDays) * 2 * Math.PI - Math.PI / 2;

  // Build ASCII orbit with sun and earth glyphs
  // Ellipse: 19 wide, 7 tall
  const OW = 19, OH = 7;
  let orbitGrid = [];
  for (let y = 0; y < OH; y++) {
    let row = [];
    for (let x = 0; x < OW; x++) row.push(" ");
    orbitGrid.push(row);
  }
  // Draw orbit ellipse
  const cx = 9, cy = 3, rx = 8, ry = 3;
  for (let a = 0; a < 360; a += 4) {
    const rad = a * Math.PI / 180;
    const px = Math.round(cx + rx * Math.cos(rad));
    const py = Math.round(cy + ry * Math.sin(rad));
    if (px >= 0 && px < OW && py >= 0 && py < OH && orbitGrid[py][px] === " ") {
      orbitGrid[py][px] = "·";
    }
  }
  // Place sun at center
  orbitGrid[cy][cx] = "☀";
  // Place earth on orbit
  const ex = Math.round(cx + rx * Math.cos(orbitAngle));
  const ey = Math.round(cy + ry * Math.sin(orbitAngle));
  if (ex >= 0 && ex < OW && ey >= 0 && ey < OH) {
    orbitGrid[ey][ex] = "🜨";
  }
  const orbitLines = orbitGrid.map(r => r.join(""));

  // Session uptime — real
  const uptimeSec = Math.floor((Date.now() - startTime) / 1000);
  const uptimeH = Math.floor(uptimeSec / 3600);
  const uptimeM = Math.floor((uptimeSec % 3600) / 60);
  const uptimeS = uptimeSec % 60;
  const uptimeStr = uptimeH > 0 ? `${uptimeH}h ${uptimeM}m ${uptimeS}s` : uptimeM > 0 ? `${uptimeM}m ${uptimeS}s` : `${uptimeS}s`;

  // Real visitor info
  const screenRes = `${screen.width}×${screen.height}`;
  const viewportRes = `${window.innerWidth}×${window.innerHeight}`;
  const colorDepth = screen.colorDepth + "bit";
  const lang = navigator.language || "en";
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "unknown";
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

  // Helpers
  const W = 46;
  const esc = (s) => s.replace(/&/g,"&amp;").replace(/</g,"&lt;");
  const fr = (s) => `<span class="sb-frame">${s}</span>`;
  const strip = (s) => s.replace(/<[^>]*>/g, "");
  const sep = () => fr("│") + " ".repeat(W - 2) + fr("│");
  const div = (ch = "─") => fr("├" + ch.repeat(W - 2) + "┤");
  const pad = (inner) => {
    const vis = strip(inner).length;
    const gap = Math.max(0, W - 4 - vis);
    return fr("│") + " " + inner + " ".repeat(gap) + " " + fr("│");
  };

  const SB_CAT_COLORS = { writing: "var(--cyan)", journalism: "var(--blue)", project: "var(--purple)" };

  let L = [];
  L.push(fr("╭" + "─".repeat(W - 2) + "╮"));
  L.push(sep());

  // ── NEOFETCH with OS logo ──
  const info = [
    ["OS",       `ariana-web <span class="sb-dim">2.0</span>`],
    ["Host",     window._weatherData
      ? `${window._weatherData.city}, <span class="sb-val">${window._weatherData.country}</span>`
      : `Helsinki, <span class="sb-val">FI</span>`],
    ["Uptime",   `<span class="sb-val">${uptimeStr}</span>`],
    ["Shell",    `/bin/visitor`],
    ["Theme",    `phosphor <span class="sb-dim">[dark]</span>`],
    ["Display",  `<span class="sb-val">${screenRes}</span> <span class="sb-dim">${colorDepth}</span>`],
    ["Viewport", `<span class="sb-val">${viewportRes}</span>`],
    ["Cores",    `<span class="sb-val">${cores}</span>`],
    ["Locale",   `<span class="sb-val">${lang}</span>`],
    ["Browser",  `<span class="sb-val">${browser}</span> <span class="sb-dim">${proto}</span>`],
  ];

  // Detect OS from UA
  const uaLower = ua.toLowerCase();
  let osName = "unknown";
  let osLogo = []; // each line is already HTML with color spans
  const LW = 16;
  const c = (color, text) => `<span style="color:${color}">${esc(text)}</span>`;

  if (uaLower.includes("android")) {
    osName = "Android";
    const g = "var(--cyan)";
    osLogo = [
      c(g,"  ;,           ,;"),
      c(g,"  ';,.-----.,;' "),
      c(g,"  ,'           ',"),
      c(g,"  /  ") + c("var(--white)","O") + c(g,"       ") + c("var(--white)","O") + c(g,"  \\"),
      c(g,"  |               |"),
      c(g,"  '-----------'   "),
    ];
  } else if (uaLower.includes("iphone") || uaLower.includes("ipad") || uaLower.includes("mac")) {
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
      "      " + c(w,".--.") + "      ",
      "     " + c(w,"|") + c(y,"o") + c(w,"_") + c(y,"o") + c(w," |") + "     ",
      "     " + c(w,"|") + c(y,":_/ ") + c(w,"|") + "     ",
      "    " + c(y,"//") + c(w,"   \\ \\") + "    ",
      "   " + c(y,"(|") + c(w,"     | )") + "   ",
      "  " + c(y,"/'\\") + c(w,"_   _/") + c(y,"`\\") + "  ",
      "  " + c(y,"\\___)") + c(w,"=(") + c(y,"___/") + "  ",
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
  osLogo = osLogo.map(l => {
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
    infoLines.push(`<span class="sb-nf-key">${key.padEnd(8)}</span><span class="sb-dim">:</span> ${val}`);
  }
  // Color palette row
  const colors = [
    "var(--cyan)", "var(--blue)", "var(--purple)", "var(--pink)",
    "var(--red)", "var(--amber)", "var(--yellow)", "var(--white)"
  ];
  infoLines.push("");
  infoLines.push(colors.map(c => `<span style="color:${c}">██</span>`).join(""));

  const maxLines = Math.max(osLogo.length, infoLines.length);
  for (let i = 0; i < maxLines; i++) {
    const logo = i < osLogo.length ? osLogo[i] : " ".repeat(LW);
    const inf  = i < infoLines.length ? infoLines[i] : "";
    L.push(pad(logo + " " + inf));
  }

  L.push(sep());
  L.push(div());
  L.push(sep());

  // ── CLOCK ──
  L.push(pad(`<span class="sb-label">CLOCK</span>`));
  L.push(sep());
  L.push(`<span id="sb-clock-line">${pad(`<span class="sb-val">${timeStr}</span>  <span class="sb-dim">${dateStr}</span>`)}</span>`);
  const tempColor = temp > 15 ? "var(--amber)" : temp > 5 ? "var(--yellow)" : temp > -5 ? "var(--blue)" : "var(--purple)";
  L.push(`<span id="sb-temp-line">${pad(`<span style="color:${tempColor}">${tempPrefix}${temp}°C</span>  <span class="sb-dim">${esc(tz)}</span>`)}</span>`);
  L.push(sep());
  L.push(pad(`<span class="sb-dim">day</span>  <span class="sb-bar">${dayBar}</span> <span class="sb-val">${dayPct}%</span>`));
  L.push(pad(`<span class="sb-dim">yr</span>   <span class="sb-val">${dayOfYear}</span><span class="sb-dim">/${totalDays}</span>` + " ".repeat(10) + `<span class="sb-val">${yearPct}%</span>`));

  L.push(sep());
  L.push(div("┄"));
  L.push(sep());

  // ── ARCHIVE ──
  L.push(pad(`<span class="sb-label">ARCHIVE</span>  <span class="sb-val">${sidebarItems.length}</span> <span class="sb-dim">entries</span>`));
  L.push(sep());
  for (const [cat, count] of catEntries) {
    const barLen = Math.round((count / maxCat) * 12);
    const catCol = SB_CAT_COLORS[cat] || "var(--cyan)";
    const catBar = `<span style="color:${catCol}">${"█".repeat(barLen)}</span><span class="sb-dim">${"░".repeat(12 - barLen)}</span>`;
    L.push(pad(`<span style="color:${catCol}">${esc(cat).padEnd(12)}</span>${catBar} <span class="sb-val">${String(count).padStart(2)}</span>`));
  }

  L.push(sep());
  L.push(div("┄"));
  L.push(sep());

  // ── TEMPERATURE SPARKLINE ──
  L.push(pad(`<span class="sb-label">TEMP</span>  <span class="sb-dim">Helsinki · approx</span>`));
  L.push(sep());
  let coloredSparkline = "";
  for (let m = 0; m < 12; m++) {
    const t = monthTemps[m];
    const col = t > 15 ? "var(--amber)" : t > 5 ? "var(--yellow)" : t > -5 ? "var(--cyan-dim)" : "var(--blue)";
    const highlight = m === currentMonth ? "font-weight:bold;text-shadow:0 0 6px currentColor" : "";
    coloredSparkline += `<span style="color:${col};${highlight}">${sparkline[m]}</span>`;
  }
  L.push(pad(`<span class="sb-dim">${monthLabels}</span>`));
  L.push(pad(coloredSparkline));
  L.push(pad(`<span class="sb-dim">${String(tMin).padStart(3)}°</span>` + " ".repeat(14) + `<span class="sb-dim">${String(tMax).padStart(3)}°</span>`));

  L.push(sep());
  L.push(div("┄"));
  L.push(sep());

  // ── EARTH ORBIT ──
  L.push(pad(`<span class="sb-label">ORBIT</span>  <span class="sb-dim">day</span> <span class="sb-val">${dayOfYear}</span><span class="sb-dim">/${totalDays}</span>  <span class="sb-val">${orbitDeg}°</span>`));
  L.push(sep());
  const orbitLinesHTML = [];
  for (const ol of orbitLines) {
    const colored = ol
      .replace("☀", `<span class="sb-sun">☀</span>`)
      .replace("🜨", `<span class="sb-earth">⊕</span>`);
    orbitLinesHTML.push(pad(colored));
  }
  L.push(`<span id="sb-orbit-lines">${orbitLinesHTML.join("\n")}</span>`);

  L.push(sep());
  L.push(fr("╰" + "─".repeat(W - 2) + "╯"));

  sb.innerHTML = L.join("\n");
  return sb;
}

// ── Live sidebar updates (clock + orbit animation) ──
function startSidebarUpdates(sb) {
  if (window._sidebarInterval) clearInterval(window._sidebarInterval);

  const W = 46;
  const fr = (s) => `<span class="sb-frame">${s}</span>`;
  const strip = (s) => s.replace(/<[^>]*>/g, "");
  const pad = (inner) => {
    const vis = strip(inner).length;
    const gap = Math.max(0, W - 4 - vis);
    return fr("│") + " " + inner + " ".repeat(gap) + " " + fr("│");
  };

  let orbitStep = 0;
  let tickCount = 0;

  window._sidebarInterval = setInterval(() => {
    tickCount++;

    // Refresh weather every 10 minutes
    if (tickCount % 600 === 0) fetchRealWeather();

    // Update clock
    const clockEl = sb.querySelector("#sb-clock-line");
    if (clockEl) {
      const now = new Date();
      const timeStr = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "Europe/Helsinki" });
      const dateStr = now.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "Europe/Helsinki" });
      clockEl.innerHTML = pad(`<span class="sb-val">${timeStr}</span>  <span class="sb-dim">${dateStr}</span>`);
    }

    // Animate orbit — advance earth position
    orbitStep++;
    const orbitEl = sb.querySelector("#sb-orbit-lines");
    if (orbitEl) {
      const now = new Date();
      const startOfYear = new Date(now.getFullYear(), 0, 1);
      const dayOfYear = Math.floor((now - startOfYear) / 864e5) + 1;
      const totalDays = (now.getFullYear() % 4 === 0) ? 366 : 365;
      // Base angle from real day + slow animated offset
      const baseAngle = (dayOfYear / totalDays) * 2 * Math.PI - Math.PI / 2;
      const animAngle = baseAngle + (orbitStep * 0.05);

      const OW = 19, OH = 7;
      const cx = 9, cy = 3, rx = 8, ry = 3;
      let grid = [];
      for (let y = 0; y < OH; y++) {
        let row = [];
        for (let x = 0; x < OW; x++) row.push(" ");
        grid.push(row);
      }
      for (let a = 0; a < 360; a += 4) {
        const rad = a * Math.PI / 180;
        const px = Math.round(cx + rx * Math.cos(rad));
        const py = Math.round(cy + ry * Math.sin(rad));
        if (px >= 0 && px < OW && py >= 0 && py < OH && grid[py][px] === " ") {
          grid[py][px] = "·";
        }
      }
      grid[cy][cx] = "☀";
      const ex = Math.round(cx + rx * Math.cos(animAngle));
      const ey = Math.round(cy + ry * Math.sin(animAngle));
      if (ex >= 0 && ex < OW && ey >= 0 && ey < OH) {
        grid[ey][ex] = "🜨";
      }
      const lines = grid.map(r => r.join(""));
      const html = lines.map(ol => {
        const colored = ol
          .replace("☀", `<span class="sb-sun">☀</span>`)
          .replace("🜨", `<span class="sb-earth">⊕</span>`);
        return pad(colored);
      }).join("\n");
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

  // ASCII title
  const titleArt = ASCII_TITLES[_currentTitleKey] || ASCII_TITLES.BLOG;
  const title = document.createElement("pre");
  title.className = "blog-title";
  title.textContent = titleArt.join("\n");
  listEl.appendChild(title);

  // Heading banner if filtered (e.g. "BLOG / WRITING")
  if (heading !== "BLOG" && heading !== "PROJECTS") {
    const hBanner = document.createElement("div");
    hBanner.className = "blog-filter-label";
    hBanner.textContent = `  ▸ ${heading}`;
    listEl.appendChild(hBanner);
  }

  // Wrapper: list left, sidebar right
  const wrap = document.createElement("div");
  wrap.className = "blog-wrap";

  // ── Article list ──
  const listPane = document.createElement("div");
  listPane.className = "blog-list-pane";

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
    const num = String(idx + 1).padStart(2, " ");
    const date = (item.date || "").slice(0, 10);
    const title = item.title || "—";
    const isRepo = item.isRepo ? " ↗" : "";
    const catTag = (CAT_LABELS[cat] || cat || "").slice(0, 5).toLowerCase();
    const catCls = CAT_COLORS[cat] || "c-info";

    row.innerHTML =
      `<span class="elr-cursor">${cursor}</span>` +
      `<span class="elr-idx">${num}</span>` +
      `<span class="elr-cat ${catCls}">${catTag}</span>` +
      `<span class="elr-title">${title}${isRepo}</span>` +
      `<span class="elr-date">${date}</span>`;

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

// ─────────────────────────────────────────────
// Render a post (content pre-loaded in loadContent)
// ─────────────────────────────────────────────
function openPost(post) {
  if (post.isRepo) {
    printLine("↗ " + post.title + "  —  opening on GitHub…", "c-info");
    window.open(post.url, "_blank");
    return;
  }
  blogMode = false;
  clearOutput(); // resets readerMode; set it back below
  readerMode = true;
  if (sbMode) sbMode.textContent = "READING";
  if (sbStatus) sbStatus.textContent = post.title || "";
  if (titleText && listItems.length) {
    titleText.textContent = `visitor@ariana:~  [ ${selectedPost + 1} / ${listItems.length} ]`;
  }
  if (!post.content) {
    printLine(`  ✗ content not available for: ${post.slug}`, "c-error");
    return;
  }
  renderMarkdown(post.content, post);
  printBlank();

  // ── Integrated navigation bar ──
  const nav = document.createElement("div");
  nav.className = "post-nav";

  const hasPrev = selectedPost > 0;
  const hasNext = selectedPost < listItems.length - 1;

  const prevBtn = document.createElement("button");
  prevBtn.className = "post-nav-btn" + (hasPrev ? "" : " disabled");
  prevBtn.textContent = "← prev";
  if (hasPrev) {
    prevBtn.addEventListener("click", () => {
      selectedPost--;
      openPost(listItems[selectedPost]);
    });
  }
  nav.appendChild(prevBtn);

  const center = document.createElement("span");
  center.className = "post-nav-center";
  center.textContent = `${selectedPost + 1} / ${listItems.length}  ·  type 'blog' for list  ·  'home' to go back`;
  nav.appendChild(center);

  const nextBtn = document.createElement("button");
  nextBtn.className = "post-nav-btn" + (hasNext ? "" : " disabled");
  nextBtn.textContent = "next →";
  if (hasNext) {
    nextBtn.addEventListener("click", () => {
      selectedPost++;
      openPost(listItems[selectedPost]);
    });
  }
  nav.appendChild(nextBtn);

  output.appendChild(nav);
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
  // links: [text](url)
  text = text.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a class="post-link" href="$2" target="_blank" rel="noopener">$1</a>',
  );
  return text;
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
    div.style.animationDelay = (_revealIdx * 25) + "ms";
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
  crumb.style.animationDelay = (_revealIdx * 25) + "ms";
  _revealIdx++;
  crumb.innerHTML =
    '<span class="bc-icon">📁</span> <span class="bc-seg">blog</span>' +
    ' <span class="bc-seg">/</span> ' +
    '<span class="bc-icon">📂</span> <span class="bc-seg">' +
    category +
    "</span>";
  output.appendChild(crumb);

  // ── Post header card — date on top, no left border ──
  const headerBox = document.createElement("div");
  headerBox.className = "post-header-box term-reveal";
  headerBox.style.animationDelay = (_revealIdx * 25) + "ms";
  _revealIdx++;

  const titleEl = document.createElement("div");
  titleEl.className = "post-header-title";
  titleEl.textContent = post.title || "";
  headerBox.appendChild(titleEl);

  if (post.description) {
    const descEl = document.createElement("div");
    descEl.className = "post-header-desc";
    descEl.textContent = post.description;
    headerBox.appendChild(descEl);
  }
  if (post.tags && post.tags.length) {
    const tagsEl = document.createElement("div");
    tagsEl.className = "post-header-tags";
    const tagsArr = Array.isArray(post.tags) ? post.tags : [post.tags];
    tagsEl.innerHTML = tagsArr.map((t) => `<span>${t}</span>`).join("");
    headerBox.appendChild(tagsEl);
  }
  output.appendChild(headerBox);

  printBlank();
  if (post.image) {
    const imgDiv = document.createElement("div");
    imgDiv.className = "post-image";
    imgDiv.innerHTML = `<img src="${post.image}" alt="${post.title || ""}">`;
    output.appendChild(imgDiv);
    printBlank();
  }

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
    ["   ┌─ COMMANDS ────────────────────────────────────────┐", "c-dim"],
    ["", ""],
  ];

  const cmds = [
    ["blog", "writing & journalism"],
    ["projects", "projects & repos"],
    ["about", "a bit more about me"],
    ["fortune", "wisdom from the machine"],
    ["gui", "switch to desktop mode"],
    ["help", "all commands"],
  ];

  for (const [name, desc] of cmds) {
    lines.push([
      `   │  <span class="hc-name">${name.padEnd(12)}</span> <span class="hc-arrow">→</span>  <span class="hc-desc">${desc}</span>`,
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
      if (!text) { div.className = "spacer"; }
    }
    homeMain.appendChild(div);
    i++;
    setTimeout(next, 35);
  }
  next();
}

// ─────────────────────────────────────────────
// Command registry
// ─────────────────────────────────────────────
const commands = {
  help: {
    description: "Show available commands",
    execute() {
      printLine(
        "   ┌─ COMMANDS ────────────────────────────────────────┐",
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
          `   │  <span class="hc-name">${n.padEnd(16)}</span> <span class="hc-arrow">→</span>  <span class="hc-desc">${d}</span>`,
          "home-cmd-line",
        );
      }
      printBlank();

      const termCmds = [
        ["home / exit", "return home"],
        ["gui", "switch to desktop (XP) mode"],
        ["clear", "clear screen"],
        ["fortune", "wisdom from the machine"],
      ];
      printLine("   │  Terminal", "c-dim");
      for (const [n, d] of termCmds) {
        printHTML(
          `   │  <span class="hc-name">${n.padEnd(16)}</span> <span class="hc-arrow">→</span>  <span class="hc-desc">${d}</span>`,
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
          `   │  <span class="hc-name">${n.padEnd(16)}</span> <span class="hc-arrow">→</span>  <span class="hc-desc">${d}</span>`,
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
        } else {
          printLine(`no entries found for category: ${cat}`, "c-error");
          const cats = [...new Set(blogItems.map((p) => p.category).filter(Boolean))];
          printLine(`available: ${cats.join(", ")}`, "c-info");
          return;
        }
      }
      showList(items, heading, "BLOG");
    },
  },

  projects: {
    description: "Browse projects & repos",
    execute() {
      clearOutput();
      const items = ALL.filter(
        (p) => p.category === "project" || p.isRepo,
      );
      showList(byDate(items), "PROJECTS", "PROJECTS");
    },
  },

  about: {
    description: "About me",
    execute() {
      clearOutput();
      printBlank();

      const banner = [
        "   ▄▀▄ █▀▄ █ ▄▀▄ █▄ █ ▄▀▄   █ █ █▀▀ █▄▀ █▀▄ ▄▀▄ █▄ █ ▄▀▀ █",
        "   █▀█ █▀▄ █ █▀█ █ ▀█ █▀█   ▀▄▀ █▀▀ █ █ █▀▄ █▀█ █ ▀█ █ █ █",
        "   ▀ ▀ ▀ ▀ ▀ ▀ ▀ ▀  ▀ ▀ ▀    ▀  ▀▀▀ ▀ ▀ ▀ ▀ ▀ ▀ ▀  ▀ ▀▀▀ ▀",
      ];
      for (const l of banner) printLine(l, "c-header");
      printBlank();

      const info = [
        ["  Location", "Helsinki, Finland"],
        ["  Role", "Journalist · Editor · Builder"],
      ];
      for (const [k, v] of info) {
        printHTML(
          `    <span class="c-green">${k.padEnd(14)}</span> <span class="c-dim">│</span>  <span class="c-white">${v}</span>`,
        );
      }
      printBlank();

      printLine("    ── INTERESTS ──", "c-info");
      const interests = [
        "global governance",
        "systems design",
        "quiet corners of the internet",
      ];
      for (const item of interests) {
        printHTML(
          `    <span class="c-green">▸</span>  <span class="c-white">${item}</span>`,
        );
      }
      printBlank();

      printLine("    ── CONTACT ──", "c-info");
      printHTML(
        '    <span class="c-green">▸</span>  <span class="c-white">ariana@example.com</span>',
      );
      printHTML(
        '    <span class="c-green">▸</span>  <span class="c-white">github.com/arianayekrangi</span>',
      );
      printBlank();
      printLine("    ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░", "c-dim");
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
      printHome();
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
    description: "Switch theme",
    execute(args) {
      if (args === "light")
        printLine("  light theme? in this economy?", "c-warn");
      else printLine("  usage: theme light", "c-info");
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
  printHome();
  terminal.scrollTop = 0;
  input.focus();
})();
