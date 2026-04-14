// ════════════════════════════════════════════════════════════════
// clock.js — ASCII Analog Clock + World Clock Widget
//
// Renders a moving analog clock face in terminal-style ASCII.
// Uses the widget box helper functions from widgets.js.
// ════════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════════
// DOUBLE-WIDTH: ANALOG CLOCK  (12 lines)
// Local time with ASCII clock face (9-row compact)
// ══════════════════════════════════════════════════════════════
function _wAnalogClock() {
  const now = new Date();
  const lH = now.getHours();
  const lM = now.getMinutes();
  const lS = now.getSeconds();

  const face = _clockRenderCompact(lH, lM, lS);

  const timeStr = now.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const dateStr = now.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  // Detect local timezone abbreviation
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "unknown";
  const tzShort = tz.split("/").pop() || tz;

  // Day/year progress
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const dayOfYear = Math.floor((now - startOfYear) / 864e5) + 1;
  const totalDays = now.getFullYear() % 4 === 0 ? 366 : 365;
  const yearPct = Math.round((dayOfYear / totalDays) * 100);
  const dayPct = Math.round((lH * 60 + lM) / 14.4);
  const dayFill = Math.round(dayPct / 10);
  const dayBar = "\u2588".repeat(dayFill) + "\u2591".repeat(10 - dayFill);

  // Temperature — real if available, seasonal estimate as fallback
  const tempPhase = ((dayOfYear - 105) / totalDays) * 2 * Math.PI;
  const temp =
    window._weatherData?.temp ?? Math.round(5.5 + 12 * Math.sin(tempPhase));
  const tempPrefix = window._weatherData ? "" : "~";
  const tempColor =
    temp > 15
      ? "var(--amber)"
      : temp > 5
        ? "var(--yellow)"
        : temp > -5
          ? "var(--blue)"
          : "var(--purple)";

  // Right-side info (9 lines to match face rows)
  const CL = 25;
  const infoLines = [
    ``,
    ` <span class="sb-label">LOCAL</span>`,
    ` <span class="clk-time">${timeStr}</span>`,
    ` <span class="sb-dim">${dateStr}</span>`,
    ``,
    ` <span class="sb-dim">zone</span>  ${_wval(tzShort)}`,
    ` <span class="sb-dim">day</span> <span class="sb-bar">${dayBar}</span> ${_wval(dayPct + "%")}`,
    ` <span class="sb-dim">yr</span>  ${_wval(String(dayOfYear))}<span class="sb-dim">/${totalDays}</span> ${_wval(yearPct + "%")}`,
    ` <span style="color:${tempColor}">${tempPrefix}${temp}°C</span> <span class="clk-sec">${lS % 2 === 0 ? "●" : "○"}</span>`,
  ];

  function _clkRow(left, right) {
    const lVis = _wstrip(left).length;
    const pad = Math.max(0, CL - lVis);
    const combined = left + " ".repeat(pad) + _wcol("var(--grey)", "│") + right;
    return _wdpad(combined);
  }

  const L = [];
  L.push(_wdtop()); // 1
  L.push(_clkRow("", "")); // 2

  for (let i = 0; i < 9; i++) {
    // 3-11
    const left = " " + (face[i] || "");
    const right = infoLines[i] || "";
    L.push(_clkRow(left, right));
  }

  L.push(_wdbot()); // 12
  return { html: L.join("\n"), size: "double" };
}

// Compact clock face: 21 wide × 9 tall
function _clockRenderCompact(hours, minutes, seconds) {
  const W = 21,
    H = 9;
  const cx = 10,
    cy = 4;
  const rx = 9.5,
    ry = 3.8;

  const grid = [];
  for (let y = 0; y < H; y++) {
    grid[y] = [];
    for (let x = 0; x < W; x++) grid[y][x] = " ";
  }

  // Circle outline
  for (let a = 0; a < 360; a += 2) {
    const rad = (a * Math.PI) / 180;
    const px = Math.round(cx + rx * Math.cos(rad));
    const py = Math.round(cy + ry * Math.sin(rad));
    if (px >= 0 && px < W && py >= 0 && py < H && grid[py][px] === " ") {
      grid[py][px] = "·";
    }
  }

  // Hour markers — place at inner radius
  for (let i = 0; i < 12; i++) {
    const angle = ((i * 30 - 90) * Math.PI) / 180;
    const mx = Math.round(cx + (rx - 0.5) * Math.cos(angle));
    const my = Math.round(cy + (ry - 0.3) * Math.sin(angle));
    if (mx >= 0 && mx < W && my >= 0 && my < H) {
      // Use simple tick marks for compactness
      const num = i === 0 ? "12" : String(i);
      if (num.length === 2 && mx > 0) {
        grid[my][mx - 1] = num[0];
        grid[my][mx] = num[1];
      } else {
        grid[my][mx] = num;
      }
    }
  }

  // Draw hand via Bresenham-like stepping
  function drawHand(angleDeg, lengthRatio, ch) {
    const rad = ((angleDeg - 90) * Math.PI) / 180;
    const len = lengthRatio;
    const steps = Math.ceil(len * 10);
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      const ex = Math.round(cx + len * Math.cos(rad) * t);
      const ey = Math.round(cy + len * (ry / rx) * Math.sin(rad) * t);
      if (ex >= 0 && ex < W && ey >= 0 && ey < H) {
        grid[ey][ex] = ch;
      }
    }
  }

  // Hour hand
  const hourAngle = ((hours % 12) + minutes / 60) * 30;
  drawHand(hourAngle, 4, "H");

  // Minute hand
  const minuteAngle = (minutes + seconds / 60) * 6;
  drawHand(minuteAngle, 6.5, "M");

  // Second hand
  const secondAngle = seconds * 6;
  drawHand(secondAngle, 8, "s");

  // Center
  grid[cy][cx] = "+";

  // Render with color spans
  return grid.map((row) => {
    let line = "";
    for (const ch of row) {
      if (ch === "H") line += `<span class="clk-hour">█</span>`;
      else if (ch === "M") line += `<span class="clk-min">▓</span>`;
      else if (ch === "s") line += `<span class="clk-sec">·</span>`;
      else if (ch === "+") line += `<span class="clk-center">◉</span>`;
      else if (ch === "·") line += `<span class="clk-ring">·</span>`;
      else if (ch >= "0" && ch <= "9")
        line += `<span class="clk-mark">${ch}</span>`;
      else line += ch;
    }
    return line;
  });
}

// ══════════════════════════════════════════════════════════════
// SINGLE-WIDTH: WORLD CLOCK  (12 lines)
// Shows 4 city times
// ══════════════════════════════════════════════════════════════
function _wWorldClock() {
  const now = new Date();

  const cities = [
    { label: "LONDON", tz: "Europe/London", color: "var(--cyan)" },
    { label: "NEW YORK", tz: "America/New_York", color: "var(--blue)" },
    { label: "TOKYO", tz: "Asia/Tokyo", color: "var(--pink)" },
    { label: "SYDNEY", tz: "Australia/Sydney", color: "var(--amber)" },
  ];

  const rows = [];
  for (const c of cities) {
    const t = now.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      timeZone: c.tz,
    });
    const d = now.toLocaleDateString("en-GB", {
      weekday: "short",
      timeZone: c.tz,
    });
    const h = parseInt(
      now.toLocaleTimeString("en-GB", {
        hour: "2-digit",
        hour12: false,
        timeZone: c.tz,
      }),
    );
    const icon = h >= 6 && h < 18 ? "☀" : "☽";
    rows.push({ ...c, time: t, day: d, icon, hour: h });
  }

  const L = [];
  L.push(_wtop()); // 1
  L.push(_wsep()); // 2
  L.push(_wpad(`<span class="sb-label">WORLD CLOCK</span>`)); // 3
  L.push(_wsep()); // 4

  for (const r of rows) {
    // 5-8
    L.push(
      _wpad(
        `${_wcol(r.color, r.label.padEnd(10))}` +
          `${_wval(r.time)}` +
          ` ${r.icon}`,
      ),
    );
  }
  // 4 cities × 1 line = 4 rows (lines 5-8)
  L.push(_wsep()); // 9
  // UTC reference + date
  const utcTime = now.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });
  const utcDate = now.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  });
  L.push(
    _wpad(
      `<span class="sb-dim">UTC</span>       ${_wval(utcTime)} <span class="sb-dim">${utcDate}</span>`,
    ),
  ); // 10
  L.push(_wsep()); // 11
  L.push(_wbot()); // 12

  return { html: L.join("\n"), size: "single" };
}
