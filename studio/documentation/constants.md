## Spatial Constants (xC, yC, gV)

These are the three main sliders that shape any pattern. Think of them as creative knobs rather than math variables — each one changes something visual, and the effect depends on which pattern is selected.

### xC — Shape / Density

Controls the **horizontal complexity**. Higher values pack more detail into the same space.

<div style="display:flex;gap:8px;margin:8px 0">
<div style="text-align:center">
<canvas data-demo="const-xc-lo" width="100" height="100"></canvas>
<div style="font-size:8px;color:#666;margin-top:1px">Low xC</div>
</div>
<div style="text-align:center">
<canvas data-demo="const-xc-hi" width="100" height="100"></canvas>
<div style="font-size:8px;color:#666;margin-top:1px">High xC</div>
</div>
</div>

- Spirals: tighter winding
- Rings: more rings packed together
- Grids: more columns
- Tunnel: denser zoom rings

**Quick rule:** Turn it up for more detail, down for simpler shapes.

### yC — Detail / Structure

Controls the **vertical complexity or angular features**.

<div style="display:flex;gap:8px;margin:8px 0">
<div style="text-align:center">
<canvas data-demo="const-yc-lo" width="100" height="100"></canvas>
<div style="font-size:8px;color:#666;margin-top:1px">yC = 3 (few petals)</div>
</div>
<div style="text-align:center">
<canvas data-demo="const-yc-hi" width="100" height="100"></canvas>
<div style="font-size:8px;color:#666;margin-top:1px">yC = 8 (many petals)</div>
</div>
</div>

- Spirals: curvature of the arms
- Rings: vertical density (set differently from xC for elliptical shapes)
- Grids: more rows
- Star: **number of petals** — this is where flower shapes come from
- Diamond: angular twist

**Quick rule:** This is often the most "interesting" slider — it changes the character of the pattern.

### gV — Depth / Modulation

A secondary control that adds a **layer of movement or distortion** on top of the main shape.

<div style="display:flex;gap:8px;margin:8px 0">
<div style="text-align:center">
<canvas data-demo="const-gv-lo" width="100" height="100"></canvas>
<div style="font-size:8px;color:#666;margin-top:1px">gV = 0 (clean)</div>
</div>
<div style="text-align:center">
<canvas data-demo="const-gv-hi" width="100" height="100"></canvas>
<div style="font-size:8px;color:#666;margin-top:1px">gV = 4 (modulated)</div>
</div>
</div>

- Spirals: breathing / pulsing feel
- Tunnel: wobbly ripple on the walls
- Star: spikiness of petals
- Plasma: radial mixing

**Quick rule:** Start at 0. Increase slowly. Small values (0.5–2) add subtle organic feel; larger values get wild.

### Tip

If you're not sure what a slider does for a given pattern, drag it from min to max and watch the preview. The effect is always instant.
