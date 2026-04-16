---
slug: building-ascii-studio
title: Building ASCII Studio
date: 2026-04-16
category: project
tags: design
url: building-ascii-studio
description: How I built a math-driven ASCII animation designer with a safe expression parser, real-time rendering, and a Windows XP interface
image: images/ascii-studio-logo.svg
---

After building the terminal site, I had a handful of ASCII animation patterns that I'd been tweaking by hand — editing constants in source code, refreshing the browser, squinting at the result, and repeating. It was slow and the feedback loop was miserable. I wanted a tool where I could drag a slider and see the animation change instantly, try layering two patterns together, type a custom equation and watch it render. So I built one.

ASCII Studio is a browser-based animation pattern designer. You pick a mathematical function, adjust its constants with sliders, apply symmetry transforms, blend two layers, and the result is rendered in real time as animated monospace text on a canvas. You can also load simulation-driven scenes — Game of Life, fire, flocking — or upload your own ASCII art as a source pattern. The whole thing is wrapped in a pixel-accurate Windows XP interface because I thought it would be funny, and then I couldn't stop.

It's about 5,500 lines of vanilla JavaScript, a single HTML file, and a CSS stylesheet. No frameworks, no build step, no dependencies. The only external libraries — gif.js and mp4-muxer — are lazy-loaded at export time and never touch the main render path.

## Turning math into characters

Every animation in ASCII Studio starts with a mathematical function that takes a screen coordinate and a time value and returns a floating-point number. That number is mapped to a character from a density ramp — light characters for low values, heavy characters for high values — and the whole grid updates thirty times per second.

The simplest pattern is `mosaic`:

$$v = \sin(x \cdot x_C + t) \cdot \sin(y \cdot y_C + t)$$

Two sine waves multiplied together. The spatial constants $x_C$ and $y_C$ control the frequency in each axis, and $t$ is time. When both constants are small — say 0.1 — you get slow, broad undulations. Crank them up and the grid dissolves into a fine-grained interference pattern.

The `circular` pattern uses distance from center:

$$v = \sin(dx^2 \cdot x_C + dy^2 \cdot y_C + t \cdot f_m)$$

where $dx$ and $dy$ are the displacement from the center of the grid, and $f_m$ is the frame multiplier — a constant that controls how strongly time affects the output. Small $f_m$ values make the rings pulse slowly. Large values make them race outward.

The most complex built-in pattern is `centerSpiral`. I won't pretend this equation was derived analytically — it was discovered by stacking trigonometric operations until the output looked good:

$$v = \sin\!\Big(\big(\theta + (t + \sin(x \cdot x_C + y \cdot y_C)) \cdot f_m + \sin(\theta \cdot y_C) + g_V \sin(x \cdot x_C + t)\big) \cdot \big(1 + \sin(\theta \cdot f_m)\big)\Big)$$

where $\theta = \text{atan2}(dy, dx) + x_C$. The nested sines create rotational motion that feeds back into itself. The $g_V$ term (a "global value" parameter — badly named, kept for compatibility) adds a secondary oscillation that breaks the symmetry and produces spiraling tendrils.

In code, that's:

```js
case 'centerSpiral':
  dx = mx - fw/2; dy = my - fh/2;
  theta = Math.atan2(dy, dx) + c.xConstant;
  return Math.sin(
    (theta + (time + Math.sin(mx*c.xConstant + my*c.yConstant))
      * c.frameMultiplier
      + Math.sin(theta * c.yConstant)
      + c.globalVal * Math.sin(mx*c.xConstant + time))
    * (1 + Math.sin(theta * c.frameMultiplier))
  );
```

There are twelve patterns total. Each one is a hand-tuned function of the same five inputs: screen position, center displacement, time, and the four user-adjustable constants. The `tunnel` pattern divides by radial distance to create that flight-through-a-tube illusion. `plasma` sums four sine waves at different frequencies and phases — the classic demoscene plasma from the 1990s. `radialStar` rounds $y_C$ to an integer to set the number of petals, then uses $\cos(\theta \cdot \text{petals})$ inside a sine to carve starbursts.

## Two kinds of speed

The animation loop advances a global `time` variable on every tick:

```js
time += config.animationSpeed * SPEED_SCALE;
```

That `time` value is then fed into the pattern equation through the frame multiplier $f_m$. These are two separate controls and the distinction matters.

**Animation Speed** is the tempo — how fast the clock ticks. Doubling it makes everything happen twice as fast, like pressing fast-forward. **Frame Multiplier** ($f_m$) is the character of the motion — how strongly time is mixed into the equation. It changes what you see, not how fast you see it.

Imagine a spiral: $f_m$ controls whether it's a tight fast spin or a loose slow swirl — that's the shape of the motion. Speed controls how quickly that motion plays — the playback rate. The distinction is subtle but once you see it, you can't un-see it. A high $f_m$ with low speed produces complex, slowly evolving motion. A low $f_m$ with high speed produces simple motion that races. They're orthogonal creative axes.

Negative $f_m$ values reverse the direction of motion. Zero $f_m$ makes the animation completely static — time is multiplied by zero and disappears from the equation.

## The render pipeline

Each character cell passes through an eight-step transform chain before its pattern value is computed:

```
screen → center offset → rotate → scale → symmetry fold
       → turbulence warp → pattern function → character lookup
```

The inner loop runs thirty times per second over every cell in the grid:

```js
for (var y = 0; y < fh; y++) {
  for (var x = 0; x < fw; x++) {
    var dx = x - fw*0.5 - oxOff;
    var dy = y - fh*0.5 - oyOff;

    if (hasRot) { rx = dx*cosR - dy*sinR; ry = dx*sinR + dy*cosR; dx=rx; dy=ry; }
    if (scl !== 1) { dx /= scl; dy /= scl; }
    if (hasSym) { applySym(dx, dy, sym); dx = _sx; dy = _sy; }
    if (turb > 0) {
      dx += noiseX(dx, dy, time) * turb * 10;
      dy += noiseY(dx, dy, time) * turb * 10;
    }

    var mx = dx + fw*0.5;
    var my = dy + fh*0.5;
    var value = computeValue(c.pattern, mx, my, fw, fh, c);
```

Rotation and scale are applied before the pattern function sees the coordinates, so rotating a mosaic pattern doesn't rotate the output — it rotates the input space, which produces a tilted version of the pattern itself. This is the difference between rotating a camera and rotating the scenery.

The symmetry fold is where things get interesting.

## Folding space with symmetry

The simplest symmetry modes mirror across an axis:

```js
case 'x':    _sx = Math.abs(dx); _sy = dy; break;
case 'y':    _sx = dx; _sy = Math.abs(dy); break;
case 'both': _sx = Math.abs(dx); _sy = Math.abs(dy); break;
```

Taking the absolute value of $dx$ means the pattern function receives the same input for $x = -5$ as it does for $x = 5$. The left half becomes a mirror of the right. `both` folds on both axes, producing four-way symmetry — whatever appears in the top-right quadrant is replicated in the other three.

The radial modes are more involved. For $n$-fold radial symmetry, every point is folded into a single angular sector:

```js
var angle = Math.atan2(dy, dx);
var r = Math.sqrt(dx*dx + dy*dy);
var sector = TWO_PI / n;
angle = ((angle % sector) + sector) % sector;
if (angle > sector * 0.5) angle = sector - angle;
_sx = r * Math.cos(angle);
_sy = r * Math.sin(angle);
```

This converts Cartesian coordinates to polar, reduces the angle modulo $\frac{2\pi}{n}$, mirrors within the sector, then converts back. The result is that a pattern computed for one slice of the circle gets tiled $n$ times around the center. With $n = 8$, you get mandalas. The pattern function has no idea this is happening — it receives coordinates that happen to be folded, and produces a value as usual.

The symmetry system uses module-level variables `_sx` and `_sy` instead of returning an object. In a hot loop that runs tens of thousands of times per frame, avoiding an allocation per iteration matters. It's ugly. It's fast.

## Turbulence: warping the coordinate grid

Turbulence adds organic distortion by offsetting each pixel's coordinates through a noise function before the pattern evaluates them:

```js
function noiseX(x, y, t) {
  return Math.sin(x*0.031+y*0.071+t*0.3)*0.5
       + Math.sin(x*0.113-y*0.037+t*0.7)*0.3
       + Math.sin(y*0.053+x*0.131+t*0.5)*0.2;
}
```

Three octaves of sine-based pseudo-noise, each at a different frequency and amplitude. It's not Perlin noise — it's cheaper and the visual difference is negligible at the resolutions ASCII art operates at. Multiplied by the turbulence slider value and applied as a coordinate warp, it bends straight lines into flowing curves and gives geometric patterns an organic, hand-drawn quality.

## Mapping values to characters

The pattern function returns a float, typically in the range $[-2, 2]$. This needs to become a character. The mapping is a single line:

```js
var idx = ((value + 2) * csLen * 0.25) | 0;
```

Adding 2 shifts the range to $[0, 4]$. Multiplying by $\frac{\text{charsetLength}}{4}$ maps it to $[0, \text{csLen})$. The `| 0` is a bitwise OR with zero — JavaScript's fastest way to floor a positive float to an integer. The index picks a character from the charset string, where characters are ordered from light to heavy: `░▒▓█`, for instance, or `. :-=+*#%@` for a classic ASCII density ramp.

Color works similarly. In monochrome mode, a three-tier brightness system gives the terminal-green aesthetic:

```js
var brightness = (value + 2) * 0.25;
fill = brightness > 0.65 ? '#00ffd5'
     : brightness > 0.4  ? '#00b396'
     :                      '#3d4f4a';
```

In colored mode, the palette cycles through user-defined colors indexed by the same character index. The combination of charset and palette means two animations with identical math can look completely different — one as blocky Unicode gradients in neon pink and orange, another as dots and slashes in monochrome green.

## A safe expression parser

The twelve built-in patterns cover a lot of ground, but the whole point of a creative tool is letting people try their own ideas. The `custom` pattern accepts arbitrary mathematical expressions typed into a text field.

The obvious approach — `eval()` — is out of the question. User input passed to `eval` is a remote code execution vulnerability, full stop. Even `new Function()` with string interpolation has the same problem. I needed a parser that could evaluate mathematical expressions and nothing else.

The solution is a recursive descent parser that compiles expressions into nested closures. It works in two phases: tokenize, then parse.

The tokenizer walks the input string character by character, producing an array of typed tokens:

```
"sin(x * 0.5 + time)" → [id:sin, (, id:x, *, num:0.5, +, id:time, )]
```

The parser consumes these tokens with proper operator precedence — addition binds loosest, then multiplication, then exponentiation, then unary minus, then atoms (numbers, variables, parenthesized sub-expressions, function calls). Each grammar rule returns a closure:

```js
function mkBin(l, r, op) {
  return function(e) { return op(l(e), r(e)); };
}
```

The expression `sin(x * 0.5 + time)` compiles to something like:

```js
function(e) {
  return Math.sin(
    function(e) {
      return function(e) { return e.x; }(e) * 0.5;
    }(e) + function(e) { return e.time; }(e)
  );
}
```

(Obviously nested, not literally this flat — but that's the structure.)

At render time, the compiled function is called with an environment object containing the current pixel's variables:

```js
return _customFnA({
  x: mx, y: my, dx: dx, dy: dy,
  r: Math.sqrt(dx*dx + dy*dy) + 0.01,
  theta: Math.atan2(dy, dx),
  time: time, t: time, w: fw, h: fh,
  xC: c.xConstant, yC: c.yConstant,
  fm: c.frameMultiplier, gV: c.globalVal
});
```

The `+ 0.01` on the radius prevents a division-by-zero at the grid center, which matters for expressions like `sin(xC / r)` — without it, the center pixel produces `Infinity`, which propagates through the math and turns the entire frame into `NaN`.

Only whitelisted function names are callable — `sin`, `cos`, `sqrt`, `abs`, `pow`, and a set of GLSL-inspired additions: `fract`, `mod`, `clamp`, `mix`, `step`, `smoothstep`, and a cheap `noise` function. Only whitelisted variable names resolve — everything else throws a parse error. There is no way to access `window`, `document`, `fetch`, or anything outside the math sandbox. The compiled functions are memoized by source string, so re-parsing only happens when the expression text actually changes.

Division by zero is caught at the operator level: `b === 0 ? 0 : a / b`. The result is that malformed expressions silently produce zero rather than crashing the render loop.

## Layer blending

A single pattern function produces a single layer of animation. Two layers multiply the creative possibilities because interference between independent patterns generates structures that neither could produce alone.

Layer B has its own pattern selector, constants, and expression field — a completely independent signal chain. The two layers are combined through a blend function:

```js
function blendValues(a, b, mode, amount) {
  var v;
  switch (mode) {
    case 'add':      v = a + b; break;
    case 'multiply': v = a * b; break;
    case 'screen':   v = a + b - a * b; break;
    case 'subtract': v = a - b; break;
    case 'min':      v = Math.min(a, b); break;
    case 'max':      v = Math.max(a, b); break;
  }
  return a * (1 - amount) + v * amount;
}
```

The `amount` parameter crossfades between the pure Layer A value and the blended result. At amount 0, Layer B has no effect. At amount 1, the blend mode is fully applied. The `screen` mode — $a + b - ab$ — is borrowed from Photoshop and tends to brighten the output, useful for creating glowing intersections between two wave patterns.

The most dramatic combinations come from blending patterns that operate at different spatial scales. A slow `circular` pattern on Layer A with a fine-grained `mosaic` on Layer B, multiplied together, produces animations where broad radial waves modulate a tiled grid — the tiles appear and disappear in concentric rings.

## Making the sliders useful

The hardest UX problem wasn't building the features — it was making them discoverable. Each pattern has four numerical constants ($x_C$, $y_C$, $f_m$, $g_V$), and the interesting range for each constant depends entirely on which pattern is selected.

For `circular`, the sweet spot for $x_C$ is around $0.001$ to $0.05$. Move the slider to $1.0$ and the pattern collapses into noise. For `tunnel`, $x_C$ needs to be between $2$ and $30$. For `centerSpiral`, it's $-2$ to $5$. A single fixed slider range from $-1000$ to $1000$ would technically work for all patterns, but the useful region would occupy a tenth of a percent of the slider travel. You'd be trying to find a needle in a haystack with a blunt instrument.

The solution is per-pattern slider ranges — a lookup table that sets each slider's min, max, and step when the pattern changes:

```js
var PATTERN_RANGES = {
  centerSpiral: { xc:[-2,5,0.01],    yc:[-5,10,0.01],   gv:[0,8,0.1]  },
  circular:     { xc:[-0.01,0.05,0.0001], yc:[-0.01,0.05,0.0001], gv:[0,5,0.1] },
  mosaic:       { xc:[0,1,0.001],     yc:[0,1,0.001],    gv:[0,3,0.1]  },
  tunnel:       { xc:[1,30,0.1],      yc:[0,10,0.1],     gv:[0,5,0.1]  },
  // ... one entry per pattern
};
```

When you switch patterns, `applyPatternRanges()` updates the slider bounds. But there's a catch: presets might set constants outside the new range. A preset might use $x_C = 554.8$ for a particular center spiral effect. If the slider max is $5$, the slider would clamp the value and silently destroy the preset. So the range expander auto-widens:

```js
if (cur < range[0]) el.min = cur < 0 ? cur * 2 : cur * 0.5;
if (cur > range[1]) el.max = cur * 2 || 1;
```

The slider covers the sweet spot. The number input next to it accepts anything. This way, beginners get a focused range that produces interesting results at every position, and advanced users can type extreme values directly.

## Randomize vs. vary

The top-level Randomize button generates a completely new configuration — random pattern, random constants within the pattern's sweet spot, random palette, random charset. It's good for exploration but disorienting if you already have something you like and just want to try a small variation.

Each section has its own dice button that does something different: it *varies* the current values instead of replacing them. The `_vary()` helper nudges a value by ±30% of its current magnitude:

```js
function _vary(val, percent, lo, hi) {
  if (val === 0) return _rng(lo, hi) * 0.3;
  var range = Math.abs(val) * percent;
  var v = val + _rng(-range, range);
  if (lo !== undefined && v < lo) v = lo;
  if (hi !== undefined && v > hi) v = hi;
  return v;
}
```

The zero case is special — you can't take 30% of zero, so it picks a small random value instead. The result is that clicking the dice next to "Spatial Constants" gently shifts the pattern without destroying its character. You can click it repeatedly, fine-tuning through a neighbourhood of parameter space, which is a very different creative workflow from full randomisation.

## Rendering to canvas

The output is a `<canvas>` element drawn with `fillText()` — one character per cell, positioned on a grid. The canvas is sized for HiDPI displays:

```js
var dpr = window.devicePixelRatio || 1;
canvas.width = w * dpr;
canvas.height = h * dpr;
ctx.scale(dpr, dpr);
```

Character width is measured empirically with `ctx.measureText('M').width`, and the cell height is `fontSize * 1.15` to approximate line spacing. The number of columns and rows is derived from the canvas dimensions divided by these cell sizes.

Color switching is the main performance concern. Every call to `ctx.fillStyle = '...'` triggers internal state changes in the rendering backend. The render loop tracks the previous fill color and only reassigns when it changes:

```js
if (fill !== prevFill) { ctx.fillStyle = fill; prevFill = fill; }
ctx.fillText(glyph, x * charW, y * cellH + fontSize);
```

This is a small optimization that makes a measurable difference — in a typical 80×40 grid, avoiding redundant fill-style changes can skip a few hundred state mutations per frame.

## Exporting video

ASCII art on a screen is nice. ASCII art that loops as a video file is shareable. The studio supports three export formats, each with its own set of problems.

**HTML export** generates a self-contained `.html` file with the entire render pipeline, the expression parser, all twelve pattern equations, and the current configuration serialized as JSON. No external dependencies. You can email it to someone and they can open it in a browser and see the animation running.

**GIF export** uses gif.js, a library that encodes GIF frames in a Web Worker. The CORS problem is real — gif.js tries to spawn a worker from a CDN URL, which browsers block. The workaround is to fetch the worker script as a blob and create an object URL:

```js
fetch('https://cdn.../gif.worker.js')
  .then(r => r.blob())
  .then(blob => {
    window._gifWorkerBlob = URL.createObjectURL(blob);
  });
```

The capture loop pauses the live animation, steps `time` forward by a fixed increment per frame, renders each frame off-screen, and feeds the canvas pixels to the encoder. The result is a perfectly looping GIF with consistent frame timing — something you can't get by screen-recording the live preview.

**MP4 export** uses the WebCodecs API with mp4-muxer. The hard lesson here was that H.264 has opinions about resolution. The codec string encodes a "level" that caps the maximum number of macroblocks (16×16 pixel tiles). Trying to encode a 4K canvas with a Level 3.1 codec string fails silently. The fix is dynamic level selection based on the canvas dimensions:

```js
function _avcCodecForSize(w, h) {
  var area = Math.ceil(w/16)*16 * Math.ceil(h/16)*16;
  if (area <= 921600)  return 'avc1.42001f';  // Level 3.1
  if (area <= 2097152) return 'avc1.420028';  // Level 4.0
  if (area <= 8912896) return 'avc1.420032';  // Level 5.0
  return 'avc1.420034';                        // Level 5.2
}
```

The dimensions are rounded up to multiples of 16 before computing the area, because H.264 encodes in 16×16 macroblocks and partial blocks count as full ones. Keyframes are emitted every two seconds, and the muxer writes an fMP4 stream that's finalized into a blob and offered as a download.

## Scenes: simulation-driven animation

Everything described so far — the pattern equations, the spatial constants, the expression parser — operates on a single principle: a pure mathematical function takes a coordinate and returns a value. There's no state between frames. Every cell computes its value independently, and the global `time` variable is the only thing that changes.

Scenes throw that model out. A scene is a stateful grid simulation — Game of Life, flocking, fire propagation, wave physics. Instead of evaluating a function per pixel, the scene maintains a `Float32Array` buffer the size of the render grid and mutates it every frame according to simulation rules.

The architecture is a registry of scene objects, each defining three things:

```js
var SCENES = {};
SCENES.gameOfLife = {
  label: "Game of Life",
  params: [
    { key: "density", label: "Initial Density", min: 0.1, max: 0.9,
      step: 0.05, default: 0.4, tip: "How full the initial grid is" },
    { key: "tickSpeed", label: "Tick Speed", min: 0.5, max: 20,
      step: 0.5, default: 8 },
    // ...
  ],
  init: function(w, h, p) { /* allocate buffers, seed cells */ },
  update: function(dt, w, h, p, grid) { /* advance simulation, write grid */ }
};
```

The `init` function sets up whatever state the simulation needs — cell buffers, particle arrays, tip lists. The `update` function advances the simulation by `dt` seconds and writes scalar values into the output grid. There are eleven scenes: Cell Division, Particle Rain, Crystal Growth, Game of Life, Ripples, Flocking, Wave Propagation, Langton's Ant, Fire, Maze Generator, and DLA Snowflake.

The interesting design decision was how to integrate scenes into the existing render pipeline without duplicating it. The answer is that scenes are sampled exactly like patterns. In the render loop, where a pattern would call `computeValue()` to get a float from a math function, scenes call `_sampleScene()` to look up a float from the grid buffer:

```js
if (isScene) {
  value = _sampleScene(mx, my, fw, fh);
} else {
  value = computeValue(c.pattern, mx, my, fw, fh, c);
}
```

Both paths return a float. Everything downstream — character mapping, color cycling, Layer B blending — is identical regardless of whether the value came from a sine wave or a physics simulation. This means all the existing transforms work on scenes for free. You can rotate a Game of Life, apply 8-fold radial symmetry to a fire simulation, or add turbulence warp to crystal growth. The scene has no idea transforms are happening — it writes a flat grid, and the render pipeline samples that grid through warped coordinates.

### Two timing models

Scenes introduced a fundamental timing change. The math patterns use a global `time` counter incremented by a fixed step each frame — essentially a phase accumulator. The animation speed slider controls how big that step is, and the frame multiplier controls how much `time` feeds into the equation. This works because patterns are stateless: the output is a pure function of the current time value, so it doesn't matter how you got there.

Simulations can't work that way. A Game of Life generation has to be computed sequentially — you can't skip to frame 1000 without computing frames 1 through 999. So scenes use real wall-clock time via `performance.now()`:

```js
var now = performance.now();
dt = Math.min((now - _sceneLastTs) / 1000, 0.1);
_sceneLastTs = now;
dt *= (config.animationSpeed || 0.3) / 0.3;
```

The `dt` is capped at 100ms to prevent spiral-of-death when a tab regains focus after being backgrounded — without the cap, the simulation would try to advance by several seconds in a single frame, which either looks terrible or crashes.

Discrete simulations like Game of Life and Langton's Ant use a dt-to-step accumulator pattern. They accumulate `dt` into a counter, and when it crosses a threshold, they execute one discrete generation:

```js
st.tickAccum += dt * p.tickSpeed;
while (st.tickAccum >= 1) {
  st.tickAccum -= 1;
  // ... run one generation
}
```

This decouples simulation speed from frame rate. Whether the browser delivers 30fps or 60fps, the simulation advances at the same real-time rate. Continuous simulations like Particle Rain and Flocking integrate `dt` directly into velocity calculations — standard physics timestep integration.

### Optimizations worth the ugliness

Several scenes needed specific optimizations to run smoothly at 30fps on a typical grid.

Game of Life uses double-buffered `Uint8Array`s for the cell grid. After each generation, the current and next buffers swap references instead of allocating a new array. Zero allocations per tick. It also tracks population stability and reseeds automatically when the simulation goes stale — if the population changes by fewer than 3 cells for 30 consecutive generations, it scatters fresh random cells to restart the dynamics.

Cell Division stores all cell positions in flat `Float64Array`s (`cellX`, `cellY`, `cellO`) instead of an array of objects. For a scene that computes the distance from every screen cell to every simulation cell, cache-coherent flat arrays make a measurable difference. The recursive position function reuses a module-level `_posOut = [0, 0]` array instead of allocating a return value on each call.

Wave Propagation runs a discrete 2D wave equation with a Laplacian stencil, and needs three buffers (current, previous, next). Each frame, the buffers rotate: `prev←curr, curr←next, next←prev`. No allocation, just pointer reassignment.

### Dynamic parameter UI

Each scene declares its parameters as a structured array with min, max, step, default, and tooltip. When you activate a scene, `_buildSceneParamsUI()` reads this array and generates the slider UI dynamically — the same slider+number-box pattern used by the main controls. Moving a scene slider updates `_sceneParamsCache`, which the scene reads on the next frame. No DOM queries in the hot loop.

## Uploading ASCII art

The other addition that broke the pure-math model was letting people upload their own ASCII art as a source pattern. Instead of computing values from an equation, the system reads characters from a `.txt` file, maps each one to a density value, and renders through the existing pipeline.

The density mapping uses a hand-ordered ramp of 42 characters:

```
 .`'"^,:;!i|/\~-_+<>?][}{)(#*0OQ%&@$█▓▒░
```

Each character's position in this string determines its visual weight — space is 0.0, the full block `█` is near 1.0. Characters not in the ramp get a fallback: printable characters default to 0.5, control characters and spaces to 0. The density is then mapped to the $[-1, +1]$ range to match what `computeValue()` returns for math patterns.

The art grid is stored as an array of `Float32Array` rows. Sampling uses aspect-preserving contain — the art is scaled to fit inside the canvas without distortion, centered, with out-of-bounds regions returning $-1$ (dim). No interpolation; it's nearest-neighbor sampling with integer floor, which preserves the crisp character-cell look.

What makes it interesting is that uploaded art becomes just another value source in the render pipeline. It gets the same transform chain — you can rotate your ASCII art 45 degrees, apply mirror symmetry, or warp it with turbulence. The `asciiArt` pattern case even mixes a subtle sine-wave overlay on top of the uploaded grid:

```js
case "asciiArt":
  var artVal = sampleArtGrid(mx, my, fw, fh);
  return artVal * (c.globalVal || 1)
    + Math.sin(mx * c.xConstant + time * c.frameMultiplier)
    * Math.sin(my * c.yConstant + time * c.frameMultiplier * 0.7) * 0.3;
```

The `globalVal` parameter controls contrast, and the spatial constants drive a gentle wave animation across the art. At low values it's barely perceptible — a shimmer. At higher values the uploaded art becomes a canvas for interference patterns, the original text visible but distorted by mathematical waves washing across it.

## Why Windows XP

The interface is a pixel-accurate recreation of Windows XP's Luna theme. Blue title bar gradients, beveled input fields, the green-and-blue desktop background, a taskbar with a Start button and a clock.

The title bar gradient alone is six color stops:

```css
background: linear-gradient(to bottom,
  #5da4f0 0%, #3284df 4%, #1156c6 50%,
  #0d3fa8 51%, #1462d8 97%, #5eabf8 100%);
```

The sharp transition at 50%–51% creates the highlight ridge that was characteristic of Luna. The desktop background mimics the Bliss wallpaper with a twelve-stop gradient that transitions from blue sky through a horizon line into green hills.

Inputs use the XP inset border trick — the top and left borders are dark, the bottom and right are light, creating an illusion of depth:

```css
border-top-color: #696969;
border-left-color: #696969;
border-right-color: #e0ddd4;
border-bottom-color: #e0ddd4;
```

The menu system behaves like the real thing. Clicking a menu trigger opens its dropdown. While any menu is open, hovering over a different trigger switches to that menu immediately — no second click required. This "hover-follow" behavior is a small detail that makes the interface feel authentic rather than decorative.

Native browser tooltips are unreliable — they appear after an inconsistent delay, they can't be styled, and they disappear the moment you move the mouse. The studio replaces them with custom XP-style yellow balloon tooltips (`#ffffe1` background, 1px black border) on a 350ms hover delay. At initialization, every element's `title` attribute is moved to a `data-tip` attribute to suppress the native tooltip while preserving the text.

## What I actually learned

The interesting constraint of ASCII art as a medium is that your resolution is garbage. A typical render grid is 80 columns by 40 rows — 3,200 cells. A 1080p video frame has over two million pixels. You're working with three orders of magnitude less information. This means that subtle mathematical effects vanish. A gentle gradient that would look beautiful in high resolution becomes two or three character transitions in ASCII. The patterns that work are the ones with high spatial frequency and strong contrast — checkerboards, spirals, interference fringes.

The per-pattern slider ranges were the single biggest improvement to usability. Before them, every pattern required the user to already know what values were interesting. After them, dragging any slider anywhere produces a result worth looking at. That's the difference between a tool and a puzzle.

The expression parser was the most satisfying code to write. It's a complete mathematical programming language in about 120 lines — tokenizer, recursive descent parser, closure compiler, function library — and it runs in a hot loop tens of thousands of times per frame without any noticeable overhead. The memoization means the parse cost is paid once and the compiled closure is pure arithmetic from then on. Compiling to closures instead of an AST interpreter was the right call — there's no tree-walking overhead, just nested function calls that V8 can inline and optimize.

Adding scenes taught me that a well-chosen abstraction boundary can absorb radical changes. The decision to have everything funnel through a single `value → character → color` pipeline meant that simulations — which are architecturally nothing like math patterns — slotted in by implementing one function. The render loop didn't need to know whether it was drawing a sine wave or a cellular automaton. The tricky part was timing: bolting real-clock physics onto a system designed around a monotonic phase counter required careful separation between what `time` means for patterns and what `dt` means for simulations.

The ASCII art upload was a similar lesson in reuse. A `.txt` file is about as far from a trigonometric equation as you can get, but once you map characters to floats, it's just another value source. Rotation, symmetry, turbulence — all free. The sine-wave overlay was an accident that stuck: I added it to test whether the pattern constants still worked with uploaded art, and the shimmering effect on static text was compelling enough to keep.

The XP interface started as a joke and became the thing people remember. Nobody expects a tool for generating mathematical ASCII art to look like a twenty-year-old operating system. The dissonance between the visual style and the technical capability is part of the appeal. It's a creative tool that doesn't take itself seriously, and that gives the user permission not to take their output seriously either — which makes them more likely to experiment.
