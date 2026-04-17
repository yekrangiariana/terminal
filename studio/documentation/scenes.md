## Scenes — Living Simulations

Scenes are animations that **evolve over time** — unlike patterns, which repeat a math formula, scenes have memory. Each frame builds on the last. Fire flickers unpredictably, rain accumulates, cells grow and die.

### How They Work Under the Hood

A pattern computes each cell independently: give it a position, get a value. A scene is different — it maintains a **grid of values** (one per character cell) and **updates the whole grid every frame**. The update can look at neighbouring cells, track particles, or simulate physics. That's why scenes can do things like spreading fire, growing crystals, and flocking — things that need cells to know about each other.

The clever part: the output is still just a number per cell, the same as a pattern. So after the scene writes its grid, everything else works exactly the same — **Transforms** rotate/scale the scene, **Symmetry** mirrors it, **Layer B** blends a pattern on top, and **Characters & Colours** map the values to glyphs. A fire simulation through Radial 8 symmetry becomes a mandala of flames.

### How to Use Scenes

1. Open the **Scenes** section and click any scene button
2. Adjust the scene-specific sliders that appear — each scene has its own controls
3. Add **Symmetry**, **Transforms**, or **Layer B** to enhance
4. Click **Exit Scene** to return to math patterns

### Built-In Scenes

**Cell Division** — Cells split 1→2→4→…→32, then restart. Each cell is tracked individually and grows until it divides. Try with slow speed for a meditative effect.

**Particle Rain** — Hundreds of particles fall with trailing streaks. Each particle has position + velocity, updated every frame. Wind tilts the angle. Layer with Tunnel (Multiply) for rain falling into a void.

**Crystal Growth** — Seeds grow outward by checking if neighbouring cells are empty. Branches form because growth favours certain angles. **Best scene for mandalas** — try Radial 6 or 8 symmetry for living snowflakes.

**Game of Life** — Conway's classic: each cell survives, is born, or dies based on its 8 neighbours. Ghost trails fade dead cells slowly. Add turbulence for organic, cell-culture textures.

**Ripples** — Simulates 2D wave physics. Random splash points create expanding rings that bounce and interfere. Each cell tracks height + velocity, like a mesh of springs. Layer with Circular pattern for complex wave interference.

**Flocking** — Boids (bird-like particles) follow three rules: steer toward neighbours, match their direction, and avoid crowding. These simple rules produce complex swarming. Adjust cohesion vs separation — tight schools of fish or scattered fireflies.

**Wave Propagation** — Full 2D wave equation with damping. Random disturbances hit the surface and waves spread, reflect, and interfere. Looks like a vibrating membrane. Add Radial 4 symmetry for standing-wave patterns.

**Langton's Ant** — An ant on a grid: on white, turn right, flip the cell, step forward. On black, turn left, flip, step. From these two rules, highways and complex structures emerge. Multiple ants with different rule variants (RL, RLR, LLRR, RLLR) run simultaneously.

**Fire** — Classic heat simulation: the bottom row gets random sparks (hot values). Each frame, heat rises upward and cools. Each cell averages its neighbours below, creating the flickering effect. Layer a Tunnel on top (Multiply) for fire with depth.

**Maze Generator** — A depth-first search carves corridors in real time. You watch the algorithm explore, backtrack, and find new paths. The frontier glows as it moves. Try with X-axis symmetry for mirrored mazes.

**DLA Snowflake** — Diffusion-Limited Aggregation: particles drift randomly until they touch something stuck, then they freeze in place. Over time, fractal branching structures grow. With Radial 6 or 8, produces spectacular crystal mandalas.

**Reaction-Diffusion** — Gray-Scott model: two chemicals (A and B) diffuse across the grid and react. A feeds in constantly, B is removed at a rate you control. Where they meet, A turns into B — but B also breaks down. The balance between feed and kill rates produces spots, stripes, worms, and labyrinth patterns. Adjust Feed Rate and Kill Rate to explore the rich phase space — small changes produce wildly different structures.

**Falling Sand** — Gravity-driven particle simulation. Sand spawns at the top and falls, piling up at the bottom. Each grain checks below it — if empty, it falls; if blocked, it slides diagonally. Erosion slowly decays piles so the landscape keeps shifting. Increase Spawn Rate for dense curtains, lower Gravity for slow-motion cascades.

**Lightning** — Branching electrical discharge. Bolts start at the top and walk downward with random jitter. At each step, a bolt can fork into branches, each inheriting some energy. The flash lingers as a glow that fades over time. High Branches + high Jitter creates dense storm systems. Layer with a dark palette for dramatic effect.

### Scene + Feature Recipes

- **Crystal Growth + Radial 8** → living mandala that grows itself
- **Fire + Tunnel (Layer B, Multiply)** → flames receding into infinite depth
- **Game of Life + Turbulence 1.5** → biological, cell-culture texture
- **DLA + Radial 6 + blue/white palette** → ice crystal mandala
- **Flocking + Radial 4 + low cohesion** → scattered particle mandala
- **Ripples + Circular (Layer B, Add)** → complex overlapping wave patterns
- **Any scene + different charset** → completely different aesthetic from the same simulation
- **Reaction-Diffusion + Radial 4** → organic coral/lichen mandala
- **Falling Sand + Y-axis symmetry** → hourglass effect
- **Lightning + Radial 6 + bright palette** → electric snowflake
