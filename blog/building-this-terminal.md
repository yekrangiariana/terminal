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

What started as a modest idea turned into roughly 3,500 lines of code across five JavaScript files, four stylesheets, and two HTML entry points. This post is about how it all works and where the hard problems actually were.

## The command system

The entire terminal runs on a command registry — a plain JavaScript object where each key is a command name and each value has a `description` string and an `execute` function. When you type something and hit Enter, the input is split, the first token is looked up in that object, and if it exists, its executor runs. If it doesn't, the terminal computes the Levenshtein distance between what you typed and every registered command, and suggests the closest match within an edit distance of two. That "did you mean?" feature cost about fifteen lines of code but makes the interface feel dramatically more forgiving.

There are over twenty commands. Some render content — `blog`, `projects`, `about`. Some are utilities — `clear`, `help`, `config`. Some are jokes — `sudo` tells you you're not in the sudoers file, `rm -rf /` pretends to wipe the system. The `fortune` command prints a random quote. There is a `gui` command that takes you to a completely separate desktop interface.

Tab completion filters the command registry by prefix. If there's exactly one match, it auto-fills the input and appends a space. If there are multiple, it renders them as clickable spans below the prompt — each one fills the input field when clicked. A command palette (toggled with Ctrl+K) layers a modal on top with a search input that filters against both command names and their descriptions, navigable with arrow keys.

## Rendering blog posts

The blog is not a static site generator. The markdown files sit in a `blog/` directory next to the HTML, and the terminal fetches all of them in parallel at boot using `Promise.allSettled`. Each file starts with a YAML frontmatter block parsed by a small custom function that extracts the metadata — title, date, slug, category, tags, description — and separates it from the body.

The markdown renderer is intentionally minimal, maybe a hundred lines. It splits the body into lines and processes them top-down: lines starting with `#` become headers, `>` becomes blockquotes, `-` or `*` become list items with a green `▸` bullet, numbered lines get dim numbering, and horizontal rules become `─` repeated forty-eight times. Everything else accumulates into paragraph buffers that flush when a structural element or blank line breaks the flow.

Inline formatting is handled by a chain of regex replacements: HTML entities are escaped first (so raw `<` and `>` don't break anything), then backtick code spans, bold, italic, and markdown links are all converted to their HTML equivalents. It's not CommonMark-compliant and never will be — it handles exactly the subset I actually use.

The first paragraph of every post gets a CSS class called `drop-cap`, which uses a `::first-letter` pseudo-element to enlarge the opening character. Every rendered element gets a staggered animation delay — each one 25 milliseconds later than the previous — using a CSS class called `term-reveal`. The effect is a gentle cascade down the page, like the text is being written in real time.

When you open a post, a sidebar appears alongside it with statistics: word count, estimated reading time, a basic readability score, and lexical diversity. This is calculated from the markdown body at render time.

## The sidebar

The sidebar is the most over-engineered part of the terminal and probably the part I'm most fond of. It's styled after neofetch — the system information tool that Linux users run to show off their desktops on Reddit.

It detects your operating system from the user agent string (Android, macOS, Windows, Linux, or just "Web") and renders a coloured ASCII logo — the Apple logo for macOS, a penguin for Linux, and so on. Below that, it lists system information in labelled rows: screen resolution, browser, CPU cores, locale, the active theme name, your session uptime, and your IP address.

The uptime counts from when you loaded the page. The IP address is fetched asynchronously from the ipify API. Both update in real time every second via `setInterval`. Here's where a subtle problem appeared: when the uptime value changed from, say, `59s` to `1m 0s`, the text got longer, which changed the width of the line, which shifted the right border of the sidebar by a few pixels. It looked like a small jitter, but once I noticed it I couldn't unsee it. The fix was simple — `.padEnd(16)` on every dynamic value, so the string is always the same width regardless of what the number says.

### The orbit widget

Below the system info, there's an animated ASCII diagram of Earth's orbit around the Sun. It's a 19x7 character grid. The ellipse is drawn by iterating angles from 0 to 360 in steps of 4, computing the x and y coordinates using cosine and sine, rounding to grid positions, and placing a `·` at each point. The Sun sits at the center. Earth's position is calculated from the actual day of the year — `dayOfYear / totalDays * 2π` — so on the summer solstice, Earth is at the bottom of the ellipse, and on the winter solstice it's at the top. The Moon orbits Earth twelve times faster, with a smaller radius.

In the initial render, the characters are just `S`, `E`, and `o`. When the HTML is generated, those are replaced with styled spans: `S` becomes `*` with a sun colour class, `E` becomes the astronomical Earth symbol `⊕`, and `o` gets a moon colour. The whole grid is re-rendered every second by the sidebar's interval timer, with an animated offset added to the base angle so the bodies visibly move.

Getting the orbit characters to display correctly was one of the more frustrating problems. The first version used emoji — a sun symbol for the Sun and the alchemical Earth symbol for Earth. Both broke the layout. The sun emoji occupies two columns in a monospace font, so every row with the Sun in it was one character wider than the rest. The alchemical Earth symbol is a surrogate pair in JavaScript (its `.length` is 2), which confused the grid math. I cycled through several Unicode alternatives before landing on `*` for the Sun and `⊕` (U+2295, circled plus) for Earth — both single-width, both in the Basic Multilingual Plane, both with a `.length` of 1 in JavaScript.

### Weather and temperature

The sidebar also shows the current temperature. If you grant geolocation access, it fetches real weather data from the Open-Meteo API (which requires no authentication) and uses Nominatim for reverse geocoding your coordinates to a city name. If you don't grant access, or if the API fails, it falls back to a seasonal estimate using a sine curve: `5.5 + 12 * sin((dayOfYear - 105) / 365 * 2π)`. That approximates Helsinki's annual temperature cycle fairly well — cold in January, warm in July, with the phase offset of 105 days accounting for the lag between the solstice and actual peak temperatures.

Below the temperature, there's a 12-character sparkline showing average monthly temperatures. The sparkline characters go from `▁` to `█`, mapped linearly between the min and max of the dataset. The current month is highlighted.

## Themes

The terminal ships with seven themes, all defined purely through CSS custom properties. The root stylesheet declares about twenty variables — `--cyan`, `--bg-term`, `--border-subtle`, and so on — and each theme overrides them inside a `[data-theme="id"]` attribute selector on the `<html>` element.

The default is Phosphor: cyan on deep black. Monokai Pro has a vibrant green and orange palette. Bloodmoon replaces every accent with a shade of red — even the normally blue elements are crimson. Acid is neon green on pure black, the stereotypical hacker terminal. Vaporwave is hot pink on deep purple. Frozen is ice white on navy. And Paper is the sole light theme: dark ink on warm white, with hardcoded overrides for the title bar and status bar backgrounds since those elements look wrong with the inverse variable mapping.

The key design decision was making `--cyan` the universal accent color, aliased as `--green`, and having every theme redefine it. That way, a single theme block of twenty lines reshapes the entire interface. The CMatrix rain, the sidebar, the orbit widget, the config menu borders — everything responds to the same set of variables.

Themes apply instantly. When you select one in the config menu, `applyTheme()` sets the `data-theme` attribute on the root element, writes the choice to `localStorage`, and updates the theme name displayed in the sidebar — all synchronously.

## The config menu

The settings interface is a box-drawn panel rendered directly into the terminal output. It has two sections — Theme and Font — each with a list of options showing their name, description, and a radio-button indicator (filled for active, hollow for inactive). A cursor arrow marks the currently highlighted item.

Navigation is entirely keyboard-driven. Arrow Up and Arrow Down move the cursor. Tab jumps between sections. Enter applies the highlighted choice. Escape closes the panel. The tricky part was making the arrows cross section boundaries: pressing Down on the last theme should jump to the first font, and pressing Up on the first font should jump to the last theme. That's handled by checking whether the index has exceeded the length of the current section's array and flipping `_configSection` accordingly.

You can also bypass the menu entirely. Typing `config theme bloodmoon` in the command line applies the theme directly without opening the panel.

## The about page

The About page renders a block-character name banner at the top, an ASCII portrait loaded from an external text file, and a biography section. The portrait is the most interesting part. It's a 41-line ASCII art file where different characters represent different tonal values — spaces and hyphens are background, colons and dots are light midtones, plus and equals are darker midtones, asterisks and hashes are shadows, and `@` is the brightest highlight.

The coloriser function maps each character to a CSS color variable. It walks through every character of every line, grouping runs of the same color into a single `<span>` to avoid generating thousands of individual elements. Background characters (spaces and hyphens) are replaced with a dot to create a subtle dotted backdrop. The color mapping uses theme variables, so the portrait's palette changes when you switch themes.

## CMatrix

The `cmatrix` command launches a Matrix digital rain effect inside the terminal window. It's also the screensaver — after sixty seconds of inactivity (no key presses, mouse movement, clicks, or scrolling), it starts automatically. Any interaction dismisses it.

The rain is not a canvas. It's a `<pre>` element containing a character grid rendered as HTML. The setup function measures the terminal's bounding rectangle, divides it into a grid based on font size, and creates a 2D array where each cell holds a character and an age counter. Each column has a "drop" — a head position, a speed, and a trail length. On every tick (every 50 milliseconds), each drop advances downward by its speed, writes a random character at the head, ages every existing cell by one, and erases cells at the tail. Occasionally, a mid-trail character mutates into a new random one.

The rendering pass converts the grid into HTML. Each cell's age determines its color: age 0 (the head) gets white text with a bright glow shadow, ages 1-3 get the full accent color, ages 4-9 get a dimmer variant, and older cells get the grey. All colors come from CSS variables, so the rain matches whatever theme is active — green in Acid, pink in Vaporwave, red in Bloodmoon.

The character set is limited to English letters, digits, and common symbols. No katakana — this isn't a movie prop, it's a screensaver.

When the rain starts, it hides the output area, the input line, and the tab hints by setting `display: none`, then appends the `<pre>` element to the terminal container. When it stops, it reverses all of that. The element fades in and out using a CSS opacity transition. A resize handler recalculates the grid dimensions if the window changes size while the rain is active.

## Scanlines and window chrome

A small CSS trick that does a lot of work: the `body::after` pseudo-element covers the entire viewport with a repeating linear gradient — a transparent 2px stripe, then a 2px stripe of near-invisible black. It sits at `z-index: 9999` with `pointer-events: none`. The effect is a subtle CRT scanline overlay that makes the whole page feel like it's displayed on a phosphor monitor.

The terminal window itself has an outer `box-shadow` with four inset layers — bright white on the top-left edges fading to dark black on the bottom-right — mimicking the beveled plastic frame of a late-90s UI widget.

## The desktop mode

There's a second entry point: `desktop.html`. It's a Windows XP-style graphical desktop with draggable windows, a taskbar, a start menu, desktop icons, and rubber-band selection. When you drag on an empty area of the desktop, a selection rectangle appears and highlights any icons it intersects, calculated by comparing bounding rectangles in real time during the `mousemove` event.

![windows xp lgo](images/xp-logo.txt)

Each window has a title bar that supports drag-to-move by tracking the offset between the cursor and the window's top-left corner at `mousedown`, then repositioning the window on every `mousemove`. Clicking a window brings it to the front by setting its `z-index` higher than all others.

There's a gate. Before you see the desktop, you're prompted with a text field and a question. You have to type "free palestine" to proceed. It's a statement spoken only by real humans and baked into the software, gated by `sessionStorage` so you only see it once per browser session. If you click Cancel instead, you're redirected back to the terminal.

## No build step

The whole project is static files. There's no bundler, no transpiler, no package.json. The HTML loads the scripts directly. The CSS is plain CSS. The content is fetched at runtime from relative paths. You can drop the folder onto any static host and it works.

That constraint shaped a lot of decisions. The markdown parser is custom because I didn't want to ship a library. The theming is CSS-only because I didn't want a runtime dependency. The blog posts are fetched as raw text because there's no server to render them.

I don't think every site should be built this way. But for a personal site that's fundamentally about presentation and personality, it felt right to keep the machinery visible and the stack as thin as possible.

## What I learned

The hardest problems were never the big features. They were the small alignment issues — a sidebar border that shifted by two pixels when the uptime value changed width, or an emoji that occupied one too many columns in a monospace grid. Those kinds of bugs don't show up in logic — they show up in the gap between what Unicode promises and what a font actually renders.

The most satisfying code to write was the orbit widget. It's real astronomy — Earth's position is a function of the actual date — running inside a text grid, animated once per second, and it weighs maybe forty lines. It has no practical purpose. It just sits in the corner, quietly accurate, and occasionally someone notices the Moon.

The prompt is the right metaphor. It implies that something is waiting. That the system is ready. That what happens next depends on you.
