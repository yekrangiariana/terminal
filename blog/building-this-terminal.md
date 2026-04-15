---
slug: building-this-terminal
title: Building This Terminal
date: 2026-01-10
category: project
tags: design
url: building-this-terminal
description: Why and how I built a terminal-style personal site
image: images/terminal.txt
---

I wanted a personal site that didn't feel like a personal site.

Every template I looked at assumed the same things: a hero section, a grid of projects, a contact form. They were fine. They were also exactly what everyone else had. I wanted something that required the visitor to do something — to type, to explore, to be slightly uncertain about what was going to happen next.

Terminals felt right. They don't have hover states or micro-animations or gradients that shift depending on the time of day. They have a prompt, and they wait. That simplicity is honest. So I built the whole thing as a command-line interface: plain HTML, CSS, and vanilla JavaScript, no frameworks, no build tools, no dependencies.

What started as a modest idea turned into roughly 6,800 lines of code across eight JavaScript files, six stylesheets, and two HTML entry points. This post is about how it all works and where the hard problems actually were.

## The command system

The entire terminal runs on a command registry — a plain JavaScript object where each key is a command name and each value has a `description` string and an `execute` function. When you type something and hit Enter, the input is split, the first token is looked up in that object, and if it exists, its executor runs. If it doesn't, the terminal computes the Levenshtein distance between what you typed and every registered command, and suggests the closest match within an edit distance of two. That "did you mean?" feature cost about fifteen lines of code but makes the interface feel dramatically more forgiving.

```js
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
```

There are over twenty commands. Some render content — `blog`, `projects`, `about`. Some are utilities — `clear`, `help`, `config`. Some are jokes — `sudo` prints "Permission denied" and then, after a beat, "(nice try though.)", while `rm -rf /` refuses with "catastrophic deletion aborted." The `fortune` command prints a random quote. There is a `gui` command that takes you to a completely separate desktop interface.

Tab completion filters the command registry by prefix. If there's exactly one match, it auto-fills the input and appends a space. If there are multiple, it renders them as clickable spans below the prompt — each one fills the input field when clicked. A command palette layers a modal on top with a search input that filters against both command names and their descriptions, navigable with arrow keys.

## Rendering blog posts

The blog is not a static site generator. The markdown files sit in a `blog/` directory next to the HTML, and the terminal fetches all of them in parallel at boot using `Promise.all`. Each file starts with a YAML frontmatter block parsed by a small custom function that extracts the metadata — title, date, slug, category, tags, description — and separates it from the body.

```js
function parseFrontmatter(md) {
  const match = md.match(/^---\s*\n([\s\S]*?)\n---\s*\n?/);
  const meta = {};
  let body = md;
  if (match) {
    match[1].split("\n").forEach((line) => {
      const sep = line.indexOf(":");
      if (sep === -1) return;
      const k = line.slice(0, sep).trim();
      const v = line.slice(sep + 1).trim();
      meta[k] = k === "tags"
        ? v.split(",").map((t) => t.trim()).filter(Boolean)
        : v;
    });
    body = md.slice(match[0].length).trim();
  }
  return { meta, body };
}
```

The markdown renderer is intentionally minimal, maybe a hundred lines. It splits the body into lines and processes them top-down: lines starting with `#` become headers, `>` becomes blockquotes, `-` or `*` become list items with a green `▸` bullet, numbered lines get dim numbering, and horizontal rules become `─` repeated forty-eight times. Everything else accumulates into paragraph buffers that flush when a structural element or blank line breaks the flow.

Inline formatting is handled by a chain of regex replacements: HTML entities are escaped first (so raw `<` and `>` don't break anything), then backtick code spans, bold, italic, and markdown links are all converted to their HTML equivalents.

```js
text = text
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;");
text = text.replace(/`([^`]+)`/g,
  '<span class="post-code">$1</span>');
text = text.replace(/\*\*([^*]+)\*\*/g,
  '<span class="c-yellow" style="font-weight:600">$1</span>');
text = text.replace(
  /(?<!\*)\*(?!\*)([^*]+)(?<!\*)\*(?!\*)/g,
  '<span class="c-info">$1</span>');
text = text.replace(
  /\[([^\]]+)\]\(([^)]*(?:\([^)]*\)[^)]*)*)\)/g,
  '<a class="post-link" href="$2" target="_blank" rel="noopener">$1</a>');
```

It's not CommonMark-compliant and never will be — it handles exactly the subset I actually use.

The first paragraph of every post gets a CSS class called `drop-cap`, which uses a `::first-letter` pseudo-element to enlarge the opening character. Every rendered element gets a staggered animation delay — each one 25 milliseconds later than the previous — using a CSS class called `term-reveal`. The effect is a gentle cascade down the page, like the text is being written in real time.

```js
let _revealIdx = 0;
const _REVEAL_CAP = 10;

function _revealDelay() {
  const delay = _revealIdx < _REVEAL_CAP ? _revealIdx * 25 + "ms" : "0ms";
  _revealIdx++;
  return delay;
}
```

The cap of ten means only the first ten elements animate in — the rest appear instantly so a long post doesn't make you wait.

When you open a post, a sidebar appears alongside it with statistics: word count, estimated reading time, structural counts (paragraphs, headings, sentences, links, code spans), and a lexicon panel showing average word length, average sentence length, unique words, and lexical diversity. This is calculated from the markdown body at render time.

## The sidebar

The sidebar is the most over-engineered part of the terminal and probably the part I'm most fond of. It's styled after neofetch — the system information tool that Linux users run to show off their desktops on Reddit.

It detects your operating system from the user agent string (Android, macOS, Windows, Linux, or just "Web") and renders a coloured ASCII logo — the Apple logo for macOS, a penguin for Linux, and so on. Below that, it lists system information in labelled rows: screen resolution, browser, CPU cores, locale, the active theme name, your session uptime, and your IP address.

The uptime counts from when you loaded the page. The IP address is fetched asynchronously from the ipify API. Both update in real time every second via `setInterval`. Here's where a subtle problem appeared: when the uptime value changed from, say, `59s` to `1m 0s`, the text got longer, which changed the width of the line, which shifted the right border of the sidebar by a few pixels. It looked like a small jitter, but once I noticed it I couldn't unsee it. The fix was simple — `.padEnd(16)` on every dynamic value, so the string is always the same width regardless of what the number says.

### The orbit widget

Below the system info, there's an animated ASCII diagram of Earth's orbit around the Sun. It's a 19x7 character grid. The ellipse is drawn by iterating angles from 0 to 360 in steps of 4, computing the x and y coordinates using cosine and sine, rounding to grid positions, and placing a `·` at each point. The Sun sits at the center. Earth's position is calculated from the actual day of the year:

$$\theta = \frac{\text{dayOfYear}}{\text{totalDays}} \times 2\pi$$

So on the summer solstice, Earth is at the bottom of the ellipse, and on the winter solstice it's at the top. The Moon orbits Earth twelve times faster, with a smaller radius.

```js
orbitGrid[cy][cx] = "S";
const ex = Math.round(cx + rx * Math.cos(orbitAngle));
const ey = Math.round(cy + ry * Math.sin(orbitAngle));
if (ex >= 0 && ex < OW && ey >= 0 && ey < OH) {
  orbitGrid[ey][ex] = "E";
}
const moonAngle = (dayOfYear / 29.53) * 2 * Math.PI;
const mx = Math.max(0, Math.min(OW - 1,
  Math.round(ex + 2 * Math.cos(moonAngle))));
const my = Math.max(0, Math.min(OH - 1,
  Math.round(ey + 1 * Math.sin(moonAngle))));
```

In the initial render, the characters are just `S`, `E`, and `o`. When the HTML is generated, those are replaced with styled spans: `S` becomes `*` with a sun colour class, `E` becomes the astronomical Earth symbol `⊕`, and `o` gets a moon colour. The whole grid is re-rendered every second by the sidebar's interval timer, with an animated offset added to the base angle so the bodies visibly move.

Getting the orbit characters to display correctly was one of the more frustrating problems. The first version used emoji — a sun symbol for the Sun and the alchemical Earth symbol for Earth. Both broke the layout. The sun emoji occupies two columns in a monospace font, so every row with the Sun in it was one character wider than the rest. The alchemical Earth symbol is a surrogate pair in JavaScript (its `.length` is 2), which confused the grid math. I cycled through several Unicode alternatives before landing on `*` for the Sun and `⊕` (U+2295, circled plus) for Earth — both single-width, both in the Basic Multilingual Plane, both with a `.length` of 1 in JavaScript.

### Weather and temperature

The sidebar also shows the current temperature. If you grant geolocation access, it fetches real weather data from the Open-Meteo API (which requires no authentication) and uses Nominatim for reverse geocoding your coordinates to a city name. If you don't grant access, or if the API fails, it falls back to a seasonal estimate using a sine curve:

$$T \approx 5.5 + 12 \sin\!\left(\frac{\text{dayOfYear} - 105}{365} \times 2\pi\right)$$

That approximates Helsinki's annual temperature cycle fairly well — cold in January, warm in July, with the phase offset of 105 days accounting for the lag between the solstice and actual peak temperatures.

Below the temperature, there's a 12-character sparkline showing average monthly temperatures. The sparkline characters go from `▁` to `█`, mapped linearly between the min and max of the dataset. The current month is highlighted.

## Themes

The terminal ships with nine themes, all defined purely through CSS custom properties. The root stylesheet declares about twenty variables — `--cyan`, `--bg-term`, `--border-subtle`, and so on — and each theme overrides them inside a `[data-theme="id"]` attribute selector on the `<html>` element.

The default is Phosphor: cyan on deep black. Monokai Pro has a vibrant green and orange palette. Bloodmoon replaces every accent with a shade of red — even the normally blue elements are crimson. Acid is neon green on pure black, the stereotypical hacker terminal. Vaporwave is hot pink on deep purple. Frozen is ice white on navy. Cinnamon is warm spice tones on dark. Barbie is pink on dark pink. And Paper is the sole light theme: dark ink on warm white, with hardcoded overrides for the title bar and status bar backgrounds since those elements look wrong with the inverse variable mapping.

Here's the Bloodmoon theme in its entirety — twenty lines that turn the whole interface red:

```css
[data-theme="bloodmoon"] {
  --cyan: #ff2244;
  --cyan-dim: #aa1a30;
  --cyan-glow: rgba(255, 34, 68, 0.2);
  --cyan-subtle: rgba(255, 34, 68, 0.06);
  --red: #ff0033;
  --yellow: #ff6644;
  --amber: #cc3300;
  --blue: #ff4466;
  --purple: #88001a;
  --pink: #ff1155;
  --white: #e8c8c8;
  --grey: #5a2a2a;
  --grey-dim: #2a0e0e;
  --bg: #0a0000;
  --bg-term: #0d0202;
  --bg-surface: rgba(255, 34, 68, 0.03);
  --border-subtle: rgba(255, 34, 68, 0.12);
  --border-medium: rgba(255, 34, 68, 0.25);
  --green: var(--cyan);
  --green-dim: var(--cyan-dim);
  --green-glow: var(--cyan-glow);
}
```

Notice that `--blue` is `#ff4466` — a red. That's the trick.

The key design decision was making `--cyan` the universal accent color, aliased as `--green`, and having every theme redefine it. That way, a single theme block of twenty lines reshapes the entire interface. The CMatrix rain, the sidebar, the orbit widget, the config menu borders — everything responds to the same set of variables.

Themes apply instantly. When you select one in the config menu, `applyTheme()` sets the `data-theme` attribute on the root element, writes the choice to `localStorage`, and updates the theme name displayed in the sidebar — all synchronously.

## The config menu

The settings interface is a box-drawn panel rendered directly into the terminal output. It has two sections — Theme and Font — each with a list of options showing their name, description, and a radio-button indicator (filled for active, hollow for inactive). A cursor arrow marks the currently highlighted item.

Navigation is entirely keyboard-driven. Arrow Up and Arrow Down move the cursor. Tab jumps between sections. Enter applies the highlighted choice. Escape closes the panel. The tricky part was making the arrows cross section boundaries: pressing Down on the last theme should jump to the first font, and pressing Up on the first font should jump to the last theme. That's handled by checking whether the index has exceeded the length of the current section's array and flipping `_configSection` accordingly.

You can also bypass the menu entirely. Typing `config theme bloodmoon` in the command line applies the theme directly without opening the panel.

## The about page

The About page renders a block-character name banner at the top, an ASCII portrait loaded from an external text file, and a biography section. The portrait is the most interesting part. It's a 55-line ASCII art file where different characters represent different tonal values — spaces and hyphens are background, colons and dots are light midtones, plus and equals are darker midtones, asterisks and hashes are shadows, and `@` is the brightest highlight.

The coloriser function maps each character to a CSS color variable. It walks through every character of every line, grouping runs of the same color into a single `<span>` to avoid generating thousands of individual elements. Background characters (spaces and hyphens) are replaced with a dot to create a subtle dotted backdrop. The color mapping uses theme variables, so the portrait's palette changes when you switch themes.

## ASCII art and animation

ASCII art is everywhere in this terminal — the name banner on the home screen, the OS logos in the sidebar, the portrait on the about page, the cover art on blog posts, and the Earth globe that rotates next to the title. Building all of this renewed an old fondness for the medium. The tools on [asciiart.eu](https://www.asciiart.eu) were a genuine joy to work with and made the whole process smoother than expected. Their converters and galleries shaped much of the visual identity of this site.

The most technically interesting piece is the animated Earth globe on the home screen. It's an eight-frame animation of a rotating Earth, each frame a 29-line block of ASCII characters roughly 50 characters wide. The frames are stored as a JavaScript array in a separate file (`earth.js`) and lazy-loaded — the script tag is injected into the document head only when the home screen first renders. Once loaded, the frames are cached so subsequent visits don't fetch again.

The animation itself is trivial: a `setInterval` at 250 milliseconds cycles through the eight frames, replacing the `textContent` of a `<pre>` element. No canvas, no DOM diffing — just a string swap four times a second. The visual effect is surprisingly smooth. The illusion of rotation comes entirely from the art: each frame shifts the continents slightly to the right, and the character density (dots, slashes, `@` signs, `N` and `h` for heavier landmasses) does enough work that the brain reads it as a three-dimensional sphere turning in space.

The sidebar OS logos — Apple for macOS, a penguin for Linux, the Windows flag, and so on — are smaller pieces of hand-tuned ASCII, each about twelve lines tall. These use colour spans: each line is split into characters and wrapped in `<span>` elements with CSS classes like `c-cyan`, `c-green`, `c-red`. The Apple logo, for example, uses six different colours applied line by line to simulate the old rainbow Apple logo.

Blog posts can embed ASCII art too. If a post's frontmatter has an `image` field pointing to a `.txt` file, the header card renders it at a tiny font size (3.5 pixels!) as a cover image. In the post body, `![alt](file.txt)` image syntax loads the text file and renders it through the same coloriser used for the portrait — characters mapped to theme colours, run-length grouped into spans, automatically scaled to fit the content width.

## CMatrix

The `cmatrix` command launches a Matrix digital rain effect inside the terminal window. It's also the screensaver — after sixty seconds of inactivity (no key presses, mouse movement, clicks, or scrolling), it starts automatically. Any interaction dismisses it.

The rain is rendered on a `<canvas>` element for performance. The setup function measures the terminal's bounding rectangle, divides it into a grid based on font size (scaled by `devicePixelRatio` for sharp text on retina screens), and creates a 2D array where each cell holds a character and an age counter. Each column has a "drop" — a head position, a speed, and a trail length. The animation runs on `requestAnimationFrame` with a tick interval of 50 milliseconds: each drop advances downward by its speed, writes a random character at the head, ages every existing cell by one, and erases cells at the tail. Occasionally, a mid-trail character mutates into a new random one.

The rendering pass walks the grid and picks a fill colour based on each cell's age:

```js
if (cell.age === 0) {
  ctx.shadowColor = colors.bright;
  ctx.shadowBlur = 8;
  ctx.fillStyle = colors.white;
} else if (cell.age < 4) {
  ctx.fillStyle = colors.bright;
} else if (cell.age < 10) {
  ctx.fillStyle = colors.mid;
} else {
  ctx.fillStyle = colors.dim;
}
ctx.fillText(cell.ch, x, y);
```

Age 0 is the head — white text with a bright glow shadow. Ages 1–3 get the full accent colour. Ages 4–9 get a dimmer variant. Everything older fades to grey. The colour palette is built from CSS variables at startup, so the rain matches whatever theme is active — green in Acid, pink in Vaporwave, red in Bloodmoon.

The character set is limited to English letters, digits, and common symbols. No katakana — this isn't a movie prop, it's a screensaver.

When the rain starts, it hides the output area, the input line, and the tab hints by setting `display: none`, then appends the canvas to the terminal container. When it stops, it reverses all of that. The canvas fades in and out using a CSS opacity transition. A resize handler recalculates the grid dimensions if the window changes size while the rain is active.

## Scanlines and window chrome

A small CSS trick that does a lot of work:

```css
body::after {
  content: "";
  position: fixed;
  inset: 0;
  background: repeating-linear-gradient(
    0deg,
    transparent,
    transparent 2px,
    rgba(0, 0, 0, 0.03) 2px,
    rgba(0, 0, 0, 0.03) 4px
  );
  pointer-events: none;
  z-index: 9999;
}
```

The `body::after` pseudo-element covers the entire viewport with a repeating linear gradient — a transparent 2px stripe, then a 2px stripe of near-invisible black. The effect is a subtle CRT scanline overlay that makes the whole page feel like it's displayed on a phosphor monitor.

The terminal window itself has an outer `box-shadow` with four inset layers — bright white on the top-left edges fading to dark black on the bottom-right — mimicking the beveled plastic frame of a late-90s UI widget.

## The desktop mode

There's a second entry point: `desktop.html`. It's a Windows XP-style graphical desktop with draggable windows, a taskbar, a start menu, desktop icons, and rubber-band selection. When you drag on an empty area of the desktop, a selection rectangle appears and highlights any icons it intersects, calculated by comparing bounding rectangles in real time during the `mousemove` event.

![windows xp logo](images/xp-logo.txt)

Each window has a title bar that supports drag-to-move by tracking the offset between the cursor and the window's top-left corner at `mousedown`, then repositioning the window on every `mousemove`. Clicking a window brings it to the front by setting its `z-index` higher than all others.

There's a gate. Before you see the desktop, you're prompted with a text field and a question. You have to type "free palestine" to proceed. It's a statement spoken only by real humans and baked into the software, gated by `sessionStorage` so you only see it once per browser session. If you click Cancel instead, you're redirected back to the terminal.

## No build step

The whole project is static files. There's no bundler, no transpiler, no package.json. The HTML loads the scripts directly. The CSS is plain CSS. The content is fetched at runtime from relative paths. You can drop the folder onto any static host and it works.

That constraint shaped a lot of decisions. The markdown parser is custom because I didn't want to ship a library. The theming is CSS-only because I didn't want a runtime dependency. The blog posts are fetched as raw text because there's no server to render them.

I don't think every site should be built this way. But for a personal site that's fundamentally about presentation and personality, it felt right to keep the machinery visible and the stack as thin as possible.

## The widget dashboard

If you type `widgets` at the prompt, the terminal clears and runs a boot sequence — a line-by-line module check that flickers green "OK" confirmations before revealing a full system monitor dashboard. It's a grid of box-drawn panels, each one a self-contained widget rendered entirely in monospace ASCII, refreshing once per second.

The grid is laid out with CSS Grid using `max-content` columns. Widgets come in three widths — single (26 characters), double (54), and full (82) — all multiples of the same base. Every widget returns an object with an `html` string and a `size` field, and the grid builder assigns CSS classes accordingly. The whole dashboard is torn down and rebuilt from scratch on every tick, which sounds expensive but in practice amounts to assembling a few hundred `<span>` elements into a `<pre>` block. It's fast enough to hold sixty frames per second in the render engine widget's own measurement of itself.

The banner at the top shows session uptime and a random process ID. Below that, the layout groups related panels together: identity (a neofetch-style system readout alongside a coloured ASCII OS logo), time (an analog clock and a world clock), hardware (memory usage, network link status, display specs), environment (temperature and blog archive stats), space (an orbit diagram and a render engine monitor), and a footer that tallies DOM nodes, scripts, stylesheets, FPS, and tick count in real time.

### The analog clock

The clock is the widget I spent the most time on. It's a 21×9 character grid that renders a working analog clock face with hour, minute, and second hands — genuine pixel art in a monospace font.

The hard problem is aspect ratio. A monospace character cell is roughly twice as tall as it is wide, so a naive circle drawn with equal x and y radii would look like a tall oval. The clock uses an ellipse instead — `rx = 9.5, ry = 3.8` — so the wider horizontal radius compensates for the narrow character width and the result looks round on screen.

The hand-drawing algorithm converts the clock angle into grid coordinates using that same aspect ratio. For a hand at angle $\theta$ with reach $L$ characters:

$$x_{\text{end}} = c_x + L \cos\theta, \qquad y_{\text{end}} = c_y + \frac{L}{r_x / r_y} \sin\theta$$

The division by the aspect ratio squashes the vertical component so the hand points at the right angle on screen despite the rectangular character cells. The line is then rasterised by stepping from center to endpoint and rounding each intermediate position to the nearest cell:

```js
function drawHand(angleDeg, lengthX, ch, priority) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  const endX = cx + lengthX * Math.cos(rad);
  const endY = cy + (lengthX / aspect) * Math.sin(rad);
  const dx = endX - cx;
  const dy = endY - cy;
  const steps = Math.max(Math.abs(dx), Math.abs(dy) * aspect, 1);
  const n = Math.ceil(steps);
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    const px = Math.round(cx + dx * t);
    const py = Math.round(cy + dy * t);
    if (px >= 0 && px < W && py >= 0 && py < H) {
      grid[py][px] = ch;
    }
  }
}
```

This produces visibly straighter hands than the earlier version, which applied the aspect correction differently and produced lines that bent noticeably at shallow angles.

The three hands are drawn in priority order — second first, then minute, then hour — so the short, thick hour hand always appears on top when two hands overlap. Each hand uses a different character and colour: the hour is a solid block (`█`, bright cyan with a glow), the minute is a lighter shade (`░`, blue), and the second is a small dot (`∙`, amber). The center is marked with a circled dot (`◉`, yellow with a strong glow).

Hour positions around the edge use diamond markers (`◆`) at the quarter hours — 12, 3, 6, and 9 — and bullet dots (`•`) at the remaining hours. These are placed at hardcoded grid positions rather than computed with trigonometry, because rounding errors at the grid's resolution would put some markers on the wrong cell. Hardcoding twelve coordinates is less elegant but perfectly accurate.

To the right of the clock face, a vertical column shows the local time, date, timezone, day progress (as a sparkline bar), year progress, and current temperature with a blinking seconds indicator.

### The world clock

Alongside the analog clock sits a compact world clock panel showing the time in London, New York, Tokyo, and Sydney. Each city is colour-coded and shows a sun or moon icon depending on whether it's daytime there. A UTC reference line runs along the bottom.

### Mars weather

The orbit widget shows live weather data from Mars. It fetches telemetry from the Curiosity rover's weather station via NASA's public Mars Science Laboratory API — a JSON endpoint at `mars.nasa.gov` that returns daily atmospheric readings from Gale Crater. The data includes the current sol number (Martian day count), minimum and maximum surface temperatures, atmospheric pressure, opacity ("Sunny" or "Cloudy"), and sunrise/sunset times.

The fetch is wrapped in a thirty-minute cache so the dashboard doesn't hammer NASA's servers on every one-second tick:

```js
function fetchMarsWeather() {
  if (window._marsWeather
      && Date.now() - window._marsWeather._ts < 1800000) return;
  fetch("https://mars.nasa.gov/rss/api/"
      + "?feed=weather&category=msl&feedtype=json")
    .then((r) => r.ok ? r.json() : Promise.reject(r.status))
    .then((data) => {
      const latest = data?.soles?.[0];
      if (!latest) return;
      window._marsWeather = {
        sol: parseInt(latest.sol, 10),
        minTemp: parseInt(latest.min_temp, 10),
        maxTemp: parseInt(latest.max_temp, 10),
        pressure: parseInt(latest.pressure, 10),
        opacity: latest.atmo_opacity || "",
        _ts: Date.now(),
      };
    })
    .catch(() => { /* fall back to estimates */ });
}
```

If the API is unreachable — it's a rover on another planet, so occasional downtime is expected — the widget falls back to computed estimates: a sol number derived from the Julian date, a season calculated from the Martian year cycle of 669 sols, and a surface temperature approximated with a sine curve oscillating between $-80°C$ and $-20°C$.

The Mars data appears in the orbit widget's right-hand column, labelled clearly as "MARS" with the sol number and temperature range. Below it, the current moon phase is computed from the Moon's 29.53-day synodic period using a known new moon as epoch:

$$\text{moonAge} = \bigl(\text{now} - \text{Jan 6, 2000 18:14 UTC}\bigr) \mod 29.53059 \text{ days}$$

The fractional position within the cycle determines the phase name — new moon, waxing crescent, first quarter, and so on through eight named phases. The zodiac position is computed separately from the tropical boundaries based on day of year.

### Temperature and archive

The double-width temperature panel reuses the same weather data described in the sidebar section — real from Open-Meteo if available, seasonal sine estimate otherwise — but pairs it with a bar chart of blog post categories pulled from the site's own content manifest. The sparkline of monthly averages appears here too, colour-coded by magnitude, with the current month bolded.

### Neofetch

The widget dashboard has its own neofetch panel, similar in spirit to the sidebar's system info but more detailed. It renders the same OS-specific ASCII logos alongside a longer list of fields: browser engine, platform, CPU cores, GPU renderer (pulled from `WEBGL_debug_renderer_info` where the browser exposes it), device memory, DPR, locale, protocol, and connection status.

### The other widgets

The remaining panels are smaller and more utilitarian. Memory tracks JavaScript heap usage (or estimates it from DOM node count if `performance.memory` isn't available) with a sparkline and a peak indicator. Network shows connection type, downlink speed, and latency from the Network Information API. Display reports screen resolution, viewport size, colour depth, and pixel density. User Presence tracks whether the tab is focused, hidden, or idle, and counts clicks. Input Devices reports pointer type, touch capability, and gamepad state. Render Engine shows the dashboard's own FPS with a sparkline and frame-delta timing.

### Layout decisions

All double-width widgets split their space into two columns separated by a vertical pipe character. Getting that pipe visually centered took more thought than expected. The inner width of a double widget is 50 characters (54 minus the two border characters and two padding spaces). The divider sits at position 25 — exactly half. In the sidebar, the same layout uses position 22, because the sidebar is 48 characters wide and its inner width is 44. The divider colour is a subtle grey rather than the accent colour, so it doesn't compete with the actual data.

The boot sequence that plays before the dashboard appears is purely cosmetic — a list of module names with staggered delays and a randomised jitter on each line's timing. It takes about two seconds and exists only because the dashboard felt too abrupt without it.

## What I learned

The hardest problems were never the big features. They were the small alignment issues — a sidebar border that shifted by two pixels when the uptime value changed width, or an emoji that occupied one too many columns in a monospace grid. Those kinds of bugs don't show up in logic — they show up in the gap between what Unicode promises and what a font actually renders.

The analog clock is a good example. The first version drew its hands by multiplying the sine component by `ry / rx` — applying the ellipse compression to the hand length rather than to the endpoint coordinates. The result was hands that followed a curved path instead of a straight line, bending visibly between the center and the rim. The fix was to think in "display space" — compute the endpoint using the aspect ratio, then walk a straight line from center to endpoint in grid coordinates. The hands immediately looked right. It was a one-line change with a large visual payoff, and the kind of bug you can only see, never reason about from the code alone.

The Mars weather integration taught a different lesson. The InSight lander's API, which was the obvious first choice, still returns data — but only from October 2020, because the instrument died. The data is frozen and will never update. The Curiosity rover's MSL endpoint, buried deeper in NASA's site, returns fresh readings. Both APIs are undocumented in the way that government data feeds usually are: they work, they return JSON, and if you want a schema you'll need to reverse-engineer it from the response.

The most satisfying code to write was still the orbit widget. It's real astronomy — Earth's position is a function of the actual date, Mars weather comes from a rover that's really there — running inside a text grid, animated once per second, and it weighs maybe forty lines. It has no practical purpose. It just sits in the corner, quietly accurate, and occasionally someone notices the Moon.

The prompt is the right metaphor. It implies that something is waiting. That the system is ready. That what happens next depends on you.
