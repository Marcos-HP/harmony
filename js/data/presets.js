/* HARMONY · presets de banco por escuela
   Cada preset es un banco entero: 16 pads con sonidos de Harmony, tempo y cuatro patrones de 16 tiempos que se tocan
   encadenados (A intro · B subida · C drop · D break). Se cargan siempre en un banco nuevo (js/lib/banks.js, fromPreset):
   nunca pisan lo que ya hay.
   Mismo reparto en todos, para que la mano (y la DDJ-FLX4) se acostumbre:
     pads 1–8  (deck 1)  kick · kick 2 · palma o caja · charles cerrado · charles abierto · percusión · redoble · plato
     pads 9–16 (deck 2)  melodía en bucle · segundo bucle o stab · stab · pad o coro · subida · efecto · MC · grito
   Los bucles van en modo disparo y se lanzan al empezar el compás que toca: duran compases exactos al tempo del preset.
   Escrito en pasos de semicorchea: x golpe · o golpe suave · - la nota sigue (x--- dura 4 pasos; sin guiones, suena
   entera) · . nada · | separa compases (si hay menos de cuatro, se repiten).
   Un pad puede llevar sus efectos de sonido (fx: distorsión, filtro, bits, eco; ver js/lib/banks.js).
   Un pad en modo notas (melodic: [...]) toca su sonido transpuesto desde el piano roll: sus notas se escriben con
   notas(raíz del pad, compás 1, compás 2…), un elemento por semicorchea separado por espacios: D4 nota · d4 nota suave
   · D4+F4+A4 acorde · - la nota sigue · . nada. on('D2', 'x---x---') pone esa nota en los golpes de una fila. */
(function () {
  const H = (window.H = window.H || {});
  H.data = H.data || {};

  const r = (txt) => {
    const s = String(txt).replace(/[\s|]/g, '').replace(/x/g, '1').replace(/o/g, '2').replace(/\./g, '0');   // el «-» se queda
    let out = s;
    while (out.length < 64) out += s;
    return out.slice(0, 64);
  };
  /* golpes sueltos en esos pasos (0–63) */
  const at = (...steps) => { const a = Array(64).fill('.'); steps.forEach((s) => (a[s] = 'x')); return a.join(''); };
  const NADA = '................';
  const K4 = 'x...x...x...x...', CL = '....x.......x...', OH = '..x...x...x...x.';
  const SUBIDA = `${K4}|${K4}|x.x.x.x.x.x.x.x.|xxxxxxxxxxxxxxxx`;
  const VUELVE = `${NADA}|${NADA}|${NADA}|o...o...o...x.x.`;   // el kick vuelve en el último compás del break
  /* patrón: filas de golpes y, de los «-», la duración de cada nota (pat.lens, js/lib/patterns.js) */
  function pat(rows, mel) {
    const out = { len: 64, rows: {}, lens: {}, mel: mel || {} };
    for (const [i, t] of Object.entries(rows)) {
      const row = r(t);
      for (let k = 0; k < 64; k++) {
        if (row[k] !== '1' && row[k] !== '2') continue;
        let n = 1; while (k + n < 64 && row[k + n] === '-') n++;
        if (n > 1) (out.lens[i] = out.lens[i] || {})[k] = n;
      }
      out.rows[i] = row.replace(/-/g, '0');
    }
    return out;
  }
  /* notas del piano roll (pat.mel): semitonos respecto a la raíz del pad (la nota de su sonido) */
  const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const midi = (n) => { const m = /^([A-G])(#?)(-?\d)$/i.exec(n); if (!m) throw new Error('Nota mal escrita: ' + n); return 12 * (+m[3] + 1) + NOTE[m[1].toUpperCase()] + (m[2] ? 1 : 0); };
  function notas(root, ...bars) {
    const r0 = midi(root), toks = bars.join(' ').replace(/\|/g, ' ').trim().split(/\s+/), out = [];
    let all = toks; while (all.length < 64) all = all.concat(toks);
    all = all.slice(0, 64);
    all.forEach((t, k) => {
      if (t === '-' || t === '.') return;
      let n = 1; while (k + n < 64 && all[k + n] === '-') n++;
      t.split('+').forEach((x) => out.push([k, n, midi(x) - r0, x[0] === x[0].toLowerCase() ? 2 : 1]));
    });
    return out;
  }
  /* una nota en los golpes de una fila de golpes: on('D2', 'x---x---') → «D2 - - - D2 - - -» */
  const on = (note, row) => [...row.replace(/[\s|]/g, '')].map((c) => (c === 'x' ? note : c === 'o' ? note.toLowerCase() : c)).join(' ');
  const pad = (sampleId, name, o = {}) => ({ sampleId, name, volume: o.v != null ? o.v : 0.9, choke: o.ch || 0, pitch: o.p || 0, ...(o.fx || {}) });

  /* ---- partes de los presets en modo notas ---- */
  const K4L = 'x---x---x---x---', OCH = 'x-x-x-x-x-x-x-x-';
  const entero = (ch) => ch + ' -'.repeat(15);                                    // una nota o acorde que dura el compás
  const contra = (ch) => `. . ${ch} - . . ${ch} - . . ${ch} - . . ${ch} -`;        // a contratiempo, de corchea
  const bajo = (n, oct) => `. . ${n} - . . ${n} - . . ${n} - . . ${oct} -`;       // contratiempo con salto de octava al final
  const calla = NADA.split('').join(' ');
  // Uptempo melódico: Rem – Si♭ – Do – La (menor armónica), un acorde por compás
  const UM = { Dm: 'D4+F4+A4', Bb: 'D4+F4+A#4', C: 'E4+G4+C5', A: 'C#4+E4+A4' };
  const UM_LEAD = ['A4 - - - F4 - A4 - D5 - - - - - C5 -', 'A#4 - - - A4 - F4 - D4 - - - - - F4 -',
    'G4 - - - E4 - G4 - C5 - - - - - A#4 -', 'A4 - - - - - C#5 - E5 - - - D5 - C#5 -'];
  const UM_CHOPS = ['D4 - . F4 - . A4 - D5 - . A4 - . F4 -', 'D4 - . F4 - . A#4 - D5 - . A#4 - . F4 -',
    'E4 - . G4 - . C5 - E5 - . C5 - . G4 -', 'C#4 - . E4 - . A4 - C#5 - . A4 - . E4 -'];
  const suave = (bar) => bar.toLowerCase();
  // Frenchcore melódico: Rem – Solm – Si♭ – La
  const FM = { Dm: 'D4+F4+A4', Gm: 'D4+G4+A#4', Bb: 'D4+F4+A#4', A: 'C#4+E4+A4' };
  const FM_LEAD = ['D5 - - - - - A4 - D5 - E5 - F5 - - -', 'G5 - - - F5 - E5 - D5 - - - A#4 - - -',
    'F5 - - - - - D5 - A#4 - D5 - F5 - - -', 'E5 - - - C#5 - - - A4 - - - C#5 - E5 -'];
  const arpe = (a, b, c) => Array(4).fill(`${a} ${b} ${c} ${b}`).join(' ');      // arpegio de semicorcheas
  const FM_ARP = [arpe('d5', 'a4', 'f4'), arpe('d5', 'a#4', 'g4'), arpe('d5', 'a#4', 'f4'), arpe('e5', 'c#5', 'a4')];
  const FM_CHOPS = ['. . . . . . . . A4 - . A4 - . D5 -', '. . . . . . . . A#4 - . A#4 - . G5 -',
    '. . . . . . . . A#4 - . A#4 - . F5 -', '. . . . . . . . C#5 - . C#5 - . E5 -'];

  // Gabber de rave: Fam – Re♭ – Mi♭ – Do (Fa menor armónica), los acordes del Harmony 09
  const GR_HOOV = ['F2+C3', 'C#2+G#2', 'D#2+A#2', 'C2+G2'];
  // Happy hardcore: La♭ – Mi♭ – Fam – Re♭ y la melodía del piano (3 + 3 + 2)
  const HH_MEL = ['C5 - - D#5 - - G#5 - G5 - - D#5 - - C5 -', 'A#4 - - D#5 - - G5 - F5 - - D#5 - - A#4 -',
    'C5 - - F5 - - G#5 - G5 - - F5 - - C5 -', 'C#5 - - F5 - - G#5 - A#5 - - G#5 - - F5 -'];
  const HH_CHOPS = ['. . . . . . . . C5 - . D#5 - . G#5 -', '. . . . . . . . A#4 - . D#5 - . G5 -',
    '. . . . . . . . C5 - . F5 - . G#5 -', '. . . . . . . . C#5 - . F5 - . A#5 -'];
  // Hard techno: stabs de Fam a contratiempo sincopado, que bajan a Re♭m y Mi♭m
  const HT_STAB = (n) => `. . . ${n} - . ${n} - . . . ${n} - . . .`;
  /* ---- kick de hardcore en notas (piano roll): un solo kick que sigue la raíz de cada compás, como en el uptempo
     melódico. Intro en la tónica, subida que se acelera y sube, drop por los acordes con un remate que sube al final
     y vuelta suave en el break. raiz: la nota del pad (la del sonido más su tono); r: la raíz de cada compás */
  const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const tr = (n, st) => { const m = midi(n) + st; return NAMES[m % 12] + (Math.floor(m / 12) - 1); };
  const kNeg = (n) => on(n, K4L);
  const kRem = (n) => `${n} - - - ${n} - - - ${n} - ${n} - ${tr(n, 7)} - ${tr(n, 12)} ${tr(n, 12)}`;   // quinta y octava: valen en cualquier escala menor
  const kCor = (n) => on(n, OCH);
  const kRoll = (n) => [0, 0, 0, 0, 0, 0, 0, 0, 7, 7, 7, 7, 12, 12, 12, 12].map((st) => tr(n, st)).join(' ');
  const kVuelve = (n) => `${n.toLowerCase()} - - - ${n.toLowerCase()} - - - ${n.toLowerCase()} - - - ${n} - ${n} -`;
  const hcKicks = (raiz, r) => ({
    A: notas(raiz, kNeg(r[0]), kNeg(r[0]), kNeg(r[0]), kRem(r[0])),
    B: notas(raiz, kNeg(r[0]), kNeg(r[1]), kCor(r[2]), kRoll(r[3])),
    C: notas(raiz, kNeg(r[0]), kNeg(r[1]), kNeg(r[2]), kRem(r[3])),
    D: notas(raiz, calla, calla, calla, kVuelve(r[3]))
  });
  const RT_K = hcKicks('D1', ['D1', 'D1', 'D1', 'D1']), IT_K = hcKicks('F#1', ['F#1', 'D1', 'E1', 'C#1']), MO_K = hcKicks('E1', ['E1', 'E1', 'E1', 'F1']);
  const MM_K = hcKicks('A1', ['A1', 'F1', 'C2', 'G1']), OS_K = hcKicks('F1', ['F1', 'C#1', 'D#1', 'C1']), GR_K = hcKicks('F1', ['F1', 'C#1', 'D#1', 'C1']);

  H.data.presets = [
    {
      id: 'rotterdam', name: 'Rotterdam', school: 'Rotterdam / early', bpm: 175, swing: 0, tonality: 'Re menor', chain: 'ABCCDBCC',
      melodic: [0], scale: { root: 2, mode: 'menor' },
      desc: 'Gabber de los 90: el kick 909 casi cuadrado manda (desde el piano roll, con remates y un redoble que sube), hoovers, sirenas y palma 909.',
      pads: [
        pad('harmony-05/rt-kick-fuzz', 'Kick gabber (notas)', { v: 0.95 }), pad('harmony-05/rt-kick-thump', 'Kick early'), pad('harmony-05/rt-clap-909', 'Palma 909', { v: 0.8 }),
        pad('harmony-09/hd-charles', 'Charles cerrado', { v: 0.6, ch: 1 }), pad('harmony-05/rt-hat-open', 'Charles abierto', { v: 0.6, ch: 1 }),
        pad('harmony-01/perc-metal', 'Metal', { v: 0.6 }), pad('harmony-01/fill-snare-180', 'Redoble', { v: 0.75 }), pad('harmony-09/hd-plato', 'Plato', { v: 0.55 }),
        pad('harmony-05/rt-riff', 'Riff hoover', { v: 0.8 }), pad('harmony-05/rt-stab-rave', 'Stab Re m7', { v: 0.8 }), pad('harmony-05/rt-hoover-alarm', 'Hoover de alarma', { v: 0.75 }),
        pad('harmony-09/hd-hoover', 'Hoover (Re)', { v: 0.7, p: 2 }), pad('harmony-05/rt-siren-up', 'Sirena', { v: 0.7 }), pad('harmony-09/hd-subida', 'Subida', { v: 0.7 }),
        pad('harmony-02/mc-rotterdam', 'MC Rotterdam', { v: 0.85 }), pad('harmony-02/shout-hey', 'Hey', { v: 0.8 })
      ],
      patterns: [
        // intro: el kick gabber en la tónica desde el primer tiempo, con remate al final
        pat({ 4: `${NADA}|${NADA}|${OH}|${OH}`, 7: at(0), 11: at(0, 32), 14: at(48) }, { 0: RT_K.A }),
        // subida: corcheas y un redoble de kick que sube
        pat({ 2: `${CL}|${CL}|x...x...x...x...|x.x.x.x.x.x.x.x.`, 6: at(48), 12: at(0, 16), 13: at(32) }, { 0: RT_K.B }),
        pat({ 2: CL, 3: 'o...o...o...o...', 4: OH, 5: '......o.......o.', 7: at(0), 8: at(0, 32), 15: at(56) }, { 0: RT_K.C }),
        pat({ 9: 'x.....x.....x...', 10: at(0, 32), 12: at(48), 14: at(16) }, { 0: RT_K.D })
      ]
    },
    {
      id: 'italiano', name: 'Hardcore italiano', school: 'Hardcore italiano', bpm: 172, swing: 0, tonality: 'Fa# menor', chain: 'ABCCDBCC',
      melodic: [0], scale: { root: 6, mode: 'menor' },
      desc: 'El kick con cola larga sigue los acordes (Fa#m – Re – Mi – Do#) desde el piano roll, bajo un lead épico de supersierra y hoover, cuerdas y coros.',
      pads: [
        pad('harmony-05/it-kick-tail', 'Kick italiano (notas)', { v: 0.9 }), pad('harmony-05/it-kick-high', 'Kick agudo (La)'), pad('harmony-09/hd-palma', 'Palma', { v: 0.8 }),
        pad('harmony-09/hd-charles', 'Charles cerrado', { v: 0.6, ch: 1 }), pad('harmony-09/hd-charles-abierto', 'Charles abierto', { v: 0.6, ch: 1 }),
        pad('harmony-09/hd-caja', 'Caja', { v: 0.7 }), pad('harmony-05/it-roll', 'Redoble', { v: 0.75 }), pad('harmony-09/hd-plato', 'Plato', { v: 0.6 }),
        pad('harmony-05/it-lead', 'Lead épico', { v: 0.8 }), pad('harmony-05/it-strings', 'Cuerdas', { v: 0.75 }), pad('harmony-05/it-choir-stab', 'Golpe de coro', { v: 0.8 }),
        pad('harmony-02/choir-ooh', 'Coro «ooh»', { v: 0.75 }), pad('harmony-05/it-reverse', 'Kick al revés', { v: 0.8 }), pad('harmony-09/hd-subida', 'Subida', { v: 0.7 }),
        pad('harmony-02/mc-hardcore', 'MC Hardcore', { v: 0.85 }), pad('harmony-02/shout-oi', 'Oi', { v: 0.8 })
      ],
      patterns: [
        pat({ 4: OH, 7: at(0), 10: at(0, 32), 14: at(48) }, { 0: IT_K.A }),
        pat({ 2: `${CL}|${CL}|${CL}|${NADA}`, 6: at(48), 9: at(0), 12: at(39), 13: at(30) }, { 0: IT_K.B }),
        // drop: el kick sigue los acordes (Fa#m – Re – Mi – Do#) bajo el lead épico
        pat({ 2: CL, 3: 'o...o...o...o...', 4: OH, 5: '...............o', 7: at(0), 8: at(0), 15: at(56) }, { 0: IT_K.C }),
        pat({ 8: at(0), 9: at(0), 11: at(32), 14: at(48) }, { 0: IT_K.D })
      ]
    },
    {
      id: 'mainstream-oscuro', name: 'Mainstream oscuro', school: 'Mainstream oscuro', bpm: 178, swing: 0, tonality: 'Mi frigio', chain: 'ABCCDBCC',
      melodic: [0], scale: { root: 4, mode: 'frigio' },
      desc: 'Kick largo que chilla (desde el piano roll: Mi y el Fa frigio, remates que suben), kick rumble en la intro, campanas de terror, drones y golpes industriales.',
      pads: [
        pad('harmony-05/mo-kick-screech', 'Kick con chillido (notas)', { v: 0.85 }), pad('harmony-05/mo-kick-rumble', 'Kick rumble'), pad('harmony-09/hd-palma-grande', 'Palma con sala', { v: 0.8 }),
        pad('harmony-09/hd-charles', 'Charles cerrado', { v: 0.55, ch: 1 }), pad('harmony-09/hd-charles-abierto', 'Charles abierto', { v: 0.55, ch: 1 }),
        pad('harmony-05/mo-perc', 'Golpe industrial', { v: 0.7 }), pad('harmony-01/fill-toms-180', 'Redoble de toms', { v: 0.75 }), pad('harmony-05/mo-impact', 'Impacto', { v: 0.7 }),
        pad('harmony-05/mo-lead', 'Riff oscuro', { v: 1 }), pad('harmony-05/mo-drone', 'Drone', { v: 0.7 }), pad('harmony-05/mo-bell', 'Campana', { v: 0.75 }),
        pad('harmony-05/mo-screech', 'Chillido', { v: 0.7 }), pad('harmony-09/hd-subida', 'Subida', { v: 0.7 }), pad('harmony-02/fx-demon', 'Voz demonio', { v: 0.85 }),
        pad('harmony-02/fx-warning', 'Aviso', { v: 0.85 }), pad('harmony-02/shout-ho', 'Ho', { v: 0.8 })
      ],
      patterns: [
        // intro: el kick rumble a negras y los golpes industriales
        pat({ 1: K4, 5: '..........o.....', 9: at(0), 10: at(0, 32), 13: at(48) }),
        pat({ 2: `${CL}|${CL}|${NADA}|${NADA}`, 6: at(48), 11: at(0, 32), 12: at(32) }, { 0: MO_K.B }),
        // drop: el kick que chilla, en Mi y empujando a Fa (el frigio) en el cuarto compás
        pat({ 2: CL, 4: OH, 5: '.......o.......o', 7: at(0), 8: at(0, 32), 15: at(56) }, { 0: MO_K.C }),
        pat({ 9: at(0), 10: at(0, 16, 32), 11: at(48), 14: at(32) }, { 0: MO_K.D })
      ]
    },
    {
      id: 'mainstream-melodico', name: 'Mainstream melódico', school: 'Mainstream melódico', bpm: 174, swing: 0, tonality: 'La menor', chain: 'ABCCDBCC',
      melodic: [0], scale: { root: 9, mode: 'menor' },
      desc: 'El kick tonal canta los acordes (Lam – Fa – Do – Sol) desde el piano roll, bajo el lead eufórico, el piano y el arpegio.',
      pads: [
        pad('harmony-05/mm-kick-tonal', 'Kick tonal (notas)', { v: 0.75 }), pad('harmony-05/mm-kick-tonal-c', 'Kick Do'), pad('harmony-09/hd-palma', 'Palma', { v: 0.8 }),
        pad('harmony-09/hd-charles', 'Charles cerrado', { v: 0.55, ch: 1 }), pad('harmony-09/hd-charles-abierto', 'Charles abierto', { v: 0.55, ch: 1 }),
        pad('harmony-01/snare-clap', 'Caja palma', { v: 0.7 }), pad('harmony-01/fill-snare-180', 'Redoble', { v: 0.75 }), pad('harmony-09/hd-plato', 'Plato', { v: 0.6 }),
        pad('harmony-05/mm-lead', 'Lead eufórico', { v: 0.8 }), pad('harmony-05/mm-piano', 'Piano', { v: 0.8 }), pad('harmony-05/mm-arp', 'Arpegio', { v: 0.7 }),
        pad('harmony-05/mm-choir', 'Coro', { v: 0.75 }), pad('harmony-01/riser-supersaw', 'Subida', { v: 0.7 }), pad('harmony-01/reverse-crash', 'Plato al revés', { v: 0.65 }),
        pad('harmony-02/mc-make-some-noise', 'Make some noise', { v: 0.85 }), pad('harmony-02/shout-yeah', 'Yeah', { v: 0.8 })
      ],
      patterns: [
        pat({ 3: OH, 7: at(0), 10: at(0), 14: at(48) }, { 0: MM_K.A }),
        pat({ 2: `${CL}|${CL}|${NADA}|${NADA}`, 6: at(48), 9: at(0), 12: at(27), 13: at(38) }, { 0: MM_K.B }),
        // drop: el kick tonal sigue los acordes (Lam – Fa – Do – Sol)
        pat({ 2: CL, 4: OH, 7: at(0), 8: at(0), 10: at(0), 15: at(56) }, { 0: MM_K.C }),
        pat({ 9: at(0), 11: at(0), 14: at(48) }, { 0: MM_K.D })
      ]
    },
    {
      id: 'raw-uptempo', name: 'Raw / uptempo', school: 'Raw / uptempo', bpm: 205, swing: 0, tonality: 'Re menor', chain: 'ABCCDBCC',
      desc: 'Por encima de 200 BPM: kicks plegados y brutales, melodía de kicks, gritos de ruido y stabs muy cortos.',
      pads: [
        pad('harmony-05/rw-kick-raw', 'Kick raw'), pad('harmony-05/rw-kick-bend', 'Kick que sube'), pad('harmony-01/clap-hardcore', 'Palma', { v: 0.75 }),
        pad('harmony-01/hat-closed', 'Charles cerrado', { v: 0.55, ch: 1 }), pad('harmony-01/hat-open', 'Charles abierto', { v: 0.55, ch: 1 }),
        pad('harmony-05/rw-kick-noise', 'Kick con ruido', { v: 0.8 }), pad('harmony-01/fill-kick-200', 'Redoble de kicks', { v: 0.8 }), pad('harmony-01/impact-hardcore', 'Impacto', { v: 0.7 }),
        pad('harmony-05/rw-riff', 'Melodía de kicks', { v: 0.8 }), pad('harmony-05/rw-stab', 'Acorde raw', { v: 0.75 }), pad('harmony-05/rw-scream', 'Grito de ruido', { v: 0.7 }),
        pad('harmony-01/laser', 'Láser', { v: 0.65 }), pad('harmony-01/riser-noise', 'Subida', { v: 0.7 }), pad('harmony-01/tape-stop', 'Tape stop', { v: 0.75 }),
        pad('harmony-02/mc-uptempo', 'MC Uptempo', { v: 0.85 }), pad('harmony-02/shout-oi', 'Oi', { v: 0.8 })
      ],
      patterns: [
        pat({ 0: K4, 4: OH, 7: at(0), 14: at(48) }),
        pat({ 0: `${K4}|${K4}|x.x.x.x.x.x.x.x.|${NADA}`, 1: `${NADA}|${NADA}|${NADA}|${NADA}`, 2: `${CL}|${CL}|${NADA}|${NADA}`, 6: at(48), 10: at(32), 12: at(28) }),
        pat({ 0: K4, 2: CL, 4: OH, 7: at(0), 8: at(0, 32), 9: '..............x.', 15: at(56) }),
        pat({ 5: VUELVE, 9: 'x..x..x...x..x..', 10: at(0), 11: at(16, 48), 13: at(56), 14: at(32) })
      ]
    },
    {
      id: 'newstyle', name: 'Newstyle', school: 'Newstyle', bpm: 150, swing: 0, tonality: 'La menor', chain: 'ABCCDBCC',
      desc: 'A 150 BPM: kick seco y corto, bajo a contratiempo, palma con sala y órgano. Los pitidos van en el preset «Newstyle de pitidos».',
      pads: [
        pad('harmony-05/nw-kick-seco', 'Kick seco'), pad('harmony-05/nw-kick-tok', 'Kick tok'), pad('harmony-05/nw-clap', 'Palma con sala', { v: 0.8 }),
        pad('harmony-01/hat-closed', 'Charles cerrado', { v: 0.55, ch: 1 }), pad('harmony-05/nw-hat', 'Charles abierto', { v: 0.6, ch: 1 }),
        pad('harmony-05/nw-bass-off', 'Bajo (golpe)', { v: 0.8 }), pad('harmony-01/rim', 'Rim', { v: 0.6 }), pad('harmony-01/crash', 'Plato', { v: 0.6 }),
        pad('harmony-05/nw-bass-loop', 'Bajo La – Fa – Sol – Mi', { v: 0.85 }), pad('harmony-05/nw-stab', 'Órgano La m', { v: 0.75 }), pad('harmony-03/music-box', 'Caja de música', { v: 0.7 }),
        pad('harmony-02/choir-aah', 'Coro «aah»', { v: 0.7 }), pad('harmony-01/riser-noise', 'Subida', { v: 0.7 }), pad('harmony-02/shout-hey-x3', 'Hey hey hey', { v: 0.8 }),
        pad('harmony-02/mc-newstyle', 'MC Newstyle', { v: 0.85 }), pad('harmony-02/mc-drop', 'Drop', { v: 0.85 })
      ],
      patterns: [
        pat({ 0: K4, 4: OH, 6: '......x.......x.', 7: at(0), 10: at(0, 32) }),
        pat({ 0: SUBIDA, 2: `${CL}|${CL}|${CL}|${NADA}`, 5: `${OH}|${OH}|${NADA}|${NADA}`, 12: at(37), 15: at(48) }),
        pat({ 0: K4, 2: CL, 4: OH, 7: at(0), 8: at(0), 9: `${NADA}|..o...o...o...o.|${NADA}|..o...o...o...o.`, 13: at(56) }),
        pat({ 0: VUELVE, 9: 'x.....x.....x...|' + NADA, 10: at(0, 32), 11: at(0), 14: at(48) })
      ]
    },
    {
      id: 'newstyle-pitidos', name: 'Newstyle de pitidos', school: 'Newstyle', bpm: 175, swing: 0, tonality: 'La menor', chain: 'ABCCDBCC',
      desc: 'A 175 BPM: el pitido agudo y casi puro llevando la melodía, con glides y arcos de bend, sobre kick seco y bajo a contratiempo.',
      pads: [
        pad('harmony-05/nw-kick-seco', 'Kick seco'), pad('harmony-05/nw-kick-tok', 'Kick tok'), pad('harmony-05/nw-clap', 'Palma con sala', { v: 0.8 }),
        pad('harmony-01/hat-closed', 'Charles cerrado', { v: 0.55, ch: 1 }), pad('harmony-05/nw-hat', 'Charles abierto', { v: 0.6, ch: 1 }),
        pad('harmony-05/nw-bass-off', 'Bajo a contratiempo', { v: 0.8 }), pad('harmony-01/rim', 'Rim', { v: 0.6 }), pad('harmony-01/crash', 'Plato', { v: 0.6 }),
        pad('harmony-06/pt-lead-1', 'Pitidos ligados', { v: 0.6 }), pad('harmony-06/pt-drop', 'Pitidos del drop', { v: 0.6 }), pad('harmony-06/pt-call', 'Pregunta y respuesta', { v: 0.6 }),
        pad('harmony-06/pt-break', 'Pitidos del break', { v: 0.6 }), pad('harmony-01/riser-noise', 'Subida', { v: 0.7 }), pad('harmony-06/pt-bend-arc', 'Arco de pitido', { v: 0.6 }),
        pad('harmony-02/mc-newstyle', 'MC Newstyle', { v: 0.85 }), pad('harmony-02/shout-hey-x3', 'Hey hey hey', { v: 0.8 })
      ],
      patterns: [
        pat({ 0: K4, 4: OH, 6: '......x.......x.', 7: at(0), 10: at(0, 32) }),
        pat({ 0: SUBIDA, 2: `${CL}|${CL}|${CL}|${NADA}`, 5: `${OH}|${OH}|${NADA}|${NADA}`, 8: at(0), 12: at(33), 13: at(56) }),
        pat({ 0: K4, 2: CL, 4: OH, 5: OH, 7: at(0), 9: at(0), 15: at(52) }),
        pat({ 0: VUELVE, 11: at(0), 13: at(28), 14: at(48) })
      ]
    },
    {
      id: 'hardcore-oscuro', name: 'Hardcore oscuro', school: 'Hardcore oscuro', bpm: 170, swing: 0, tonality: 'Fa menor', chain: 'ABCCDBCC',
      melodic: [0], scale: { root: 5, mode: 'menor' },
      desc: 'Kick mainstream de cola sostenida que sigue al bajo rumble (Fa – Re♭ – Mi♭ – Do) desde el piano roll, kick oscuro largo en la intro, órgano siniestro, coro grave y campana de iglesia.',
      pads: [
        pad('harmony-09/hd-kick-mainstream-f', 'Kick mainstream (notas)', { v: 0.85 }), pad('harmony-07/os-kick-doom', 'Kick oscuro largo'), pad('harmony-09/hd-palma-grande', 'Palma oscura', { v: 0.8 }),
        pad('harmony-07/os-hat', 'Charles de chatarra', { v: 0.5, ch: 1 }), pad('harmony-09/hd-charles-abierto', 'Charles abierto', { v: 0.45, ch: 1, fx: { filter: 'lp', cutoff: 5000, res: 10 } }),
        pad('harmony-07/os-pipe', 'Tubo', { v: 0.55 }), pad('harmony-01/fill-toms-180', 'Redoble de toms', { v: 0.75, fx: { drive: 30, shape: 'soft' } }), pad('harmony-07/os-slam', 'Portazo', { v: 0.7 }),
        pad('harmony-07/os-organ', 'Órgano siniestro', { v: 0.7 }), pad('harmony-07/os-lead', 'Riff oscuro', { v: 1 }), pad('harmony-07/os-bass', 'Bajo rumble', { v: 0.8 }),
        pad('harmony-07/os-choir', 'Coro grave', { v: 0.7 }), pad('harmony-07/os-riser', 'Subida oscura', { v: 0.7 }), pad('harmony-07/os-bell', 'Campana', { v: 0.6 }),
        pad('harmony-02/fx-demon', 'Voz demonio', { v: 0.8, fx: { echo: 30, echoDiv: 0.75, echoFb: 40 } }), pad('harmony-09/hd-grito', 'Chillido', { v: 0.6 })
      ],
      patterns: [
        // intro: el kick oscuro largo a negras, charles y metal
        pat({ 1: K4, 3: '..o...o...o...o.', 5: `${NADA}|..........x.....`, 7: at(0), 11: at(0), 13: at(0, 32) }),
        pat({ 2: `${CL}|${CL}|${NADA}|${NADA}`, 6: at(48), 8: at(0), 12: at(28), 14: at(16) }, { 0: OS_K.B }),
        // drop: el kick mainstream sigue al bajo rumble (Fa – Re♭ – Mi♭ – Do)
        pat({ 2: CL, 3: 'o...o...o...o...', 4: OH, 7: at(0), 9: at(0, 32), 10: at(0), 15: at(56) }, { 0: OS_K.C }),
        // en el break, la campana se corta cada medio compás (notas de 8 pasos)
        pat({ 8: at(0), 11: at(0), 13: 'x-------x-------', 14: at(48) }, { 0: OS_K.D })
      ]
    },
    {
      id: 'industrial', name: 'Industrial', school: 'Hardcore oscuro', bpm: 170, swing: 0, tonality: 'Fa menor', chain: 'ABCCDBCC',
      melodic: [1], scale: { root: 5, mode: 'menor' },
      desc: 'Medio tiempo con kick sordo en la intro y, en el drop, el kick industrial siguiendo al bajo rumble desde el piano roll. Caja y metal triturados, portazos, drones y latidos.',
      pads: [
        pad('harmony-07/os-kick-thud', 'Kick sordo'), pad('harmony-09/hd-kick-industrial', 'Kick industrial (notas)', { v: 0.95, p: 1 }), pad('harmony-09/hd-caja', 'Caja industrial', { v: 0.8 }),
        pad('harmony-07/os-hat', 'Charles de chatarra', { v: 0.5, ch: 1 }), pad('harmony-05/mo-perc', 'Golpe industrial', { v: 0.65 }),
        pad('harmony-07/os-pipe', 'Tubo con eco', { v: 0.6, fx: { echo: 35, echoDiv: 0.75, echoFb: 45 } }), pad('harmony-09/ht-percusion', 'Metal triturado', { v: 0.55, fx: { bits: 6 } }), pad('harmony-07/os-slam', 'Portazo', { v: 0.7 }),
        pad('harmony-07/os-bass', 'Bajo rumble', { v: 0.8 }), pad('harmony-07/os-drone', 'Drone de fábrica', { v: 0.6 }), pad('harmony-07/os-stab', 'Golpe disonante', { v: 0.7, fx: { echo: 25, echoDiv: 0.5, echoFb: 30 } }),
        pad('harmony-07/os-heart', 'Latido', { v: 0.85 }), pad('harmony-07/os-riser', 'Subida oscura', { v: 0.7 }), pad('harmony-05/mo-screech', 'Chillido', { v: 0.55 }),
        pad('harmony-02/fx-radio', 'Voz de radio', { v: 0.8, fx: { bits: 6 } }), pad('harmony-02/fx-warning', 'Aviso', { v: 0.8 })
      ],
      patterns: [
        // medio tiempo: kick en el 1 y en la «y» del 2, caja en el 3
        pat({ 0: 'x.....x.........', 2: '........x.......', 3: 'o.o.o.o.o.o.o.o.', 5: `${NADA}|............x...`, 9: at(0), 7: at(0) }),
        // kick picado: notas de dos pasos que cortan la cola, y un redoble que sube
        pat({ 2: '....x.......x...|....x.......x...|..x...x...x...x.|x.x.x.x.xxxxxxxx', 6: '...o...o...o...o', 12: at(28) }, {
          1: notas('F1', on('F1', 'x-..x-..x-..x-..'), on('F1', 'x-..x-..x-..x-..'), on('F1', 'x-x-x-x-x-x-x-x-'), kRoll('F1')) }),
        // drop: el kick industrial sigue al bajo rumble (Fa – Re♭ – Mi♭ – Do)
        pat({ 2: CL, 3: OH, 4: '.......x.......x', 6: '...o...o...o...o', 8: at(0), 10: at(0, 32), 7: at(0), 13: at(56) }, { 1: OS_K.C }),
        pat({ 0: VUELVE, 9: at(0), 11: 'x.......x.......', 5: at(16, 48), 15: at(0), 14: at(32) })
      ]
    },
    {
      id: 'uptempo-distorsionado', name: 'Uptempo distorsionado', school: 'Raw / uptempo', bpm: 210, swing: 0, tonality: 'Re menor', chain: 'ABCCDBCC',
      desc: 'A 210 BPM: kick zaag que zumba como una sierra, screech triturado, acordes cortados, sirena raw y gritos de ruido.',
      pads: [
        pad('harmony-07/ud-kick-zaag', 'Kick zaag'), pad('harmony-07/ud-kick-tok', 'Kick tok'), pad('harmony-07/ud-clap', 'Palma', { v: 0.75 }),
        pad('harmony-07/ud-hat', 'Charles roto', { v: 0.5, ch: 1 }), pad('harmony-01/hat-open', 'Charles abierto', { v: 0.45, ch: 1, fx: { bits: 8 } }),
        pad('harmony-07/ud-kick-crush', 'Kick triturado', { v: 0.8 }), pad('harmony-07/ud-roll', 'Redoble raw', { v: 0.8 }), pad('harmony-07/ud-impact', 'Impacto', { v: 0.7 }),
        pad('harmony-07/ud-screech', 'Screech', { v: 0.6 }), pad('harmony-07/ud-chords', 'Acordes cortados', { v: 0.6 }), pad('harmony-04/ut2-raw', 'Riff raw', { v: 0.65 }),
        pad('harmony-07/ud-siren', 'Sirena raw', { v: 0.6 }), pad('harmony-07/ud-riser', 'Subida plegada', { v: 0.7 }), pad('harmony-07/ud-scream', 'Grito', { v: 0.65 }),
        pad('harmony-02/mc-uptempo', 'MC Uptempo', { v: 0.85, fx: { drive: 35, shape: 'hard' } }), pad('harmony-07/ud-stutter', 'Tartamudeo', { v: 0.8 })
      ],
      patterns: [
        pat({ 0: K4, 3: '..x...x...x...x.', 7: at(0), 9: at(0), 14: at(48) }),
        pat({ 1: 'x.xxx.xxx.xxx.xx|x.xxx.xxx.xxx.xx|x.xxx.xxx.xxx.xx|xxxxxxxxxxxxxxxx', 2: `${CL}|${CL}|${NADA}|${NADA}`, 6: at(48), 11: at(0, 16), 12: at(27) }),
        pat({ 0: K4, 2: CL, 3: 'o.o.o.o.o.o.o.o.', 4: OH, 5: '..............x.', 7: at(0), 8: at(0, 32), 13: at(56), 15: at(60) }),
        pat({ 0: VUELVE, 9: at(0), 10: at(0, 32), 11: at(48) })
      ]
    },
    {
      id: 'uptempo-kicks', name: 'Uptempo de kicks', school: 'Raw / uptempo', bpm: 210, swing: 0, tonality: 'Re menor', chain: 'ABCCDBCC',
      desc: 'El kick como instrumento: kick con bajo inverso en cada tiempo, melodías de kicks rodantes y kick que chilla, con screech y acordes.',
      pads: [
        pad('harmony-07/ud-kick-tok', 'Kick tok'), pad('harmony-07/ud-kick-screech', 'Kick que chilla'), pad('harmony-07/ud-clap', 'Palma', { v: 0.75 }),
        pad('harmony-07/ud-hat', 'Charles roto', { v: 0.5, ch: 1 }), pad('harmony-07/ud-kick-pump', 'Kick con bajo inverso'),
        pad('harmony-07/ud-kick-melody', 'Melodía de kicks', { v: 0.85 }), pad('harmony-07/ud-roll', 'Redoble raw', { v: 0.8 }), pad('harmony-07/ud-impact', 'Impacto', { v: 0.7 }),
        pad('harmony-07/ud-raw', 'Golpes raw', { v: 0.65 }), pad('harmony-04/ut2-screech', 'Screech II', { v: 0.6 }), pad('harmony-04/ut2-chords', 'Acordes II', { v: 0.6 }),
        pad('harmony-07/ud-laser', 'Láser roto', { v: 0.6 }), pad('harmony-07/ud-riser', 'Subida plegada', { v: 0.7 }), pad('harmony-07/ud-scream', 'Grito', { v: 0.65 }),
        pad('harmony-02/mc-louder', 'Louder', { v: 0.85, fx: { drive: 40, shape: 'hard', echo: 20, echoDiv: 0.5 } }), pad('harmony-02/shout-oi', 'Oi', { v: 0.8, fx: { bits: 6 } })
      ],
      patterns: [
        pat({ 4: K4, 3: '..x...x...x...x.', 10: at(0, 32), 11: at(14, 46) }),
        pat({ 0: 'x.xxx.xxx.xxx.xx|x.xxx.xxx.xxx.xx|xxxxxxxxxxxxxxxx|xxxxxxxxxxxxxxxx', 2: `${CL}|${CL}|${CL}|${NADA}`, 6: at(48), 12: at(27), 14: at(0) }),
        pat({ 1: 'x...............', 5: at(0, 32), 2: CL, 3: 'o.o.o.o.o.o.o.o.', 9: at(0, 32), 7: at(0), 13: at(56), 15: at(30) }),
        pat({ 4: VUELVE, 8: at(0, 32), 10: at(0, 32), 11: at(62) })
      ]
    },
    {
      id: 'uptempo-himno', name: 'Uptempo himno', school: 'Raw / uptempo', bpm: 200, swing: 0, tonality: 'Re menor', chain: 'ABCCDBCC',
      desc: 'El kick sigue los acordes (Rem – Si♭ – Fa – Do): un kick afinado a cada uno. Lead de himno, coro, chops de voz y un redoble de kick que sube hasta el drop.',
      pads: [
        pad('harmony-08/up-kick-d2', 'Kick Re', { v: 0.8 }), pad('harmony-08/up-kick-as1', 'Kick Si♭', { v: 0.8 }), pad('harmony-08/up-kick-f2', 'Kick Fa', { v: 0.8 }), pad('harmony-08/up-kick-c2', 'Kick Do', { v: 0.8 }),
        pad('harmony-08/himno-palma', 'Palma', { v: 0.75 }), pad('harmony-08/himno-charles', 'Charles', { v: 0.45 }), pad('harmony-08/himno-redoble', 'Redoble', { v: 0.75 }), pad('harmony-08/himno-impacto', 'Impacto', { v: 0.7 }),
        pad('harmony-08/himno-lead', 'Lead del himno', { v: 1 }), pad('harmony-08/himno-lead', 'Lead filtrado', { v: 0.6, fx: { filter: 'lp', cutoff: 900, res: 35 } }),
        pad('harmony-08/himno-acordes', 'Acordes', { v: 0.55 }), pad('harmony-08/himno-coro', 'Coro', { v: 0.6 }),
        pad('harmony-08/himno-subida', 'Subida', { v: 0.7 }), pad('harmony-08/himno-chops', 'Chops de voz', { v: 0.6 }),
        pad('harmony-08/himno-kickroll', 'Redoble de kick', { v: 0.85 }), pad('harmony-08/himno-plato-reves', 'Plato al revés', { v: 0.65 })
      ],
      patterns: [
        // intro: el lead filtrado, los acordes y el kick ya siguiendo la armonía
        pat({ 0: `${K4}|${NADA}|${NADA}|${NADA}`, 1: `${NADA}|${K4}|${NADA}|${NADA}`, 2: `${NADA}|${NADA}|${K4}|${NADA}`, 3: `${NADA}|${NADA}|${NADA}|${K4}`,
          5: OH, 7: at(0), 9: at(0), 10: at(0) }),
        // subida: corcheas en Fa, el redoble de kick en Do, la subida, el redoble y el plato al revés antes del drop
        pat({ 0: `${K4}|${NADA}|${NADA}|${NADA}`, 1: `${NADA}|${K4}|${NADA}|${NADA}`, 2: `${NADA}|${NADA}|x.x.x.x.x.x.x.x.|${NADA}`,
          4: `${CL}|${CL}|x...x...x...x...|${NADA}`, 6: at(48), 10: at(0), 11: at(0), 12: at(32), 14: at(48), 15: at(56) }),
        // drop: el lead, el kick por los acordes y un remate al final del ciclo
        pat({ 0: `${K4}|${NADA}|${NADA}|${NADA}`, 1: `${NADA}|${K4}|${NADA}|${NADA}`, 2: `${NADA}|${NADA}|${K4}|${NADA}`, 3: `${NADA}|${NADA}|${NADA}|x...x...x...x.xx`,
          4: CL, 5: 'o.x.o.x.o.x.o.x.', 7: at(0), 8: at(0) }),
        // break: acordes, coro y chops; el kick de Do vuelve en el último compás
        pat({ 3: VUELVE, 10: at(0), 11: at(0), 13: at(0) })
      ]
    },
    {
      id: 'frenchcore-himno', name: 'Frenchcore himno', school: 'Frenchcore', bpm: 200, swing: 0, tonality: 'Re menor', chain: 'ABCCDBCC',
      desc: 'Kick de frenchcore con su cola zumbona y el bajo distorsionado a contratiempo siguiendo los acordes. Piano, cuerdas en staccato y el mismo himno arriba.',
      pads: [
        pad('harmony-08/fc-kick', 'Kick frenchcore', { v: 0.8 }), pad('harmony-08/fc-bajo-d2', 'Bajo Re', { v: 0.7 }), pad('harmony-08/fc-bajo-as1', 'Bajo Si♭', { v: 0.7 }), pad('harmony-08/fc-bajo-f2', 'Bajo Fa', { v: 0.7 }), pad('harmony-08/fc-bajo-c2', 'Bajo Do', { v: 0.7 }),
        pad('harmony-08/himno-palma', 'Palma', { v: 0.75 }), pad('harmony-08/himno-charles', 'Charles', { v: 0.4 }), pad('harmony-08/himno-impacto', 'Impacto', { v: 0.7 }),
        pad('harmony-08/himno-piano', 'Piano', { v: 0.7 }), pad('harmony-08/fc-cuerdas', 'Cuerdas', { v: 0.65 }), pad('harmony-08/himno-lead', 'Lead del himno', { v: 1 }),
        pad('harmony-08/himno-coro', 'Coro', { v: 0.6 }), pad('harmony-08/himno-subida', 'Subida', { v: 0.7 }), pad('harmony-08/himno-plato-reves', 'Plato al revés', { v: 0.65 }),
        pad('harmony-08/himno-redoble', 'Redoble', { v: 0.75 }), pad('harmony-08/himno-chops', 'Chops de voz', { v: 0.55 })
      ],
      patterns: [
        // intro: piano y coro; el kick entra en la segunda mitad
        pat({ 0: `${NADA}|${NADA}|${K4}|${K4}`, 6: `${NADA}|${NADA}|${OH}|${OH}`, 8: at(0), 11: at(0) }),
        // subida: cuerdas, kick que se acelera, subida, redoble y plato al revés
        pat({ 0: SUBIDA, 5: `${CL}|${CL}|${NADA}|${NADA}`, 9: at(0), 11: at(0), 12: at(32), 13: at(56), 14: at(48) }),
        // drop: kick en los tiempos y el bajo a contratiempo, cambiando con cada acorde
        pat({ 0: K4, 1: `${OH}|${NADA}|${NADA}|${NADA}`, 2: `${NADA}|${OH}|${NADA}|${NADA}`, 3: `${NADA}|${NADA}|${OH}|${NADA}`, 4: `${NADA}|${NADA}|${NADA}|${OH}`,
          5: CL, 6: 'o.o.o.o.o.o.o.o.', 7: at(0), 10: at(0) }),
        // break: piano, coro y chops; vuelve el kick con el bajo de Do al final
        pat({ 0: VUELVE, 4: `${NADA}|${NADA}|${NADA}|..x...x.........`, 8: at(0), 11: at(0), 15: at(0) })
      ]
    },
    {
      id: 'uptempo-melodico', name: 'Uptempo melódico', school: 'Raw / uptempo', bpm: 200, swing: 0, tonality: 'Re menor armónica', chain: 'ABCCDBCC',
      melodic: [0, 8, 9, 10, 11], scale: { root: 2, mode: 'armonica' },
      desc: 'Todo lo que suena a nota sale del piano roll: un solo kick que toca los acordes (Rem – Si♭ – Do – La) y una melodía de kicks, bajo a contratiempo, órgano en acordes, lead y chops de voz.',
      pads: [
        pad('harmony-08/up-kick-d2', 'Kick (notas)', { v: 0.8 }), pad('harmony-07/ud-kick-tok', 'Kick tok', { v: 0.75 }), pad('harmony-08/himno-palma', 'Palma', { v: 0.75 }),
        pad('harmony-08/himno-charles', 'Charles', { v: 0.45, ch: 1 }), pad('harmony-05/rt-hat-open', 'Charles abierto', { v: 0.5, ch: 1 }),
        pad('harmony-01/perc-metal', 'Metal', { v: 0.45 }), pad('harmony-08/himno-redoble', 'Redoble', { v: 0.75 }), pad('harmony-08/himno-impacto', 'Impacto', { v: 0.7 }),
        pad('harmony-03/note-lead', 'Lead (notas)', { v: 0.8 }), pad('harmony-08/fc-bajo-d2', 'Bajo (notas)', { v: 0.6 }),
        pad('harmony-03/note-organ', 'Órgano (notas)', { v: 0.35 }), pad('harmony-02/choir-chop-ah', 'Chops «ah» (notas)', { v: 0.45 }),
        pad('harmony-08/himno-subida', 'Subida', { v: 0.7 }), pad('harmony-08/himno-plato-reves', 'Plato al revés', { v: 0.65 }),
        pad('harmony-02/mc-louder', 'Louder', { v: 0.85 }), pad('harmony-07/ud-scream', 'Grito', { v: 0.6 })
      ],
      patterns: [
        // intro: órgano a contratiempo y chops; el kick y el bajo entran en los dos últimos compases
        pat({ 3: `${NADA}|${NADA}|${OH}|${OH}` }, {
          0: notas('D2', calla, calla, on('C2', K4L), on('A1', K4L)),
          9: notas('D2', calla, calla, bajo('C2', 'C3'), bajo('A1', 'A2')),
          10: notas('C4', contra(UM.Dm), contra(UM.Bb), contra(UM.C), contra(UM.A)),
          11: notas('C#4', ...UM_CHOPS) }),
        // subida: el kick pasa a corcheas y acaba en un arpegio de La que sube al drop
        pat({ 2: `${CL}|${CL}|x...x...x...x...|x.x.x.x.x.x.x.x.`, 6: at(48), 12: at(32), 13: at(56), 14: at(0) }, {
          0: notas('D2', on('D2', K4L), on('A#1', K4L), on('C2', OCH), 'A1 A1 A1 A1 A1 A1 A1 A1 C#2 C#2 C#2 C#2 E2 E2 E2 E2'),
          9: notas('D2', bajo('D2', 'D3'), bajo('A#1', 'A#2'), calla, calla),
          10: notas('C4', contra(UM.Dm), contra(UM.Bb), on(UM.C, OCH), on(UM.A, OCH)) }),
        // drop: el kick por los acordes con una melodía de kicks en el cuarto compás, bajo, lead y el órgano suave
        pat({ 2: CL, 3: '..x...x...x...x.', 5: '......o.......o.', 7: at(0), 15: at(60) }, {
          0: notas('D2', on('D2', K4L), on('A#1', K4L), on('C2', K4L), 'E2 - E2 E2 A2 - E2 - C#2 - E2 - A2 - A2 -'),
          8: notas('C4', ...UM_LEAD),
          9: notas('D2', bajo('D2', 'D3'), bajo('A#1', 'A#2'), bajo('C2', 'C3'), bajo('A1', 'A2')),
          10: notas('C4', ...[UM.Dm, UM.Bb, UM.C, UM.A].map((c) => suave(contra(c)))) }),
        // break: acordes largos, el lead suave presentando la melodía y los chops; el kick vuelve en el último compás
        pat({ 13: at(56) }, {
          0: notas('D2', calla, calla, calla, 'a1 - - - a1 - - - a1 - - - A1 - A1 -'),
          8: notas('C4', ...UM_LEAD.map(suave)),
          10: notas('C4', entero(UM.Dm), entero(UM.Bb), entero(UM.C), entero(UM.A)),
          11: notas('C#4', ...UM_CHOPS) })
      ]
    },
    {
      id: 'frenchcore-melodico', name: 'Frenchcore melódico', school: 'Frenchcore', bpm: 200, swing: 0, tonality: 'Re menor', chain: 'ABCCDBCC',
      melodic: [1, 8, 9, 10, 11], scale: { root: 2, mode: 'armonica' },
      desc: 'Kick de frenchcore en los tiempos y todo lo demás desde el piano roll (Rem – Solm – Si♭ – La): un solo bajo que sigue los acordes, piano, arpegio de pluck, lead saturado y chops de voz.',
      pads: [
        pad('harmony-08/fc-kick', 'Kick frenchcore', { v: 0.8 }), pad('harmony-08/fc-bajo-d2', 'Bajo (notas)', { v: 0.65 }), pad('harmony-08/himno-palma', 'Palma', { v: 0.75 }),
        pad('harmony-08/himno-charles', 'Charles', { v: 0.4, ch: 1 }), pad('harmony-05/rt-hat-open', 'Charles abierto', { v: 0.45, ch: 1 }),
        pad('harmony-01/perc-metal', 'Metal', { v: 0.45 }), pad('harmony-08/himno-redoble', 'Redoble', { v: 0.75 }), pad('harmony-08/himno-impacto', 'Impacto', { v: 0.7 }),
        pad('harmony-03/note-piano', 'Piano (notas)', { v: 0.45 }), pad('harmony-03/note-pluck', 'Pluck (notas)', { v: 0.6 }),
        pad('harmony-03/note-lead', 'Lead (notas)', { v: 0.2, fx: { drive: 20, shape: 'soft' } }), pad('harmony-02/choir-chop-ey', 'Chops «ey» (notas)', { v: 0.45 }),
        pad('harmony-08/himno-subida', 'Subida', { v: 0.7 }), pad('harmony-08/himno-plato-reves', 'Plato al revés', { v: 0.65 }),
        pad('harmony-02/shout-hey', 'Hey', { v: 0.8 }), pad('harmony-07/ud-scream', 'Grito', { v: 0.55 })
      ],
      patterns: [
        // intro: piano en acordes; el kick y el arpegio entran en la segunda mitad
        pat({ 0: `${NADA}|${NADA}|${K4}|${K4}`, 3: `${NADA}|${NADA}|${OH}|${OH}` }, {
          8: notas('C4', entero(FM.Dm), entero(FM.Gm), entero(FM.Bb), entero(FM.A)),
          9: notas('C4', calla, calla, FM_ARP[2], FM_ARP[3]) }),
        // subida: el kick se acelera, el arpegio sigue y el bajo marca los dos primeros acordes
        pat({ 0: SUBIDA, 2: `${CL}|${CL}|${NADA}|${NADA}`, 6: at(48), 12: at(32), 13: at(56), 14: at(0) }, {
          1: notas('D2', bajo('D2', 'D3'), bajo('G1', 'G2'), calla, calla),
          9: notas('C4', ...FM_ARP) }),
        // drop: kick, bajo a contratiempo por los acordes, lead saturado y el arpegio por debajo
        pat({ 0: K4, 2: CL, 3: 'o.o.o.o.o.o.o.o.', 5: '......o.......o.', 7: at(0), 15: at(60) }, {
          1: notas('D2', bajo('D2', 'D3'), bajo('G1', 'G2'), bajo('A#1', 'A#2'), bajo('A1', 'A2')),
          9: notas('C4', ...FM_ARP),
          10: notas('C4', ...FM_LEAD) }),
        // break: piano con la melodía encima de los acordes y chops; el kick vuelve con el bajo al final
        pat({ 0: VUELVE }, {
          1: notas('D2', calla, calla, calla, '. . A1 - . . A1 - . . . . . . . .'),
          8: [...notas('C4', entero(FM.Dm), entero(FM.Gm), entero(FM.Bb), entero(FM.A)), ...notas('C4', ...FM_LEAD.map(suave))],
          11: notas('F#4', ...FM_CHOPS) })
      ]
    },
    {
      id: 'gabber-rave', name: 'Gabber de rave', school: 'Rotterdam / early', bpm: 175, swing: 0, tonality: 'Fa menor', chain: 'ABCCDBCC',
      melodic: [0, 9, 10], scale: { root: 5, mode: 'armonica' },
      desc: 'Gabber de los 90 con los sonidos duros del Harmony 09: kick 909 casi cuadrado, riff de hoover y hoover en acordes desde el piano roll, bajo que cae a contratiempo, sirena y screech.',
      pads: [
        pad('harmony-09/hd-kick-gabber-f', 'Kick gabber (notas)', { v: 0.9 }), pad('harmony-09/hd-kick-early', 'Kick early', { v: 0.8 }), pad('harmony-09/hd-palma', 'Palma', { v: 0.7 }),
        pad('harmony-09/hd-charles', 'Charles', { v: 0.5, ch: 1 }), pad('harmony-09/hd-charles-abierto', 'Charles abierto', { v: 0.5, ch: 1 }),
        pad('harmony-09/hd-caja', 'Caja', { v: 0.6 }), pad('harmony-09/hd-redoble', 'Redoble', { v: 0.7 }), pad('harmony-09/hd-impacto', 'Impacto', { v: 0.7 }),
        pad('harmony-09/hd-hoover-riff', 'Riff de hoover', { v: 0.8 }), pad('harmony-09/hd-hoover', 'Hoover (notas)', { v: 0.55 }), pad('harmony-09/hd-bajo', 'Bajo (notas)', { v: 0.75 }),
        pad('harmony-09/hd-screech-riff', 'Riff de screech', { v: 0.55 }), pad('harmony-09/hd-sirena', 'Sirena', { v: 0.55 }),
        pad('harmony-09/hd-subida', 'Subida', { v: 0.7 }), pad('harmony-09/hd-plato-reves', 'Plato al revés', { v: 0.6 }), pad('harmony-09/hd-grito', 'Grito', { v: 0.65 })
      ],
      patterns: [
        // intro: la sirena y el hoover en acordes; el kick early entra en la segunda mitad
        pat({ 1: `${NADA}|${NADA}|${K4}|${K4}`, 3: `${NADA}|${NADA}|${OH}|${OH}`, 12: at(0) }, {
          9: notas('C3', ...GR_HOOV.map(entero)) }),
        // subida: el kick gabber se acelera, el bajo marca los dos primeros acordes
        pat({ 2: `${CL}|${CL}|x...x...x...x...|x.x.x.x.x.x.x.x.`, 6: at(48), 13: at(32), 14: at(56) }, {
          0: GR_K.B,
          10: notas('F2', bajo('F2', 'F3'), bajo('C#2', 'C#3'), calla, calla) }),
        // drop: kick, bajo a contratiempo por los acordes, el riff de hoover y el grito al final
        pat({ 2: CL, 3: 'o.x.o.x.o.x.o.x.', 7: at(0), 8: at(0), 15: at(60) }, {
          0: GR_K.C,
          10: notas('F2', bajo('F2', 'F3'), bajo('C#2', 'C#3'), bajo('D#2', 'D#3'), bajo('C2', 'C3')) }),
        // break: el screech y el hoover en acordes; el kick vuelve en el último compás
        pat({ 11: at(0), 15: at(0) }, {
          0: GR_K.D,
          9: notas('C3', ...GR_HOOV.map((c) => suave(entero(c)))) })
      ]
    },
    {
      id: 'happy-hardcore', name: 'Happy hardcore', school: 'Happy hardcore', bpm: 175, swing: 0, tonality: 'La♭ mayor', chain: 'ABCCDBCC',
      melodic: [9, 10, 11], scale: { root: 8, mode: 'mayor' },
      desc: 'Piano de rave en acordes (La♭ – Mi♭ – Fam – Re♭) y la melodía encima desde el piano roll, bajo a contratiempo, chops de voz en el break y el kick early.',
      pads: [
        pad('harmony-09/hd-kick-early', 'Kick (Fa)', { v: 0.8 }), pad('harmony-09/hd-kick-mainstream-f', 'Kick 2 (Fa)', { v: 0.75 }), pad('harmony-09/hd-palma', 'Palma', { v: 0.7 }),
        pad('harmony-09/hd-charles', 'Charles', { v: 0.45, ch: 1 }), pad('harmony-09/hd-charles-abierto', 'Charles abierto', { v: 0.45, ch: 1 }),
        pad('harmony-09/hd-caja', 'Caja', { v: 0.55 }), pad('harmony-09/hd-redoble', 'Redoble', { v: 0.7 }), pad('harmony-09/hd-impacto', 'Impacto', { v: 0.65 }),
        pad('harmony-09/hd-piano-happy', 'Piano en acordes', { v: 0.7 }), pad('harmony-09/hd-piano', 'Piano (notas)', { v: 0.6 }), pad('harmony-09/hd-bajo', 'Bajo (notas)', { v: 0.55 }),
        pad('harmony-02/choir-chop-ah', 'Chops «ah» (notas)', { v: 0.45 }), pad('harmony-09/hd-subida', 'Subida', { v: 0.7 }), pad('harmony-09/hd-plato-reves', 'Plato al revés', { v: 0.6 }),
        pad('harmony-02/mc-make-some-noise', 'MC', { v: 0.8 }), pad('harmony-09/hd-laser', 'Láser', { v: 0.5 })
      ],
      patterns: [
        // intro: el piano en acordes y, en la segunda mitad, el kick
        pat({ 0: `${NADA}|${NADA}|${K4}|${K4}`, 8: at(0), 3: `${NADA}|${NADA}|${OH}|${OH}`, 14: at(48) }),
        // subida: el kick se acelera, el piano sigue y el bajo marca dos acordes
        pat({ 0: SUBIDA, 8: at(0), 2: `${CL}|${CL}|x...x...x...x...|x.x.x.x.x.x.x.x.`, 6: at(48), 12: at(32), 13: at(56) }, {
          10: notas('F2', bajo('G#2', 'G#3'), bajo('D#2', 'D#3'), calla, calla) }),
        // drop: kick, piano en acordes, la melodía encima, bajo a contratiempo
        pat({ 0: K4, 8: at(0), 2: CL, 3: 'o.x.o.x.o.x.o.x.', 7: at(0), 15: at(30) }, {
          9: notas('C4', ...HH_MEL),
          10: notas('F2', bajo('G#2', 'G#3'), bajo('D#2', 'D#3'), bajo('F2', 'F3'), bajo('C#2', 'C#3')) }),
        // break: la melodía suave y los chops; el kick vuelve en el último compás
        pat({ 0: VUELVE }, {
          9: notas('C4', ...HH_MEL.map(suave)),
          11: notas('C#4', ...HH_CHOPS) })
      ]
    },
    {
      id: 'hard-techno', name: 'Hard techno industrial', school: 'Hard techno', bpm: 150, swing: 0, tonality: 'Fa menor', chain: 'ABCCDBCC',
      melodic: [11], scale: { root: 5, mode: 'menor' },
      desc: 'Kick de hard techno con su rumble (la sala del kick, distorsionada y empujada por el kick), acid, charles a semicorcheas, ride, golpes metálicos y stabs oscuros desde el piano roll.',
      pads: [
        pad('harmony-09/ht-kick-f', 'Kick (Fa)', { v: 0.75 }), pad('harmony-09/ht-kick', 'Kick 2 (Sol)', { v: 0.8 }), pad('harmony-09/hd-palma-grande', 'Palma', { v: 0.6 }),
        pad('harmony-09/hd-charles', 'Charles', { v: 0.45, ch: 1 }), pad('harmony-09/hd-charles-abierto', 'Charles abierto', { v: 0.45, ch: 1 }),
        pad('harmony-09/ht-percusion', 'Golpe metálico', { v: 0.9 }), pad('harmony-09/hd-redoble', 'Redoble', { v: 0.6 }), pad('harmony-09/ht-ride', 'Ride', { v: 0.55 }),
        pad('harmony-09/ht-rumble-solo', 'Rumble', { v: 0.55 }), pad('harmony-09/ht-acid', 'Acid', { v: 0.85 }), pad('harmony-09/ht-charles', 'Charles en bucle', { v: 0.6 }),
        pad('harmony-09/ht-stab', 'Stab (notas)', { v: 0.9 }), pad('harmony-09/ht-subida', 'Subida', { v: 0.65 }), pad('harmony-09/hd-impacto', 'Impacto', { v: 0.65 }),
        pad('harmony-09/hd-grunido', 'Gruñido', { v: 0.6 }), pad('harmony-09/hd-laser', 'Láser', { v: 0.45 })
      ],
      patterns: [
        // intro: kick y charles en bucle; el rumble entra en la segunda mitad
        pat({ 0: K4, 10: at(0, 16, 32, 48), 8: at(32, 48), 5: '......o.......o.' }),
        // subida: rumble, acid y palmas que se aceleran; el kick se corta antes del drop
        pat({ 0: `${K4}|${K4}|${K4}|x.x.x.x.........`, 8: at(0, 16, 32), 9: at(0, 32), 10: at(0, 16, 32, 48), 2: `${CL}|${CL}|x...x...x...x...|x.x.x.x.x.x.x.x.`, 12: at(32), 6: at(48) }, {
          11: notas('F3', HT_STAB('F3'), HT_STAB('F3'), calla, calla) }),
        // drop: todo; stabs que bajan a Re♭m y Mi♭m
        pat({ 0: K4, 8: at(0, 16, 32, 48), 9: at(0, 32), 10: at(0, 16, 32, 48), 2: CL, 7: '..x...x...x...x.', 5: '......o.......o.', 13: at(0), 14: at(56) }, {
          11: notas('F3', HT_STAB('F3'), HT_STAB('F3'), HT_STAB('C#3'), HT_STAB('D#3')) }),
        // break: sin kick ni rumble, el acid y los stabs largos; el kick vuelve en el último compás
        pat({ 0: VUELVE, 9: at(0, 32), 15: at(16), 14: at(0) }, {
          11: notas('F3', suave(entero('F3')), suave(entero('C#3')), suave(entero('D#3')), suave(entero('F3'))) })
      ]
    }
  ];
})();
