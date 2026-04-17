/* ════════════════════════════════════════
   apps.js — External app launcher config
   Add your projects here. Each entry gets:
     • a desktop icon that opens the app in Explorer
     • an iframe inside the Windows Explorer window
     • a Start menu entry
     • a "Programs" section in My Computer

   Fields:
     id          — unique slug (letters, numbers, hyphens)
     name        — display name
     url         — deployed URL to iframe
     icon        — emoji for titlebar / start menu / explorer
     color       — accent color for the generated desktop icon SVG
     desktopIcon — (optional) path to your own icon image, e.g. "images/myapp.png"
   ════════════════════════════════════════ */

"use strict";

const APPS = [
  {
    id: "borderlines",
    name: "Borderlines",
    url: "https://borderlines.un-aligned.org/",
    icon: "1",
    color: "#66aadd",
  },
  {
    id: "un-aligned",
    name: "UN-aligned",
    url: "https://un-aligned.org/",
    icon: "🌐",
    color: "#c94d10",
  },
];

// ── Helpers ─────────────────────────────────────────────────────────────────

function openApp(appId) {
  explorerNavigate(`app:${appId}`);
}

function _buildAppIcon(color) {
  return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 48 48'%3E%3Cdefs%3E%3ClinearGradient id='bg' x1='0' y1='0' x2='0' y2='1'%3E%3Cstop offset='0' stop-color='%231a3a5c'/%3E%3Cstop offset='1' stop-color='%230d1f33'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect x='4' y='4' width='40' height='40' rx='4' fill='url(%23bg)' stroke='%23456' stroke-width='1'/%3E%3Ccircle cx='24' cy='24' r='14' fill='none' stroke='${encodeURIComponent(color)}' stroke-width='1.5'/%3E%3Cellipse cx='24' cy='24' rx='14' ry='6' fill='none' stroke='${encodeURIComponent(color)}' stroke-width='0.8' transform='rotate(30 24 24)'/%3E%3Cellipse cx='24' cy='24' rx='14' ry='6' fill='none' stroke='${encodeURIComponent(color)}' stroke-width='0.8' transform='rotate(-30 24 24)'/%3E%3Ccircle cx='24' cy='24' r='2' fill='${encodeURIComponent(color)}'/%3E%3C/svg%3E`;
}

function initApps() {
  const iconArea = document.getElementById("icon-area");
  const terminalIcon = document.getElementById("terminal-icon");
  const aboutItem = document.getElementById("start-about-item");

  APPS.forEach((app) => {
    // 1. Desktop icon — insert before Terminal icon
    const div = document.createElement("div");
    div.className = "desktop-icon dynamic-app-icon";
    const iconSrc = app.desktopIcon || _buildAppIcon(app.color);
    div.innerHTML = `<img src="${iconSrc}" alt=""><span>${app.name}</span>`;
    const handler = () => openApp(app.id);
    if (_isMobile) {
      div.addEventListener("click", handler);
    } else {
      div.addEventListener("dblclick", handler);
    }
    if (terminalIcon) {
      iconArea.insertBefore(div, terminalIcon);
    } else {
      iconArea.appendChild(div);
    }

    // 2. Start menu entry — insert before About
    if (aboutItem) {
      const item = document.createElement("div");
      item.className = "start-item";
      item.textContent = `${app.icon} ${app.name}`;
      item.addEventListener("click", () => {
        openApp(app.id);
        toggleStart();
      });
      aboutItem.parentNode.insertBefore(item, aboutItem);
    }
  });
}
