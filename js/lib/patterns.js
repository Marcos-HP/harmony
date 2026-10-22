/* HARMONY · secuenciador del Soundpad: el modelo de patrones, sin DOM ni audio.
   Cada banco lleva su secuencia (bank.seq):
     bpm 60–260 · swing 0–100 (retrasa las semicorcheas pares hasta medio paso, como el swing de una MPC al 75 %)
     patterns  cuatro patrones (A–D) de 4, 8 o 16 tiempos: 16, 32 o 64 pasos de semicorchea (uno, dos o cuatro compases)
       rows  { [n.º de pad]: '1000100010001000…' } — 64 caracteres siempre: 0 nada · 1 golpe · 2 golpe suave
             (al acortar, lo de más se guarda; al volver a alargar, se recupera)
       lens  { [n.º de pad]: { [paso]: pasos } } — duración de las notas que la tienen (1–64 pasos). Sin duración, la
             nota suena entera (el sonido completo, hasta el golpe siguiente del pad). Con duración, se corta ahí; en
             un pad en modo bucle, el bucle se repite hasta el final de la nota.
     pattern  el patrón que se edita (y el que suena: un cambio entra al acabar la vuelta)
     chain · chainOn  la cadena de patrones («AABA»), si se toca encadenado
       mel   { [n.º de pad]: [[paso, pasos, semitonos, fuerza], …] } — las notas del piano roll de los pads en modo
             notas: cada una con su altura (semitonos sobre el tono del pad), su duración y su fuerza (1 golpe · 2 suave)
     melodic  los pads que van en modo notas (piano roll) en vez de golpes; sus golpes se guardan, pero no suenan
     scale  { root 0–11, mode } la escala que se sombrea en el piano roll (solo es ayuda visual)
     mute · solo  pads silenciados o en solo (para todo el banco, no por patrón)
   Los pasos se refieren a los pads por su número: cambiar el sonido de un pad conserva su ritmo. */
(function () {
  const H = (window.H = window.H || {});

  const N = 4, MAX = 64, LENS = [16, 32, 64], NAMES = 'ABCD', PADS = 16, BAR = 16;
  const BPM_MIN = 60, BPM_MAX = 260;
  const VEL = [0, 1, 0.45];   // nada · golpe · golpe suave
  const ZERO = '0'.repeat(MAX);
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const num = (v, d) => (v !== null && v !== '' && Number.isFinite(+v) ? +v : d);

  const emptyPattern = () => ({ len: 64, rows: {}, lens: {}, mel: {} });   // 16 tiempos (4 compases) de entrada
  const SEMI = 36, MAXNOTES = 512;
  /* escalas para sombrear el piano roll: semitonos desde la tónica */
  const SCALES = {
    menor: { name: 'Menor', steps: [0, 2, 3, 5, 7, 8, 10] },
    armonica: { name: 'Menor armónica', steps: [0, 2, 3, 5, 7, 8, 11] },
    frigio: { name: 'Frigio', steps: [0, 1, 3, 5, 7, 8, 10] },
    mayor: { name: 'Mayor', steps: [0, 2, 4, 5, 7, 9, 11] },
    cromatica: { name: 'Cromática', steps: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] }
  };
  /* notas de una fila del piano roll: enteras, dentro de los límites, ordenadas y sin dos iguales en el mismo sitio */
  function normMel(list) {
    const out = [], seen = new Set();
    for (const n of Array.isArray(list) ? list : []) {
      if (!Array.isArray(n)) continue;
      const s = Math.round(+n[0]), l = Math.round(+n[1]), t = Math.round(+n[2]), v = +n[3] === 2 ? 2 : 1;
      if (!Number.isFinite(s) || !Number.isFinite(l) || !Number.isFinite(t) || s < 0 || s >= MAX || l < 1 || Math.abs(t) > SEMI) continue;
      const k = s + ':' + t; if (seen.has(k)) continue; seen.add(k);
      out.push([s, Math.min(l, MAX - s), t, v]);
      if (out.length >= MAXNOTES) break;
    }
    return out.sort((a, b) => a[0] - b[0] || a[2] - b[2]);
  }
  function normRow(s) {
    const r = String(s || '').replace(/[^012]/g, '0').slice(0, MAX);
    return r + ZERO.slice(r.length);
  }
  function normPattern(p) {
    const out = emptyPattern();
    if (!p || typeof p !== 'object') return out;
    out.len = LENS.includes(+p.len) ? +p.len : 16;
    if (p.rows && typeof p.rows === 'object') {
      for (const [k, v] of Object.entries(p.rows)) {
        const i = +k;
        if (!Number.isInteger(i) || i < 0 || i >= PADS) continue;
        const r = normRow(v);
        if (r !== ZERO) out.rows[i] = r;
      }
    }
    // duraciones: solo donde hay una nota, de 1 a lo que quede hasta el final
    if (p.lens && typeof p.lens === 'object') {
      for (const [k, m] of Object.entries(p.lens)) {
        const r = out.rows[k];
        if (!r || !m || typeof m !== 'object') continue;
        for (const [st, n] of Object.entries(m)) {
          const s = +st, v = Math.round(+n);
          if (Number.isInteger(s) && s >= 0 && s < MAX && r[s] !== '0' && v >= 1) (out.lens[k] = out.lens[k] || {})[s] = Math.min(v, MAX - s);
        }
      }
    }
    if (p.mel && typeof p.mel === 'object') {
      for (const [k, list] of Object.entries(p.mel)) {
        const i = +k; if (!Number.isInteger(i) || i < 0 || i >= PADS) continue;
        const m = normMel(list); if (m.length) out.mel[i] = m;
      }
    }
    return out;
  }
  const lensOf = (pat, i) => pat.lens[i] || {};
  function setLenRaw(pat, i, s, n) {
    if (n > 0) (pat.lens[i] = pat.lens[i] || {})[s] = n;
    else if (pat.lens[i]) { delete pat.lens[i][s]; if (!Object.keys(pat.lens[i]).length) delete pat.lens[i]; }
  }
  /* quita las duraciones que se han quedado sin nota debajo */
  function pruneLens(pat, i) {
    const r = pat.rows[i], m = pat.lens[i]; if (!m) return;
    for (const s of Object.keys(m)) {
      if (!r || r[s] === '0') { delete m[s]; continue; }
      for (let t = +s + 1; t < +s + m[s] && t < MAX; t++) if (r[t] !== '0') { m[s] = t - +s; break; }   // hasta la nota siguiente
    }
    if (!Object.keys(m).length) delete pat.lens[i];
  }
  const idxList = (a) => [...new Set((Array.isArray(a) ? a : []).map(Number).filter((i) => Number.isInteger(i) && i >= 0 && i < PADS))].sort((x, y) => x - y);

  /* rellenos rápidos de una fila (sobre el patrón entero: en patrones de varios compases se repiten en cada uno) */
  const FILLS = {
    negras: { name: 'Cada negra (1, 2, 3, 4)', at: (s) => s % 4 === 0 },
    contra: { name: 'A contratiempo', at: (s) => s % 4 === 2 },
    dosycuatro: { name: 'En el 2 y el 4', at: (s) => s % 8 === 4 },
    corcheas: { name: 'Corcheas', at: (s) => s % 2 === 0 },
    semis: { name: 'Semicorcheas', at: () => true },
    galope: { name: 'Galope (1 · 3 · 4 de cada tiempo)', at: (s) => s % 4 !== 1 },
    subida: { name: 'Subida: negras → corcheas → semicorcheas', at: (s, len) => (s < len / 2 ? s % 4 === 0 : s < (len * 3) / 4 ? s % 2 === 0 : true) },
    tresillo: { name: 'Tresillo (3 · 3 · 2)', at: (s) => [0, 3, 6].includes(s % 8) },
    redoble: { name: 'Añadir redoble al final', add: true, at: (s, len) => s >= len - 4 || (s >= len - 8 && s % 2 === 0) }
  };

  const P = (H.Patterns = {
    N, MAX, LENS, BAR, NAMES, VEL, BPM_MIN, BPM_MAX, FILLS,
    beats: (len) => len / 4,
    SCALES, SEMI,
    create: () => ({ bpm: 170, swing: 0, pattern: 0, chain: [], chainOn: false, patterns: Array.from({ length: N }, emptyPattern), mute: [], solo: [], melodic: [], scale: { root: 2, mode: 'menor' } }),
    /* Lo guardado (o importado): lo que no cuadre se corrige, nunca se rompe */
    normalize(s) {
      const d = P.create();
      if (!s || typeof s !== 'object') return d;
      return {
        bpm: clamp(Math.round(num(s.bpm, d.bpm)), BPM_MIN, BPM_MAX),
        swing: clamp(Math.round(num(s.swing, 0)), 0, 100),
        pattern: clamp(Math.round(num(s.pattern, 0)), 0, N - 1),
        chain: (Array.isArray(s.chain) ? s.chain : []).map(Number).filter((i) => Number.isInteger(i) && i >= 0 && i < N).slice(0, 16),
        chainOn: s.chainOn === true,
        patterns: Array.from({ length: N }, (_, i) => normPattern(Array.isArray(s.patterns) ? s.patterns[i] : null)),
        mute: idxList(s.mute),
        solo: idxList(s.solo),
        melodic: idxList(s.melodic),
        scale: { root: s.scale && Number.isInteger(+s.scale.root) ? clamp(+s.scale.root, 0, 11) : 2, mode: s.scale && SCALES[s.scale.mode] ? s.scale.mode : 'menor' }
      };
    },
    /* ---------- piano roll ---------- */
    isMel: (seq, i) => seq.melodic.includes(i),
    setMel(seq, i, on) { const k = seq.melodic.indexOf(i); if (on && k < 0) { seq.melodic.push(i); seq.melodic.sort((a, b) => a - b); } else if (!on && k >= 0) seq.melodic.splice(k, 1); },
    mel: (seq, p, i) => seq.patterns[p].mel[i] || [],
    /* pone una nota (la que hubiera en el mismo paso y la misma altura se sustituye) y devuelve su índice */
    addMel(seq, p, i, s, l, t, v = 1) {
      const pat = seq.patterns[p], list = (pat.mel[i] || []).filter((n) => !(n[0] === s && n[2] === t));
      list.push([s, l, t, v]);
      pat.mel[i] = normMel(list);
      return pat.mel[i].findIndex((n) => n[0] === Math.round(s) && n[2] === Math.round(t));
    },
    /* quita la nota que hay en ese paso y esa altura (o la que suena encima de ese paso, si `covering`) */
    delMel(seq, p, i, s, t, covering = false) {
      const pat = seq.patterns[p], list = pat.mel[i] || [];
      const k = list.findIndex((n) => n[2] === t && (covering ? s >= n[0] && s < n[0] + n[1] : n[0] === s));
      if (k < 0) return false;
      list.splice(k, 1);
      if (!list.length) delete pat.mel[i];
      return true;
    },
    /* la nota que suena en ese paso y esa altura (o null) */
    melAt(seq, p, i, s, t) { return P.mel(seq, p, i).find((n) => n[2] === t && s >= n[0] && s < n[0] + n[1]) || null; },
    clearMel(seq, p, i) { delete seq.patterns[p].mel[i]; },
    /* las notas que empiezan en un paso (para el secuenciador) */
    melStarts: (seq, p, i, s) => P.mel(seq, p, i).filter((n) => n[0] === s),
    hasMel: (pat) => Object.keys(pat.mel).length > 0,
    row: (seq, p, i) => seq.patterns[p].rows[i] || ZERO,
    get: (seq, p, i, step) => +P.row(seq, p, i)[step] || 0,
    set(seq, p, i, step, v) {
      if (step < 0 || step >= MAX) return;
      const pat = seq.patterns[p], val = VEL[v] != null ? +v : 0;
      const r = P.row(seq, p, i), n = r.slice(0, step) + val + r.slice(step + 1);
      if (n === ZERO) delete pat.rows[i]; else pat.rows[i] = n;
      if (!val) setLenRaw(pat, i, step, 0);
      else if (r[step] === '0') {
        // una nota nueva dentro de otra con duración la acorta hasta aquí
        for (const [s, len] of Object.entries(lensOf(pat, i))) if (+s < step && +s + len > step) setLenRaw(pat, i, +s, step - +s);
      }
    },
    /* duración de la nota que empieza en `step`, en pasos (0 = entera, o no hay nota) */
    noteLen: (seq, p, i, step) => lensOf(seq.patterns[p], i)[step] || 0,
    /* pone la duración (n pasos; 0 = entera). No pasa de la nota siguiente del pad ni del final. Devuelve la que queda */
    setNoteLen(seq, p, i, step, n) {
      const pat = seq.patterns[p], r = P.row(seq, p, i);
      if (r[step] === '0' || r[step] == null) return 0;
      let max = MAX - step;
      for (let s = step + 1; s < MAX; s++) if (r[s] !== '0') { max = s - step; break; }
      const v = n > 0 ? Math.max(1, Math.min(Math.round(n), max)) : 0;
      setLenRaw(pat, i, step, v);
      return v;
    },
    /* notas de una fila con su tramo: [{ s, n }] (n = pasos con duración; 0 = entera) */
    notes(seq, p, i) {
      const r = P.row(seq, p, i), m = lensOf(seq.patterns[p], i), out = [];
      for (let s = 0; s < MAX; s++) if (r[s] !== '0') out.push({ s, n: m[s] || 0 });
      return out;
    },
    /* un clic: golpe ↔ nada; con suave, golpe suave ↔ nada (y golpe → suave) */
    toggle(seq, p, i, step, soft = false) {
      const v = P.get(seq, p, i, step), next = soft ? (v === 2 ? 0 : 2) : v ? 0 : 1;
      P.set(seq, p, i, step, next);
      return next;
    },
    hasNotes: (pat) => Object.keys(pat.rows).length > 0 || Object.keys(pat.mel || {}).length > 0,
    /* pasos con golpe de una fila en los `len` primeros pasos */
    count: (seq, p, i) => { const pat = seq.patterns[p]; return [...P.row(seq, p, i).slice(0, pat.len)].filter((c) => c !== '0').length; },
    fill(seq, p, i, kind) {
      const pat = seq.patterns[p], len = pat.len, r = [...P.row(seq, p, i)];
      if (kind === 'clear') for (let s = 0; s < len; s++) r[s] = '0';
      else if (kind === 'right' || kind === 'left') {
        const part = r.slice(0, len), moved = kind === 'right' ? [part[len - 1], ...part.slice(0, len - 1)] : [...part.slice(1), part[0]];
        moved.forEach((c, s) => (r[s] = c));
      } else if (FILLS[kind]) {
        // los rellenos sustituyen la fila; los que añaden (el redoble) se suman a lo que ya hay
        const F = FILLS[kind];
        for (let s = 0; s < len; s++) r[s] = F.at(s, len) ? (r[s] === '2' ? '2' : '1') : F.add ? r[s] : '0';
      }
      else if (kind === 'whole') { delete pat.lens[i]; return true; }
      else return false;
      // al mover la fila, sus duraciones se mueven con ella
      if ((kind === 'right' || kind === 'left') && pat.lens[i]) {
        const m = {};
        for (const [s, n] of Object.entries(pat.lens[i])) { if (+s >= len) { m[s] = n; continue; } const t = (+s + (kind === 'right' ? 1 : len - 1)) % len; m[t] = Math.min(n, MAX - t); }
        pat.lens[i] = m;
      }
      const n = r.join('');
      if (n === ZERO) delete pat.rows[i]; else pat.rows[i] = n;
      pruneLens(pat, i);
      return true;
    },
    clearPattern(seq, p) { seq.patterns[p].rows = {}; seq.patterns[p].lens = {}; seq.patterns[p].mel = {}; },
    copy(seq, from, to) { if (from === to) return; seq.patterns[to] = JSON.parse(JSON.stringify(seq.patterns[from])); },
    /* Alargar (4 → 8 → 16 tiempos): si lo nuevo está vacío, repite lo que ya había (los compases siguientes iguales).
       Acortar no borra nada: los pasos de más se guardan y vuelven al alargar */
    setLen(seq, p, len) {
      if (!LENS.includes(len)) return;
      const pat = seq.patterns[p], from = pat.len;
      if (len > from) {
        for (const [i, r] of Object.entries(pat.rows)) {
          if (r.slice(from, len) !== ZERO.slice(from, len)) continue;
          let n = r.slice(0, from);
          while (n.length < len) n += r.slice(0, from);
          pat.rows[i] = n.slice(0, len) + r.slice(len);
          // las duraciones también se repiten en los compases nuevos
          const m = pat.lens[i];
          if (m) for (const [s, d] of Object.entries(m)) if (+s < from) for (let o = from; +s + o < len; o += from) m[+s + o] = Math.min(d, MAX - (+s + o));
        }
        // y las notas del piano roll, si los compases nuevos están vacíos
        for (const [i, list] of Object.entries(pat.mel)) {
          if (list.some((n) => n[0] >= from && n[0] < len)) continue;
          const add = [];
          for (let o = from; o < len; o += from) list.filter((n) => n[0] < from).forEach((n) => { if (n[0] + o < len) add.push([n[0] + o, n[1], n[2], n[3]]); });
          pat.mel[i] = normMel([...list, ...add]);
        }
      }
      pat.len = len;
    },
    /* Al vaciar un pad, su fila desaparece de todos los patrones */
    clearRow(seq, i) { seq.patterns.forEach((pat) => { delete pat.rows[i]; delete pat.lens[i]; delete pat.mel[i]; }); seq.mute = seq.mute.filter((x) => x !== i); seq.solo = seq.solo.filter((x) => x !== i); seq.melodic = seq.melodic.filter((x) => x !== i); },
    audible: (seq, i) => (seq.solo.length ? seq.solo.includes(i) : !seq.mute.includes(i)),
    flag(seq, which, i) {
      const a = seq[which], k = a.indexOf(i);
      if (k >= 0) a.splice(k, 1); else { a.push(i); a.sort((x, y) => x - y); }
      return k < 0;
    },
    /* «AABA» → [0, 0, 1, 0]; lo que no sea A–D se ignora */
    parseChain: (txt) => [...String(txt || '').toUpperCase()].map((c) => NAMES.indexOf(c)).filter((i) => i >= 0).slice(0, 16),
    chainText: (c) => c.map((i) => NAMES[i]).join(''),
    /* qué patrón suena tras `cur` al acabar la vuelta */
    next(seq, chainPos) {
      if (seq.chainOn && seq.chain.length) { const k = (chainPos + 1) % seq.chain.length; return { pattern: seq.chain[k], chainPos: k }; }
      return { pattern: seq.pattern, chainPos: 0 };
    },
    first: (seq) => (seq.chainOn && seq.chain.length ? { pattern: seq.chain[0], chainPos: 0 } : { pattern: seq.pattern, chainPos: 0 }),
    /* tiempo de cada paso: semicorcheas, con swing en las pares (la «y» de cada corchea) */
    stepDur: (bpm) => 60 / bpm / 4,
    swingDelay: (seq, step) => (step % 2 ? (seq.swing / 100) * 0.5 * P.stepDur(seq.bpm) : 0),
    /* Base 4×4 a partir de lo que hay en los pads. roles: [{ i, role }] con role kick · clap · hat · ohat · bass.
       Solo el primer pad de cada papel; el resto de filas no se toca. Devuelve los pads que ha usado. */
    base(seq, p, roles) {
      const first = {}; roles.forEach(({ i, role }) => { if (role && first[role] == null) first[role] = i; });
      const plan = { kick: 'negras', clap: 'dosycuatro', bass: 'contra', ohat: 'contra', hat: first.ohat != null ? 'corcheas' : 'contra' };
      const used = [];
      for (const [role, i] of Object.entries(first)) if (plan[role]) { P.fill(seq, p, i, 'clear'); P.fill(seq, p, i, plan[role]); used.push(i); }
      // con charles abierto en el contratiempo, el cerrado va en los tiempos (entre los dos, corcheas)
      if (first.hat != null && first.ohat != null) { P.fill(seq, p, first.hat, 'clear'); P.fill(seq, p, first.hat, 'negras'); }
      return used.sort((a, b) => a - b);
    }
  });
})();
