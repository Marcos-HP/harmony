/* HARMONY · secuenciador del Soundpad: el modelo de patrones, sin DOM ni audio.
   Cada banco lleva su secuencia (bank.seq):
     bpm 60–260 · swing 0–100 (retrasa las semicorcheas pares hasta medio paso, como el swing de una MPC al 75 %)
     patterns  cuatro patrones (A–D) de 16 o 32 pasos de semicorchea
       rows  { [n.º de pad]: '1000100010001000…' } — 32 caracteres siempre: 0 nada · 1 golpe · 2 golpe suave
             (al pasar a 16 pasos, la segunda mitad se guarda; al volver a 32, se recupera)
     pattern  el patrón que se edita (y el que suena: un cambio entra al acabar la vuelta)
     chain · chainOn  la cadena de patrones («AABA»), si se toca encadenado
     mute · solo  pads silenciados o en solo (para todo el banco, no por patrón)
   Los pasos se refieren a los pads por su número: cambiar el sonido de un pad conserva su ritmo. */
(function () {
  const H = (window.H = window.H || {});

  const N = 4, MAX = 32, LENS = [16, 32], NAMES = 'ABCD', PADS = 16;
  const BPM_MIN = 60, BPM_MAX = 260;
  const VEL = [0, 1, 0.45];   // nada · golpe · golpe suave
  const ZERO = '0'.repeat(MAX);
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const num = (v, d) => (v !== null && v !== '' && Number.isFinite(+v) ? +v : d);

  const emptyPattern = () => ({ len: 16, rows: {} });
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
    return out;
  }
  const idxList = (a) => [...new Set((Array.isArray(a) ? a : []).map(Number).filter((i) => Number.isInteger(i) && i >= 0 && i < PADS))].sort((x, y) => x - y);

  /* rellenos rápidos de una fila (sobre el patrón entero: en 32 pasos se repiten por compás) */
  const FILLS = {
    negras: { name: 'Cada negra (1, 2, 3, 4)', at: (s) => s % 4 === 0 },
    contra: { name: 'A contratiempo', at: (s) => s % 4 === 2 },
    dosycuatro: { name: 'En el 2 y el 4', at: (s) => s % 8 === 4 },
    corcheas: { name: 'Corcheas', at: (s) => s % 2 === 0 },
    semis: { name: 'Semicorcheas', at: () => true },
    galope: { name: 'Galope (1 · 3 · 4 de cada tiempo)', at: (s) => s % 4 !== 1 },
    redoble: { name: 'Redoble al final', at: (s, len) => s >= len - 4 || (s >= len - 8 && s % 2 === 0) }
  };

  const P = (H.Patterns = {
    N, MAX, LENS, NAMES, VEL, BPM_MIN, BPM_MAX, FILLS,
    create: () => ({ bpm: 170, swing: 0, pattern: 0, chain: [], chainOn: false, patterns: Array.from({ length: N }, emptyPattern), mute: [], solo: [] }),
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
        solo: idxList(s.solo)
      };
    },
    row: (seq, p, i) => seq.patterns[p].rows[i] || ZERO,
    get: (seq, p, i, step) => +P.row(seq, p, i)[step] || 0,
    set(seq, p, i, step, v) {
      if (step < 0 || step >= MAX) return;
      const r = P.row(seq, p, i), n = r.slice(0, step) + (VEL[v] != null ? v : 0) + r.slice(step + 1);
      if (n === ZERO) delete seq.patterns[p].rows[i]; else seq.patterns[p].rows[i] = n;
    },
    /* un clic: golpe ↔ nada; con suave, golpe suave ↔ nada (y golpe → suave) */
    toggle(seq, p, i, step, soft = false) {
      const v = P.get(seq, p, i, step), next = soft ? (v === 2 ? 0 : 2) : v ? 0 : 1;
      P.set(seq, p, i, step, next);
      return next;
    },
    hasNotes: (pat) => Object.keys(pat.rows).length > 0,
    /* pasos con golpe de una fila en los `len` primeros pasos */
    count: (seq, p, i) => { const pat = seq.patterns[p]; return [...P.row(seq, p, i).slice(0, pat.len)].filter((c) => c !== '0').length; },
    fill(seq, p, i, kind) {
      const pat = seq.patterns[p], len = pat.len, r = [...P.row(seq, p, i)];
      if (kind === 'clear') for (let s = 0; s < len; s++) r[s] = '0';
      else if (kind === 'right' || kind === 'left') {
        const part = r.slice(0, len), moved = kind === 'right' ? [part[len - 1], ...part.slice(0, len - 1)] : [...part.slice(1), part[0]];
        moved.forEach((c, s) => (r[s] = c));
      } else if (FILLS[kind]) for (let s = 0; s < len; s++) r[s] = FILLS[kind].at(s, len) ? (r[s] === '2' ? '2' : '1') : '0';
      else return false;
      const n = r.join('');
      if (n === ZERO) delete pat.rows[i]; else pat.rows[i] = n;
      return true;
    },
    clearPattern(seq, p) { seq.patterns[p].rows = {}; },
    copy(seq, from, to) { if (from === to) return; seq.patterns[to] = JSON.parse(JSON.stringify(seq.patterns[from])); },
    /* 16 → 32: si la segunda mitad está vacía, repite la primera (un compás más igual que el primero) */
    setLen(seq, p, len) {
      if (!LENS.includes(len)) return;
      const pat = seq.patterns[p];
      if (len === 32 && pat.len === 16) {
        for (const [i, r] of Object.entries(pat.rows)) if (r.slice(16) === ZERO.slice(16)) pat.rows[i] = r.slice(0, 16) + r.slice(0, 16);
      }
      pat.len = len;
    },
    /* Al vaciar un pad, su fila desaparece de todos los patrones */
    clearRow(seq, i) { seq.patterns.forEach((pat) => delete pat.rows[i]); seq.mute = seq.mute.filter((x) => x !== i); seq.solo = seq.solo.filter((x) => x !== i); },
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
