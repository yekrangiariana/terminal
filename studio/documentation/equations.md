## Equation Reference

<p style="margin-bottom:8px"><img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 10 10'%3E%3Cpolygon points='2,0 8,5 2,10' fill='%23009'/%3E%3C/svg%3E" style="vertical-align:middle;margin-right:3px" alt=""><a href="#" onclick="closeHelpWindow();showMathRef();return false" style="color:#00c;text-decoration:underline;font-size:12px">Open Math Reference</a> — click any formula to try it live (Ctrl+M)</p>

### What Kind of Maths Is This?

Honestly, I'm still figuring this out myself. But as far as I can tell, it's mostly **geometry** — shapes, distances, and angles on a flat surface. There's a bit of trigonometry in here (that's the maths of circles and waves) and some handy number-shaping tools. No calculus, no physics. I think that's the whole toolkit.

The core idea, as I understand it: every character on screen sits at a position on a 2D grid. Your formula takes that position and returns a number. That number decides which character gets drawn there. Different numbers at different positions = a pattern.

### The Grid

<table style="border-collapse:collapse;width:100%;font-size:11px;margin-bottom:6px">
<tr><td style="padding:3px 8px;white-space:nowrap"><code>x</code>, <code>y</code></td><td>The raw screen position of each character. <code>x</code> counts across (left → right), <code>y</code> counts down. Every character on the canvas has one.</td></tr>
<tr><td style="padding:3px 8px;white-space:nowrap"><code>dx</code>, <code>dy</code></td><td>Position <strong>measured from the centre</strong> of the canvas. The middle character is (0, 0), values go negative to the left and above. Most patterns seem to use these because centred looks better.</td></tr>
<tr><td style="padding:3px 8px;white-space:nowrap"><code>w</code>, <code>h</code></td><td>Canvas width and height in characters. Useful for scaling — <code>dx/w</code> gives you a normalised range.</td></tr>
<tr><td style="padding:3px 8px;white-space:nowrap"><code>time</code>, <code>t</code></td><td>A clock that counts up while the animation plays. Stick it in your formula and things move: <code>sin(x + time)</code> = scrolling stripes.</td></tr>
<tr><td style="padding:3px 8px;white-space:nowrap"><code>xC</code>, <code>yC</code>, <code>fm</code>, <code>gV</code></td><td>Your slider values. Wire these into any formula so the sliders control the look in real time.</td></tr>
</table>

### Distance & Angle (Polar Coordinates)

Every point on the grid also has a **distance** from the centre and an **angle** from the centre. I think these are called polar coordinates — and they seem to be why circular patterns are so easy to make here.

<canvas data-demo="polar" width="150" height="150" style="display:block;margin:8px auto"></canvas>

- **`r`** = distance from centre. Small near the middle, big near the edges. When you use `r` in a formula, every point at the same distance gets the same result — which makes a **circle**.
- **`theta`** = angle from centre (0 to ~6.28, one full rotation). When you use `theta`, every point at the same angle gets the same result — which makes **spokes** or slices.

This is what makes `r` and `theta` so handy. They basically turn a flat grid into circles and rotations for free.

### Waves: sin & cos

If you've never used these before (I hadn't): `sin` takes any number and returns a value that swings smoothly between −1 and +1, repeating forever. That's a **wave**. It comes from the geometry of circles — if you trace a point going around a circle and plot its height over time, you get this shape:

<canvas data-demo="sin" width="380" height="70" style="display:block;margin:6px 0"></canvas>

`cos` is the exact same shape, just shifted sideways. For pattern-making they seem to be basically interchangeable — pick whichever looks better.

Here's where it gets interesting. Feed a **position** into sin, and the wave becomes a pattern on the 2D grid:

<div style="display:flex;gap:8px;margin:8px 0">
<div style="text-align:center">
<canvas data-demo="sin-x" width="120" height="120"></canvas>
<div style="font-size:9px;color:#666;margin-top:2px">sin(x) — vertical stripes</div>
</div>
<div style="text-align:center">
<canvas data-demo="sin-y" width="120" height="120"></canvas>
<div style="font-size:9px;color:#666;margin-top:2px">sin(y) — horizontal stripes</div>
</div>
<div style="text-align:center">
<canvas data-demo="sin-r" width="120" height="120"></canvas>
<div style="font-size:9px;color:#666;margin-top:2px">sin(r) — concentric circles</div>
</div>
</div>

See what's happening? `sin(x)` repeats along x, so you get vertical stripes. `sin(y)` repeats along y, horizontal stripes. `sin(r)` repeats outward from the centre — circles. That's genuinely most of the maths you need. I was surprised how far just sin gets you.

Multiply the input to make the pattern tighter: `sin(x * 5)` = five times more stripes. Add `time` to make them scroll: `sin(x + time)`.

- `tan(x)` — like sin but spiky, shoots toward infinity. Creates sharp edges and grid-like interference patterns.
- `asin(x)`, `acos(x)`, `atan(x)` — the reverse of sin/cos/tan: give it a wave value, get an angle back. I mostly see these used for warping and bending.
- `atan2(y, x)` — finds the angle of any point from the origin. Basically what `theta` is.

### Shaping Numbers

So you've got a wave or a gradient. Now you want to reshape it — sharpen it, flatten it, posterise it. These seem to be the main sculpting tools:

- `abs(x)` — flips negatives to positive. A V-shape. `abs(sin(x))` turns the smooth wave into a bouncing zigzag with double the frequency.
- `floor(x)` — chops off the decimal. Turns smooth gradients into hard bands, like a posterise effect. `floor(sin(x)*3)/3` = three-tone stripes.
- `ceil(x)` — rounds up to the next whole number. `round(x)` — rounds to the nearest.
- `sqrt(x)` — square root. Big values grow slower, which compresses the bright end. Seems to make gradients feel wider near the centre.
- `pow(a, b)` — power. `pow(x, 2)` = x × x — makes dark areas darker and bright areas brighter (like a contrast boost). `pow(x, 0.5)` is the same as sqrt.
- `exp(x)` — exponential growth (gets big fast). `log(x)` — its inverse (grows very slowly). Useful for extreme scaling.
- `sign(x)` — reduces any value to just −1, 0, or 1. Instant stark black-and-white.
- `min(a, b)`, `max(a, b)` — pick the smaller or larger of two values. `min(sin(x), 0.5)` clips the wave's peaks flat.

### Repeating & Tiling

- **`fract(x)`** — keeps only the decimal part (always 0 to 1, then snaps back and repeats). This seems to be the key to tiling: `fract(x * 3)` chops the space into 3 copies of a 0→1 ramp.

<canvas data-demo="fract" width="380" height="70" style="display:block;margin:6px 0"></canvas>

- **`mod(a, b)`** — remainder after dividing. Same idea but you pick the repeat interval. `mod(x, 2)` repeats every 2 units instead of every 1.

### Blending & Transitions

- **`mix(a, b, t)`** — blend between two values. t=0 gives you a, t=1 gives you b, t=0.5 is halfway. Good for crossfading between two patterns based on position or time.
- **`clamp(x, lo, hi)`** — forces a value to stay inside a range. Nothing goes below lo or above hi. Stops values from blowing out.
- **`step(edge, x)`** — hard cutoff. Returns 0 below the edge, 1 above. Like a light switch — no in-between.
- **`smoothstep(lo, hi, x)`** — the smooth version of step. Fades gradually from 0 to 1 between lo and hi. No sudden jump, just a gentle S-curve. Seems to be one of the most useful functions for clean transitions.

<canvas data-demo="smoothstep" width="380" height="70" style="display:block;margin:6px 0"></canvas>

### Organic Texture

- **`noise(x, y)`** — smooth, natural-looking randomness. Think cloud shapes, terrain, or wood grain. Unlike pure random, nearby points get similar values — so the result looks organic, not like TV static. Scale the input to control the texture size: `noise(x*0.5, y*0.5)` = broad swirls, `noise(x*5, y*5)` = fine grit.

### Constants

- **`PI`** (≈ 3.14) — half of a full circle. `sin` completes one full wave every 2 × PI distance. Shows up everywhere in circle/rotation formulas.
- **`TAU`** (≈ 6.28) — a full circle. `TAU = 2 × PI`. When `theta` goes from 0 to TAU, that's one complete trip around.
- **`E`** (≈ 2.72) — base of natural logarithms. Used with `exp()` and `log()`. I'll be honest, I don't fully get this one yet.
- Operators: `+` `-` `*` `/` `%` `()`
