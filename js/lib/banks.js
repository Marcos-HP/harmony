/* HARMONY · bancos del Soundpad: el modelo de datos, sin DOM ni audio.
   Un banco es un juego de 16 pads, cada uno con su sonido, nombre, categoría (color), volumen, modo y tecla.
   El sonido de un pad (src) es una referencia, nunca el audio:
     { type: 'file', fileId, fileName }   archivo del usuario, guardado en este navegador (js/lib/padstore.js)
     { type: 'catalog', trackId }          muestra de 30 s de Deezer de un registro del catálogo (no se guarda)
   Todo lo que cambia el estado pasa por aquí, así el resto solo pinta y suena. */
(function () {
  const H = (window.H = window.H || {});

  const PADS = 16;
  // rejilla 4×4 con la mano izquierda, como en los samplers por teclado
  const KEYS = ['1', '2', '3', '4', 'q', 'w', 'e', 'r', 'a', 's', 'd', 'f', 'z', 'x', 'c', 'v'];
  // teclas que ya usa la aplicación o el navegador para moverse: no se pueden asignar
  const RESERVED = new Set([' ', 'escape', 'tab', 'enter', '/', '?', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'backspace', 'delete', 'home', 'end', 'pageup', 'pagedown']);
  const CATS = [
    { id: 'kick', name: 'Kick' }, { id: 'bajo', name: 'Bajo' }, { id: 'perc', name: 'Percusión' }, { id: 'voz', name: 'Voz' },
    { id: 'fx', name: 'FX' }, { id: 'loop', name: 'Loop' }, { id: 'tema', name: 'Tema' }, { id: 'otro', name: 'Otro' }
  ];
  const CAT_IDS = new Set(CATS.map((c) => c.id));
  const MODES = ['shot', 'loop'];

  const uid = () => 'b' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  const emptyPad = (i) => ({ id: 'p' + i, name: '', cat: 'otro', volume: 0.9, mode: 'shot', key: KEYS[i] || null, src: null });
  const newBank = (name) => ({ id: uid(), name: String(name || 'Banco').slice(0, 40), pads: Array.from({ length: PADS }, (_, i) => emptyPad(i)) });

  /* Normaliza una tecla de teclado: una sola tecla imprimible, en minúscula. null si no se puede asignar. */
  function keyOf(k) {
    if (k == null) return null;
    const s = String(k).toLowerCase();
    if (RESERVED.has(s)) return null;
    return [...s].length === 1 ? s : null;
  }

  function normSrc(s) {
    if (!s || typeof s !== 'object') return null;
    if (s.type === 'file' && s.fileId) return { type: 'file', fileId: String(s.fileId), fileName: String(s.fileName || 'archivo') };
    if (s.type === 'catalog' && s.trackId) return { type: 'catalog', trackId: String(s.trackId) };
    return null;
  }
  function normPad(p, i) {
    const d = emptyPad(i);
    if (!p || typeof p !== 'object') return d;
    return {
      id: d.id,
      name: typeof p.name === 'string' ? p.name.slice(0, 40) : '',
      cat: CAT_IDS.has(p.cat) ? p.cat : 'otro',
      volume: Number.isFinite(+p.volume) ? clamp(+p.volume, 0, 1) : d.volume,
      mode: MODES.includes(p.mode) ? p.mode : 'shot',
      key: p.key === null ? null : keyOf(p.key) || d.key,
      src: normSrc(p.src)
    };
  }
  function normBank(b) {
    if (!b || typeof b !== 'object') return null;
    const pads = Array.from({ length: PADS }, (_, i) => normPad(Array.isArray(b.pads) ? b.pads[i] : null, i));
    // una tecla, un pad: si el guardado traía repetidas, se queda con la primera
    const seen = new Set();
    pads.forEach((p) => { if (p.key && seen.has(p.key)) p.key = null; else if (p.key) seen.add(p.key); });
    return { id: typeof b.id === 'string' && b.id ? b.id : uid(), name: String(b.name || 'Banco').slice(0, 40), pads };
  }

  const B = (H.Banks = {
    PADS, KEYS, CATS, MODES,
    keyOf,
    defaultState() { const b = newBank('Banco A'); return { version: 1, current: b.id, master: 0.85, banks: [b] }; },
    /* Estado leído del almacenamiento: lo que no cuadre se corrige, nunca se rompe */
    normalize(s) {
      if (!s || typeof s !== 'object' || !Array.isArray(s.banks)) return B.defaultState();
      const banks = s.banks.map(normBank).filter(Boolean);
      const ids = new Set();
      banks.forEach((b) => { if (ids.has(b.id)) b.id = uid(); ids.add(b.id); });
      if (!banks.length) return B.defaultState();
      return { version: 1, current: banks.some((b) => b.id === s.current) ? s.current : banks[0].id, master: Number.isFinite(+s.master) ? clamp(+s.master, 0, 1) : 0.85, banks };
    },
    current: (s) => s.banks.find((b) => b.id === s.current) || s.banks[0],
    select(s, id) { if (s.banks.some((b) => b.id === id)) s.current = id; return B.current(s); },
    /* Nombre libre: «Banco B», «Banco C»… */
    freeName(s, base) {
      const names = new Set(s.banks.map((b) => b.name));
      if (base) { let n = base, i = 2; while (names.has(n)) n = base + ' ' + i++; return n; }
      for (let i = 0; i < 26; i++) { const n = 'Banco ' + String.fromCharCode(65 + i); if (!names.has(n)) return n; }
      return 'Banco ' + (s.banks.length + 1);
    },
    add(s, name) { const b = newBank(name || B.freeName(s)); s.banks.push(b); s.current = b.id; return b; },
    duplicate(s, id) {
      const src = s.banks.find((b) => b.id === id);
      if (!src) return null;
      const b = normBank(JSON.parse(JSON.stringify(src)));
      b.id = uid(); b.name = B.freeName(s, src.name + ' (copia)');
      s.banks.splice(s.banks.indexOf(src) + 1, 0, b); s.current = b.id;
      return b;
    },
    rename(s, id, name) { const b = s.banks.find((x) => x.id === id); const n = String(name || '').trim().slice(0, 40); if (b && n) b.name = n; return b; },
    /* Siempre queda al menos un banco */
    remove(s, id) {
      if (s.banks.length < 2) return false;
      const i = s.banks.findIndex((b) => b.id === id);
      if (i < 0) return false;
      s.banks.splice(i, 1);
      if (s.current === id) s.current = s.banks[Math.max(0, i - 1)].id;   // el de antes (el original, si era una copia)
      return true;
    },
    /* Asigna una tecla a un pad. Si otro pad del banco la tenía, la pierde (se devuelve cuál, para avisar). */
    setKey(bank, i, key) {
      const k = key === null ? null : keyOf(key);
      if (key !== null && !k) return { ok: false };
      let from = null;
      if (k) bank.pads.forEach((p, j) => { if (j !== i && p.key === k) { p.key = null; from = j; } });
      bank.pads[i].key = k;
      return { ok: true, from };
    },
    padByKey: (bank, key) => { const k = keyOf(key); return k ? bank.pads.findIndex((p) => p.key === k) : -1; },
    clearPad(bank, i) { const keep = bank.pads[i].key; bank.pads[i] = emptyPad(i); bank.pads[i].key = keep; return bank.pads[i]; },
    /* Archivos que sigue usando algún pad de algún banco (lo demás se puede borrar del navegador) */
    fileIds(s) { const ids = new Set(); s.banks.forEach((b) => b.pads.forEach((p) => { if (p.src && p.src.type === 'file') ids.add(p.src.fileId); })); return ids; },
    srcKey: (src) => (!src ? null : src.type === 'file' ? 'file:' + src.fileId : 'dz:' + src.trackId)
  });
})();
