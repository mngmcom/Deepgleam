'use strict';
(() => {
  // ================= Konstanten =================
  const W = 320, H = 180, TS = 16;
  const STEP = 1 / 60;
  const GRAV = 950, JUMP_V = 330, RUN = 95, MAX_FALL = 420;
  const MAX_HP = 6, START_LIVES = 3;
  const HS_KEY = 'caverun.highscore';

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');

  function resize() {
    const s = Math.max(1, Math.floor(Math.min(innerWidth / W, innerHeight / H)));
    canvas.style.width = W * s + 'px';
    canvas.style.height = H * s + 'px';
  }
  addEventListener('resize', resize);
  resize();

  // ================= Hilfsfunktionen =================
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  function hash(x, y, s) {
    let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul((s | 0) + 1, 1442695041);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }
  const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  function makeCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  }
  function sprite(rows, pal) {
    const c = makeCanvas(rows[0].length, rows.length);
    const g = c.getContext('2d');
    rows.forEach((r, y) => {
      for (let x = 0; x < r.length; x++) {
        const col = pal[r[x]];
        if (col) { g.fillStyle = col; g.fillRect(x, y, 1, 1); }
      }
    });
    return c;
  }
  function flipped(src) {
    const c = makeCanvas(src.width, src.height);
    const g = c.getContext('2d');
    g.translate(src.width, 0); g.scale(-1, 1); g.drawImage(src, 0, 0);
    return c;
  }
  function findPixels(rows, ch) {
    const out = [];
    rows.forEach((r, y) => { for (let x = 0; x < r.length; x++) if (r[x] === ch) out.push([x, y]); });
    return out;
  }
  function circle(g, x, y, r) {
    if (r <= 0) return;
    g.beginPath();
    g.arc(Math.round(x), Math.round(y), Math.round(r), 0, Math.PI * 2);
    g.fill();
  }
  // Pixeliges Dreieck (Stalaktit/Stalagmit) für den Hintergrund
  function pixTri(g, cx, baseY, w, h, dir, color) {
    g.fillStyle = color;
    for (let i = 0; i < h; i += 2) {
      const ww = Math.max(1, Math.round(w * (1 - i / h)));
      const yy = dir > 0 ? baseY + i : baseY - i - 2;
      g.fillRect(Math.round(cx - ww / 2), yy, ww, 2);
    }
  }

  // ================= Pixel-Schrift (3x5) =================
  const FONT = {
    A: ['.#.', '#.#', '###', '#.#', '#.#'], B: ['##.', '#.#', '##.', '#.#', '##.'],
    C: ['.##', '#..', '#..', '#..', '.##'], D: ['##.', '#.#', '#.#', '#.#', '##.'],
    E: ['###', '#..', '##.', '#..', '###'], F: ['###', '#..', '##.', '#..', '#..'],
    G: ['.##', '#..', '#.#', '#.#', '.##'], H: ['#.#', '#.#', '###', '#.#', '#.#'],
    I: ['###', '.#.', '.#.', '.#.', '###'], J: ['..#', '..#', '..#', '#.#', '.#.'],
    K: ['#.#', '#.#', '##.', '#.#', '#.#'], L: ['#..', '#..', '#..', '#..', '###'],
    M: ['#.#', '###', '###', '#.#', '#.#'], N: ['##.', '#.#', '#.#', '#.#', '#.#'],
    O: ['.#.', '#.#', '#.#', '#.#', '.#.'], P: ['##.', '#.#', '##.', '#..', '#..'],
    Q: ['.#.', '#.#', '#.#', '##.', '.##'], R: ['##.', '#.#', '##.', '#.#', '#.#'],
    S: ['.##', '#..', '.#.', '..#', '##.'], T: ['###', '.#.', '.#.', '.#.', '.#.'],
    U: ['#.#', '#.#', '#.#', '#.#', '###'], V: ['#.#', '#.#', '#.#', '#.#', '.#.'],
    W: ['#.#', '#.#', '###', '###', '#.#'], X: ['#.#', '#.#', '.#.', '#.#', '#.#'],
    Y: ['#.#', '#.#', '.#.', '.#.', '.#.'], Z: ['###', '..#', '.#.', '#..', '###'],
    0: ['###', '#.#', '#.#', '#.#', '###'], 1: ['.#.', '##.', '.#.', '.#.', '###'],
    2: ['##.', '..#', '.#.', '#..', '###'], 3: ['##.', '..#', '.#.', '..#', '##.'],
    4: ['#.#', '#.#', '###', '..#', '..#'], 5: ['###', '#..', '##.', '..#', '##.'],
    6: ['.##', '#..', '###', '#.#', '###'], 7: ['###', '..#', '.#.', '.#.', '.#.'],
    8: ['###', '#.#', '###', '#.#', '###'], 9: ['###', '#.#', '###', '..#', '##.'],
    ':': ['...', '.#.', '...', '.#.', '...'], '!': ['.#.', '.#.', '.#.', '...', '.#.'],
    '-': ['...', '...', '###', '...', '...'], '+': ['...', '.#.', '###', '.#.', '...'],
    '.': ['...', '...', '...', '...', '.#.'], '/': ['..#', '..#', '.#.', '#..', '#..'],
  };
  const textWidth = (s, sc = 1) => s.length * 4 * sc - sc;
  function textRaw(s, x, y, color, sc) {
    ctx.fillStyle = color;
    for (let i = 0; i < s.length; i++) {
      const g = FONT[s[i]];
      if (!g) continue;
      for (let r = 0; r < 5; r++)
        for (let c = 0; c < 3; c++)
          if (g[r][c] === '#') ctx.fillRect(x + (i * 4 + c) * sc, y + r * sc, sc, sc);
    }
  }
  function drawText(s, x, y, color = '#f0dca0', sc = 1) {
    s = String(s).toUpperCase();
    x = Math.round(x); y = Math.round(y);
    textRaw(s, x + sc, y + sc, '#000', sc);
    textRaw(s, x, y, color, sc);
  }
  const drawTextC = (s, y, color, sc = 1) => drawText(s, (W - textWidth(String(s), sc)) / 2, y, color, sc);
  const pad = (n) => String(n).padStart(6, '0');

  // ================= Sound (WebAudio, im Code erzeugt) =================
  const Sound = {
    ac: null, master: null, muted: false,
    init() {
      if (!this.ac) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.ac = new AC();
        this.master = this.ac.createGain();
        this.master.gain.value = 0.5;
        this.master.connect(this.ac.destination);
      }
      if (this.ac.state === 'suspended') this.ac.resume();
    },
    tone(f, dur, { type = 'square', vol = 0.1, slide = 0, delay = 0 } = {}) {
      if (!this.ac || this.muted) return;
      const t = this.ac.currentTime + delay;
      const o = this.ac.createOscillator(), g = this.ac.createGain();
      o.type = type;
      o.frequency.setValueAtTime(f, t);
      if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f + slide), t + dur);
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g); g.connect(this.master);
      o.start(t); o.stop(t + dur + 0.02);
    },
    noise(dur, { vol = 0.15, delay = 0, freq = 1200 } = {}) {
      if (!this.ac || this.muted) return;
      const t = this.ac.currentTime + delay;
      const n = Math.max(1, Math.floor(this.ac.sampleRate * dur));
      const buf = this.ac.createBuffer(1, n, this.ac.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
      const s = this.ac.createBufferSource();
      s.buffer = buf;
      const fl = this.ac.createBiquadFilter();
      fl.type = 'lowpass'; fl.frequency.value = freq;
      const g = this.ac.createGain();
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      s.connect(fl); fl.connect(g); g.connect(this.master);
      s.start(t);
    },
  };
  const sfx = {
    jump() { Sound.tone(260, 0.14, { slide: 340, vol: 0.07 }); },
    coin() { Sound.tone(988, 0.07, { vol: 0.06 }); Sound.tone(1319, 0.12, { vol: 0.06, delay: 0.06 }); },
    gem() { [784, 988, 1175, 1568].forEach((f, i) => Sound.tone(f, 0.12, { vol: 0.07, delay: i * 0.05, type: 'triangle' })); },
    stomp() { Sound.tone(220, 0.12, { slide: -150, vol: 0.1 }); Sound.noise(0.08, { vol: 0.1 }); },
    hurt() { Sound.tone(180, 0.25, { type: 'sawtooth', slide: -120, vol: 0.08 }); },
    die() { [392, 330, 262, 196].forEach((f, i) => Sound.tone(f, 0.2, { delay: i * 0.16, vol: 0.1, type: 'triangle' })); },
    crack() { Sound.noise(0.18, { vol: 0.06, freq: 3000 }); },
    crash() { Sound.noise(0.3, { vol: 0.14, freq: 700 }); },
    checkpoint() { [523, 659, 784, 1047].forEach((f, i) => Sound.tone(f, 0.12, { delay: i * 0.07, type: 'triangle', vol: 0.08 })); },
    win() { [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => Sound.tone(f, 0.22, { delay: i * 0.13, type: 'triangle', vol: 0.1 })); },
    drip() { Sound.tone(1400 + Math.random() * 600, 0.08, { type: 'sine', slide: -900, vol: 0.035 }); },
  };

  // ================= Eingabe =================
  const keys = {}, pressed = {};
  const BLOCK = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'];
  addEventListener('keydown', (e) => {
    if (BLOCK.includes(e.code)) e.preventDefault();
    if (!keys[e.code]) pressed[e.code] = true;
    keys[e.code] = true;
    Sound.init();
  });
  addEventListener('keyup', (e) => { keys[e.code] = false; });
  addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
  const keyL = () => keys.ArrowLeft || keys.KeyA;
  const keyR = () => keys.ArrowRight || keys.KeyD;
  const keyDown = () => keys.ArrowDown || keys.KeyS;
  const keyJump = () => keys.Space || keys.ArrowUp || keys.KeyW;
  const pressedJump = () => pressed.Space || pressed.ArrowUp || pressed.KeyW;
  const pressedStart = () => pressed.Enter || pressed.Space;

  // ================= Sprites =================
  const PLAYER_PAL = {
    h: '#5e3a1a', H: '#9a6a34', S: '#e8b88a', E: '#1a1010', B: '#5b6b3a',
    J: '#4a3a2c', j: '#2e241c', P: '#2e3040', K: '#3a2414', L: '#ffe070', l: '#7a5a20',
  };
  const P_TOP = [
    '....hhhh....',
    '...hHHHHh...',
    '.hhHHHHHHhh.',
    '...SSSSS....',
    '...SSSES....',
    '....SSS.....',
    '..BJJJJJ....',
    '.BBJjJJJSS..',
    '.BBJjJJJ.ll.',
    '.BBJjJJJ.LL.',
    '..JJJJJJ.ll.',
  ];
  const P_LEGS = {
    idle: ['...PPPPP....', '...PP.PP....', '...PP.PP....', '...PP.PP....', '..KKK.KKK...'],
    runA: ['...PPPPP....', '..PP...PP...', '..PP....PP..', '.KK.....KK..', '.K.......K..'],
    runB: ['...PPPPP....', '....PPP.....', '....PP......', '....PP......', '...KKKK.....'],
    jump: ['...PPPPP....', '..PP..PP....', '..PP...PP...', '.KK....KK...', '............'],
  };
  const PSPR = {};
  for (const k in P_LEGS) {
    const r = sprite(P_TOP.concat(P_LEGS[k]), PLAYER_PAL);
    PSPR[k] = { r, l: flipped(r) };
  }
  const RUN_CYCLE = ['runA', 'idle', 'runB', 'idle'];

  const SPIDER_ROWS = [
    ['...rrrr...', '..rRRRRr..', '.krReReRk.', 'k.rRRRRr.k', '.k.k..k.k.', 'k..k..k..k'],
    ['...rrrr...', '..rRRRRr..', 'k.rReReR.k', '.krRRRRrk.', 'k.k....k.k', '.k.k..k.k.'],
  ];
  const SPIDER_PAL = { r: '#3a1e2e', R: '#6a2e4a', e: '#ff4040', k: '#4a2838' };
  const SPIDER = SPIDER_ROWS.map((r) => ({ img: sprite(r, SPIDER_PAL), eyes: findPixels(r, 'e') }));

  const BAT_ROWS = [
    ['w..........w', 'ww........ww', '.wwwbbbbwww.', '..wwbeebww..', '....bbbb....', '............'],
    ['............', '....bbbb....', '..wwbeebww..', '.wwwbbbbwww.', 'ww........ww', 'w..........w'],
  ];
  const BAT_PAL = { w: '#4a3a6a', b: '#5e4a80', e: '#ff4a4a' };
  const BAT = BAT_ROWS.map((r) => ({ img: sprite(r, BAT_PAL), eyes: findPixels(r, 'e') }));

  const NUGGET = sprite(['..yy..', '.yYYy.', 'yYWYYy', 'yYYYyy', '.yyyy.'],
    { y: '#b8860b', Y: '#ffd040', W: '#fff6c0' });
  const GEM = sprite(['..ccc..', '.cCWCc.', 'cCCWCCc', '.cCCCc.', '..cCc..', '...c...'],
    { c: '#1a6aa0', C: '#40c0ff', W: '#e0ffff' });
  const STAL = sprite([
    'aAAAAAAAAa', '.ahAAAAAa.', '.ahAAAAAa.', '..ahAAAa..', '..ahAAAa..', '...hAAa...',
    '...hAAa...', '...hAa....', '....Aa....', '....Aa....', '....a.....', '....a.....',
  ], { a: '#3a2818', A: '#6e5034', h: '#8e6c48' });

  // ================= Level aufbauen =================
  const ROWS = LEVEL_CHUNKS[0].length;
  const rowStrings = [];
  for (let r = 0; r < ROWS; r++) {
    let s = '';
    for (const chunk of LEVEL_CHUNKS) {
      const w = Math.max(...chunk.map((l) => l.length));
      let line = chunk[r] || '.';
      while (line.length < w) line += line[line.length - 1];
      s += line;
    }
    rowStrings.push(s);
  }
  const COLS = rowStrings[0].length;
  const LW = COLS * TS, LH = ROWS * TS;
  const grid = rowStrings.map((l) => l.split(''));
  const spawns = [];
  for (let y = 0; y < ROWS; y++)
    for (let x = 0; x < COLS; x++)
      if ('PsbovC*Tf'.includes(grid[y][x])) { spawns.push({ ch: grid[y][x], tx: x, ty: y }); grid[y][x] = '.'; }

  function tile(tx, ty) {
    if (tx < 0 || tx >= COLS || ty < 0) return '#';
    if (ty >= ROWS) return '.';
    return grid[ty][tx];
  }
  const isSolid = (c) => c === '#' || c === 'B';
  const solidAt = (px, py) => isSolid(tile(Math.floor(px / TS), Math.floor(py / TS)));

  // ---- Kacheln einmalig in eine große Leinwand zeichnen
  function drawRock(g, tx, ty) {
    const px = tx * TS, py = ty * TS;
    g.save();
    g.beginPath(); g.rect(px, py, TS, TS); g.clip();
    g.fillStyle = '#24180f'; g.fillRect(px, py, TS, TS);
    const cols = ['#3d2a1b', '#4a3322', '#543b27'];
    for (let i = 0; i < 5; i++) {
      const sx = px + Math.floor(hash(tx, ty, i * 7 + 1) * 13) - 2;
      const sy = py + Math.floor(hash(tx, ty, i * 7 + 2) * 13) - 2;
      const sw = 4 + Math.floor(hash(tx, ty, i * 7) * 5);
      const sh = 3 + Math.floor(hash(tx, ty, i * 7 + 3) * 4);
      g.fillStyle = cols[Math.floor(hash(tx, ty, i * 7 + 4) * 3)];
      g.fillRect(sx, sy, sw, sh);
      g.fillStyle = '#6a4c32'; g.fillRect(sx, sy, sw - 1, 1);
      g.fillStyle = '#150e08'; g.fillRect(sx + 1, sy + sh, sw - 1, 1);
    }
    if (!isSolid(tile(tx, ty - 1))) {
      for (let i = 0; i < TS; i++) {
        const h = 2 + Math.floor(hash(tx * 16 + i, ty, 99) * 3);
        g.fillStyle = '#7a5836'; g.fillRect(px + i, py, 1, h);
        g.fillStyle = '#a07a4a'; g.fillRect(px + i, py, 1, 1);
        g.fillStyle = '#3a2716'; g.fillRect(px + i, py + h, 1, 1);
      }
    }
    if (!isSolid(tile(tx, ty + 1))) {
      for (let i = 0; i < TS; i++) {
        const h = 1 + Math.floor(hash(tx * 16 + i, ty, 77) * 4);
        g.fillStyle = '#120c07'; g.fillRect(px + i, py + TS - h, 1, h);
      }
    }
    if (!isSolid(tile(tx - 1, ty))) { g.fillStyle = '#5e4430'; g.fillRect(px, py, 1, TS); }
    if (!isSolid(tile(tx + 1, ty))) { g.fillStyle = '#140d07'; g.fillRect(px + TS - 1, py, 1, TS); }
    g.restore();
  }
  function drawBrick(g, tx, ty) {
    const px = tx * TS, py = ty * TS;
    g.save();
    g.beginPath(); g.rect(px, py, TS, TS); g.clip();
    g.fillStyle = '#211a15'; g.fillRect(px, py, TS, TS);
    for (let row = 0; row < 2; row++) {
      const off = ((ty * 2 + row) % 2) * 8;
      for (let bx = -16; bx < TS; bx += 16) {
        const x = px + bx + off, y = py + row * 8;
        const v = hash(tx * 4 + bx, ty * 2 + row, 5);
        g.fillStyle = v < 0.33 ? '#4e443a' : v < 0.66 ? '#574b40' : '#463d34';
        g.fillRect(x, y, 15, 7);
        g.fillStyle = '#74675a'; g.fillRect(x, y, 15, 1);
        g.fillStyle = '#2f2822'; g.fillRect(x, y + 6, 15, 1);
      }
    }
    g.restore();
  }
  function drawPlank(g, tx, ty) {
    const px = tx * TS, py = ty * TS;
    g.fillStyle = '#3e2712'; g.fillRect(px, py, TS, 6);
    g.fillStyle = '#8a5e34'; g.fillRect(px, py, TS, 4);
    g.fillStyle = '#b07c46'; g.fillRect(px, py, TS, 1);
    g.fillStyle = '#3a2410'; g.fillRect(px + 7, py, 1, 5);
    g.fillStyle = '#c8b090'; g.fillRect(px + 2, py + 2, 1, 1); g.fillRect(px + 12, py + 2, 1, 1);
  }
  function drawBeam(g, tx, ty) {
    const px = tx * TS, py = ty * TS;
    g.fillStyle = '#3e2814'; g.fillRect(px + 5, py, 6, TS);
    g.fillStyle = '#5e3e20'; g.fillRect(px + 6, py, 3, TS);
    g.fillStyle = '#2a1a0a';
    for (let i = 0; i < 3; i++) g.fillRect(px + 6 + (i % 2), py + 2 + i * 5, 1, 3);
  }
  function drawSpikes(g, tx, ty) {
    const px = tx * TS, py = ty * TS;
    for (let k = 0; k < 4; k++) {
      const sx = px + k * 4;
      g.fillStyle = '#4a4e56';
      g.fillRect(sx + 1, py + 8, 2, 8);
      g.fillRect(sx, py + 12, 4, 4);
      g.fillStyle = '#b8c0c8'; g.fillRect(sx + 1, py + 7, 1, 4);
      g.fillStyle = '#7a8088'; g.fillRect(sx + 1, py + 11, 1, 3);
    }
  }
  const levelCanvas = makeCanvas(LW, LH);
  {
    const g = levelCanvas.getContext('2d');
    for (let y = 0; y < ROWS; y++)
      for (let x = 0; x < COLS; x++) {
        const c = grid[y][x];
        if (c === '#') drawRock(g, x, y);
        else if (c === 'B') drawBrick(g, x, y);
        else if (c === '=') drawPlank(g, x, y);
        else if (c === '|') drawBeam(g, x, y);
        else if (c === '^') drawSpikes(g, x, y);
      }
  }

  // ---- Hintergrund mit Parallaxe
  const BGW = 512;
  function genBackground() {
    let seed = 1;
    const rnd = () => hash(seed++, 7, 3);
    const far = makeCanvas(BGW, LH), g = far.getContext('2d');
    const grad = g.createLinearGradient(0, 0, 0, LH);
    grad.addColorStop(0, '#0b0d1a'); grad.addColorStop(1, '#151b30');
    g.fillStyle = grad; g.fillRect(0, 0, BGW, LH);
    for (let i = 0; i < 26; i++) {
      const x = rnd() * BGW, w = 10 + rnd() * 30, h = 20 + rnd() * 80;
      for (const ox of [-BGW, 0, BGW]) pixTri(g, x + ox, 0, w, h, 1, '#181e34');
    }
    for (let i = 0; i < 22; i++) {
      const x = rnd() * BGW, w = 14 + rnd() * 40, h = 30 + rnd() * 100;
      for (const ox of [-BGW, 0, BGW]) pixTri(g, x + ox, LH, w, h, -1, '#1a2138');
    }
    const mid = makeCanvas(BGW, LH), m = mid.getContext('2d');
    for (let i = 0; i < 6; i++) {
      const x = rnd() * BGW, w = 18 + rnd() * 28;
      for (let y = 0; y < LH; y += 2) {
        const ww = Math.round(w * (0.5 + 0.5 * Math.abs(Math.sin(y * 0.025 + i * 1.7))) + hash(i, y, 5) * 4);
        for (const ox of [-BGW, 0, BGW]) {
          const lx = Math.round(x + ox - ww / 2);
          m.fillStyle = '#222941'; m.fillRect(lx, y, ww, 2);
          m.fillStyle = '#2d3552'; m.fillRect(lx, y, 2, 2);
        }
      }
    }
    for (let i = 0; i < 18; i++) {
      const x = rnd() * BGW, w = 8 + rnd() * 16, h = 15 + rnd() * 45;
      for (const ox of [-BGW, 0, BGW]) pixTri(m, x + ox, 0, w, h, 1, '#1f2539');
    }
    return { far, mid };
  }
  const BG = genBackground();

  // Dunkelheit-Ebene für den Lichteffekt
  const dark = makeCanvas(W, H);
  const dg = dark.getContext('2d');

  // ================= Spielzustand =================
  let state = 'title';
  let score = 0, lives = START_LIVES, highscore = 0, newHigh = false;
  let entities = [], particles = [], floaters = [];
  let P = null, chest = null, startPos = null, checkpoint = null;
  let time = 0, dieT = 0, winT = 0, winBonus = 0, shake = 0, dripT = 3;
  const cam = { x: 0, y: 0 };

  try { highscore = parseInt(localStorage.getItem(HS_KEY), 10) || 0; } catch (e) { /* kein Speicher */ }
  function saveHigh() {
    if (score > highscore) {
      highscore = score; newHigh = true;
      try { localStorage.setItem(HS_KEY, String(highscore)); } catch (e) { /* ignorieren */ }
    }
  }

  function resetGame() {
    score = 0; lives = START_LIVES; newHigh = false;
    entities = []; particles = []; floaters = [];
    for (const s of spawns) {
      const px = s.tx * TS, py = s.ty * TS;
      switch (s.ch) {
        case 'P': startPos = { x: px + 4, y: py + TS - 15 }; break;
        case 's': entities.push({ type: 'spider', x: px + 3, y: py + TS - 6, w: 10, h: 6, vx: -25, t: hash(s.tx, s.ty, 2) * 3 }); break;
        case 'b': entities.push({ type: 'bat', bx: px + 2, by: py + 4, x: px + 2, y: py + 4, w: 12, h: 6, t: hash(s.tx, s.ty, 3) * 6 }); break;
        case 'o': entities.push({ type: 'gold', x: px + 5, y: py + 8, w: 6, h: 5, t: hash(s.tx, s.ty, 1) * 6 }); break;
        case '*': entities.push({ type: 'gem', x: px + 4, y: py + 6, w: 7, h: 6, t: hash(s.tx, s.ty, 1) * 6 }); break;
        case 'v': entities.push({ type: 'stal', x: px + 3, y: py, w: 10, h: 12, y0: py, state: 0, t: 0, vy: 0 }); break;
        case 'C': entities.push({ type: 'cp', x: px + 4, y: py, w: 8, h: 16, active: false }); break;
        case 'T': chest = { type: 'chest', x: px, y: py + 4, w: 16, h: 12, open: false }; entities.push(chest); break;
        case 'f': entities.push({ type: 'torch', x: px + 8, y: py + 8, w: 0, h: 0 }); break;
      }
    }
    checkpoint = { ...startPos };
    spawnPlayer();
  }

  function spawnPlayer() {
    P = {
      x: checkpoint.x, y: checkpoint.y, w: 8, h: 15, vx: 0, vy: 0, face: 1,
      onGround: false, onPlatform: false, coyote: 0, jumpBuf: 0, dropT: 0,
      inv: 1.0, hp: MAX_HP, animT: 0,
    };
    updateCamera(0, true);
  }

  function updateCamera(dt, snap) {
    const tx = clamp(P.x + P.w / 2 - W / 2 + P.face * 24, 0, LW - W);
    const ty = clamp(P.y + P.h / 2 - H / 2 - 8, 0, LH - H);
    if (snap) { cam.x = tx; cam.y = ty; return; }
    cam.x += (tx - cam.x) * Math.min(1, dt * 5);
    cam.y += (ty - cam.y) * Math.min(1, dt * 4);
  }

  // ================= Effekte =================
  function burst(x, y, n, colors, { speed = 80, grav = 300, life = 0.6, up = 0 } = {}) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = speed * (0.3 + Math.random() * 0.7);
      particles.push({
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - up, g: grav,
        life: life * (0.6 + Math.random() * 0.4), max: life,
        c: colors[Math.floor(Math.random() * colors.length)],
      });
    }
  }
  const floater = (x, y, text, color = '#ffe080') => floaters.push({ x, y, text, color, life: 1 });

  function updateEffects(dt) {
    for (const p of particles) { p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; }
    particles = particles.filter((p) => p.life > 0);
    for (const f of floaters) { f.y -= 20 * dt; f.life -= dt; }
    floaters = floaters.filter((f) => f.life > 0);
    if (shake > 0) shake -= dt;
  }

  // ================= Spieler =================
  function moveX(dt) {
    P.x += P.vx * dt;
    const y0 = Math.floor(P.y / TS), y1 = Math.floor((P.y + P.h - 0.01) / TS);
    if (P.vx > 0) {
      const tx = Math.floor((P.x + P.w) / TS);
      for (let ty = y0; ty <= y1; ty++) if (isSolid(tile(tx, ty))) { P.x = tx * TS - P.w; P.vx = 0; break; }
    } else if (P.vx < 0) {
      const tx = Math.floor(P.x / TS);
      for (let ty = y0; ty <= y1; ty++) if (isSolid(tile(tx, ty))) { P.x = (tx + 1) * TS; P.vx = 0; break; }
    }
  }
  function moveY(dt) {
    const prevBottom = P.y + P.h;
    P.y += P.vy * dt;
    P.onGround = false; P.onPlatform = false;
    const x0 = Math.floor(P.x / TS), x1 = Math.floor((P.x + P.w - 0.01) / TS);
    if (P.vy > 0) {
      const ty = Math.floor((P.y + P.h) / TS);
      let landed = false, solidHit = false;
      for (let tx = x0; tx <= x1; tx++) {
        const c = tile(tx, ty);
        if (isSolid(c)) { landed = true; solidHit = true; }
        else if (c === '=' && prevBottom <= ty * TS + 0.5 && P.dropT <= 0) landed = true;
      }
      if (landed) {
        P.y = ty * TS - P.h; P.vy = 0; P.onGround = true; P.onPlatform = !solidHit;
      }
    } else if (P.vy < 0) {
      const ty = Math.floor(P.y / TS);
      for (let tx = x0; tx <= x1; tx++) if (isSolid(tile(tx, ty))) { P.y = (ty + 1) * TS; P.vy = 0; break; }
    }
  }

  function hurt(amount, srcX) {
    if (P.inv > 0 || state !== 'play') return;
    P.hp -= amount;
    P.inv = 1.3;
    P.vy = -200;
    P.vx = (P.x + P.w / 2 < srcX ? -1 : 1) * 110;
    shake = 0.25;
    burst(P.x + 4, P.y + 6, 8, ['#ff6040', '#ffb080'], { speed: 60 });
    if (P.hp <= 0) { P.hp = 0; die(); } else sfx.hurt();
  }
  function die() {
    if (state !== 'play') return;
    lives--;
    state = 'dying';
    dieT = 1.8;
    P.vy = -260; P.vx = 0;
    shake = 0.35;
    sfx.die();
  }

  function updatePlayer(dt) {
    const dir = (keyR() ? 1 : 0) - (keyL() ? 1 : 0);
    if (dir) P.face = dir;
    const acc = P.onGround ? 12 : 7;
    P.vx += (dir * RUN - P.vx) * Math.min(1, acc * dt);
    if (!dir && Math.abs(P.vx) < 1) P.vx = 0;

    if (pressedJump()) P.jumpBuf = 0.13; else P.jumpBuf -= dt;
    P.coyote = P.onGround ? 0.1 : P.coyote - dt;
    if (P.dropT > 0) P.dropT -= dt;
    if (P.onGround && P.onPlatform && keyDown()) { P.dropT = 0.2; P.onGround = false; P.coyote = 0; }

    if (P.jumpBuf > 0 && P.coyote > 0) {
      P.vy = -JUMP_V; P.jumpBuf = 0; P.coyote = 0; P.onGround = false;
      sfx.jump();
      burst(P.x + 4, P.y + P.h, 4, ['#7a5836', '#a07a4a'], { speed: 30, grav: 100, life: 0.3 });
    }
    let g = GRAV;
    if (P.vy < 0 && !keyJump()) g *= 2.2; // variable Sprunghöhe
    P.vy = Math.min(P.vy + g * dt, MAX_FALL);

    const wasGround = P.onGround;
    moveX(dt);
    moveY(dt);
    if (!wasGround && P.onGround) burst(P.x + 4, P.y + P.h, 3, ['#7a5836'], { speed: 25, grav: 80, life: 0.25 });

    if (P.inv > 0) P.inv -= dt;
    P.animT = P.onGround ? P.animT + dt * Math.abs(P.vx) / 12 : 0;

    // Stacheln
    const x0 = Math.floor(P.x / TS), x1 = Math.floor((P.x + P.w) / TS);
    const y0 = Math.floor(P.y / TS), y1 = Math.floor((P.y + P.h) / TS);
    for (let ty = y0; ty <= y1; ty++)
      for (let tx = x0; tx <= x1; tx++)
        if (tile(tx, ty) === '^' && overlap(P, { x: tx * TS + 1, y: ty * TS + 9, w: 14, h: 7 })) {
          hurt(1, P.x + P.w / 2 + P.face);
          if (state === 'play') P.vy = -260;
        }

    if (P.y > LH + 24) { P.hp = 0; die(); }
  }

  // ================= Objekte =================
  function updateEntities(dt) {
    for (const e of entities) {
      if (e.dead) continue;
      switch (e.type) {
        case 'spider': {
          e.t += dt;
          e.x += e.vx * dt;
          const ahead = e.vx > 0 ? e.x + e.w : e.x;
          const tx = Math.floor(ahead / TS), ty = Math.floor((e.y + e.h - 1) / TS);
          const below = tile(tx, ty + 1);
          if (isSolid(tile(tx, ty)) || tile(tx, ty) === '^' || (!isSolid(below) && below !== '=')) {
            e.x -= e.vx * dt; e.vx = -e.vx;
          }
          hitEnemy(e);
          break;
        }
        case 'bat':
          e.t += dt;
          e.x = e.bx + Math.sin(e.t * 0.9) * 40;
          e.y = e.by + Math.sin(e.t * 2.6) * 10;
          hitEnemy(e);
          break;
        case 'gold':
        case 'gem':
          e.t += dt;
          if (state === 'play' && overlap(P, e)) {
            e.dead = true;
            const val = e.type === 'gold' ? 50 : 250;
            score += val;
            floater(e.x, e.y - 4, '+' + val);
            if (e.type === 'gold') { sfx.coin(); burst(e.x + 3, e.y + 2, 6, ['#ffd040', '#fff6c0']); }
            else { sfx.gem(); burst(e.x + 3, e.y + 3, 10, ['#40c0ff', '#e0ffff']); }
          }
          break;
        case 'stal':
          if (e.state === 0) {
            const pcx = P.x + P.w / 2;
            if (state === 'play' && Math.abs(pcx - (e.x + 5)) < 22 && P.y > e.y && P.y - e.y < 12 * TS) {
              e.state = 1; e.t = 0.45; sfx.crack();
            }
          } else if (e.state === 1) {
            e.t -= dt;
            if (e.t <= 0) e.state = 2;
          } else {
            e.vy = Math.min(e.vy + GRAV * dt, MAX_FALL);
            e.y += e.vy * dt;
            const hit = { x: e.x + 2, y: e.y, w: 6, h: 12 };
            if (state === 'play' && overlap(P, hit)) { hurt(2, e.x + 5); shatter(e); }
            else if (e.y > e.y0 + TS && solidAt(e.x + 5, e.y + e.h)) shatter(e);
            else if (e.y > LH) e.dead = true;
          }
          break;
        case 'cp':
          if (!e.active && state === 'play' && overlap(P, e)) {
            e.active = true;
            checkpoint = { x: e.x, y: e.y + 16 - 15 };
            P.hp = MAX_HP;
            sfx.checkpoint();
            floater(e.x - 14, e.y - 8, 'CHECKPOINT', '#ffe070');
            burst(e.x + 6, e.y + 4, 12, ['#ffe070', '#ffa030'], { speed: 50, grav: 50 });
          }
          break;
        case 'chest':
          if (!e.open && state === 'play' && overlap(P, e)) win();
          break;
      }
    }
    entities = entities.filter((e) => !e.dead);
  }

  function hitEnemy(e) {
    if (state !== 'play' || !overlap(P, e)) return;
    if (P.vy > 0 && P.y + P.h - P.vy * STEP <= e.y + 4) {
      e.dead = true;
      P.vy = keyJump() ? -JUMP_V : -220;
      score += 100;
      floater(e.x, e.y - 6, '+100');
      sfx.stomp();
      burst(e.x + e.w / 2, e.y + e.h / 2, 10, e.type === 'bat' ? ['#5e4a80', '#4a3a6a'] : ['#6a2e4a', '#3a1e2e']);
    } else {
      hurt(1, e.x + e.w / 2);
    }
  }

  function shatter(e) {
    e.dead = true;
    sfx.crash();
    shake = Math.max(shake, 0.15);
    burst(e.x + 5, e.y + e.h, 12, ['#6e5034', '#3a2818', '#8e6c48'], { speed: 70, up: 60 });
  }

  function win() {
    chest.open = true;
    state = 'win';
    winT = 0;
    winBonus = 5000 + lives * 500 + P.hp * 100;
    score += winBonus;
    P.vx = 0;
    sfx.win();
    saveHigh();
  }

  // ================= Update =================
  function update(dt) {
    time += dt;
    if (pressed.KeyM) { Sound.muted = !Sound.muted; }

    switch (state) {
      case 'title':
        if (pressedStart()) { resetGame(); state = 'play'; }
        break;
      case 'play':
        if (pressed.KeyP || pressed.Escape) { state = 'pause'; break; }
        updatePlayer(dt);
        updateEntities(dt);
        updateCamera(dt);
        dripT -= dt;
        if (dripT <= 0) { sfx.drip(); dripT = 3 + Math.random() * 6; }
        break;
      case 'pause':
        if (pressed.KeyP || pressed.Escape || pressed.Enter) state = 'play';
        break;
      case 'dying':
        P.vy = Math.min(P.vy + GRAV * dt, MAX_FALL);
        P.y += P.vy * dt;
        updateEntities(dt);
        dieT -= dt;
        if (dieT <= 0) {
          if (lives <= 0) { state = 'gameover'; saveHigh(); }
          else { spawnPlayer(); state = 'play'; }
        }
        break;
      case 'gameover':
        if (pressed.Enter) { resetGame(); state = 'play'; }
        break;
      case 'win':
        winT += dt;
        P.vy = Math.min(P.vy + GRAV * dt, MAX_FALL);
        moveY(dt);
        updateEntities(dt);
        updateCamera(dt);
        if (winT < 2.5 && Math.random() < 0.6)
          burst(chest.x + 8, chest.y + 2, 1, ['#ffd040', '#fff6c0', '#ffb020'], { speed: 50, up: 130, grav: 260, life: 1.2 });
        if (winT > 1.5 && pressed.Enter) { resetGame(); state = 'title'; }
        break;
    }
    updateEffects(dt);
  }

  // ================= Zeichnen =================
  function drawLayer(img, f, cx, cy) {
    const ox = -Math.floor((cx * f) % img.width);
    const oy = -Math.floor(cy * f);
    for (let x = ox; x < W; x += img.width) ctx.drawImage(img, x, oy);
  }

  function drawChest(x, y, open) {
    // Körper
    ctx.fillStyle = '#3a200c'; ctx.fillRect(x, y + 4, 16, 8);
    ctx.fillStyle = '#7a4620'; ctx.fillRect(x + 1, y + 5, 14, 6);
    ctx.fillStyle = '#e0b030'; ctx.fillRect(x + 1, y + 5, 2, 6); ctx.fillRect(x + 13, y + 5, 2, 6);
    if (open) {
      ctx.fillStyle = '#5a3010'; ctx.fillRect(x, y - 4, 16, 4);
      ctx.fillStyle = '#e0b030'; ctx.fillRect(x, y - 4, 16, 1);
      ctx.fillStyle = '#ffd040'; ctx.fillRect(x + 2, y + 1, 12, 4);
      ctx.fillStyle = '#fff6c0';
      const s = Math.floor(time * 8) % 4;
      ctx.fillRect(x + 3 + s * 3, y + 1, 1, 1);
      ctx.fillRect(x + 12 - s * 2, y + 3, 1, 1);
    } else {
      ctx.fillStyle = '#3a200c'; ctx.fillRect(x, y, 16, 5);
      ctx.fillStyle = '#9a5c2a'; ctx.fillRect(x + 1, y + 1, 14, 3);
      ctx.fillStyle = '#b87438'; ctx.fillRect(x + 1, y + 1, 14, 1);
      ctx.fillStyle = '#e0b030'; ctx.fillRect(x + 1, y, 2, 5); ctx.fillRect(x + 13, y, 2, 5);
      ctx.fillStyle = '#ffd860'; ctx.fillRect(x + 7, y + 3, 2, 3);
    }
  }

  function drawCheckpoint(e) {
    const x = e.x, y = e.y;
    ctx.fillStyle = '#3e2814'; ctx.fillRect(x + 2, y + 2, 2, 14);
    ctx.fillStyle = '#5e3e20'; ctx.fillRect(x + 2, y + 2, 6, 2);
    ctx.fillStyle = '#6a4a20'; ctx.fillRect(x + 6, y + 4, 1, 2);
    ctx.fillStyle = '#7a5a20'; ctx.fillRect(x + 5, y + 6, 3, 5);
    ctx.fillStyle = e.active ? (Math.random() < 0.9 ? '#ffe070' : '#ffb040') : '#3a3020';
    ctx.fillRect(x + 6, y + 7, 1, 3);
  }

  function drawTorch(e) {
    const x = e.x, y = e.y;
    ctx.fillStyle = '#3a3a40'; ctx.fillRect(x - 1, y + 2, 3, 5);
    ctx.fillStyle = '#5a3a1a'; ctx.fillRect(x - 1, y, 3, 2);
    const f = Math.floor(time * 12 + x) % 3;
    ctx.fillStyle = '#ff7a10'; ctx.fillRect(x - 2, y - 4 + (f === 1 ? 1 : 0), 5, 4);
    ctx.fillStyle = '#ffd060'; ctx.fillRect(x - 1, y - 3, 3, 3);
    ctx.fillStyle = '#fff4c0'; ctx.fillRect(x, y - 2 - (f === 2 ? 1 : 0), 1, 2);
  }

  function lanternPos() {
    const right = P.face > 0;
    return { x: P.x - 2 + (right ? 10 : 1), y: P.y - 1 + 9 };
  }

  function drawPlayer() {
    if (state === 'play' && P.inv > 0 && Math.floor(P.inv * 20) % 2) return;
    let k;
    if (state === 'dying' || !P.onGround) k = 'jump';
    else if (Math.abs(P.vx) > 10) k = RUN_CYCLE[Math.floor(P.animT) % 4];
    else k = 'idle';
    const img = P.face > 0 ? PSPR[k].r : PSPR[k].l;
    ctx.drawImage(img, Math.round(P.x - 2), Math.round(P.y - 1));
  }

  function collectLights(cx, cy) {
    const L = [];
    const add = (x, y, r, a, c, ga) => {
      if (x + r < cx || x - r > cx + W || y + r < cy || y - r > cy + H) return;
      L.push({ x: x - cx, y: y - cy, r, a, c, ga });
    };
    if (P && state !== 'title') {
      const lp = lanternPos();
      add(lp.x, lp.y, 74 + Math.sin(time * 13) * 1.5 + Math.random() * 1.5, 1, '255,170,70', 0.05);
    } else if (P) {
      const lp = lanternPos();
      add(lp.x, lp.y, 74, 1, '255,170,70', 0.05);
    }
    for (const e of entities) {
      if (e.type === 'torch') add(e.x, e.y - 2, 48 + Math.random() * 3, 0.9, '255,140,40', 0.05);
      else if (e.type === 'cp' && e.active) add(e.x + 6, e.y + 8, 40 + Math.random() * 2, 0.85, '255,190,80', 0.05);
      else if (e.type === 'gem') add(e.x + 3, e.y + 3, 14, 0.7, '80,180,255', 0.08);
      else if (e.type === 'gold') add(e.x + 3, e.y + 2, 9, 0.5);
      else if (e.type === 'bat' || e.type === 'spider') add(e.x + e.w / 2, e.y + e.h / 2, 12, 0.45, '255,60,60', 0.04);
      else if (e.type === 'chest') add(e.x + 8, e.y + 4, e.open ? 70 : 34, 0.9, '255,200,60', e.open ? 0.09 : 0.06);
    }
    return L;
  }

  function renderLighting(lights) {
    dg.globalCompositeOperation = 'source-over';
    dg.clearRect(0, 0, W, H);
    dg.fillStyle = 'rgba(2,1,6,0.86)';
    dg.fillRect(0, 0, W, H);
    dg.globalCompositeOperation = 'destination-out';
    const n = 5;
    for (const l of lights) {
      dg.fillStyle = `rgba(0,0,0,${0.45 * l.a})`;
      for (let i = 0; i < n; i++) circle(dg, l.x, l.y, l.r * (1 - i / n));
    }
    ctx.drawImage(dark, 0, 0);
    ctx.globalCompositeOperation = 'lighter';
    for (const l of lights) {
      if (!l.c) continue;
      ctx.fillStyle = `rgba(${l.c},${l.ga})`;
      for (let i = 0; i < 3; i++) circle(ctx, l.x, l.y, l.r * (0.55 - i * 0.15));
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  function renderWorld() {
    let sx = 0, sy = 0;
    if (shake > 0) { sx = (Math.random() - 0.5) * 4; sy = (Math.random() - 0.5) * 4; }
    const cx = clamp(Math.round(cam.x + sx), 0, LW - W);
    const cy = clamp(Math.round(cam.y + sy), 0, LH - H);

    ctx.fillStyle = '#07080f';
    ctx.fillRect(0, 0, W, H);
    drawLayer(BG.far, 0.25, cx, cy);
    drawLayer(BG.mid, 0.5, cx, cy);
    ctx.drawImage(levelCanvas, cx, cy, W, H, 0, 0, W, H);

    ctx.save();
    ctx.translate(-cx, -cy);
    const eyes = [];
    for (const e of entities) {
      if (e.x + 20 < cx || e.x - 20 > cx + W) continue;
      switch (e.type) {
        case 'torch': drawTorch(e); break;
        case 'cp': drawCheckpoint(e); break;
        case 'chest': drawChest(e.x, e.y, e.open); break;
        case 'gold': ctx.drawImage(NUGGET, Math.round(e.x), Math.round(e.y + Math.sin(e.t * 3) * 1.5)); break;
        case 'gem': ctx.drawImage(GEM, Math.round(e.x), Math.round(e.y + Math.sin(e.t * 3) * 1.5)); break;
        case 'stal': {
          const jx = e.state === 1 ? Math.round((Math.random() - 0.5) * 2) : 0;
          ctx.drawImage(STAL, Math.round(e.x + jx), Math.round(e.y));
          break;
        }
        case 'spider': {
          const fr = SPIDER[Math.floor(e.t * 8) % 2];
          const x = Math.round(e.x), y = Math.round(e.y);
          ctx.drawImage(fr.img, x, y);
          for (const [ex, ey] of fr.eyes) eyes.push(x + ex, y + ey);
          break;
        }
        case 'bat': {
          const fr = BAT[Math.floor(e.t * 8) % 2];
          const x = Math.round(e.x), y = Math.round(e.y);
          ctx.drawImage(fr.img, x, y);
          for (const [ex, ey] of fr.eyes) eyes.push(x + ex, y + ey);
          break;
        }
      }
    }
    if (P && state !== 'title') drawPlayer();
    else if (P) drawPlayer();
    for (const p of particles) {
      ctx.globalAlpha = clamp(p.life / p.max, 0, 1);
      ctx.fillStyle = p.c;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), 1, 1);
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    renderLighting(collectLights(cx, cy));

    // Augen leuchten im Dunkeln
    ctx.fillStyle = '#ff4a4a';
    for (let i = 0; i < eyes.length; i += 2) ctx.fillRect(eyes[i] - cx, eyes[i + 1] - cy, 1, 1);

    for (const f of floaters) {
      ctx.globalAlpha = clamp(f.life * 2, 0, 1);
      drawText(f.text, f.x - cx, f.y - cy, f.color);
    }
    ctx.globalAlpha = 1;
  }

  function renderHUD() {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, 13);
    drawText('SCORE ' + pad(score), 6, 4);
    drawText('LIVES ' + Math.max(0, lives), 124, 4);
    drawText('HP', 216, 4);
    const bx = 228;
    ctx.fillStyle = '#f0dca0';
    ctx.fillRect(bx, 3, 1, 7); ctx.fillRect(bx, 3, 2, 1); ctx.fillRect(bx, 9, 2, 1);
    const ex = bx + 3 + MAX_HP * 10;
    ctx.fillRect(ex, 3, 1, 7); ctx.fillRect(ex - 1, 3, 2, 1); ctx.fillRect(ex - 1, 9, 2, 1);
    for (let i = 0; i < MAX_HP; i++) {
      const x = bx + 3 + i * 10;
      if (i < (P ? P.hp : MAX_HP)) { ctx.fillStyle = '#f0dca0'; ctx.fillRect(x, 4, 8, 5); }
      else { ctx.fillStyle = '#f0dca0'; ctx.strokeStyle = '#f0dca0'; ctx.fillRect(x, 4, 8, 1); ctx.fillRect(x, 8, 8, 1); ctx.fillRect(x, 4, 1, 5); ctx.fillRect(x + 7, 4, 1, 5); }
    }
    if (Sound.muted) drawText('M', W - 8, 4, '#806a50');
  }

  function dim(a) { ctx.fillStyle = `rgba(0,0,0,${a})`; ctx.fillRect(0, 0, W, H); }
  const blink = () => Math.floor(time * 2.5) % 2 === 0;

  function render() {
    renderWorld();
    switch (state) {
      case 'title':
        dim(0.5);
        drawTextC('CAVE RUN', 34, '#ffd060', 4);
        drawTextC('FINDE DEN VERLORENEN GOLDSCHATZ', 64, '#c8b088');
        if (blink()) drawTextC('ENTER ODER LEERTASTE ZUM STARTEN', 92, '#ffffff');
        drawTextC('PFEILE / A D: LAUFEN    LEERTASTE / W: SPRINGEN', 128, '#a89070');
        drawTextC('PFEIL RUNTER: DURCH PLANKE    P: PAUSE    M: TON', 138, '#a89070');
        drawTextC('HIGHSCORE ' + pad(highscore), 160, '#f0dca0');
        break;
      case 'pause':
        renderHUD(); dim(0.5);
        drawTextC('PAUSE', 74, '#ffd060', 3);
        drawTextC('P ZUM WEITERSPIELEN', 100, '#c8b088');
        break;
      case 'gameover':
        renderHUD(); dim(0.65);
        drawTextC('GAME OVER', 54, '#ff6040', 3);
        drawTextC('PUNKTE ' + pad(score), 88, '#f0dca0');
        drawTextC('HIGHSCORE ' + pad(highscore), 100, '#f0dca0');
        if (newHigh) drawTextC('NEUER HIGHSCORE!', 114, '#ffd060');
        if (blink()) drawTextC('ENTER: NOCHMAL VERSUCHEN', 140, '#ffffff');
        break;
      case 'win':
        renderHUD();
        if (winT > 1) {
          dim(Math.min(0.55, (winT - 1) * 0.5));
          drawTextC('SCHATZ GEFUNDEN!', 40, '#ffd060', 2);
          drawTextC('BONUS +' + winBonus, 72, '#fff6c0');
          drawTextC('PUNKTE ' + pad(score), 86, '#f0dca0');
          drawTextC('HIGHSCORE ' + pad(highscore), 98, '#f0dca0');
          if (newHigh) drawTextC('NEUER HIGHSCORE!', 112, '#ffd060');
          if (winT > 1.5 && blink()) drawTextC('ENTER: ZUM TITEL', 140, '#ffffff');
        }
        break;
      default:
        renderHUD();
    }
  }

  // Debug-Hilfe (z. B. in der Browser-Konsole: caveRun.teleport(120, 8))
  window.caveRun = {
    get player() { return P; },
    get state() { return state; },
    get score() { return score; },
    get lives() { return lives; },
    tile,
    teleport(tx, ty) {
      checkpoint = { x: tx * TS + 4, y: (ty + 1) * TS - 15 };
      spawnPlayer();
      if (state === 'title') state = 'play';
    },
  };

  // ================= Hauptschleife =================
  resetGame();
  let last = performance.now(), acc = 0;
  function frame(now) {
    acc += Math.min(0.1, (now - last) / 1000);
    last = now;
    while (acc >= STEP) {
      update(STEP);
      for (const k in pressed) delete pressed[k];
      acc -= STEP;
    }
    render();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
