/* ════════════════════════════════════════
   ASCII STUDIO — Engine & UI
   ════════════════════════════════════════ */

var TICK_MS = 33,
  SPEED_SCALE = 0.03,
  LINE_HEIGHT = 1.15,
  TWO_PI = Math.PI * 2;

// ══════════════════════════════════════
//  SAFE MATH EXPRESSION PARSER
//  No eval — tokenizer + recursive descent
// ══════════════════════════════════════
var _exprCache = {}; // formula string → compiled function

function compileExpr(src) {
  if (_exprCache[src]) return _exprCache[src];
  try {
    var fn = _parseExpr(src);
    _exprCache[src] = fn;
    return fn;
  } catch (e) {
    return null; // invalid formula
  }
}

function _parseExpr(src) {
  // Tokenizer
  var tokens = [],
    i = 0,
    s = src.replace(/\s+/g, "");
  while (i < s.length) {
    var ch = s[i];
    // Number
    if (
      (ch >= "0" && ch <= "9") ||
      (ch === "." && i + 1 < s.length && s[i + 1] >= "0" && s[i + 1] <= "9")
    ) {
      var n = "";
      while (i < s.length && ((s[i] >= "0" && s[i] <= "9") || s[i] === "."))
        n += s[i++];
      tokens.push({ type: "num", val: parseFloat(n) });
    }
    // Identifier or function
    else if (
      (ch >= "a" && ch <= "z") ||
      (ch >= "A" && ch <= "Z") ||
      ch === "_"
    ) {
      var id = "";
      while (
        i < s.length &&
        ((s[i] >= "a" && s[i] <= "z") ||
          (s[i] >= "A" && s[i] <= "Z") ||
          (s[i] >= "0" && s[i] <= "9") ||
          s[i] === "_")
      )
        id += s[i++];
      tokens.push({ type: "id", val: id });
    }
    // Operators
    else if ("+-*/^%(),".indexOf(ch) >= 0) {
      tokens.push({ type: "op", val: ch });
      i++;
    }
    // Pi constant
    else if (ch === "\u03C0") {
      tokens.push({ type: "num", val: Math.PI });
      i++;
    } else {
      i++;
    } // skip unknown
  }

  // Allowed functions (whitelist)
  var FUNCS = {
    sin: Math.sin,
    cos: Math.cos,
    tan: Math.tan,
    asin: Math.asin,
    acos: Math.acos,
    atan: Math.atan,
    atan2: Math.atan2,
    sqrt: Math.sqrt,
    abs: Math.abs,
    pow: Math.pow,
    log: Math.log,
    min: Math.min,
    max: Math.max,
    floor: Math.floor,
    ceil: Math.ceil,
    round: Math.round,
    sign: Math.sign,
    exp: Math.exp,
    fract: function (x) {
      return x - Math.floor(x);
    },
    mod: function (a, b) {
      return ((a % b) + b) % b;
    },
    clamp: function (x, lo, hi) {
      return Math.min(Math.max(x, lo), hi);
    },
    mix: function (a, b, t) {
      return a * (1 - t) + b * t;
    },
    step: function (edge, x) {
      return x < edge ? 0 : 1;
    },
    smoothstep: function (lo, hi, x) {
      if (x <= lo) return 0;
      if (x >= hi) return 1;
      var t = (x - lo) / (hi - lo);
      return t * t * (3 - 2 * t);
    },
    noise: function (x, y) {
      var n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
      return n - Math.floor(n);
    },
  };
  // Allowed variables
  var VARS = {
    x: 1,
    y: 1,
    time: 1,
    t: 1,
    dx: 1,
    dy: 1,
    r: 1,
    theta: 1,
    PI: 1,
    pi: 1,
    TAU: 1,
    E: 1,
    xC: 1,
    yC: 1,
    fm: 1,
    gV: 1,
    w: 1,
    h: 1,
  };

  // Recursive descent parser → returns a function(env)
  var pos = 0;
  function peek() {
    return pos < tokens.length ? tokens[pos] : null;
  }
  function eat(type, val) {
    var t = peek();
    if (!t) throw "unexpected end";
    if (type && t.type !== type) throw "expected " + type;
    if (val !== undefined && t.val !== val) throw "expected " + val;
    pos++;
    return t;
  }

  function parseExprLevel() {
    return parseAdd();
  }

  function parseAdd() {
    var left = parseMul();
    while (
      peek() &&
      peek().type === "op" &&
      (peek().val === "+" || peek().val === "-")
    ) {
      var op = eat("op").val;
      var right = parseMul();
      left =
        op === "+"
          ? mkBin(left, right, function (a, b) {
              return a + b;
            })
          : mkBin(left, right, function (a, b) {
              return a - b;
            });
    }
    return left;
  }

  function parseMul() {
    var left = parsePow();
    while (
      peek() &&
      peek().type === "op" &&
      (peek().val === "*" || peek().val === "/" || peek().val === "%")
    ) {
      var op = eat("op").val;
      var right = parsePow();
      if (op === "*")
        left = mkBin(left, right, function (a, b) {
          return a * b;
        });
      else if (op === "/")
        left = mkBin(left, right, function (a, b) {
          return b === 0 ? 0 : a / b;
        });
      else
        left = mkBin(left, right, function (a, b) {
          return b === 0 ? 0 : a % b;
        });
    }
    return left;
  }

  function parsePow() {
    var base = parseUnary();
    if (peek() && peek().type === "op" && peek().val === "^") {
      eat("op");
      var exp = parseUnary();
      return mkBin(base, exp, Math.pow);
    }
    return base;
  }

  function parseUnary() {
    if (peek() && peek().type === "op" && peek().val === "-") {
      eat("op");
      var val = parseUnary();
      return function (e) {
        return -val(e);
      };
    }
    if (peek() && peek().type === "op" && peek().val === "+") {
      eat("op");
      return parseUnary();
    }
    return parseAtom();
  }

  function parseAtom() {
    var t = peek();
    if (!t) throw "unexpected end";

    // Number
    if (t.type === "num") {
      eat("num");
      var v = t.val;
      return function () {
        return v;
      };
    }

    // Parenthesized expression
    if (t.type === "op" && t.val === "(") {
      eat("op", "(");
      var inner = parseExprLevel();
      eat("op", ")");
      return inner;
    }

    // Identifier — variable or function call
    if (t.type === "id") {
      eat("id");
      var name = t.val;

      // Function call?
      if (peek() && peek().type === "op" && peek().val === "(") {
        eat("op", "(");
        var args = [];
        if (!(peek() && peek().type === "op" && peek().val === ")")) {
          args.push(parseExprLevel());
          while (peek() && peek().type === "op" && peek().val === ",") {
            eat("op", ",");
            args.push(parseExprLevel());
          }
        }
        eat("op", ")");
        var func = FUNCS[name];
        if (!func) throw "unknown function: " + name;
        return function (e) {
          var a = [];
          for (var i = 0; i < args.length; i++) a.push(args[i](e));
          return func.apply(null, a);
        };
      }

      // Constants
      if (name === "PI" || name === "pi")
        return function () {
          return Math.PI;
        };
      if (name === "TAU")
        return function () {
          return Math.PI * 2;
        };
      if (name === "E")
        return function () {
          return Math.E;
        };

      // Variable
      if (!VARS[name]) throw "unknown variable: " + name;
      return function (e) {
        return e[name] || 0;
      };
    }

    throw "unexpected token: " + JSON.stringify(t);
  }

  function mkBin(l, r, op) {
    return function (e) {
      return op(l(e), r(e));
    };
  }

  var result = parseExprLevel();
  if (pos < tokens.length) throw "unexpected tokens after expression";
  return result;
}

// Expression evaluation with environment
var _customFnA = null,
  _customFnB = null;
var _customSrcA = "",
  _customSrcB = "";

function evalCustomExpr(src, mx, my, fw, fh, c) {
  // Cache compiled function
  if (src !== _customSrcA) {
    _customSrcA = src;
    _customFnA = compileExpr(src);
  }
  if (!_customFnA) return 0;
  var dx = mx - fw / 2,
    dy = my - fh / 2;
  var r = Math.sqrt(dx * dx + dy * dy) + 0.01;
  var theta = Math.atan2(dy, dx);
  return _customFnA({
    x: mx,
    y: my,
    dx: dx,
    dy: dy,
    r: r,
    theta: theta,
    time: time,
    t: time,
    w: fw,
    h: fh,
    xC: c.xConstant,
    yC: c.yConstant,
    fm: c.frameMultiplier,
    gV: c.globalVal,
  });
}

function evalCustomExprB(src, mx, my, fw, fh, c) {
  if (src !== _customSrcB) {
    _customSrcB = src;
    _customFnB = compileExpr(src);
  }
  if (!_customFnB) return 0;
  var dx = mx - fw / 2,
    dy = my - fh / 2;
  var r = Math.sqrt(dx * dx + dy * dy) + 0.01;
  var theta = Math.atan2(dy, dx);
  return _customFnB({
    x: mx,
    y: my,
    dx: dx,
    dy: dy,
    r: r,
    theta: theta,
    time: time,
    t: time,
    w: fw,
    h: fh,
    xC: c.xConstant,
    yC: c.yConstant,
    fm: c.frameMultiplier,
    gV: c.globalVal,
  });
}

// ── State ──
var config = {
  name: "Center Spiral",
  pattern: "centerSpiral",
  charset: "░▒▓░▒▓░░▒▓░▒▓░░▒▓░▒▓░░▒▓░▒▓░░▒▓░▒▓░░▒▓░▒▓░░▒▓░▒▓░",
  colors: ["#43BFD4", "#BC7ED2", "#9EE1EF", "#C3ECF0", "#B9AAF3"],
  xConstant: 0.21,
  yConstant: 0.5,
  frameMultiplier: 0.04,
  animationSpeed: 0.15,
  mirrorAxis: "none",
  globalVal: 1.5,
  colored: true,
  centerX: 0,
  centerY: 0,
  rotation: 0,
  scale: 1,
  turbulence: 0,
  customExpr: "sin(x * 0.1 + time) * cos(y * 0.05 + time * 1.5)",
  layerB: {
    enabled: false,
    pattern: "circular",
    xConstant: 0.01,
    yConstant: 0.01,
    frameMultiplier: 0.05,
    globalVal: 1,
    blendMode: "add",
    blendAmount: 0.5,
    customExpr: "sin(r * 0.2 + time)",
  },
};

var time = 0,
  playing = true,
  rafId = null,
  lastTick = 0;
var canvas,
  ctx,
  columns = 0,
  rows = 0,
  charW = 0,
  cellH = 0;
var fpsFrames = 0,
  fpsLast = performance.now();
var _sx = 0,
  _sy = 0; // symmetry output reuse

// ══════════════════════════════════════
//  PRESETS
// ══════════════════════════════════════
var LB_OFF = {
  enabled: false,
  pattern: "circular",
  xConstant: 0.01,
  yConstant: 0.01,
  frameMultiplier: 0.05,
  globalVal: 1,
  blendMode: "add",
  blendAmount: 0.5,
};

var PRESETS = [
  {
    name: "Center Spiral",
    pattern: "centerSpiral",
    charset: "░▒▓░▒▓░░▒▓░▒▓░░▒▓░▒▓░░▒▓░▒▓░░▒▓░▒▓░░▒▓░▒▓░░▒▓░▒▓░",
    colors: ["#43BFD4", "#BC7ED2", "#9EE1EF", "#C3ECF0", "#B9AAF3"],
    xConstant: 554.8,
    yConstant: 0.73,
    frameMultiplier: -0.001,
    animationSpeed: 0.02,
    mirrorAxis: "x",
    globalVal: 5,
    colored: true,
    centerX: 0,
    centerY: 0,
    rotation: 0,
    scale: 1,
    turbulence: 0,
    layerB: LB_OFF,
  },
  {
    name: "Golden Spiral",
    pattern: "centerSpiral",
    charset: "░▒▓░▒▓฿",
    colors: ["#ff9500", "#fed50b", "#ffea00", "#0055ff", "#003d9e"],
    xConstant: -0.01,
    yConstant: 50,
    frameMultiplier: 0.1,
    animationSpeed: 0.1,
    mirrorAxis: "y",
    globalVal: 5,
    colored: true,
    centerX: 0,
    centerY: 0,
    rotation: 0,
    scale: 1,
    turbulence: 0,
    layerB: LB_OFF,
  },
  {
    name: "Circular Ripple",
    pattern: "circular",
    charset: "░▒▓┃┏┓┛┗┙┘━",
    colors: ["#dad677", "#5778db", "#f039f3", "#9d27dd", "#f1f2ed"],
    xConstant: -0.001,
    yConstant: 9997777777776.8,
    frameMultiplier: 0.071,
    animationSpeed: 0.4,
    mirrorAxis: "none",
    globalVal: 5,
    colored: true,
    centerX: 0,
    centerY: 0,
    rotation: 0,
    scale: 1,
    turbulence: 0,
    layerB: LB_OFF,
  },
  {
    name: "Mosaic",
    pattern: "mosaic",
    charset: "░│││___...●●",
    colors: ["#37FF6E", "#B24EFF", "#97D299", "#89DE93", "#7DE6E5"],
    xConstant: 99999.01,
    yConstant: 0.04,
    frameMultiplier: 0.01,
    animationSpeed: 0.4,
    mirrorAxis: "x",
    globalVal: 1,
    colored: true,
    centerX: 0,
    centerY: 0,
    rotation: 0,
    scale: 1,
    turbulence: 0,
    layerB: LB_OFF,
  },
  {
    name: "Ember Spiral",
    pattern: "centerSpiral",
    charset: "╬╬╪╪╫╫",
    colors: ["#B87418", "#6456BC", "#A671BC", "#B75053", "#B83D2B"],
    xConstant: 0.21,
    yConstant: 0.5,
    frameMultiplier: 0.04,
    animationSpeed: 0.1,
    mirrorAxis: "none",
    globalVal: 1.5,
    colored: true,
    centerX: 0,
    centerY: 0,
    rotation: 0,
    scale: 1,
    turbulence: 0,
    layerB: LB_OFF,
  },
  {
    name: "Fire Spiral",
    pattern: "centerSpiral",
    charset: "_░░████░▒▓░▒",
    colors: ["#FF7700", "#F88826", "#FF6900", "#9800FF", "#7600FF"],
    xConstant: 0.05,
    yConstant: 19.1,
    frameMultiplier: 0.019,
    animationSpeed: 0.4,
    mirrorAxis: "x",
    globalVal: 3.8,
    colored: true,
    centerX: 0,
    centerY: 0,
    rotation: 0,
    scale: 1,
    turbulence: 0,
    layerB: LB_OFF,
  },
  {
    name: "Cross",
    pattern: "cross",
    charset: "\".-_,- '`-._,-'\".-_,-'",
    colors: null,
    xConstant: 0.0002,
    yConstant: 0.1,
    frameMultiplier: 0.1,
    animationSpeed: 0.15,
    mirrorAxis: "none",
    globalVal: 0,
    colored: false,
    centerX: 0,
    centerY: 0,
    rotation: 0,
    scale: 1,
    turbulence: 0,
    layerB: LB_OFF,
  },
  {
    name: "Checkerboard",
    pattern: "checkerboard",
    charset: "⠈⠸⠈ ⠈⠤⠈ ⠈⠐⠈",
    colors: null,
    xConstant: 100000,
    yConstant: 1,
    frameMultiplier: 0.01,
    animationSpeed: 0.15,
    mirrorAxis: "none",
    globalVal: 0,
    colored: false,
    centerX: 0,
    centerY: 0,
    rotation: 0,
    scale: 1,
    turbulence: 0,
    layerB: LB_OFF,
  },
  // ── New patterns ──
  {
    name: "Diamond Pulse",
    pattern: "diamond",
    charset: "░▒▓█▓▒░",
    colors: ["#FF4488", "#FF88AA", "#FF44DD", "#AA22FF", "#DD66FF"],
    xConstant: 0.15,
    yConstant: 3,
    frameMultiplier: 0.08,
    animationSpeed: 0.3,
    mirrorAxis: "none",
    globalVal: 2,
    colored: true,
    centerX: 0,
    centerY: 0,
    rotation: 0,
    scale: 1,
    turbulence: 0,
    layerB: LB_OFF,
  },
  {
    name: "Infinite Tunnel",
    pattern: "tunnel",
    charset: " .·:∙○◎●",
    colors: ["#00CFFF", "#0088DD", "#44EEFF", "#AAEEFF", "#006699"],
    xConstant: 8,
    yConstant: 4,
    frameMultiplier: 0.15,
    animationSpeed: 0.5,
    mirrorAxis: "none",
    globalVal: 2,
    colored: true,
    centerX: 0,
    centerY: 0,
    rotation: 0,
    scale: 1,
    turbulence: 0,
    layerB: LB_OFF,
  },
  {
    name: "Plasma Field",
    pattern: "plasma",
    charset: "░▒▓█▓▒░ ",
    colors: [
      "#FF2020",
      "#FF6600",
      "#FFCC00",
      "#2288FF",
      "#22FF66",
      "#FF44AA",
      "#CC44FF",
    ],
    xConstant: 8,
    yConstant: 6,
    frameMultiplier: 0.05,
    animationSpeed: 0.4,
    mirrorAxis: "none",
    globalVal: 1.5,
    colored: true,
    centerX: 0,
    centerY: 0,
    rotation: 0,
    scale: 1,
    turbulence: 0,
    layerB: LB_OFF,
  },
  {
    name: "Wave Interference",
    pattern: "interference",
    charset: ".,;:!|~=#%@&*",
    colors: ["#00FF88", "#22DDAA", "#44FFBB", "#88FFCC", "#00CC66"],
    xConstant: 0.3,
    yConstant: 0.3,
    frameMultiplier: 0.12,
    animationSpeed: 0.3,
    mirrorAxis: "none",
    globalVal: 0,
    colored: true,
    centerX: 0,
    centerY: 0,
    rotation: 0,
    scale: 1,
    turbulence: 0,
    layerB: LB_OFF,
  },
  {
    name: "Flower Power",
    pattern: "radialStar",
    charset: "░▒▓█░▒▓█",
    colors: ["#FF7700", "#F88826", "#FFCC00", "#22FF66", "#2288FF", "#CC44FF"],
    xConstant: 0.2,
    yConstant: 6,
    frameMultiplier: 0.08,
    animationSpeed: 0.25,
    mirrorAxis: "none",
    globalVal: 5,
    colored: true,
    centerX: 0,
    centerY: 0,
    rotation: 0,
    scale: 1,
    turbulence: 0,
    layerB: LB_OFF,
  },
  {
    name: "Lissajous Dance",
    pattern: "lissajous",
    charset: "╬╪╫│┼─╬╪",
    colors: ["#43BFD4", "#BC7ED2", "#9EE1EF", "#FFcc00", "#FF6600"],
    xConstant: 3,
    yConstant: 5,
    frameMultiplier: 0.05,
    animationSpeed: 0.3,
    mirrorAxis: "none",
    globalVal: 2,
    colored: true,
    centerX: 0,
    centerY: 0,
    rotation: 0,
    scale: 1,
    turbulence: 0,
    layerB: LB_OFF,
  },
  // ── Showcasing new features ──
  {
    name: "Mandala",
    pattern: "centerSpiral",
    charset: "░▒▓█▓▒░",
    colors: ["#ff9500", "#fed50b", "#ffea00", "#FF44AA", "#CC44FF"],
    xConstant: 2.5,
    yConstant: 3,
    frameMultiplier: 0.03,
    animationSpeed: 0.15,
    mirrorAxis: "radial-8",
    globalVal: 3,
    colored: true,
    centerX: 0,
    centerY: 0,
    rotation: 0,
    scale: 1,
    turbulence: 0,
    layerB: LB_OFF,
  },
  {
    name: "Spiral × Plasma",
    pattern: "centerSpiral",
    charset: "░▒▓█░▒▓█",
    colors: ["#43BFD4", "#BC7ED2", "#9EE1EF", "#FF6600", "#FFCC00"],
    xConstant: 0.5,
    yConstant: 2,
    frameMultiplier: 0.03,
    animationSpeed: 0.2,
    mirrorAxis: "none",
    globalVal: 2,
    colored: true,
    centerX: 0,
    centerY: 0,
    rotation: 0,
    scale: 1,
    turbulence: 0,
    layerB: {
      enabled: true,
      pattern: "plasma",
      xConstant: 5,
      yConstant: 4,
      frameMultiplier: 0.04,
      globalVal: 1,
      blendMode: "multiply",
      blendAmount: 0.6,
    },
  },
  {
    name: "Warped Mosaic",
    pattern: "mosaic",
    charset: "░│││___...●●",
    colors: ["#26B479", "#49BF7D", "#9DDAC8", "#52FF6D", "#8F1AFF"],
    xConstant: 99998.97,
    yConstant: 0.03,
    frameMultiplier: 0.01,
    animationSpeed: 0.4,
    mirrorAxis: "none",
    globalVal: 1,
    colored: true,
    centerX: 0,
    centerY: 0,
    rotation: 15,
    scale: 1.2,
    turbulence: 0.35,
    layerB: LB_OFF,
  },
  {
    name: "Star Kaleidoscope",
    pattern: "radialStar",
    charset: " .·:∙○◎●◎∙",
    colors: ["#FF2020", "#FF6600", "#FFCC00", "#22FF66", "#2288FF", "#CC44FF"],
    xConstant: 0.15,
    yConstant: 5,
    frameMultiplier: 0.06,
    animationSpeed: 0.2,
    mirrorAxis: "radial-6",
    globalVal: 4,
    colored: true,
    centerX: 0,
    centerY: 0,
    rotation: 0,
    scale: 0.8,
    turbulence: 0.1,
    layerB: LB_OFF,
  },
  // ── Custom equation showcases ──
  {
    name: "Spinning Flower (Custom)",
    pattern: "custom",
    charset: " .·:∙○◎●◎∙:·.",
    colors: ["#FF44AA", "#CC44FF", "#4488FF", "#22FF66", "#FFCC00"],
    xConstant: 0.2,
    yConstant: 6,
    frameMultiplier: 0.08,
    animationSpeed: 0.25,
    mirrorAxis: "none",
    globalVal: 5,
    colored: true,
    centerX: 0,
    centerY: 0,
    rotation: 0,
    scale: 1,
    turbulence: 0,
    layerB: LB_OFF,
    customExpr: "sin(r*0.2 + theta*3 + time)",
  },
  {
    name: "Hyperbolic Ripple (Custom)",
    pattern: "custom",
    charset: "░▒▓█▓▒░",
    colors: ["#43BFD4", "#BC7ED2", "#9EE1EF", "#FFCC00", "#FF6600"],
    xConstant: 1,
    yConstant: 1,
    frameMultiplier: 0.05,
    animationSpeed: 0.3,
    mirrorAxis: "none",
    globalVal: 1,
    colored: true,
    centerX: 0,
    centerY: 0,
    rotation: 0,
    scale: 1,
    turbulence: 0,
    layerB: LB_OFF,
    customExpr: "sin(x*y*0.001+time)+cos(r*0.1-time*0.5)",
  },
  {
    name: "Dual Rose (Custom)",
    pattern: "custom",
    charset: "╬╪╫│┼─╬╪╫│",
    colors: ["#FF2020", "#FF6600", "#FFCC00", "#22FF66", "#2288FF", "#CC44FF"],
    xConstant: 1,
    yConstant: 1,
    frameMultiplier: 0.05,
    animationSpeed: 0.2,
    mirrorAxis: "radial-6",
    globalVal: 1,
    colored: true,
    centerX: 0,
    centerY: 0,
    rotation: 0,
    scale: 1,
    turbulence: 0,
    layerB: LB_OFF,
    customExpr: "cos(theta*5)*sin(r*0.1+time)+sin(theta*3+time*2)*cos(r*0.05)",
  },
];

// ══════════════════════════════════════
//  NOISE (for turbulence)
// ══════════════════════════════════════

// Per-pattern slider ranges: [min, max, step] for xC, yC, gV
// These cover the "sweet spot" for each pattern. Users can always
// type any value in the number box — only the slider thumb is bounded.
var PATTERN_RANGES = {
  centerSpiral: { xc: [-2, 5, 0.01], yc: [-5, 10, 0.01], gv: [0, 8, 0.1] },
  circular: {
    xc: [-0.01, 0.05, 0.0001],
    yc: [-0.01, 0.05, 0.0001],
    gv: [0, 5, 0.1],
  },
  mosaic: { xc: [0, 1, 0.001], yc: [0, 1, 0.001], gv: [0, 3, 0.1] },
  cross: { xc: [-0.01, 0.5, 0.0001], yc: [-0.01, 0.5, 0.001], gv: [0, 5, 0.1] },
  checkerboard: { xc: [0, 1, 0.001], yc: [0, 1, 0.001], gv: [0, 3, 0.1] },
  diamond: { xc: [0, 2, 0.01], yc: [0, 10, 0.1], gv: [0, 5, 0.1] },
  tunnel: { xc: [1, 30, 0.1], yc: [0, 10, 0.1], gv: [0, 5, 0.1] },
  plasma: { xc: [1, 20, 0.1], yc: [1, 20, 0.1], gv: [0, 5, 0.1] },
  interference: { xc: [0.01, 2, 0.01], yc: [0.01, 2, 0.01], gv: [0, 3, 0.1] },
  radialStar: { xc: [0.01, 1, 0.01], yc: [1, 12, 1], gv: [0, 8, 0.1] },
  lissajous: { xc: [0.5, 15, 0.1], yc: [0.5, 15, 0.1], gv: [0, 5, 0.1] },
  custom: { xc: [-10, 10, 0.01], yc: [-10, 10, 0.01], gv: [0, 10, 0.1] },
};

function applyPatternRanges(pattern) {
  var r = PATTERN_RANGES[pattern];
  if (!r) return;
  var apply = function (id, range) {
    var el = document.getElementById(id);
    if (!el) return;
    var cur = parseFloat(el.value);
    el.min = range[0];
    el.max = range[1];
    el.step = range[2];
    // If current value is outside new range, clamp the slider but keep the number box
    if (cur < range[0]) el.min = cur < 0 ? cur * 2 : cur * 0.5;
    if (cur > range[1]) el.max = cur * 2 || 1;
  };
  apply("p-xc", r.xc);
  apply("p-yc", r.yc);
  apply("p-gv", r.gv);
  var hint = document.getElementById("spatial-range-hint");
  if (hint) {
    hint.textContent =
      "Slider: xC " +
      r.xc[0] +
      " to " +
      r.xc[1] +
      ", yC " +
      r.yc[0] +
      " to " +
      r.yc[1] +
      ", gV " +
      r.gv[0] +
      " to " +
      r.gv[1] +
      ". Type any value in the number box \u2014 no limit.";
  }
}

function noiseX(x, y, t) {
  return (
    Math.sin(x * 0.031 + y * 0.071 + t * 0.3) * 0.5 +
    Math.sin(x * 0.113 - y * 0.037 + t * 0.7) * 0.3 +
    Math.sin(y * 0.053 + x * 0.131 + t * 0.5) * 0.2
  );
}
function noiseY(x, y, t) {
  return (
    Math.cos(x * 0.071 + y * 0.031 + t * 0.4) * 0.5 +
    Math.cos(x * 0.037 - y * 0.113 + t * 0.6) * 0.3 +
    Math.cos(y * 0.131 + x * 0.053 + t * 0.8) * 0.2
  );
}

// ══════════════════════════════════════
//  PATTERNS (11 total)
// ══════════════════════════════════════
function computeValue(pattern, mx, my, fw, fh, c) {
  var dx, dy, theta, r;
  switch (pattern) {
    case "centerSpiral":
      dx = mx - fw / 2;
      dy = my - fh / 2;
      theta = Math.atan2(dy, dx) + c.xConstant;
      return Math.sin(
        (theta +
          (time + Math.sin(mx * c.xConstant + my * c.yConstant)) *
            c.frameMultiplier +
          Math.sin(theta * c.yConstant) +
          c.globalVal * Math.sin(mx * c.xConstant + time)) *
          (1 + Math.sin(theta * c.frameMultiplier)),
      );

    case "circular":
      dx = mx - fw / 2;
      dy = my - fh / 2;
      return Math.sin(
        dx * dx * c.xConstant +
          dy * dy * c.yConstant +
          time * c.frameMultiplier,
      );

    case "mosaic":
      return (
        Math.sin(mx * c.xConstant + time) * Math.sin(my * c.yConstant + time)
      );

    case "cross":
      dx = mx - fw / 2;
      dy = my - fh / 2;
      return (
        Math.sin(dx * dx * c.xConstant + time * c.frameMultiplier) +
        Math.cos(dy * dy * c.yConstant + time * c.frameMultiplier)
      );

    case "checkerboard":
      return Math.sin(mx * c.xConstant) * Math.sin(my * c.yConstant + time);

    case "diamond":
      dx = mx - fw / 2;
      dy = my - fh / 2;
      return (
        Math.sin(
          (Math.abs(dx) + Math.abs(dy)) * c.xConstant +
            time * c.frameMultiplier,
        ) *
        Math.cos(
          c.yConstant * Math.atan2(dy, dx) + time * c.frameMultiplier * 0.5,
        )
      );

    case "tunnel":
      dx = mx - fw / 2;
      dy = my - fh / 2;
      r = Math.sqrt(dx * dx + dy * dy) + 0.01;
      theta = Math.atan2(dy, dx);
      return (
        Math.sin(c.xConstant / r + time * c.frameMultiplier) *
        Math.sin(
          theta * c.yConstant +
            time * c.frameMultiplier * 0.7 +
            c.globalVal * Math.sin(r * 0.1),
        )
      );

    case "plasma":
      dx = mx - fw / 2;
      dy = my - fh / 2;
      return (
        (Math.sin(mx * c.xConstant * 0.01 + time) +
          Math.sin(my * c.yConstant * 0.01 + time * 1.5) +
          Math.sin((mx + my) * c.xConstant * 0.005 + time * 0.7) +
          Math.sin(
            Math.sqrt(dx * dx + dy * dy) * c.yConstant * 0.01 +
              time * 1.2 +
              c.globalVal,
          )) *
        0.25
      );

    case "interference":
      var s1x = fw * 0.3,
        s1y = fh * 0.5,
        s2x = fw * 0.7,
        s2y = fh * 0.5;
      var r1 = Math.sqrt((mx - s1x) * (mx - s1x) + (my - s1y) * (my - s1y));
      var r2 = Math.sqrt((mx - s2x) * (mx - s2x) + (my - s2y) * (my - s2y));
      return (
        (Math.sin(r1 * c.xConstant + time * c.frameMultiplier + c.globalVal) +
          Math.sin(r2 * c.yConstant + time * c.frameMultiplier)) *
        0.5
      );

    case "radialStar":
      dx = mx - fw / 2;
      dy = my - fh / 2;
      r = Math.sqrt(dx * dx + dy * dy);
      theta = Math.atan2(dy, dx);
      var petals = Math.max(1, Math.round(Math.abs(c.yConstant)));
      return Math.sin(
        r * c.xConstant +
          Math.cos(theta * petals) * c.globalVal +
          time * c.frameMultiplier,
      );

    case "lissajous":
      return (
        Math.sin(mx * c.xConstant * 0.1 + Math.sin(time * 3) * c.globalVal) *
        Math.sin(my * c.yConstant * 0.1 + Math.cos(time * 2) * c.globalVal)
      );

    case "custom":
      return evalCustomExpr(c.customExpr || "", mx, my, fw, fh, c);

    default:
      return 0;
  }
}

// ══════════════════════════════════════
//  SYMMETRY
// ══════════════════════════════════════
function applySym(dx, dy, mode) {
  switch (mode) {
    case "x":
      _sx = Math.abs(dx);
      _sy = dy;
      break;
    case "y":
      _sx = dx;
      _sy = Math.abs(dy);
      break;
    case "both":
      _sx = Math.abs(dx);
      _sy = Math.abs(dy);
      break;
    case "radial-4":
    case "radial-6":
    case "radial-8": {
      var n = parseInt(mode.split("-")[1]);
      var angle = Math.atan2(dy, dx);
      var r = Math.sqrt(dx * dx + dy * dy);
      var sector = TWO_PI / n;
      angle = ((angle % sector) + sector) % sector;
      if (angle > sector * 0.5) angle = sector - angle;
      _sx = r * Math.cos(angle);
      _sy = r * Math.sin(angle);
      break;
    }
    default:
      _sx = dx;
      _sy = dy;
  }
}

// ══════════════════════════════════════
//  BLEND
// ══════════════════════════════════════
function blendValues(a, b, mode, amount) {
  var v;
  switch (mode) {
    case "add":
      v = a + b;
      break;
    case "multiply":
      v = a * b;
      break;
    case "subtract":
      v = a - b;
      break;
    case "min":
      v = Math.min(a, b);
      break;
    case "max":
      v = Math.max(a, b);
      break;
    case "screen":
      v = a + b - a * b;
      break;
    default:
      v = a;
  }
  return a * (1 - amount) + v * amount;
}

// ══════════════════════════════════════
//  CANVAS
// ══════════════════════════════════════
function setupCanvas() {
  canvas = document.getElementById("preview-canvas");
  var w = canvas.clientWidth || canvas.parentElement.clientWidth;
  var h = canvas.clientHeight || canvas.parentElement.clientHeight;
  var dpr = window.devicePixelRatio || 1;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);
  var fontSize = parseInt(document.getElementById("p-fontsize").value) || 14;
  ctx.font = fontSize + "px Courier New, monospace";
  ctx.textBaseline = "top";
  charW = ctx.measureText("M").width;
  cellH = Math.round(fontSize * LINE_HEIGHT);
  columns = Math.ceil(w / charW) + 2;
  rows = Math.ceil(h / cellH) + 2;
  document.getElementById("sb-size").textContent = columns + "×" + rows;
}

// ══════════════════════════════════════
//  RENDER
// ══════════════════════════════════════
function render() {
  var c = config,
    fw = columns,
    fh = rows;
  var charset = c.charset || "░▒▓█",
    csLen = charset.length;
  var colors = c.colors,
    colLen = colors ? colors.length : 0;
  var colored = c.colored;
  var bg = "#000000";
  var sym = c.mirrorAxis || "none";

  // Precompute transform
  var oxOff = (c.centerX || 0) * fw * 0.5;
  var oyOff = (c.centerY || 0) * fh * 0.5;
  var rot = ((c.rotation || 0) * Math.PI) / 180;
  var cosR = Math.cos(rot),
    sinR = Math.sin(rot);
  var scl = c.scale || 1;
  var turb = c.turbulence || 0;
  var hasRot = rot !== 0;
  var hasSym = sym !== "none";
  var hasLayerB = c.layerB && c.layerB.enabled;
  var lb = hasLayerB ? c.layerB : null;

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  var prevFill = bg;

  for (var y = 0; y < fh; y++) {
    var py = y * cellH;
    for (var x = 0; x < fw; x++) {
      // 1. Center-relative
      var dx = x - fw * 0.5 - oxOff;
      var dy = y - fh * 0.5 - oyOff;

      // 2. Rotation
      if (hasRot) {
        var rx = dx * cosR - dy * sinR;
        var ry = dx * sinR + dy * cosR;
        dx = rx;
        dy = ry;
      }

      // 3. Scale
      if (scl !== 1) {
        dx /= scl;
        dy /= scl;
      }

      // 4. Symmetry
      if (hasSym) {
        applySym(dx, dy, sym);
        dx = _sx;
        dy = _sy;
      }

      // 5. Turbulence
      if (turb > 0) {
        dx += noiseX(dx, dy, time) * turb * 10;
        dy += noiseY(dx, dy, time) * turb * 10;
      }

      // 6. Pattern space
      var mx = dx + fw * 0.5;
      var my = dy + fh * 0.5;

      // 7. Compute
      var value = computeValue(c.pattern, mx, my, fw, fh, c);

      // 8. Layer B blend
      if (hasLayerB) {
        var vb;
        if (lb.pattern === "custom") {
          vb = evalCustomExprB(lb.customExpr || "", mx, my, fw, fh, lb);
        } else {
          vb = computeValue(lb.pattern, mx, my, fw, fh, lb);
        }
        value = blendValues(value, vb, lb.blendMode, lb.blendAmount);
      }

      // 9. Map
      var idx = ((value + 2) * csLen * 0.25) | 0;
      if (idx < 0) idx = 0;
      else if (idx >= csLen) idx = csLen - 1;
      var glyph = charset[idx];

      var fill;
      if (colored && colors && colLen) {
        fill = colors[((idx % colLen) + colLen) % colLen];
      } else {
        var brightness = (value + 2) * 0.25;
        fill =
          brightness > 0.65
            ? "#00ffd5"
            : brightness > 0.4
              ? "#00b396"
              : "#3d4f4a";
      }
      if (fill !== prevFill) {
        ctx.fillStyle = fill;
        prevFill = fill;
      }
      ctx.fillText(glyph, x * charW, py);
    }
  }

  // FPS
  fpsFrames++;
  var now = performance.now();
  if (now - fpsLast >= 1000) {
    document.getElementById("sb-fps").textContent = fpsFrames + " fps";
    fpsFrames = 0;
    fpsLast = now;
  }
}

// ══════════════════════════════════════
//  ANIMATION LOOP
// ══════════════════════════════════════
function animLoop(ts) {
  if (!playing) return;
  if (ts - lastTick >= TICK_MS) {
    time += config.animationSpeed * SPEED_SCALE;
    render();
    lastTick = ts;
  }
  rafId = requestAnimationFrame(animLoop);
}

function togglePlay() {
  playing = !playing;
  document.getElementById("btn-play").textContent = playing ? "Pause" : "Play";
  if (playing) {
    lastTick = performance.now();
    rafId = requestAnimationFrame(animLoop);
  }
}

function resetTime() {
  time = 0;
  if (!playing) render();
}

function goFullscreen() {
  var el = document.querySelector(".preview");
  if (!el) return;
  if (document.fullscreenElement) {
    document.exitFullscreen();
  } else {
    (
      el.requestFullscreen ||
      el.webkitRequestFullscreen ||
      el.msRequestFullscreen
    ).call(el);
  }
}
document.addEventListener("fullscreenchange", function () {
  setupCanvas();
  if (!playing) render();
});

// ══════════════════════════════════════
//  UI SYNC
// ══════════════════════════════════════
function configToUI() {
  document.getElementById("p-pattern").value = config.pattern;
  applyPatternRanges(config.pattern);
  setSlider("p-xc", config.xConstant);
  setSlider("p-yc", config.yConstant);
  setSlider("p-gv", config.globalVal);
  setSlider("p-fm", config.frameMultiplier);
  setSlider("p-as", config.animationSpeed);
  document.getElementById("p-mirror").value = config.mirrorAxis || "none";
  document.getElementById("p-charset").value = config.charset || "";
  document.getElementById("p-colored").checked = config.colored !== false;
  document.getElementById("p-name").value = config.name || "My Animation";
  // Custom equation
  document.getElementById("p-custom-expr").value = config.customExpr || "";
  toggleFormulaInput();
  // Transform
  setSlider("p-cx", config.centerX || 0);
  setSlider("p-cy", config.centerY || 0);
  setSlider("p-rot", config.rotation || 0);
  setSlider("p-scale", config.scale || 1);
  setSlider("p-turb", config.turbulence || 0);
  // Layer B
  var lb = config.layerB || {};
  document.getElementById("p-lb-on").checked = !!lb.enabled;
  toggleLayerB(!!lb.enabled);
  document.getElementById("p-lb-pattern").value = lb.pattern || "circular";
  setSlider("p-lb-xc", lb.xConstant || 0);
  setSlider("p-lb-yc", lb.yConstant || 0);
  setSlider("p-lb-fm", lb.frameMultiplier || 0.05);
  setSlider("p-lb-gv", lb.globalVal || 1);
  document.getElementById("p-lb-blend").value = lb.blendMode || "add";
  setSlider("p-lb-amt", lb.blendAmount || 0.5);
  document.getElementById("p-lb-custom-expr").value = lb.customExpr || "";
  toggleFormulaInputB();

  renderColorChips();
  updateCode();
  document.getElementById("sb-name").textContent = config.name || "";
}

function UIToConfig() {
  config.pattern = document.getElementById("p-pattern").value;
  config.xConstant = parseFloat(document.getElementById("p-xc").value);
  config.yConstant = parseFloat(document.getElementById("p-yc").value);
  config.globalVal = parseFloat(document.getElementById("p-gv").value);
  config.frameMultiplier = parseFloat(document.getElementById("p-fm").value);
  config.animationSpeed = parseFloat(document.getElementById("p-as").value);
  config.mirrorAxis = document.getElementById("p-mirror").value;
  config.charset = document.getElementById("p-charset").value;
  config.colored = document.getElementById("p-colored").checked;
  config.name = document.getElementById("p-name").value;
  config.customExpr = document.getElementById("p-custom-expr").value;
  // Transform
  config.centerX = parseFloat(document.getElementById("p-cx").value);
  config.centerY = parseFloat(document.getElementById("p-cy").value);
  config.rotation = parseFloat(document.getElementById("p-rot").value);
  config.scale = parseFloat(document.getElementById("p-scale").value);
  config.turbulence = parseFloat(document.getElementById("p-turb").value);
  // Layer B
  config.layerB = config.layerB || {};
  config.layerB.enabled = document.getElementById("p-lb-on").checked;
  config.layerB.pattern = document.getElementById("p-lb-pattern").value;
  config.layerB.xConstant = parseFloat(
    document.getElementById("p-lb-xc").value,
  );
  config.layerB.yConstant = parseFloat(
    document.getElementById("p-lb-yc").value,
  );
  config.layerB.frameMultiplier = parseFloat(
    document.getElementById("p-lb-fm").value,
  );
  config.layerB.globalVal = parseFloat(
    document.getElementById("p-lb-gv").value,
  );
  config.layerB.blendMode = document.getElementById("p-lb-blend").value;
  config.layerB.blendAmount = parseFloat(
    document.getElementById("p-lb-amt").value,
  );
  config.layerB.customExpr = document.getElementById("p-lb-custom-expr").value;

  document.getElementById("sb-name").textContent = config.name;
}

function liveUpdate() {
  UIToConfig();
  updateCode();
  if (!playing) render();
}

// ══════════════════════════════════════
//  CUSTOM EQUATION UI HELPERS
// ══════════════════════════════════════
function toggleFormulaInput() {
  var el = document.getElementById("custom-expr-group");
  if (el)
    el.style.display =
      document.getElementById("p-pattern").value === "custom"
        ? "block"
        : "none";
  validateFormula();
}
function toggleFormulaInputB() {
  var el = document.getElementById("custom-expr-group-b");
  if (el)
    el.style.display =
      document.getElementById("p-lb-pattern").value === "custom"
        ? "block"
        : "none";
}
function validateFormula() {
  var errEl = document.getElementById("formula-error");
  if (!errEl) return;
  var src = document.getElementById("p-custom-expr").value;
  if (!src.trim()) {
    errEl.textContent = "";
    return;
  }
  var fn = compileExpr(src);
  errEl.textContent = fn ? "" : "Invalid expression";
}
function onFormulaInput() {
  _customSrcA = ""; // clear cache to recompile
  validateFormula();
  liveUpdate();
}
function onFormulaInputB() {
  _customSrcB = ""; // clear cache to recompile
  liveUpdate();
}
var _lastFormulaTarget = "a";
function useSnippet(codeEl) {
  var text = codeEl.textContent || codeEl.innerText;
  var isB = _lastFormulaTarget === "b";
  var field = document.getElementById(
    isB ? "p-lb-custom-expr" : "p-custom-expr",
  );
  // If field is empty or has placeholder, replace entirely; otherwise append
  var curExpr = isB ? config.layerB.customExpr : config.customExpr;
  if (!field.value.trim() || field.value === curExpr) {
    field.value = text;
  } else {
    // Insert at cursor position or append
    var start = field.selectionStart;
    var end = field.selectionEnd;
    if (start !== undefined && start !== end) {
      field.value =
        field.value.substring(0, start) + text + field.value.substring(end);
    } else if (start !== undefined) {
      field.value =
        field.value.substring(0, start) + text + field.value.substring(start);
    } else {
      field.value = text;
    }
  }
  if (isB) {
    document.getElementById("p-lb-pattern").value = "custom";
    toggleFormulaInputB();
    _customSrcB = "";
  } else {
    document.getElementById("p-pattern").value = "custom";
    toggleFormulaInput();
    _customSrcA = "";
  }
  liveUpdate();
}
function onPatternChange() {
  var p = document.getElementById("p-pattern").value;
  applyPatternRanges(p);
  toggleFormulaInput();
  // Auto-open math reference window when custom is selected
  if (p === "custom") {
    showMathRef();
  }
  liveUpdate();
}
function onPatternChangeB() {
  toggleFormulaInputB();
  liveUpdate();
}

// ══════════════════════════════════════
//  SLIDER HELPERS
// ══════════════════════════════════════
function setSlider(id, val) {
  var el = document.getElementById(id);
  if (!el) return;
  if (val < parseFloat(el.min)) el.min = val < 0 ? val * 2 : val * 0.5;
  if (val > parseFloat(el.max)) el.max = val * 2 || 1;
  el.value = val;
  var valEl = document.getElementById(id + "-val");
  if (valEl) valEl.value = val;
}

function syncSlider(el) {
  var valEl = document.getElementById(el.id + "-val");
  if (valEl) valEl.value = el.value;
}

function syncVal(el, sliderId) {
  var v = parseFloat(el.value);
  if (isNaN(v)) return;
  var slider = document.getElementById(sliderId);
  if (v < parseFloat(slider.min)) slider.min = v < 0 ? v * 2 : v * 0.5;
  if (v > parseFloat(slider.max)) slider.max = v * 2 || 1;
  slider.value = v;
}

// ══════════════════════════════════════
//  COLOR PALETTE
// ══════════════════════════════════════
function renderColorChips() {
  var row = document.getElementById("color-chips");
  row.innerHTML = "";
  var colors = config.colors || [];
  colors.forEach(function (c, i) {
    var chip = document.createElement("div");
    chip.className = "color-chip";
    chip.style.background = c;
    var inp = document.createElement("input");
    inp.type = "color";
    inp.value = c;
    inp.oninput = function () {
      config.colors[i] = inp.value;
      chip.style.background = inp.value;
      updateCode();
      if (!playing) render();
    };
    chip.appendChild(inp);
    chip.oncontextmenu = function (e) {
      e.preventDefault();
      if (config.colors.length > 1) {
        config.colors.splice(i, 1);
        renderColorChips();
        updateCode();
        if (!playing) render();
      }
    };
    row.appendChild(chip);
  });
  var add = document.createElement("div");
  add.className = "color-add";
  add.textContent = "+";
  add.onclick = function () {
    if (!config.colors) config.colors = [];
    config.colors.push("#ffffff");
    renderColorChips();
    updateCode();
  };
  row.appendChild(add);
}

function setPalette(colors) {
  config.colors = colors.slice();
  renderColorChips();
  updateCode();
  if (!playing) render();
}

function setCharset(cs) {
  config.charset = cs;
  document.getElementById("p-charset").value = cs;
  updateCode();
  if (!playing) render();
}

// ══════════════════════════════════════
//  LAYER B TOGGLE
// ══════════════════════════════════════
function toggleLayerB(on) {
  var el = document.getElementById("layer-b-controls");
  if (el) el.style.display = on ? "flex" : "none";
}

function onLayerBToggle() {
  var on = document.getElementById("p-lb-on").checked;
  toggleLayerB(on);
  liveUpdate();
}

// ══════════════════════════════════════
//  PRESETS
// ══════════════════════════════════════
function buildPresets() {
  var wrap = document.getElementById("presets");
  wrap.innerHTML = "";
  PRESETS.forEach(function (p) {
    var btn = document.createElement("span");
    btn.className = "preset-btn";
    btn.textContent = p.name;
    btn.onclick = function () {
      config = JSON.parse(JSON.stringify(p));
      time = 0;
      configToUI();
      wrap.querySelectorAll(".preset-btn").forEach(function (b) {
        b.classList.remove("active");
      });
      btn.classList.add("active");
    };
    wrap.appendChild(btn);
  });
}

function newPreset() {
  config = {
    name: "Untitled",
    pattern: "centerSpiral",
    charset: "░▒▓█",
    colors: ["#00ffd5", "#00b396", "#006654"],
    xConstant: 1,
    yConstant: 1,
    frameMultiplier: 0.05,
    animationSpeed: 0.3,
    mirrorAxis: "none",
    globalVal: 1,
    colored: true,
    centerX: 0,
    centerY: 0,
    rotation: 0,
    scale: 1,
    turbulence: 0,
    customExpr: "sin(x * 0.1 + time) * cos(y * 0.05 + time * 1.5)",
    layerB: {
      enabled: false,
      pattern: "circular",
      xConstant: 0.01,
      yConstant: 0.01,
      frameMultiplier: 0.05,
      globalVal: 1,
      blendMode: "add",
      blendAmount: 0.5,
      customExpr: "sin(r * 0.2 + time)",
    },
  };
  time = 0;
  configToUI();
}

// ══════════════════════════════════════
//  RANDOMIZE
// ══════════════════════════════════════
function randomize() {
  var patterns = [
    "centerSpiral",
    "circular",
    "mosaic",
    "cross",
    "checkerboard",
    "diamond",
    "tunnel",
    "plasma",
    "interference",
    "radialStar",
    "lissajous",
    "custom",
  ];
  var customFormulas = [
    "sin(r*0.2 + theta*3 + time)",
    "sin(x*0.1+time)*cos(y*0.05+time*1.5)+sin(r*0.05)",
    "cos(theta*5)*sin(r*0.1+time)+sin(theta*3+time*2)*cos(r*0.05)",
    "sin(x*y*0.001+time)+cos(r*0.1-time*0.5)",
    "sin(r*0.15+time)*cos(theta*4+time*0.7)",
    "(sin(x*0.08+time)+sin(y*0.06+time*1.3)+cos(r*0.04-time*0.8))*0.33",
    "sin(sqrt(abs(dx*dy))*0.1+time)+cos(theta*7-time*0.5)*0.5",
    "pow(sin(r*0.05+time),2)*cos(theta*3+time)*2",
  ];
  var palettes = [
    ["#43BFD4", "#BC7ED2", "#9EE1EF", "#C3ECF0", "#B9AAF3"],
    ["#FF7700", "#F88826", "#FF6900", "#9800FF", "#7600FF"],
    ["#ff9500", "#fed50b", "#ffea00", "#0055ff", "#003d9e"],
    [
      "#FF2020",
      "#FF6600",
      "#FFCC00",
      "#2288FF",
      "#22FF66",
      "#FF44AA",
      "#CC44FF",
    ],
    ["#00FF88", "#22DDAA", "#44FFBB", "#88FFCC", "#00CC66"],
    ["#00CFFF", "#0088DD", "#44EEFF", "#AAEEFF", "#006699"],
    ["#FF4488", "#FF88AA", "#FF44DD", "#AA22FF", "#DD66FF"],
    ["#FFCC00", "#FF8800", "#FF4400", "#AA0000", "#660000"],
    ["#B87418", "#6456BC", "#A671BC", "#B75053", "#B83D2B"],
    ["#FFFFFF", "#BBBBBB", "#888888", "#444444", "#000000"],
    ["#FFFFFF", "#DDDDDD", "#AAAAAA", "#777777", "#333333", "#000000"],
    ["#000000", "#1A1A1A", "#333333", "#4D4D4D", "#666666"],
    [
      "#FFFFFF",
      "#E0E0E0",
      "#C0C0C0",
      "#A0A0A0",
      "#808080",
      "#606060",
      "#404040",
      "#202020",
    ],
  ];
  var charsets = [
    "░▒▓█░▒▓█",
    ".,;:!|/\\~=#%@&*",
    " .·:∙○◎●",
    "┃┏┓┛┗┙┘━",
    "╬╪╫│┼─",
    "_░░████░▒▓░▒",
    "░│││___...●●",
    "░▒▓█▓▒░",
    "▖▗▘▙▚▛▜▝▞▟",
    "▬▭▬▭▬▭▬▭",
    "⠁⠃⠇⡇⣇⣧⣷⣿",
    "▁▂▃▄▅▆▇█",
    " .:oO@",
    "·•●◉⬤",
    "♠♣♥♦★☆◆◇",
  ];
  var symmetries = [
    "none",
    "none",
    "none",
    "x",
    "y",
    "both",
    "radial-4",
    "radial-6",
    "radial-8",
  ];

  var pick = function (arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  };
  var rng = function (a, b) {
    return a + Math.random() * (b - a);
  };
  var p = pick(patterns);

  // Pattern-tuned constants — biased toward the clean zone for each pattern
  var xc, yc, fm, gv;
  switch (p) {
    case "centerSpiral":
      xc = rng(-2, 5);
      yc = rng(0.1, 10);
      fm = rng(-0.1, 0.1);
      gv = rng(0, 5);
      break;
    case "circular":
      xc = rng(-0.01, 0.05) * (Math.random() > 0.5 ? 1 : -1);
      yc = rng(0.0001, 0.05);
      fm = rng(0.01, 0.2);
      gv = rng(0, 3);
      break;
    case "mosaic":
    case "checkerboard":
      xc = rng(0.01, 0.8);
      yc = rng(0.01, 0.8);
      fm = rng(0.005, 0.05);
      gv = rng(0, 2);
      break;
    case "diamond":
      xc = rng(0.02, 1.5);
      yc = rng(1, 8);
      fm = rng(0.02, 0.15);
      gv = rng(0, 3);
      break;
    case "tunnel":
      xc = rng(2, 15);
      yc = rng(1, 6);
      fm = rng(0.05, 0.2);
      gv = rng(0, 3);
      break;
    case "plasma":
      xc = rng(2, 12);
      yc = rng(2, 10);
      fm = rng(0.02, 0.08);
      gv = rng(0, 2);
      break;
    case "interference":
      xc = rng(0.05, 1);
      yc = rng(0.05, 1);
      fm = rng(0.03, 0.15);
      gv = rng(0, 2);
      break;
    case "radialStar":
      xc = rng(0.05, 0.5);
      yc = Math.round(rng(3, 8));
      fm = rng(0.02, 0.12);
      gv = rng(1, 5);
      break;
    case "lissajous":
      xc = rng(1, 8);
      yc = rng(1, 8);
      fm = rng(0.02, 0.08);
      gv = rng(0.5, 3);
      break;
    case "custom":
      xc = rng(0.01, 1);
      yc = rng(0.01, 1);
      fm = rng(0.02, 0.1);
      gv = rng(0.5, 3);
      break;
    default:
      xc = rng(-5, 5);
      yc = rng(-5, 5);
      fm = rng(-0.1, 0.1);
      gv = rng(0, 5);
  }

  var useLayerB = Math.random() > 0.65;

  config = {
    name: "Random — " + p,
    pattern: p,
    charset: pick(charsets),
    colors: pick(palettes).slice(),
    xConstant: xc,
    yConstant: yc,
    frameMultiplier: fm,
    animationSpeed: rng(0.1, 0.6),
    mirrorAxis: pick(symmetries),
    globalVal: gv,
    colored: Math.random() > 0.15,
    centerX: rng(-0.2, 0.2),
    centerY: rng(-0.2, 0.2),
    rotation: Math.round(rng(0, 360)),
    scale: rng(0.7, 1.8),
    turbulence: Math.random() > 0.6 ? rng(0.05, 0.3) : 0,
    customExpr:
      p === "custom"
        ? pick(customFormulas)
        : config.customExpr || "sin(r*0.2+time)",
    layerB: useLayerB
      ? {
          enabled: true,
          pattern: pick(patterns),
          xConstant: rng(-50, 50),
          yConstant: rng(-50, 50),
          frameMultiplier: rng(-0.1, 0.1),
          globalVal: rng(0, 3),
          blendMode: pick([
            "add",
            "multiply",
            "subtract",
            "min",
            "max",
            "screen",
          ]),
          blendAmount: rng(0.2, 0.7),
          customExpr: pick(customFormulas),
        }
      : {
          enabled: false,
          pattern: "circular",
          xConstant: 0.01,
          yConstant: 0.01,
          frameMultiplier: 0.05,
          globalVal: 1,
          blendMode: "add",
          blendAmount: 0.5,
          customExpr: "sin(r*0.2+time)",
        },
  };

  time = 0;
  configToUI();
  // Clear preset highlights
  document.querySelectorAll("#presets .preset-btn").forEach(function (b) {
    b.classList.remove("active");
  });
}

// ══════════════════════════════════════
//  PER-SECTION RANDOMIZERS
// ══════════════════════════════════════
var _rng = function (a, b) {
  return a + Math.random() * (b - a);
};
var _pick = function (arr) {
  return arr[Math.floor(Math.random() * arr.length)];
};

// Nudge a value by ±percent, clamped to [lo, hi]. Used by section dice for variations.
function _vary(val, percent, lo, hi) {
  if (val === 0) return _rng(lo, hi) * 0.3; // can't nudge zero — pick a small value
  var range = Math.abs(val) * percent;
  var v = val + _rng(-range, range);
  if (lo !== undefined && v < lo) v = lo;
  if (hi !== undefined && v > hi) v = hi;
  return v;
}

function randomizePattern() {
  var patterns = [
    "centerSpiral",
    "circular",
    "mosaic",
    "cross",
    "checkerboard",
    "diamond",
    "tunnel",
    "plasma",
    "interference",
    "radialStar",
    "lissajous",
    "custom",
  ];
  var customFormulas = [
    "sin(r*0.2 + theta*3 + time)",
    "sin(x*0.1+time)*cos(y*0.05+time*1.5)+sin(r*0.05)",
    "cos(theta*5)*sin(r*0.1+time)+sin(theta*3+time*2)*cos(r*0.05)",
    "sin(x*y*0.001+time)+cos(r*0.1-time*0.5)",
    "sin(r*0.15+time)*cos(theta*4+time*0.7)",
    "(sin(x*0.08+time)+sin(y*0.06+time*1.3)+cos(r*0.04-time*0.8))*0.33",
    "sin(sqrt(abs(dx*dy))*0.1+time)+cos(theta*7-time*0.5)*0.5",
    "pow(sin(r*0.05+time),2)*cos(theta*3+time)*2",
  ];
  config.pattern = _pick(patterns);
  if (config.pattern === "custom") config.customExpr = _pick(customFormulas);
  config.name = "Random — " + config.pattern;
  _customSrcA = "";
  configToUI();
}

function randomizeSpatial() {
  var r = PATTERN_RANGES[config.pattern];
  if (r) {
    config.xConstant = _vary(config.xConstant, 0.3, r.xc[0], r.xc[1]);
    config.yConstant = _vary(config.yConstant, 0.3, r.yc[0], r.yc[1]);
    config.globalVal = _vary(config.globalVal, 0.3, r.gv[0], r.gv[1]);
    // For radialStar, yC should be integer (petal count)
    if (config.pattern === "radialStar")
      config.yConstant = Math.round(config.yConstant);
  } else {
    config.xConstant = _vary(config.xConstant, 0.3, -10, 10);
    config.yConstant = _vary(config.yConstant, 0.3, -10, 10);
    config.globalVal = _vary(config.globalVal, 0.3, 0, 10);
  }
  configToUI();
}

function randomizeAnimation() {
  config.frameMultiplier = _vary(config.frameMultiplier, 0.3, -0.3, 0.3);
  config.animationSpeed = _vary(config.animationSpeed, 0.3, 0.01, 1);
  configToUI();
}

function randomizeTransform() {
  config.centerX = _vary(config.centerX, 0.4, -1, 1);
  config.centerY = _vary(config.centerY, 0.4, -1, 1);
  config.rotation = Math.round(_vary(config.rotation, 0.2, 0, 360)) % 360;
  config.scale = _vary(config.scale, 0.25, 0.1, 5);
  config.turbulence = _vary(config.turbulence, 0.4, 0, 1);
  // Symmetry: 70% keep current, 30% pick a neighbor
  if (Math.random() > 0.7) {
    config.mirrorAxis = _pick([
      "none",
      "x",
      "y",
      "both",
      "radial-4",
      "radial-6",
      "radial-8",
    ]);
  }
  configToUI();
}

function randomizeLayerB() {
  var lb = config.layerB;
  if (lb && lb.enabled) {
    // Vary existing layer B settings
    lb.xConstant = _vary(lb.xConstant, 0.3, -50, 50);
    lb.yConstant = _vary(lb.yConstant, 0.3, -50, 50);
    lb.frameMultiplier = _vary(lb.frameMultiplier, 0.3, -0.3, 0.3);
    lb.globalVal = _vary(lb.globalVal, 0.3, 0, 5);
    lb.blendAmount = _vary(lb.blendAmount, 0.25, 0.1, 1);
    // 30% chance to swap blend mode
    if (Math.random() > 0.7) {
      lb.blendMode = _pick([
        "add",
        "multiply",
        "subtract",
        "min",
        "max",
        "screen",
      ]);
    }
  } else {
    // Create fresh layer B
    var patterns = [
      "centerSpiral",
      "circular",
      "mosaic",
      "cross",
      "checkerboard",
      "diamond",
      "tunnel",
      "plasma",
      "interference",
      "radialStar",
      "lissajous",
    ];
    var customFormulas = [
      "sin(r*0.2 + theta*3 + time)",
      "sin(x*0.1+time)*cos(y*0.05+time*1.5)+sin(r*0.05)",
      "cos(theta*5)*sin(r*0.1+time)+sin(theta*3+time*2)*cos(r*0.05)",
      "sin(x*y*0.001+time)+cos(r*0.1-time*0.5)",
    ];
    config.layerB = {
      enabled: true,
      pattern: _pick(patterns),
      xConstant: _rng(-5, 5),
      yConstant: _rng(-5, 5),
      frameMultiplier: _rng(-0.1, 0.1),
      globalVal: _rng(0, 3),
      blendMode: _pick(["add", "multiply", "subtract", "min", "max", "screen"]),
      blendAmount: _rng(0.3, 0.7),
      customExpr: _pick(customFormulas),
    };
  }
  _customSrcB = "";
  configToUI();
}

function randomizeCharset() {
  // Truly random: build a charset from random block/line-drawing/symbol characters
  var pools = [
    "░▒▓█",
    "│┃─━┼╬",
    "┏┓┛┗┘┐┌└",
    "╔╗╝╚═║╠╣╦╩",
    "○◎●◐◑◒◓",
    "·∙•◉⬤",
    ".,;:!|/\\~",
    "=#%@&*+^",
    "_-=≡≈",
    "▄▀▌▐",
    "◢◣◤◥",
    "△▽◇□",
    "∴∵∶∷",
    "▖▗▘▙▚▛▜▝▞▟",
    "▬▭",
    "⠁⠃⠇⡇⣇⣧⣷⣿",
    "▁▂▃▄▅▆▇█",
    "╌╎┊┆│║",
    "♠♣♥♦★☆◆◇",
    "₪§Ξ≥≤",
  ];
  var charset = "";
  // Pick 2-4 random pools and sample characters from them
  var numPools = 2 + Math.floor(Math.random() * 3);
  for (var i = 0; i < numPools; i++) {
    var pool = _pick(pools);
    // Take a random subset of 2-5 characters from the pool
    var take = Math.min(pool.length, 2 + Math.floor(Math.random() * 4));
    var shuffled = pool.split("").sort(function () {
      return Math.random() - 0.5;
    });
    charset += shuffled.slice(0, take).join("");
  }
  // Occasionally repeat some chars for weighting (gives visual emphasis)
  if (Math.random() > 0.6) {
    var weightChar = charset[Math.floor(Math.random() * charset.length)];
    charset += weightChar + weightChar;
  }
  config.charset = charset;
  configToUI();
}

function randomizePalette() {
  // Truly random: generate a palette of 3-7 colors with coherent hue logic
  var numColors = 3 + Math.floor(Math.random() * 5);
  var colors = [];
  var strategy = Math.random();

  if (strategy < 0.33) {
    // Analogous: pick a base hue, vary ±40°
    var baseHue = Math.floor(Math.random() * 360);
    for (var i = 0; i < numColors; i++) {
      var h = (baseHue + Math.floor(Math.random() * 80) - 40 + 360) % 360;
      var s = 50 + Math.floor(Math.random() * 50);
      var l = 35 + Math.floor(Math.random() * 45);
      colors.push(_hslToHex(h, s, l));
    }
  } else if (strategy < 0.66) {
    // Complementary: two opposite hues
    var h1 = Math.floor(Math.random() * 360);
    var h2 = (h1 + 180 + Math.floor(Math.random() * 30) - 15) % 360;
    for (var i = 0; i < numColors; i++) {
      var h = i % 2 === 0 ? h1 : h2;
      h = (h + Math.floor(Math.random() * 20) - 10 + 360) % 360;
      var s = 55 + Math.floor(Math.random() * 45);
      var l = 35 + Math.floor(Math.random() * 45);
      colors.push(_hslToHex(h, s, l));
    }
  } else {
    // Full spectrum: random hues spread apart
    for (var i = 0; i < numColors; i++) {
      var h = Math.floor((360 / numColors) * i + Math.random() * 40);
      var s = 60 + Math.floor(Math.random() * 40);
      var l = 40 + Math.floor(Math.random() * 35);
      colors.push(_hslToHex(h, s, l));
    }
  }

  config.colors = colors;
  config.colored = true;
  configToUI();
}

function _hslToHex(h, s, l) {
  s /= 100;
  l /= 100;
  var c = (1 - Math.abs(2 * l - 1)) * s;
  var x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  var m = l - c / 2;
  var r, g, b;
  if (h < 60) {
    r = c;
    g = x;
    b = 0;
  } else if (h < 120) {
    r = x;
    g = c;
    b = 0;
  } else if (h < 180) {
    r = 0;
    g = c;
    b = x;
  } else if (h < 240) {
    r = 0;
    g = x;
    b = c;
  } else if (h < 300) {
    r = x;
    g = 0;
    b = c;
  } else {
    r = c;
    g = 0;
    b = x;
  }
  var toHex = function (v) {
    var hex = Math.round((v + m) * 255).toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  };
  return "#" + toHex(r) + toHex(g) + toHex(b);
}

// ══════════════════════════════════════
//  CODE EDITOR (Advanced tab)
// ══════════════════════════════════════
function updateCode() {
  var ed = document.getElementById("code-editor");
  if (document.activeElement === ed) return;
  ed.value = JSON.stringify(config, null, 2);
}

function applyCode() {
  try {
    var obj = JSON.parse(document.getElementById("code-editor").value);
    config = obj;
    configToUI();
    time = 0;
  } catch (e) {
    alert("Invalid JSON: " + e.message);
  }
}

// ══════════════════════════════════════
//  TABS & SECTIONS
// ══════════════════════════════════════
function switchTab(tab) {
  document.querySelectorAll(".tab-btn").forEach(function (b) {
    b.classList.remove("active");
  });
  document.querySelectorAll(".tab-content").forEach(function (t) {
    t.classList.remove("active");
  });
  if (tab === "visual") {
    document.querySelectorAll(".tab-btn")[0].classList.add("active");
    document.getElementById("tab-visual").classList.add("active");
  } else {
    document.querySelectorAll(".tab-btn")[1].classList.add("active");
    document.getElementById("tab-advanced").classList.add("active");
    updateCode();
  }
}

function toggleSection(el) {
  el.classList.toggle("collapsed");
  var body = el.nextElementSibling;
  if (body) body.classList.toggle("hide");
}

// ══════════════════════════════════════
//  EXPORT
// ══════════════════════════════════════
function exportHTML() {
  var c = config;
  var bg = "#000000";
  var fontSize = document.getElementById("p-fontsize").value;

  var engine = [
    "var config=" + JSON.stringify(c) + ";",
    'var time=0,canvas=document.getElementById("c"),ctx;',
    "var charW,cellH,cols,rows,FS=" +
      fontSize +
      ",LH=1.15,TWO_PI=Math.PI*2,_sx=0,_sy=0;",
    'function setup(){var d=devicePixelRatio||1,w=canvas.clientWidth,h=canvas.clientHeight;canvas.width=w*d;canvas.height=h*d;ctx=canvas.getContext("2d");ctx.scale(d,d);ctx.font=FS+"px Courier New,monospace";ctx.textBaseline="top";charW=ctx.measureText("M").width;cellH=Math.round(FS*LH);cols=Math.ceil(w/charW)+2;rows=Math.ceil(h/cellH)+2}',
    "function nX(x,y,t){return Math.sin(x*.031+y*.071+t*.3)*.5+Math.sin(x*.113-y*.037+t*.7)*.3+Math.sin(y*.053+x*.131+t*.5)*.2}",
    "function nY(x,y,t){return Math.cos(x*.071+y*.031+t*.4)*.5+Math.cos(x*.037-y*.113+t*.6)*.3+Math.cos(y*.131+x*.053+t*.8)*.2}",
    'function sym(dx,dy,m){if(m==="x"){_sx=Math.abs(dx);_sy=dy}else if(m==="y"){_sx=dx;_sy=Math.abs(dy)}else if(m==="both"){_sx=Math.abs(dx);_sy=Math.abs(dy)}else if(m.indexOf("radial")===0){var n=parseInt(m.split("-")[1]),a=Math.atan2(dy,dx),r=Math.sqrt(dx*dx+dy*dy),s=TWO_PI/n;a=((a%s)+s)%s;if(a>s*.5)a=s-a;_sx=r*Math.cos(a);_sy=r*Math.sin(a)}else{_sx=dx;_sy=dy}}',
    'function bld(a,b,m,t){var v;switch(m){case"add":v=a+b;break;case"multiply":v=a*b;break;case"subtract":v=a-b;break;case"min":v=Math.min(a,b);break;case"max":v=Math.max(a,b);break;case"screen":v=a+b-a*b;break;default:v=a}return a*(1-t)+v*t}',
    // Safe math parser for export
    "var _ec={};function _ce(s){if(_ec[s])return _ec[s];try{var f=_pe(s);_ec[s]=f;return f}catch(e){return null}}",
    'function _pe(s){var T=[],i=0,S=s.replace(/\\s+/g,"");while(i<S.length){var c=S[i];if((c>="0"&&c<="9")||(c==="."&&i+1<S.length&&S[i+1]>="0"&&S[i+1]<="9")){var n="";while(i<S.length&&((S[i]>="0"&&S[i]<="9")||S[i]==="."))n+=S[i++];T.push({t:"n",v:parseFloat(n)})}else if((c>="a"&&c<="z")||(c>="A"&&c<="Z")||c==="_"){var d="";while(i<S.length&&((S[i]>="a"&&S[i]<="z")||(S[i]>="A"&&S[i]<="Z")||(S[i]>="0"&&S[i]<="9")||S[i]==="_"))d+=S[i++];T.push({t:"i",v:d})}else if("+-*/^%(),".indexOf(c)>=0){T.push({t:"o",v:c});i++}else{i++}}',
    "var F={sin:Math.sin,cos:Math.cos,tan:Math.tan,asin:Math.asin,acos:Math.acos,atan:Math.atan,atan2:Math.atan2,sqrt:Math.sqrt,abs:Math.abs,pow:Math.pow,log:Math.log,min:Math.min,max:Math.max,floor:Math.floor,ceil:Math.ceil,round:Math.round,sign:Math.sign,exp:Math.exp};",
    "var V={x:1,y:1,time:1,t:1,dx:1,dy:1,r:1,theta:1,PI:1,pi:1,xC:1,yC:1,fm:1,gV:1,w:1,h:1};",
    'var p=0;function pk(){return p<T.length?T[p]:null}function et(t,v){var k=pk();if(!k)throw"e";if(t&&k.t!==t)throw"e";if(v!==undefined&&k.v!==v)throw"e";p++;return k}',
    'function pE(){return pA()}function pA(){var l=pM();while(pk()&&pk().t==="o"&&(pk().v==="+"||pk().v==="-")){var o=et("o").v,r=pM();l=o==="+"?mb(l,r,function(a,b){return a+b}):mb(l,r,function(a,b){return a-b})}return l}',
    'function pM(){var l=pP();while(pk()&&pk().t==="o"&&(pk().v==="*"||pk().v==="/"||pk().v==="%")){var o=et("o").v,r=pP();if(o==="*")l=mb(l,r,function(a,b){return a*b});else if(o==="/")l=mb(l,r,function(a,b){return b===0?0:a/b});else l=mb(l,r,function(a,b){return b===0?0:a%b})}return l}',
    'function pP(){var b=pU();if(pk()&&pk().t==="o"&&pk().v==="^"){et("o");var e=pU();return mb(b,e,Math.pow)}return b}',
    'function pU(){if(pk()&&pk().t==="o"&&pk().v==="-"){et("o");var v=pU();return function(e){return -v(e)}}if(pk()&&pk().t==="o"&&pk().v==="+"){et("o");return pU()}return pAt()}',
    'function pAt(){var k=pk();if(!k)throw"e";if(k.t==="n"){et("n");var v=k.v;return function(){return v}}if(k.t==="o"&&k.v==="("){et("o","(");var inner=pE();et("o",")");return inner}if(k.t==="i"){et("i");var nm=k.v;if(pk()&&pk().t==="o"&&pk().v==="("){et("o","(");var args=[];if(!(pk()&&pk().t==="o"&&pk().v===")")){args.push(pE());while(pk()&&pk().t==="o"&&pk().v===","){et("o",",");args.push(pE())}}et("o",")");var fn=F[nm];if(!fn)throw"e";return function(e){var a=[];for(var i=0;i<args.length;i++)a.push(args[i](e));return fn.apply(null,a)}}if(nm==="PI"||nm==="pi")return function(){return Math.PI};if(!V[nm])throw"e";return function(e){return e[nm]||0}}throw"e"}',
    'function mb(l,r,o){return function(e){return o(l(e),r(e))}}var result=pE();if(p<T.length)throw"e";return result}',
    'var _cfA=null,_csA="",_cfB=null,_csB="";',
    "function evalCE(src,mx,my,fw,fh,c){if(src!==_csA){_csA=src;_cfA=_ce(src)}if(!_cfA)return 0;var dx=mx-fw/2,dy=my-fh/2,r=Math.sqrt(dx*dx+dy*dy)+.01,th=Math.atan2(dy,dx);return _cfA({x:mx,y:my,dx:dx,dy:dy,r:r,theta:th,time:time,t:time,w:fw,h:fh,xC:c.xConstant,yC:c.yConstant,fm:c.frameMultiplier,gV:c.globalVal})}",
    "function evalCEB(src,mx,my,fw,fh,c){if(src!==_csB){_csB=src;_cfB=_ce(src)}if(!_cfB)return 0;var dx=mx-fw/2,dy=my-fh/2,r=Math.sqrt(dx*dx+dy*dy)+.01,th=Math.atan2(dy,dx);return _cfB({x:mx,y:my,dx:dx,dy:dy,r:r,theta:th,time:time,t:time,w:fw,h:fh,xC:c.xConstant,yC:c.yConstant,fm:c.frameMultiplier,gV:c.globalVal})}",
    "function compute(p,x,y,w,h,c){var dx,dy,th,r;switch(p){",
    'case"centerSpiral":dx=x-w/2;dy=y-h/2;th=Math.atan2(dy,dx)+c.xConstant;return Math.sin((th+(time+Math.sin(x*c.xConstant+y*c.yConstant))*c.frameMultiplier+Math.sin(th*c.yConstant)+c.globalVal*Math.sin(x*c.xConstant+time))*(1+Math.sin(th*c.frameMultiplier)));',
    'case"circular":dx=x-w/2;dy=y-h/2;return Math.sin(dx*dx*c.xConstant+dy*dy*c.yConstant+time*c.frameMultiplier);',
    'case"mosaic":return Math.sin(x*c.xConstant+time)*Math.sin(y*c.yConstant+time);',
    'case"cross":dx=x-w/2;dy=y-h/2;return Math.sin(dx*dx*c.xConstant+time*c.frameMultiplier)+Math.cos(dy*dy*c.yConstant+time*c.frameMultiplier);',
    'case"checkerboard":return Math.sin(x*c.xConstant)*Math.sin(y*c.yConstant+time);',
    'case"diamond":dx=x-w/2;dy=y-h/2;return Math.sin((Math.abs(dx)+Math.abs(dy))*c.xConstant+time*c.frameMultiplier)*Math.cos(c.yConstant*Math.atan2(dy,dx)+time*c.frameMultiplier*.5);',
    'case"tunnel":dx=x-w/2;dy=y-h/2;r=Math.sqrt(dx*dx+dy*dy)+.01;th=Math.atan2(dy,dx);return Math.sin(c.xConstant/r+time*c.frameMultiplier)*Math.sin(th*c.yConstant+time*c.frameMultiplier*.7+c.globalVal*Math.sin(r*.1));',
    'case"plasma":dx=x-w/2;dy=y-h/2;return(Math.sin(x*c.xConstant*.01+time)+Math.sin(y*c.yConstant*.01+time*1.5)+Math.sin((x+y)*c.xConstant*.005+time*.7)+Math.sin(Math.sqrt(dx*dx+dy*dy)*c.yConstant*.01+time*1.2+c.globalVal))*.25;',
    'case"interference":var s1x=w*.3,s1y=h*.5,s2x=w*.7,s2y=h*.5;return(Math.sin(Math.sqrt((x-s1x)*(x-s1x)+(y-s1y)*(y-s1y))*c.xConstant+time*c.frameMultiplier+c.globalVal)+Math.sin(Math.sqrt((x-s2x)*(x-s2x)+(y-s2y)*(y-s2y))*c.yConstant+time*c.frameMultiplier))*.5;',
    'case"radialStar":dx=x-w/2;dy=y-h/2;r=Math.sqrt(dx*dx+dy*dy);th=Math.atan2(dy,dx);return Math.sin(r*c.xConstant+Math.cos(th*Math.max(1,Math.round(Math.abs(c.yConstant))))*c.globalVal+time*c.frameMultiplier);',
    'case"lissajous":return Math.sin(x*c.xConstant*.1+Math.sin(time*3)*c.globalVal)*Math.sin(y*c.yConstant*.1+Math.cos(time*2)*c.globalVal);',
    'case"custom":return evalCE(c.customExpr||"",x,y,w,h,c);',
    "default:return 0}}",
    'function render(){var c=config,fw=cols,fh=rows,cs=c.charset||"░▒▓█",cl=cs.length,co=c.colors,cn=co?co.length:0;',
    'var bg="' + bg + '",sm=c.mirrorAxis||"none";',
    "var ox=(c.centerX||0)*fw*.5,oy=(c.centerY||0)*fh*.5;",
    "var rot=(c.rotation||0)*Math.PI/180,cr=Math.cos(rot),sr=Math.sin(rot);",
    'var sc=c.scale||1,tb=c.turbulence||0,hr=rot!==0,hs=sm!=="none",lb=c.layerB&&c.layerB.enabled?c.layerB:null;',
    "ctx.fillStyle=bg;ctx.fillRect(0,0,canvas.width,canvas.height);var pf=bg;",
    "for(var y=0;y<fh;y++){var py=y*cellH;for(var x=0;x<fw;x++){",
    "var dx=x-fw*.5-ox,dy=y-fh*.5-oy;",
    "if(hr){var rx=dx*cr-dy*sr,ry=dx*sr+dy*cr;dx=rx;dy=ry}",
    "if(sc!==1){dx/=sc;dy/=sc}",
    "if(hs){sym(dx,dy,sm);dx=_sx;dy=_sy}",
    "if(tb>0){dx+=nX(dx,dy,time)*tb*10;dy+=nY(dx,dy,time)*tb*10}",
    "var mx=dx+fw*.5,my=dy+fh*.5;",
    "var v=compute(c.pattern,mx,my,fw,fh,c);",
    'if(lb){var vb;if(lb.pattern==="custom"){vb=evalCEB(lb.customExpr||"",mx,my,fw,fh,lb)}else{vb=compute(lb.pattern,mx,my,fw,fh,lb)}v=bld(v,vb,lb.blendMode,lb.blendAmount)}',
    "var i=((v+2)*cl*.25)|0;if(i<0)i=0;else if(i>=cl)i=cl-1;",
    'var f;if(c.colored&&co&&cn){f=co[((i%cn)+cn)%cn]}else{var b=(v+2)*.25;f=b>.65?"#00ffd5":b>.4?"#00b396":"#3d4f4a"}',
    "if(f!==pf){ctx.fillStyle=f;pf=f}ctx.fillText(cs[i],x*charW,py)}}",
    "}",
    'setup();window.addEventListener("resize",setup);',
    "var lt=0;requestAnimationFrame(function L(ts){if(ts-lt>=33){time+=config.animationSpeed*.03;render();lt=ts}requestAnimationFrame(L)});",
  ].join("\n");

  var html =
    '<!DOCTYPE html>\n<html><head><meta charset="UTF-8"><title>' +
    (c.name || "ASCII Animation") +
    "</title><style>*{margin:0;padding:0;box-sizing:border-box}html,body{width:100%;height:100%;overflow:hidden;background:" +
    bg +
    '}canvas{display:block;width:100%;height:100%}</style></head><body><canvas id="c"></canvas><script>' +
    engine +
    "<\/script></body></html>";

  var blob = new Blob([html], { type: "text/html" });
  var a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download =
    (c.name || "animation").replace(/[^a-zA-Z0-9_-]/g, "_") + ".html";
  a.click();
  URL.revokeObjectURL(a.href);
}

// ══════════════════════════════════════
//  XP MENUS
// ══════════════════════════════════════
var openMenuId = null;

function toggleMenu(menuId, triggerEl) {
  if (openMenuId === menuId) {
    closeMenus();
    return;
  }
  closeMenus();
  var menu = document.getElementById(menuId);
  var rect = triggerEl.getBoundingClientRect();
  menu.style.left = rect.left + "px";
  menu.style.top = rect.bottom + "px";
  menu.classList.add("show");
  triggerEl.classList.add("open");
  openMenuId = menuId;
}

function closeMenus() {
  document.querySelectorAll(".xp-menu.show").forEach(function (m) {
    m.classList.remove("show");
  });
  document.querySelectorAll(".menu-trigger.open").forEach(function (t) {
    t.classList.remove("open");
  });
  openMenuId = null;
}

// Hover-follow: when a menu is open, hovering another trigger opens it
document.addEventListener("mouseover", function (e) {
  if (!openMenuId) return;
  var trig = e.target.closest(".menu-trigger");
  if (trig && trig.dataset.menu && trig.dataset.menu !== openMenuId) {
    toggleMenu(trig.dataset.menu, trig);
  }
});

// Click outside to close
document.addEventListener("mousedown", function (e) {
  if (!openMenuId) return;
  if (e.target.closest(".xp-menu") || e.target.closest(".menu-trigger")) return;
  closeMenus();
});

// ══════════════════════════════════════
//  XP DIALOGS
// ══════════════════════════════════════
function showAbout() {
  document.getElementById("about-overlay").classList.add("show");
  document.getElementById("about-dialog").classList.add("show");
}
function closeAbout() {
  document.getElementById("about-overlay").classList.remove("show");
  document.getElementById("about-dialog").classList.remove("show");
}

// ══════════════════════════════════════
//  EXPORT GIF
// ══════════════════════════════════════
var _exporting = false;
var _exportMode = "gif";

function showExportGif() {
  _exportMode = "gif";
  document.getElementById("export-dialog-title").textContent = "Export as GIF";
  document.getElementById("export-progress").style.display = "none";
  document.getElementById("export-start-btn").disabled = false;
  document.getElementById("export-overlay").classList.add("show");
  document.getElementById("export-dialog").classList.add("show");
}

function showExportMp4() {
  if (typeof VideoEncoder === "undefined") {
    alert(
      "MP4 export requires WebCodecs API. Use Chrome, Edge, or Safari 16.4+. For Firefox, use GIF export instead.",
    );
    return;
  }
  _exportMode = "mp4";
  document.getElementById("export-dialog-title").textContent = "Export as MP4";
  document.getElementById("export-progress").style.display = "none";
  document.getElementById("export-start-btn").disabled = false;
  document.getElementById("export-overlay").classList.add("show");
  document.getElementById("export-dialog").classList.add("show");
}
function closeExportDialog() {
  if (_exporting) return;
  document.getElementById("export-overlay").classList.remove("show");
  document.getElementById("export-dialog").classList.remove("show");
}

function startExport() {
  var duration =
    parseFloat(document.getElementById("export-duration").value) || 5;
  var fps = parseInt(document.getElementById("export-fps").value) || 30;
  var scale = parseFloat(document.getElementById("export-res").value) || 1;
  duration = Math.max(1, Math.min(30, duration));
  fps = Math.max(10, Math.min(60, fps));

  _exporting = true;
  document.getElementById("export-start-btn").disabled = true;
  document.getElementById("export-progress").style.display = "block";

  if (_exportMode === "mp4") {
    _exportMp4(duration, fps, scale);
  } else {
    _exportGif(duration, fps, scale);
  }
}

function _exportGif(duration, fps, scale) {
  // Load gif.js from CDN if not already loaded
  if (typeof GIF === "undefined") {
    document.getElementById("export-progress-text").textContent =
      "Loading GIF encoder...";
    var script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/gif.js/0.2.0/gif.js";
    script.onload = function () {
      // Pre-fetch the worker script as a blob to avoid CORS issues
      fetch("https://cdnjs.cloudflare.com/ajax/libs/gif.js/0.2.0/gif.worker.js")
        .then(function (r) {
          return r.blob();
        })
        .then(function (blob) {
          window._gifWorkerBlob = URL.createObjectURL(blob);
          _doGifExport(duration, fps, scale);
        })
        .catch(function () {
          alert("Failed to load GIF worker. Check your internet connection.");
          _finishExport(time, playing);
        });
    };
    script.onerror = function () {
      alert("Failed to load GIF encoder. Check your internet connection.");
      _finishExport(time, playing);
    };
    document.head.appendChild(script);
  } else {
    _doGifExport(duration, fps, scale);
  }
}

function _doGifExport(duration, fps, scale) {
  var srcCanvas = document.getElementById("preview-canvas");
  var w = Math.round(srcCanvas.clientWidth * scale);
  var h = Math.round(srcCanvas.clientHeight * scale);

  var offCanvas = document.createElement("canvas");
  offCanvas.width = w;
  offCanvas.height = h;
  var offCtx = offCanvas.getContext("2d");

  var totalFrames = Math.round(duration * fps);
  var delay = Math.round(1000 / fps);
  var savedTime = time;
  var savedPlaying = playing;
  playing = false;

  var gif = new GIF({
    workers: 2,
    quality: 10,
    width: w,
    height: h,
    workerScript:
      window._gifWorkerBlob ||
      "https://cdnjs.cloudflare.com/ajax/libs/gif.js/0.2.0/gif.worker.js",
  });

  gif.on("finished", function (blob) {
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download =
      (config.name || "animation").replace(/[^a-zA-Z0-9_-]/g, "_") + ".gif";
    a.click();
    URL.revokeObjectURL(a.href);
    _finishExport(savedTime, savedPlaying);
  });

  gif.on("progress", function (p) {
    var pct = Math.round(p * 100);
    document.getElementById("export-progress-text").textContent =
      "Encoding GIF... " + pct + "%";
    document.getElementById("export-progress-bar").style.width = pct + "%";
  });

  var frame = 0;
  function captureFrame() {
    if (frame >= totalFrames) {
      document.getElementById("export-progress-text").textContent =
        "Encoding GIF... 0%";
      document.getElementById("export-progress-bar").style.width = "0%";
      gif.render();
      return;
    }
    time = savedTime + (frame / fps) * config.animationSpeed * SPEED_SCALE;
    render();
    offCtx.fillStyle = "#000";
    offCtx.fillRect(0, 0, w, h);
    offCtx.drawImage(srcCanvas, 0, 0, w, h);
    gif.addFrame(offCtx, { copy: true, delay: delay });
    frame++;
    var pct = Math.round((frame / totalFrames) * 100);
    document.getElementById("export-progress-text").textContent =
      "Capturing frames... " + pct + "%";
    document.getElementById("export-progress-bar").style.width = pct + "%";
    requestAnimationFrame(captureFrame);
  }
  requestAnimationFrame(captureFrame);
}

function _finishExport(savedTime, savedPlaying) {
  time = savedTime;
  playing = savedPlaying;
  _exporting = false;
  if (playing) {
    lastTick = performance.now();
    rafId = requestAnimationFrame(animLoop);
  } else {
    render();
  }
  document.getElementById("export-start-btn").disabled = false;
  document.getElementById("export-progress").style.display = "none";
  document.getElementById("export-overlay").classList.remove("show");
  document.getElementById("export-dialog").classList.remove("show");
}

// ══════════════════════════════════════
//  EXPORT MP4 (WebCodecs + mp4-muxer)
// ══════════════════════════════════════
function _exportMp4(duration, fps, scale) {
  if (typeof Mp4Muxer === "undefined") {
    document.getElementById("export-progress-text").textContent =
      "Loading MP4 encoder...";
    var script = document.createElement("script");
    script.src =
      "https://cdn.jsdelivr.net/npm/mp4-muxer@5.2.2/build/mp4-muxer.js";
    script.onload = function () {
      _doMp4Export(duration, fps, scale);
    };
    script.onerror = function () {
      alert("Failed to load MP4 encoder. Check your internet connection.");
      _finishExport(time, playing);
    };
    document.head.appendChild(script);
  } else {
    _doMp4Export(duration, fps, scale);
  }
}

function _avcCodecForSize(w, h) {
  // Pick AVC level based on coded area (width and height rounded up to next multiple of 16)
  var codedW = Math.ceil(w / 16) * 16;
  var codedH = Math.ceil(h / 16) * 16;
  var area = codedW * codedH;
  // Baseline profile (42), no constraints (00), level varies
  if (area <= 921600) return "avc1.42001f"; // Level 3.1 — up to ~1280x720
  if (area <= 2097152) return "avc1.420028"; // Level 4.0 — up to ~1920x1088
  if (area <= 8912896) return "avc1.420032"; // Level 5.0 — up to ~3840x2160+
  return "avc1.420034"; // Level 5.2 — up to ~4096x2304+
}

function _doMp4Export(duration, fps, scale) {
  var srcCanvas = document.getElementById("preview-canvas");
  // Ensure even dimensions (H.264 requirement)
  var w = Math.round(srcCanvas.clientWidth * scale);
  var h = Math.round(srcCanvas.clientHeight * scale);
  if (w % 2 !== 0) w++;
  if (h % 2 !== 0) h++;

  var offCanvas = document.createElement("canvas");
  offCanvas.width = w;
  offCanvas.height = h;
  var offCtx = offCanvas.getContext("2d");

  var totalFrames = Math.round(duration * fps);
  var savedTime = time;
  var savedPlaying = playing;
  playing = false;

  var muxer = new Mp4Muxer.Muxer({
    target: new Mp4Muxer.ArrayBufferTarget(),
    video: { codec: "avc", width: w, height: h },
    fastStart: "in-memory",
    firstTimestampBehavior: "offset",
  });

  var encoder = new VideoEncoder({
    output: function (chunk, meta) {
      muxer.addVideoChunk(chunk, meta);
    },
    error: function (e) {
      console.error("VideoEncoder error:", e);
      alert("Video encoding failed: " + e.message);
      _finishExport(savedTime, savedPlaying);
    },
  });

  encoder.configure({
    codec: _avcCodecForSize(w, h),
    width: w,
    height: h,
    bitrate: 8_000_000,
    framerate: fps,
  });

  var frame = 0;
  function captureFrame() {
    if (frame >= totalFrames) {
      document.getElementById("export-progress-text").textContent =
        "Finalizing MP4...";
      encoder
        .flush()
        .then(function () {
          muxer.finalize();
          var buf = muxer.target.buffer;
          var blob = new Blob([buf], { type: "video/mp4" });
          var a = document.createElement("a");
          a.href = URL.createObjectURL(blob);
          a.download =
            (config.name || "animation").replace(/[^a-zA-Z0-9_-]/g, "_") +
            ".mp4";
          a.click();
          URL.revokeObjectURL(a.href);
          _finishExport(savedTime, savedPlaying);
        })
        .catch(function (err) {
          console.error("MP4 finalize error:", err);
          alert("MP4 export failed: " + err.message);
          _finishExport(savedTime, savedPlaying);
        });
      return;
    }

    time = savedTime + (frame / fps) * config.animationSpeed * SPEED_SCALE;
    render();
    offCtx.fillStyle = "#000";
    offCtx.fillRect(0, 0, w, h);
    offCtx.drawImage(srcCanvas, 0, 0, w, h);

    var videoFrame = new VideoFrame(offCanvas, {
      timestamp: frame * (1_000_000 / fps),
      duration: 1_000_000 / fps,
    });
    var keyFrame = frame % (fps * 2) === 0; // keyframe every 2 seconds
    encoder.encode(videoFrame, { keyFrame: keyFrame });
    videoFrame.close();

    frame++;
    var pct = Math.round((frame / totalFrames) * 100);
    document.getElementById("export-progress-text").textContent =
      "Recording MP4... " + pct + "%";
    document.getElementById("export-progress-bar").style.width = pct + "%";
    requestAnimationFrame(captureFrame);
  }
  requestAnimationFrame(captureFrame);
}

// ══════════════════════════════════════
//  XP HELP WINDOW (CHM-style)
// ══════════════════════════════════════
var helpTopics = {
  overview:
    "<h2>Welcome to ASCII Studio</h2>" +
    "<p>ASCII Studio turns math equations into animated ASCII art. Every pattern you see is a formula — pick one, tweak the sliders, and watch the result change in real time.</p>" +
    "<h3>Quick Start</h3>" +
    "<ol><li>Choose a <strong>Pattern</strong> from the dropdown (or hit <strong>Randomize</strong>)</li>" +
    "<li>Drag the sliders — <strong>xC</strong>, <strong>yC</strong>, and <strong>gV</strong> shape the pattern</li>" +
    "<li>Adjust <strong>Frame Multiplier</strong> to change how the animation moves</li>" +
    "<li>Enable <strong>Layer B</strong> to blend two patterns together</li>" +
    "<li>Use <strong>File → Export</strong> to save as a standalone HTML, GIF, or MP4</li></ol>" +
    "<h3>Key Concepts</h3>" +
    "<ul><li><strong>Pattern</strong> — the core math formula that generates the visuals</li>" +
    "<li><strong>Constants (xC, yC, gV)</strong> — numbers fed into the formula that change the shape</li>" +
    "<li><strong>Transforms</strong> — rotate, scale, or mirror the pattern after it's generated</li>" +
    "<li><strong>Layer B</strong> — a second pattern blended on top of the first</li>" +
    "<li><strong>Characters &amp; Colors</strong> — control how numbers become visible art</li></ul>" +
    "<h3>Workflow Tips</h3>" +
    "<ul><li>Hover the <strong>?</strong> icons next to any control for a quick explanation</li>" +
    "<li>Type exact values in the number boxes beside sliders for precision</li>" +
    "<li>Right-click a color chip to remove it from the palette</li>" +
    "<li>Use <strong>File → New</strong> (Ctrl+N) to reset to a clean starting point</li></ul>",

  patterns:
    "<h2>Pattern Types</h2>" +
    "<p>Each pattern is a math function of position (x, y) and time. The sliders <strong>xC</strong>, <strong>yC</strong>, and <strong>gV</strong> are plugged directly into the formula, so their effect changes depending on which pattern you choose.</p>" +
    "<h3>Center Spiral</h3><p>Rotating arms that wind outward from the center.<br><code>sin(θ + time·fm + sin(θ·yC) + gV·sin(x·xC+time))</code><br><strong>xC</strong> = tightness of the winding &nbsp; <strong>yC</strong> = curvature of arms &nbsp; <strong>gV</strong> = breathing depth</p>" +
    "<h3>Circular</h3><p>Concentric rings radiating from the center.<br><code>sin(dx²·xC + dy²·yC + time·fm)</code><br><strong>xC</strong> = horizontal ring density &nbsp; <strong>yC</strong> = vertical ring density &nbsp; Different xC/yC values create elliptical rings.</p>" +
    "<h3>Mosaic</h3><p>A grid of cells created by two perpendicular waves multiplied together.<br><code>sin(x·xC+time) · sin(y·yC+time)</code><br><strong>xC</strong> = column count &nbsp; <strong>yC</strong> = row count</p>" +
    "<h3>Cross</h3><p>Crosshair-like interference where horizontal and vertical waves overlap.<br><code>sin(dx²·xC+time·fm) + cos(dy²·yC+time·fm)</code><br><strong>xC</strong> = horizontal frequency &nbsp; <strong>yC</strong> = vertical frequency</p>" +
    "<h3>Checkerboard</h3><p>A tiled grid where columns shimmer over time.<br><code>sin(x·xC) · sin(y·yC+time)</code><br><strong>xC</strong> = column spacing &nbsp; <strong>yC</strong> = row spacing</p>" +
    "<h3>Diamond</h3><p>Diamond-shaped contour lines (uses Manhattan distance instead of circular).<br><code>sin((|dx|+|dy|)·xC+time·fm) · cos(yC·θ+time)</code><br><strong>xC</strong> = diamond density &nbsp; <strong>yC</strong> = angular twist</p>" +
    "<h3>Tunnel</h3><p>An infinite-zoom illusion diving into the center.<br><code>sin(xC/r+time·fm) · sin(θ·yC+gV·sin(r))</code><br><strong>xC</strong> = zoom ring spacing &nbsp; <strong>yC</strong> = twist amount &nbsp; <strong>gV</strong> = ripple distortion</p>" +
    "<h3>Plasma</h3><p>Four sine waves summed together — the classic demoscene effect. Produces colorful, organic, undulating blobs.</p>" +
    "<h3>Interference</h3><p>Two wave sources at different frequencies. Bright bands where waves align, dark bands where they cancel.</p>" +
    "<h3>Radial Star</h3><p>Rose-curve flowers — petals radiating from center.<br><code>sin(r·xC + cos(θ·yC)·gV + time·fm)</code><br><strong>yC</strong> = petal count &nbsp; <strong>gV</strong> = petal sharpness &nbsp; <strong>xC</strong> = ring density</p>" +
    "<h3>Lissajous</h3><p>Two oscillators at different frequency ratios creating a parametric dance.</p>" +
    "<h3>Custom Equation</h3><p>Write your own formula from scratch. See the <em>Custom Equations</em> and <em>Equation Reference</em> help topics for details.</p>",

  constants:
    "<h2>Spatial Constants (xC, yC, gV)</h2>" +
    "<p>These three sliders are fed directly into the pattern equation. Their meaning changes depending on which pattern is selected.</p>" +
    "<h3>X Constant (xC)</h3>" +
    "<p>Usually controls <strong>horizontal frequency or density</strong>. Higher values = more detail packed into the same space.</p>" +
    "<ul><li><strong>Spiral</strong>: tightness of winding</li>" +
    "<li><strong>Circular/Cross</strong>: horizontal ring density</li>" +
    "<li><strong>Mosaic/Checkerboard</strong>: number of columns</li>" +
    "<li><strong>Tunnel</strong>: zoom ring spacing</li>" +
    "<li><strong>Star</strong>: radial ring density</li></ul>" +
    "<h3>Y Constant (yC)</h3>" +
    "<p>Usually controls <strong>vertical frequency or angular detail</strong>.</p>" +
    "<ul><li><strong>Spiral</strong>: curvature of arms</li>" +
    "<li><strong>Circular/Cross</strong>: vertical ring density (different from xC → ellipses)</li>" +
    "<li><strong>Mosaic/Checkerboard</strong>: number of rows</li>" +
    "<li><strong>Diamond</strong>: angular twist</li>" +
    "<li><strong>Star</strong>: petal count</li></ul>" +
    "<h3>Global Value (gV)</h3>" +
    "<p>A <strong>secondary amplitude</strong> or strength control. Typically scales a wave that modulates the main pattern.</p>" +
    "<ul><li><strong>Spiral</strong>: breathing depth</li>" +
    "<li><strong>Tunnel</strong>: ripple distortion</li>" +
    "<li><strong>Star</strong>: petal sharpness</li>" +
    "<li><strong>Plasma</strong>: radial mixing strength</li></ul>" +
    "<p><strong>Tip:</strong> Start at 0 and increase slowly to see how each constant shapes the current pattern.</p>",

  animation:
    "<h2>Animation &amp; Time</h2>" +
    "<p>Two controls govern motion. They do different things:</p>" +
    "<h3>Frame Multiplier (fm)</h3>" +
    "<p>Controls the <strong>style</strong> of the motion — how strongly time is mixed into the equation. Think of it as the character of the animation.</p>" +
    "<ul><li>Low values (0.5–2): gentle, flowing drift</li>" +
    "<li>High values (5–20): rapid, energetic movement</li>" +
    "<li>Negative values: reverse direction</li>" +
    "<li>Zero: completely static (time is ignored)</li></ul>" +
    "<h3>Animation Speed</h3>" +
    "<p>Controls the <strong>tempo</strong> — how fast the clock ticks forward. This speeds up or slows down the entire animation without changing its visual character.</p>" +
    "<h3>How they differ</h3>" +
    "<p>Imagine a spiral: <strong>fm</strong> controls whether it's a tight fast spin or a loose slow swirl (the shape of the motion). <strong>Speed</strong> controls how quickly that motion plays (the playback rate). Changing fm changes what you see; changing speed only changes how fast you see it.</p>",

  transforms:
    "<h2>Transforms &amp; Symmetry</h2>" +
    "<p>Before the pattern equation sees a pixel, its coordinates pass through a transform pipeline:</p>" +
    "<h3>Pipeline Order</h3>" +
    "<p><code>screen position → center offset → rotate → scale → symmetry fold → turbulence warp → pattern equation</code></p>" +
    "<h3>Center X / Center Y</h3><p>Shifts where the pattern's origin sits. Default is dead center. Move it off-center to create asymmetric compositions.</p>" +
    "<h3>Rotation</h3><p>Rotates the entire pattern (0–360°). Useful for tilting spirals or aligning symmetries at an angle.</p>" +
    "<h3>Scale</h3><p>Zooms the pattern. Values below 1 zoom in (fewer, larger details), values above 1 zoom out (more, smaller details).</p>" +
    "<h3>Turbulence</h3><p>Adds organic warping — distorts all coordinates with noise, like looking through rippled glass or water. Even a small amount (0.5–2) adds a handmade feel.</p>" +
    "<h3>Symmetry Modes</h3>" +
    "<ul><li><strong>None</strong> — no mirroring, raw output</li>" +
    "<li><strong>X axis</strong> — mirrors left ↔ right</li>" +
    "<li><strong>Y axis</strong> — mirrors top ↔ bottom</li>" +
    "<li><strong>Both axes</strong> — four-fold symmetry (each quadrant is identical)</li>" +
    "<li><strong>Radial 4 / 6 / 8</strong> — slices the image like a pie and repeats one slice around the center, creating kaleidoscope or mandala effects. Try Radial 8 with Center Spiral!</li></ul>",

  blending:
    "<h2>Layer Blending</h2>" +
    "<p>Layer B lets you run a second pattern on top of Layer A and combine them. This is where the creative explosion happens — a spiral blended with plasma, or a tunnel multiplied by interference, can create forms neither pattern could alone.</p>" +
    "<h3>How It Works</h3>" +
    "<ol><li>Enable <strong>Layer B</strong> in the sidebar</li>" +
    "<li>Choose a pattern and adjust its sliders independently</li>" +
    "<li>Pick a <strong>Blend Mode</strong> to control how the two layers combine</li>" +
    "<li>Use <strong>Blend Amount</strong> to crossfade: 0 = pure Layer A, 1 = full blend</li></ol>" +
    "<h3>Blend Modes</h3>" +
    "<ul><li><strong>Add</strong> — sums both layers. Bright areas become brighter. Good for glowing effects.</li>" +
    "<li><strong>Multiply</strong> — multiplies the values. Both layers need to be bright for the result to be bright. Darkens overall. Good for masking.</li>" +
    "<li><strong>Subtract</strong> — carves one layer out of the other. Creates sharp cutouts and negative space.</li>" +
    "<li><strong>Min</strong> — keeps whichever value is darker. Good for combining outlines.</li>" +
    "<li><strong>Max</strong> — keeps whichever value is brighter. Good for combining fills.</li>" +
    "<li><strong>Screen</strong> — inverted multiply. Soft, light mixing like overlapping projector beams.</li></ul>",

  custom:
    "<h2>Custom Equations</h2>" +
    "<p>Select <strong>Custom Equation</strong> from the pattern dropdown to write your own math formula.</p>" +
    "<h3>How It Works</h3>" +
    "<p>Your formula runs once per character cell, every frame. It receives the cell's position and the current time, and returns a number. That number is mapped to a character from the character set — low numbers get characters from the left side, high numbers from the right.</p>" +
    "<h3>Available Variables</h3>" +
    '<table style="border-collapse:collapse;width:100%;font-size:12px">' +
    '<tr><td style="padding:2px 8px"><code>x</code>, <code>y</code></td><td>Raw pixel coordinates (before transforms)</td></tr>' +
    '<tr><td style="padding:2px 8px"><code>dx</code>, <code>dy</code></td><td>Centered coordinates (after center offset, rotation, scale)</td></tr>' +
    '<tr><td style="padding:2px 8px"><code>r</code></td><td>Distance from center: √(dx² + dy²)</td></tr>' +
    '<tr><td style="padding:2px 8px"><code>theta</code></td><td>Angle from center: atan2(dy, dx)</td></tr>' +
    '<tr><td style="padding:2px 8px"><code>time</code>, <code>t</code></td><td>Animation clock (both are the same)</td></tr>' +
    '<tr><td style="padding:2px 8px"><code>w</code>, <code>h</code></td><td>Canvas width &amp; height in characters</td></tr>' +
    '<tr><td style="padding:2px 8px"><code>xC</code>, <code>yC</code>, <code>fm</code>, <code>gV</code></td><td>Your slider values — wire them in to make your formula adjustable</td></tr></table>' +
    "<h3>Getting Started</h3>" +
    "<p>Try these simple examples:</p>" +
    "<p><code>sin(r * 0.2 + time)</code> — expanding rings</p>" +
    "<p><code>sin(theta * 5 + time)</code> — spinning pinwheel</p>" +
    "<p><code>sin(x*0.1+time) + sin(y*0.1+time)</code> — diagonal plaid</p>" +
    "<h3>Security</h3><p>Formulas are parsed by a safe math engine (tokenizer + recursive descent) — no eval() is ever used.</p>",

  characters:
    "<h2>Characters &amp; Colors</h2>" +
    "<h3>Character Set</h3>" +
    "<p>The pattern formula outputs a number for each cell. That number is mapped to a character from the character set string. Characters on the <strong>left</strong> side represent low values (quiet, sparse areas), characters on the <strong>right</strong> represent high values (active, dense areas).</p>" +
    "<p>The length of the string controls how many brightness levels you can see — more characters = smoother gradient.</p>" +
    "<h3>Color Palette</h3>" +
    "<p>Colors are mapped to the same index as characters — the first color goes with the first character, and so on. With a monochrome palette, brightness alone creates the gradient.</p>" +
    "<h3>Tips</h3>" +
    "<ul><li><strong>Similar hues</strong> (e.g. blues + purples) create a dreamy, cohesive feel</li>" +
    "<li><strong>Opposing hues</strong> (e.g. cyan + red) create electric, high-contrast visuals</li>" +
    "<li>Click any color chip to edit it, right-click to remove it, and use <strong>+</strong> to add more</li>" +
    "<li>Fewer colors = bolder bands; more colors = smoother gradients</li></ul>",

  export:
    "<h2>Exporting</h2>" +
    "<h3>HTML (Ctrl+E)</h3>" +
    "<p>Exports a standalone HTML file with a complete rendering engine built in — no dependencies needed. Open it in any browser and the animation runs exactly as you see it. Custom equation formulas are compiled into the file.</p>" +
    "<h3>GIF</h3>" +
    "<p>Captures several seconds of animation as an animated GIF. Good for sharing on platforms that support GIF but not interactive HTML. File sizes can be large for long or high-resolution captures.</p>" +
    "<h3>MP4</h3>" +
    "<p>Records the animation as an H.264 MP4 video using your browser's WebCodecs API. Much smaller file sizes than GIF with better quality. <em>Note: requires a browser that supports WebCodecs (Chrome, Edge). This option is hidden in unsupported browsers.</em></p>",

  shortcuts:
    "<h2>Keyboard Shortcuts</h2>" +
    "<ul><li><kbd>Ctrl+N</kbd> — New (reset to default)</li>" +
    "<li><kbd>Ctrl+E</kbd> — Export as HTML</li>" +
    "<li><kbd>Ctrl+R</kbd> — Randomize all settings</li>" +
    "<li><kbd>Ctrl+M</kbd> — Open Math Reference</li>" +
    "<li><kbd>Space</kbd> — Play / Pause animation</li>" +
    "<li><kbd>F1</kbd> — Open Help</li></ul>",

  equations:
    "<h2>Equation Reference</h2>" +
    '<p style="margin-bottom:8px"><img src="data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'10\' height=\'10\' viewBox=\'0 0 10 10\'%3E%3Cpolygon points=\'2,0 8,5 2,10\' fill=\'%23009\'/%3E%3C/svg%3E" style="vertical-align:middle;margin-right:3px" alt=""><a href="#" onclick="closeHelpWindow();showMathRef();return false" style="color:#00c;text-decoration:underline;font-size:12px">Open Math Reference</a> — interactive formulas you can click to try live (Ctrl+M)</p>' +
    "<h3>Variables</h3>" +
    '<table style="border-collapse:collapse;width:100%;font-size:12px">' +
    '<tr><td style="padding:2px 8px"><code>x</code>, <code>y</code></td><td>Raw pixel coordinates</td></tr>' +
    '<tr><td style="padding:2px 8px"><code>dx</code>, <code>dy</code></td><td>Centered coordinates (after transforms)</td></tr>' +
    '<tr><td style="padding:2px 8px"><code>r</code></td><td>Distance from center: √(dx² + dy²)</td></tr>' +
    '<tr><td style="padding:2px 8px"><code>theta</code></td><td>Angle from center: atan2(dy, dx)</td></tr>' +
    '<tr><td style="padding:2px 8px"><code>time</code>, <code>t</code></td><td>Animation clock</td></tr>' +
    '<tr><td style="padding:2px 8px"><code>w</code>, <code>h</code></td><td>Canvas size in characters</td></tr>' +
    '<tr><td style="padding:2px 8px"><code>xC</code>, <code>yC</code>, <code>fm</code>, <code>gV</code></td><td>Slider values</td></tr></table>' +
    "<h3>Trigonometry</h3>" +
    "<ul><li><code>sin(x)</code>, <code>cos(x)</code>, <code>tan(x)</code> — basic trig</li>" +
    "<li><code>asin(x)</code>, <code>acos(x)</code>, <code>atan(x)</code> — inverse trig</li>" +
    "<li><code>atan2(y, x)</code> — angle of a point from the origin</li></ul>" +
    "<h3>Math</h3>" +
    "<ul><li><code>abs(x)</code> — absolute value</li>" +
    "<li><code>sqrt(x)</code> — square root</li>" +
    "<li><code>pow(a, b)</code> — a raised to the power b</li>" +
    "<li><code>exp(x)</code> — e^x &nbsp; <code>log(x)</code> — natural log</li>" +
    "<li><code>floor(x)</code>, <code>ceil(x)</code>, <code>round(x)</code> — rounding</li>" +
    "<li><code>sign(x)</code> — returns −1, 0, or 1</li>" +
    "<li><code>min(a, b)</code>, <code>max(a, b)</code></li></ul>" +
    "<h3>Shader-Style</h3>" +
    "<ul><li><code>fract(x)</code> — fractional part: x − floor(x)</li>" +
    "<li><code>mod(a, b)</code> — remainder</li>" +
    "<li><code>clamp(x, lo, hi)</code> — constrain to range</li>" +
    "<li><code>mix(a, b, t)</code> — linear interpolation</li>" +
    "<li><code>step(edge, x)</code> — 0 if x &lt; edge, else 1</li>" +
    "<li><code>smoothstep(lo, hi, x)</code> — smooth 0→1 transition</li>" +
    "<li><code>noise(x, y)</code> — 2D value noise</li></ul>" +
    "<h3>Constants &amp; Operators</h3>" +
    "<p><code>PI</code> &nbsp; <code>TAU</code> (2π) &nbsp; <code>E</code> &nbsp; | &nbsp; <code>+</code> <code>-</code> <code>*</code> <code>/</code> <code>%</code> <code>()</code></p>",
};

function showHelpWindow() {
  document.getElementById("help-overlay").classList.add("show");
  document.getElementById("help-window").classList.add("show");
  if (!document.getElementById("help-content").innerHTML) {
    showHelpTopic("overview", document.querySelector(".xp-help-nav-item"));
  }
}
function closeHelpWindow() {
  document.getElementById("help-overlay").classList.remove("show");
  document.getElementById("help-window").classList.remove("show");
}

// ── Math Reference Window ──
function showMathRef() {
  document.getElementById("mathref-window").classList.add("show");
}
function closeMathRef() {
  document.getElementById("mathref-window").classList.remove("show");
}
function showHelpTopic(topic, navEl) {
  document.getElementById("help-content").innerHTML =
    helpTopics[topic] || "<p>Topic not found.</p>";
  document.querySelectorAll(".xp-help-nav-item").forEach(function (el) {
    el.classList.remove("active");
  });
  if (navEl) navEl.classList.add("active");
}

// Legacy alias
function showHelp() {
  showHelpWindow();
}

// ══════════════════════════════════════
//  SECTION EXPAND/COLLAPSE ALL
// ══════════════════════════════════════
function expandAllSections() {
  document.querySelectorAll(".section-head").forEach(function (h) {
    h.classList.remove("collapsed");
    var body = h.nextElementSibling;
    if (body) body.classList.remove("hide");
  });
}
function collapseAllSections() {
  document.querySelectorAll(".section-head").forEach(function (h) {
    h.classList.add("collapsed");
    var body = h.nextElementSibling;
    if (body) body.classList.add("hide");
  });
}

// ══════════════════════════════════════
//  NEW PRESET (reset)
// ══════════════════════════════════════
function newPreset() {
  if (typeof PRESETS !== "undefined" && PRESETS.length > 0) {
    loadPreset(0);
  }
}

// ══════════════════════════════════════
//  KEYBOARD SHORTCUTS
// ══════════════════════════════════════
document.addEventListener("keydown", function (e) {
  // Don't intercept when typing in inputs
  var tag = (e.target.tagName || "").toLowerCase();
  if (tag === "input" || tag === "textarea" || tag === "select") return;

  if (e.key === "F1") {
    e.preventDefault();
    showHelpWindow();
  }
  if (e.code === "Space") {
    e.preventDefault();
    togglePlay();
  }
  if (e.ctrlKey || e.metaKey) {
    if (e.key === "n" || e.key === "N") {
      e.preventDefault();
      newPreset();
    }
    if (e.key === "e" || e.key === "E") {
      e.preventDefault();
      exportHTML();
    }
    if (e.key === "r" || e.key === "R") {
      e.preventDefault();
      randomize();
    }
    if (e.key === "m" || e.key === "M") {
      e.preventDefault();
      showMathRef();
    }
  }
});

// ══════════════════════════════════════
//  CLOCK & INIT
// ══════════════════════════════════════
function updateClock() {
  var el = document.getElementById("clock");
  if (!el) return;
  var d = new Date();
  el.textContent =
    d.getHours().toString().padStart(2, "0") +
    ":" +
    d.getMinutes().toString().padStart(2, "0");
}

// ══════════════════════════════════════
//  EMBEDDED MODE (inside desktop iframe)
// ══════════════════════════════════════
var isEmbedded =
  window.location.search.indexOf("embedded=1") !== -1 ||
  window !== window.parent;

if (isEmbedded) {
  document.body.classList.add("embedded");
}

// Titlebar button handlers
document.addEventListener("click", function (e) {
  var btn = e.target;
  if (btn.classList.contains("btn-close")) {
    if (isEmbedded) {
      window.parent.postMessage("studio-close", "*");
    } else {
      window.location.href = "desktop/";
    }
  }
  if (btn.classList.contains("btn-min")) {
    if (isEmbedded) {
      window.parent.postMessage("studio-minimize", "*");
    }
  }
  if (btn.classList.contains("btn-max")) {
    if (isEmbedded) {
      window.parent.postMessage("studio-maximize", "*");
    }
  }
});

// ══════════════════════════════════════
//  CUSTOM TOOLTIPS (XP-style yellow box)
// ══════════════════════════════════════
var _tooltipEl = null;
var _tooltipTimer = null;

function showTooltip(target) {
  var text = target.getAttribute("data-tip");
  if (!text) return;
  hideTooltip();
  _tooltipEl = document.createElement("div");
  _tooltipEl.className = "xp-tooltip";
  _tooltipEl.textContent = text;
  document.body.appendChild(_tooltipEl);
  var r = target.getBoundingClientRect();
  var tx = r.left;
  var ty = r.bottom + 4;
  // Keep on screen
  if (tx + _tooltipEl.offsetWidth > window.innerWidth - 8) {
    tx = window.innerWidth - _tooltipEl.offsetWidth - 8;
  }
  if (ty + _tooltipEl.offsetHeight > window.innerHeight - 8) {
    ty = r.top - _tooltipEl.offsetHeight - 4;
  }
  _tooltipEl.style.left = Math.max(4, tx) + "px";
  _tooltipEl.style.top = ty + "px";
}

function hideTooltip() {
  clearTimeout(_tooltipTimer);
  if (_tooltipEl) {
    _tooltipEl.remove();
    _tooltipEl = null;
  }
}

// Convert title → data-tip on all .help-tip elements (title attrs show unreliably)
function initTooltips() {
  document.querySelectorAll(".help-tip[title]").forEach(function (el) {
    el.setAttribute("data-tip", el.getAttribute("title"));
    el.removeAttribute("title");
  });
}

document.addEventListener(
  "mouseenter",
  function (e) {
    if (e.target.classList && e.target.classList.contains("help-tip")) {
      _tooltipTimer = setTimeout(function () {
        showTooltip(e.target);
      }, 350);
    }
  },
  true,
);
document.addEventListener(
  "mouseleave",
  function (e) {
    if (e.target.classList && e.target.classList.contains("help-tip")) {
      hideTooltip();
    }
  },
  true,
);

window.addEventListener("load", function () {
  initTooltips();
  buildPresets();
  configToUI();
  setupCanvas();
  render();
  lastTick = performance.now();
  rafId = requestAnimationFrame(animLoop);
  if (!isEmbedded) {
    updateClock();
    setInterval(updateClock, 30000);
  }
  // Show MP4 export option if WebCodecs is available
  if (typeof VideoEncoder !== "undefined") {
    var mp4Item = document.getElementById("menu-export-mp4");
    if (mp4Item) mp4Item.style.display = "";
  }
});

window.addEventListener("resize", function () {
  setupCanvas();
  if (!playing) render();
});
