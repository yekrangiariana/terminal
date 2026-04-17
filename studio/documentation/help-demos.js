// ─────────────────────────────────────────────
//  Help documentation inline demos
//  Renders canvas[data-demo] elements in help pages
// ─────────────────────────────────────────────
function renderHelpDemos() {
  // ── Mini pattern renderer ──
  var sin = Math.sin, cos = Math.cos, abs = Math.abs, sqrt = Math.sqrt,
      atan2 = Math.atan2, PI = Math.PI, floor = Math.floor, round = Math.round,
      max = Math.max, min = Math.min;

  function patternVal(id, mx, my, fw, fh, xC, yC, fm, gV, t) {
    var hw = fw*0.5, hh = fh*0.5, dx, dy, r, theta;
    switch(id) {
      case 'centerSpiral':
        dx=mx-hw; dy=my-hh; theta=atan2(dy,dx)+xC;
        return sin((theta+(t+sin(mx*xC+my*yC))*fm+sin(theta*yC)+gV*sin(mx*xC+t))*(1+sin(theta*fm)));
      case 'circular':
        dx=mx-hw; dy=my-hh; return sin(dx*dx*xC+dy*dy*yC+t*fm);
      case 'mosaic':
        return sin(mx*xC+t)*sin(my*yC+t);
      case 'cross':
        dx=mx-hw; dy=my-hh; return sin(dx*dx*xC+t*fm)+cos(dy*dy*yC+t*fm);
      case 'checkerboard':
        return sin(mx*xC)*sin(my*yC+t);
      case 'diamond':
        dx=mx-hw; dy=my-hh; return sin((abs(dx)+abs(dy))*xC+t*fm)*cos(yC*atan2(dy,dx)+t*fm*0.5);
      case 'tunnel':
        dx=mx-hw; dy=my-hh; r=sqrt(dx*dx+dy*dy)+0.01; theta=atan2(dy,dx);
        return sin(xC/r+t*fm)*sin(theta*yC+t*fm*0.7+gV*sin(r*0.1));
      case 'plasma':
        dx=mx-hw; dy=my-hh;
        return (sin(mx*xC*0.01+t)+sin(my*yC*0.01+t*1.5)+sin((mx+my)*xC*0.005+t*0.7)+sin(sqrt(dx*dx+dy*dy)*yC*0.01+t*1.2+gV))*0.25;
      case 'interference':
        var s1x=fw*0.3,s1y=fh*0.5,s2x=fw*0.7,s2y=fh*0.5;
        return (sin(sqrt((mx-s1x)*(mx-s1x)+(my-s1y)*(my-s1y))*xC+t*fm+gV)+sin(sqrt((mx-s2x)*(mx-s2x)+(my-s2y)*(my-s2y))*yC+t*fm))*0.5;
      case 'radialStar':
        dx=mx-hw; dy=my-hh; r=sqrt(dx*dx+dy*dy); theta=atan2(dy,dx);
        var petals=max(1,round(abs(yC)));
        return sin(r*xC+cos(theta*petals)*gV+t*fm);
      case 'lissajous':
        return sin(mx*xC*0.1+sin(t*3)*gV)*sin(my*yC*0.1+cos(t*2)*gV);
      default: return sin(mx*0.1)*sin(my*0.1);
    }
  }

  function renderPattern(ctx, w, h, id, xC, yC, fm, gV, opts) {
    opts = opts || {};
    var t = opts.time || 0;
    var rot = (opts.rotation || 0) * PI / 180;
    var scale = opts.scale || 1;
    var sym = opts.symmetry || 'none';
    var turb = opts.turbulence || 0;
    var cosR = cos(rot), sinR = sin(rot);
    var img = ctx.createImageData(w, h);
    var fw = w, fh = h;
    for (var py = 0; py < h; py++) {
      for (var px = 0; px < w; px++) {
        var dx = px - fw*0.5, dy = py - fh*0.5;
        // rotation
        if (rot) { var rx=dx*cosR-dy*sinR, ry=dx*sinR+dy*cosR; dx=rx; dy=ry; }
        // scale
        dx /= scale; dy /= scale;
        // symmetry
        if (sym === 'x') { dx = abs(dx); }
        else if (sym === 'y') { dy = abs(dy); }
        else if (sym === 'both') { dx = abs(dx); dy = abs(dy); }
        else if (sym.indexOf('radial') === 0) {
          var sn = parseInt(sym.charAt(sym.length-1));
          var ss = 2*PI/sn, ang = atan2(dy,dx), rr = sqrt(dx*dx+dy*dy);
          ang = ((ang%ss)+ss)%ss; if(ang>ss*0.5) ang=ss-ang;
          dx=rr*cos(ang); dy=rr*sin(ang);
        }
        // turbulence
        if (turb) {
          dx += (sin(dx*0.031+dy*0.071)*0.5+sin(dx*0.113-dy*0.037)*0.3)*turb*10;
          dy += (cos(dx*0.071+dy*0.031)*0.5+cos(dx*0.037-dy*0.113)*0.3)*turb*10;
        }
        var mx = dx + fw*0.5, my = dy + fh*0.5;
        var val = patternVal(id, mx, my, fw, fh, xC, yC, fm, gV, t);
        // blend layer B
        if (opts.blendPattern) {
          var vb = patternVal(opts.blendPattern, mx, my, fw, fh,
            opts.blendXC||0.01, opts.blendYC||0.01, opts.blendFm||1, opts.blendGV||0, t);
          var bm = opts.blendMode || 'add', ba = opts.blendAmount || 0.5;
          var bv;
          if (bm==='add') bv=val+vb;
          else if (bm==='multiply') bv=val*vb;
          else if (bm==='subtract') bv=val-vb;
          else if (bm==='min') bv=min(val,vb);
          else if (bm==='max') bv=max(val,vb);
          else if (bm==='screen') bv=val+vb-val*vb;
          else bv=val+vb;
          val = val*(1-ba)+bv*ba;
        }
        var b = ~~((val*0.5+0.5)*255);
        b = b<0?0:b>255?255:b;
        var i = (py*w+px)*4;
        img.data[i]=b; img.data[i+1]=b; img.data[i+2]=b; img.data[i+3]=255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  // ── 1D graph definitions ──
  var graphDefs = {
    sin:        { fn: sin, color: '#2255bb', x: [-7,7], y: [-1.4,1.4] },
    fract:      { fn: function(v){return v-floor(v)}, color: '#228833', x: [-1,4], y: [-0.3,1.3] },
    smoothstep: { fn: function(v){var t=v<0?0:v>1?1:v; return t*t*(3-2*t)}, color: '#bb4422', x: [-0.5,1.5], y: [-0.2,1.2] }
  };

  // ── Pattern preset definitions ──
  var patternDefs = {
    'pat-centerSpiral': { id:'centerSpiral', xC:1, yC:5, fm:1, gV:2 },
    'pat-circular':     { id:'circular', xC:0.008, yC:0.008, fm:1, gV:0 },
    'pat-mosaic':       { id:'mosaic', xC:0.15, yC:0.15, fm:0, gV:0 },
    'pat-cross':        { id:'cross', xC:0.01, yC:0.01, fm:0, gV:0 },
    'pat-checkerboard': { id:'checkerboard', xC:0.12, yC:0.12, fm:0, gV:0 },
    'pat-diamond':      { id:'diamond', xC:0.15, yC:3, fm:0, gV:0 },
    'pat-tunnel':       { id:'tunnel', xC:15, yC:3, fm:0, gV:1 },
    'pat-plasma':       { id:'plasma', xC:8, yC:8, fm:0, gV:1 },
    'pat-interference': { id:'interference', xC:0.3, yC:0.3, fm:0, gV:0 },
    'pat-radialStar':   { id:'radialStar', xC:0.15, yC:6, fm:0, gV:3 },
    'pat-lissajous':    { id:'lissajous', xC:5, yC:7, fm:0, gV:2 },
    // transforms demos
    'xfm-none':         { id:'diamond', xC:0.15, yC:3, fm:0, gV:0 },
    'xfm-rot45':        { id:'diamond', xC:0.15, yC:3, fm:0, gV:0, rotation:45 },
    'xfm-scale':        { id:'tunnel', xC:15, yC:3, fm:0, gV:1, scale:0.5 },
    'xfm-turb':         { id:'checkerboard', xC:0.12, yC:0.12, fm:0, gV:0, turbulence:2 },
    'sym-none':         { id:'centerSpiral', xC:1, yC:4, fm:0, gV:1 },
    'sym-x':            { id:'centerSpiral', xC:1, yC:4, fm:0, gV:1, symmetry:'x' },
    'sym-y':            { id:'centerSpiral', xC:1, yC:4, fm:0, gV:1, symmetry:'y' },
    'sym-both':         { id:'centerSpiral', xC:1, yC:4, fm:0, gV:1, symmetry:'both' },
    'sym-r4':           { id:'centerSpiral', xC:1, yC:4, fm:0, gV:1, symmetry:'radial4' },
    'sym-r6':           { id:'centerSpiral', xC:1, yC:4, fm:0, gV:1, symmetry:'radial6' },
    'sym-r8':           { id:'centerSpiral', xC:1, yC:4, fm:0, gV:1, symmetry:'radial8' },
    // blending demos
    'blend-add':        { id:'centerSpiral', xC:1, yC:5, fm:0, gV:0, blendPattern:'circular', blendXC:0.008, blendYC:0.008, blendMode:'add', blendAmount:0.5 },
    'blend-multiply':   { id:'centerSpiral', xC:1, yC:5, fm:0, gV:0, blendPattern:'circular', blendXC:0.008, blendYC:0.008, blendMode:'multiply', blendAmount:0.6 },
    'blend-subtract':   { id:'circular', xC:0.008, yC:0.008, fm:0, gV:0, blendPattern:'mosaic', blendXC:0.15, blendYC:0.15, blendMode:'subtract', blendAmount:0.5 },
    'blend-screen':     { id:'tunnel', xC:15, yC:3, fm:0, gV:0, blendPattern:'interference', blendXC:0.3, blendYC:0.3, blendMode:'screen', blendAmount:0.5 },
    // constants demos
    'const-xc-lo':      { id:'circular', xC:0.002, yC:0.002, fm:0, gV:0 },
    'const-xc-hi':      { id:'circular', xC:0.03, yC:0.002, fm:0, gV:0 },
    'const-yc-lo':      { id:'radialStar', xC:0.15, yC:3, fm:0, gV:3 },
    'const-yc-hi':      { id:'radialStar', xC:0.15, yC:8, fm:0, gV:3 },
    'const-gv-lo':      { id:'centerSpiral', xC:1, yC:5, fm:0, gV:0 },
    'const-gv-hi':      { id:'centerSpiral', xC:1, yC:5, fm:0, gV:4 },
    // custom formula demos
    'cust-rings':       { id:'circular', xC:0.005, yC:0.005, fm:0, gV:0 },
    'cust-pinwheel':    { id:'radialStar', xC:0.01, yC:5, fm:0, gV:5 },
    'cust-plaid':       { id:'mosaic', xC:0.1, yC:0.1, fm:0, gV:0 },
    'cust-flower':      { id:'radialStar', xC:0.1, yC:3, fm:0, gV:3 }
  };

  document.querySelectorAll('#help-content canvas[data-demo]').forEach(function(el) {
    var ctx = el.getContext('2d'), w = el.width, h = el.height, demo = el.dataset.demo;
    // ── 1D function graphs ──
    if (graphDefs[demo]) {
      var d = graphDefs[demo];
      var xMin = d.x[0], xMax = d.x[1], yMin = d.y[0], yMax = d.y[1];
      ctx.fillStyle = '#fafafa'; ctx.fillRect(0, 0, w, h);
      var ax = (0-xMin)/(xMax-xMin)*w, ay = h-(0-yMin)/(yMax-yMin)*h;
      ctx.strokeStyle = '#e0e0e0'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(ax,0); ctx.lineTo(ax,h); ctx.moveTo(0,ay); ctx.lineTo(w,ay); ctx.stroke();
      ctx.strokeStyle = d.color; ctx.lineWidth = 2; ctx.beginPath();
      for (var px=0; px<w; px++) {
        var xv=xMin+(px/w)*(xMax-xMin), yv=d.fn(xv);
        var py=h-(yv-yMin)/(yMax-yMin)*h;
        px===0?ctx.moveTo(px,py):ctx.lineTo(px,py);
      }
      ctx.stroke(); return;
    }
    // ── 2D pattern previews (equations page) ──
    if (demo==='sin-x'||demo==='sin-y'||demo==='sin-r') {
      var img = ctx.createImageData(w, h);
      for (var py=0; py<h; py++) for (var px=0; px<w; px++) {
        var xv=(px/w-0.5)*10, yv=(py/h-0.5)*10, rr=sqrt(xv*xv+yv*yv);
        var val=demo==='sin-x'?sin(xv*1.8):demo==='sin-y'?sin(yv*1.8):sin(rr*1.8);
        var b=~~((val*0.5+0.5)*255), i=(py*w+px)*4;
        img.data[i]=b; img.data[i+1]=b; img.data[i+2]=b; img.data[i+3]=255;
      }
      ctx.putImageData(img,0,0); return;
    }
    // ── Polar coordinates diagram ──
    if (demo==='polar') {
      var cx=w/2,cy=h/2,rad=min(cx,cy)-16;
      ctx.fillStyle='#fafafa'; ctx.fillRect(0,0,w,h);
      ctx.strokeStyle='#e8e8e8'; ctx.lineWidth=1;
      for(var i=1;i<=3;i++){ctx.beginPath();ctx.arc(cx,cy,rad*i/3,0,PI*2);ctx.stroke();}
      ctx.strokeStyle='#ddd';
      ctx.beginPath();ctx.moveTo(cx-rad,cy);ctx.lineTo(cx+rad,cy);ctx.moveTo(cx,cy-rad);ctx.lineTo(cx,cy+rad);ctx.stroke();
      var ang=0.65,dist=rad*0.72,ex=cx+cos(ang)*dist,ey=cy-sin(ang)*dist;
      ctx.setLineDash([4,3]);ctx.strokeStyle='#cc3333';ctx.lineWidth=1.5;
      ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(ex,ey);ctx.stroke();ctx.setLineDash([]);
      ctx.strokeStyle='#2255bb';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(cx,cy,22,-ang,0);ctx.stroke();
      ctx.fillStyle='#333';ctx.beginPath();ctx.arc(ex,ey,3,0,PI*2);ctx.fill();
      ctx.font='bold 11px sans-serif';
      ctx.fillStyle='#cc3333';ctx.fillText('r',cx+cos(ang)*dist*0.4-2,cy-sin(ang)*dist*0.4-4);
      ctx.fillStyle='#2255bb';ctx.fillText('\u03b8',cx+28,cy-3);
      ctx.fillStyle='#999';ctx.font='9px sans-serif';ctx.fillText('centre',cx-16,cy+14);
      return;
    }
    // ── Pattern/transform/blend presets ──
    if (patternDefs[demo]) {
      var p = patternDefs[demo];
      renderPattern(ctx, w, h, p.id, p.xC, p.yC, p.fm||0, p.gV||0, {
        time: p.time||0, rotation: p.rotation||0, scale: p.scale||1,
        symmetry: p.symmetry||'none', turbulence: p.turbulence||0,
        blendPattern: p.blendPattern, blendXC: p.blendXC, blendYC: p.blendYC,
        blendFm: p.blendFm, blendGV: p.blendGV,
        blendMode: p.blendMode, blendAmount: p.blendAmount
      });
    }
  });
}
