/* HARMONY · presets de banco por escuela
   Cada preset es un banco entero: 16 pads con sonidos de Harmony, tempo y cuatro patrones de 16 tiempos que se tocan
   encadenados (A intro · B subida · C drop · D break). Se cargan siempre en un banco nuevo (js/lib/banks.js, fromPreset):
   nunca pisan lo que ya hay.
   Mismo reparto en todos, para que la mano (y la DDJ-FLX4) se acostumbre:
     pads 1–8  (deck 1)  kick · kick 2 · palma o caja · charles cerrado · charles abierto · percusión · redoble · plato
     pads 9–16 (deck 2)  melodía en bucle · segundo bucle o stab · stab · pad o coro · subida · efecto · MC · grito
   Los bucles van en modo disparo y se lanzan al empezar el compás que toca: duran compases exactos al tempo del preset.
   Escrito en pasos de semicorchea: x golpe · o golpe suave · . nada · | separa compases (si hay menos de cuatro, se repiten). */
(function () {
  const H = (window.H = window.H || {});
  H.data = H.data || {};

  const r = (txt) => {
    const s = String(txt).replace(/[\s|]/g, '').replace(/x/g, '1').replace(/o/g, '2').replace(/\./g, '0');
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
  const pat = (rows) => ({ len: 64, rows: Object.fromEntries(Object.entries(rows).map(([i, t]) => [i, r(t)])) });
  const pad = (sampleId, name, o = {}) => ({ sampleId, name, volume: o.v != null ? o.v : 0.9, choke: o.ch || 0, pitch: o.p || 0 });

  H.data.presets = [
    {
      id: 'rotterdam', name: 'Rotterdam', school: 'Rotterdam / early', bpm: 175, swing: 0, tonality: 'Re menor', chain: 'ABCCDBCC',
      desc: 'Gabber de los 90: kick 909 saturado hasta que zumba, hoovers, sirenas y palma 909.',
      pads: [
        pad('harmony-05/rt-kick-fuzz', 'Kick gabber'), pad('harmony-05/rt-kick-thump', 'Kick early'), pad('harmony-05/rt-clap-909', 'Palma 909', { v: 0.8 }),
        pad('harmony-01/hat-closed', 'Charles cerrado', { v: 0.6, ch: 1 }), pad('harmony-05/rt-hat-open', 'Charles abierto', { v: 0.6, ch: 1 }),
        pad('harmony-01/perc-metal', 'Metal', { v: 0.6 }), pad('harmony-01/fill-snare-180', 'Redoble', { v: 0.75 }), pad('harmony-01/crash', 'Plato', { v: 0.6 }),
        pad('harmony-05/rt-riff', 'Riff hoover', { v: 0.8 }), pad('harmony-05/rt-stab-rave', 'Stab Re m7', { v: 0.8 }), pad('harmony-05/rt-hoover-alarm', 'Hoover de alarma', { v: 0.75 }),
        pad('harmony-01/hoover-stab', 'Hoover stab (Re)', { v: 0.75, p: 2 }), pad('harmony-05/rt-siren-up', 'Sirena', { v: 0.7 }), pad('harmony-01/riser-noise', 'Subida', { v: 0.7 }),
        pad('harmony-02/mc-rotterdam', 'MC Rotterdam', { v: 0.85 }), pad('harmony-02/shout-hey', 'Hey', { v: 0.8 })
      ],
      patterns: [
        pat({ 0: K4, 4: `${NADA}|${NADA}|${OH}|${OH}`, 7: at(0), 11: at(0, 32), 14: at(48) }),
        pat({ 0: SUBIDA, 2: `${CL}|${CL}|x...x...x...x...|x.x.x.x.x.x.x.x.`, 6: at(48), 12: at(0, 16), 13: at(32) }),
        pat({ 0: K4, 2: CL, 3: 'o...o...o...o...', 4: OH, 5: '......o.......o.', 7: at(0), 8: at(0, 32), 15: at(56) }),
        pat({ 1: VUELVE, 9: 'x.....x.....x...', 10: at(0, 32), 12: at(48), 14: at(16) })
      ]
    },
    {
      id: 'italiano', name: 'Hardcore italiano', school: 'Hardcore italiano', bpm: 172, swing: 0, tonality: 'Fa# menor', chain: 'ABCCDBCC',
      desc: 'Kick con cola larga afinada, leads épicos con supersierras, coros y cuerdas oscuras.',
      pads: [
        pad('harmony-05/it-kick-tail', 'Kick italiano'), pad('harmony-05/it-kick-high', 'Kick agudo (La)'), pad('harmony-01/clap-hardcore', 'Palma', { v: 0.8 }),
        pad('harmony-01/hat-closed', 'Charles cerrado', { v: 0.6, ch: 1 }), pad('harmony-01/hat-open', 'Charles abierto', { v: 0.6, ch: 1 }),
        pad('harmony-01/snare-hardcore', 'Caja', { v: 0.7 }), pad('harmony-05/it-roll', 'Redoble', { v: 0.75 }), pad('harmony-01/crash', 'Plato', { v: 0.6 }),
        pad('harmony-05/it-lead', 'Lead épico', { v: 0.8 }), pad('harmony-05/it-strings', 'Cuerdas', { v: 0.75 }), pad('harmony-05/it-choir-stab', 'Golpe de coro', { v: 0.8 }),
        pad('harmony-02/choir-ooh', 'Coro «ooh»', { v: 0.75 }), pad('harmony-05/it-reverse', 'Kick al revés', { v: 0.8 }), pad('harmony-01/riser-noise', 'Subida', { v: 0.7 }),
        pad('harmony-02/mc-hardcore', 'MC Hardcore', { v: 0.85 }), pad('harmony-02/shout-oi', 'Oi', { v: 0.8 })
      ],
      patterns: [
        pat({ 0: K4, 4: OH, 7: at(0), 10: at(0, 32), 14: at(48) }),
        pat({ 0: SUBIDA, 2: `${CL}|${CL}|${CL}|${NADA}`, 6: at(48), 9: at(0), 12: at(39), 13: at(30) }),
        pat({ 0: K4, 2: CL, 3: 'o...o...o...o...', 4: OH, 5: '...............o', 7: at(0), 8: at(0), 15: at(56) }),
        pat({ 0: VUELVE, 8: at(0), 9: at(0), 11: at(32), 14: at(48) })
      ]
    },
    {
      id: 'mainstream-oscuro', name: 'Mainstream oscuro', school: 'Mainstream oscuro', bpm: 178, swing: 0, tonality: 'Mi frigio', chain: 'ABCCDBCC',
      desc: 'Kick largo con chillido y rumble, campanas de terror, drones y golpes industriales.',
      pads: [
        pad('harmony-05/mo-kick-screech', 'Kick con chillido'), pad('harmony-05/mo-kick-rumble', 'Kick rumble'), pad('harmony-01/clap-room', 'Palma con sala', { v: 0.8 }),
        pad('harmony-01/hat-closed', 'Charles cerrado', { v: 0.55, ch: 1 }), pad('harmony-01/hat-open', 'Charles abierto', { v: 0.55, ch: 1 }),
        pad('harmony-05/mo-perc', 'Golpe industrial', { v: 0.7 }), pad('harmony-01/fill-toms-180', 'Redoble de toms', { v: 0.75 }), pad('harmony-05/mo-impact', 'Impacto', { v: 0.7 }),
        pad('harmony-05/mo-lead', 'Riff oscuro', { v: 0.8 }), pad('harmony-05/mo-drone', 'Drone', { v: 0.7 }), pad('harmony-05/mo-bell', 'Campana', { v: 0.75 }),
        pad('harmony-05/mo-screech', 'Chillido', { v: 0.7 }), pad('harmony-01/riser-noise', 'Subida', { v: 0.7 }), pad('harmony-02/fx-demon', 'Voz demonio', { v: 0.85 }),
        pad('harmony-02/fx-warning', 'Aviso', { v: 0.85 }), pad('harmony-02/shout-ho', 'Ho', { v: 0.8 })
      ],
      patterns: [
        pat({ 1: K4, 5: '..........o.....', 9: at(0), 10: at(0, 32), 13: at(48) }),
        pat({ 0: SUBIDA, 2: `${CL}|${CL}|${NADA}|${NADA}`, 6: at(48), 11: at(0, 32), 12: at(32) }),
        pat({ 0: K4, 2: CL, 4: OH, 5: '.......o.......o', 7: at(0), 8: at(0, 32), 15: at(56) }),
        pat({ 1: VUELVE, 9: at(0), 10: at(0, 16, 32), 11: at(48), 14: at(32) })
      ]
    },
    {
      id: 'mainstream-melodico', name: 'Mainstream melódico', school: 'Mainstream melódico', bpm: 174, swing: 0, tonality: 'La menor', chain: 'ABCCDBCC',
      desc: 'Kick con cola tonal que sigue los acordes, lead eufórico, piano, arpegios y coro en el break.',
      pads: [
        pad('harmony-05/mm-kick-tonal', 'Kick La'), pad('harmony-05/mm-kick-tonal-c', 'Kick Do'), pad('harmony-01/clap-room', 'Palma', { v: 0.8 }),
        pad('harmony-01/hat-closed', 'Charles cerrado', { v: 0.55, ch: 1 }), pad('harmony-01/hat-open', 'Charles abierto', { v: 0.55, ch: 1 }),
        pad('harmony-01/snare-clap', 'Caja palma', { v: 0.7 }), pad('harmony-01/fill-snare-180', 'Redoble', { v: 0.75 }), pad('harmony-01/crash', 'Plato', { v: 0.6 }),
        pad('harmony-05/mm-lead', 'Lead eufórico', { v: 0.8 }), pad('harmony-05/mm-piano', 'Piano', { v: 0.8 }), pad('harmony-05/mm-arp', 'Arpegio', { v: 0.7 }),
        pad('harmony-05/mm-choir', 'Coro', { v: 0.75 }), pad('harmony-01/riser-supersaw', 'Subida', { v: 0.7 }), pad('harmony-01/reverse-crash', 'Plato al revés', { v: 0.65 }),
        pad('harmony-02/mc-make-some-noise', 'Make some noise', { v: 0.85 }), pad('harmony-02/shout-yeah', 'Yeah', { v: 0.8 })
      ],
      patterns: [
        pat({ 0: K4, 3: OH, 7: at(0), 10: at(0), 14: at(48) }),
        pat({ 0: SUBIDA, 2: `${CL}|${CL}|${NADA}|${NADA}`, 6: at(48), 9: at(0), 12: at(27), 13: at(38) }),
        // el kick sigue los acordes (La m – Fa – Do – Sol): La, La, Do, La
        pat({ 0: `${K4}|${K4}|${NADA}|${K4}`, 1: `${NADA}|${NADA}|${K4}|${NADA}`, 2: CL, 4: OH, 7: at(0), 8: at(0), 10: at(0), 15: at(56) }),
        pat({ 0: VUELVE, 9: at(0), 11: at(0), 14: at(48) })
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
    }
  ];
})();
