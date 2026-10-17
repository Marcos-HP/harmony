/* HARMONY · biblioteca de samples originales (datos en js/data/samples.js, audio en samples/<pack>/)
   Lógica pura: lista, busca y filtra. Un pack nuevo solo necesita estar en el catálogo: nada más cambia. */
(function () {
  const H = (window.H = window.H || {});
  const U = H.U;

  const STYLES = { hardcore: 'Hardcore', newstyle: 'Newstyle', uptempo: 'Uptempo', general: 'General' };
  const TYPES = { kick: 'Kick', bajo: 'Bajo', palma: 'Palma', caja: 'Caja', charles: 'Charles', 'percusión': 'Percusión', plato: 'Plato', redoble: 'Redoble', impacto: 'Impacto', 'transición': 'Transición', subida: 'Subida', efecto: 'Efecto', sintetizador: 'Sintetizador', voz: 'Voz', grito: 'Grito', coro: 'Coro' };
  const NOTE_ES = { C: 'Do', 'C#': 'Do#', D: 'Re', 'D#': 'Re#', E: 'Mi', F: 'Fa', 'F#': 'Fa#', G: 'Sol', 'G#': 'Sol#', A: 'La', 'A#': 'La#', B: 'Si' };

  let all = null, byId = null;
  function load() {
    if (all) return;
    const packs = (H.data.samples && H.data.samples.packs) || [];
    all = [];
    packs.forEach((p) => p.samples.forEach((s) => all.push({ ...s, pack: p, _idx: U.norm([s.name, s.style, STYLES[s.style], s.type, s.cat, s.key, L.noteES(s.key), (s.tags || []).join(' '), p.name].filter(Boolean).join(' ')) })));
    byId = Object.fromEntries(all.map((s) => [s.id, s]));
  }

  const L = (H.Lib = {
    STYLES, TYPES,
    all() { load(); return all; },
    get(id) { load(); return byId[id] || null; },
    packs: () => (H.data.samples && H.data.samples.packs) || [],
    /* f: { q, style, type } — style/type 'all' o vacío = todos */
    filter(f = {}) {
      load();
      const q = U.norm((f.q || '').trim()), words = q ? q.split(/\s+/) : [];
      return all.filter((s) => (!f.style || f.style === 'all' || s.style === f.style) && (!f.type || f.type === 'all' || s.type === f.type) && words.every((w) => s._idx.includes(w)));
    },
    /* valores presentes, en el orden de las tablas, con cuántos hay de cada uno */
    facets(key, list) {
      load();
      const src = list || all, order = Object.keys(key === 'style' ? STYLES : TYPES), n = {};
      src.forEach((s) => (n[s[key]] = (n[s[key]] || 0) + 1));
      return order.filter((k) => n[k]).map((k) => ({ id: k, name: (key === 'style' ? STYLES : TYPES)[k], n: n[k] }));
    },
    noteES(k) { const m = /^([A-G]#?)(-?\d)$/.exec(k || ''); return m ? NOTE_ES[m[1]] + ' ' + m[2] : ''; },
    /* «Uptempo · kick · 0,34 s · Do# 2» */
    meta(s) {
      const bpm = s.bpm ? (s.bpm[0] === s.bpm[1] ? s.bpm[0] : s.bpm[0] + '–' + s.bpm[1]) + ' BPM' : '';
      return [STYLES[s.style], (TYPES[s.type] || s.type).toLowerCase(), s.duration.toFixed(2).replace('.', ',') + ' s', L.noteES(s.key), bpm].filter(Boolean).join(' · ');
    },
    /* el audio se sirve con la web, junto a index.html */
    url: (s) => s.file
  });
})();
