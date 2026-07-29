"use strict";
// OptMem explainer.
// Rules: a screen is EITHER one sentence OR one picture, never both.
// One new thing per beat, held long enough to read it out loud twice.
// Pacing lives here: [kind, seconds, ...]; "co" = continue, no cut to white.
// In a sentence, *stars* mark the words that carry the idea.
//
// PACING BASELINE, measured on a real reader: a new word costs 0.27s to read;
// a number costs double, because it is read digit by digit. Nothing here is a
// hand-picked number. A sentence beat computes its own length AND when each
// of its lines appears -- a line lands only once the line above it has been
// read -- then holds one breath plus 20% of the whole reading time, the
// look-back over the finished slide. A picture beat is given the seconds its motion needs
// plus a HOLD of >= 2s: what a beat builds must sit still long enough to look
// at. Anything that streams (the log, the context) runs on ONE smooth curve
// from its first item to its last, so it never plateaus and never restarts.
// A slide marked "punch" is a punchline: it holds 30% longer.

const READ = 0.27;
const cost = s => s.replace(/[*+_]/g, "").trim().split(/\s+/)
                   .reduce((n, w) => n + (/\d/.test(w) ? 2 : 1), 0);

const co = "co", punch = "punch";
const BEATS = [
  ["say", "how to make an AI agent", "remember its +whole life+?"],
  ["say", "+IDEA:+", "a *memory* is one short note", "about something it *learned*"],
  ["one", 1], ["one", 2, co], ["one", 3, co], ["one", 4, co],
  ["say", "the agent writes memories", "into an +append-only log+"],
  ["log", 12.5],
  ["say", "_PROBLEM:_", "after *two months*, your agent's life", "would not fit in the model's context",
          "*1,000 memories* = *80,000 tokens*"],
  ["say", "*CURRENT SOLUTIONS:*", "one *small* long-term memory file", "_delete_ stale memories when it fills",
          "(Hermes caps it at 2,200 characters)"],
  ["prune", 5.2],
  ["say", "_PROBLEM:_", "you cannot tell *today*", "what will matter in a *year*"],
  ["say", "+OUR ANSWER:+", "OptMem +deletes nothing+"],
  ["say", "two memories +merge+ into one", punch],
  ["merge", 6.8],
  ["say", "the result is a memory too", "it just holds *less detail*"],
  ["fold", 8.0],
  ["say", "and again, all the way up"],
  ["tree", 9.2],
  ["say", "there is no background job", "*no dreaming*, no nightly cleanup", "each merge happens +on the spot+"],
  ["spot", 9.0],
  ["say", "so how does the agent", "read *all of it* at once?"],
  ["select", 6.6],
  ["fly", 4.0, co],
  ["doc", 6.5, co],
  ["step", 14.0, co],
  ["say", "the *memory context* +never grows+", "and *you* choose its size"],
  ["say", "nothing is ever deleted", "the originals are all +still there+"],
  ["recall", 6.8],
  ["say", "nothing to run, nothing to host", "OptMem is just some prompts and scripts",
          "it works in any harness, any environment", "just point your *AGENTS.md* to it, and done"],
  ["end", 6.5],
];

const W = 1280, H = 720;
const BG = "#ffffff", INK = "#151a20", DIM = "#6c7681", FAINT = "#aeb6bf";
const CARD = "#f6f8fa", EDGE = "#e2e7ec", GREEN = "#0f8a45", RED = "#cf2230";
const MONO = "Menlo,ui-monospace,monospace";

let cx = null;
function setCtx(c) { cx = c; }

// ------------------------------------------------------------------ helpers
const clamp = (x, a, b) => x < a ? a : x > b ? b : x;
const ease  = x => { x = clamp(x, 0, 1); return x*x*(3 - 2*x); };
const lerp  = (a, b, x) => a + (b - a)*x;
const num   = x => Math.round(x).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
const rnd   = i => { const s = Math.sin(i*12.9898)*43758.5453; return s - Math.floor(s); };

function font(size, bold) { cx.font = (bold ? "bold " : "") + size + "px " + MONO; }
function T(s, x, y, size, color, align, bold) {
  font(size, bold); cx.fillStyle = color; cx.textAlign = align || "left";
  cx.fillText(s, x, y); cx.textAlign = "left";
}
function fit(s, maxw, size) {
  font(size);
  if (cx.measureText(s).width <= maxw) return s;
  let lo = 0, hi = s.length;
  while (lo < hi) { const m = (lo + hi + 1) >> 1;
    if (cx.measureText(s.slice(0, m) + "\u2026").width <= maxw) lo = m; else hi = m - 1; }
  return s.slice(0, lo) + "\u2026";
}
// centred sentence with emphasis: *bold*  +green+  _red_
function rich(s, x, y, size) {
  const toks = [];
  for (let i = 0; i < s.length; ) {
    const c = s[i], j = "*+_".includes(c) ? s.indexOf(c, i + 1) : -1;
    if (j > i) { toks.push([s.slice(i + 1, j), c]); i = j + 1; continue; }
    let e = i + 1; while (e < s.length && !"*+_".includes(s[e])) e++;
    toks.push([s.slice(i, e), ""]); i = e;
  }
  let total = 0;
  toks.forEach(([p, m]) => { font(size, !!m); total += cx.measureText(p).width; });
  let px = x - total/2;
  toks.forEach(([p, m]) => {
    font(size, !!m);
    cx.fillStyle = m === "+" ? GREEN : m === "_" ? RED : INK;
    cx.fillText(p, px, y); px += cx.measureText(p).width;
  });
}
function box(x, y, w, h, r, fill, stroke, lw) {
  cx.beginPath(); cx.roundRect(x, y, Math.max(w, 0.5), Math.max(h, 0.5), r);
  if (fill) { cx.fillStyle = fill; cx.fill(); }
  if (stroke) { cx.strokeStyle = stroke; cx.lineWidth = lw || 1; cx.stroke(); cx.lineWidth = 1; }
}
function arrow(x, y0, y1, color) {
  cx.strokeStyle = color; cx.lineWidth = 2.5; cx.beginPath();
  cx.moveTo(x, y0); cx.lineTo(x, y1);
  cx.moveTo(x - 10, y1 - 12); cx.lineTo(x, y1); cx.lineTo(x + 10, y1 - 12);
  cx.stroke(); cx.lineWidth = 1;
}
function harrow(x0, x1, y, color) {
  cx.strokeStyle = color; cx.lineWidth = 2.5; cx.beginPath();
  cx.moveTo(x0, y); cx.lineTo(x1, y);
  cx.moveTo(x1 - 9, y - 8); cx.lineTo(x1, y); cx.lineTo(x1 - 9, y + 8);
  cx.stroke(); cx.lineWidth = 1;
}
// green = fresh detail, amber = old and broad
const lvl = (k, l) => `hsl(${clamp(148 - k*15, 24, 148)},64%,${l === undefined ? 40 : l}%)`;

// ------------------------------------------------------------------ content
// An agent that helps one person, Tom, with ordinary life. LVL[k] is what a
// block of 2^k memories sounds like. At 5 memories a day the ladder is
//   x1 one small thing  x32 a week  x256 two months  x4096 a couple of years
// so a line grows by holding MORE THREADS at LESS DETAIL, never by naming one
// bigger event. Spans are written out from x32 up, where the chip alone stops
// meaning anything to a first-time viewer.
const MEM = [
  "Tom asked for a flight to Japan",
  "Tom booked a hotel in Tokyo",
  "Tom loved how fresh sushi tastes",
  "Tom wants to go back to Japan",
  "Tom started running in the park",
  "Tom bought new running shoes",
  "Tom ran 5k without stopping",
  "Tom wants to try a marathon",
  "Tom left his charger at work",
  "Tom wants no calls before ten",
  "Tom does not eat coriander",
  "Tom paid the power bill",
  "Tom's train home was cancelled",
  "Tom had his first guitar lesson",
  "Tom booked a table for two",
  "Tom moved his meeting to 3pm",
  "Tom baked a cake for Ana",
  "Tom got good news at work",
  "Tom put 200 into savings",
  "Tom saw a house on Oak Street",
  "Tom hurt his arm on a ski trip",
  "Tom can use his arm again",
  "Tom's dog Pixel needs new food",
  "Tom likes short answers",
  "Tom's sister called from Berlin",
  "Tom forgot to buy milk",
];
const LVL = [MEM,
  ["Tom planned a Tokyo trip", "Tom will return to Tokyo", "Tom took up running",
   "Tom wants a marathon", "Tom sorted the vet and the bills",
   "Tom booked dinner with Ana", "Tom fixed his phone and his bike",
   "Tom called his sister in Berlin", "Tom saw a house and liked it",
   "Tom rested his arm and read"],
  ["Tom fell in love with Tokyo", "Tom became a runner",
   "Tom's day: vet, bills and a short run", "Tom's day: two calls and a long walk",
   "Tom's day: laundry, guitar and a film", "Tom's day: errands, then dinner out",
   "Tom's day: house viewings and rest", "Tom's day: a deadline and a slow run"],
  ["Tom loves Tokyo and running", "two days of chores, runs and guitar",
   "Tom did the taxes and ran twice", "Tom saw three houses and cooked a lot",
   "Tom worked late and walked Pixel", "Tom rested his arm and played guitar",
   "Tom shopped, cleaned and called Ana"],
  ["three days of work, runs and errands", "Tom finished a report and ran twice",
   "Tom saw four houses, none felt right", "Tom worked from home and healed",
   "Tom cooked, cleaned and saw his sister", "a short break: guitar, films, walks"],
  ["a week of deadlines, runs and dog walks", "a week of viewings and paperwork",
   "a busy week: a report, Ana, two runs", "a slow week: guitar, films and rest",
   "a week of travel plans and packing", "a week of work, gym and family calls"],
  ["two weeks of work, running and Pixel", "two weeks: viewings and long runs",
   "two weeks of guitar, films and errands", "two weeks: a deadline, then Ana came",
   "two weeks of travel plans and packing"],
  ["a month of deadlines, runs and viewings", "a month of guitar, walks and rest",
   "a month of saving money and eating in", "a month: Ana moved in, Pixel got sick",
   "a month of short trips and long runs"],
  ["two months: a new job, and Tokyo booked", "two months of house hunting and saving",
   "two months: a broken arm, then guitar", "two months of training for a first race",
   "two months: Ana, Pixel and a lot of work"],
  ["the season Tom saw Tokyo and changed jobs", "three months of hunting for a house",
   "three months of travel, runs and family", "the stretch when Tom's arm healed",
   "three months: new flat, new habits, Ana"],
  ["half a year: Tokyo, a new job, a race", "half a year of saving up for a house",
   "half a year: Tokyo, Ana and a new dog", "half a year of guitar, running and work"],
  ["the year Tom saw Tokyo and began to run", "a year of work, travel and a broken arm",
   "the year Ana moved in and Pixel arrived", "a year of saving, viewings and no luck"],
  ["two years: office to Tokyo, then a home", "two years of new jobs, runs and moves",
   "the years Tom found running and Ana", "two years: from renting to owning"],
  ["four years: Tokyo, three jobs, and Ana", "four years of moving, work and running",
   "the years Tom grew up and settled down", "four years: from a rented flat to a home"],
  ["nine years: Japan, running, Ana, a house", "nine years of jobs, moves and races",
   "the years Tom built the life he has", "nine years: from a shared flat to home"],
];
const SHORT = ["flight to Japan", "hotel in Tokyo", "loved the sushi", "wants to return",
               "started running", "new shoes", "ran 5k", "a marathon?"];
const NODE = {
  "0-2": "Tom planned a Tokyo trip",
  "2-4": "Tom will return to Tokyo",
  "4-6": "Tom took up running",
  "6-8": "Tom wants a marathon",
  "0-4": "Tom fell in love with Tokyo",
  "4-8": "Tom became a runner",
  "0-8": "Tom loves Tokyo and running",
};
// two blocks of the same size are always neighbours, so indexing by position
// within the level makes a repeated line in one context impossible
function blockText(lo, hi) {
  const k = Math.min(Math.log2(hi - lo), LVL.length - 1), t = LVL[k];
  return t[Math.floor(lo/(hi - lo)) % t.length];
}
// 5 memories a day; ages are always relative
const PER_DAY = 5;
function ageOf(lo, hi, n) {
  const d = (n - (lo + hi)/2)/PER_DAY;
  if (d < 1)   return "today";
  if (d < 2)   return "yesterday";
  if (d < 13)  return Math.round(d) + " days ago";
  if (d < 55)  return Math.round(d/7) + " weeks ago";
  if (d < 330) return "~" + Math.round(d/30) + " months ago";
  return "~" + (d/365).toFixed(1) + " years ago";
}

// ----------------------------------------------- cover (a port of ../memo)
function tiles(t, a) {
  let root = 1; while (root < t) root *= 2;
  const out = [], st = [[0, root]];
  while (st.length) {
    const [lo, hi] = st.pop();
    if (lo >= t) continue;
    const size = hi - lo;
    if (size > 1 && (hi > t || size > a*(t - lo))) {
      const mid = (lo + hi)/2; st.push([mid, hi]); st.push([lo, mid]);
    } else out.push([lo, hi]);
  }
  return out.sort((x, y) => x[0] - y[0]);
}
function cover(t, budget) {
  if (t <= 0) return [];
  if (t <= budget) return Array.from({length: t}, (_, i) => [i, i+1]);
  let lo = 0, hi = 1;
  for (let k = 0; k < 50; k++) {
    const mid = (lo + hi)/2;
    if (tiles(t, mid).length > budget) lo = mid; else hi = mid;
  }
  const out = tiles(t, hi);
  while (out.length < budget) {
    let i = -1;
    for (let j = out.length - 1; j >= 0; j--) if (out[j][1] - out[j][0] > 1) { i = j; break; }
    if (i < 0) break;
    const [l, h] = out[i], m = (l + h)/2;
    out.splice(i, 1, [l, m], [m, h]);
  }
  return out;
}

// -------------------------------------------------------------- the objects
function memCard(x, y, w, h, text, opt) {
  const o = opt || {}, k = o.k || 0, cw = o.chipW || 56;
  box(x, y, w, h, 7, o.hot ? "#ffffff" : CARD, o.hot ? lvl(k) : EDGE, o.hot ? 2.5 : 1.5);
  const fs = o.fs || clamp(h*0.38, 9, 19);
  let tx = x + 22;
  if (o.chip) {
    box(x + 12, y + h*0.2, cw, h*0.6, 5, lvl(k));
    T(o.chip, x + 12 + cw/2, y + h/2 + 5, o.fs ? 13 : 15, "#ffffff", "center", true);
    tx = x + 26 + cw;
  }
  if (h > 13) T(fit(text, x + w - tx - 20, fs), tx, y + h/2 + fs*0.36, fs, INK);
}
// the log as a window: it never scrolls. every memory stays inside the box,
// so as they pile up the rows simply get thinner and thinner. xf is a
// continuous count: whole memories sit at full alpha, the next one fades in
const WIN = { x: 268, y: 140, w: 744, h: 476 };
function logWindow(xf, aFrame) {
  const n = Math.ceil(xf), full = Math.floor(xf);
  const pitch = Math.min(56, WIN.h/n);
  const h = Math.max(pitch - clamp(pitch*0.16, 0.25, 9), 0.4);
  cx.globalAlpha = aFrame;
  box(WIN.x - 14, WIN.y - 14, WIN.w + 28, WIN.h + 28, 12, "#ffffff", EDGE, 1.5);
  T("LOG.txt", WIN.x - 14, WIN.y - 26, 16, DIM);
  cx.globalAlpha = 1;
  for (let i = 0; i < n; i++) {
    const y = WIN.y + i*pitch;
    cx.globalAlpha = i < full ? 1 : clamp((xf - full)*3, 0, 1);
    if (pitch > 15) memCard(WIN.x, y, WIN.w, h, MEM[i % MEM.length]);
    else box(WIN.x, y, WIN.w*(0.40 + 0.57*rnd(i)), h, pitch > 4 ? 1 : 0, "#c4ccd5");
    cx.globalAlpha = 1;
  }
  T(num(full) + (full === 1 ? " memory" : " memories"), W/2, WIN.y + WIN.h + 62, 24,
    full > 300 ? "#c2410c" : DIM, "center");
}
// the memory context: nine rows, whatever the log holds
const DOC = { x: 236, w: 812, y: 136, h: 46, gap: 6 };
const rowY = i => DOC.y + i*(DOC.h + DOC.gap);
function docRow(lo, hi, y, n, o) {
  o = o || {};
  const h = o.h === undefined ? DOC.h : o.h, k = Math.log2(hi - lo);
  cx.globalAlpha = o.a === undefined ? 1 : o.a;
  box(DOC.x, y, DOC.w, h, 7, o.hot ? "#fffdf5" : CARD, o.hot ? "#d98c00" : EDGE,
      o.hot ? 2.5 : 1.5);
  const ch = Math.min(26, h - 8);
  if (ch > 8) {
    box(DOC.x + 12, y + h/2 - ch/2, 58, ch, 5, lvl(k));
    if (ch > 20)
      T("\u00d7" + (hi - lo), DOC.x + 41, y + h/2 + 5, 15, "#ffffff", "center", true);
  }
  if (h > 32) {
    T(fit(blockText(lo, hi), 540, 17), DOC.x + 88, y + h/2 + 6, 17, INK);
    T(ageOf(lo, hi, n), DOC.x + DOC.w - 18, y + h/2 + 6, 15, DIM, "right");
  }
  if (o.flash > 0.02) {
    cx.globalAlpha = o.flash;
    box(DOC.x - 5, y - 5, DOC.w + 10, h + 10, 10, null, "#ffc400", 3);
  }
  cx.globalAlpha = 1;
}
function docFrame(n, a) {
  cx.globalAlpha = a === undefined ? 1 : a;
  rich("the *memory context* remains *constant-sized*", W/2, DOC.y - 26, 27);
  T(num(n) + " memories", W/2 - 195, rowY(9) + 42, 23, INK, "center");
  T("8k tokens, always", W/2 + 195, rowY(9) + 42, 23, GREEN, "center");
  cx.globalAlpha = 1;
}
// the tree of blocks: 512 memories at the bottom, one block per size above
const WN = 512, WB = 9;
const PYR = { x: 110, w: 1060, base: 590, dy: 45 };
function pyrRect(lo, hi) {
  const uw = PYR.w/WN, bw = (hi - lo)*uw;
  return [PYR.x + lo*uw, PYR.base - Math.log2(hi - lo)*PYR.dy,
          Math.max(bw - Math.min(4, bw*0.15), 1.4)];
}
// only blocks that exist: a block whose range runs past the last memory has
// not been built, so the top of the tree is ragged, not a row of empty slots.
// the side margins are too narrow for labels, so "less detail" sits above the
// top block and "fine detail" in the empty right column, over the "now" corner
function pyramid(litAt, labA, labB) {
  const last = WN - 1, covr = cover(last, WB), lit = new Map();
  covr.forEach((b, i) => lit.set(b[0] + "-" + b[1], i));
  for (let s = 1; s <= WN; s *= 2) {
    const k = Math.log2(s);
    for (let lo = 0; lo + s <= last; lo += s) {
      const i = lit.get(lo + "-" + (lo + s)), on = i === undefined ? 0 : litAt(i);
      const [x, y, w] = pyrRect(lo, lo + s);
      box(x, y, w, 22, 3, on > 0 ? lvl(k, 40 + 8*on) : "#dde3ea");
      if (on > 0.4) {
        if (w > 8) box(x, y, w, 22, 3, null, "#ffffff", 1.5);
        else box(x - 2.5, y - 2.5, w + 5, 27, 4, null, lvl(k, 32), 2);
      }
    }
  }
  T("oldest", PYR.x, PYR.base + 52, 16, FAINT);
  T("now", PYR.x + PYR.w, PYR.base + 52, 16, GREEN, "right");
  const ga = cx.globalAlpha;
  if (labA > 0) {
    cx.globalAlpha = ga*labA;
    T("less detail", 373, 196, 16, "#d98c00", "center", true);
    arrow(373, 204, 224, "#d98c00");
  }
  if (labB > 0) {
    cx.globalAlpha = ga*labB;
    T("fine detail", 1172, 490, 14, GREEN, "center", true);
    arrow(1172, 500, 583, GREEN);
  }
  cx.globalAlpha = ga;
  return covr;
}

// ------------------------------------------------------------------- beats
const S = {};

S.say = (u, dur, b) => {
  const ls = b.slice(2).filter(s => s !== punch), y0 = 372 - (ls.length - 1)*30;
  ls.forEach((s, i) => {
    cx.globalAlpha = i === 0 ? 1 : ease((u - b.at[i])/0.4);
    rich(s, W/2, y0 + i*60, 34);
    cx.globalAlpha = 1;
  });
};

// the list stays centred: old cards slide up while the new one fades in
S.one = (u, dur, b) => {
  const n = b[2], w = 700, x = (W - w)/2, h = 60;
  const topOf = m => 372 - (m*72 - 12)/2;
  const top = n === 1 ? topOf(1) : lerp(topOf(n - 1), topOf(n), ease(u/0.35));
  for (let i = 0; i < n; i++) {
    cx.globalAlpha = i === n - 1 ? ease((u - 0.15)/0.45) : 1;
    memCard(x, top + i*72, w, h, MEM[i], {fs: 19});
    cx.globalAlpha = 1;
  }
};

// The log fills on ONE curve: the four memories already read are there at the
// start, and every later arrival follows from the same formula, so the gaps
// only ever shrink -- no seam, no pause, no hand-placed card.
const LOG_N1 = 1000;
S.log = (u, dur) => {
  const p = clamp((u - 1.0)/(dur - 2.6), 0, 1);
  logWindow(4*Math.pow(LOG_N1/4, p*p), ease(u/0.5));
};

S.prune = (u, dur) => {
  const n = 7, w = 700, x = (W - w)/2, pitch = 68, h = 56, top = 372 - (n*pitch - 12)/2;
  const keep = new Set([1, 4]);
  for (let i = 0; i < n; i++) {
    const dead = !keep.has(i), s = ease((u - 1.0 - i*0.22)/0.45), y = top + i*pitch;
    cx.globalAlpha = dead ? 1 - 0.8*s : 1;
    memCard(x, y, w, h, MEM[i], {fs: 18});
    cx.globalAlpha = 1;
    if (dead && s > 0) {
      cx.strokeStyle = `rgba(207,34,48,${0.9 - 0.45*s})`; cx.lineWidth = 2.5; cx.beginPath();
      cx.moveTo(x + 18, y + h/2); cx.lineTo(x + 18 + (w - 36)*s, y + h/2); cx.stroke();
      cx.lineWidth = 1;
    }
  }
};

// two memories in, one broader memory out -- inputs and output share the screen
S.merge = u => {
  const w = 700, x = (W - w)/2, h = 60;
  const shown = ease((u - 1.5)/0.45), born = ease((u - 2.2)/0.55), gone = ease((u - 3.5)/0.7);
  cx.globalAlpha = 1 - gone;
  memCard(x, 232, w, h, MEM[0], {fs: 19});
  memCard(x, 304, w, h, MEM[1], {fs: 19});
  cx.globalAlpha = 1;
  if (shown > 0 && gone < 1) {
    cx.globalAlpha = shown*(1 - gone);
    arrow(W/2, 384, 428, "rgba(15,138,69,.85)");
    cx.globalAlpha = 1;
  }
  if (born > 0) {
    cx.globalAlpha = born;
    memCard(x, lerp(448, 372, gone), w, h, NODE["0-2"],
            {chip: "\u00d72", k: 1, hot: true, fs: 19});
    cx.globalAlpha = 1;
  }
};

// memories squeeze together into a slit, flash, and unfold as one broader
// memory. they never overlap while readable, so the eye follows what became what
const CH = 54;
function fuse(p, ins, ys, out, oy, chipIn, chipOut, kIn, kOut, hot) {
  const w = 700, x = (W - w)/2;
  const m = ease(p/0.60), g = ease((p - 0.60)/0.28);
  if (m < 1) {
    const hi = lerp(CH, 6, m);
    ins.forEach((t, i) => memCard(x, lerp(ys[i], oy + (CH - hi)/2, m), w, hi, t,
                                  {chip: hi > 24 ? chipIn : "", k: kIn, fs: 19}));
    return;
  }
  const h = lerp(6, CH, g), y = oy + (CH - h)/2;
  memCard(x, y, w, h, out, {chip: h > 30 ? chipOut : "", k: kOut, hot: hot, fs: 19});
  const fl = clamp(1 - Math.abs(p - 0.64)/0.22, 0, 1);
  if (fl > 0.02) {
    cx.globalAlpha = fl;
    box(x - 5, y - 5, w + 10, h + 10, 10, null, "#ffc400", 3);
    cx.globalAlpha = 1;
  }
}
const FY = [234, 300, 366, 432], MY = [267, 399], FINAL = 333;
S.fold = u => {
  const p2 = clamp((u - 4.4)/1.2, 0, 1);
  if (p2 > 0) return fuse(p2, [NODE["0-2"], NODE["2-4"]], MY, NODE["0-4"],
                          FINAL, "\u00d72", "\u00d74", 1, 2, true);
  const p1 = clamp((u - 1.2)/1.2, 0, 1);
  fuse(p1, [MEM[0], MEM[1]], [FY[0], FY[1]], NODE["0-2"], MY[0], "", "\u00d72", 0, 1);
  fuse(p1, [MEM[2], MEM[3]], [FY[2], FY[3]], NODE["2-4"], MY[1], "", "\u00d72", 0, 1);
};

S.tree = (u, dur) => {
  const n = 8, x0 = 48, wtot = 1184, uw = wtot/n, baseY = 490, dy = 98;
  const at = k => baseY - k*dy, born = k => 1.0 + (k - 1)*2.75;
  for (let k = 3; k >= 1; k--) {
    const s = 1 << k, a = ease((u - born(k))/0.7);
    if (a <= 0) continue;
    for (let lo = 0; lo + s <= n; lo += s) {
      const y = lerp(at(k - 1), at(k), a), w = s*uw - 14;
      cx.globalAlpha = a;
      cx.strokeStyle = "rgba(15,138,69,.25)"; cx.beginPath();
      cx.moveTo(x0 + lo*uw + s*uw/4, y + 46); cx.lineTo(x0 + lo*uw + s*uw/4, at(k-1));
      cx.moveTo(x0 + lo*uw + 3*s*uw/4, y + 46); cx.lineTo(x0 + lo*uw + 3*s*uw/4, at(k-1));
      cx.stroke();
      memCard(x0 + lo*uw + 7, y, w, 46, NODE[lo + "-" + (lo + s)],
              {chip: "\u00d7" + s, k, hot: true, chipW: k === 1 ? 34 : 54, fs: k === 1 ? 13 : 16});
      cx.globalAlpha = 1;
    }
  }
  for (let i = 0; i < n; i++) {
    box(x0 + i*uw + 7, baseY, uw - 14, 46, 7, CARD, EDGE, 1.5);
    T(fit(SHORT[i], uw - 26, 12), x0 + i*uw + uw/2, baseY + 29, 12, INK, "center");
  }
};

// each new memory lands, then the merges it enables cascade up one level at a
// time: a parent starts rising only once its right child has settled in place
S.spot = (u, dur) => {
  const n = 32, x0 = 190, wtot = 900, uw = wtot/n, baseY = 450, dy = 50, RISE = 0.3;
  const tOf = [];
  for (let i = 0, t = 0.4; i < n; i++) { tOf.push(t); t += Math.max(0.05, 0.75*Math.pow(0.8, i)); }
  const born = (lo, s) => s === 2 ? tOf[lo + 1] + 0.25 : born(lo + s/2, s/2) + RISE;
  let live = 0; while (live < n && tOf[live] <= u) live++;
  let merges = 0;
  for (let i = 0; i < live; i++)
    box(x0 + i*uw + 1, baseY, uw - 3, 22, 3, lvl(0, 40 + 8*ease((u - tOf[i])/0.25)));
  for (let s = 2; s <= n; s *= 2) {
    const k = Math.log2(s);
    for (let lo = 0; lo + s <= n; lo += s) {
      const bt = born(lo, s), a = ease((u - bt)/RISE);
      if (a <= 0) continue;
      merges++;
      const fl = a > 0.9 ? clamp(1 - (u - bt)/0.7, 0, 1) : 0;
      const y = lerp(baseY - (k-1)*dy, baseY - k*dy, a);
      box(x0 + lo*uw + 1 - 3*fl, y - 2*fl, s*uw - 3 + 6*fl, 22 + 4*fl, 3, lvl(k, 40 + 22*fl));
      if (fl > 0.03) box(x0 + lo*uw + 1 - 3*fl, y - 2*fl, s*uw - 3 + 6*fl, 22 + 4*fl, 3,
                         null, `rgba(255,196,0,${fl})`, 2.5);
    }
  }
  const a1 = ease((u - 1.3)/0.4), a2 = ease((u - 6.5)/0.4);
  if (a1 > 0) {
    cx.globalAlpha = a1;
    T("fine detail", 85, baseY + 16, 16, GREEN, "center", true);
    harrow(148, x0 - 8, baseY + 11, GREEN);
    cx.globalAlpha = 1;
  }
  if (a2 > 0) {
    cx.globalAlpha = a2;
    T("less detail", 85, baseY - 5*dy + 16, 16, "#d98c00", "center", true);
    harrow(148, x0 - 8, baseY - 5*dy + 11, "#d98c00");
    cx.globalAlpha = 1;
  }
  T(live + " memories", W/2 - 170, 556, 25, INK, "center");
  T(merges + " merges", W/2 + 170, 556, 25, lvl(2), "center");
};

S.select = (u, dur) => pyramid(i => ease((u - 0.7 - i*0.42)/0.4),
                               ease((u - 1.4)/0.5), ease((u - 4.6)/0.5));

S.fly = (u, dur) => {
  const covr = cover(WN - 1, WB);
  const treeA = clamp(1 - ease(u/0.9), 0, 1);
  if (treeA > 0) { cx.globalAlpha = treeA; pyramid(() => 1, 1, 1); cx.globalAlpha = 1; }
  covr.forEach((b, i) => {
    const k = Math.log2(b[1] - b[0]), p = ease((u - 0.25 - i*0.1)/1.3);
    const [tx, ty, tw] = pyrRect(b[0], b[1]);
    const x = lerp(tx, DOC.x + 12, p), y = lerp(ty, rowY(i) + 10, p);
    if (p < 0.999) box(x, y, lerp(tw, 58, p), lerp(22, DOC.h - 20, p), 5, lvl(k));
    else docRow(b[0], b[1], rowY(i), WN);
  });
  docFrame(WN - 1, ease((u - 1.7)/0.5));
};

// the resting context, with two arrows naming what the eye should compare:
// the top row is old and broad, the bottom row is recent and fine
function side(l1, l2, row, color, a) {
  if (a <= 0) return;
  const y = rowY(row) + DOC.h/2;
  cx.globalAlpha = a;
  T(l1, 118, y - 4, 16, color, "center", true);
  T(l2, 118, y + 16, 16, color, "center", true);
  harrow(192, DOC.x - 10, y, color);
  cx.globalAlpha = 1;
}
S.doc = (u, dur) => {
  cover(WN - 1, WB).forEach((b, i) => docRow(b[0], b[1], rowY(i), WN));
  docFrame(WN - 1);
  const out = ease((dur - u)/0.4);
  side("long ago", "less detail", 0, "#d98c00", ease((u - 1.0)/0.4)*out);
  side("now", "fine detail", WB - 1, GREEN, ease((u - 2.4)/0.4)*out);
};

// cover spends its budget in powers of two, so for some counts it lands one
// row over; step back to the newest count that fits, so the context never jumps
function ctxAt(n) {
  let m = n; while (m > WB && cover(m, WB).length !== WB) m--;
  return cover(m, WB);
}
// one memory arrives, two rows merge, the context is nine rows again
function ctxStep(nA, nB, p) {
  const A = ctxAt(nA), B = nB === nA ? A : ctxAt(nB);
  const key = b => b[0] + "-" + b[1];
  const iA = new Map(A.map((b, i) => [key(b), i]));
  const inB = new Set(B.map(key));
  const m = ease(p/0.62), g = ease((p - 0.62)/0.30);
  A.forEach((b, i) => {
    if (inB.has(key(b)) || m >= 1) return;
    let pj = B.length - 1;
    B.forEach((c, j) => { if (c[0] <= b[0] && b[1] <= c[1]) pj = j; });
    const h = lerp(DOC.h, 6, m);
    docRow(b[0], b[1], lerp(rowY(i), rowY(pj) + (DOC.h - h)/2, m), nA,
           {h: h, flash: m});
  });
  B.forEach((b, j) => {
    const from = iA.get(key(b));
    if (from !== undefined)
      return docRow(b[0], b[1], lerp(rowY(from), rowY(j), ease(p)), nB);
    if (b[1] - b[0] === 1)
      return docRow(b[0], b[1], rowY(j), nB, {a: ease((p - 0.5)/0.4)});
    if (g <= 0) return;
    const h = lerp(6, DOC.h, g);
    docRow(b[0], b[1], rowY(j) + (DOC.h - h)/2, nB,
           {h: h, flash: clamp(1 - Math.abs(p - 0.70)/0.20, 0, 1)});
  });
  docFrame(nB);
}
// One curve, from the context the last beat left to twenty thousand memories.
// n(u) = N0 + K*(e^s - 1) with s = S*(u/U)^a: the first arrivals are seconds
// apart and every one after is closer than the last, forever. The merge plays
// at every speed -- it just gets shorter until it is a flicker.
const STEP_N0 = WN - 1, STEP_N1 = 20000, STEP_K = 3, STEP_A = 1.8;
const STEP_S = Math.log(1 + (STEP_N1 - STEP_N0)/STEP_K);
const stepN = (u, U) =>
  STEP_N0 + STEP_K*(Math.exp(STEP_S*Math.pow(clamp(u/U, 0, 1), STEP_A)) - 1);
S.step = (u, dur) => {
  const U = dur - 2.5, x = stepN(u, U);
  const gap = 0.02/Math.max(stepN(u + 0.01, U) - stepN(u - 0.01, U), 1e-9);
  ctxStep(Math.floor(x), Math.floor(x) + 1,
          clamp((x % 1)*Math.max(1, gap/0.75), 0, 1));
};

S.recall = (u, dur) => {
  const n = STEP_N1, covr = ctxAt(n), [lo, hi] = covr[0];
  const rest = clamp(1 - ease((u - 0.45)/0.6), 0, 1);
  if (rest > 0)
    for (let i = 1; i < covr.length; i++)
      docRow(covr[i][0], covr[i][1], rowY(i), n, {a: 0.35*rest});
  docRow(lo, hi, lerp(rowY(0), 216, ease((u - 0.45)/0.8)), n, {hot: true});
  const q = ease((u - 1.6)/0.45);
  if (q > 0) {
    cx.globalAlpha = q;
    T("memo recall 'Japan'", W/2, 342, 23, GREEN, "center");
    arrow(W/2, 366, 424, "#d98c00");
    cx.globalAlpha = 1;
  }
  const r = ease((u - 2.5)/0.4);
  if (r > 0) {
    cx.globalAlpha = r;
    const txt = "#1  2015-03-08  " + MEM[0];
    box(DOC.x, 452, DOC.w, 64, 7, "#ffffff", "#d98c00", 2.5);
    T(txt.slice(0, Math.floor(ease((u - 2.8)/1.3)*txt.length)), DOC.x + 28, 492, 19, INK);
    cx.globalAlpha = 1;
  }
};

S.end = (u, dur) => {
  T("OptMem", W/2, 284, 58, INK, "center", true);
  cx.globalAlpha = ease((u - 0.6)/0.5);
  T("an append-only log + a binary merge tree", W/2, 356, 23, GREEN, "center");
  T("detail fades with age \u00b7 nothing is deleted", W/2, 396, 23, DIM, "center");
  cx.globalAlpha = ease((u - 1.6)/0.5);
  T("~600 lines of Python \u00b7 no database \u00b7 no embeddings", W/2, 462, 19, FAINT, "center");
  T("github.com/VictorTaelin/OptMem", W/2, 508, 21, "#1a5fd0", "center");
  cx.globalAlpha = 1;
};

// ------------------------------------------------------------------ pacing
// Sentence beats size themselves: line i lands once line i-1 has been read,
// and the beat ends one breath after the last line. One number, READ, sets
// the whole film's tempo.
for (const b of BEATS) {
  if (b[0] === "say") {
    const ls = b.slice(1).filter(s => s !== punch);
    let t = 0; b.at = ls.map(s => { const a = t; t += READ*cost(s) + 0.3; return a; });
    b.splice(1, 0, (t*1.2 + 0.6)*(b.includes(punch) ? 1.3 : 1));
  } else if (b[0] === "one") {
    b.splice(1, 0, 0.9 + READ*cost(MEM[b[1] - 1]));
  }
}
const T0 = []; let DUR = 0;
for (const b of BEATS) { T0.push(DUR); DUR += b[1]; }
const SCENES = BEATS.map(b => [b[0] === "say"
  ? "\u201c" + b[2].replace(/[*+_]/g, "") : b[0], b[1]]);

// -------------------------------------------------------------------- main
function draw(t) {
  cx.fillStyle = BG; cx.fillRect(0, 0, W, H);
  let i = 0;
  while (i < BEATS.length - 1 && t >= T0[i] + BEATS[i][1]) i++;
  const b = BEATS[i], dur = b[1], u = clamp(t - T0[i], 0, dur), nxt = BEATS[i + 1];
  S[b[0]](u, dur, b);
  const inA  = b.includes(co) ? 1 : ease(u/0.3);
  const outA = nxt && nxt.includes(co) ? 1 : ease((dur - u)/0.3);
  const f = 1 - Math.min(inA, outA);
  if (f > 0) { cx.fillStyle = `rgba(255,255,255,${f})`; cx.fillRect(0, 0, W, H); }
}

if (typeof module !== "undefined") module.exports = { draw, setCtx, DUR, SCENES, T0 };
