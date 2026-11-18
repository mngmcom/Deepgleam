'use strict';
(() => {
  // ================= Konstanten =================
  const W = 320, H = 180, TS = 16;
  const STEP = 1 / 60;
  const GRAV = 950, JUMP_V = 330, RUN = 95, MAX_FALL = 420;
  const MAX_HP = 6, START_LIVES = 3;
  const SHIELD_TIME = 8, DOUBLE_TIME = 12; // Dauer der Spezial-Items in Sekunden
  const HS_KEY = 'deepgleam.highscore';
  const HS_KEY_OLD = 'caverun.highscore';

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
  // Sprite + gespiegelte Variante + Augenpositionen (leuchten im Dunkeln)
  function monsterFrames(frames, pal) {
    return frames.map((rows) => {
      const img = sprite(rows, pal), w = rows[0].length;
      const eyes = findPixels(rows, 'e');
      return { r: img, l: flipped(img), eyesR: eyes, eyesL: eyes.map(([x, y]) => [w - 1 - x, y]) };
    });
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

  // ================= Pixel-Schrift (3x5, Umlaute mit Punkten) =================
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
  const UMLAUT = { 'Ä': 'A', 'Ö': 'O', 'Ü': 'U' };
  const textWidth = (s, sc = 1) => s.length * 4 * sc - sc;
  function textRaw(s, x, y, color, sc) {
    ctx.fillStyle = color;
    for (let i = 0; i < s.length; i++) {
      const um = UMLAUT[s[i]];
      const g = FONT[um || s[i]];
      if (!g) continue;
      for (let r = 0; r < 5; r++)
        for (let c = 0; c < 3; c++)
          if (g[r][c] === '#') ctx.fillRect(x + (i * 4 + c) * sc, y + r * sc, sc, sc);
      if (um) {
        ctx.fillRect(x + i * 4 * sc, y - 2 * sc, sc, sc);
        ctx.fillRect(x + (i * 4 + 2) * sc, y - 2 * sc, sc, sc);
      }
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
    clink() { Sound.tone(1800, 0.08, { type: 'triangle', vol: 0.08 }); Sound.tone(2400, 0.1, { type: 'triangle', vol: 0.05, delay: 0.04 }); },
    hurt() { Sound.tone(180, 0.25, { type: 'sawtooth', slide: -120, vol: 0.08 }); },
    die() { [392, 330, 262, 196].forEach((f, i) => Sound.tone(f, 0.2, { delay: i * 0.16, vol: 0.1, type: 'triangle' })); },
    burn() { Sound.noise(0.5, { vol: 0.16, freq: 900 }); Sound.tone(300, 0.4, { type: 'sawtooth', slide: -220, vol: 0.06 }); },
    crack() { Sound.noise(0.18, { vol: 0.06, freq: 3000 }); },
    crash() { Sound.noise(0.3, { vol: 0.14, freq: 700 }); },
    crumble() { Sound.noise(0.35, { vol: 0.12, freq: 500 }); },
    shoot() { Sound.tone(420, 0.18, { type: 'triangle', slide: -240, vol: 0.06 }); Sound.noise(0.1, { vol: 0.04, freq: 2000 }); },
    glut() { Sound.tone(110, 0.25, { type: 'sine', slide: 220, vol: 0.08 }); },
    checkpoint() { [523, 659, 784, 1047].forEach((f, i) => Sound.tone(f, 0.12, { delay: i * 0.07, type: 'triangle', vol: 0.08 })); },
    clear() { [392, 523, 659, 784, 1047].forEach((f, i) => Sound.tone(f, 0.18, { delay: i * 0.1, type: 'triangle', vol: 0.09 })); },
    win() { [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => Sound.tone(f, 0.22, { delay: i * 0.13, type: 'triangle', vol: 0.1 })); },
    drip() { Sound.tone(1400 + Math.random() * 600, 0.08, { type: 'sine', slide: -900, vol: 0.035 }); },
    power() { [523, 784, 1047, 1568, 2093].forEach((f, i) => Sound.tone(f, 0.1, { delay: i * 0.05, type: 'square', vol: 0.05 })); },
    bubble() { Sound.tone(70 + Math.random() * 40, 0.2, { type: 'sine', slide: 60, vol: 0.05 }); },
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

  const SPIDER = monsterFrames([
    ['...rrrr...', '..rRRRRr..', '.krReReRk.', 'k.rRRRRr.k', '.k.k..k.k.', 'k..k..k..k'],
    ['...rrrr...', '..rRRRRr..', 'k.rReReR.k', '.krRRRRrk.', 'k.k....k.k', '.k.k..k.k.'],
  ], { r: '#3a1e2e', R: '#6a2e4a', e: '#ff4040', k: '#4a2838' });

  const BAT = monsterFrames([
    ['w..........w', 'ww........ww', '.wwwbbbbwww.', '..wwbeebww..', '....bbbb....', '............'],
    ['............', '....bbbb....', '..wwbeebww..', '.wwwbbbbwww.', 'ww........ww', 'w..........w'],
  ], { w: '#4a3a6a', b: '#5e4a80', e: '#ff4a4a' });

  // Kristallkäfer (Level 2): Panzer + ausfahrbare Kristallstacheln
  const BEETLE = monsterFrames([
    ['....dddddd....', '..ddDDHDDDdd..', '.dDDDHDDDDDDd.', 'dDDDDDDDDDDDed', 'dddddddddddddd', '.k..k...k..k..', 'k..k...k..k...'],
    ['....dddddd....', '..ddDDHDDDdd..', '.dDDDHDDDDDDd.', 'dDDDDDDDDDDDed', 'dddddddddddddd', '..k..k...k..k.', '.k..k...k..k..'],
  ], { d: '#1e3a5a', D: '#2e5a8a', H: '#6ab0e0', e: '#ff4a4a', k: '#14243a' });
  const BEETLE_SPIKES = sprite(
    ['..c...c...c...', '..c..cCc..c...', '.cCc.cCc.cCc..', '.cCc.cCc.cCc..', 'cCCCcCCCcCCCc.'],
    { c: '#60c0ff', C: '#e0faff' });
  const BEETLE_SPIKES_L = flipped(BEETLE_SPIKES);

  // Sporenpilz (Level 3)
  const SHROOM = monsterFrames([[
    '...pppppp...', '.pPPWWPPPPp.', 'pPPWWPPPWPPp', 'pPPPPPPPPPPp', '.pppppppppp.', '....SSSS....',
    '...SeSSeS...', '...SSSSSS...', '...SSmmSS...', '....SSSS....', '...ssssss...',
  ]], { p: '#5a1a5a', P: '#9a3aa0', W: '#e0a0e8', S: '#d8d0b0', s: '#8a8070', e: '#ff3030', m: '#401020' });

  // Glutling (Level 4)
  const GLUT_PAL = { o: '#c02a08', O: '#ff6a10', Y: '#ffc030', W: '#fff4c0', e: '#401000', m: '#801800' };
  const GLUT_BODY = ['..oOOOoo..', '.oOYYYOOo.', '.OYYWYYYO.', 'oOYeYYeYOo', 'oOYYYYYYOo', '.OYYmmYYO.', '..OOYYOO..', '...oOOo...'];
  const GLUT = [
    sprite(['....o.....', '...ooo.o..'].concat(GLUT_BODY), GLUT_PAL),
    sprite(['......o...', '..o.ooo...'].concat(GLUT_BODY), GLUT_PAL),
  ];

  const NUGGET = sprite(['..yy..', '.yYYy.', 'yYWYYy', 'yYYYyy', '.yyyy.'],
    { y: '#b8860b', Y: '#ffd040', W: '#fff6c0' });
  const GEM = sprite(['..ccc..', '.cCWCc.', 'cCCWCCc', '.cCCCc.', '..cCc..', '...c...'],
    { c: '#1a6aa0', C: '#40c0ff', W: '#e0ffff' });
  // Spezial-Items: Schild (unverwundbar) und Doppelgold (Gold zählt doppelt)
  const SHIELD_ITEM = sprite(
    ['.kkkkkk.', 'kWWCCCCk', 'kWCCCCck', 'kCCWCCck', 'kCCCCcck', '.kCCCck.', '.kCccck.', '..kcck..', '...kk...'],
    { k: '#1a4a6a', C: '#60d0ff', c: '#3090c0', W: '#e8ffff' });
  const DOUBLE_ITEM = sprite(
    ['..yyyyy..', '.yYYYYYy.', 'yYWddYYYy', 'yYYYYdYYy', 'yYYYdYYYy', 'yYYdYYYYy', 'yYYdddYYy', '.yYYYYYy.', '..yyyyy..'],
    { y: '#b8860b', Y: '#ffd040', W: '#fff6c0', d: '#8a5a08' });
  const STAL_ROWS = [
    'aAAAAAAAAa', '.ahAAAAAa.', '.ahAAAAAa.', '..ahAAAa..', '..ahAAAa..', '...hAAa...',
    '...hAAa...', '...hAa....', '....Aa....', '....Aa....', '....a.....', '....a.....',
  ];

  // ================= Themen (Farbwelten der Level) =================
  const THEMES = {
    earth: {
      rock: { base: '#24180f', stones: ['#3d2a1b', '#4a3322', '#543b27'], hl: '#6a4c32', sh: '#150e08', crust: '#7a5836', crustHl: '#a07a4a', crustSh: '#3a2716', under: '#120c07', edgeL: '#5e4430', edgeR: '#140d07' },
      brick: { mortar: '#211a15', a: '#4e443a', b: '#574b40', c: '#463d34', hl: '#74675a', sh: '#2f2822' },
      bg: { top: '#0b0d1a', bottom: '#151b30', far: '#181e34', far2: '#1a2138', mid: '#222941', midHl: '#2d3552', mid2: '#1f2539' },
      spike: ['#4a4e56', '#b8c0c8', '#7a8088'],
      stal: { a: '#3a2818', A: '#6e5034', h: '#8e6c48' },
      dark: '2,1,6',
    },
    crystal: {
      rock: { base: '#141a2a', stones: ['#232c44', '#2a3550', '#313d5c'], hl: '#4a5c86', sh: '#0a0d16', crust: '#3e5a8a', crustHl: '#7ab0e0', crustSh: '#1a2440', under: '#080a12', edgeL: '#3a4a70', edgeR: '#0a0d16' },
      brick: { mortar: '#141826', a: '#3a4460', b: '#424e6c', c: '#353e58', hl: '#6a7aa0', sh: '#20263a' },
      bg: { top: '#060a18', bottom: '#0c1630', far: '#0e1a36', far2: '#10203e', mid: '#162a4e', midHl: '#1e3866', mid2: '#122444' },
      spike: ['#2a5a8a', '#c0f0ff', '#60a8e0'],
      stal: { a: '#2a4a7a', A: '#5aa0e0', h: '#c0ecff' },
      dark: '1,2,8',
    },
    fungus: {
      rock: { base: '#161a10', stones: ['#262c1a', '#2e3520', '#353d24'], hl: '#4c5634', sh: '#0b0d07', crust: '#3e5a2a', crustHl: '#6a9a44', crustSh: '#1e2a14', under: '#0a0c06', edgeL: '#3a4428', edgeR: '#0b0d07' },
      brick: { mortar: '#1a1c14', a: '#40463a', b: '#4a5042', c: '#3a4034', hl: '#646c58', sh: '#262a20' },
      bg: { top: '#070c08', bottom: '#0f1a12', far: '#122016', far2: '#14261a', mid: '#1a3020', midHl: '#22402a', mid2: '#16281c' },
      spike: ['#4a5a3a', '#c0d8a0', '#7a9a5a'],
      stal: { a: '#2a3420', A: '#4e5e38', h: '#7a8e5a' },
      dark: '2,5,2',
    },
    lava: {
      rock: { base: '#1c0e0a', stones: ['#2e1812', '#3a1e16', '#44241a'], hl: '#5e3424', sh: '#0e0604', crust: '#5a2a18', crustHl: '#8a4428', crustSh: '#2a120a', under: '#0c0503', edgeL: '#4a2a1c', edgeR: '#0e0604' },
      brick: { mortar: '#1e100c', a: '#4a3028', b: '#54362c', c: '#402a22', hl: '#6e4a3c', sh: '#2a1812' },
      bg: { top: '#140604', bottom: '#2a0c06', far: '#2a0e08', far2: '#30120a', mid: '#3a160c', midHl: '#4a1e10', mid2: '#32140a' },
      spike: ['#5a2a1a', '#ffb080', '#a04a2a'],
      stal: { a: '#2a120a', A: '#4e281a', h: '#7a4030' },
      dark: '6,1,0',
    },
  };

  // ================= Level-Daten (werden pro Level geladen) =================
  let levelIdx = 0, level = null, theme = THEMES.earth;
  let ROWS = 0, COLS = 0, LW = 0, LH = 0;
  let grid = [], spawns = [], lavaTiles = [], crumbles = [];
  let levelCanvas = null, BG = null, STAL = null;

  function tile(tx, ty) {
    if (tx < 0 || tx >= COLS || ty < 0) return '#';
    if (ty >= ROWS) return '.';
    return grid[ty][tx];
  }
  const isSolid = (c) => c === '#' || c === 'B';
  const isPlatform = (c) => c === '=' || c === '%';
  const solidAt = (px, py) => isSolid(tile(Math.floor(px / TS), Math.floor(py / TS)));

  // ---- Kacheln einmalig in eine große Leinwand zeichnen
  function drawRock(g, tx, ty) {
    const R = theme.rock;
    const px = tx * TS, py = ty * TS;
    g.save();
    g.beginPath(); g.rect(px, py, TS, TS); g.clip();
    g.fillStyle = R.base; g.fillRect(px, py, TS, TS);
    for (let i = 0; i < 5; i++) {
      const sx = px + Math.floor(hash(tx, ty, i * 7 + 1) * 13) - 2;
      const sy = py + Math.floor(hash(tx, ty, i * 7 + 2) * 13) - 2;
      const sw = 4 + Math.floor(hash(tx, ty, i * 7) * 5);
      const sh = 3 + Math.floor(hash(tx, ty, i * 7 + 3) * 4);
      g.fillStyle = R.stones[Math.floor(hash(tx, ty, i * 7 + 4) * 3)];
      g.fillRect(sx, sy, sw, sh);
      g.fillStyle = R.hl; g.fillRect(sx, sy, sw - 1, 1);
      g.fillStyle = R.sh; g.fillRect(sx + 1, sy + sh, sw - 1, 1);
    }
    if (!isSolid(tile(tx, ty - 1))) {
      for (let i = 0; i < TS; i++) {
        const h = 2 + Math.floor(hash(tx * 16 + i, ty, 99) * 3);
        g.fillStyle = R.crust; g.fillRect(px + i, py, 1, h);
        g.fillStyle = R.crustHl; g.fillRect(px + i, py, 1, 1);
        g.fillStyle = R.crustSh; g.fillRect(px + i, py + h, 1, 1);
      }
    }
    if (!isSolid(tile(tx, ty + 1))) {
      for (let i = 0; i < TS; i++) {
        const h = 1 + Math.floor(hash(tx * 16 + i, ty, 77) * 4);
        g.fillStyle = R.under; g.fillRect(px + i, py + TS - h, 1, h);
      }
    }
    if (!isSolid(tile(tx - 1, ty))) { g.fillStyle = R.edgeL; g.fillRect(px, py, 1, TS); }
    if (!isSolid(tile(tx + 1, ty))) { g.fillStyle = R.edgeR; g.fillRect(px + TS - 1, py, 1, TS); }
    g.restore();
  }
  function drawBrick(g, tx, ty) {
    const B = theme.brick;
    const px = tx * TS, py = ty * TS;
    g.save();
    g.beginPath(); g.rect(px, py, TS, TS); g.clip();
    g.fillStyle = B.mortar; g.fillRect(px, py, TS, TS);
    for (let row = 0; row < 2; row++) {
      const off = ((ty * 2 + row) % 2) * 8;
      for (let bx = -16; bx < TS; bx += 16) {
        const x = px + bx + off, y = py + row * 8;
        const v = hash(tx * 4 + bx, ty * 2 + row, 5);
        g.fillStyle = v < 0.33 ? B.a : v < 0.66 ? B.b : B.c;
        g.fillRect(x, y, 15, 7);
        g.fillStyle = B.hl; g.fillRect(x, y, 15, 1);
        g.fillStyle = B.sh; g.fillRect(x, y + 6, 15, 1);
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
    const [dark, light, mid] = theme.spike;
    const px = tx * TS, py = ty * TS;
    for (let k = 0; k < 4; k++) {
      const sx = px + k * 4;
      g.fillStyle = dark;
      g.fillRect(sx + 1, py + 8, 2, 8);
      g.fillRect(sx, py + 12, 4, 4);
      g.fillStyle = light; g.fillRect(sx + 1, py + 7, 1, 4);
      g.fillStyle = mid; g.fillRect(sx + 1, py + 11, 1, 3);
    }
  }
  function renderLevelCanvas() {
    const c = makeCanvas(LW, LH);
    const g = c.getContext('2d');
    for (let y = 0; y < ROWS; y++)
      for (let x = 0; x < COLS; x++) {
        const ch = grid[y][x];
        if (ch === '#') drawRock(g, x, y);
        else if (ch === 'B') drawBrick(g, x, y);
        else if (ch === '=') drawPlank(g, x, y);
        else if (ch === '|') drawBeam(g, x, y);
        else if (ch === '^') drawSpikes(g, x, y);
      }
    return c;
  }

  // ---- Hintergrund mit Parallaxe
  const BGW = 512;
  function genBackground() {
    const C = theme.bg;
    let seed = 1 + levelIdx * 1000;
    const rnd = () => hash(seed++, 7, 3);
    const far = makeCanvas(BGW, LH), g = far.getContext('2d');
    const grad = g.createLinearGradient(0, 0, 0, LH);
    grad.addColorStop(0, C.top); grad.addColorStop(1, C.bottom);
    g.fillStyle = grad; g.fillRect(0, 0, BGW, LH);
    for (let i = 0; i < 26; i++) {
      const x = rnd() * BGW, w = 10 + rnd() * 30, h = 20 + rnd() * 70;
      for (const ox of [-BGW, 0, BGW]) pixTri(g, x + ox, 0, w, h, 1, C.far);
    }
    for (let i = 0; i < 22; i++) {
      const x = rnd() * BGW, w = 14 + rnd() * 40, h = 30 + rnd() * 80;
      for (const ox of [-BGW, 0, BGW]) pixTri(g, x + ox, LH, w, h, -1, C.far2);
    }
    const mid = makeCanvas(BGW, LH), m = mid.getContext('2d');
    for (let i = 0; i < 6; i++) {
      const x = rnd() * BGW, w = 18 + rnd() * 28;
      for (let y = 0; y < LH; y += 2) {
        const ww = Math.round(w * (0.5 + 0.5 * Math.abs(Math.sin(y * 0.025 + i * 1.7))) + hash(i, y, 5) * 4);
        for (const ox of [-BGW, 0, BGW]) {
          const lx = Math.round(x + ox - ww / 2);
          m.fillStyle = C.mid; m.fillRect(lx, y, ww, 2);
          m.fillStyle = C.midHl; m.fillRect(lx, y, 2, 2);
        }
      }
    }
    for (let i = 0; i < 18; i++) {
      const x = rnd() * BGW, w = 8 + rnd() * 16, h = 15 + rnd() * 40;
      for (const ox of [-BGW, 0, BGW]) pixTri(m, x + ox, 0, w, h, 1, C.mid2);
    }
    return { far, mid };
  }

  // Dunkelheit-Ebene für den Lichteffekt
  const dark = makeCanvas(W, H);
  const dg = dark.getContext('2d');

  // ================= Spielzustand =================
  let state = 'title';
  let score = 0, lives = START_LIVES, highscore = 0, newHigh = false, levelStartScore = 0;
  let entities = [], particles = [], floaters = [];
  let P = null, startPos = null, checkpoint = null;
  let time = 0, dieT = 0, winT = 0, winBonus = 0, clearT = 0, clearBonus = 0;
  let shake = 0, ambT = 3, introT = 0;
  const cam = { x: 0, y: 0 };

  try {
    // Highscore aus der Zeit vor der Umbenennung übernehmen
    highscore = parseInt(localStorage.getItem(HS_KEY) ?? localStorage.getItem(HS_KEY_OLD), 10) || 0;
  } catch (e) { /* kein Speicher */ }
  function saveHigh() {
    if (score > highscore) {
      highscore = score; newHigh = true;
      try { localStorage.setItem(HS_KEY, String(highscore)); } catch (e) { /* ignorieren */ }
    }
  }

  function loadLevel(idx) {
    levelIdx = idx;
    level = LEVELS[idx];
    theme = THEMES[level.theme] || THEMES.earth;
    const chunks = level.chunks;
    ROWS = chunks[0].length;
    const rowStrings = [];
    for (let r = 0; r < ROWS; r++) {
      let s = '';
      for (const chunk of chunks) {
        const w = Math.max(...chunk.map((l) => l.length));
        let line = chunk[r] || '.';
        while (line.length < w) line += line[line.length - 1];
        s += line;
      }
      rowStrings.push(s);
    }
    COLS = rowStrings[0].length;
    LW = COLS * TS; LH = ROWS * TS;
    grid = rowStrings.map((l) => l.split(''));
    spawns = []; lavaTiles = []; crumbles = [];
    for (let y = 0; y < ROWS; y++)
      for (let x = 0; x < COLS; x++) {
        const ch = grid[y][x];
        if ('PsbovC*TfEKGLxmSD'.includes(ch)) {
          spawns.push({ ch, tx: x, ty: y });
          grid[y][x] = ch === 'L' ? '~' : '.';
        }
      }
    for (let y = 0; y < ROWS; y++)
      for (let x = 0; x < COLS; x++) {
        if (grid[y][x] === '~') lavaTiles.push({ tx: x, ty: y, surface: tile(x, y - 1) !== '~' });
        if (grid[y][x] === '%') crumbles.push({ tx: x, ty: y, state: 0, t: 0 });
      }
    levelCanvas = renderLevelCanvas();
    BG = genBackground();
    STAL = sprite(STAL_ROWS, theme.stal);
    buildEntities();
    levelStartScore = score;
    checkpoint = { ...startPos };
    particles = []; floaters = [];
    spawnPlayer();
    introT = 3;
  }

  function buildEntities() {
    entities = [];
    for (const s of spawns) {
      const px = s.tx * TS, py = s.ty * TS;
      const r = hash(s.tx, s.ty, 2);
      switch (s.ch) {
        case 'P': startPos = { x: px + 4, y: py + TS - 15 }; break;
        case 's': entities.push({ type: 'spider', x: px + 3, y: py + TS - 6, w: 10, h: 6, vx: -25, t: r * 3 }); break;
        case 'b': entities.push({ type: 'bat', bx: px + 2, by: py + 4, x: px + 2, y: py + 4, w: 12, h: 6, t: r * 6 }); break;
        case 'K': entities.push({ type: 'beetle', x: px + 1, y: py + TS - 7, w: 14, h: 7, vx: -18, t: r * 3, cyc: r * 3.2 }); break;
        case 'G': entities.push({ type: 'shroom', x: px + 2, y: py + TS - 11, w: 12, h: 11, cool: 1 + r * 1.5, puff: 0 }); break;
        case 'L': entities.push({ type: 'glut', x: px + 3, y: py + 4, home: py + 4, w: 10, h: 10, state: 0, t: 1 + r * 2, vy: 0, f: 0 }); break;
        case 'o': entities.push({ type: 'gold', x: px + 5, y: py + 8, w: 6, h: 5, t: r * 6 }); break;
        case '*': entities.push({ type: 'gem', x: px + 4, y: py + 6, w: 7, h: 6, t: r * 6 }); break;
        case 'v': entities.push({ type: 'stal', x: px + 3, y: py, w: 10, h: 12, y0: py, state: 0, t: 0, vy: 0 }); break;
        case 'C': entities.push({ type: 'cp', x: px + 4, y: py, w: 8, h: 16, active: false }); break;
        case 'S': entities.push({ type: 'shield', x: px + 4, y: py + 4, w: 8, h: 9, t: r * 6 }); break;
        case 'D': entities.push({ type: 'double', x: px + 3, y: py + 4, w: 9, h: 9, t: r * 6 }); break;
        case 'T': entities.push({ type: 'chest', x: px, y: py + 4, w: 16, h: 12, open: false }); break;
        case 'E': entities.push({ type: 'exit', x: px, y: py - 8, w: 16, h: 24, hb: { x: px + 4, y: py, w: 8, h: 16 } }); break;
        case 'f': entities.push({ type: 'torch', x: px + 8, y: py + 8, w: 0, h: 0 }); break;
        case 'x': entities.push({ type: 'crystal', x: px, y: py, w: 0, h: 0, v: r }); break;
        case 'm': entities.push({ type: 'mushroom', x: px, y: py, w: 0, h: 0, v: r }); break;
      }
    }
  }

  function spawnPlayer() {
    P = {
      x: checkpoint.x, y: checkpoint.y, w: 8, h: 15, vx: 0, vy: 0, face: 1,
      onGround: false, onPlatform: false, standing: [], coyote: 0, jumpBuf: 0, dropT: 0,
      inv: 1.0, hp: MAX_HP, animT: 0, shield: 0, dbl: 0,
    };
    // Bröckelplatten wiederherstellen, damit man nie feststeckt
    for (const c of crumbles) { c.state = 0; c.t = 0; grid[c.ty][c.tx] = '%'; }
    updateCamera(0, true);
  }

  function startGame() {
    score = 0; lives = START_LIVES; newHigh = false;
    loadLevel(0);
    state = 'play';
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
    if (introT > 0) introT -= dt;
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
    P.onGround = false; P.onPlatform = false; P.standing = [];
    const x0 = Math.floor(P.x / TS), x1 = Math.floor((P.x + P.w - 0.01) / TS);
    if (P.vy > 0) {
      const ty = Math.floor((P.y + P.h) / TS);
      let landed = false, solidHit = false;
      for (let tx = x0; tx <= x1; tx++) {
        const c = tile(tx, ty);
        if (isSolid(c)) { landed = true; solidHit = true; }
        else if (isPlatform(c) && prevBottom <= ty * TS + 0.5 && P.dropT <= 0) { landed = true; P.standing.push([tx, ty]); }
      }
      if (landed) {
        P.y = ty * TS - P.h; P.vy = 0; P.onGround = true; P.onPlatform = !solidHit;
      } else P.standing = [];
    } else if (P.vy < 0) {
      const ty = Math.floor(P.y / TS);
      for (let tx = x0; tx <= x1; tx++) if (isSolid(tile(tx, ty))) { P.y = (ty + 1) * TS; P.vy = 0; break; }
    }
  }

  function hurt(amount, srcX) {
    if (P.inv > 0 || P.shield > 0 || state !== 'play' || window.deepgleam.god) return;
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
      burst(P.x + 4, P.y + P.h, 4, [theme.rock.crust, theme.rock.crustHl], { speed: 30, grav: 100, life: 0.3 });
    }
    let g = GRAV;
    if (P.vy < 0 && !keyJump()) g *= 2.2; // variable Sprunghöhe
    P.vy = Math.min(P.vy + g * dt, MAX_FALL);

    const wasGround = P.onGround;
    moveX(dt);
    moveY(dt);
    if (!wasGround && P.onGround) burst(P.x + 4, P.y + P.h, 3, [theme.rock.crust], { speed: 25, grav: 80, life: 0.25 });

    // Bröckelplatten unter den Füßen aktivieren
    for (const [tx, ty] of P.standing) {
      const c = crumbles.find((k) => k.tx === tx && k.ty === ty);
      if (c && c.state === 0) { c.state = 1; c.t = 0.45; sfx.crack(); }
    }

    if (P.inv > 0) P.inv -= dt;
    if (P.shield > 0) P.shield -= dt;
    if (P.dbl > 0) {
      P.dbl -= dt;
      if (Math.random() < 0.15)
        burst(P.x + Math.random() * P.w, P.y + Math.random() * P.h, 1, ['#ffd040', '#fff6c0'], { speed: 10, grav: -30, life: 0.5 });
    }
    P.animT = P.onGround ? P.animT + dt * Math.abs(P.vx) / 12 : 0;

    // Stacheln und Lava
    const x0 = Math.floor(P.x / TS), x1 = Math.floor((P.x + P.w) / TS);
    const y0 = Math.floor(P.y / TS), y1 = Math.floor((P.y + P.h) / TS);
    for (let ty = y0; ty <= y1; ty++)
      for (let tx = x0; tx <= x1; tx++) {
        const c = tile(tx, ty);
        if (c === '^' && P.shield <= 0 && overlap(P, { x: tx * TS + 1, y: ty * TS + 9, w: 14, h: 7 })) {
          hurt(1, P.x + P.w / 2 + P.face);
          if (state === 'play') P.vy = -260;
        } else if (c === '~' && state === 'play' && P.y + P.h > ty * TS + 7) {
          burst(P.x + 4, ty * TS + 6, 20, ['#ff6a10', '#ffc030', '#fff4c0'], { speed: 90, up: 80 });
          sfx.burn();
          P.hp = 0;
          die();
        }
      }

    if (state === 'play' && P.y > LH + 24) { P.hp = 0; die(); }
  }

  function updateCrumbles(dt) {
    for (const c of crumbles) {
      if (c.state === 1) {
        c.t -= dt;
        if (c.t <= 0) {
          c.state = 2; c.t = 3.5;
          grid[c.ty][c.tx] = '.';
          sfx.crumble();
          burst(c.tx * TS + 8, c.ty * TS + 3, 10, [theme.rock.crust, theme.rock.crustHl, theme.rock.sh], { speed: 40, grav: 400, life: 0.8 });
        }
      } else if (c.state === 2) {
        c.t -= dt;
        if (c.t <= 0 && !overlap(P, { x: c.tx * TS, y: c.ty * TS, w: TS, h: TS })) {
          c.state = 0; grid[c.ty][c.tx] = '%';
        }
      }
    }
  }

  // ================= Objekte und Monster =================
  function walk(e, dt) {
    e.x += e.vx * dt;
    const ahead = e.vx > 0 ? e.x + e.w : e.x;
    const tx = Math.floor(ahead / TS), ty = Math.floor((e.y + e.h - 1) / TS);
    const here = tile(tx, ty), below = tile(tx, ty + 1);
    if (isSolid(here) || here === '^' || here === '~' || (!isSolid(below) && !isPlatform(below))) {
      e.x -= e.vx * dt; e.vx = -e.vx;
    }
  }

  // mode: 'stomp' = per Kopfsprung besiegbar, 'spiked' = Kopfsprung verletzt, 'never' = nur ausweichen
  function defeat(e, points, colors, bounce) {
    e.dead = true;
    if (bounce) P.vy = keyJump() ? -JUMP_V : -220;
    score += points;
    floater(e.x, e.y - 6, '+' + points);
    sfx.stomp();
    burst(e.x + e.w / 2, e.y + e.h / 2, 12, colors);
  }

  // Mit Schild werden besiegbare Monster bei jeder Berührung besiegt, der Glutling ist harmlos.
  function hitEnemy(e, box, points, mode, colors) {
    if (state !== 'play' || !overlap(P, box)) return;
    const fromAbove = P.vy > 0 && P.y + P.h - P.vy * STEP <= box.y + 4;
    if (P.shield > 0) {
      if (mode !== 'never') defeat(e, points, colors, fromAbove);
    } else if (fromAbove && mode === 'stomp') {
      defeat(e, points, colors, true);
    } else if (fromAbove && mode === 'spiked') {
      hurt(1, e.x + e.w / 2);
      P.vy = -280;
    } else {
      hurt(1, e.x + e.w / 2);
    }
  }

  const BEETLE_CYCLE = 3.2, BEETLE_WARN = 1.6, BEETLE_OUT = 1.9;

  function updateEntities(dt) {
    for (let i = 0; i < entities.length; i++) {
      const e = entities[i];
      if (e.dead) continue;
      switch (e.type) {
        case 'spider':
          e.t += dt; walk(e, dt);
          hitEnemy(e, e, 100, 'stomp', ['#6a2e4a', '#3a1e2e']);
          break;
        case 'bat':
          e.t += dt;
          e.x = e.bx + Math.sin(e.t * 0.9) * 40;
          e.y = e.by + Math.sin(e.t * 2.6) * 10;
          hitEnemy(e, e, 100, 'stomp', ['#5e4a80', '#4a3a6a']);
          break;
        case 'beetle': {
          e.t += dt; walk(e, dt);
          const prev = e.cyc;
          e.cyc = (e.cyc + dt) % BEETLE_CYCLE;
          const spiked = e.cyc >= BEETLE_OUT;
          if (prev < BEETLE_OUT && spiked && Math.abs(e.x - P.x) < W) sfx.clink();
          const box = spiked ? { x: e.x, y: e.y - 5, w: e.w, h: e.h + 5 } : e;
          hitEnemy(e, box, 200, spiked ? 'spiked' : 'stomp', ['#60c0ff', '#e0faff', '#2e5a8a']);
          break;
        }
        case 'shroom': {
          if (e.puff > 0) e.puff -= dt;
          const dx = P.x + P.w / 2 - (e.x + 6), dy = P.y + P.h / 2 - (e.y + 3);
          if (state === 'play' && Math.abs(dx) < 170 && Math.abs(dy) < 110) {
            e.cool -= dt;
            if (e.cool <= 0) {
              e.cool = 2.4; e.puff = 0.25;
              const d = Math.hypot(dx, dy) || 1;
              entities.push({ type: 'spore', x: e.x + 4, y: e.y + 1, w: 4, h: 4, vx: dx / d * 55, vy: dy / d * 55, life: 4, t: 0 });
              sfx.shoot();
              burst(e.x + 6, e.y + 2, 5, ['#a0ff60', '#e0ffc0'], { speed: 30, grav: 0, life: 0.4 });
            }
          }
          hitEnemy(e, e, 200, 'stomp', ['#9a3aa0', '#e0a0e8', '#d8d0b0']);
          break;
        }
        case 'spore':
          e.t += dt; e.life -= dt;
          e.x += e.vx * dt; e.y += e.vy * dt + Math.sin(e.t * 8) * 0.3;
          if (e.life <= 0 || solidAt(e.x + 2, e.y + 2)) {
            e.dead = true;
            burst(e.x + 2, e.y + 2, 5, ['#a0ff60', '#60c040'], { speed: 30, grav: 0, life: 0.4 });
          } else if (state === 'play' && overlap(P, e)) {
            e.dead = true;
            hurt(1, e.x + 2);
            burst(e.x + 2, e.y + 2, 6, ['#a0ff60', '#60c040'], { speed: 40, grav: 0, life: 0.4 });
          }
          break;
        case 'glut':
          e.f += dt;
          if (e.state === 0) {
            e.t -= dt;
            if (e.t < 0.6 && Math.random() < 0.25)
              burst(e.x + 5, e.home + 2, 1, ['#ffc030', '#ff6a10'], { speed: 15, up: 40, grav: 60, life: 0.4 });
            if (e.t <= 0) {
              e.state = 1; e.vy = -(320 + Math.random() * 50);
              if (Math.abs(e.x - P.x) < W) sfx.glut();
            }
          } else {
            e.vy += 700 * dt;
            e.y += e.vy * dt;
            if (Math.random() < 0.5) burst(e.x + 5, e.y + 8, 1, ['#ff6a10', '#ffc030'], { speed: 10, grav: -20, life: 0.4 });
            if (e.vy > 0 && e.y >= e.home) {
              e.y = e.home; e.state = 0; e.t = 1.4 + Math.random() * 1.6;
              burst(e.x + 5, e.home + 2, 6, ['#ff6a10', '#ffc030'], { speed: 40, up: 50, life: 0.5 });
            }
            hitEnemy(e, { x: e.x + 1, y: e.y + 2, w: 8, h: 8 }, 0, 'never');
          }
          break;
        case 'gold':
        case 'gem':
          e.t += dt;
          if (state === 'play' && overlap(P, e)) {
            e.dead = true;
            const doubled = e.type === 'gold' && P.dbl > 0;
            const val = e.type === 'gold' ? (doubled ? 100 : 50) : 250;
            score += val;
            floater(e.x, e.y - 4, '+' + val, doubled ? '#ffd040' : undefined);
            if (e.type === 'gold') { sfx.coin(); burst(e.x + 3, e.y + 2, 6, ['#ffd040', '#fff6c0']); }
            else { sfx.gem(); burst(e.x + 3, e.y + 3, 10, ['#40c0ff', '#e0ffff']); }
          }
          break;
        case 'shield':
        case 'double':
          e.t += dt;
          if (state === 'play' && overlap(P, e)) {
            e.dead = true;
            sfx.power();
            if (e.type === 'shield') {
              P.shield = SHIELD_TIME;
              floater(e.x - 10, e.y - 6, 'SCHILD!', '#80e0ff');
              burst(e.x + 4, e.y + 4, 16, ['#60d0ff', '#e8ffff', '#3090c0'], { speed: 70, grav: 80 });
            } else {
              P.dbl = DOUBLE_TIME;
              floater(e.x - 12, e.y - 6, 'GOLD X2!', '#ffd040');
              burst(e.x + 4, e.y + 4, 16, ['#ffd040', '#fff6c0', '#b8860b'], { speed: 70, grav: 80 });
            }
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
            else if (e.y > e.y0 + TS && (solidAt(e.x + 5, e.y + e.h) || tile(Math.floor((e.x + 5) / TS), Math.floor((e.y + e.h) / TS)) === '~')) shatter(e);
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
        case 'exit':
          if (state === 'play' && overlap(P, e.hb)) levelClear();
          break;
        case 'chest':
          if (!e.open && state === 'play' && overlap(P, e)) win(e);
          break;
      }
    }
    entities = entities.filter((e) => !e.dead);
  }

  function shatter(e) {
    e.dead = true;
    sfx.crash();
    shake = Math.max(shake, 0.15);
    const s = theme.stal;
    burst(e.x + 5, e.y + e.h, 12, [s.a, s.A, s.h], { speed: 70, up: 60 });
  }

  function levelClear() {
    state = 'clear';
    clearT = 0;
    clearBonus = 1000 + P.hp * 100;
    score += clearBonus;
    P.vx = 0;
    sfx.clear();
  }

  let chestOpen = null;
  function win(chest) {
    chest.open = true;
    chestOpen = chest;
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
        if (pressedStart()) startGame();
        break;
      case 'play':
        if (pressed.KeyP || pressed.Escape) { state = 'pause'; break; }
        updatePlayer(dt);
        updateCrumbles(dt);
        updateEntities(dt);
        updateCamera(dt);
        ambT -= dt;
        if (ambT <= 0) {
          if (level.theme === 'lava') { sfx.bubble(); ambT = 1.5 + Math.random() * 3; }
          else { sfx.drip(); ambT = 3 + Math.random() * 6; }
        }
        break;
      case 'pause':
        if (pressed.KeyP || pressed.Escape || pressed.Enter) state = 'play';
        break;
      case 'dying':
        P.vy = Math.min(P.vy + GRAV * dt, MAX_FALL);
        P.y += P.vy * dt;
        updateCrumbles(dt);
        updateEntities(dt);
        dieT -= dt;
        if (dieT <= 0) {
          if (lives <= 0) { state = 'gameover'; saveHigh(); }
          else { spawnPlayer(); state = 'play'; }
        }
        break;
      case 'gameover':
        if (pressed.Enter) {
          // Level neu starten, Punkte auf Levelbeginn zurücksetzen
          score = levelStartScore; lives = START_LIVES; newHigh = false;
          loadLevel(levelIdx);
          state = 'play';
        }
        break;
      case 'clear':
        clearT += dt;
        updateEntities(dt);
        if (clearT > 1 && pressed.Enter) {
          loadLevel(levelIdx + 1);
          state = 'play';
        }
        break;
      case 'win':
        winT += dt;
        P.vy = Math.min(P.vy + GRAV * dt, MAX_FALL);
        moveY(dt);
        updateEntities(dt);
        updateCamera(dt);
        if (winT < 2.5 && Math.random() < 0.6)
          burst(chestOpen.x + 8, chestOpen.y + 2, 1, ['#ffd040', '#fff6c0', '#ffb020'], { speed: 50, up: 130, grav: 260, life: 1.2 });
        if (winT > 1.5 && pressed.Enter) { score = 0; lives = START_LIVES; loadLevel(0); state = 'title'; }
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

  function drawExit(e) {
    const x = e.x, y = e.y;
    ctx.fillStyle = '#fff0c0'; ctx.fillRect(x + 3, y + 3, 10, 21);
    ctx.fillStyle = '#ffd890'; ctx.fillRect(x + 3, y + 3, 10, 4);
    ctx.fillStyle = '#ffe8b0'; ctx.fillRect(x + 3, y + 7, 10, 3);
    ctx.fillStyle = '#4a3018'; ctx.fillRect(x, y + 2, 3, 22); ctx.fillRect(x + 13, y + 2, 3, 22); ctx.fillRect(x - 1, y, 18, 3);
    ctx.fillStyle = '#7a5430'; ctx.fillRect(x + 1, y + 3, 1, 21); ctx.fillRect(x + 14, y + 3, 1, 21); ctx.fillRect(x - 1, y, 18, 1);
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

  function drawCrystalDeco(e) {
    const bx = e.x, by = e.y + TS;
    const shards = e.v < 0.5 ? [[3, 9], [7, 14], [11, 7]] : [[4, 11], [9, 8], [12, 5]];
    for (const [sx, h] of shards) {
      ctx.fillStyle = '#2a6aa8'; ctx.fillRect(bx + sx - 1, by - h + 2, 3, h - 2);
      ctx.fillStyle = '#7ad0ff'; ctx.fillRect(bx + sx, by - h, 1, h);
      ctx.fillStyle = '#f0ffff'; ctx.fillRect(bx + sx, by - h, 1, 2);
    }
  }

  function drawMushroomDeco(e) {
    const x = e.x + (e.v < 0.5 ? 2 : 6), y = e.y;
    ctx.fillStyle = '#c8d8b0'; ctx.fillRect(x + 3, y + 11, 2, 5);
    ctx.fillStyle = '#1a9a70'; ctx.fillRect(x, y + 8, 8, 3);
    ctx.fillStyle = '#4ae8b0'; ctx.fillRect(x + 1, y + 7, 6, 2);
    ctx.fillStyle = '#d0fff0'; ctx.fillRect(x + 2, y + 8, 1, 1); ctx.fillRect(x + 5, y + 7, 1, 1);
    if (e.v > 0.3) {
      ctx.fillStyle = '#c8d8b0'; ctx.fillRect(x + 9, y + 13, 1, 3);
      ctx.fillStyle = '#4ae8b0'; ctx.fillRect(x + 8, y + 11, 3, 2);
    }
  }

  function drawLava(cx) {
    for (const l of lavaTiles) {
      const x = l.tx * TS, y = l.ty * TS;
      if (x + TS < cx || x > cx + W) continue;
      if (l.surface) {
        ctx.fillStyle = '#a8280a'; ctx.fillRect(x, y + 6, TS, TS - 6);
        for (let i = 0; i < TS; i++) {
          const wv = Math.round(Math.sin(time * 3 + (x + i) * 0.35) * 1.2);
          ctx.fillStyle = '#ff6a12'; ctx.fillRect(x + i, y + 4 + wv, 1, 3);
          ctx.fillStyle = '#d8401a'; ctx.fillRect(x + i, y + 7 + wv, 1, 2);
          if (((x + i) * 7 + Math.floor(time * 6)) % 23 === 0) { ctx.fillStyle = '#ffd040'; ctx.fillRect(x + i, y + 4 + wv, 1, 1); }
        }
      } else {
        ctx.fillStyle = '#8a1e06'; ctx.fillRect(x, y, TS, TS);
        ctx.fillStyle = '#b8300c';
        const o = Math.floor(time * 4 + l.tx * 3) % 12;
        ctx.fillRect(x + o, y + 3, 3, 2);
        ctx.fillRect(x + ((o + 7) % 12), y + 10, 2, 2);
      }
    }
  }

  function drawCrumbles(cx) {
    const R = theme.rock;
    for (const c of crumbles) {
      if (c.state === 2) continue;
      const jx = c.state === 1 ? Math.round((Math.random() - 0.5) * 2) : 0;
      const x = c.tx * TS + jx, y = c.ty * TS;
      if (x + TS < cx || x > cx + W) continue;
      ctx.fillStyle = R.sh; ctx.fillRect(x, y, TS, 7);
      ctx.fillStyle = R.crust; ctx.fillRect(x, y, TS, 5);
      ctx.fillStyle = R.crustHl; ctx.fillRect(x, y, TS, 1);
      ctx.fillStyle = R.sh;
      ctx.fillRect(x + 5, y + 1, 1, 3); ctx.fillRect(x + 6, y + 3, 1, 2);
      ctx.fillRect(x + 11, y + 2, 1, 3);
      ctx.fillRect(x + 2, y + 7, 3, 1); ctx.fillRect(x + 9, y + 7, 4, 1);
    }
  }

  function lanternPos() {
    return { x: P.x - 2 + (P.face > 0 ? 10 : 1), y: P.y - 1 + 9 };
  }

  function drawPlayer() {
    if (state === 'play' && P.inv > 0 && Math.floor(P.inv * 20) % 2) return;
    let k;
    if (state === 'dying' || !P.onGround) k = 'jump';
    else if (Math.abs(P.vx) > 10) k = RUN_CYCLE[Math.floor(P.animT) % 4];
    else k = 'idle';
    const img = P.face > 0 ? PSPR[k].r : PSPR[k].l;
    if (state === 'clear') ctx.globalAlpha = Math.max(0, 1 - clearT * 1.5);
    ctx.drawImage(img, Math.round(P.x - 2), Math.round(P.y - 1));
    ctx.globalAlpha = 1;
    // Schild: kreisende Funken, blinken kurz vor dem Ablaufen
    if (P.shield > 0 && (P.shield > 2 || Math.floor(time * 10) % 2)) {
      const cx = P.x + P.w / 2, cy = P.y + P.h / 2;
      for (let i = 0; i < 6; i++) {
        const a = time * 4 + i * Math.PI / 3;
        ctx.fillStyle = i % 2 ? '#60d0ff' : '#e8ffff';
        ctx.fillRect(Math.round(cx + Math.cos(a) * 10), Math.round(cy + Math.sin(a) * 12), 1, 1);
      }
    }
  }

  function collectLights(cx, cy) {
    const L = [];
    const add = (x, y, r, a, c, ga) => {
      if (x + r < cx || x - r > cx + W || y + r < cy || y - r > cy + H) return;
      L.push({ x: x - cx, y: y - cy, r, a, c, ga });
    };
    const lp = lanternPos();
    const fl = state === 'title' ? 0 : Math.sin(time * 13) * 1.5 + Math.random() * 1.5;
    const lr = state === 'clear' ? 74 * Math.max(0, 1 - clearT) : 74 + fl;
    add(lp.x, lp.y, lr, 1, '255,170,70', 0.05);
    if (P.shield > 0) add(P.x + P.w / 2, P.y + P.h / 2, 26, 0.6, '90,200,255', 0.08);
    for (const e of entities) {
      switch (e.type) {
        case 'torch': add(e.x, e.y - 2, 48 + Math.random() * 3, 0.9, '255,140,40', 0.05); break;
        case 'cp': if (e.active) add(e.x + 6, e.y + 8, 40 + Math.random() * 2, 0.85, '255,190,80', 0.05); break;
        case 'gem': add(e.x + 3, e.y + 3, 14, 0.7, '80,180,255', 0.08); break;
        case 'gold': add(e.x + 3, e.y + 2, 9, 0.5); break;
        case 'shield': add(e.x + 4, e.y + 4, 22 + Math.sin(time * 4) * 2, 0.8, '90,200,255', 0.1); break;
        case 'double': add(e.x + 4, e.y + 4, 22 + Math.sin(time * 4) * 2, 0.8, '255,200,60', 0.1); break;
        case 'chest': add(e.x + 8, e.y + 4, e.open ? 70 : 34, 0.9, '255,200,60', e.open ? 0.09 : 0.06); break;
        case 'exit': add(e.x + 8, e.y + 14, 56, 1, '255,230,170', 0.06); break;
        case 'crystal': add(e.x + 8, e.y + 10, 26 + Math.sin(time * 2 + e.v * 9) * 2, 0.75, '90,170,255', 0.07); break;
        case 'mushroom': add(e.x + 8, e.y + 10, 22 + Math.sin(time * 1.5 + e.v * 9) * 2, 0.7, '60,255,170', 0.06); break;
        case 'bat': case 'spider': add(e.x + e.w / 2, e.y + e.h / 2, 12, 0.45, '255,60,60', 0.04); break;
        case 'beetle': add(e.x + 7, e.y + 2, e.cyc >= BEETLE_OUT ? 22 : 13, 0.55, '90,190,255', 0.06); break;
        case 'shroom': add(e.x + 6, e.y + 4, 16, 0.55, '200,80,220', 0.06); break;
        case 'spore': add(e.x + 2, e.y + 2, 11, 0.7, '140,255,80', 0.1); break;
        case 'glut': if (e.state === 1) add(e.x + 5, e.y + 5, 32, 0.85, '255,120,30', 0.08); break;
      }
    }
    for (const l of lavaTiles) if (l.surface && l.tx % 2 === 0) add(l.tx * TS + 8, l.ty * TS + 6, 30, 0.6, '255,90,20', 0.04);
    return L;
  }

  function renderLighting(lights) {
    dg.globalCompositeOperation = 'source-over';
    dg.clearRect(0, 0, W, H);
    dg.fillStyle = `rgba(${theme.dark},0.86)`;
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

  function drawEntity(e, eyes) {
    const x = Math.round(e.x), y = Math.round(e.y);
    const pushEyes = (list) => { for (const [ex, ey] of list) eyes.push(x + ex, y + ey); };
    switch (e.type) {
      case 'torch': drawTorch(e); break;
      case 'cp': drawCheckpoint(e); break;
      case 'chest': drawChest(e.x, e.y, e.open); break;
      case 'exit': drawExit(e); break;
      case 'crystal': drawCrystalDeco(e); break;
      case 'mushroom': drawMushroomDeco(e); break;
      case 'gold': ctx.drawImage(NUGGET, x, Math.round(e.y + Math.sin(e.t * 3) * 1.5)); break;
      case 'gem': ctx.drawImage(GEM, x, Math.round(e.y + Math.sin(e.t * 3) * 1.5)); break;
      case 'shield': ctx.drawImage(SHIELD_ITEM, x, Math.round(e.y + Math.sin(e.t * 3) * 1.5)); break;
      case 'double': ctx.drawImage(DOUBLE_ITEM, x, Math.round(e.y + Math.sin(e.t * 3) * 1.5)); break;
      case 'stal': ctx.drawImage(STAL, x + (e.state === 1 ? Math.round((Math.random() - 0.5) * 2) : 0), y); break;
      case 'spider': { const f = SPIDER[Math.floor(e.t * 8) % 2]; ctx.drawImage(f.r, x, y); pushEyes(f.eyesR); break; }
      case 'bat': { const f = BAT[Math.floor(e.t * 8) % 2]; ctx.drawImage(f.r, x, y); pushEyes(f.eyesR); break; }
      case 'beetle': {
        const f = BEETLE[Math.floor(e.t * 6) % 2], right = e.vx > 0;
        ctx.drawImage(right ? f.r : f.l, x, y);
        pushEyes(right ? f.eyesR : f.eyesL);
        if (e.cyc >= BEETLE_OUT) ctx.drawImage(right ? BEETLE_SPIKES : BEETLE_SPIKES_L, x, y - 5);
        else if (e.cyc >= BEETLE_WARN && Math.floor(time * 16) % 2) {
          ctx.fillStyle = '#60c0ff';
          for (const sx of [2, 6, 10]) ctx.fillRect(x + (right ? sx : 13 - sx), y - 1, 1, 1);
        }
        break;
      }
      case 'shroom': {
        const f = SHROOM[0], right = P.x > e.x;
        const sq = e.puff > 0 ? 1 : 0;
        ctx.drawImage(right ? f.r : f.l, x, y + sq);
        pushEyes((right ? f.eyesR : f.eyesL).map(([ex, ey]) => [ex, ey + sq]));
        break;
      }
      case 'spore':
        ctx.fillStyle = '#60c040'; ctx.fillRect(x, y + 1, 4, 2); ctx.fillRect(x + 1, y, 2, 4);
        ctx.fillStyle = '#e0ffc0'; ctx.fillRect(x + 1, y + 1, 2, 2);
        break;
      case 'glut':
        if (e.state === 1) {
          const img = GLUT[Math.floor(e.f * 10) % 2];
          if (e.vy > 0) { ctx.save(); ctx.translate(x, y + 10); ctx.scale(1, -1); ctx.drawImage(img, 0, 0); ctx.restore(); }
          else ctx.drawImage(img, x, y);
        }
        break;
    }
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
    drawCrumbles(cx);
    const eyes = [];
    for (const e of entities) {
      if (e.x + 24 < cx || e.x - 24 > cx + W) continue;
      drawEntity(e, eyes);
    }
    drawLava(cx);
    drawPlayer();
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
    drawText('LEVEL ' + (levelIdx + 1), 82, 4);
    drawText('LIVES ' + Math.max(0, lives), 140, 4);
    drawText('HP', 216, 4);
    const bx = 228;
    ctx.fillStyle = '#f0dca0';
    ctx.fillRect(bx, 3, 1, 7); ctx.fillRect(bx, 3, 2, 1); ctx.fillRect(bx, 9, 2, 1);
    const ex = bx + 3 + MAX_HP * 10;
    ctx.fillRect(ex, 3, 1, 7); ctx.fillRect(ex - 1, 3, 2, 1); ctx.fillRect(ex - 1, 9, 2, 1);
    for (let i = 0; i < MAX_HP; i++) {
      const x = bx + 3 + i * 10;
      if (i < P.hp) ctx.fillRect(x, 4, 8, 5);
      else { ctx.fillRect(x, 4, 8, 1); ctx.fillRect(x, 8, 8, 1); ctx.fillRect(x, 4, 1, 5); ctx.fillRect(x + 7, 4, 1, 5); }
    }
    if (Sound.muted) drawText('M', W - 8, 4, '#806a50');
    // Aktive Spezial-Items mit Restzeit, blinken in den letzten 2 Sekunden
    let hy = 16;
    const item = (img, label, t, color) => {
      if (t <= 0) return;
      if (t > 2 || Math.floor(time * 8) % 2) {
        ctx.drawImage(img, 6, hy);
        drawText(label + ' ' + Math.ceil(t), 18, hy + 2, color);
      }
      hy += 12;
    };
    item(SHIELD_ITEM, 'SCHILD', P.shield, '#80e0ff');
    item(DOUBLE_ITEM, 'GOLD X2', P.dbl, '#ffd040');
  }

  function renderIntro() {
    if (introT <= 0 || state === 'title') return;
    ctx.globalAlpha = clamp(introT, 0, 1);
    drawTextC('LEVEL ' + (levelIdx + 1), 36, '#ffd060', 2);
    drawTextC(level.name, 54, '#f0dca0', 1);
    ctx.globalAlpha = 1;
  }

  function dim(a) { ctx.fillStyle = `rgba(0,0,0,${a})`; ctx.fillRect(0, 0, W, H); }
  const blink = () => Math.floor(time * 2.5) % 2 === 0;

  function render() {
    renderWorld();
    switch (state) {
      case 'title':
        dim(0.5);
        drawTextC('DEEPGLEAM', 30, '#ffd060', 4);
        drawTextC('FINDE DEN VERLORENEN GOLDSCHATZ', 60, '#c8b088');
        drawTextC(LEVELS.length + ' LEVEL: ' + LEVELS.map((l) => l.name).join(' - '), 72, '#8a7860');
        if (blink()) drawTextC('ENTER ODER LEERTASTE ZUM STARTEN', 96, '#ffffff');
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
        if (blink()) drawTextC('ENTER: LEVEL ' + (levelIdx + 1) + ' NEU STARTEN', 140, '#ffffff');
        break;
      case 'clear':
        renderHUD();
        if (clearT > 0.6) {
          dim(Math.min(0.6, (clearT - 0.6) * 0.8));
          drawTextC('LEVEL GESCHAFFT!', 44, '#ffd060', 2);
          drawTextC('BONUS +' + clearBonus, 76, '#fff6c0');
          drawTextC('PUNKTE ' + pad(score), 90, '#f0dca0');
          drawTextC('NÄCHSTES LEVEL: ' + LEVELS[levelIdx + 1].name, 110, '#c8b088');
          if (clearT > 1 && blink()) drawTextC('ENTER: WEITER', 140, '#ffffff');
        }
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
        renderIntro();
    }
  }

  // Debug-Hilfe für die Browser-Konsole:
  //   deepgleam.level(3)          – direkt zu Level 3 springen
  //   deepgleam.teleport(120, 9)  – an Kachelspalte/-zeile versetzen
  //   deepgleam.god = true        – keinen Schaden nehmen (Lava/Abgrund bleiben tödlich)
  window.deepgleam = {
    god: false,
    get player() { return P; },
    get state() { return state; },
    get score() { return score; },
    get lives() { return lives; },
    get levelIndex() { return levelIdx; },
    tile: (x, y) => tile(x, y),
    level(n) {
      loadLevel(clamp((n | 0) - 1, 0, LEVELS.length - 1));
      state = 'play';
    },
    teleport(tx, ty) {
      checkpoint = { x: tx * TS + 4, y: (ty + 1) * TS - 15 };
      spawnPlayer();
      if (state === 'title') state = 'play';
    },
  };

  // ================= Hauptschleife =================
  loadLevel(0);
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
