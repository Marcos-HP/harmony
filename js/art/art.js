/* HARMONY · gráficos generativos (SVG en texto)
   - Fundas: motivo por familia, derivado del ritmo de cada escena + composición por número de registro.
     No son carátulas originales: la interfaz lo indica siempre.
   - Etiqueta central del vinilo, patrones de familia, reglas de BPM y de época. */
(function () {
  const H = (window.H = window.H || {});
  const U = H.U;
  const Art = (H.Art = {});
  const r1 = (n) => Math.round(n * 10) / 10;

  /* Patrones de familia para el espectro (usar dentro de <defs>) */
  Art.familyDefs = function (prefix = 'pat') {
    return `
    <pattern id="${prefix}-grid" width="6" height="6" patternUnits="userSpaceOnUse"><path d="M0 0h6M0 0v6" class="pt"/></pattern>
    <pattern id="${prefix}-diag" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0 0v6" class="pt"/></pattern>
    <pattern id="${prefix}-dots" width="5" height="5" patternUnits="userSpaceOnUse"><circle cx="2.5" cy="2.5" r="0.9" class="pf"/></pattern>
    <pattern id="${prefix}-hlines" width="5" height="5" patternUnits="userSpaceOnUse"><path d="M0 2.5h5" class="pt"/></pattern>
    <pattern id="${prefix}-vlines" width="5" height="5" patternUnits="userSpaceOnUse"><path d="M2.5 0v5" class="pt"/></pattern>
    <pattern id="${prefix}-cross" width="7" height="7" patternUnits="userSpaceOnUse"><path d="M0 0L7 7M7 0L0 7" class="pt"/></pattern>`;
  };

  /* Motivo de familia dentro de un cuadrado 100×100 */
  function motif(fam, rnd, cls) {
    let s = '';
    if (fam === 'raices') {
      // secuenciador de 16 pasos (TB-303): filas de notas, una de acentos
      const cols = 16, rows = 4 + Math.floor(rnd() * 4), cw = 5.2, gap = 0.8, x0 = 2, y0 = 4 + Math.floor(rnd() * 3) * 6;
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const on = r === rows - 1 ? c % 4 === 0 : rnd() < 0.28;
        s += `<rect x="${r1(x0 + c * (cw + gap) + 0.5)}" y="${r1(y0 + r * (cw + gap))}" width="${cw}" height="${cw}" class="${on ? cls.f : cls.o}"/>`;
      }
    } else if (fam === 'hardcore') {
      // bandas diagonales: bombo saturado
      let x = -100;
      while (x < 120) {
        const w = 2 + Math.floor(rnd() * 8);
        s += `<path d="M${x} 100 L${x + 100} 0 L${x + 100 + w} 0 L${x + w} 100z" class="${cls.f}"/>`;
        x += w + 2 + Math.floor(rnd() * 6);
      }
    } else if (fam === 'hardstyle') {
      // un compás: bombos en negras, reverse bass a contratiempo, screech arriba
      const bw = 4.6, base = 92;
      for (let i = 0; i < 16; i++) {
        const kick = i % 4 === 0, rb = i % 4 === 2, off = i % 2 === 1;
        const h = kick ? 58 + rnd() * 6 : rb ? 30 + rnd() * 10 : off ? 6 + rnd() * 6 : 3;
        s += `<rect x="${r1(4 + i * 5.85)}" y="${r1(base - h)}" width="${bw}" height="${r1(h)}" class="${cls.f}"/>`;
      }
      let p = 'M4 ' + (14 + rnd() * 6).toFixed(1);
      for (let x = 8; x <= 96; x += 4) p += ` L${x} ${(10 + rnd() * 14).toFixed(1)}`;
      s += `<path d="${p}" class="${cls.s}" stroke-width="1.4" fill="none"/>`;
    } else if (fam === 'techno') {
      // bucle: anillos concéntricos desplazados
      const cx = 30 + rnd() * 40, cy = 30 + rnd() * 40;
      for (let r = 4, i = 0; r < 110; i++) { const w = 1 + rnd() * 3.5; s += `<circle cx="${r1(cx)}" cy="${r1(cy)}" r="${r1(r)}" class="${cls.s}" stroke-width="${r1(w)}" fill="none"/>`; r += w + 2.5 + rnd() * 3; }
    } else if (fam === 'espana') {
      // láseres de sala: haces desde un foco en el borde
      const ox = rnd() < 0.5 ? -4 : 104, oy = 20 + rnd() * 60;
      const n = 9 + Math.floor(rnd() * 8);
      for (let i = 0; i < n; i++) {
        const a = (ox < 0 ? -0.9 : Math.PI - 0.9) + (i / (n - 1)) * 1.8 + (rnd() - 0.5) * 0.08;
        const w = 0.4 + rnd() * 2.2;
        s += `<path d="M${r1(ox)} ${r1(oy)}L${r1(ox + Math.cos(a) * 160)} ${r1(oy + Math.sin(a) * 160)}" class="${cls.s}" stroke-width="${r1(w)}"/>`;
      }
    } else {
      // trama de semitono (hard house / trance)
      const cx = rnd() * 100, cy = rnd() * 100;
      for (let x = 3; x < 100; x += 6) for (let y = 3; y < 100; y += 6) {
        const d = Math.hypot(x - cx, y - cy);
        const rr = Math.max(0, 2.9 - d / 32);
        if (rr > 0.25) s += `<circle cx="${x}" cy="${y}" r="${r1(rr)}" class="${cls.f}"/>`;
      }
    }
    return s;
  }

  /* Texto que no cabe: se corta por una palabra entera y se marca con «…». Nunca a media palabra. */
  function clip(text, max) {
    if (text.length <= max) return text;
    let cut = text.slice(0, Math.max(1, max - 1));
    const sp = cut.lastIndexOf(' ');
    if (sp > max * 0.4) cut = cut.slice(0, sp);
    return cut.replace(/[\s,.;:·/&(–—…-]+$/, '') + '…';
  }
  Art.clip = clip;
  /* Ajuste a un ancho: primero baja el cuerpo hasta `min`; si aún no cabe, corta por palabra.
     k = ancho medio de un carácter en em (mono 0.6 + espaciado). */
  function fit(text, avail, size, min, k) {
    const s = Math.min(size, avail / (Math.max(1, text.length) * k));
    if (s >= min) return { text, size: +s.toFixed(2) };
    return { text: clip(text, Math.floor(avail / (min * k))), size: min };
  }
  Art.fit = fit;
  const K_MONO = 0.64, K_LB = 0.66, K_TITLE = 0.6;

  /* Título en líneas: si no cabe en dos, baja el cuerpo y prueba tres; si tampoco, corta por palabra */
  function wrapTitle(title, max, maxLines) {
    const words = title.split(' '); const lines = [''];
    for (const w of words) {
      const cur = lines[lines.length - 1];
      if ((cur + ' ' + w).trim().length > max && cur) lines.push(w); else lines[lines.length - 1] = (cur + ' ' + w).trim();
    }
    const long = words.some((w) => w.length > max);
    if (lines.length > maxLines) { const rest = lines.slice(maxLines - 1).join(' '); lines.length = maxLines - 1; lines.push(clip(rest, max)); }
    return { lines, fits: !long && lines.join(' ') === title };
  }
  function titleBlock(title, width) {
    for (const [fs, lh, n] of [[7.4, 8, 2], [6.2, 6.8, 3], [5.2, 5.8, 3]]) {
      const w = wrapTitle(title, Math.floor(width / (fs * K_TITLE)), n);
      if (w.fits || fs === 5.2) return { ...w, fs, lh };
    }
  }

  /* Funda 100×100 */
  Art.sleeve = function (t, opts = {}) {
    const seed = U.hash(t.id + ':' + t.n);
    const rnd = U.rng(seed);
    const inv = rnd() < 0.34;
    const variant = opts.variant != null ? opts.variant : Math.floor(rnd() * 3);
    const cls = inv ? { bg: 'sl-ink', f: 'sl-paper', o: 'sl-paper-o', s: 'sl-paper-s', t: 'sl-paper' } : { bg: 'sl-paper', f: 'sl-ink', o: 'sl-ink-o', s: 'sl-ink-s', t: 'sl-ink' };
    const id = 'c' + seed.toString(36);
    let s = `<svg class="sleeve ${opts.cls || ''}" viewBox="0 0 100 100" role="img" aria-label="Funda generada para ${U.esc(t.title)}"><defs><clipPath id="${id}"><rect width="100" height="100"/></clipPath></defs>`;
    s += `<rect width="100" height="100" class="${cls.bg}"/>`;
    s += `<g clip-path="url(#${id})">${motif(t.fam, rnd, cls)}</g>`;
    const yr = t.year != null ? String(t.year) : '—';
    if (variant === 0) {
      // banda de etiqueta inferior
      s += `<rect x="0" y="66" width="100" height="34" class="${cls.bg}"/><path d="M0 66h100" class="${cls.s}" stroke-width=".6"/>`;
      const tb = titleBlock(t.title, 90);
      const y0 = tb.lines.length === 3 ? 73.5 : 76;
      tb.lines.forEach((ln, i) => (s += `<text x="4" y="${(y0 + i * tb.lh).toFixed(1)}" class="${cls.t} sl-title" font-size="${tb.fs}">${U.esc(ln)}</text>`));
      const ar = fit(t.artistLine.toUpperCase(), 80, 3.6, 2.7, K_MONO);
      s += `<text x="4" y="96" class="${cls.t} sl-mono" font-size="${ar.size}">${U.esc(ar.text)}</text>`;
      s += `<text x="96" y="96" text-anchor="end" class="${cls.t} sl-mono" font-size="3.6">${U.esc(yr)}</text>`;
    } else if (variant === 1) {
      // número grande: el año como masa tipográfica
      // cabecera de dos líneas (número y género; título) para que el año no tape nada
      s += `<rect x="0" y="0" width="100" height="21" class="${cls.bg}"/><path d="M0 21h100" class="${cls.s}" stroke-width=".5"/>`;
      s += `<text x="4" y="8.5" class="${cls.t} sl-mono" font-size="3.6">${t.hmy}</text>`;
      const gn = fit(t.G.name.toUpperCase(), 64, 3.6, 2.7, K_MONO);
      s += `<text x="96" y="8.5" text-anchor="end" class="${cls.t} sl-mono" font-size="${gn.size}">${U.esc(gn.text)}</text>`;
      const ti = fit(t.title.toUpperCase(), 92, 3.6, 2.7, K_MONO);
      s += `<text x="4" y="16.5" class="${cls.t} sl-mono" font-size="${ti.size}">${U.esc(ti.text)}</text>`;
      s += `<rect x="0" y="74" width="100" height="26" class="${cls.bg}"/>`;
      s += `<text x="3" y="96" class="${cls.t} sl-year" font-size="27">${U.esc(yr)}</text>`;
    } else {
      // funda de sello troquelada: se ve la galleta
      s += `<circle cx="50" cy="50" r="21" class="${cls.bg}"/><circle cx="50" cy="50" r="21" class="${cls.s}" stroke-width=".7" fill="none"/>`;
      s += `<circle cx="50" cy="50" r="15" class="sl-label"/><circle cx="50" cy="50" r="1.4" class="sl-hole"/>`;
      s += `<text x="50" y="45" text-anchor="middle" class="sl-label-ink sl-mono" font-size="2.6">${t.hmy}</text>`;
      const ln = fit((t.L ? t.L.short || t.L.name : 'Sello —').toUpperCase(), 25, 2.4, 1.8, K_MONO);
      s += `<text x="50" y="57" text-anchor="middle" class="sl-label-ink sl-mono" font-size="${ln.size}">${U.esc(ln.text)}</text>`;
      s += `<rect x="0" y="86" width="100" height="14" class="${cls.bg}"/>`;
      const ti = fit(t.title.toUpperCase(), 80, 3.8, 2.8, K_MONO);
      s += `<text x="4" y="95.5" class="${cls.t} sl-mono" font-size="${ti.size}">${U.esc(ti.text)}</text>`;
      s += `<text x="96" y="95.5" text-anchor="end" class="${cls.t} sl-mono" font-size="3.8">${U.esc(yr)}</text>`;
    }
    s += `</svg>`;
    return s;
  };

  /* Etiqueta central del disco (200×200). Sin tema: etiqueta en blanco de Harmony. */
  Art.label = function (t, opts = {}) {
    const uid = 'lb' + Math.random().toString(36).slice(2, 8);
    let s = `<svg class="disc-label" viewBox="0 0 200 200" aria-hidden="true"><defs>
      <path id="${uid}-top" d="M100 100 m-72 0 a72 72 0 1 1 144 0"/>
      <path id="${uid}-bot" d="M100 100 m-80 0 a80 80 0 0 0 160 0"/></defs>
      <circle cx="100" cy="100" r="99" class="lb-paper"/>
      <circle cx="100" cy="100" r="92" class="lb-ring"/>`;
    if (!t) {
      s += `<text class="lb-mono" font-size="9" x="100" y="70" text-anchor="middle">HARMONY</text>
        <text class="lb-mono" font-size="7" x="100" y="140" text-anchor="middle">${U.esc(opts.empty || 'SIN DISCO')}</text>`;
    } else {
      // arcos: superior r=72 (≈226), inferior r=80 (≈251); se deja margen para que no toquen los extremos
      const ti = fit(t.title, 200, 13, 8.5, K_TITLE), ar = fit(t.artistLine.toUpperCase(), 222, 7.5, 5.5, K_LB);
      const ln = fit((t.L ? t.L.name : 'Sello sin datos').toUpperCase(), 150, 6.5, 5, K_LB);
      s += `<text class="lb-title" font-size="${ti.size}"><textPath href="#${uid}-top" startOffset="50%" text-anchor="middle">${U.esc(ti.text)}</textPath></text>
        <text class="lb-mono" font-size="${ar.size}"><textPath href="#${uid}-bot" startOffset="50%" text-anchor="middle">${U.esc(ar.text)}</textPath></text>
        <text class="lb-mono" font-size="7" x="42" y="104" text-anchor="middle">LADO A</text>
        <text class="lb-mono" font-size="7" x="158" y="104" text-anchor="middle">${H.A.bpmTxt(t, '— ')} BPM</text>
        <text class="lb-mono" font-size="${ln.size}" x="100" y="70" text-anchor="middle">${U.esc(ln.text)}</text>
        <text class="lb-mono" font-size="6.5" x="100" y="136" text-anchor="middle">${t.hmy} · ${t.year != null ? t.year : 'AÑO —'}</text>`;
      if (opts.source) s += `<text class="lb-mono lb-src" font-size="6" x="100" y="148" text-anchor="middle">${U.esc(opts.source)}</text>`;
      // el tema existe pero no en vinilo (o sin foto de su galleta): este disco lo prensa Harmony
      if (!t.labelArt && (t.noVinyl || t.vinylEd)) s += `<text class="lb-mono" font-size="5.5" x="100" y="160" text-anchor="middle">PRENSA HARMONY</text>`;
    }
    s += `<circle cx="100" cy="100" r="5" class="lb-hole"/></svg>`;
    return s;
  };

  /* Regla de BPM: rango del género sobre la escala completa del archivo */
  Art.bpmRuler = function (lo, hi, opts = {}) {
    const [a, b] = H.A.BPM; const W = 1000, Hh = opts.big ? 54 : 18;
    const x = (v) => ((v - a) / (b - a)) * W;
    let s = `<svg class="ruler ${opts.big ? 'ruler-big' : ''}" viewBox="0 0 ${W} ${Hh}" preserveAspectRatio="none" role="img" aria-label="Rango de ${lo} a ${hi} BPM sobre una escala de ${a} a ${b}">`;
    if (opts.big) {
      for (let v = a; v <= b; v += 5) { const major = v % 20 === 0; s += `<path d="M${r1(x(v))} ${major ? 0 : 6}V${major ? 16 : 12}" class="rl-tick"/>`; }
      s += `<rect x="${r1(x(lo))}" y="22" width="${r1(Math.max(4, x(hi) - x(lo)))}" height="30" class="rl-band"/>`;
    } else {
      s += `<path d="M0 ${Hh / 2}H${W}" class="rl-base"/>`;
      s += `<rect x="${r1(x(lo))}" y="${Hh / 2 - 4}" width="${r1(Math.max(6, x(hi) - x(lo)))}" height="8" class="rl-band"/>`;
    }
    return s + '</svg>';
  };

  Art.eraBar = function (from, to, opts = {}) {
    const [a, b] = H.A.YEARS; const W = 1000, Hh = opts.big ? 54 : 18;
    const x = (v) => ((v - a) / (b - a)) * W;
    const end = to == null ? b : to;
    let s = `<svg class="ruler ${opts.big ? 'ruler-big' : ''}" viewBox="0 0 ${W} ${Hh}" preserveAspectRatio="none" role="img" aria-label="Activo de ${from} a ${to == null ? 'hoy' : to}">`;
    if (opts.big) {
      for (let v = a; v <= b; v++) { const major = v % 10 === 0; s += `<path d="M${r1(x(v))} ${major ? 0 : 8}V${major ? 16 : 12}" class="rl-tick"/>`; }
      s += `<rect x="${r1(x(from))}" y="22" width="${r1(Math.max(4, x(end) - x(from)))}" height="30" class="rl-band ${to == null ? 'rl-open' : ''}"/>`;
    } else {
      s += `<path d="M0 ${Hh / 2}H${W}" class="rl-base"/><rect x="${r1(x(from))}" y="${Hh / 2 - 4}" width="${r1(Math.max(6, x(end) - x(from)))}" height="8" class="rl-band"/>`;
    }
    return s + '</svg>';
  };
})();
