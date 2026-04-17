/* ════════════════════════════════════════
   desktop.js — Desktop UI logic
   Depends on: js/manifest.js (SLUGS, IMAGE_FILES, SOURCE_TREE)
              js/shared.js (parseFrontmatter, byDate)
   ════════════════════════════════════════ */

"use strict";

let ALL_POSTS = [];

// ── SVG icon data URIs ──────────────────────────────────────────────────────
const ICON_DOC =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect x='6' y='2' width='20' height='28' rx='1' fill='%23fff' stroke='%23888'/%3E%3Crect x='9' y='8' width='14' height='2' fill='%23888'/%3E%3Crect x='9' y='13' width='14' height='2' fill='%23888'/%3E%3Crect x='9' y='18' width='10' height='2' fill='%23888'/%3E%3C/svg%3E";
const ICON_NEWS =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect x='2' y='6' width='28' height='22' rx='1' fill='%23fff' stroke='%23888'/%3E%3Crect x='4' y='10' width='24' height='3' fill='%23333'/%3E%3Crect x='4' y='16' width='10' height='9' fill='%23c0c0c0'/%3E%3Crect x='16' y='16' width='12' height='2' fill='%23aaa'/%3E%3Crect x='16' y='20' width='12' height='2' fill='%23aaa'/%3E%3C/svg%3E";
const ICON_PROJ =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect x='2' y='10' width='28' height='20' rx='1' fill='%23fff' stroke='%23888'/%3E%3Crect x='2' y='6' width='12' height='6' rx='1' fill='%23fff' stroke='%23888'/%3E%3Ctext x='8' y='25' font-size='10' font-family='monospace' fill='%23333'%3E%7B%7D%3C/text%3E%3C/svg%3E";
const ICON_REPO =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Ccircle cx='16' cy='16' r='14' fill='%23fff' stroke='%23888'/%3E%3Cpath fill='%23333' d='M16 5.4a10.6 10.6 0 0 0-3.35 20.66c.53.1.72-.23.72-.51v-1.8c-2.94.64-3.56-1.42-3.56-1.42a2.8 2.8 0 0 0-1.17-1.54c-.96-.65.07-.64.07-.64a2.22 2.22 0 0 1 1.62 1.09 2.25 2.25 0 0 0 3.08.88 2.26 2.26 0 0 1 .67-1.41c-2.35-.27-4.82-1.17-4.82-5.22a4.09 4.09 0 0 1 1.09-2.84 3.8 3.8 0 0 1 .1-2.8s.89-.28 2.9 1.08a10 10 0 0 1 5.28 0c2.02-1.36 2.9-1.08 2.9-1.08a3.8 3.8 0 0 1 .1 2.8 4.08 4.08 0 0 1 1.09 2.84c0 4.06-2.48 4.95-4.84 5.21a2.53 2.53 0 0 1 .72 1.96v2.9c0 .29.19.62.73.51A10.6 10.6 0 0 0 16 5.4z'/%3E%3C/svg%3E";
const ICON_PIC =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect x='4' y='4' width='24' height='22' rx='1' fill='%23fff' stroke='%23888'/%3E%3Crect x='6' y='6' width='20' height='18' fill='%23c5e8f7'/%3E%3Ccircle cx='12' cy='12' r='3' fill='%23ffd966'/%3E%3Cpath d='M6 24 l8-10 4 4 4-3 4 9z' fill='%235aad3a'/%3E%3C/svg%3E";
const ICON_FOLDER =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Cdefs%3E%3ClinearGradient id='mf' x1='0' y1='0' x2='0' y2='1'%3E%3Cstop offset='0' stop-color='%23ffe680'/%3E%3Cstop offset='1' stop-color='%23f5c518'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect x='2' y='10' width='28' height='18' rx='1' fill='url(%23mf)' stroke='%23c48a00'/%3E%3Crect x='2' y='7' width='12' height='5' rx='1' fill='url(%23mf)' stroke='%23c48a00'/%3E%3C/svg%3E";
const DESKTOP_FOLDER_SVG =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 48 48'%3E%3Cdefs%3E%3ClinearGradient id='fldr' x1='0' y1='0' x2='0' y2='1'%3E%3Cstop offset='0' stop-color='%23ffd966'/%3E%3Cstop offset='1' stop-color='%23e6a817'/%3E%3C/linearGradient%3E%3ClinearGradient id='fldrf' x1='0' y1='0' x2='0' y2='1'%3E%3Cstop offset='0' stop-color='%23ffe680'/%3E%3Cstop offset='1' stop-color='%23f5c518'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect x='4' y='16' width='40' height='28' rx='2' fill='url(%23fldr)' stroke='%23c48a00' stroke-width='1'/%3E%3Crect x='4' y='12' width='18' height='6' rx='2' fill='url(%23fldrf)' stroke='%23c48a00' stroke-width='1'/%3E%3Crect x='4' y='16' width='40' height='28' rx='2' fill='url(%23fldrf)'/%3E%3Cpath d='M4 20 Q24 16 44 20' stroke='%23c48a00' stroke-width='0.5' fill='none' opacity='0.5'/%3E%3C/svg%3E";

// parseFrontmatter is in js/shared.js

// ── Category config ─────────────────────────────────────────────────────────
const CATEGORY_CONFIG = {
  writing: {
    label: "Writing",
    winId: "win-writing",
    listId: "writing-list",
    countId: "writing-count",
    itemIcon: ICON_DOC,
    countWord: "essay",
  },
  journalism: {
    label: "Journalism",
    winId: "win-journalism",
    listId: "journalism-list",
    countId: "journalism-count",
    itemIcon: ICON_NEWS,
    countWord: "article",
  },
  project: {
    label: "Projects",
    winId: "win-projects",
    listId: "projects-list",
    countId: "projects-count",
    itemIcon: ICON_PROJ,
    countWord: "project",
  },
};

function normalizeCategory(raw) {
  const c = (raw || "writing").toLowerCase().trim();
  if (c === "projects") return "project";
  if (c === "essays" || c === "essay") return "writing";
  if (c === "articles" || c === "investigations" || c === "news")
    return "journalism";
  return c;
}

// ── Load all content on boot ────────────────────────────────────────────────
async function loadContent() {
  const results = await Promise.allSettled(
    SLUGS.map((slug) =>
      fetch(`blog/${slug}.md`).then((r) => {
        if (!r.ok) throw new Error(`${r.status}`);
        return r.text();
      }),
    ),
  );

  ALL_POSTS = results
    .map((r, i) => {
      if (r.status !== "fulfilled") return null;
      const { meta, body } = parseFrontmatter(r.value);
      return {
        slug: meta.slug || SLUGS[i],
        title: meta.title || SLUGS[i],
        date: meta.date || "",
        category: normalizeCategory(meta.category),
        tags: meta.tags || [],
        url: meta.url || "",
        description: meta.description || "",
        image: meta.image || "",
        content: r.value,
        _body: body,
      };
    })
    .filter(Boolean);

  populateLists();
}

// ── Populate file-explorer lists ────────────────────────────────────────────
function populateLists() {
  const groups = {};
  ALL_POSTS.forEach((p) => {
    if (!groups[p.category]) groups[p.category] = [];
    groups[p.category].push(p);
  });

  Object.entries(CATEGORY_CONFIG).forEach(([cat, cfg]) => {
    const items = byDate(groups[cat] || []);
    renderFileList(cfg.listId, cfg.countId, items, cfg.itemIcon, cfg.countWord);
  });

  buildCategoryIcons(groups);
  populateExplorer();
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPLORER — XP-style in-window navigation
// ═══════════════════════════════════════════════════════════════════════════
let _explorerHistory = [];
let _explorerHistoryIdx = -1;
let _explorerCurrent = "mycomputer";
let _thumbnailCache = {};

const EXPLORER_PAGES = {
  mycomputer: { title: "My Computer", icon: "💻", address: "My Computer" },
  mydocs: { title: "My Documents", icon: "📁", address: "C:\\My Documents" },
  mypics: { title: "My Pictures", icon: "🌄", address: "C:\\My Pictures" },
  source: { title: "Source Code", icon: "💾", address: "C:\\ariana.exe" },
  "source/js": { title: "js", icon: "📂", address: "C:\\ariana.exe\\js" },
  "source/css": { title: "css", icon: "📂", address: "C:\\ariana.exe\\css" },
  "source/blog": { title: "blog", icon: "📂", address: "C:\\ariana.exe\\blog" },
  "source/images": {
    title: "images",
    icon: "📂",
    address: "C:\\ariana.exe\\images",
  },
  "source/assets": {
    title: "assets",
    icon: "📂",
    address: "C:\\ariana.exe\\assets",
  },
};

// SOURCE_TREE lives in js/manifest.js (auto-generated by ./generate.sh)

const SOURCE_ICON_MAP = {
  html: "🌐",
  js: "📜",
  css: "🎨",
  md: "📝",
  txt: "📄",
  svg: "🖼️",
  mp3: "🔊",
  file: "📄",
};

function explorerNavigate(page) {
  openWindow("win-mycomputer");

  // If user double-clicks same page link, don't re-push
  if (_explorerCurrent !== page) {
    // Trim forward history
    _explorerHistory = _explorerHistory.slice(0, _explorerHistoryIdx + 1);
    _explorerHistory.push(page);
    _explorerHistoryIdx = _explorerHistory.length - 1;
  }

  _explorerCurrent = page;
  renderExplorerPage(page);
}

function explorerBack() {
  if (_explorerHistoryIdx > 0) {
    _explorerHistoryIdx--;
    _explorerCurrent = _explorerHistory[_explorerHistoryIdx];
    renderExplorerPage(_explorerCurrent);
  }
}

function populateExplorer() {
  // Initial load
  if (_explorerHistory.length === 0) {
    _explorerHistory = ["mycomputer"];
    _explorerHistoryIdx = 0;
  }
  renderExplorerPage(_explorerCurrent);
}

function renderExplorerPage(page) {
  const info = EXPLORER_PAGES[page] || EXPLORER_PAGES.mycomputer;
  document.getElementById("explorer-title").textContent = info.title;
  document.getElementById("explorer-icon").textContent = info.icon;
  document.getElementById("explorer-address").textContent = info.address;

  // Update taskbar label
  WINDOW_LABELS["win-mycomputer"] = `${info.icon} ${info.title}`;
  updateTaskbar();

  const backBtn = document.getElementById("explorer-back-btn");
  if (backBtn) backBtn.disabled = _explorerHistoryIdx <= 0;

  const sidebar = document.getElementById("explorer-sidebar");
  const main = document.getElementById("explorer-main");
  const countEl = document.getElementById("explorer-count");

  if (page === "mycomputer") renderMyComputer(sidebar, main, countEl);
  else if (page === "mydocs") renderMyDocs(sidebar, main, countEl);
  else if (page === "mypics") renderMyPics(sidebar, main, countEl);
  else if (page === "source" || page.startsWith("source/"))
    renderSourceCode(sidebar, main, countEl, page);
}

// ── Sidebar builder ─────────────────────────────────────────────────────────
function buildSidebar(sections) {
  return sections
    .map((s) => {
      const items = s.items
        .map(
          (i) =>
            `<div class="sidebar-link" onclick="${i.onclick}">${i.icon ? `<span class="sidebar-link-icon">${i.icon}</span>` : ""}${i.label}</div>`,
        )
        .join("");
      return `<div class="sidebar-section">
      <div class="sidebar-header">${s.title}</div>
      <div class="sidebar-items">${items}</div>
    </div>`;
    })
    .join("");
}

// ── My Computer page ────────────────────────────────────────────────────────
function renderMyComputer(sidebar, main, countEl) {
  sidebar.innerHTML = buildSidebar([
    {
      title: "System Tasks",
      items: [
        {
          icon: "ℹ️",
          label: "View system information",
          onclick: "openWindow('win-about')",
        },
      ],
    },
    {
      title: "Other Places",
      items: [
        {
          icon: "📁",
          label: "My Documents",
          onclick: "explorerNavigate('mydocs')",
        },
        {
          icon: "🌄",
          label: "My Pictures",
          onclick: "explorerNavigate('mypics')",
        },
      ],
    },
  ]);

  let html = "";

  // Files Stored on This Computer
  html += `<div class="explorer-section-header">Files Stored on This Computer</div>`;
  html += `<div class="explorer-file-grid">`;
  html += explorerFolderItem(
    "📁",
    "My Documents",
    "explorerNavigate('mydocs')",
  );
  html += explorerFolderItem("🌄", "My Pictures", "explorerNavigate('mypics')");
  html += `</div>`;

  // Hard Disk Drives
  html += `<div class="explorer-section-header">Hard Disk Drives</div>`;
  html += `<div class="explorer-file-grid">`;
  html += explorerFolderItem(
    "💾",
    "Local Disk (C:) — ariana.exe",
    "explorerNavigate('source')",
  );
  html += `</div>`;

  // Category folders as Hard Disk sections
  const groups = {};
  ALL_POSTS.forEach((p) => {
    if (!groups[p.category]) groups[p.category] = [];
    groups[p.category].push(p);
  });

  const activeCats = Object.entries(CATEGORY_CONFIG).filter(
    ([cat]) => groups[cat] && groups[cat].length > 0,
  );
  if (activeCats.length > 0) {
    html += `<div class="explorer-section-header">Content Folders</div>`;
    html += `<div class="explorer-file-grid">`;
    activeCats.forEach(([cat, cfg]) => {
      html += explorerFolderItem("📂", cfg.label, `openWindow('${cfg.winId}')`);
    });
    html += `</div>`;
  }

  main.innerHTML = html;
  if (countEl) countEl.textContent = `${3 + activeCats.length} items`;
}

function explorerFolderItem(icon, name, onclick) {
  return `<div class="explorer-item" onclick="${_isMobile ? onclick : ""}" ondblclick="${onclick}">
    <div class="explorer-item-icon">${icon}</div>
    <div class="explorer-item-name">${name}</div>
  </div>`;
}

// ── My Documents page ───────────────────────────────────────────────────────
function renderMyDocs(sidebar, main, countEl) {
  sidebar.innerHTML = buildSidebar([
    {
      title: "File and Folder Tasks",
      items: [
        { icon: "🔍", label: "Search for files or folders", onclick: "" },
      ],
    },
    {
      title: "Other Places",
      items: [
        {
          icon: "💻",
          label: "My Computer",
          onclick: "explorerNavigate('mycomputer')",
        },
        {
          icon: "🌄",
          label: "My Pictures",
          onclick: "explorerNavigate('mypics')",
        },
      ],
    },
  ]);

  const items = byDate(ALL_POSTS);
  let html = `<div class="explorer-file-grid">`;
  items.forEach((post) => {
    html += `<div class="explorer-item" onclick="${_isMobile ? "" : "selectExplorerItem(this)"}" ondblclick="openReader(ALL_POSTS.find(p=>p.slug==='${post.slug}'))">
      <div class="explorer-item-icon"><img src="${ICON_DOC}" alt="" style="width:32px;height:32px;"></div>
      <div class="explorer-item-name">${post.title}</div>
    </div>`;
    if (_isMobile) {
      // handled via event delegation below
    }
  });
  html += `</div>`;
  main.innerHTML = html;

  // Mobile: single click opens
  if (_isMobile) {
    main.querySelectorAll(".explorer-item").forEach((el, i) => {
      el.addEventListener("click", () => openReader(items[i]));
    });
  }

  if (countEl)
    countEl.textContent = `${items.length} document${items.length !== 1 ? "s" : ""}`;
}

// ── My Pictures page ────────────────────────────────────────────────────────
function renderMyPics(sidebar, main, countEl) {
  sidebar.innerHTML = buildSidebar([
    {
      title: "Picture Tasks",
      items: [{ icon: "🖼️", label: "View as a slide show", onclick: "" }],
    },
    {
      title: "File and Folder Tasks",
      items: [
        { icon: "🔍", label: "Search for files or folders", onclick: "" },
      ],
    },
    {
      title: "Other Places",
      items: [
        {
          icon: "💻",
          label: "My Computer",
          onclick: "explorerNavigate('mycomputer')",
        },
        {
          icon: "📁",
          label: "My Documents",
          onclick: "explorerNavigate('mydocs')",
        },
      ],
    },
  ]);

  const allImages = [];
  IMAGE_FILES.forEach((img) =>
    allImages.push({ name: img.name, path: img.path }),
  );
  ALL_POSTS.forEach((p) => {
    if (p.image && !allImages.find((i) => i.path === p.image)) {
      allImages.push({ name: p.image.split("/").pop(), path: p.image });
    }
  });

  let html = `<div class="explorer-pic-grid">`;
  allImages.forEach((img, idx) => {
    html += `<div class="explorer-pic-item" data-pic-idx="${idx}" ondblclick="openExplorerImage(${idx})">
      <div class="pic-thumbnail" id="thumb-${idx}"></div>
      <div class="explorer-item-name">${img.name}</div>
    </div>`;
  });
  html += `</div>`;
  main.innerHTML = html;

  if (_isMobile) {
    main.querySelectorAll(".explorer-pic-item").forEach((el) => {
      el.addEventListener("click", () =>
        openExplorerImage(parseInt(el.dataset.picIdx)),
      );
    });
  }

  // Render thumbnails
  allImages.forEach((img, idx) => renderThumbnail(img, idx));

  if (countEl)
    countEl.textContent = `${allImages.length} picture${allImages.length !== 1 ? "s" : ""}`;
}

// ── Source Code explorer ──────────────────────────────────
function renderSourceCode(sidebar, main, countEl, page) {
  const subFolder = page === "source" ? null : page.replace("source/", "");

  sidebar.innerHTML = buildSidebar([
    {
      title: "System Tasks",
      items: [
        {
          icon: "💻",
          label: "My Computer",
          onclick: "explorerNavigate('mycomputer')",
        },
      ],
    },
    {
      title: "Source Folders",
      items: [
        { icon: "📂", label: "js", onclick: "explorerNavigate('source/js')" },
        { icon: "📂", label: "css", onclick: "explorerNavigate('source/css')" },
        {
          icon: "📂",
          label: "blog",
          onclick: "explorerNavigate('source/blog')",
        },
        {
          icon: "📂",
          label: "images",
          onclick: "explorerNavigate('source/images')",
        },
        {
          icon: "📂",
          label: "assets",
          onclick: "explorerNavigate('source/assets')",
        },
      ],
    },
  ]);

  if (!subFolder) {
    // Root: show folders + root files
    let html = `<div class="explorer-section-header">Folders</div><div class="explorer-file-grid">`;
    ["js", "css", "blog", "images", "assets"].forEach((f) => {
      html += explorerFolderItem("📂", f, `explorerNavigate('source/${f}')`);
    });
    html += `</div>`;

    html += `<div class="explorer-section-header">Root Files</div><div class="explorer-file-grid">`;
    SOURCE_TREE.root.forEach((f) => {
      html += `<div class="explorer-item" ${_isMobile ? `onclick="openSourceFile('${f.path}')"` : ""} ondblclick="openSourceFile('${f.path}')" style="cursor:pointer;">
        <span style="font-size:24px;">${SOURCE_ICON_MAP[f.type] || "📄"}</span>
        <div class="explorer-item-name">${f.name}</div>
      </div>`;
    });
    html += `</div>`;
    main.innerHTML = html;

    const total = SOURCE_TREE.root.length + 5;
    if (countEl)
      countEl.textContent = `${total} object${total !== 1 ? "s" : ""}`;
  } else {
    const files = SOURCE_TREE[subFolder] || [];
    let html = `<div class="explorer-section-header">${subFolder}/</div><div class="explorer-file-grid">`;
    files.forEach((f) => {
      html += `<div class="explorer-item" ${_isMobile ? `onclick="openSourceFile('${f.path}')"` : ""} ondblclick="openSourceFile('${f.path}')" style="cursor:pointer;">
        <span style="font-size:24px;">${SOURCE_ICON_MAP[f.type] || "📄"}</span>
        <div class="explorer-item-name">${f.name}</div>
      </div>`;
    });
    html += `</div>`;
    main.innerHTML = html;

    if (countEl)
      countEl.textContent = `${files.length} file${files.length !== 1 ? "s" : ""}`;
  }
}

async function openSourceFile(path) {
  try {
    const r = await fetch(path);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const text = await r.text();
    const fname = path.split("/").pop();
    document.getElementById("notepad-title").textContent = fname + " - Notepad";
    document.getElementById("notepad-body").innerHTML =
      `<pre>${esc(text)}</pre>`;
    openWindow("win-notepad");
  } catch (e) {
    const fname = path.split("/").pop();
    document.getElementById("notepad-title").textContent = fname + " - Notepad";
    document.getElementById("notepad-body").innerHTML =
      `<pre>Could not load file: ${esc(e.message)}</pre>`;
    openWindow("win-notepad");
  }
}

// Store images list globally for the viewer
let _allImagesCache = [];

function getAllImages() {
  if (_allImagesCache.length > 0) return _allImagesCache;
  const allImages = [];
  IMAGE_FILES.forEach((img) =>
    allImages.push({ name: img.name, path: img.path }),
  );
  ALL_POSTS.forEach((p) => {
    if (p.image && !allImages.find((i) => i.path === p.image))
      allImages.push({ name: p.image.split("/").pop(), path: p.image });
  });
  _allImagesCache = allImages;
  return allImages;
}

async function renderThumbnail(img, idx) {
  const container = document.getElementById(`thumb-${idx}`);
  if (!container) return;

  if (_thumbnailCache[img.path]) {
    container.innerHTML = `<img src="${_thumbnailCache[img.path]}" alt="${img.name}">`;
    return;
  }

  try {
    const r = await fetch(img.path);
    if (!r.ok) throw new Error(`${r.status}`);
    const text = await r.text();

    const canvas = document.createElement("canvas");
    const lines = text.split("\n");
    const maxCols = Math.max(...lines.map((l) => l.length));
    const charW = 1.2,
      charH = 2;
    canvas.width = Math.min(maxCols * charW, 200);
    canvas.height = Math.min(lines.length * charH, 150);
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#333";
    ctx.font = `${charH}px monospace`;
    lines.forEach((line, y) => {
      ctx.fillText(line, 0, y * charH + charH);
    });
    const dataUrl = canvas.toDataURL("image/png");
    _thumbnailCache[img.path] = dataUrl;
    container.innerHTML = `<img src="${dataUrl}" alt="${img.name}">`;
  } catch {
    container.innerHTML = `<div style="width:80px;height:60px;background:#ddd;display:flex;align-items:center;justify-content:center;font-size:9px;color:#888;">No preview</div>`;
  }
}

async function openExplorerImage(idx) {
  const allImages = getAllImages();
  const img = allImages[idx];
  if (!img) return;
  try {
    const r = await fetch(img.path);
    if (!r.ok) throw new Error(`${r.status}`);
    const text = await r.text();
    document.getElementById("reader-title").textContent = img.name;
    const body = document.getElementById("reader-body");
    body.className = "reader-body reader-picture";
    body.innerHTML = `<pre style="font-family:monospace;font-size:4px;line-height:4px;overflow:hidden;white-space:pre;letter-spacing:0;margin:0;">${esc(text)}</pre>`;
    openWindow("win-reader");
  } catch (e) {
    document.getElementById("reader-title").textContent = img.name;
    const body = document.getElementById("reader-body");
    body.className = "reader-body reader-picture";
    body.innerHTML = `<p style="color:#800;">Failed to load: ${esc(e.message)}</p>`;
    openWindow("win-reader");
  }
}

function selectExplorerItem(el) {
  el.closest(".explorer-file-grid, .explorer-pic-grid")
    ?.querySelectorAll(".explorer-item, .explorer-pic-item")
    .forEach((f) => f.classList.remove("selected"));
  el.classList.add("selected");
}
function buildCategoryIcons(groups) {
  document
    .querySelectorAll(".dynamic-category-icon")
    .forEach((el) => el.remove());

  const aboutIcon = document.getElementById("about-icon");
  const iconArea = document.getElementById("icon-area");
  if (!iconArea || !aboutIcon) return;

  Object.entries(CATEGORY_CONFIG).forEach(([cat, cfg]) => {
    if (!groups[cat] || groups[cat].length === 0) return;

    const div = document.createElement("div");
    div.className = "desktop-icon dynamic-category-icon";
    div.innerHTML = `<img src="${DESKTOP_FOLDER_SVG}" alt=""><span>${cfg.label}</span>`;

    const handler = () => openWindow(cfg.winId);
    if (_isMobile) {
      div.addEventListener("click", handler);
    } else {
      div.addEventListener("dblclick", handler);
    }

    iconArea.insertBefore(div, aboutIcon);
  });

  // Update start menu category items
  buildStartMenuCategories(groups);
}

function buildStartMenuCategories(groups) {
  const container = document.getElementById("start-category-items");
  if (!container) return;
  container.innerHTML = "";

  const CATEGORY_ICONS = { writing: "📄", journalism: "📰", project: "💾" };

  Object.entries(CATEGORY_CONFIG).forEach(([cat, cfg]) => {
    if (!groups[cat] || groups[cat].length === 0) return;
    const div = document.createElement("div");
    div.className = "start-item";
    div.textContent = `${CATEGORY_ICONS[cat] || "📁"} ${cfg.label}`;
    div.addEventListener("click", () => {
      openWindow(cfg.winId);
      toggleStart();
    });
    container.appendChild(div);
  });
}

function renderFileList(listId, countId, items, icon, kind) {
  const el = document.getElementById(listId);
  const ct = document.getElementById(countId);
  if (!el) return;

  el.innerHTML = "";
  items.forEach((post) => {
    const div = document.createElement("div");
    div.className = "file-item";
    div.innerHTML = `<img src="${icon}" alt=""><span>${post.title}</span>`;
    div.addEventListener("click", () => selectFile(div));
    // On mobile: single click opens; on desktop: dblclick opens
    if (_isMobile) {
      div.addEventListener("click", () => openReader(post));
    } else {
      div.addEventListener("dblclick", () => openReader(post));
    }
    el.appendChild(div);
  });

  if (ct)
    ct.textContent = `${items.length} ${kind}${items.length !== 1 ? "s" : ""}`;
}

function selectFile(el) {
  el.closest(".file-list")
    .querySelectorAll(".file-item")
    .forEach((f) => f.classList.remove("selected"));
  el.classList.add("selected");
}

// ── Reader ──────────────────────────────────────────────────────────────────
function openReader(post) {
  const win = document.getElementById("win-reader");
  document.getElementById("reader-title").textContent = post.title;

  let metaHtml = `<div class="reader-meta">`;
  if (post.date) metaHtml += `<strong>${post.date}</strong>`;
  if (post.tags?.length) metaHtml += ` &nbsp;·&nbsp; ${post.tags.join(", ")}`;
  if (post.url && post.url.startsWith("http"))
    metaHtml += ` &nbsp;·&nbsp; <a href="${post.url}" target="_blank">↗ view on GitHub</a>`;
  metaHtml += `</div>`;

  const imgHtml = post.image
    ? `<img src="${post.image}" alt="${post.title}" class="reader-image">`
    : "";
  const descHtml = post.description
    ? `<p class="reader-description">${post.description}</p>`
    : "";

  const bodyHtml = renderMarkdown(post._body || post.content);
  const body = document.getElementById("reader-body");
  body.className = "reader-body";
  body.innerHTML = `<h1>${post.title}</h1>${metaHtml}${descHtml}${imgHtml}${bodyHtml}`;

  openWindow("win-reader");
}

// ── Minimal markdown → HTML ─────────────────────────────────────────────────
function renderMarkdown(md) {
  // strip leading frontmatter if present
  md = md.replace(/^---[\s\S]*?---\s*\n?/, "");

  const lines = md.split("\n");
  const out = [];
  let inPara = false;

  function closePara() {
    if (inPara) {
      out.push("</p>");
      inPara = false;
    }
  }

  lines.forEach((raw) => {
    const line = raw.trimEnd();
    if (!line.trim()) {
      closePara();
      return;
    }
    if (line.startsWith("### ")) {
      closePara();
      out.push(`<h3>${esc(line.slice(4))}</h3>`);
      return;
    }
    if (line.startsWith("## ")) {
      closePara();
      out.push(`<h2>${esc(line.slice(3))}</h2>`);
      return;
    }
    if (line.startsWith("# ")) {
      closePara();
      out.push(`<h1>${esc(line.slice(2))}</h1>`);
      return;
    }
    if (line === "---" || line === "***") {
      closePara();
      out.push("<hr>");
      return;
    }

    const inline = inlineMarkdown(line);
    if (!inPara) {
      out.push("<p>");
      inPara = true;
    } else out.push(" ");
    out.push(inline);
  });
  closePara();
  return out.join("");
}

function inlineMarkdown(s) {
  s = s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');
  return s;
}
function esc(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// ── Window management ───────────────────────────────────────────────────────
let zTop = 100;
const windowOrder = [];

function bringToFront(id) {
  zTop++;
  const win = document.getElementById(id);
  if (win) win.style.zIndex = zTop;

  // update active titlebar states
  document
    .querySelectorAll(".win-titlebar")
    .forEach((tb) => tb.classList.add("inactive"));
  win?.querySelector(".win-titlebar")?.classList.remove("inactive");

  if (!windowOrder.includes(id)) windowOrder.push(id);
}

// ── Taskbar ─────────────────────────────────────────────────────────────────
const WINDOW_LABELS = {
  "win-writing": "📄 Writing",
  "win-journalism": "📰 Journalism",
  "win-projects": "💾 Projects",
  "win-about": "👤 About",
  "win-github": "🐙 GitHub",
  "win-reader": "📖 Article",
  "win-notepad": "📝 Notepad",
  "win-mycomputer": "💻 My Computer",
  "win-studio": "✦ ASCII Studio",
};

// Track which windows are minimized (hidden but still in taskbar)
const minimizedSet = new Set();

function minimizeWindow(id) {
  const win = document.getElementById(id);
  if (!win) return;
  win.hidden = true;
  minimizedSet.add(id);
  updateTaskbar();
}

function closeWindow(id) {
  const win = document.getElementById(id);
  if (!win) return;
  win.hidden = true;
  minimizedSet.delete(id);
  const idx = windowOrder.indexOf(id);
  if (idx !== -1) windowOrder.splice(idx, 1);
  updateTaskbar();
}

function openWindow(id) {
  const win = document.getElementById(id);
  if (!win) return;
  win.hidden = false;
  minimizedSet.delete(id);
  bringToFront(id);
  updateTaskbar();
  document.getElementById("start-menu").hidden = true;
}

let _studioLoaded = false;
function openStudio() {
  openWindow("win-studio");
  // Auto-maximize on touch devices
  var win = document.getElementById("win-studio");
  if (
    win &&
    !win.classList.contains("maximized") &&
    navigator.maxTouchPoints > 1
  ) {
    maximizeWindow("win-studio");
  }
  const iframe = document.getElementById("studio-iframe");
  const loading = document.getElementById("studio-loading");
  if (!_studioLoaded && iframe) {
    _studioLoaded = true;
    loading.hidden = false;
    iframe.style.visibility = "hidden";
    iframe.src = "studio/index.html?embedded=1";
    const bootStart = Date.now();
    const minBootTime = 1500; // let the boot animation play fully
    iframe.addEventListener(
      "load",
      () => {
        const elapsed = Date.now() - bootStart;
        const remaining = Math.max(0, minBootTime - elapsed);
        setTimeout(() => {
          loading.hidden = true;
          iframe.style.visibility = "";
        }, remaining);
      },
      { once: true },
    );
  }
}

// Store original rect for maximize toggle
const _origRect = {};

function maximizeWindow(id) {
  const win = document.getElementById(id);
  if (!win) return;
  if (win.classList.contains("maximized")) {
    // Restore
    win.classList.remove("maximized");
    const r = _origRect[id];
    if (r) {
      win.style.top = r.top;
      win.style.left = r.left;
      win.style.width = r.width;
      win.style.height = r.height;
    }
  } else {
    // Save current inline styles (may be empty if CSS-positioned)
    _origRect[id] = {
      top: win.style.top,
      left: win.style.left,
      width: win.style.width,
      height: win.style.height,
    };
    // Clear inline styles so .maximized CSS !important rules apply cleanly
    win.style.top = "";
    win.style.left = "";
    win.style.width = "";
    win.style.height = "";
    win.classList.add("maximized");
  }
}

// Listen for postMessage from embedded studio iframe
window.addEventListener("message", (e) => {
  if (e.data === "studio-close") closeWindow("win-studio");
  else if (e.data === "studio-minimize") minimizeWindow("win-studio");
  else if (e.data === "studio-maximize") maximizeWindow("win-studio");
});

function updateTaskbar() {
  const bar = document.getElementById("taskbar-items");
  bar.innerHTML = "";
  // Show all open OR minimized windows
  const allTracked = [...new Set([...windowOrder, ...minimizedSet])];
  allTracked.forEach((id) => {
    const win = document.getElementById(id);
    if (!win) return;
    const isMinimized = minimizedSet.has(id);
    const btn = document.createElement("button");
    btn.className = "taskbar-btn" + (isMinimized ? " minimized" : "");
    btn.textContent = WINDOW_LABELS[id] || id;
    btn.addEventListener("click", () => {
      if (minimizedSet.has(id)) {
        openWindow(id);
      } else {
        minimizeWindow(id);
      }
    });
    bar.appendChild(btn);
  });
}

// ── Mobile detection ─────────────────────────────────────────────────────────
const _isMobile =
  /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent,
  ) ||
  (navigator.maxTouchPoints > 0 && window.innerWidth <= 768);

// ── Drag (windows) + Rubber-band selection ────────────────────────────────────────────
let _drag = null;
let _sel = null;

function dragStart(e, id) {
  bringToFront(id);
  const win = document.getElementById(id);
  // Prevent maximized windows from being dragged
  if (win.classList.contains("maximized")) return;
  const rect = win.getBoundingClientRect();
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  _drag = { id, ox: clientX - rect.left, oy: clientY - rect.top };
  // Disable pointer events on all iframes so they don't steal mousemove
  document
    .querySelectorAll("iframe")
    .forEach((f) => (f.style.pointerEvents = "none"));
  e.preventDefault();
}

document.addEventListener("mousemove", (e) => {
  if (_drag) {
    const win = document.getElementById(_drag.id);
    if (win) {
      win.style.left = e.clientX - _drag.ox + "px";
      win.style.top = e.clientY - _drag.oy + "px";
    }
  }
  if (_sel) {
    const desktop = document.getElementById("desktop");
    const dr = desktop.getBoundingClientRect();
    const cx = e.clientX - dr.left,
      cy = e.clientY - dr.top;
    const x = Math.min(_sel.x0, cx),
      y = Math.min(_sel.y0, cy);
    const w = Math.abs(cx - _sel.x0),
      h = Math.abs(cy - _sel.y0);
    const sr = document.getElementById("selection-rect");
    sr.style.left = x + "px";
    sr.style.top = y + "px";
    sr.style.width = w + "px";
    sr.style.height = h + "px";
    document.querySelectorAll(".desktop-icon").forEach((icon) => {
      const ir = icon.getBoundingClientRect();
      const il = ir.left - dr.left,
        it = ir.top - dr.top;
      const iR = ir.right - dr.left,
        iB = ir.bottom - dr.top;
      icon.classList.toggle(
        "selected",
        !(iR < x || il > x + w || iB < y || it > y + h),
      );
    });
  }
});

// Touch drag support for windows
document.addEventListener(
  "touchmove",
  (e) => {
    if (_drag) {
      const t = e.touches[0];
      const win = document.getElementById(_drag.id);
      if (win) {
        win.style.left = t.clientX - _drag.ox + "px";
        win.style.top = t.clientY - _drag.oy + "px";
      }
      e.preventDefault();
    }
  },
  { passive: false },
);

document.addEventListener("mouseup", () => {
  if (_drag) {
    document
      .querySelectorAll("iframe")
      .forEach((f) => (f.style.pointerEvents = ""));
  }
  _drag = null;
  if (_sel) {
    _sel = null;
    const sr = document.getElementById("selection-rect");
    if (sr) sr.hidden = true;
  }
});

document.addEventListener("touchend", () => {
  if (_drag) {
    document
      .querySelectorAll("iframe")
      .forEach((f) => (f.style.pointerEvents = ""));
  }
  _drag = null;
});

// ── Desktop mousedown: deactivate titlebars + rubber-band selection ───────────────
document.getElementById("desktop")?.addEventListener("mousedown", (e) => {
  if (!e.target.closest(".xp-window")) {
    document
      .querySelectorAll(".win-titlebar")
      .forEach((tb) => tb.classList.add("inactive"));
  }
  if (e.button !== 0) return;
  if (
    e.target.closest(".xp-window") ||
    e.target.closest("#taskbar") ||
    e.target.closest("#start-menu") ||
    e.target.closest("#desktop-ctx-menu")
  )
    return;

  // Single-click icon: select it, deselect others
  const iconEl = e.target.closest(".desktop-icon");
  if (iconEl) {
    document
      .querySelectorAll(".desktop-icon")
      .forEach((i) => i.classList.remove("selected"));
    iconEl.classList.add("selected");
    return;
  }

  // Click on empty desktop: start rubber-band
  const dr = document.getElementById("desktop").getBoundingClientRect();
  _sel = { x0: e.clientX - dr.left, y0: e.clientY - dr.top };
  const sr = document.getElementById("selection-rect");
  sr.style.cssText = `left:${_sel.x0}px;top:${_sel.y0}px;width:0;height:0;`;
  sr.hidden = false;
  document
    .querySelectorAll(".desktop-icon")
    .forEach((i) => i.classList.remove("selected"));
  e.preventDefault();
});

// ── Clock ────────────────────────────────────────────────────────────────────
function updateClock() {
  const el = document.getElementById("taskbar-clock");
  if (!el) return;
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  el.textContent = `${hh}:${mm}`;
}
setInterval(updateClock, 5000);

// ── Start menu toggle ────────────────────────────────────────────────────────
function toggleStart() {
  const m = document.getElementById("start-menu");
  m.hidden = !m.hidden;
}

// close start menu and context menu on outside click
document.addEventListener("mousedown", (e) => {
  if (!e.target.closest("#start-menu") && !e.target.closest(".start-btn")) {
    document.getElementById("start-menu").hidden = true;
  }
  if (!e.target.closest("#desktop-ctx-menu")) {
    hideCtxMenu();
  }
});

// ── Escape to terminal ────────────────────────────────────────────────────────
function goTerminal() {
  sessionStorage.setItem("preferTerminal", "1");
  window.location.href = "./";
}

// ── GitHub repos ─────────────────────────────────────────────────────────────
const GITHUB_USERNAME = "yekrangiariana";

async function fetchGitHubRepos() {
  const listEl = document.getElementById("github-list");
  const countEl = document.getElementById("github-count");
  const errEl = document.getElementById("github-error");
  try {
    const r = await fetch(
      `https://api.github.com/users/${GITHUB_USERNAME}/repos?sort=updated&per_page=100&type=public`,
      { headers: { Accept: "application/vnd.github+json" } },
    );
    if (!r.ok) throw new Error(`GitHub API returned ${r.status}`);
    const repos = await r.json();

    // own repos only (not forks), sorted newest-updated first
    const own = repos
      .filter((repo) => !repo.fork)
      .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));

    if (!listEl) return;
    listEl.innerHTML = "";
    own.forEach((repo) => {
      const div = document.createElement("div");
      div.className = "file-item";
      div.innerHTML = `<img src="${ICON_REPO}" alt=""><span>${esc(repo.name)}</span>`;
      div.addEventListener("click", () => selectFile(div));
      if (_isMobile) {
        div.addEventListener("click", () => openRepoReader(repo));
      } else {
        div.addEventListener("dblclick", () => openRepoReader(repo));
      }
      listEl.appendChild(div);
    });

    if (countEl)
      countEl.textContent = `${own.length} repositor${own.length !== 1 ? "ies" : "y"}`;
  } catch (e) {
    if (countEl) countEl.textContent = "Failed to load";
    if (errEl) {
      errEl.hidden = false;
      errEl.textContent = `✗ ${e.message}`;
    }
  }
}

async function openRepoReader(repo) {
  document.getElementById("reader-title").textContent = repo.name;

  let meta = `<div class="reader-meta">`;
  if (repo.language)
    meta += `<strong>${esc(repo.language)}</strong> &nbsp;·&nbsp; `;
  meta += `⭐ ${repo.stargazers_count}`;
  if (repo.updated_at)
    meta += ` &nbsp;·&nbsp; Updated ${repo.updated_at.slice(0, 10)}`;
  meta += ` &nbsp;·&nbsp; <a href="${repo.html_url}" target="_blank">↗ View on GitHub</a>`;
  meta += `</div>`;

  let body = "";
  if (repo.description) body += `<p>${esc(repo.description)}</p>`;
  if (repo.topics?.length)
    body += `<p><strong>Topics:</strong> ${repo.topics.map(esc).join(", ")}</p>`;
  if (repo.homepage)
    body += `<p><strong>Homepage:</strong> <a href="${repo.homepage}" target="_blank">${esc(repo.homepage)}</a></p>`;

  // Show skeleton immediately, open window, then load README
  document.getElementById("reader-body").innerHTML =
    `<h1>${esc(repo.name)}</h1>${meta}${body}<p class="readme-loading" style="color:#888;font-style:italic">Loading README…</p>`;

  openWindow("win-reader");

  try {
    const r = await fetch(
      `https://api.github.com/repos/${GITHUB_USERNAME}/${repo.name}/readme`,
      { headers: { Accept: "application/vnd.github.raw+json" } },
    );
    if (!r.ok) throw new Error("no readme");
    const md = await r.text();
    const readmeHtml = renderMarkdown(md);
    const readerBody = document.getElementById("reader-body");
    const loading = readerBody.querySelector(".readme-loading");
    if (loading) loading.remove();
    const section = document.createElement("div");
    section.innerHTML = `<hr><h2 style="margin:14px 0 8px">README</h2>${readmeHtml}`;
    readerBody.appendChild(section);
  } catch {
    const loading = document
      .getElementById("reader-body")
      ?.querySelector(".readme-loading");
    if (loading) loading.textContent = "No README available.";
  }
}

// ── Startup Sound ─────────────────────────────────────────────────────────────
function playStartupSound() {
  const audio = document.getElementById("startup-sound");
  if (!audio) return;
  audio.volume = 0.5;
  audio.currentTime = 0;
  audio.play().catch(() => {
    /* autoplay blocked */
  });
}

// ── Context Menu ──────────────────────────────────────────────────────────────
function showCtxMenu(x, y) {
  const menu = document.getElementById("desktop-ctx-menu");
  menu.style.left = x + "px";
  menu.style.top = y + "px";
  menu.hidden = false;
  // Nudge back on-screen if clipping
  const mw = menu.offsetWidth,
    mh = menu.offsetHeight;
  if (x + mw > window.innerWidth)
    menu.style.left = window.innerWidth - mw - 2 + "px";
  if (y + mh > window.innerHeight - 28)
    menu.style.top = window.innerHeight - 28 - mh - 2 + "px";
}

function hideCtxMenu() {
  const m = document.getElementById("desktop-ctx-menu");
  if (m) m.hidden = true;
}

function ctxRefresh() {
  hideCtxMenu();
  loadContent();
}

document.getElementById("desktop")?.addEventListener("contextmenu", (e) => {
  if (e.target.closest(".xp-window") || e.target.closest("#taskbar")) return;
  e.preventDefault();
  showCtxMenu(e.clientX, e.clientY);
});

// ── CAPTCHA ───────────────────────────────────────────────────────────────────
const REQUIRED_PHRASE = "free palestine";

function captchaSubmit() {
  const val = document
    .getElementById("captcha-input")
    .value.trim()
    .toLowerCase();
  const err = document.getElementById("captcha-error");
  if (val === REQUIRED_PHRASE) {
    sessionStorage.setItem("captchaPassed", "1");
    enterDesktop();
  } else {
    err.hidden = false;
    document.getElementById("captcha-input").value = "";
    document.getElementById("captcha-input").focus();
  }
}

function captchaFail() {
  window.location.href = "./";
}

function enterDesktop() {
  document.getElementById("captcha-overlay").remove();
  document.getElementById("desktop").hidden = false;
  playStartupSound();

  // Deep-link: auto-open ASCII Studio if hash requests it
  if (location.hash === "#ascii-studio") {
    openStudio();
    history.replaceState(null, "", location.pathname);
  }
}

// Enter key on captcha input
document.getElementById("captcha-input")?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") captchaSubmit();
});

// ── Boot ──────────────────────────────────────────────────────────────────────
updateClock();
loadContent();
fetchGitHubRepos();

// Add touch support for window title bar dragging
document.querySelectorAll(".win-titlebar").forEach((tb) => {
  tb.addEventListener(
    "touchstart",
    (e) => {
      // Don't intercept taps on buttons (close, minimize, etc.)
      if (e.target.closest("button") || e.target.closest(".win-controls"))
        return;
      const win = tb.closest(".xp-window");
      if (win) dragStart(e, win.id);
    },
    { passive: false },
  );
});

// On mobile: desktop icons open with a single tap (not double-click)
if (_isMobile) {
  document.querySelectorAll(".desktop-icon").forEach((icon) => {
    const origDbl = icon.getAttribute("ondblclick");
    if (origDbl) {
      icon.removeAttribute("ondblclick");
      icon.addEventListener("click", () => {
        new Function(origDbl)();
      });
    }
  });

  // Ensure window control buttons respond to touch
  document.querySelectorAll(".win-controls button").forEach((btn) => {
    btn.addEventListener(
      "touchend",
      (e) => {
        e.preventDefault();
        e.stopPropagation();
        btn.click();
      },
      { passive: false },
    );
  });
}

// Skip captcha if already passed this session
if (sessionStorage.getItem("captchaPassed") === "1") {
  enterDesktop();
} else {
  // Auto-focus captcha input immediately
  document.getElementById("captcha-input")?.focus();
}
