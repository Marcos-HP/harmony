/* HARMONY · secuenciador del Soundpad: el reloj
   Programa los golpes con antelación contra el reloj de audio (no con temporizadores, que se retrasan): cada 25 ms
   mira qué pasos caen en los próximos 120 ms y los deja programados con H.PadAudio.at(…, cuándo). Así el ritmo va
   cuadrado aunque la página esté ocupada. El tic sale de un worker (en una pestaña en segundo plano los
   temporizadores normales se frenan a uno por segundo); si el navegador no deja crear el worker, setInterval.
   Lee el banco en cada tic: lo que se edita mientras suena se oye en la vuelta siguiente (o en el paso siguiente). */
(function () {
  const H = (window.H = window.H || {});
  const U = H.U;
  const AHEAD = 0.12, TICK = 25;

  let bankOf = null;          // () => banco actual
  let on = false, step = 0, pat = 0, chainPos = 0, gridT = 0, rec = false;
  const marks = [];           // pasos programados: { t, step, pat }
  let worker = null, timer = 0;

  function clock(run) {
    if (run) {
      if (worker === null) {
        try {
          const code = `let id=0;onmessage=(e)=>{clearInterval(id);if(e.data==='go')id=setInterval(()=>postMessage(0),${TICK});};`;
          worker = new Worker(URL.createObjectURL(new Blob([code], { type: 'text/javascript' })));
          worker.onmessage = tick;
          worker.onerror = () => { worker = false; if (on) clock(true); };
        } catch (e) { worker = false; }
      }
      if (worker) worker.postMessage('go');
      else { clearInterval(timer); timer = setInterval(tick, TICK); }
    } else {
      if (worker) worker.postMessage('stop');
      clearInterval(timer); timer = 0;
    }
  }

  const vkey = (b, i) => b.id + ':' + i;
  function schedule(b, seq, t) {
    const pt = seq.patterns[pat], PT = H.Patterns;
    const when = t + PT.swingDelay(seq, step);
    for (const k of Object.keys(pt.rows)) {
      const i = +k, v = +pt.rows[k][step];
      if (!v || !PT.audible(seq, i)) continue;
      const pad = b.pads[i];
      if (!pad || !pad.src) continue;
      H.PadAudio.at(vkey(b, i), pad, when, { vel: PT.VEL[v], choke: H.Banks.chokeMates(b, i).map((j) => vkey(b, j)) });
    }
    marks.push({ t: when, grid: t, step, pat });
    while (marks.length > 128) marks.shift();
  }
  function tick() {
    if (!on) return;
    const ctx = H.Audio.ctx(), b = bankOf && bankOf();
    if (!ctx || !b || !b.seq) return;
    const seq = b.seq;
    // si la pestaña estuvo dormida y el reloj se quedó atrás, se salta lo perdido en vez de soltarlo todo de golpe
    if (gridT < ctx.currentTime - 0.25) gridT = ctx.currentTime + 0.02;
    while (gridT < ctx.currentTime + AHEAD) {
      if (step >= seq.patterns[pat].len) step = 0;
      schedule(b, seq, gridT);
      gridT += H.Patterns.stepDur(seq.bpm);
      step++;
      if (step >= seq.patterns[pat].len) {
        const n = H.Patterns.next(seq, chainPos);
        pat = n.pattern; chainPos = n.chainPos; step = 0;
      }
    }
  }

  const S = (H.Seq = {
    /* de dónde sale el banco (el Soundpad se lo da al construirse) */
    source(fn) { bankOf = fn; },
    playing: () => on,
    start() {
      const ctx = H.Audio.ensure(), b = bankOf && bankOf();
      if (!ctx || !b) return false;
      b.pads.forEach((p) => { if (p.src) H.PadAudio.load(p.src).catch(() => {}); });
      const f = H.Patterns.first(b.seq);
      pat = f.pattern; chainPos = f.chainPos; step = 0; marks.length = 0;
      gridT = ctx.currentTime + 0.08;
      on = true;
      clock(true); tick();
      U.emit('seq', true);
      return true;
    },
    stop() {
      if (!on) return;
      on = false; rec = false;
      clock(false);
      H.PadAudio.seqStop();
      marks.length = 0;
      U.emit('seq', false);
    },
    toggle() { return on ? (S.stop(), false) : S.start(); },
    /* el paso que está sonando ahora: { step, pat } (o null) */
    position() {
      const ctx = H.Audio.ctx(); if (!on || !ctx) return null;
      const now = ctx.currentTime;
      let m = null;
      for (const x of marks) { if (x.t <= now) m = x; else break; }
      return m ? { step: m.step, pat: m.pat } : null;
    },
    /* golpes de un paso que ya ha sonado (para que la interfaz ilumine los pads a la vez que suenan) */
    marksSince(t) { return marks.filter((m) => m.t > t); },
    /* grabación en directo: lo que se toca con los pads mientras suena entra en el paso más cercano */
    recording: () => on && rec,
    setRecording(v) { rec = !!v && on; U.emit('seq:rec', rec); return rec; },
    /* paso más cercano a un instante (en la rejilla, sin swing) entre los programados y el siguiente */
    nearest(time) {
      const b = bankOf && bankOf(); if (!on || !b) return null;
      let best = null;
      for (const m of marks) { const d = Math.abs(m.grid - time); if (!best || d < best.d) best = { d, step: m.step, pat: m.pat }; }
      // el paso que aún no se ha programado (a tempos lentos puede ser el más cercano)
      const d = Math.abs(gridT - time);
      if (!best || d < best.d) best = { d, step: step >= b.seq.patterns[pat].len ? 0 : step, pat };
      return best;
    },
    record(i) {
      const ctx = H.Audio.ctx(), b = bankOf && bankOf();
      if (!S.recording() || !ctx || !b || !b.pads[i] || !b.pads[i].src) return null;
      const n = S.nearest(ctx.currentTime);
      if (!n) return null;
      H.Patterns.set(b.seq, n.pat, i, n.step, 1);
      return n;
    }
  });
})();
