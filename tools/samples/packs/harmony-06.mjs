/* HARMONY 06 · Pitidos del newstyle
   El «pitido»: un tono agudo casi puro (1–1,9 kHz) con los armónicos 2.º y 3.º unos 15 dB por debajo, sin vibrato,
   con portamento corto entre notas ligadas (unos 30 ms) y arcos de pitch bend en los breaks; a veces doblado una
   octava por debajo. Así lo describe el análisis de una referencia (espectrograma y seguimiento de altura): de ella
   solo se han sacado esas medidas, no hay ni un trozo de audio ni de su melodía. Las melodías son de Harmony.
   Bucles a 175 BPM en La menor, que es donde se mueve el newstyle de pitidos (y el preset «Newstyle de pitidos»). */
import * as D from '../dsp.mjs';
import * as S from '../synth.mjs';

export const PACK = {
  id: 'harmony-06',
  name: 'Harmony 06',
  title: 'Pitidos del newstyle',
  version: '1.0.0',
  date: '2026-10-18',
  license: 'CC0-1.0',
  licenseName: 'CC0 1.0 (dominio público)',
  licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/deed.es',
  origin: 'Síntesis aditiva en tools/samples/ (Harmony), con el timbre ajustado a partir de medidas de espectrograma. Melodías compuestas para Harmony; sin grabaciones ni samples de terceros.',
  credits: 'Harmony'
};

const BPM = 175, SD = 60 / BPM / 4, SR = D.SR;
// armónicos del pitido (1.º a 4.º): 0 · −15 · −15 · −18 dB
const HARM = [1, 0.178, 0.178, 0.126];

/* Curvas de bend sobre la nota (u de 0 a 1), en semitonos */
const BENDS = {
  arc: (u, n) => n * Math.sin(Math.PI * u),
  up: (u, n) => n * Math.min(1, u / 0.4) ** 0.7,
  down: (u, n) => (u < 0.45 ? 0 : -n * ((u - 0.45) / 0.55) ** 1.4),
  scoop: (u, n) => -n * Math.max(0, 1 - u / 0.18) ** 2,     // entra desde abajo
  late: (u, n) => (u < 0.6 ? 0 : n * Math.sin(Math.PI * (u - 0.6) / 0.4))   // aguanta la nota y hace el arco al final
};

/* Línea monofónica de pitido: notas [paso, largo, nota, vel, { bend: [forma, semitonos] }].
   Las notas que empiezan justo donde acaba la anterior van ligadas: no se reataca y la altura se desliza (glide). */
function line(notes, { cycles = 1, steps = 64, tail = 0.5, glide = 0.03, oct = 0, harm = HARM, atk = 0.004, rel = 0.03, gateScale = 0.86 } = {}) {
  const ev = [];
  for (let c = 0; c < cycles; c++) for (const [s, l, p, v = 1, o = {}] of notes) ev.push({ s: c * steps + s, l, m: S.midi(p), v, bend: o.bend });
  ev.sort((a, b) => a.s - b.s);
  ev.forEach((e, k) => { const nx = ev[k + 1]; e.legato = !!nx && nx.s === e.s + e.l; e.from = k > 0 && ev[k - 1].legato; });
  const n = D.secs(cycles * steps * SD + tail), lf = new Float64Array(n), amp = new Float64Array(n), jump = new Uint8Array(n);
  ev.forEach((e, k) => {
    const s0 = Math.round(e.s * SD * SR), dur = e.l * SD * (e.legato ? 1 : gateScale), s1 = Math.min(n, s0 + Math.round(dur * SR));
    const nx = ev[k + 1], end = nx ? Math.round(nx.s * SD * SR) : n;
    const base = Math.log2(D.hz(e.m));
    for (let i = s0; i < Math.min(n, end); i++) {
      const u = Math.min(1, (i - s0) / Math.max(1, s1 - s0));
      lf[i] = base + (e.bend ? BENDS[e.bend[0]](u, e.bend[1]) / 12 : 0);
      amp[i] = i < s1 ? e.v : 0;
    }
    if (!e.from && s0 < n) jump[s0] = 1;
  });
  for (let i = 0; i < Math.round((ev.length ? ev[0].s : 0) * SD * SR); i++) lf[i] = lf[Math.round(ev[0].s * SD * SR)] || 10;
  const out = new Float64Array(n), aG = Math.exp(-1 / ((glide / 3) * SR)), aA = Math.exp(-1 / (atk * SR)), aR = Math.exp(-1 / (rel * SR));
  let f = lf[0], a = 0, ph = 0, ph2 = 0;
  for (let i = 0; i < n; i++) {
    if (jump[i]) f = lf[i]; else f = lf[i] + (f - lf[i]) * aG;
    const t = amp[i], c = t > a ? aA : aR; a = t + (a - t) * c;
    const fr = Math.pow(2, f);
    ph += fr / SR; ph -= Math.floor(ph);
    ph2 += fr / 2 / SR; ph2 -= Math.floor(ph2);
    let v = 0;
    for (let h = 0; h < harm.length; h++) if (fr * (h + 1) < 18000) v += harm[h] * Math.sin(2 * Math.PI * (h + 1) * ph);
    if (oct) v += oct * (Math.sin(2 * Math.PI * ph2) + 0.15 * Math.sin(4 * Math.PI * ph2 + 0.3));
    out[i] = v * a;
  }
  return out;
}

const mono = (s) => D.mix([s.L, 0.5], [s.R, 0.5]);
/* el pitido va en el centro, el eco a los lados y una sala pequeña */
function space(x, { delay = 0.18, verb = 0.12, size = 0.75, tail = 1.1 } = {}) {
  return D.mixSt([D.stereo(x, Float64Array.from(x)), 1], [S.pingpong(x, BPM, { div: 0.75, n: 3, gain: delay, lp: 6000 }), 1], [D.reverb(x, { size, damp: 0.35, tail, pre: 0.015 }), verb]);
}
function finishSt(s, { tailDb = -66, peak = -1 } = {}) {
  s = D.same(s);
  const L0 = D.dcBlock(s.L), R0 = D.dcBlock(s.R);
  const n = Math.max(D.trimTail(L0, tailDb).length, D.trimTail(R0, tailDb).length);
  let y = D.stereo(D.fades(L0.slice(0, n), 0.0008, 0.02), D.fades(R0.slice(0, n), 0.0008, 0.02));
  y = D.limitSt(y, peak + 0.3);
  return D.normalizeTP(y, peak);
}
function loop(bars, build) {
  let s = D.same(build(2));
  s = D.stereo(D.dcBlock(s.L), D.dcBlock(s.R));
  s = D.limitSt(s, -0.7);
  s = S.loopCut(s, BPM, bars);
  s = D.normalizeTP(s, -1);
  return D.stereo(D.fades(s.L, 0.0015, 0.0015), D.fades(s.R, 0.0015, 0.0015));
}
const shot = (notes, o = {}, sp = {}) => finishSt(space(line(notes, { steps: 64, tail: 0.6, ...o }), sp));

/* ---------------------------------------------------------------- melodías (La menor, 175 BPM) */
const LEAD1 = [   // ligada, con glides: La m – Fa – Sol – Mi
  [0, 3, 'E6'], [3, 1, 'D6'], [4, 4, 'C6'], [8, 2, 'D6'], [10, 2, 'E6'], [12, 4, 'A5'],
  [16, 3, 'F6'], [19, 1, 'E6'], [20, 4, 'C6'], [24, 2, 'A5'], [26, 2, 'C6'], [28, 4, 'F6'],
  [32, 3, 'G6'], [35, 1, 'F6'], [36, 4, 'D6'], [40, 2, 'B5'], [42, 2, 'D6'], [44, 4, 'G6'],
  [48, 4, 'E6'], [52, 2, 'G#6'], [54, 2, 'B6'], [56, 8, 'A6']
];
const LEAD2 = [   // a corcheas, picada, con la octava de abajo
  [0, 2, 'A5'], [2, 2, 'C6'], [4, 1, 'E6'], [6, 2, 'E6'], [8, 2, 'D6'], [10, 2, 'C6'], [12, 2, 'D6'], [14, 2, 'E6'],
  [16, 2, 'F6'], [18, 2, 'E6'], [20, 1, 'D6'], [22, 2, 'C6'], [24, 4, 'A5'], [28, 2, 'C6'], [30, 2, 'D6'],
  [32, 2, 'G6'], [34, 2, 'F6'], [36, 1, 'E6'], [38, 2, 'D6'], [40, 2, 'B5'], [42, 2, 'D6'], [44, 2, 'E6'], [46, 2, 'G6'],
  [48, 2, 'E6'], [50, 2, 'D6'], [52, 2, 'C6'], [54, 2, 'B5'], [56, 6, 'A5'], [62, 2, 'G#5']
];
const CALL = [    // pregunta y respuesta, con bends (2 compases)
  [0, 2, 'A6'], [2, 2, 'G6'], [4, 4, 'E6', 1, { bend: ['arc', 3] }], [8, 2, 'C6'], [10, 2, 'D6'], [12, 4, 'E6', 1, { bend: ['down', 2] }],
  [16, 2, 'C6'], [18, 2, 'D6'], [20, 4, 'E6'], [24, 2, 'G6'], [26, 2, 'F6'], [28, 4, 'E6', 1, { bend: ['arc', 5] }]
];
const OFFBEAT = [ // a contratiempo, cortita (2 compases)
  [2, 1, 'E6'], [6, 1, 'E6'], [10, 1, 'D6'], [14, 1, 'E6'], [18, 1, 'F6'], [22, 1, 'E6'], [26, 1, 'D6'], [30, 1, 'C6']
];
const BREAK = [   // notas largas con arcos, para el break
  [0, 8, 'E6', 0.9, { bend: ['scoop', 2] }], [8, 8, 'C6', 0.9], [16, 8, 'F6', 0.9, { bend: ['scoop', 2] }], [24, 8, 'A6', 0.9, { bend: ['scoop', 3] }],
  [32, 8, 'G6', 0.9, { bend: ['scoop', 2] }], [40, 8, 'D6', 0.9], [48, 12, 'E6', 0.9, { bend: ['late', 3] }], [60, 4, 'B5', 0.8]
];

export const SCORES = { 'pt-lead-1': [BPM, LEAD1], 'pt-lead-2': [BPM, LEAD2], 'pt-break': [BPM, BREAK.map(([s, l, p]) => [s, l, p])] };

const ptLead1 = () => loop(4, (cycles) => space(line(LEAD1, { cycles, glide: 0.035 })));
const ptLead2 = () => loop(4, (cycles) => space(line(LEAD2, { cycles, oct: 0.45 }), { delay: 0.14 }));
const ptDrop = () => loop(4, (cycles) => D.applySt(space(line(LEAD2, { cycles, oct: 0.45 }), { delay: 0.12, verb: 0.08 }), (c) => S.pump(c, BPM, { depth: 0.85, rel: 0.2, curve: 1.6 })));
const ptCall = () => loop(2, (cycles) => space(line(CALL, { cycles, steps: 32 })));
const ptOffbeat = () => loop(2, (cycles) => space(line(OFFBEAT, { cycles, steps: 32, oct: 0.4, gateScale: 0.7 }), { delay: 0.22 }));
const ptBreak = () => loop(4, (cycles) => space(line(BREAK, { cycles, glide: 0.05, rel: 0.06 }), { delay: 0.2, verb: 0.3, size: 0.88, tail: 2.2 }));

/* sueltos: duran lo suyo, sirven a cualquier tempo */
const note = (p, l, o = {}) => () => shot([[0, l, p, 1, o.bend ? { bend: o.bend } : {}]], { oct: o.oct || 0, gateScale: 1, rel: 0.05 }, { delay: 0.12 });
const ptWhistle = () => shot([[0, 3, 'A5', 1, { bend: ['arc', 5] }], [3, 3, 'A5', 1, { bend: ['arc', 5] }], [6, 4, 'A5', 1, { bend: ['arc', 7] }]], { gateScale: 1 });
function ptTrill() {
  const notes = [];
  for (let k = 0; k < 16; k++) notes.push([k * 0.5, 0.5, k % 2 ? 'G6' : 'A6']);
  notes.push([8, 6, 'A6']);
  return shot(notes, { glide: 0.012, gateScale: 1 });
}

const L = (o) => ({ cat: 'loop', loop: true, style: 'newstyle', tonality: 'La menor', bpm: [BPM, BPM], ...o });
const N = (o) => ({ cat: 'fx', style: 'newstyle', ...o });
const tg = (...t) => ['pitido', 'newstyle', ...t];
export const SAMPLES = [
  L({ id: 'pt-lead-1', name: 'Pitidos · melodía ligada', type: 'melodía', bars: 4, tags: tg('lead', 'glide'), render: ptLead1,
    notes: 'Melodía de pitido de 4 compases sobre La m – Fa – Sol – Mi, con las notas ligadas y un glide de 35 ms entre ellas.' }),
  L({ id: 'pt-lead-2', name: 'Pitidos · melodía picada', type: 'melodía', bars: 4, tags: tg('lead', 'octava'), render: ptLead2,
    notes: 'A corcheas y picada, con la octava de abajo a −7 dB y eco a corchea con puntillo.' }),
  L({ id: 'pt-drop', name: 'Pitidos · drop con sidechain', type: 'melodía', bars: 4, tags: tg('drop', 'sidechain'), render: ptDrop,
    notes: 'La melodía picada con un «sidechain» fuerte en cada tiempo, como cuando el kick la recorta en el drop.' }),
  L({ id: 'pt-call', name: 'Pitidos · pregunta y respuesta', type: 'melodía', bars: 2, tags: tg('bend', 'riff'), render: ptCall,
    notes: 'Dos compases: pregunta con arcos de pitch bend y respuesta que acaba subiendo cinco semitonos y volviendo.' }),
  L({ id: 'pt-offbeat', name: 'Pitidos a contratiempo', type: 'melodía', bars: 2, tags: tg('contratiempo', 'stab'), render: ptOffbeat,
    notes: 'Golpes cortos de pitido en la «y» de cada tiempo, con su octava y eco.' }),
  L({ id: 'pt-break', name: 'Pitidos · break', type: 'melodía', bars: 4, tags: tg('break', 'bend', 'reverb'), render: ptBreak,
    notes: 'Notas largas que entran desde abajo y hacen arcos, con eco y sala grande: para el break.' }),
  N({ id: 'pt-note-a5', name: 'Pitido La 5', type: 'nota', key: 'A5', tags: tg('nota'), render: note('A5', 5),
    notes: 'Una nota de pitido en La 5 (880 Hz). Con el tono del pad (±12 semitonos) se toca cualquier nota.' }),
  N({ id: 'pt-note-e6', name: 'Pitido Mi 6', type: 'nota', key: 'E6', tags: tg('nota'), render: note('E6', 5),
    notes: 'Una nota de pitido en Mi 6 (1,3 kHz), la quinta de La.' }),
  N({ id: 'pt-note-oct', name: 'Pitido con octava (La)', type: 'nota', key: 'A5', tags: tg('nota', 'octava'), render: note('A5', 5, { oct: 0.5 }),
    notes: 'La 5 doblado una octava por debajo: más cuerpo, el mismo brillo.' }),
  N({ id: 'pt-bend-up', name: 'Pitido que sube', type: 'efecto', tags: tg('bend'), render: note('A5', 5, { bend: ['up', 5] }),
    notes: 'Entra en La 5 y sube cinco semitonos (a Re 6) en un tiempo.' }),
  N({ id: 'pt-bend-arc', name: 'Arco de pitido', type: 'efecto', tags: tg('bend', 'arco'), render: note('E6', 6, { bend: ['arc', 7] }),
    notes: 'Mi 6 que sube siete semitonos y vuelve, en arco.' }),
  N({ id: 'pt-bend-down', name: 'Pitido que cae', type: 'efecto', tags: tg('bend', 'caída'), render: note('A6', 6, { bend: ['down', 12] }),
    notes: 'La 6 que aguanta y cae una octava.' }),
  N({ id: 'pt-whistle', name: 'Silbato', type: 'efecto', tags: tg('bend', 'silbato'), render: ptWhistle,
    notes: 'Tres arcos seguidos desde La 5, como un silbato de árbitro estirado.' }),
  N({ id: 'pt-trill', name: 'Trino de pitido', type: 'efecto', tags: tg('trino'), render: ptTrill,
    notes: 'La 6 y Sol 6 alternando en fusas a 175 BPM y una nota larga al final.' })
];
