/* ════════════════════════════════════════
   ASCII STUDIO — Engine & UI
   ════════════════════════════════════════ */

var TICK_MS = 33,
  SPEED_SCALE = 0.03,
  LINE_HEIGHT = 1.15,
  TWO_PI = Math.PI * 2;

// ══════════════════════════════════════
//  UNDO / REDO
// ══════════════════════════════════════
var _undoStack = [];
var _redoStack = [];
var _MAX_UNDO = 80;
var _undoPaused = false; // suppress snapshots during undo/redo restore

function _restoreSceneParams(params) {
  if (!params || !_activeScene) return;
  var scene = SCENES[_activeScene];
  if (!scene) return;
  for (var i = 0; i < scene.params.length; i++) {
    var key = scene.params[i].key;
    if (params[key] !== undefined) {
      var el = document.getElementById("scene-p-" + key);
      if (el) {
        el.value = params[key];
        syncSlider(el);
      }
    }
  }
}

function _snapshotState() {
  var sp = null;
  if (_activeScene && SCENES[_activeScene]) {
    sp = _getSceneParams(_activeScene);
  }
  return JSON.stringify({
    config: config,
    scene: _activeScene || null,
    sceneParams: sp,
    artSceneBlend: _artSceneBlend,
    artSceneAmount: _artSceneAmount,
  });
}

function pushUndo() {
  if (_undoPaused) return;
  var snap = _snapshotState();
  // Don't push if identical to current top
  if (_undoStack.length && _undoStack[_undoStack.length - 1] === snap) return;
  _undoStack.push(snap);
  if (_undoStack.length > _MAX_UNDO) _undoStack.shift();
  _redoStack.length = 0; // clear redo on new action
}

function undo() {
  if (!_undoStack.length) return;
  // Save current state for redo
  _redoStack.push(_snapshotState());
  var prev = JSON.parse(_undoStack.pop());
  _undoPaused = true;
  // Handle both old format (plain config) and new format ({config, scene})
  if (
    prev.config &&
    typeof prev.config === "object" &&
    !Array.isArray(prev.config)
  ) {
    config = prev.config;
    var prevScene = prev.scene || null;
    if (prevScene !== _activeScene) {
      if (prevScene) {
        activateScene(prevScene);
      } else {
        deactivateScene();
      }
    }
    if (prev.sceneParams && _activeScene) {
      _restoreSceneParams(prev.sceneParams);
    }
    if (prev.artSceneBlend !== undefined) _artSceneBlend = prev.artSceneBlend;
    if (prev.artSceneAmount !== undefined) _artSceneAmount = prev.artSceneAmount;
  } else {
    config = prev;
    deactivateScene();
  }
  configToUI();
  if (!playing) render();
  _undoPaused = false;
}

function redo() {
  if (!_redoStack.length) return;
  // Save current state for undo
  _undoStack.push(_snapshotState());
  var next = JSON.parse(_redoStack.pop());
  _undoPaused = true;
  if (
    next.config &&
    typeof next.config === "object" &&
    !Array.isArray(next.config)
  ) {
    config = next.config;
    var nextScene = next.scene || null;
    if (nextScene !== _activeScene) {
      if (nextScene) {
        activateScene(nextScene);
      } else {
        deactivateScene();
      }
    }
    if (next.sceneParams && _activeScene) {
      _restoreSceneParams(next.sceneParams);
    }
    if (next.artSceneBlend !== undefined) _artSceneBlend = next.artSceneBlend;
    if (next.artSceneAmount !== undefined) _artSceneAmount = next.artSceneAmount;
  } else {
    config = next;
    deactivateScene();
  }
  configToUI();
  if (!playing) render();
  _undoPaused = false;
}

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
// Pre-allocated env objects to avoid per-cell allocation
var _exprEnvA = {
  x: 0,
  y: 0,
  dx: 0,
  dy: 0,
  r: 0,
  theta: 0,
  time: 0,
  t: 0,
  w: 0,
  h: 0,
  xC: 0,
  yC: 0,
  fm: 0,
  gV: 0,
};
var _exprEnvB = {
  x: 0,
  y: 0,
  dx: 0,
  dy: 0,
  r: 0,
  theta: 0,
  time: 0,
  t: 0,
  w: 0,
  h: 0,
  xC: 0,
  yC: 0,
  fm: 0,
  gV: 0,
};

function evalCustomExpr(src, mx, my, fw, fh, c) {
  // Cache compiled function
  if (src !== _customSrcA) {
    _customSrcA = src;
    _customFnA = compileExpr(src);
  }
  if (!_customFnA) return 0;
  var dx = mx - fw * 0.5,
    dy = my - fh * 0.5;
  var e = _exprEnvA;
  e.x = mx;
  e.y = my;
  e.dx = dx;
  e.dy = dy;
  e.r = Math.sqrt(dx * dx + dy * dy) + 0.01;
  e.theta = Math.atan2(dy, dx);
  e.time = time;
  e.t = time;
  e.w = fw;
  e.h = fh;
  e.xC = c.xConstant;
  e.yC = c.yConstant;
  e.fm = c.frameMultiplier;
  e.gV = c.globalVal;
  return _customFnA(e);
}

function evalCustomExprB(src, mx, my, fw, fh, c) {
  if (src !== _customSrcB) {
    _customSrcB = src;
    _customFnB = compileExpr(src);
  }
  if (!_customFnB) return 0;
  var dx = mx - fw * 0.5,
    dy = my - fh * 0.5;
  var e = _exprEnvB;
  e.x = mx;
  e.y = my;
  e.dx = dx;
  e.dy = dy;
  e.r = Math.sqrt(dx * dx + dy * dy) + 0.01;
  e.theta = Math.atan2(dy, dx);
  e.time = time;
  e.t = time;
  e.w = fw;
  e.h = fh;
  e.xC = c.xConstant;
  e.yC = c.yConstant;
  e.fm = c.frameMultiplier;
  e.gV = c.globalVal;
  return _customFnB(e);
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
//  ASCII ART IMPORT — value map from .txt
// ══════════════════════════════════════
var _artGrid = null; // 2D float array [row][col], or null
var _artW = 0,
  _artH = 0;
var _artFileName = "";

// Character → visual density (0–1). Heavier glyphs = higher value.
var CHAR_DENSITY = (function () {
  var map = {};
  var ramp = " .`'\"^,:;!i|/\\~-_+<>?][}{)(#*0OQ%&@$█▓▒░";
  for (var i = 0; i < ramp.length; i++) map[ramp[i]] = i / (ramp.length - 1);
  return map;
})();

function charToDensity(ch) {
  if (ch in CHAR_DENSITY) return CHAR_DENSITY[ch];
  // Fallback: printable chars ≈ 0.5, space/control = 0
  if (ch.charCodeAt(0) <= 32) return 0;
  return 0.5;
}

function parseAsciiArt(text) {
  var lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  // Remove trailing empty lines
  while (lines.length && lines[lines.length - 1].trim() === "") lines.pop();
  if (!lines.length) return null;
  var maxW = 0;
  for (var i = 0; i < lines.length; i++)
    if (lines[i].length > maxW) maxW = lines[i].length;
  // Convert to float grid (density values mapped to [-1, +1] range for computeValue)
  var grid = [];
  for (var r = 0; r < lines.length; r++) {
    var row = new Float32Array(maxW);
    for (var c = 0; c < maxW; c++) {
      var ch = c < lines[r].length ? lines[r][c] : " ";
      row[c] = charToDensity(ch) * 2 - 1; // map 0..1 → -1..+1
    }
    grid.push(row);
  }
  return { grid: grid, w: maxW, h: lines.length };
}

function loadAsciiArt(text, fileName) {
  var result = parseAsciiArt(text);
  if (!result || !result.h) {
    _artGrid = null;
    _artW = 0;
    _artH = 0;
    _artFileName = "";
    return false;
  }
  _artGrid = result.grid;
  _artW = result.w;
  _artH = result.h;
  _artFileName = fileName || "upload.txt";
  return true;
}

function sampleArtGrid(mx, my, fw, fh) {
  // Contain: scale art to fit inside canvas, preserve aspect ratio, center it
  var artAspect = _artW / _artH;
  var canAspect = fw / fh;
  var scale, offX, offY;
  if (artAspect > canAspect) {
    // Art is wider — fit to width
    scale = fw / _artW;
    offX = 0;
    offY = (fh - _artH * scale) * 0.5;
  } else {
    // Art is taller — fit to height
    scale = fh / _artH;
    offX = (fw - _artW * scale) * 0.5;
    offY = 0;
  }
  var ax = (mx - offX) / scale;
  var ay = (my - offY) / scale;
  // Outside the art bounds → empty (value 0)
  if (ax < 0 || ay < 0 || ax >= _artW || ay >= _artH) return -1;
  var ix = ax | 0;
  var iy = ay | 0;
  if (ix >= _artW) ix = _artW - 1;
  if (iy >= _artH) iy = _artH - 1;
  return _artGrid[iy][ix];
}

// ══════════════════════════════════════
//  SCENES — simulation-based animations
//  Each scene produces a per-cell value grid each frame.
//  The existing render pipeline maps values → chars → colours.
// ══════════════════════════════════════
var _activeScene = null; // string key, e.g. "cellDivision", or null
var _sceneGrid = null; // Float32Array[rows * cols]
var _sceneW = 0;
var _sceneH = 0;
var _sceneState = {}; // per-scene persistent state
var _sceneLastTs = 0; // last update timestamp (ms) for real dt
var _sceneParamsCache = {}; // cached scene param values (updated on slider input)
var _artSceneBlend = "mask"; // how art + scene combine: "mask", "add", "multiply", "screen"
var _artSceneAmount = 1.0; // blend strength 0–1

// Scene registry: each scene defines:
//   label       — display name
//   params      — array of { key, label, min, max, step, default, tip }
//   init(w,h,p) — called on activate or resize, sets up _sceneState
//   update(dt,w,h,p,grid) — called each frame, writes into grid[y*w+x]
var SCENES = {};

// ── Helper: deterministic pseudo-random ──
function _sfrand(n) {
  var s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

// ── Helper: 2D noise for scenes ──
function _snoise(x, y) {
  var ix = Math.floor(x),
    iy = Math.floor(y);
  var fx = x - ix,
    fy = y - iy;
  var a = _sfrand(ix + iy * 57.0);
  var b = _sfrand(ix + 1 + iy * 57.0);
  var c = _sfrand(ix + (iy + 1) * 57.0);
  var d = _sfrand(ix + 1 + (iy + 1) * 57.0);
  var ux = fx * fx * (3 - 2 * fx);
  var uy = fy * fy * (3 - 2 * fy);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

// ─────────────────────────────────────
//  SCENE: Cell Division (Mitosis)
// ─────────────────────────────────────
SCENES.cellDivision = {
  label: "Cell Division",
  params: [
    {
      key: "splitSpeed",
      label: "Split Speed",
      min: 0.1,
      max: 2,
      step: 0.05,
      default: 0.4,
      tip: "How fast cells divide",
    },
    {
      key: "cellSize",
      label: "Cell Size",
      min: 5,
      max: 30,
      step: 1,
      default: 15,
      tip: "Radius of each cell blob",
    },
    {
      key: "drift",
      label: "Drift",
      min: 0,
      max: 3,
      step: 0.1,
      default: 0.8,
      tip: "How much cells wobble around",
    },
    {
      key: "maxGens",
      label: "Max Generations",
      min: 2,
      max: 7,
      step: 1,
      default: 5,
      tip: "How many times cells split (2^n total cells)",
    },
  ],
  init: function (w, h, p) {
    _sceneState = { clock: 0 };
  },
  update: function (dt, w, h, p, grid) {
    _sceneState.clock = (_sceneState.clock || 0) + dt;
    var sceneTime = _sceneState.clock;
    var phase = sceneTime * p.splitSpeed;
    var maxGen = p.maxGens;
    var cycleLen = maxGen + 1;
    var cp = phase % cycleLen;
    var gen = Math.min(Math.floor(cp), maxGen);
    var t = cp - gen;

    var globalOpacity = 1;
    if (gen === maxGen && t > 0.5) {
      globalOpacity = 1 - (t - 0.5) * 2;
    }

    var cx = w / 2,
      cy = h / 2;

    // Reusable position output to avoid array allocation per call
    var _posOut = [0, 0];
    function pos(idx, g, scT, dr) {
      var px = cx,
        py = cy;
      for (var lvl = 0; lvl < g; lvl++) {
        var bit = (idx >> (g - 1 - lvl)) & 1;
        var dir = bit * 2 - 1;
        var a = _sfrand(lvl * 137.3 + 7.1) * 6.2832;
        var spread = 5 + lvl * 2.0 + _sfrand(lvl * 43.7 + 13.3) * 2;
        px += dir * Math.cos(a) * spread;
        py += dir * Math.sin(a) * spread * 0.55;
      }
      px += Math.sin(scT * 0.7 + idx * 1.7) * dr;
      py += Math.cos(scT * 0.7 + idx * 2.3) * dr * 0.5;
      _posOut[0] = px;
      _posOut[1] = py;
    }

    var count = 1 << gen;
    var ease = t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) * (-2 * t + 2)) / 2;
    // Flat arrays for cell data: x, y, opacity
    var cellX = new Float64Array(count);
    var cellY = new Float64Array(count);
    var cellO = new Float64Array(count);
    for (var i = 0; i < count; i++) {
      pos(i, gen, sceneTime, p.drift);
      var fx = _posOut[0],
        fy = _posOut[1];
      var opacity = globalOpacity;
      if (gen === 0 && cp < 1) {
        opacity = Math.min(cp * 1.5, 1) * globalOpacity;
        cellX[i] = cx;
        cellY[i] = cy;
        cellO[i] = opacity;
      } else {
        if (gen > 0) {
          pos(i >> 1, gen - 1, sceneTime, p.drift);
        } else {
          _posOut[0] = cx;
          _posOut[1] = cy;
        }
        cellX[i] = _posOut[0] + (fx - _posOut[0]) * ease;
        cellY[i] = _posOut[1] + (fy - _posOut[1]) * ease;
        cellO[i] = opacity;
      }
    }

    var sz = p.cellSize;
    var falloff = 0.12 / (sz / 15);
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        var field = 0;
        var hash = _sfrand(x * 0.731 + y * 3.117 + 0.5);
        var star = hash > 0.992 ? 0.5 : 0;
        for (var ci = 0; ci < count; ci++) {
          var ddx = x - cellX[ci];
          var ddy = (y - cellY[ci]) * 1.8;
          var d2 = ddx * ddx + ddy * ddy;
          field += (cellO[ci] * sz * 1.2) / (1 + d2 * falloff);
        }
        grid[y * w + x] = Math.min(field, 4) - 2 + star;
      }
    }
  },
};

// ─────────────────────────────────────
//  SCENE: Particle Rain
// ─────────────────────────────────────
SCENES.particleRain = {
  label: "Particle Rain",
  params: [
    {
      key: "density",
      label: "Density",
      min: 0.005,
      max: 0.15,
      step: 0.005,
      default: 0.04,
      tip: "How many particles",
    },
    {
      key: "speed",
      label: "Fall Speed",
      min: 0.5,
      max: 8,
      step: 0.5,
      default: 3,
      tip: "How fast particles fall",
    },
    {
      key: "wind",
      label: "Wind",
      min: -3,
      max: 3,
      step: 0.1,
      default: 0.5,
      tip: "Horizontal drift",
    },
    {
      key: "trail",
      label: "Trail Length",
      min: 1,
      max: 8,
      step: 1,
      default: 3,
      tip: "Vertical smear behind each particle",
    },
  ],
  init: function (w, h, p) {
    // Seed particles
    var count = Math.max(10, Math.floor(w * h * p.density));
    var pts = [];
    for (var i = 0; i < count; i++) {
      pts.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.5,
        vy: 0.5 + Math.random() * 1.5,
        bright: 0.5 + Math.random() * 1.5,
      });
    }
    _sceneState.particles = pts;
    _sceneState.lastW = w;
    _sceneState.lastH = h;
  },
  update: function (dt, w, h, p, grid) {
    var pts = _sceneState.particles;
    if (!pts || _sceneState.lastW !== w || _sceneState.lastH !== h) {
      this.init(w, h, p);
      pts = _sceneState.particles;
    }
    // Adjust particle count dynamically
    var target = Math.max(10, Math.floor(w * h * p.density));
    while (pts.length < target) {
      pts.push({
        x: Math.random() * w,
        y: 0,
        vx: (Math.random() - 0.5) * 0.5,
        vy: 0.5 + Math.random() * 1.5,
        bright: 0.5 + Math.random() * 1.5,
      });
    }
    while (pts.length > target) pts.pop();

    // Clear grid
    for (var i = 0; i < w * h; i++) grid[i] = -2;

    // Update & draw
    for (var i = 0; i < pts.length; i++) {
      var pt = pts[i];
      pt.x += (pt.vx + p.wind * 0.3) * dt;
      pt.y += pt.vy * p.speed * dt;
      // Wrap
      if (pt.y >= h) {
        pt.y -= h;
        pt.x = Math.random() * w;
      }
      if (pt.x < 0) pt.x += w;
      if (pt.x >= w) pt.x -= w;

      var ix = Math.floor(pt.x);
      var iy = Math.floor(pt.y);
      for (var t = 0; t < p.trail; t++) {
        var ty = iy - t;
        if (ty < 0) ty += h;
        if (ix >= 0 && ix < w && ty >= 0 && ty < h) {
          var fade = pt.bright * (1 - t / p.trail);
          var idx = ty * w + ix;
          if (grid[idx] < fade) grid[idx] = fade;
        }
      }
    }
  },
};

// ─────────────────────────────────────
//  SCENE: Crystal Growth
// ─────────────────────────────────────
SCENES.crystalGrowth = {
  label: "Crystal Growth",
  params: [
    {
      key: "branchRate",
      label: "Branch Rate",
      min: 0.01,
      max: 0.25,
      step: 0.01,
      default: 0.08,
      tip: "Chance of new branches per step",
    },
    {
      key: "growSpeed",
      label: "Grow Speed",
      min: 0.5,
      max: 5,
      step: 0.5,
      default: 2,
      tip: "How fast the crystal expands",
    },
    {
      key: "arms",
      label: "Symmetry Arms",
      min: 2,
      max: 12,
      step: 1,
      default: 6,
      tip: "Number of symmetric branches",
    },
    {
      key: "decay",
      label: "Decay",
      min: 0,
      max: 0.05,
      step: 0.005,
      default: 0.01,
      tip: "Fade out old growth",
    },
  ],
  init: function (w, h, p) {
    var buf = new Float32Array(w * h);
    _sceneState = {
      grown: buf,
      tips: [
        { x: Math.floor(w / 2), y: Math.floor(h / 2), dx: 0, dy: -1, age: 0 },
      ],
      stepAccum: 0,
      phase: 0,
      lastW: w,
      lastH: h,
    };
  },
  update: function (dt, w, h, p, grid) {
    if (
      !_sceneState.grown ||
      _sceneState.lastW !== w ||
      _sceneState.lastH !== h
    ) {
      this.init(w, h, p);
    }
    var st = _sceneState;
    st.stepAccum += dt * p.growSpeed;
    st.phase += dt * 0.02;

    // Reset cycle
    var totalCells = 0;
    for (var i = 0; i < w * h; i++) if (st.grown[i] > 0.1) totalCells++;
    if (totalCells > w * h * 0.4 || st.tips.length === 0) {
      // Fade out then restart
      st.phase += 0.1;
      var allDead = true;
      for (var i = 0; i < w * h; i++) {
        st.grown[i] *= 0.92;
        if (st.grown[i] > 0.05) allDead = false;
      }
      if (allDead || totalCells > w * h * 0.6) {
        this.init(w, h, p);
        return;
      }
    }

    // Grow steps
    var steps = Math.floor(st.stepAccum);
    st.stepAccum -= steps;
    var arms = Math.max(2, Math.round(p.arms));
    var sector = 6.2832 / arms;

    for (var s = 0; s < steps && st.tips.length > 0; s++) {
      var newTips = [];
      for (var i = 0; i < st.tips.length && i < 500; i++) {
        var tip = st.tips[i];
        // Apply symmetry — replicate tip across arms
        for (var arm = 0; arm < arms; arm++) {
          var angle = arm * sector;
          var cos = Math.cos(angle),
            sin = Math.sin(angle);
          // Rotate tip position relative to center
          var rx = tip.x - w / 2,
            ry = tip.y - h / 2;
          var sx = Math.round(rx * cos - ry * sin + w / 2);
          var sy = Math.round(rx * sin + ry * cos + h / 2);
          if (sx >= 0 && sx < w && sy >= 0 && sy < h) {
            var val = 2 - tip.age * 0.02;
            if (val < 0.3) val = 0.3;
            st.grown[sy * w + sx] = Math.max(st.grown[sy * w + sx], val);
          }
        }
        // Advance tip
        var nx = tip.x + tip.dx;
        var ny = tip.y + tip.dy;
        if (nx >= 1 && nx < w - 1 && ny >= 1 && ny < h - 1) {
          tip.x = nx;
          tip.y = ny;
          tip.age++;
          // Slight random turn
          if (Math.random() < 0.3) {
            var a = Math.atan2(tip.dy, tip.dx) + (Math.random() - 0.5) * 1.2;
            tip.dx = Math.round(Math.cos(a));
            tip.dy = Math.round(Math.sin(a));
          }
          newTips.push(tip);
          // Branch?
          if (
            Math.random() < p.branchRate &&
            st.tips.length + newTips.length < 500
          ) {
            var ba =
              Math.atan2(tip.dy, tip.dx) +
              (Math.random() > 0.5 ? 1 : -1) * (0.8 + Math.random() * 0.8);
            newTips.push({
              x: tip.x,
              y: tip.y,
              dx: Math.round(Math.cos(ba)),
              dy: Math.round(Math.sin(ba)),
              age: tip.age,
            });
          }
        }
      }
      st.tips = newTips;
    }

    // Decay old growth
    if (p.decay > 0) {
      for (var i = 0; i < w * h; i++) st.grown[i] *= 1 - p.decay;
    }

    // Copy to output grid
    for (var i = 0; i < w * h; i++) {
      grid[i] = st.grown[i] > 0.01 ? st.grown[i] * 2 - 1 : -2;
    }
  },
};

// ─────────────────────────────────────
//  SCENE: Game of Life
// ─────────────────────────────────────
SCENES.gameOfLife = {
  label: "Game of Life",
  params: [
    {
      key: "seedDensity",
      label: "Seed Density",
      min: 0.05,
      max: 0.6,
      step: 0.05,
      default: 0.25,
      tip: "Initial fill percentage",
    },
    {
      key: "tickSpeed",
      label: "Tick Speed",
      min: 0.5,
      max: 10,
      step: 0.5,
      default: 3,
      tip: "Generations per second",
    },
    {
      key: "trailFade",
      label: "Trail Fade",
      min: 0,
      max: 0.95,
      step: 0.05,
      default: 0.7,
      tip: "Ghost trails from dead cells",
    },
    {
      key: "wrap",
      label: "Wrap Edges",
      min: 0,
      max: 1,
      step: 1,
      default: 1,
      tip: "1 = wrap around edges, 0 = dead border",
    },
  ],
  init: function (w, h, p) {
    var cells = new Uint8Array(w * h);
    for (var i = 0; i < w * h; i++)
      cells[i] = Math.random() < p.seedDensity ? 1 : 0;
    _sceneState = {
      cells: cells,
      nextBuf: new Uint8Array(w * h),
      trail: new Float32Array(w * h),
      tickAccum: 0,
      generation: 0,
      staleCount: 0,
      lastPop: 0,
      lastW: w,
      lastH: h,
    };
  },
  update: function (dt, w, h, p, grid) {
    if (
      !_sceneState.cells ||
      _sceneState.lastW !== w ||
      _sceneState.lastH !== h
    ) {
      this.init(w, h, p);
    }
    var st = _sceneState;
    st.tickAccum += dt * p.tickSpeed;
    var doWrap = p.wrap >= 0.5;

    while (st.tickAccum >= 1) {
      st.tickAccum -= 1;
      st.generation++;
      var next = st.nextBuf;
      next.fill(0);
      var pop = 0;
      for (var y = 0; y < h; y++) {
        for (var x = 0; x < w; x++) {
          var n = 0;
          for (var dy = -1; dy <= 1; dy++) {
            for (var dx = -1; dx <= 1; dx++) {
              if (dx === 0 && dy === 0) continue;
              var nx, ny;
              if (doWrap) {
                nx = (x + dx + w) % w;
                ny = (y + dy + h) % h;
              } else {
                nx = x + dx;
                ny = y + dy;
                if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
              }
              n += st.cells[ny * w + nx];
            }
          }
          var alive = st.cells[y * w + x];
          if (alive) {
            next[y * w + x] = n === 2 || n === 3 ? 1 : 0;
          } else {
            next[y * w + x] = n === 3 ? 1 : 0;
          }
          pop += next[y * w + x];
        }
      }
      // Detect stale state — reseed if stuck
      if (Math.abs(pop - st.lastPop) < 3) {
        st.staleCount++;
      } else {
        st.staleCount = 0;
      }
      st.lastPop = pop;
      if (st.staleCount > 30 || pop < 5) {
        this.init(w, h, p);
        return;
      }
      // Update trails
      for (var i = 0; i < w * h; i++) {
        if (st.cells[i] && !next[i]) {
          st.trail[i] = 1; // just died
        } else {
          st.trail[i] *= p.trailFade;
        }
      }
      var prev = st.cells;
      st.cells = next;
      st.nextBuf = prev;
    }

    // Write to grid
    for (var i = 0; i < w * h; i++) {
      if (st.cells[i]) {
        grid[i] = 2; // alive = bright
      } else if (st.trail[i] > 0.05) {
        grid[i] = st.trail[i] * 1.5 - 1; // ghost
      } else {
        grid[i] = -2; // dead = darkest char
      }
    }
  },
};

// ─────────────────────────────────────
//  SCENE: Ripples
// ─────────────────────────────────────
SCENES.ripples = {
  label: "Ripples",
  params: [
    {
      key: "frequency",
      label: "Drop Rate",
      min: 0.3,
      max: 5,
      step: 0.1,
      default: 1.5,
      tip: "How often new ripples spawn",
    },
    {
      key: "waveSpeed",
      label: "Wave Speed",
      min: 2,
      max: 20,
      step: 1,
      default: 8,
      tip: "How fast rings expand",
    },
    {
      key: "decay",
      label: "Decay",
      min: 0.5,
      max: 5,
      step: 0.1,
      default: 2,
      tip: "How quickly ripples fade",
    },
    {
      key: "ringWidth",
      label: "Ring Width",
      min: 0.5,
      max: 5,
      step: 0.5,
      default: 2,
      tip: "Thickness of each ring",
    },
  ],
  init: function (w, h, p) {
    _sceneState = { drops: [], dropAccum: 0, clock: 0, lastW: w, lastH: h };
  },
  update: function (dt, w, h, p, grid) {
    if (
      !_sceneState.drops ||
      _sceneState.lastW !== w ||
      _sceneState.lastH !== h
    ) {
      this.init(w, h, p);
    }
    var st = _sceneState;
    st.clock = (st.clock || 0) + dt;
    st.dropAccum += dt * p.frequency;

    // Spawn new drops
    while (st.dropAccum >= 1) {
      st.dropAccum -= 1;
      st.drops.push({
        x: Math.random() * w,
        y: Math.random() * h,
        birth: st.clock,
        amp: 0.8 + Math.random() * 1.2,
      });
    }

    // Remove dead drops
    var alive = [];
    for (var i = 0; i < st.drops.length; i++) {
      var age = st.clock - st.drops[i].birth;
      if (age < 12 / p.decay) alive.push(st.drops[i]);
    }
    st.drops = alive;

    // Render — precompute per-drop constants
    var drops = st.drops;
    var nDrops = drops.length;
    var dropAge = new Float64Array(nDrops);
    var dropRadius = new Float64Array(nDrops);
    var dropEnv = new Float64Array(nDrops);
    var dropX = new Float64Array(nDrops);
    var dropY = new Float64Array(nDrops);
    var invRW = 1 / p.ringWidth;
    for (var i = 0; i < nDrops; i++) {
      var d = drops[i];
      var a = st.clock - d.birth;
      dropAge[i] = a;
      dropRadius[i] = a * p.waveSpeed;
      dropEnv[i] = d.amp * Math.exp(-a * p.decay * 0.3);
      dropX[i] = d.x;
      dropY[i] = d.y;
    }
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        var val = 0;
        for (var i = 0; i < nDrops; i++) {
          var ddx = x - dropX[i];
          var ddy = (y - dropY[i]) * 1.8;
          var dist = Math.sqrt(ddx * ddx + ddy * ddy);
          var q = (dist - dropRadius[i]) * invRW;
          var ring = Math.exp(-q * q);
          val += ring * dropEnv[i] * Math.cos(dist * 0.8 - dropAge[i] * 4);
        }
        grid[y * w + x] = val * 3;
      }
    }
  },
};

// ─────────────────────────────────────
//  SCENE: Flocking
// ─────────────────────────────────────
SCENES.flocking = {
  label: "Flocking",
  params: [
    {
      key: "count",
      label: "Boid Count",
      min: 20,
      max: 300,
      step: 10,
      default: 100,
      tip: "Number of boids",
    },
    {
      key: "cohesion",
      label: "Cohesion",
      min: 0,
      max: 0.05,
      step: 0.002,
      default: 0.01,
      tip: "Pull toward flock center",
    },
    {
      key: "separation",
      label: "Separation",
      min: 0.5,
      max: 5,
      step: 0.5,
      default: 2,
      tip: "Push away when too close",
    },
    {
      key: "speed",
      label: "Speed",
      min: 1,
      max: 10,
      step: 0.5,
      default: 4,
      tip: "Maximum speed",
    },
  ],
  init: function (w, h, p) {
    var boids = [];
    for (var i = 0; i < p.count; i++) {
      boids.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 2,
        vy: (Math.random() - 0.5) * 2,
      });
    }
    _sceneState = { boids: boids, lastW: w, lastH: h };
  },
  update: function (dt, w, h, p, grid) {
    if (
      !_sceneState.boids ||
      _sceneState.lastW !== w ||
      _sceneState.lastH !== h
    ) {
      this.init(w, h, p);
    }
    var boids = _sceneState.boids;
    // Adjust count
    while (boids.length < p.count) {
      boids.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 2,
        vy: (Math.random() - 0.5) * 2,
      });
    }
    while (boids.length > p.count) boids.pop();

    // Clear
    for (var i = 0; i < w * h; i++) grid[i] = -2;

    // Compute center of mass
    var cx = 0,
      cy = 0;
    for (var i = 0; i < boids.length; i++) {
      cx += boids[i].x;
      cy += boids[i].y;
    }
    cx /= boids.length;
    cy /= boids.length;

    var maxSpd = p.speed;

    for (var i = 0; i < boids.length; i++) {
      var b = boids[i];
      // Cohesion — steer toward center
      b.vx += (cx - b.x) * p.cohesion;
      b.vy += (cy - b.y) * p.cohesion;
      // Separation — push away from close neighbours
      for (var j = 0; j < boids.length; j++) {
        if (i === j) continue;
        var ddx = b.x - boids[j].x;
        var ddy = b.y - boids[j].y;
        var d2 = ddx * ddx + ddy * ddy;
        if (d2 < p.separation * p.separation * 4 && d2 > 0.01) {
          var f = p.separation / d2;
          b.vx += ddx * f * 0.1;
          b.vy += ddy * f * 0.1;
        }
      }
      // Alignment — average velocity (simplified: toward global motion)
      // Speed limit
      var spd = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
      if (spd > maxSpd) {
        b.vx = (b.vx / spd) * maxSpd;
        b.vy = (b.vy / spd) * maxSpd;
      }
      // Move
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      // Wrap
      if (b.x < 0) b.x += w;
      if (b.x >= w) b.x -= w;
      if (b.y < 0) b.y += h;
      if (b.y >= h) b.y -= h;

      // Draw with small glow
      var ix = Math.floor(b.x),
        iy = Math.floor(b.y);
      for (var dy = -1; dy <= 1; dy++) {
        for (var dx = -1; dx <= 1; dx++) {
          var px = ix + dx,
            py = iy + dy;
          if (px >= 0 && px < w && py >= 0 && py < h) {
            var dist = Math.abs(dx) + Math.abs(dy);
            var val = dist === 0 ? 2 : dist === 1 ? 0.5 : -0.5;
            var gi = py * w + px;
            if (grid[gi] < val) grid[gi] = val;
          }
        }
      }
    }
  },
};

// ─────────────────────────────────────
//  SCENE: Wave Propagation
// ─────────────────────────────────────
SCENES.wavePropagation = {
  label: "Wave Propagation",
  params: [
    {
      key: "damping",
      label: "Damping",
      min: 0.9,
      max: 0.999,
      step: 0.001,
      default: 0.98,
      tip: "How long waves last (higher = longer)",
    },
    {
      key: "tension",
      label: "Tension",
      min: 0.1,
      max: 0.5,
      step: 0.01,
      default: 0.25,
      tip: "Wave speed through the medium",
    },
    {
      key: "dropRate",
      label: "Drop Rate",
      min: 0.2,
      max: 5,
      step: 0.2,
      default: 1,
      tip: "How often disturbances occur",
    },
    {
      key: "dropForce",
      label: "Drop Force",
      min: 1,
      max: 10,
      step: 0.5,
      default: 5,
      tip: "Strength of each disturbance",
    },
  ],
  init: function (w, h, p) {
    _sceneState = {
      curr: new Float32Array(w * h),
      prev: new Float32Array(w * h),
      next: new Float32Array(w * h),
      dropAccum: 0,
      tickAccum: 0,
      lastW: w,
      lastH: h,
    };
  },
  update: function (dt, w, h, p, grid) {
    if (
      !_sceneState.curr ||
      _sceneState.lastW !== w ||
      _sceneState.lastH !== h
    ) {
      this.init(w, h, p);
    }
    var st = _sceneState;
    st.dropAccum += dt * p.dropRate;

    // Random drops
    while (st.dropAccum >= 1) {
      st.dropAccum -= 1;
      var dx = Math.floor(Math.random() * (w - 4)) + 2;
      var dy = Math.floor(Math.random() * (h - 4)) + 2;
      st.curr[dy * w + dx] += p.dropForce;
    }

    // Accumulate dt — run one wave step per 1/30s
    st.tickAccum += dt * 30;
    var ticks = Math.min(Math.floor(st.tickAccum), 4);
    st.tickAccum -= ticks;

    for (var t = 0; t < ticks; t++) {
      // Propagate (2D wave equation)
      var next = st.next;
      next.fill(0);
      var tension = p.tension;
      var damping = p.damping;
      for (var y = 1; y < h - 1; y++) {
        for (var x = 1; x < w - 1; x++) {
          var i = y * w + x;
          var laplacian =
            st.curr[i - 1] +
            st.curr[i + 1] +
            st.curr[i - w] +
            st.curr[i + w] -
            4 * st.curr[i];
          next[i] =
            (2 * st.curr[i] - st.prev[i] + tension * laplacian) * damping;
        }
      }
      // Rotate buffers: next→curr, curr→prev, prev→next
      var tmp = st.prev;
      st.prev = st.curr;
      st.curr = next;
      st.next = tmp;
    }

    // Write to grid
    for (var i = 0; i < w * h; i++) {
      grid[i] = st.curr[i];
    }
  },
};

// ─────────────────────────────────────
//  SCENE: Langton's Ant
// ─────────────────────────────────────
SCENES.langtonsAnt = {
  label: "Langton's Ant",
  params: [
    {
      key: "antCount",
      label: "Ant Count",
      min: 1,
      max: 8,
      step: 1,
      default: 2,
      tip: "How many ants on the grid",
    },
    {
      key: "stepsPerFrame",
      label: "Steps/Frame",
      min: 5,
      max: 200,
      step: 5,
      default: 50,
      tip: "Simulation speed",
    },
    {
      key: "trailDecay",
      label: "Trail Decay",
      min: 0,
      max: 0.05,
      step: 0.005,
      default: 0.005,
      tip: "How fast old trails fade",
    },
    {
      key: "ruleVariant",
      label: "Rule Variant",
      min: 0,
      max: 3,
      step: 1,
      default: 0,
      tip: "0=Classic RL, 1=RLR, 2=LLRR, 3=RLLR",
    },
  ],
  init: function (w, h, p) {
    var cells = new Uint8Array(w * h);
    var ants = [];
    var count = Math.max(1, Math.round(p.antCount));
    for (var i = 0; i < count; i++) {
      ants.push({
        x: Math.floor(w / 2 + (i - count / 2) * 3),
        y: Math.floor(h / 2),
        dir: i % 4,
      });
    }
    _sceneState = {
      cells: cells,
      ants: ants,
      heat: new Float32Array(w * h),
      stepAccum: 0,
      lastW: w,
      lastH: h,
    };
  },
  update: function (dt, w, h, p, grid) {
    if (
      !_sceneState.cells ||
      _sceneState.lastW !== w ||
      _sceneState.lastH !== h
    ) {
      this.init(w, h, p);
    }
    var st = _sceneState;
    var rules = [
      [1, -1], // RL
      [1, -1, 1], // RLR
      [-1, -1, 1, 1], // LLRR
      [1, -1, -1, 1], // RLLR
    ];
    var rule = rules[Math.min(Math.round(p.ruleVariant), rules.length - 1)];
    var numStates = rule.length;
    var dirs = [
      [0, -1],
      [1, 0],
      [0, 1],
      [-1, 0],
    ]; // N E S W

    // Accumulate dt — scale steps by animation speed
    st.stepAccum += dt * p.stepsPerFrame * 30;
    var steps = Math.min(
      Math.floor(st.stepAccum),
      Math.round(p.stepsPerFrame) * 4,
    );
    st.stepAccum -= steps;

    for (var s = 0; s < steps; s++) {
      for (var a = 0; a < st.ants.length; a++) {
        var ant = st.ants[a];
        var i = ant.y * w + ant.x;
        var state = st.cells[i] % numStates;
        // Turn based on rule
        ant.dir = (((ant.dir + rule[state]) % 4) + 4) % 4;
        // Flip cell
        st.cells[i] = (state + 1) % numStates;
        st.heat[i] = 2;
        // Move
        ant.x = (ant.x + dirs[ant.dir][0] + w) % w;
        ant.y = (ant.y + dirs[ant.dir][1] + h) % h;
      }
    }

    // Decay heat
    var decay = 1 - p.trailDecay;
    for (var i = 0; i < w * h; i++) {
      st.heat[i] *= decay;
      // Map: recent heat = bright, cell state adds texture
      var cellVal = st.cells[i] / numStates;
      grid[i] =
        st.heat[i] > 0.05 ? st.heat[i] + cellVal * 0.5 : cellVal * 0.3 - 1.5;
    }
  },
};

// ─────────────────────────────────────
//  SCENE: Fire
// ─────────────────────────────────────
SCENES.fire = {
  label: "Fire",
  params: [
    {
      key: "intensity",
      label: "Intensity",
      min: 0.5,
      max: 5,
      step: 0.1,
      default: 2,
      tip: "Flame height and brightness",
    },
    {
      key: "spread",
      label: "Spread",
      min: 0.1,
      max: 1,
      step: 0.05,
      default: 0.5,
      tip: "How wide the flames spread",
    },
    {
      key: "cooling",
      label: "Cooling",
      min: 0.01,
      max: 0.15,
      step: 0.01,
      default: 0.05,
      tip: "How fast flames cool as they rise",
    },
    {
      key: "sparkle",
      label: "Sparkle",
      min: 0,
      max: 1,
      step: 0.1,
      default: 0.3,
      tip: "Random bright sparks in the flames",
    },
  ],
  init: function (w, h, p) {
    _sceneState = {
      heat: new Float32Array(w * h),
      tickAccum: 0,
      lastW: w,
      lastH: h,
    };
  },
  update: function (dt, w, h, p, grid) {
    if (
      !_sceneState.heat ||
      _sceneState.lastW !== w ||
      _sceneState.lastH !== h
    ) {
      this.init(w, h, p);
    }
    var st = _sceneState;
    var heat = st.heat;

    // Accumulate dt — run one propagation step per 1/30s
    st.tickAccum += dt * 30;
    var ticks = Math.min(Math.floor(st.tickAccum), 4); // cap to avoid spiral
    st.tickAccum -= ticks;

    for (var t = 0; t < ticks; t++) {
      // Set bottom row — fire source
      for (var x = 0; x < w; x++) {
        heat[(h - 1) * w + x] = (Math.random() * 0.5 + 0.5) * p.intensity;
        if (h > 1)
          heat[(h - 2) * w + x] = (Math.random() * 0.4 + 0.3) * p.intensity;
      }

      // Propagate upward
      for (var y = 0; y < h - 1; y++) {
        for (var x = 0; x < w; x++) {
          var sum = 0,
            cnt = 0;
          // Sample below and neighbors
          for (var dx = -1; dx <= 1; dx++) {
            var nx = x + dx;
            if (nx < 0 || nx >= w) continue;
            sum += heat[(y + 1) * w + nx];
            cnt++;
            if (y + 2 < h) {
              sum += heat[(y + 2) * w + nx] * 0.5;
              cnt += 0.5;
            }
          }
          var avg = sum / cnt;
          // Spread horizontally
          if (x > 0) avg += heat[y * w + x - 1] * p.spread * 0.15;
          if (x < w - 1) avg += heat[y * w + x + 1] * p.spread * 0.15;
          avg /= 1 + p.spread * 0.3;
          // Cool
          heat[y * w + x] = Math.max(
            0,
            avg - p.cooling - Math.random() * p.cooling,
          );
          // Sparkle
          if (
            p.sparkle > 0 &&
            heat[y * w + x] > 0.3 &&
            Math.random() < p.sparkle * 0.05
          ) {
            heat[y * w + x] += Math.random() * p.intensity * 0.5;
          }
        }
      }
    }

    // Write to grid
    for (var i = 0; i < w * h; i++) {
      grid[i] = heat[i] * 2 - 2; // map 0..2 → -2..+2
    }
  },
};

// ─────────────────────────────────────
//  SCENE: Maze Generator
// ─────────────────────────────────────
SCENES.mazeGenerator = {
  label: "Maze Generator",
  params: [
    {
      key: "buildSpeed",
      label: "Build Speed",
      min: 1,
      max: 50,
      step: 1,
      default: 15,
      tip: "How many walls per frame",
    },
    {
      key: "wallDensity",
      label: "Wall Style",
      min: 0,
      max: 1,
      step: 0.1,
      default: 0.5,
      tip: "0 = thin walls, 1 = thick walls",
    },
    {
      key: "loopFreq",
      label: "Loop Frequency",
      min: 0,
      max: 0.3,
      step: 0.02,
      default: 0.05,
      tip: "Chance to create loops (imperfect maze)",
    },
    {
      key: "glowTrail",
      label: "Glow Trail",
      min: 0,
      max: 1,
      step: 0.1,
      default: 0.6,
      tip: "How bright the carving path glows",
    },
  ],
  init: function (w, h, p) {
    // Each cell is 2x2 in the grid (wall+passage)
    var mw = Math.floor(w / 2),
      mh = Math.floor(h / 2);
    if (mw < 2) mw = 2;
    if (mh < 2) mh = 2;
    var walls = new Uint8Array(mw * mh); // 0 = unvisited, 1 = visited
    var stack = [];
    var sx = Math.floor(mw / 2),
      sy = Math.floor(mh / 2);
    walls[sy * mw + sx] = 1;
    stack.push([sx, sy]);
    _sceneState = {
      walls: walls,
      grid: new Float32Array(w * h), // persistent carved paths
      stack: stack,
      mw: mw,
      mh: mh,
      phase: "build",
      buildAccum: 0,
      solvePos: null,
      lastW: w,
      lastH: h,
    };
  },
  update: function (dt, w, h, p, grid) {
    if (
      !_sceneState.walls ||
      _sceneState.lastW !== w ||
      _sceneState.lastH !== h
    ) {
      this.init(w, h, p);
    }
    var st = _sceneState;
    var mw = st.mw,
      mh = st.mh;

    if (st.phase === "build") {
      st.buildAccum += dt * p.buildSpeed * 5;
      var steps = Math.floor(st.buildAccum);
      st.buildAccum -= steps;
      var dirs = [
        [0, -1],
        [1, 0],
        [0, 1],
        [-1, 0],
      ];

      for (var s = 0; s < steps && st.stack.length > 0; s++) {
        var cur = st.stack[st.stack.length - 1];
        var cx = cur[0],
          cy = cur[1];
        // Find unvisited neighbors
        var neighbors = [];
        for (var d = 0; d < 4; d++) {
          var nx = cx + dirs[d][0],
            ny = cy + dirs[d][1];
          if (
            nx >= 0 &&
            nx < mw &&
            ny >= 0 &&
            ny < mh &&
            !st.walls[ny * mw + nx]
          ) {
            neighbors.push(d);
          }
        }
        if (neighbors.length > 0) {
          var pick = neighbors[Math.floor(Math.random() * neighbors.length)];
          var nx = cx + dirs[pick][0],
            ny = cy + dirs[pick][1];
          st.walls[ny * mw + nx] = 1;
          st.stack.push([nx, ny]);
          // Carve passage in grid
          var gx = cx * 2 + 1,
            gy = cy * 2 + 1;
          var gx2 = nx * 2 + 1,
            gy2 = ny * 2 + 1;
          var mx = (gx + gx2) >> 1,
            my = (gy + gy2) >> 1;
          if (gx < w && gy < h) st.grid[gy * w + gx] = 1.5 + p.glowTrail;
          if (gx2 < w && gy2 < h) st.grid[gy2 * w + gx2] = 1.5 + p.glowTrail;
          if (mx < w && my < h) st.grid[my * w + mx] = 1.5 + p.glowTrail;
          // Random loops
          if (Math.random() < p.loopFreq && neighbors.length > 1) {
            var pick2 = neighbors[Math.floor(Math.random() * neighbors.length)];
            var lx = (gx + (cx + dirs[pick2][0]) * 2 + 1) >> 1;
            var ly = (gy + (cy + dirs[pick2][1]) * 2 + 1) >> 1;
            if (lx >= 0 && lx < w && ly >= 0 && ly < h)
              st.grid[ly * w + lx] = 1;
          }
        } else {
          st.stack.pop();
        }
      }
      // Check if done
      if (st.stack.length === 0) {
        st.phase = "display";
        st.buildAccum = 0;
      }
    } else {
      // Display phase — slowly fade, then restart
      var allDim = true;
      for (var i = 0; i < w * h; i++) {
        st.grid[i] *= 0.995;
        if (st.grid[i] > 0.1) allDim = false;
      }
      if (allDim) this.init(w, h, p);
    }

    // Fade glow
    for (var i = 0; i < w * h; i++) {
      if (st.grid[i] > 1) st.grid[i] -= 0.02;
    }

    // Write — walls dark, passages bright
    for (var i = 0; i < w * h; i++) {
      grid[i] = st.grid[i] > 0.01 ? st.grid[i] * 2 - 1 : -2;
    }
  },
};

// ─────────────────────────────────────
//  SCENE: Diffusion-Limited Aggregation
// ─────────────────────────────────────
SCENES.dla = {
  label: "DLA Snowflake",
  params: [
    {
      key: "walkers",
      label: "Walkers",
      min: 50,
      max: 1000,
      step: 50,
      default: 300,
      tip: "Number of wandering particles",
    },
    {
      key: "stickProb",
      label: "Stick Chance",
      min: 0.1,
      max: 1,
      step: 0.05,
      default: 0.6,
      tip: "Probability of sticking on contact",
    },
    {
      key: "symmetry",
      label: "Symmetry",
      min: 1,
      max: 8,
      step: 1,
      default: 6,
      tip: "Rotational symmetry arms (1=none)",
    },
    {
      key: "glow",
      label: "Glow Decay",
      min: 0.9,
      max: 0.999,
      step: 0.001,
      default: 0.98,
      tip: "How long new deposits glow",
    },
  ],
  init: function (w, h, p) {
    var stuck = new Uint8Array(w * h);
    var heat = new Float32Array(w * h);
    // Seed center
    stuck[Math.floor(h / 2) * w + Math.floor(w / 2)] = 1;
    // Spawn walkers on edges
    var walkers = [];
    for (var i = 0; i < p.walkers; i++) {
      walkers.push(_dlaSpawnWalker(w, h));
    }
    _sceneState = {
      stuck: stuck,
      heat: heat,
      walkers: walkers,
      count: 1,
      lastW: w,
      lastH: h,
    };
  },
  update: function (dt, w, h, p, grid) {
    if (
      !_sceneState.stuck ||
      _sceneState.lastW !== w ||
      _sceneState.lastH !== h
    ) {
      this.init(w, h, p);
    }
    var st = _sceneState;
    var arms = Math.max(1, Math.round(p.symmetry));

    // Reset if filled
    if (st.count > w * h * 0.25) {
      // Fade then restart
      var allDim = true;
      for (var i = 0; i < w * h; i++) {
        st.heat[i] *= 0.95;
        if (st.heat[i] > 0.05) allDim = false;
      }
      if (allDim) this.init(w, h, p);
    }

    // Move walkers
    var stepsPerFrame = Math.max(5, Math.floor(30 * dt));
    for (var step = 0; step < stepsPerFrame; step++) {
      for (var i = st.walkers.length - 1; i >= 0; i--) {
        var wk = st.walkers[i];
        // Random walk
        wk.x += Math.floor(Math.random() * 3) - 1;
        wk.y += Math.floor(Math.random() * 3) - 1;
        // Kill if out of bounds — respawn
        if (wk.x < 0 || wk.x >= w || wk.y < 0 || wk.y >= h) {
          st.walkers[i] = _dlaSpawnWalker(w, h);
          continue;
        }
        // Check neighbours for stuck cells
        var hasNeighbor = false;
        for (var dy = -1; dy <= 1 && !hasNeighbor; dy++) {
          for (var dx = -1; dx <= 1 && !hasNeighbor; dx++) {
            if (dx === 0 && dy === 0) continue;
            var nx = wk.x + dx,
              ny = wk.y + dy;
            if (
              nx >= 0 &&
              nx < w &&
              ny >= 0 &&
              ny < h &&
              st.stuck[ny * w + nx]
            ) {
              hasNeighbor = true;
            }
          }
        }
        if (hasNeighbor && Math.random() < p.stickProb) {
          // Stick with symmetry
          var cx = w / 2,
            cy = h / 2;
          var rx = wk.x - cx,
            ry = wk.y - cy;
          for (var arm = 0; arm < arms; arm++) {
            var angle = (arm * 6.2832) / arms;
            var cos = Math.cos(angle),
              sin = Math.sin(angle);
            var sx = Math.round(rx * cos - ry * sin + cx);
            var sy = Math.round(rx * sin + ry * cos + cy);
            if (sx >= 0 && sx < w && sy >= 0 && sy < h) {
              st.stuck[sy * w + sx] = 1;
              st.heat[sy * w + sx] = 2;
              st.count++;
            }
          }
          st.walkers[i] = _dlaSpawnWalker(w, h);
        }
      }
    }

    // Decay heat
    for (var i = 0; i < w * h; i++) {
      st.heat[i] *= p.glow;
      if (st.stuck[i]) {
        grid[i] = 0.5 + st.heat[i];
      } else {
        grid[i] = -2;
      }
    }
  },
};

function _dlaSpawnWalker(w, h) {
  // Spawn on a random edge
  var side = Math.floor(Math.random() * 4);
  var x, y;
  if (side === 0) {
    x = Math.floor(Math.random() * w);
    y = 0;
  } else if (side === 1) {
    x = w - 1;
    y = Math.floor(Math.random() * h);
  } else if (side === 2) {
    x = Math.floor(Math.random() * w);
    y = h - 1;
  } else {
    x = 0;
    y = Math.floor(Math.random() * h);
  }
  return { x: x, y: y };
}

// ─────────────────────────────────────
//  SCENE API (activate, deactivate, resize)
// ─────────────────────────────────────
function activateScene(key) {
  if (!SCENES[key]) return;
  pushUndo();
  _activeScene = key;
  _sceneLastTs = 0; // reset so first frame gets a clean dt
  var scene = SCENES[key];
  // Allocate grid
  _sceneW = columns || 80;
  _sceneH = rows || 40;
  _sceneGrid = new Float32Array(_sceneW * _sceneH);
  // Read params from UI or use defaults
  var p = _getSceneParams(key);
  scene.init(_sceneW, _sceneH, p);
  // Run one initial frame so the scene isn't blank
  scene.update(0.033, _sceneW, _sceneH, p, _sceneGrid);
  // Clear preset button highlights since scene overrides pattern
  var presetWrap = document.getElementById("presets");
  if (presetWrap)
    presetWrap.querySelectorAll(".preset-btn").forEach(function (b) {
      b.classList.remove("active");
    });
  _updateSceneUI();
  // Auto-play scenes — they need animation to be meaningful
  if (!playing) togglePlay();
  render();
}

function deactivateScene() {
  if (!_activeScene) return;
  pushUndo();
  _activeScene = null;
  _sceneGrid = null;
  _sceneState = {};
  _updateSceneUI();
  if (!playing) render();
}

function _getSceneParams(key) {
  var scene = SCENES[key];
  if (!scene) return {};
  var p = {};
  for (var i = 0; i < scene.params.length; i++) {
    var param = scene.params[i];
    var el = document.getElementById("scene-p-" + param.key);
    p[param.key] = el ? parseFloat(el.value) : param.default;
  }
  _sceneParamsCache = p;
  return p;
}

function _resizeSceneGrid() {
  if (!_activeScene) return;
  _sceneW = columns;
  _sceneH = rows;
  _sceneGrid = new Float32Array(_sceneW * _sceneH);
  var p = _getSceneParams(_activeScene);
  SCENES[_activeScene].init(_sceneW, _sceneH, p);
}

function _updateSceneGrid(exportDt) {
  if (!_activeScene || !_sceneGrid) return;
  if (_sceneW !== columns || _sceneH !== rows) {
    _resizeSceneGrid();
  }
  var dt;
  if (typeof exportDt === "number") {
    // During export: use caller-supplied dt (already speed-scaled)
    dt = exportDt;
  } else {
    // Live playback: compute real dt from wall clock
    var now = performance.now();
    dt = _sceneLastTs ? Math.min((now - _sceneLastTs) / 1000, 0.1) : 0.033;
    _sceneLastTs = now;
    dt *= (config.animationSpeed || 0.3) / 0.3;
    if (!playing) return; // don't tick simulation when paused
  }
  SCENES[_activeScene].update(
    dt,
    _sceneW,
    _sceneH,
    _sceneParamsCache,
    _sceneGrid,
  );
}

function _sampleScene(mx, my, fw, fh) {
  if (!_sceneGrid || !_activeScene) return 0;
  var ix = Math.floor(mx);
  var iy = Math.floor(my);
  // Return background value for out-of-bounds (transformed coords)
  if (ix < 0 || iy < 0 || ix >= _sceneW || iy >= _sceneH) return -2;
  return _sceneGrid[iy * _sceneW + ix];
}

function _buildSceneParamsUI(key) {
  var wrap = document.getElementById("scene-params");
  if (!wrap) return;
  wrap.innerHTML = "";
  var scene = SCENES[key];
  if (!scene) return;
  _sceneParamsCache = {};
  for (var i = 0; i < scene.params.length; i++) {
    var param = scene.params[i];
    _sceneParamsCache[param.key] = param.default;
    var field = document.createElement("div");
    field.className = "field";
    var label = document.createElement("label");
    label.textContent = param.label + " ";
    if (param.tip) {
      var tip = document.createElement("span");
      tip.className = "help-tip";
      tip.title = param.tip;
      tip.textContent = "?";
      label.appendChild(tip);
    }
    field.appendChild(label);
    var row = document.createElement("div");
    row.className = "slider-row";
    var slider = document.createElement("input");
    slider.type = "range";
    slider.id = "scene-p-" + param.key;
    slider.min = param.min;
    slider.max = param.max;
    slider.step = param.step;
    slider.value = param.default;
    slider.oninput = function () {
      syncSlider(this);
      _sceneParamsCache[this.id.replace("scene-p-", "")] = parseFloat(
        this.value,
      );
    };
    slider.onpointerdown = function () {
      pushUndo();
    };
    row.appendChild(slider);
    var valBox = document.createElement("input");
    valBox.type = "text";
    valBox.className = "slider-val";
    valBox.id = "scene-p-" + param.key + "-val";
    valBox.value = param.default;
    valBox.onchange = function () {
      pushUndo();
      var sliderId = this.id.replace("-val", "");
      syncVal(this, sliderId);
      _sceneParamsCache[sliderId.replace("scene-p-", "")] = parseFloat(
        document.getElementById(sliderId).value,
      );
      if (!playing) render();
    };
    row.appendChild(valBox);
    field.appendChild(row);
    wrap.appendChild(field);
    // sync initial display
    syncSlider(slider);
  }

  // ── Art + Scene blend controls ──
  if (_artGrid) {
    var sep = document.createElement("div");
    sep.style.cssText = "border-top:1px solid #aaa; margin:8px 0 6px; padding-top:6px;";
    var sepLabel = document.createElement("label");
    sepLabel.style.cssText = "font-weight:bold; font-size:11px; margin-bottom:4px; display:block;";
    sepLabel.textContent = "Art + Scene Blend";
    sep.appendChild(sepLabel);
    wrap.appendChild(sep);

    // Blend mode dropdown
    var modeField = document.createElement("div");
    modeField.className = "field";
    var modeLabel = document.createElement("label");
    modeLabel.textContent = "Effect ";
    var modeTip = document.createElement("span");
    modeTip.className = "help-tip";
    modeTip.title = "Mask = scene fills your shape. Add = scene layered on top. Multiply = scene modulates art. Screen = brightening blend.";
    modeTip.textContent = "?";
    modeLabel.appendChild(modeTip);
    modeField.appendChild(modeLabel);
    var modeSelect = document.createElement("select");
    modeSelect.id = "art-scene-blend";
    var modes = [
      ["mask", "Mask (scene fills shape)"],
      ["add", "Add (scene on top)"],
      ["multiply", "Multiply"],
      ["screen", "Screen (brighten)"]
    ];
    for (var m = 0; m < modes.length; m++) {
      var opt = document.createElement("option");
      opt.value = modes[m][0];
      opt.textContent = modes[m][1];
      if (modes[m][0] === _artSceneBlend) opt.selected = true;
      modeSelect.appendChild(opt);
    }
    modeSelect.onchange = function () {
      pushUndo();
      _artSceneBlend = this.value;
      if (!playing) render();
    };
    modeField.appendChild(modeSelect);
    wrap.appendChild(modeField);

    // Strength slider
    var strField = document.createElement("div");
    strField.className = "field";
    var strLabel = document.createElement("label");
    strLabel.textContent = "Strength ";
    var strTip = document.createElement("span");
    strTip.className = "help-tip";
    strTip.title = "How much the scene affects your art. 0 = art only, 1 = full effect.";
    strTip.textContent = "?";
    strLabel.appendChild(strTip);
    strField.appendChild(strLabel);
    var strRow = document.createElement("div");
    strRow.className = "slider-row";
    var strSlider = document.createElement("input");
    strSlider.type = "range";
    strSlider.id = "art-scene-amount";
    strSlider.min = "0";
    strSlider.max = "1";
    strSlider.step = "0.05";
    strSlider.value = _artSceneAmount;
    strSlider.oninput = function () {
      syncSlider(this);
      _artSceneAmount = parseFloat(this.value);
    };
    strSlider.onpointerdown = function () { pushUndo(); };
    strRow.appendChild(strSlider);
    var strVal = document.createElement("input");
    strVal.type = "text";
    strVal.className = "slider-val";
    strVal.id = "art-scene-amount-val";
    strVal.value = _artSceneAmount;
    strVal.onchange = function () {
      pushUndo();
      syncVal(this, "art-scene-amount");
      _artSceneAmount = parseFloat(document.getElementById("art-scene-amount").value);
      if (!playing) render();
    };
    strRow.appendChild(strVal);
    strField.appendChild(strRow);
    wrap.appendChild(strField);
    syncSlider(strSlider);
  }
}

function _updateSceneUI() {
  var list = document.getElementById("scene-list");
  var paramsWrap = document.getElementById("scene-params");
  var exitBtn = document.getElementById("scene-exit-btn");
  var patSection = document.getElementById("pattern-section");
  var spatialSection = document.getElementById("spatial-section");
  var artSection = document.getElementById("ascii-art-section");
  var fmField = document.getElementById("fm-field");
  var compatHint = document.getElementById("scene-compat-hint");
  var sceneActive = document.getElementById("scene-active-label");
  var hasArt = !!_artGrid;

  if (_activeScene) {
    // Show scene params, hide pattern section
    if (list) list.style.display = "none";
    if (paramsWrap) paramsWrap.style.display = "";
    if (exitBtn) {
      exitBtn.style.display = "";
      exitBtn.textContent = hasArt ? "Remove Scene Effect" : "Back to Patterns";
    }
    if (compatHint) {
      compatHint.style.display = "";
      compatHint.textContent = hasArt
        ? "Scene animates on your uploaded art. Use blend mode and strength below."
        : "Scenes replace the pattern equation. Transforms, character set, colors, Layer B and animation speed still apply.";
    }
    if (sceneActive) {
      sceneActive.style.display = "";
      sceneActive.textContent =
        "Active: " +
        (SCENES[_activeScene] ? SCENES[_activeScene].label : _activeScene);
    }
    // Dim sections that scenes override (but NOT art section — art coexists)
    if (patSection) patSection.classList.add("art-override");
    if (spatialSection && !hasArt) spatialSection.classList.add("art-override");
    if (artSection) artSection.classList.remove("art-override");
    // Dim Frame Multiplier (only animationSpeed affects scenes)
    if (fmField) fmField.classList.add("scene-na");
    _buildSceneParamsUI(_activeScene);
  } else {
    // Show scene list, restore pattern section
    if (list) {
      list.style.display = "";
      list.querySelectorAll(".preset-btn").forEach(function (b) {
        b.classList.remove("active");
      });
    }
    if (paramsWrap) {
      paramsWrap.style.display = "none";
      paramsWrap.innerHTML = "";
    }
    if (exitBtn) exitBtn.style.display = "none";
    if (compatHint) compatHint.style.display = "none";
    if (sceneActive) sceneActive.style.display = "none";
    if (patSection && !_artGrid) patSection.classList.remove("art-override");
    if (spatialSection && !_artGrid)
      spatialSection.classList.remove("art-override");
    if (artSection) artSection.classList.remove("art-override");
    if (fmField) fmField.classList.remove("scene-na");
  }
}

function buildSceneList() {
  var wrap = document.getElementById("scene-list");
  if (!wrap) return;
  wrap.innerHTML = "";
  var keys = Object.keys(SCENES);
  for (var i = 0; i < keys.length; i++) {
    (function (key) {
      var scene = SCENES[key];
      var btn = document.createElement("span");
      btn.className = "preset-btn";
      btn.textContent = scene.label;
      btn.onclick = function () {
        activateScene(key);
        wrap.querySelectorAll(".preset-btn").forEach(function (b) {
          b.classList.remove("active");
        });
        btn.classList.add("active");
      };
      wrap.appendChild(btn);
    })(keys[i]);
  }
}

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
  asciiArt: { xc: [0, 0.5, 0.001], yc: [0, 0.5, 0.001], gv: [0.5, 2, 0.1] },
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
  var hw = fw * 0.5,
    hh = fh * 0.5;
  var dx, dy, theta, r;
  switch (pattern) {
    case "centerSpiral":
      dx = mx - hw;
      dy = my - hh;
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
      dx = mx - hw;
      dy = my - hh;
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
      dx = mx - hw;
      dy = my - hh;
      return (
        Math.sin(dx * dx * c.xConstant + time * c.frameMultiplier) +
        Math.cos(dy * dy * c.yConstant + time * c.frameMultiplier)
      );

    case "checkerboard":
      return Math.sin(mx * c.xConstant) * Math.sin(my * c.yConstant + time);

    case "diamond":
      dx = mx - hw;
      dy = my - hh;
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
      dx = mx - hw;
      dy = my - hh;
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
      dx = mx - hw;
      dy = my - hh;
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
      dx = mx - hw;
      dy = my - hh;
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

    case "asciiArt":
      if (!_artGrid) return 0;
      var artVal = sampleArtGrid(mx, my, fw, fh);
      // fm controls how much time-based animation distorts the art
      // gV scales the output amplitude
      return (
        artVal * (c.globalVal || 1) +
        Math.sin(mx * c.xConstant + time * c.frameMultiplier) *
          Math.sin(my * c.yConstant + time * c.frameMultiplier * 0.7) *
          0.3
      );

    default:
      return 0;
  }
}

// ══════════════════════════════════════
//  SYMMETRY
// ══════════════════════════════════════
function applySym(dx, dy, mode, symN, symSector) {
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
      var angle = Math.atan2(dy, dx);
      var r = Math.sqrt(dx * dx + dy * dy);
      angle = ((angle % symSector) + symSector) % symSector;
      if (angle > symSector * 0.5) angle = symSector - angle;
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
  // Precompute radial symmetry params
  var _symN = 0,
    _symSector = 0;
  if (hasSym && sym.length > 5) {
    _symN = sym.charCodeAt(7) - 48;
    _symSector = TWO_PI / _symN;
  }
  var hasLayerB = c.layerB && c.layerB.enabled;
  var lb = hasLayerB ? c.layerB : null;
  var isScene = !!_activeScene;
  var hasArt = !!_artGrid;
  var artScene = isScene && hasArt; // both active — blend them

  // Update scene simulation before rendering
  if (isScene) _updateSceneGrid(_exportFrameDt);

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
        applySym(dx, dy, sym, _symN, _symSector);
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
      var value;
      if (artScene) {
        // Both art and scene active — blend them
        var artVal = sampleArtGrid(mx, my, fw, fh);
        var sceneVal = _sampleScene(mx, my, fw, fh);
        if (sceneVal === -2) sceneVal = 0; // scene OOB — use neutral value
        if (artVal <= -0.95) {
          // Outside art bounds — show nothing
          continue;
        }
        var amt = _artSceneAmount;
        switch (_artSceneBlend) {
          case "mask":
            // Scene adds animated detail within art shape, preserving art brightness
            var mask = (artVal + 1) * 0.5; // 0..1
            if (mask < 0.05) { continue; } // outside shape
            value = artVal + sceneVal * mask * amt * 0.5;
            break;
          case "add":
            value = artVal + sceneVal * amt * 0.5;
            break;
          case "multiply":
            // Scene oscillates around 1.0 so it can brighten and darken equally
            var sceneFactor = 0.5 + (sceneVal + 2) * 0.25; // 0.5..1.5
            value = artVal * (1 - amt + amt * sceneFactor);
            break;
          case "screen":
            var a = (artVal + 2) * 0.25; // 0..1
            var b = (sceneVal + 2) * 0.25;
            var s = a + b - a * b;
            value = artVal * (1 - amt) + (s * 4 - 2) * amt;
            break;
          default:
            value = artVal;
        }
      } else if (isScene) {
        value = _sampleScene(mx, my, fw, fh);
        if (value === -2) continue; // OOB — leave background
      } else {
        value = computeValue(c.pattern, mx, my, fw, fh, c);
      }

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
      if (glyph !== " ") ctx.fillText(glyph, x * charW, py);
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
    _sceneLastTs = 0; // reset scene dt on unpause
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
  // ASCII art info
  if (typeof _updateArtInfo === "function") _updateArtInfo();
  if (typeof _updateArtActiveUI === "function") _updateArtActiveUI();
  // Scene UI
  if (typeof _updateSceneUI === "function") _updateSceneUI();
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
  config.pattern = _artGrid
    ? "asciiArt"
    : document.getElementById("p-pattern").value;
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
  pushUndo();
  UIToConfig();
  updateCode();
  if (!playing) render();
}

// ══════════════════════════════════════
//  CUSTOM EQUATION UI HELPERS
// ══════════════════════════════════════
function toggleFormulaInput() {
  var pat = document.getElementById("p-pattern").value;
  var el = document.getElementById("custom-expr-group");
  if (el) el.style.display = pat === "custom" ? "block" : "none";
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

// ══════════════════════════════════════
//  ASCII ART FILE HANDLING
// ══════════════════════════════════════
function handleArtFile(input) {
  var file = input.files && input.files[0];
  if (!file) return;
  var reader = new FileReader();
  reader.onload = function (e) {
    _applyArtText(e.target.result, file.name);
  };
  reader.readAsText(file);
}
function handleArtDrop(e) {
  e.preventDefault();
  e.currentTarget.classList.remove("dragover");
  var file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
  if (!file) return;
  var reader = new FileReader();
  reader.onload = function (ev) {
    _applyArtText(ev.target.result, file.name);
  };
  reader.readAsText(file);
}
function _applyArtText(text, fileName) {
  if (!loadAsciiArt(text, fileName)) return;
  // Switch to asciiArt pattern (internal — not in dropdown)
  config.pattern = "asciiArt";
  applyPatternRanges("asciiArt");
  _updateArtInfo();
  _updateArtActiveUI();
  if (_activeScene) _updateSceneUI(); // refresh blend controls
  liveUpdate();
}
function _updateArtInfo() {
  var info = document.getElementById("art-info");
  var label = document.getElementById("art-drop-label");
  var dropZone = document.getElementById("art-drop-zone");
  if (_artGrid) {
    if (info) {
      info.style.display = "flex";
      document.getElementById("art-file-name").textContent = _artFileName;
      document.getElementById("art-dimensions").textContent =
        _artW + "×" + _artH + " chars";
    }
    if (dropZone) dropZone.style.display = "none";
  } else {
    if (info) info.style.display = "none";
    if (dropZone) dropZone.style.display = "";
    if (label) label.textContent = "Drop .txt here or click to browse";
  }
}
function clearArt() {
  _artGrid = null;
  _artW = 0;
  _artH = 0;
  _artFileName = "";
  // Restore to the dropdown's selected pattern
  config.pattern = document.getElementById("p-pattern").value;
  _updateArtInfo();
  _updateArtActiveUI();
  if (_activeScene) _updateSceneUI(); // refresh scene UI text
  var input = document.getElementById("art-file-input");
  if (input) input.value = "";
  liveUpdate();
}

function resetArtStyles() {
  if (!_artGrid) return;
  pushUndo();
  // Keep art-specific pattern, reset everything else to clean defaults
  config.pattern = "asciiArt";
  config.charset = "░▒▓█";
  config.colors = ["#00ffd5", "#00b396", "#006654"];
  config.xConstant = 0;
  config.yConstant = 0;
  config.frameMultiplier = 0.05;
  config.animationSpeed = 0.3;
  config.mirrorAxis = "none";
  config.globalVal = 1;
  config.colored = true;
  config.centerX = 0;
  config.centerY = 0;
  config.rotation = 0;
  config.scale = 1;
  config.turbulence = 0;
  config.layerB = {
    enabled: false,
    pattern: "circular",
    xConstant: 0.01,
    yConstant: 0.01,
    frameMultiplier: 0.05,
    globalVal: 1,
    blendMode: "add",
    blendAmount: 0.5,
    customExpr: "sin(r * 0.2 + time)",
  };
  time = 0;
  configToUI();
  _updateArtActiveUI();
}

// Update UI state when art is loaded or cleared:
// - Dim/enable pattern section controls
// - Hide/show custom equation
// - Relabel spatial hints
function _updateArtActiveUI() {
  var active = !!_artGrid;

  // Pattern section — dim when art overrides it
  var patSection = document.getElementById("pattern-section");
  if (patSection) {
    patSection.classList.toggle("art-override", active);
  }

  // Pattern dropdown
  var patSelect = document.getElementById("p-pattern");
  if (patSelect) patSelect.disabled = active;

  // Custom equation group — hide when art is active
  var exprGroup = document.getElementById("custom-expr-group");
  if (exprGroup && active) exprGroup.style.display = "none";

  // Spatial range hint — relabel for art mode
  if (active) {
    var hint = document.getElementById("spatial-range-hint");
    if (hint) {
      hint.textContent =
        "xC/yC = wave overlay frequency, gV = art contrast. " +
        "Type any value in the number box — no limit.";
    }
  }
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
      pushUndo();
      var hasArt = !!_artGrid;
      var hasScene = !!_activeScene;

      // Apply the preset's style settings
      var preset = JSON.parse(JSON.stringify(p));

      if (hasArt) {
        // Keep art as the pattern — apply only the visual style from the preset
        preset.pattern = "asciiArt";
        config = preset;
      } else if (hasScene) {
        // Keep scene active — apply only the visual style from the preset
        var curPattern = config.pattern;
        config = preset;
        config.pattern = curPattern;
      } else {
        config = preset;
      }

      time = 0;
      configToUI();
      _updateArtInfo();
      _updateArtActiveUI();
      wrap.querySelectorAll(".preset-btn").forEach(function (b) {
        b.classList.remove("active");
      });
      btn.classList.add("active");
    };
    wrap.appendChild(btn);
  });
}

function newPreset() {
  pushUndo();
  // Deactivate scene if one is running
  if (_activeScene) {
    deactivateScene();
  }
  // Clear art state so blank preset starts fresh
  _artGrid = null;
  _artW = 0;
  _artH = 0;
  _artFileName = "";
  var artInput = document.getElementById("art-file-input");
  if (artInput) artInput.value = "";

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

// Randomise only the visual settings that apply to both patterns AND scenes:
// charset, colors, transforms, symmetry, animation speed, Layer B.
// Does NOT touch pattern, spatial constants, or frame multiplier.
function _randomizeVisuals() {
  var pick = function (arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  };
  var rng = function (a, b) {
    return a + Math.random() * (b - a);
  };
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
  ];
  var useLayerB = Math.random() > 0.65;

  config.charset = pick(charsets);
  config.colors = pick(palettes).slice();
  config.colored = Math.random() > 0.15;
  config.animationSpeed = rng(0.1, 0.6);
  config.mirrorAxis = pick(symmetries);
  config.centerX = rng(-0.2, 0.2);
  config.centerY = rng(-0.2, 0.2);
  config.rotation = Math.round(rng(0, 360));
  config.scale = rng(0.7, 1.8);
  config.turbulence = Math.random() > 0.6 ? rng(0.05, 0.3) : 0;
  config.layerB = useLayerB
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
      };
}

function randomize() {
  pushUndo();

  // ── Scene-aware randomise ──
  if (_activeScene) {
    var keys = Object.keys(SCENES);
    var key = keys[Math.floor(Math.random() * keys.length)];
    // Set up new scene (skip activateScene to avoid double undo)
    _activeScene = key;
    _sceneLastTs = 0;
    var scene = SCENES[key];
    _sceneW = columns || 80;
    _sceneH = rows || 40;
    _sceneGrid = new Float32Array(_sceneW * _sceneH);
    _buildSceneParamsUI(key);
    // Randomise this scene's params within their declared ranges
    if (scene.params && scene.params.length) {
      scene.params.forEach(function (param) {
        var el = document.getElementById("scene-p-" + param.key);
        if (!el) return;
        var lo = param.min,
          hi = param.max,
          st = param.step || 0.01;
        var val = lo + Math.random() * (hi - lo);
        val = Math.round(val / st) * st;
        if (val < lo) val = lo;
        if (val > hi) val = hi;
        el.value = val;
        el.dispatchEvent(new Event("input"));
      });
    }
    var p = _getSceneParams(key);
    scene.init(_sceneW, _sceneH, p);
    scene.update(0.033, _sceneW, _sceneH, p, _sceneGrid);
    if (!playing) togglePlay();
    // Also randomise the compatible visual settings
    _randomizeVisuals();
    // Randomise art+scene blend if art is loaded
    if (_artGrid) {
      var blendModes = ["mask", "add", "multiply", "screen"];
      _artSceneBlend = blendModes[Math.floor(Math.random() * blendModes.length)];
      _artSceneAmount = 0.3 + Math.random() * 0.7;
    }
    config.name = "Random — " + (SCENES[key] ? SCENES[key].label : key);
    _updateSceneUI();
    configToUI();
    render();
    return;
  }

  // Deactivate scene if one is running (shouldn't reach here, but safety)
  if (_activeScene) {
    _activeScene = null;
    _sceneGrid = null;
    _sceneState = {};
    _updateSceneUI();
  }
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

  // If ASCII art is loaded, keep using it as the pattern
  var hasArt = !!_artGrid;
  if (hasArt) p = "asciiArt";

  // Pattern-tuned constants — biased toward the clean zone for each pattern
  var xc, yc, fm, gv;
  switch (p) {
    case "asciiArt":
      xc = rng(0, 0.3);
      yc = rng(0, 0.3);
      fm = rng(0.01, 0.15);
      gv = rng(0.7, 1.5);
      break;
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
    name: hasArt ? "Random — " + _artFileName : "Random — " + p,
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
  // When ASCII art is loaded, pattern is locked — skip
  if (_artGrid) return;
  pushUndo();
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
  pushUndo();
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
  pushUndo();
  config.frameMultiplier = _vary(config.frameMultiplier, 0.3, -0.3, 0.3);
  config.animationSpeed = _vary(config.animationSpeed, 0.3, 0.01, 1);
  configToUI();
}

function randomizeTransform() {
  pushUndo();
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
  pushUndo();
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
  pushUndo();
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
  pushUndo();
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
  if (_activeScene) {
    alert(
      "Scenes can\u2019t be exported as HTML yet \u2014 they need the full simulation engine.\n\nTip: Use GIF or MP4 export to capture scene animations, or switch back to a pattern first.",
    );
    return;
  }
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
var _exportFrameDt = null; // non-null during export to feed scene dt

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
    _exportFrameDt = (1 / fps) * ((config.animationSpeed || 0.3) / 0.3);
    render();
    _exportFrameDt = null;
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
    _exportFrameDt = (1 / fps) * ((config.animationSpeed || 0.3) / 0.3);
    render();
    _exportFrameDt = null;
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
    "<ul><li><kbd>Ctrl+Z</kbd> — Undo</li>" +
    "<li><kbd>Ctrl+Shift+Z</kbd> — Redo</li>" +
    "<li><kbd>Ctrl+N</kbd> — New (reset to default)</li>" +
    "<li><kbd>Ctrl+E</kbd> — Export as HTML</li>" +
    "<li><kbd>Ctrl+R</kbd> — Randomise all settings</li>" +
    "<li><kbd>Ctrl+M</kbd> — Open Math Reference</li>" +
    "<li><kbd>Space</kbd> — Play / Pause animation</li>" +
    "<li><kbd>F1</kbd> — Open Help</li></ul>",

  scenes:
    "<h2>Scenes — Simulation Animations</h2>" +
    "<p>Scenes are <strong>stateful simulations</strong> that evolve frame by frame — unlike math patterns, which are calculated fresh each frame from a formula. Scenes produce a value grid that feeds into the same render pipeline, so <strong>Transforms, Symmetry, Turbulence, Layer B, Characters, and Colors</strong> all work exactly the same as with patterns.</p>" +
    "<h3>How Scenes Work</h3>" +
    "<p>Each scene maintains internal state (particles, cell lists, heat maps, etc.) and updates that state every frame. The updated state produces a number per cell, which the existing value → character → color pipeline renders. This means scenes can simulate things that math formulas alone cannot — anything that needs <em>memory</em> between frames.</p>" +
    "<h3>Using Scenes</h3>" +
    "<ol><li>Scroll to the <strong>Scenes</strong> section in the sidebar</li>" +
    "<li>Click a scene button to activate it — the preview switches immediately</li>" +
    "<li>Adjust the scene-specific sliders that appear below</li>" +
    "<li>Combine with <strong>Transforms</strong> (rotation, scale, symmetry) for kaleidoscope effects</li>" +
    "<li>Enable <strong>Layer B</strong> to blend a math pattern on top of the simulation</li>" +
    "<li>Click <strong>Exit Scene</strong> or choose a preset/pattern to go back to formula mode</li></ol>" +
    "<h3>Built-In Scenes</h3>" +
    "<ul>" +
    "<li><strong>Cell Division</strong> — Metaball-style cells that split 1→2→4→…→32 and restart. Params: split speed, cell size, drift, max generations.</li>" +
    "<li><strong>Particle Rain</strong> — Falling particles with trails. Params: density, speed, wind, trail length.</li>" +
    "<li><strong>Crystal Growth</strong> — Branching tips with rotational symmetry. Params: branch rate, growth speed, arm count, decay.</li>" +
    "<li><strong>Game of Life</strong> — Conway's cellular automaton with trail ghosts and auto-reseed. Params: seed density, tick speed, trail fade, wrapping.</li>" +
    "<li><strong>Ripples</strong> — Expanding rings from random drop points. Params: drop frequency, wave speed, decay, ring width.</li>" +
    "<li><strong>Flocking</strong> — Boid simulation with cohesion and separation. Params: count, cohesion, separation, speed.</li>" +
    "<li><strong>Wave Propagation</strong> — 2D wave equation with random disturbances. Params: damping, tension, drop rate, drop force.</li>" +
    "<li><strong>Langton's Ant</strong> — Multiple ants with configurable rule variant (RL, RLR, LLRR, RLLR). Params: ant count, steps/frame, trail decay, rule variant.</li>" +
    "<li><strong>Fire</strong> — Bottom-up heat propagation with sparks. Params: intensity, spread, cooling, sparkle.</li>" +
    "<li><strong>Maze Generator</strong> — Recursive-backtracker maze with glow trail. Params: build speed, wall density, loop frequency, glow trail.</li>" +
    "<li><strong>DLA Snowflake</strong> — Diffusion-limited aggregation with rotational symmetry. Params: walker count, stick probability, symmetry order, glow.</li>" +
    "</ul>" +
    "<h3>Scenes + Other Features</h3>" +
    "<p>Because scenes produce a standard value grid, all existing features work seamlessly:</p>" +
    "<ul>" +
    "<li><strong>Transforms</strong> — Rotation, scale, center offset apply to the sampling of the scene grid</li>" +
    "<li><strong>Symmetry</strong> — Radial 4/6/8 or axis mirroring creates mandala effects from any simulation</li>" +
    "<li><strong>Turbulence</strong> — Warps the scene output through noise, adding organic distortion</li>" +
    "<li><strong>Layer B</strong> — Blend a math formula pattern on top of (or underneath) the scene output</li>" +
    "<li><strong>Characters &amp; Colors</strong> — The value-to-character mapping is identical; change the charset or palette and the scene renders differently</li>" +
    "<li><strong>Export</strong> — HTML, GIF, and MP4 export all capture scene animations</li>" +
    "</ul>" +
    "<h3>Tips</h3>" +
    "<ul>" +
    "<li>Try <strong>Radial 8 symmetry</strong> with Crystal Growth or DLA for stunning mandala effects</li>" +
    "<li>Combine <strong>Game of Life</strong> with turbulence for an organic, living texture</li>" +
    "<li>Layer a <strong>Tunnel</strong> pattern (Layer B, Multiply blend) on top of <strong>Fire</strong> for depth</li>" +
    "<li>Adjust <strong>Animation Speed</strong> to control how fast scenes evolve</li>" +
    "</ul>",

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
  pushUndo();
  // Deactivate scene if one is running
  if (_activeScene) {
    deactivateScene();
  }
  // Clear art state so blank preset starts fresh
  _artGrid = null;
  _artW = 0;
  _artH = 0;
  _artFileName = "";
  var artInput = document.getElementById("art-file-input");
  if (artInput) artInput.value = "";

  if (typeof PRESETS !== "undefined" && PRESETS.length > 0) {
    // Load first preset
    config = JSON.parse(JSON.stringify(PRESETS[0]));
    time = 0;
    configToUI();
    _updateArtInfo();
    _updateArtActiveUI();
  }
}

// ══════════════════════════════════════
//  KEYBOARD SHORTCUTS
// ══════════════════════════════════════
document.addEventListener("keydown", function (e) {
  // Don't intercept when typing in inputs
  var tag = (e.target.tagName || "").toLowerCase();

  // Arrow key increment/decrement on slider value inputs
  if (tag === "input" && e.target.classList.contains("slider-val") &&
      (e.key === "ArrowUp" || e.key === "ArrowDown")) {
    e.preventDefault();
    var sliderId = e.target.id.replace(/-val$/, "");
    var slider = document.getElementById(sliderId);
    if (!slider) return;
    var step = parseFloat(slider.step) || 1;
    if (e.shiftKey) step *= 10;
    var cur = parseFloat(e.target.value) || 0;
    var nv = e.key === "ArrowUp" ? cur + step : cur - step;
    // round to avoid floating point noise
    var decimals = (slider.step.split(".")[1] || "").length;
    nv = parseFloat(nv.toFixed(decimals + 2));
    e.target.value = nv;
    // trigger existing onchange handler
    if (e.target.onchange) e.target.onchange();
    return;
  }

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
    if (e.key === "z" || e.key === "Z") {
      e.preventDefault();
      if (e.shiftKey) {
        redo();
      } else {
        undo();
      }
    }
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
  // Mobile device detection — show XP error dialog
  if (/Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
      (navigator.maxTouchPoints > 1 && window.innerWidth < 900)) {
    var block = document.getElementById("mobile-block");
    if (block) block.style.display = "block";
  }

  initTooltips();
  buildPresets();
  buildSceneList();
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
  // ASCII art drop zone click → file input
  var dropZone = document.getElementById("art-drop-zone");
  var fileInput = document.getElementById("art-file-input");
  if (dropZone && fileInput) {
    dropZone.addEventListener("click", function () {
      fileInput.click();
    });
  }
});

window.addEventListener("resize", function () {
  setupCanvas();
  if (!playing) render();
});
