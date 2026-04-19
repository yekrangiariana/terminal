## Welcome to ASCII Studio

ASCII Studio turns simple sliders into animated ASCII art. No math knowledge required — just drag, explore, and discover.

### 30-Second Quick Start

1. Hit **Randomize** — you'll get something interesting immediately
2. Like the vibe but want to tweak it? Drag the **xC** and **yC** sliders — they reshape the pattern
3. Change the **Characters** to alter density and texture
4. Swap the **Color Palette** to completely change the mood
5. Found something great? **File → Export** saves it as a standalone HTML, GIF, or MP4

### How It Works (the short version)

The canvas is built from **layers** that composite on top of each other. Each layer produces a value per cell, and that value picks a character and colour. You don't need to understand the formulas — the sliders let you sculpt everything visually.

### The Two Tabs

Everything is split into **Source** and **Style**:

**Source** — what generates the image. These are layers that stack on top of each other:

- **Pattern** — the base layer. A math formula that produces spirals, rings, grids, tunnels, etc. This is the foundation that everything else composites onto.
- **Scene** — a living simulation (fire, rain, flocking, etc.) that blends on top of the pattern. Each scene has its own blend mode and amount.
- **ASCII Art** — upload a `.txt` file and it blends as another layer on top. Has its own blend mode and amount.
- **Layer B** — a second math pattern that blends on top of everything else. Pick a different formula and blend mode for complex results.

You can use any combination — all four at once, or just one. Each layer (except the base pattern) has a blend mode and amount that controls how it mixes with the layers below.

**Style** — how the image looks. These apply to the final composited result:

- **Character Set** — which characters represent the values, and the font size
- **Colour Palette** — the colours mapped to those characters
- **Animation & Time** — frame multiplier and playback speed
- **Transform & Symmetry** — rotate, zoom, mirror, warp the output

### Removing a Source

Each source section has a **×** button in its header. Click it to remove that layer — the pattern goes to "None", the scene deactivates, art clears, or Layer B disables. Use the **⟳** reset button to restore defaults without removing.

### Tips That Save Time

- **Randomize** is your best starting point — hit it several times, then fine-tune what you like
- Use **🔒 Lock** to protect settings you love while randomizing the rest — locks are grouped by Sources and Style
- Hover any **?** icon for a quick explanation of that control
- Type exact numbers in the boxes next to sliders for precision
- Right-click a colour chip to remove it; click **+** to add more
- **Ctrl+Z** undoes everything, so experiment freely
