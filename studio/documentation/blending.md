## Layer Blending

Sources stack as compositing layers — each one blends onto the result below it. The order is: **Pattern → Scene → ASCII Art → Layer B**. The pattern is the base; the others each have a blend mode and amount controlling how they mix in.

### The Compositing Stack

1. **Pattern** — the foundation. No blend mode — it's the starting layer.
2. **Scene** — blends on top of the pattern (blend mode + amount in the scene section).
3. **ASCII Art** — blends on top of the combined pattern + scene (blend mode + amount in the art section).
4. **Layer B** — a second math pattern that blends on top of everything.

Any layer can be disabled. If the pattern is "None", the next active layer becomes the base. You can use a scene alone, art alone, or any combination.

### How to Use It

1. Start with a **Pattern** as your base (or set it to None if you only want a scene/art)
2. Add a **Scene** and adjust its blend mode and amount in the scene controls
3. Upload **ASCII Art** and configure its blend mode and amount
4. Enable **Layer B**, choose a second pattern, pick a blend mode and amount

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
