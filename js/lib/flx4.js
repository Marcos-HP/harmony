/* HARMONY · Pioneer DDJ-FLX4: qué significa cada mensaje MIDI de la tabla (sin DOM ni audio)
   La FLX4 es «class compliant»: el navegador la ve con Web MIDI sin drivers. Canales y números según la lista de
   mensajes MIDI de Pioneer (los mismos que usa el mapeo libre de Mixxx):
     canal 1 (0x_0) deck 1 · canal 2 (0x_1) deck 2 · canal 7 (0x_6) mezclador y navegador
     pads: 0x97 deck 1 · 0x98 deck 1 con SHIFT · 0x99 deck 2 · 0x9A deck 2 con SHIFT; la nota = modo + n.º de pad
     faders y potes en 14 bits: el byte alto en el número de control y el bajo en ese número + 0x20
     jogs relativos, con el centro en 64
   decode(bytes, st) → lista de acciones; st guarda los bytes altos de 14 bits y el estado de SHIFT. */
(function () {
  const H = (window.H = window.H || {});

  const MATCH = /DDJ-?FLX4/i;
  /* modos de pad: la nota base de cada modo (los pads mandan base + 0…7) y el botón que lo elige */
  const PAD_MODES = {
    0x00: 'Hot cue', 0x10: 'Pad FX 1', 0x20: 'Beat jump', 0x30: 'Sampler',
    0x40: 'Keyboard', 0x50: 'Pad FX 2', 0x60: 'Beat loop', 0x70: 'Key shift'
  };
  const MODE_BUTTONS = { 0x1B: 0x00, 0x1E: 0x10, 0x20: 0x20, 0x22: 0x30, 0x69: 0x40, 0x6B: 0x50, 0x6D: 0x60, 0x6F: 0x70 };
  /* controles de 14 bits de cada deck (byte alto) */
  const DECK_CC = { 0x00: 'tempo', 0x04: 'trim', 0x07: 'eq-high', 0x0B: 'eq-mid', 0x0F: 'eq-low', 0x13: 'fader' };
  const MIX_CC = { 0x1F: 'xf', 0x17: 'filter-A', 0x18: 'filter-B', 0x0C: 'headmix' };
  const DECK_NOTES = {
    0x0B: 'play', 0x0E: 'play-shift', 0x0C: 'cue', 0x48: 'cue-shift', 0x3F: 'shift', 0x36: 'jog-touch', 0x67: 'jog-touch',
    0x58: 'sync', 0x5C: 'sync-long', 0x60: 'sync-shift', 0x54: 'headcue', 0x68: 'headcue-shift',
    0x10: 'loop-in', 0x11: 'loop-out', 0x4D: 'reloop', 0x50: 'reloop-shift', 0x51: 'call-left', 0x53: 'call-right'
  };
  const MIX_NOTES = { 0x41: 'browse-press', 0x42: 'browse-press-shift', 0x46: 'load-A', 0x47: 'load-B' };

  const v14 = (msb, lsb) => (msb << 7) | lsb;
  const uni = (v) => v / 16383;                       // 0…1
  const bi = (v) => Math.max(-1, Math.min(1, (v - 8192) / 8191));   // −1…1, centro en 0

  const F = (H.FLX4 = {
    MATCH, PAD_MODES,
    is: (name) => MATCH.test(name || ''),
    state: () => ({ hi: {}, shift: { A: false, B: false }, mode: { A: 0x30, B: 0x30 } }),
    /* bytes: [estado, dato1, dato2]. Devuelve acciones como { t: 'play', ch: 'A' } */
    decode(bytes, st) {
      const [s, d1, d2 = 0] = bytes, kind = s & 0xF0, chn = s & 0x0F;
      const on = kind === 0x90 && d2 > 0, off = kind === 0x80 || (kind === 0x90 && d2 === 0);
      const deck = chn === 0 ? 'A' : chn === 1 ? 'B' : null;
      // pads
      if ((kind === 0x90 || kind === 0x80) && chn >= 7 && chn <= 10) {
        const ch = chn <= 8 ? 'A' : 'B', shift = chn === 8 || chn === 10, mode = d1 & 0x70;
        st.mode[ch] = mode;
        return [{ t: 'pad', ch, i: d1 & 0x07, shift, on, mode }];
      }
      // botones de los decks
      if ((kind === 0x90 || kind === 0x80) && deck) {
        if (MODE_BUTTONS[d1] != null && !DECK_NOTES[d1]) { if (on) st.mode[deck] = MODE_BUTTONS[d1]; return on ? [{ t: 'pad-mode', ch: deck, mode: MODE_BUTTONS[d1] }] : []; }
        const n = DECK_NOTES[d1];
        if (!n) return [{ t: 'other', on }];
        if (n === 'shift') { st.shift[deck] = on; return [{ t: 'shift', ch: deck, on }]; }
        if (n === 'jog-touch') return [{ t: 'jog-touch', ch: deck, on }];
        return on ? [{ t: n, ch: deck }] : off ? [{ t: n + ':up', ch: deck }] : [];
      }
      // botones del mezclador y del navegador
      if ((kind === 0x90 || kind === 0x80) && chn === 6) {
        const n = MIX_NOTES[d1];
        if (!n) return [{ t: 'other', on }];
        if (!on) return [];
        if (n.startsWith('load-')) return [{ t: 'load', ch: n.slice(5) }];
        return [{ t: n }];
      }
      // controles continuos
      if (kind === 0xB0) {
        if (deck) {
          // jogs: relativos, centro en 64
          if (d1 === 0x21 || d1 === 0x22 || d1 === 0x23 || d1 === 0x29) {
            const d = d2 - 64;
            return [{ t: 'jog', ch: deck, d, how: d1 === 0x22 ? 'scratch' : d1 === 0x29 ? 'search' : 'bend' }];
          }
          return cc14(st, deck, d1, d2, DECK_CC, (name, v) => {
            if (name === 'tempo') return { t: 'tempo', ch: deck, v: bi(v) };   // −1 arriba · +1 abajo (según la tabla)
            if (name === 'fader') return { t: 'fader', ch: deck, v: uni(v) };
            if (name === 'trim') return { t: 'trim', ch: deck, v: bi(v) };
            return { t: 'eq', ch: deck, band: name.slice(3), v: bi(v) };
          });
        }
        if (chn === 6) {
          if (d1 === 0x40 || d1 === 0x64) return [{ t: d1 === 0x40 ? 'browse' : 'browse-shift', d: d2 > 64 ? d2 - 128 : d2 }];
          return cc14(st, 'M', d1, d2, MIX_CC, (name, v) => {
            if (name === 'xf') return { t: 'xf', v: bi(v) };
            if (name === 'headmix') return { t: 'headmix', v: bi(v) };
            return { t: 'filter', ch: name.slice(7), v: bi(v) };
          });
        }
      }
      return [{ t: 'other' }];
    },
    describe(a) {
      const ch = a.ch ? ' ' + a.ch : '';
      switch (a.t) {
        case 'pad': return `Pad ${a.i + 1}${ch}${a.shift ? ' + SHIFT' : ''} (${PAD_MODES[a.mode] || 'modo ?'}) ${a.on ? 'pulsado' : 'suelto'}`;
        case 'pad-mode': return `Modo de pads${ch}: ${PAD_MODES[a.mode]}`;
        case 'jog': return `Jog${ch} ${a.how === 'scratch' ? '(plato tocado)' : a.how === 'search' ? '(con SHIFT)' : '(borde)'} ${a.d > 0 ? '+' : ''}${a.d}`;
        case 'tempo': return `Tempo${ch} ${a.v.toFixed(3)}`;
        case 'fader': return `Fader${ch} ${Math.round(a.v * 100)} %`;
        case 'eq': return `EQ ${a.band === 'high' ? 'agudos' : a.band === 'mid' ? 'medios' : 'graves'}${ch} ${a.v.toFixed(2)}`;
        case 'filter': return `Filtro (CFX)${ch} ${a.v.toFixed(2)}`;
        case 'xf': return `Crossfader ${a.v.toFixed(2)}`;
        case 'browse': case 'browse-shift': return `Rueda del navegador ${a.d > 0 ? '+' : ''}${a.d}${a.t === 'browse-shift' ? ' (SHIFT)' : ''}`;
        case 'load': return `LOAD${ch}`;
        case 'other': return 'Sin función en Harmony';
        default: return a.t.replace(':up', ' (suelto)').toUpperCase() + ch + (a.on != null ? (a.on ? ' pulsado' : ' suelto') : '');
      }
    },
    /* luces: [estado, nota, valor] para encender o apagar */
    led: {
      play: (ch, on) => [ch === 'A' ? 0x90 : 0x91, 0x0B, on ? 0x7F : 0],
      cue: (ch, on) => [ch === 'A' ? 0x90 : 0x91, 0x0C, on ? 0x7F : 0],
      sync: (ch, on) => [ch === 'A' ? 0x90 : 0x91, 0x58, on ? 0x7F : 0],
      pad: (ch, mode, i, on, shift = false) => [(ch === 'A' ? 0x97 : 0x99) + (shift ? 1 : 0), mode + i, on ? 0x7F : 0],
      vu: (ch, level) => [ch === 'A' ? 0xB0 : 0xB1, 0x02, Math.max(0, Math.min(127, Math.round(level * 127)))]
    },
    /* el mensaje con el que la tabla sabe que hay un programa al otro lado (SysEx; Mixxx lo manda cada 200 ms) */
    KEEPALIVE: [0xF0, 0x00, 0x40, 0x05, 0x00, 0x00, 0x04, 0x05, 0x00, 0x50, 0x02, 0xF7]
  });

  /* 14 bits: el byte alto llega primero (y ya da el valor aproximado) y el bajo lo afina */
  function cc14(st, who, d1, d2, table, make) {
    if (table[d1]) { st.hi[who + d1] = d2; return [make(table[d1], v14(d2, 0))]; }
    if (d1 >= 0x20 && table[d1 - 0x20]) { const hi = st.hi[who + (d1 - 0x20)]; return hi == null ? [] : [make(table[d1 - 0x20], v14(hi, d2))]; }
    return [{ t: 'other' }];
  }
})();
