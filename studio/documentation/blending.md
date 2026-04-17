## Layer Blending

Layer B runs a second pattern on top of Layer A and combines them. This is where simple patterns become something neither could be alone.

### How to Use It

1. Enable **Layer B** in the sidebar
2. Choose a second pattern and adjust its sliders independently
3. Pick a **Blend Mode** — this controls how the two layers mix
4. Adjust **Blend Amount** — 0 = pure Layer A, 1 = full blend

### Blend Modes Explained

<div style="display:flex;flex-wrap:wrap;gap:6px;margin:8px 0">
<div style="text-align:center">
<canvas data-demo="blend-add" width="100" height="100"></canvas>
<div style="font-size:8px;color:#666;margin-top:1px">Add</div>
</div>
<div style="text-align:center">
<canvas data-demo="blend-multiply" width="100" height="100"></canvas>
<div style="font-size:8px;color:#666;margin-top:1px">Multiply</div>
</div>
<div style="text-align:center">
<canvas data-demo="blend-subtract" width="100" height="100"></canvas>
<div style="font-size:8px;color:#666;margin-top:1px">Subtract</div>
</div>
<div style="text-align:center">
<canvas data-demo="blend-screen" width="100" height="100"></canvas>
<div style="font-size:8px;color:#666;margin-top:1px">Screen</div>
</div>
</div>

- **Add** — layers stack on top of each other. Bright + bright = brighter. Creates a glowing, additive look.
- **Multiply** — both layers need to be bright for the result to show. Dark areas mask everything. Good for cutting shapes.
- **Subtract** — one layer carves into the other. Creates sharp negative space and cutouts.
- **Min** — keeps whichever value is darker. Good for combining outlines.
- **Max** — keeps whichever value is brighter. Good for layering fills.
- **Screen** — soft, light blending — like two projectors overlapping on a wall.

### Recipes

- **Spiral + Plasma (Add, 0.5)** → organic, flowing spiral with colourful blobs woven through
- **Tunnel + Interference (Multiply, 0.6)** → tunnel walls textured with wave patterns
- **Circular + Mosaic (Subtract, 0.4)** → rings punched through a grid — geometric and clean
- **Any pattern + same pattern (Multiply, offset xC/yC)** → self-interference creates moiré
- **Fire scene + Tunnel (Multiply, 0.5)** → flames with depth that look like they recede into the screen

### Tips

- **Multiply** is the most useful mode for creating textured, layered compositions
- Use **different** patterns in each layer for the most interesting results
- Start with Blend Amount at 0.3–0.5 and adjust from there
- You can blend a math pattern on top of a scene simulation — the pattern acts as a texture overlay
