## Transforms &amp; Symmetry

Transforms reshape, rotate, and mirror the pattern after it's generated. This is where simple patterns become complex compositions.

### Center X / Center Y

Moves the pattern's origin. Default is dead centre. Shifting off-centre creates asymmetric, more natural-looking compositions.

**Try this:** Push Center X to 0.15 on a Spiral → the spiral sits off to one side, like a nautilus shell.

### Rotation

Rotates the entire pattern (0–360°). Useful for tilting spirals at an angle or aligning geometry.

<div style="display:flex;gap:8px;margin:8px 0">
<div style="text-align:center">
<canvas data-demo="xfm-none" width="100" height="100"></canvas>
<div style="font-size:8px;color:#666;margin-top:1px">No rotation</div>
</div>
<div style="text-align:center">
<canvas data-demo="xfm-rot45" width="100" height="100"></canvas>
<div style="font-size:8px;color:#666;margin-top:1px">45° rotation</div>
</div>
</div>

**Try this:** Diamond pattern + 45° rotation → creates a rotated grid effect.

### Scale

Zooms the pattern. **Below 1** = zoom in (fewer, larger details). **Above 1** = zoom out (more, smaller details).

**Try this:** Scale a Tunnel to 0.5 → massive, dramatic zoom. Scale to 2.0 → dense, intricate rings.

### Turbulence

Adds organic warping — like looking through rippled water. Distorts all coordinates with noise.

<div style="display:flex;gap:8px;margin:8px 0">
<div style="text-align:center">
<canvas data-demo="pat-checkerboard" width="100" height="100"></canvas>
<div style="font-size:8px;color:#666;margin-top:1px">No turbulence</div>
</div>
<div style="text-align:center">
<canvas data-demo="xfm-turb" width="100" height="100"></canvas>
<div style="font-size:8px;color:#666;margin-top:1px">Turbulence = 2</div>
</div>
</div>

- **0** — clean, mathematical shapes
- **0.5–2** — subtle organic feel (handmade / natural look)
- **3+** — heavy distortion (abstract, melted appearance)

**Try this:** Take any geometric pattern (Mosaic, Checkerboard) and add turbulence 1.5 → transforms rigid grids into something that looks hand-drawn.

### Symmetry

This is the most powerful creative tool. It mirrors the pattern across axes, creating complex geometry from simple shapes.

<div style="display:flex;flex-wrap:wrap;gap:6px;margin:8px 0">
<div style="text-align:center">
<canvas data-demo="sym-none" width="80" height="80"></canvas>
<div style="font-size:8px;color:#666;margin-top:1px">None</div>
</div>
<div style="text-align:center">
<canvas data-demo="sym-x" width="80" height="80"></canvas>
<div style="font-size:8px;color:#666;margin-top:1px">X axis</div>
</div>
<div style="text-align:center">
<canvas data-demo="sym-y" width="80" height="80"></canvas>
<div style="font-size:8px;color:#666;margin-top:1px">Y axis</div>
</div>
<div style="text-align:center">
<canvas data-demo="sym-both" width="80" height="80"></canvas>
<div style="font-size:8px;color:#666;margin-top:1px">Both</div>
</div>
<div style="text-align:center">
<canvas data-demo="sym-r4" width="80" height="80"></canvas>
<div style="font-size:8px;color:#666;margin-top:1px">Radial 4</div>
</div>
<div style="text-align:center">
<canvas data-demo="sym-r6" width="80" height="80"></canvas>
<div style="font-size:8px;color:#666;margin-top:1px">Radial 6</div>
</div>
<div style="text-align:center">
<canvas data-demo="sym-r8" width="80" height="80"></canvas>
<div style="font-size:8px;color:#666;margin-top:1px">Radial 8</div>
</div>
</div>

- **None** — raw output
- **X axis** — mirrors left ↔ right
- **Y axis** — mirrors top ↔ bottom
- **Both axes** — four-fold symmetry (like a butterfly)
- **Radial 4** — four-way kaleidoscope
- **Radial 6** — hexagonal / snowflake geometry
- **Radial 8** — eight-fold mandala (the most dramatic)

### Symmetry Recipes

- **Radial 8 + Spiral** → instant mandala with rotating arms
- **Radial 6 + Crystal Growth** → snowflake that builds itself
- **Both axes + Tunnel** → four-way infinite zoom
- **X axis + any pattern + turbulence** → organic Rorschach inkblots
- **Radial 8 + DLA Snowflake** → stunning fractal mandala
