## Custom Equations

Select **Custom Equation** from the pattern dropdown to write your own formula. No programming experience needed — start simple and build up.

### How It Works

Your formula runs for every character cell, every frame. It receives a position and the current time, and outputs a number. That number picks a character and colour.

### Variables You Can Use

<table style="border-collapse:collapse;width:100%;font-size:12px">
<tr><td style="padding:2px 8px"><code>x</code>, <code>y</code></td><td>Position on screen (raw coordinates)</td></tr>
<tr><td style="padding:2px 8px"><code>dx</code>, <code>dy</code></td><td>Position relative to centre</td></tr>
<tr><td style="padding:2px 8px"><code>r</code></td><td>Distance from centre (big at edges, zero at middle)</td></tr>
<tr><td style="padding:2px 8px"><code>theta</code></td><td>Angle from centre (goes around like a clock)</td></tr>
<tr><td style="padding:2px 8px"><code>time</code>, <code>t</code></td><td>Clock that counts up — makes things animate</td></tr>
<tr><td style="padding:2px 8px"><code>w</code>, <code>h</code></td><td>Canvas size in characters</td></tr>
<tr><td style="padding:2px 8px"><code>xC</code>, <code>yC</code>, <code>fm</code>, <code>gV</code></td><td>Your slider values — wire them in to make your formula tweakable</td></tr>
</table>

### Start Here (copy &amp; paste these)

<div style="display:flex;flex-wrap:wrap;gap:6px;margin:8px 0">
<div style="text-align:center">
<canvas data-demo="cust-rings" width="80" height="80"></canvas>
<div style="font-size:8px;color:#666;margin-top:1px">rings from centre</div>
</div>
<div style="text-align:center">
<canvas data-demo="cust-pinwheel" width="80" height="80"></canvas>
<div style="font-size:8px;color:#666;margin-top:1px">spinning pinwheel</div>
</div>
<div style="text-align:center">
<canvas data-demo="cust-plaid" width="80" height="80"></canvas>
<div style="font-size:8px;color:#666;margin-top:1px">diagonal plaid</div>
</div>
<div style="text-align:center">
<canvas data-demo="cust-flower" width="80" height="80"></canvas>
<div style="font-size:8px;color:#666;margin-top:1px">spinning flower</div>
</div>
</div>

`sin(r * 0.2 + time)` — expanding rings from centre

`sin(theta * 5 + time)` — spinning pinwheel

`sin(x*0.1+time) + sin(y*0.1+time)` — diagonal plaid

`sin(r*0.3) * cos(theta*3 + time)` — spinning flower

`fract(r*0.1 - time*0.5) * 2` — pulsing radar sweep

### Build Your Own — A Mental Model

- **sin(something)** creates smooth waves. Change what's inside to control the shape.
- Put **r** inside sin → rings. Put **theta** inside → rotations. Put **x** or **y** → stripes.
- Add **time** anywhere → makes it move.
- **Multiply things together** → they mask each other (rings × rotation = petals).
- Use **xC**, **yC**, **gV** as multipliers → your sliders become live controls.

### Security

Formulas are parsed by a safe engine — no code is ever executed directly.
