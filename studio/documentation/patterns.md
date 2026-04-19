## Patterns

Each pattern is a different visual recipe. You don't need to understand the formula — just know what each one looks like and which sliders matter most.

<div style="display:flex;flex-wrap:wrap;gap:6px;margin:8px 0">
<div style="text-align:center">
<canvas data-demo="pat-centerSpiral" width="80" height="80"></canvas>
<div style="font-size:8px;color:#666;margin-top:1px">Center Spiral</div>
</div>
<div style="text-align:center">
<canvas data-demo="pat-circular" width="80" height="80"></canvas>
<div style="font-size:8px;color:#666;margin-top:1px">Circular</div>
</div>
<div style="text-align:center">
<canvas data-demo="pat-mosaic" width="80" height="80"></canvas>
<div style="font-size:8px;color:#666;margin-top:1px">Mosaic</div>
</div>
<div style="text-align:center">
<canvas data-demo="pat-cross" width="80" height="80"></canvas>
<div style="font-size:8px;color:#666;margin-top:1px">Cross</div>
</div>
<div style="text-align:center">
<canvas data-demo="pat-checkerboard" width="80" height="80"></canvas>
<div style="font-size:8px;color:#666;margin-top:1px">Checkerboard</div>
</div>
<div style="text-align:center">
<canvas data-demo="pat-diamond" width="80" height="80"></canvas>
<div style="font-size:8px;color:#666;margin-top:1px">Diamond</div>
</div>
<div style="text-align:center">
<canvas data-demo="pat-tunnel" width="80" height="80"></canvas>
<div style="font-size:8px;color:#666;margin-top:1px">Tunnel</div>
</div>
<div style="text-align:center">
<canvas data-demo="pat-plasma" width="80" height="80"></canvas>
<div style="font-size:8px;color:#666;margin-top:1px">Plasma</div>
</div>
<div style="text-align:center">
<canvas data-demo="pat-interference" width="80" height="80"></canvas>
<div style="font-size:8px;color:#666;margin-top:1px">Interference</div>
</div>
<div style="text-align:center">
<canvas data-demo="pat-radialStar" width="80" height="80"></canvas>
<div style="font-size:8px;color:#666;margin-top:1px">Radial Star</div>
</div>
<div style="text-align:center">
<canvas data-demo="pat-lissajous" width="80" height="80"></canvas>
<div style="font-size:8px;color:#666;margin-top:1px">Lissajous</div>
</div>
</div>

### Center Spiral

Rotating arms winding from the centre. Great for hypnotic, organic motion.

- **xC** — tighter or looser winding
- **yC** — curves the arms (try 3–6 for distinct petals)
- **gV** — adds a breathing, pulsing quality

**Try this:** Set yC to 5, gV to 2, enable Radial 8 symmetry → instant mandala.

### Circular

Concentric rings — simple, versatile, always looks clean.

- **xC** — horizontal ring density
- **yC** — vertical ring density
- When xC ≠ yC, rings become **elliptical** — great for depth

**Try this:** xC = 0.5, yC = 2.0 → tall, narrow oval rings.

### Mosaic

A grid of shimmering tiles. Perfect for retro/pixel aesthetics.

- **xC** — number of columns
- **yC** — number of rows

**Try this:** xC = 8, yC = 8, speed slow → gently pulsing pixel grid.

### Cross

Two waves crossing each other, creating interference at the centre.

- **xC** — horizontal frequency
- **yC** — vertical frequency

**Try this:** Set both to similar values for clean crosshairs, different values for chaotic moiré.

### Checkerboard

Tiled grid with animated shimmer along columns.

- **xC** — column spacing
- **yC** — row spacing

**Try this:** High xC + low yC → vertical bars that breathe.

### Diamond

Diamond-shaped contour lines — angular and geometric.

- **xC** — diamond density (how many nested diamonds)
- **yC** — twist (adds a spin to the diamond shape)

**Try this:** yC = 3, add rotation 45° → creates a rotating gem effect.

### Tunnel

An infinite zoom — feels like flying into the screen.

- **xC** — ring spacing (higher = more rings in the tunnel)
- **yC** — twist amount (higher = more spiralling)
- **gV** — adds a wobbly ripple to the tunnel walls

**Try this:** xC = 15, yC = 4, gV = 1.5, speed medium → psychedelic wormhole.

### Plasma

Classic demoscene effect — organic, blobby, and colourful. No constants needed; it just looks good. Change the palette to completely transform it.

**Try this:** Use a 5-colour rainbow palette → instant retro.

### Interference

Two wave sources that reinforce and cancel each other. Creates bright bands where waves align and dark bands where they cancel — like ripples crossing in water.

**Try this:** Layer B with Circular (Multiply blend) → complex wave physics look.

### Radial Star

Flower-like petals radiating from centre.

- **yC** — number of petals (try 3, 5, 7 for distinct flowers)
- **gV** — petal sharpness (higher = spikier)
- **xC** — ring density within the petals

**Try this:** yC = 6, gV = 3, Radial 6 symmetry → snowflake geometry.

### Lissajous

Two oscillators dancing — creates looping, figure-eight-style motion. Looks like an oscilloscope trace.

### Custom Equation

Write your own formula. See **Custom Equations** and **Equation Reference** in the help menu.

---

## Spatial Constants (xC, yC, gV)

These are the three main sliders that shape any pattern. Think of them as creative knobs rather than math variables — each one changes something visual, and the effect depends on which pattern is selected.

### xC — Shape / Density

Controls the **horizontal complexity**. Higher values pack more detail into the same space.

- Spirals: tighter winding
- Rings: more rings packed together
- Grids: more columns
- Tunnel: denser zoom rings

**Quick rule:** Turn it up for more detail, down for simpler shapes.

### yC — Detail / Structure

Controls the **vertical complexity or angular features**.

- Spirals: curvature of the arms
- Rings: vertical density (set differently from xC for elliptical shapes)
- Grids: more rows
- Star: **number of petals** — this is where flower shapes come from
- Diamond: angular twist

**Quick rule:** This is often the most "interesting" slider — it changes the character of the pattern.

### gV — Depth / Modulation

A secondary control that adds a **layer of movement or distortion** on top of the main shape.

- Spirals: breathing / pulsing feel
- Tunnel: wobbly ripple on the walls
- Star: spikiness of petals
- Plasma: radial mixing

**Quick rule:** Start at 0. Increase slowly. Small values (0.5–2) add subtle organic feel; larger values get wild.

### Tip

If you're not sure what a slider does for a given pattern, drag it from min to max and watch the preview. The effect is always instant.
