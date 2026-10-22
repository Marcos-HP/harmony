/* HARMONY · ajustes del Laboratorio de kicks
   Los puntos de partida del laboratorio (js/views/kicklab.js) y las recetas de los kicks de la biblioteca que salen
   del mismo motor (tools/samples/hard.mjs, labKick): un kick de la biblioteca con «lab» se abre en el laboratorio con
   sus ajustes exactos y suena igual. Tres tipos: hard (uptempo / raw / hardstyle), french (frenchcore) y hc (hardcore:
   early, gabber, mainstream, industrial, crossbreed, terror). */
(function () {
  const H = (window.H = window.H || {});
  H.data = H.data || {};
  const BASE = {
    type: 'hard', note: 'D2', len: 300, semis: 34, drop: 130, saw: 0.3, refl: 0.35, mids: 11, res: 4, drive1: 11, drive2: 5, low: 0.45, scoop: -2,
    move: 'down', tok: 0.8, tick: 0.5, ott: 0.45, seed: 11, bpm: 200, at: 70, per: 3, decay: 0.6,
    // hardcore
    fade: 0.25, sq: 0, punch: 0.8, verb: 0, bits: 0, fold: 0, body: 4, cab: 0.3, dark: 0, grit: 0, clip: 0, hollow: 0, bend: 0, screech: 0, close: 0
  };
  /* el kick de hardcore: un 909 que cae, crunch, válvula y recorte; cada escuela cambia la receta */
  const HC = { type: 'hc', refl: 0.12, scoop: -3, saw: 0, res: 0, move: 'hold' };
  const PRESETS = {
    uptempo: { name: 'Uptempo', p: {} },
    chillon: { name: 'Uptempo que se abre', p: { move: 'up' } },
    vaiven: { name: 'Uptempo con vaivén', p: { move: 'wobble' } },
    raw: { name: 'Raw corto', p: { len: 210, saw: 0.5, mids: 13, drive1: 16, drive2: 9, move: 'hold', low: 0.6, ott: 0.6 } },
    gabber: { name: 'Gabber zumbón', p: { note: 'F2', len: 450, semis: 30, drop: 60, saw: 0.1, refl: 0.1, mids: 6, res: 8, drive1: 14, drive2: 3, low: 1, scoop: -6, move: 'hold', tok: 1, bpm: 180 } },
    hardstyle: { name: 'Hardstyle', p: { note: 'F2', len: 420, semis: 36, drop: 160, saw: 0.2, mids: 8, res: 5, drive1: 7, drive2: 3, low: 1, scoop: -6, move: 'down', bpm: 150 } },
    frenchcore: { name: 'Frenchcore', p: { type: 'french', seed: 21 } },
    early: { name: 'Early / Rotterdam', group: 'hc', p: { ...HC, note: 'F1', len: 520, semis: 38, drop: 45, fade: 0.45, sq: 0, punch: 0.5, verb: 0.12, bits: 0, fold: 0, body: -2, mids: 9, drive1: 11, drive2: 4, low: 1, cab: 0.2, dark: 0, grit: 0.5, clip: 0.6, hollow: 8, tok: 0.6, tick: 0.7, ott: 0.3, bpm: 175, seed: 31 } },
    gabber909: { name: 'Gabber 909', group: 'hc', p: { ...HC, note: 'G1', len: 430, semis: 42, drop: 32, fade: 0.6, sq: 0.15, punch: 0.9, verb: 0.12, bits: 0, fold: 0, body: -3, mids: 9, drive1: 17, drive2: 6, low: 1, cab: 0.15, dark: 0, grit: 0.35, clip: 0.9, hollow: 8, tok: 0.9, tick: 0.8, ott: 0.45, bpm: 185, seed: 32 } },
    mainstream: { name: 'Mainstream', group: 'hc', p: { ...HC, note: 'F#1', len: 330, semis: 44, drop: 85, fade: 0, sq: 0.3, punch: 1, verb: 0.08, bits: 0, fold: 0.2, body: -3, mids: 12, drive1: 14, drive2: 8, low: 1, cab: 0.1, dark: 0, grit: 0.6, clip: 0.8, hollow: 6, tok: 1, tick: 0.6, ott: 0.6, bpm: 175, seed: 33 } },
    industrial: { name: 'Industrial', group: 'hc', p: { ...HC, note: 'E1', len: 620, semis: 30, drop: 70, fade: 0.35, sq: 0.2, punch: 0.6, verb: 0.6, bits: 6, fold: 0, body: 0, mids: 6, drive1: 18, drive2: 6, low: 1, cab: 0.45, dark: 0.45, grit: 0.4, clip: 0.7, hollow: 5, tok: 0.5, tick: 0.3, ott: 0.5, bpm: 150, seed: 34 } },
    crossbreed: { name: 'Crossbreed', group: 'hc', p: { ...HC, note: 'G1', len: 280, semis: 42, drop: 40, fade: 0.18, sq: 0.25, punch: 1.1, verb: 0.05, bits: 0, fold: 0.35, body: -2, mids: 10, drive1: 15, drive2: 9, low: 1, cab: 0.05, dark: 0, grit: 0.5, clip: 0.8, hollow: 6, tok: 1.2, tick: 1, ott: 0.65, bpm: 174, seed: 35 } },
    hardtechno: { name: 'Hard techno', group: 'hc', p: { ...HC, note: 'G1', len: 330, semis: 40, drop: 38, fade: 0.14, sq: 0.1, punch: 1.2, verb: 0.15, bits: 0, fold: 0.1, body: 2, mids: 7, drive1: 13, drive2: 5, low: 1.1, cab: 0.35, dark: 0.15, grit: 0.3, clip: 0.55, hollow: 4, tok: 1, tick: 0.7, ott: 0.5, bpm: 150, seed: 37 } },
    rumble: { name: 'Rumble (hard techno)', group: 'hc', p: { ...HC, note: 'F1', len: 420, semis: 36, drop: 35, fade: 0.09, sq: 0, punch: 1.2, verb: 0.9, bits: 0, fold: 0, body: 3, mids: 4, drive1: 14, drive2: 4, low: 1, cab: 0.5, dark: 0.7, grit: 0.2, clip: 0.4, hollow: 3, close: 0.3, tok: 1, tick: 0.6, ott: 0.55, bpm: 150, seed: 38 } },
    terror: { name: 'Terror', group: 'hc', p: { ...HC, note: 'A1', len: 200, semis: 36, drop: 25, fade: 0.1, sq: 0.4, punch: 0.9, verb: 0, bits: 8, fold: 0.5, body: -2, mids: 11, drive1: 20, drive2: 12, low: 0.9, cab: 0.05, dark: 0, grit: 0.6, clip: 1, hollow: 4, tok: 1.1, tick: 1.2, ott: 0.7, bpm: 240, seed: 36 } }
  };
  /* Los kicks de hardcore de la biblioteca, hechos con este motor: [punto de partida, cambios]. El pack (tools/samples/
     packs/) los calcula de aquí y el catálogo guarda los ajustes completos, así que se abren en el laboratorio tal cual */
  const LIB = {
    // Harmony 01
    'harmony-01/hc-kick-gabber': ['gabber909', { note: 'F1', len: 640, fade: 0.7, seed: 101 }],
    'harmony-01/hc-kick-mainstream': ['mainstream', { note: 'G#1', len: 620, bend: -1.2, grit: 0.55, seed: 102 }],
    'harmony-01/hc-kick-industrial': ['industrial', { note: 'D#1', len: 700, seed: 103 }],
    'harmony-01/hc-kick-crunch': ['terror', { note: 'A1', len: 320, bits: 6, fold: 0.3, sq: 0.2, grit: 0.4, bpm: 185, seed: 104 }],
    'harmony-01/hc-kick-early': ['early', { note: 'B1', len: 440, fade: 0.3, punch: 0.9, body: 0, seed: 105 }],
    'harmony-01/hc-kick-millennium': ['early', { note: 'E1', len: 900, fade: 0.9, drive1: 8, drive2: 3, clip: 0.4, grit: 0.25, close: 0.65, low: 1.2, hollow: 5, seed: 106 }],
    'harmony-01/ns-kick-punch': ['crossbreed', { note: 'G#1', len: 290, fade: 0.12, punch: 1.2, fold: 0, clip: 0.5, grit: 0.3, tick: 0.9, bpm: 150, seed: 107 }],
    'harmony-01/ns-kick-tail': ['mainstream', { note: 'G#1', len: 520, bend: -1, drive1: 10, drive2: 5, clip: 0.5, grit: 0.35, close: 0.4, bpm: 150, seed: 108 }],
    'harmony-01/ns-kick-masia': ['crossbreed', { note: 'A1', len: 250, fade: 0.1, grit: 0.7, tick: 1.4, cab: 0, mids: 12, bpm: 150, seed: 109 }],
    'harmony-01/ns-kick-jump': ['early', { note: 'F#1', len: 600, fade: 0.5, drive1: 4, drive2: 2, clip: 0.15, grit: 0, mids: 3, hollow: 2, punch: 1, low: 1.2, bpm: 145, seed: 110 }],
    // Harmony 05
    'harmony-05/rt-kick-fuzz': ['early', { note: 'D1', len: 600, sq: 0.35, mids: 12, grit: 0.45, clip: 0.85, fade: 0.6, seed: 111 }],
    'harmony-05/rt-kick-thump': ['early', { note: 'A1', len: 420, fade: 0.25, punch: 1.3, body: 2, clip: 0.5, seed: 112 }],
    'harmony-05/it-kick-tail': ['mainstream', { note: 'F#1', len: 880, fold: 0.3, grit: 0.4, close: 0.8, bpm: 172, seed: 113 }],
    'harmony-05/it-kick-high': ['mainstream', { note: 'A1', len: 700, fold: 0.2, grit: 0.45, close: 0.55, bpm: 172, seed: 114 }],
    'harmony-05/mo-kick-screech': ['mainstream', { note: 'E1', len: 940, fold: 0.3, screech: 0.8, close: 0.3, bpm: 180, seed: 115 }],
    'harmony-05/mo-kick-rumble': ['industrial', { note: 'F1', len: 1100, verb: 0.7, close: 0.9, dark: 0.3, bits: 0, bpm: 180, seed: 116 }],
    'harmony-05/mm-kick-tonal': ['mainstream', { note: 'A1', len: 780, drive1: 9, drive2: 4, clip: 0.5, grit: 0.2, close: 0.5, hollow: 4, bpm: 174, seed: 117 }],
    'harmony-05/mm-kick-tonal-c': ['mainstream', { note: 'C2', len: 700, drive1: 9, drive2: 4, clip: 0.5, grit: 0.2, close: 0.5, hollow: 4, bpm: 174, seed: 118 }],
    'harmony-05/nw-kick-seco': ['crossbreed', { note: 'A1', len: 280, fade: 0.1, fold: 0, tick: 1.3, grit: 0.4, clip: 0.6, bpm: 150, seed: 119 }],
    'harmony-05/nw-kick-tok': ['crossbreed', { note: 'B1', len: 260, fade: 0.1, fold: 0, body: 6, mids: 6, tok: 1.4, clip: 0.6, bpm: 150, seed: 120 }],
    // Harmony 07
    'harmony-07/os-kick-doom': ['industrial', { note: 'F1', len: 1040, close: 0.85, fold: 0.4, verb: 0.3, dark: 0.2, bits: 0, bpm: 170, seed: 121 }],
    'harmony-07/os-kick-metal': ['industrial', { note: 'G#1', len: 680, bits: 8, screech: 0.3, bpm: 170, seed: 122 }],
    'harmony-07/os-kick-thud': ['industrial', { note: 'F1', len: 400, fade: 0.12, dark: 0.75, clip: 0.3, grit: 0, verb: 0.1, bits: 0, bpm: 150, seed: 123 }],
    // Harmony 09: los puntos de partida tal cual (y alguna variante)
    'harmony-09/hd-kick-early': ['early', { seed: 201 }],
    'harmony-09/hd-kick-gabber': ['gabber909', { seed: 202 }],
    'harmony-09/hd-kick-gabber-f': ['gabber909', { note: 'F1', len: 480, seed: 203 }],
    'harmony-09/hd-kick-mainstream': ['mainstream', { seed: 204 }],
    'harmony-09/hd-kick-mainstream-f': ['mainstream', { note: 'F1', len: 360, seed: 205 }],
    'harmony-09/hd-kick-industrial': ['industrial', { seed: 206 }],
    'harmony-09/hd-kick-crossbreed': ['crossbreed', { seed: 207 }],
    'harmony-09/hd-kick-terror': ['terror', { seed: 208 }],
    'harmony-09/ht-kick': ['hardtechno', { seed: 209 }],
    'harmony-09/ht-kick-f': ['hardtechno', { note: 'F1', seed: 210 }]
  };
  H.data.kicks = {
    BASE, PRESETS, LIB,
    NOTES: ['E1', 'F1', 'F#1', 'G1', 'G#1', 'A1', 'A#1', 'B1', 'C2', 'C#2', 'D2', 'D#2', 'E2', 'F2', 'F#2', 'G2', 'G#2'],
    /* los ajustes completos de un punto de partida (con lo que cambie encima) */
    params: (key, over = {}) => ({ ...BASE, ...((PRESETS[key] && PRESETS[key].p) || {}), ...over }),
    /* los ajustes completos de un kick de la biblioteca (o null si no sale de este motor) */
    lib: (id) => (LIB[id] ? H.data.kicks.params(LIB[id][0], LIB[id][1]) : null)
  };
})();
