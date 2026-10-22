// node --test tools/test/presets.test.mjs
// Presets de banco por escuela (js/data/presets.js): sonidos que existen, tempos que cuadran con los bucles,
// patrones bien formados y un banco nuevo que no toca los que ya hay.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const ROOT = new URL('../../', import.meta.url).pathname;
function load() {
  const ctx = { window: {} };
  vm.createContext(ctx);
  for (const f of ['js/data/samples.js', 'js/data/presets.js', 'js/lib/patterns.js', 'js/lib/banks.js']) vm.runInContext(readFileSync(ROOT + f, 'utf8'), ctx);
  const H = ctx.window.H, byId = new Map();
  H.data.samples.packs.forEach((p) => p.samples.forEach((s) => byId.set(s.id, s)));
  return { H, byId };
}

test('cada preset: 16 pads con sonidos de Harmony que existen y sin nombres de artistas', () => {
  const { H, byId } = load();
  const P = H.data.presets;
  assert.ok(P.length >= 6);
  assert.equal(new Set(P.map((p) => p.id)).size, P.length, 'ids únicos');
  for (const pr of P) {
    assert.equal(pr.pads.length, 16, pr.id);
    for (const pad of pr.pads) {
      assert.ok(byId.has(pad.sampleId), `${pr.id}: no existe ${pad.sampleId}`);
      assert.ok(pad.name && pad.name.length <= 40, `${pr.id}: nombre de pad`);
    }
    assert.ok(pr.bpm >= 60 && pr.bpm <= 260 && pr.tonality && pr.desc && pr.school);
  }
});

test('los bucles de un preset van a su tempo y se lanzan al empezar sus compases', () => {
  const { H, byId } = load();
  for (const pr of H.data.presets) {
    pr.pads.forEach((pad, i) => {
      const s = byId.get(pad.sampleId);
      if (!s.loop) return;
      assert.equal(s.bpm[0], pr.bpm, `${pr.id}: ${pad.sampleId} va a ${s.bpm[0]} BPM`);
      assert.equal(pad.pitch, 0, `${pr.id}: un bucle con tono cambiado no dura sus compases`);
      for (const pat of pr.patterns) {
        const row = pat.rows[i]; if (!row) continue;
        [...row].forEach((c, step) => { if (c !== '0') assert.equal(step % (s.bars * 16), 0, `${pr.id}: ${pad.sampleId} en el paso ${step}`); });
      }
    });
  }
});

test('patrones: cuatro de 16 tiempos, filas de 64 pasos que solo usan pads con sonido, y su cadena', () => {
  const { H } = load();
  for (const pr of H.data.presets) {
    assert.equal(pr.patterns.length, 4, pr.id);
    pr.patterns.forEach((pat, k) => {
      assert.equal(pat.len, 64);
      assert.ok(Object.keys(pat.rows).length > 0, `${pr.id}: patrón ${'ABCD'[k]} vacío`);
      for (const [i, row] of Object.entries(pat.rows)) {
        assert.match(row, /^[012]{64}$/, `${pr.id}: fila ${i}`);
        assert.ok(+i >= 0 && +i < 16);
      }
    });
    assert.match(pr.chain, /^[ABCD]{1,16}$/);
  }
});

test('fromPreset: banco nuevo con sus pads, tempo, patrones y cadena; los demás bancos no se tocan', () => {
  const { H } = load();
  const B = H.Banks, st = B.defaultState(), first = B.current(st);
  first.pads[0].src = { type: 'file', fileId: 'f1', fileName: 'mio.wav' };
  const before = JSON.stringify(first);
  const pr = H.data.presets.find((p) => p.id === 'newstyle');
  const b = B.fromPreset(st, pr, (id) => (id.includes('kick') ? 'kick' : 'fx'));
  assert.equal(st.banks.length, 2);
  assert.equal(st.current, b.id);
  assert.equal(JSON.stringify(first), before, 'el banco que había sigue igual');
  assert.equal(b.name, 'Newstyle');
  assert.equal(b.pads[0].src.sampleId, 'harmony-05/nw-kick-seco');
  assert.equal(b.pads[0].cat, 'kick');
  assert.equal(b.pads[3].choke, 1); assert.equal(b.pads[4].choke, 1);
  assert.equal(b.pads.map((p) => p.key).join(''), '1234qwerasdfzxcv');
  assert.equal(b.seq.bpm, 150);
  assert.equal(b.seq.chainOn, true);
  assert.equal(H.Patterns.chainText(b.seq.chain), 'ABCCDBCC');
  assert.equal(H.Patterns.row(b.seq, 2, 0).slice(0, 16), '1000100010001000');
  // un segundo preset igual: nombre libre
  assert.equal(B.fromPreset(st, pr).name, 'Newstyle 2');
  assert.equal(B.fromPreset(st, null), null);
});

test('rellenos de escuela: subida y tresillo', () => {
  const { H } = load();
  const P = H.Patterns, s = P.create();
  const hits = (r, n = 64) => [...r.slice(0, n)].map((c, i) => (c !== '0' ? i : -1)).filter((i) => i >= 0);
  P.fill(s, 0, 0, 'subida');
  const h = hits(P.row(s, 0, 0));
  assert.deepEqual(h.slice(0, 8), [0, 4, 8, 12, 16, 20, 24, 28]);
  assert.ok(h.includes(34) && !h.includes(35) && h.includes(49) && h.includes(63));
  s.patterns[1].len = 16; P.fill(s, 1, 0, 'tresillo');
  assert.deepEqual(hits(P.row(s, 1, 0), 16), [0, 3, 6, 8, 11, 14]);
});

test('presets con efectos de pad y notas con duración: llegan al banco nuevo', () => {
  const { H } = load();
  const B = H.Banks, st = B.defaultState();
  const ind = B.fromPreset(st, H.data.presets.find((p) => p.id === 'industrial'));
  assert.equal(ind.pads[5].echo, 35); assert.equal(ind.pads[5].echoDiv, 0.75);
  assert.equal(ind.pads[6].bits, 6);
  assert.equal(ind.pads[1].filter, 'lp'); assert.equal(ind.pads[1].cutoff, 2600);
  assert.equal(ind.pads[0].drive, 0, 'sin fx, limpio');
  // «x-..» = notas de dos pasos en el patrón B (kick picado)
  assert.equal(H.Patterns.noteLen(ind.seq, 1, 1, 0), 2);
  assert.equal(H.Patterns.noteLen(ind.seq, 1, 1, 60), 0, 'las semicorcheas del final, enteras');
  assert.equal(H.Patterns.row(ind.seq, 1, 1).slice(0, 8), '10001000');
  const osc = B.fromPreset(st, H.data.presets.find((p) => p.id === 'hardcore-oscuro'));
  assert.equal(H.Patterns.noteLen(osc.seq, 3, 13, 8), 8, 'la campana del break, cortada cada medio compás');
});

test('renderizador de presets: toca la cadena entera con su tempo, sin pasarse de nivel', async () => {
  const { renderPreset } = await import('../samples/render-preset.mjs');
  const r = renderPreset('uptempo-himno');
  assert.ok(Math.abs(r.seconds - 8 * 64 * 0.075) < 1e-9, 'ABCCDBCC a 200 BPM: 38,4 s');
  let peak = 0; for (const v of r.audio.L) peak = Math.max(peak, Math.abs(v));
  assert.ok(peak < 0.95 && peak > 0.3);
});

test('renderizador: un pad en modo notas suena con sus notas (y no con sus golpes)', async () => {
  const { renderPreset } = await import('../samples/render-preset.mjs');
  const pad = { sampleId: 'harmony-08/up-kick-d2', name: 'Kick', volume: 0.9, choke: 0, pitch: 0 };
  const empty = { len: 16, rows: {} };
  const base = { id: 'prueba', name: 'Prueba', school: 'x', bpm: 200, swing: 0, chain: '', desc: 'x', pads: [pad] };
  // golpes en todos los pasos, pero el pad está en modo notas: solo suena la nota del paso 8
  const mel = renderPreset({ ...base, melodic: [0], patterns: [{ len: 16, rows: { 0: '1'.repeat(16) }, mel: { 0: [[8, 4, 12, 1]] } }, empty, empty, empty] });
  const hits = renderPreset({ ...base, patterns: [{ len: 16, rows: { 0: '1'.repeat(16) } }, empty, empty, empty] });
  const sd = 60 / 200 / 4, sr = 44100, rms = (x, a, b) => { let s = 0; for (let j = Math.round(a * sr); j < Math.round(b * sr); j++) s += x[j] * x[j]; return Math.sqrt(s / (Math.round(b * sr) - Math.round(a * sr))); };
  assert.ok(rms(mel.audio.L, 0, 8 * sd - 0.005) < 1e-4, 'antes de la nota, silencio (los golpes no suenan)');
  assert.ok(rms(mel.audio.L, 8 * sd, 12 * sd) > 0.05, 'la nota suena');
  assert.ok(rms(hits.audio.L, 0, 8 * sd) > 0.05, 'sin modo notas, los golpes suenan');
});

test('presets en modo notas: notas dentro del patrón, en su escala, y los pads en modo notas las tienen', () => {
  const { H, byId } = load();
  const NN = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const midi = (k) => { const m = /^([A-G]#?)(-?\d)$/.exec(k); return 12 * (+m[2] + 1) + NN.indexOf(m[1]); };
  const mel = H.data.presets.filter((p) => p.melodic);
  assert.ok(mel.length >= 2);
  for (const pr of mel) {
    const sc = H.Patterns.SCALES[pr.scale.mode].steps.map((x) => (x + pr.scale.root) % 12);
    const ok = new Set([...sc, (pr.scale.root + 10) % 12]);   // menor armónica más la séptima natural (el acorde de Do en Re menor)
    for (const i of pr.melodic) {
      const s = byId.get(pr.pads[i].sampleId);
      assert.ok(s.key, `${pr.id}: el pad ${i} en modo notas necesita un sonido con nota`);
      const root = midi(s.key) + (pr.pads[i].pitch || 0);
      const all = pr.patterns.flatMap((p) => p.mel[i] || []);
      assert.ok(all.length > 0, `${pr.id}: el pad ${i} en modo notas no tiene notas`);
      for (const [st, l, t, v] of all) {
        assert.ok(st >= 0 && st + l <= 64 && l >= 1 && (v === 1 || v === 2), `${pr.id}: nota mal formada`);
        assert.ok(Math.abs(t) <= 24, `${pr.id}: pad ${i} transpuesto ${t} semitonos`);
        assert.ok(ok.has((root + t) % 12), `${pr.id}: pad ${i}, paso ${st}: ${NN[(root + t) % 12]} fuera de escala`);
      }
    }
    // llegan al banco y el secuenciador las toca (y no los golpes de esos pads)
    const b = H.Banks.fromPreset(H.Banks.defaultState(), pr);
    assert.equal(b.seq.melodic.join(), pr.melodic.join());
    assert.equal(b.seq.scale.mode, pr.scale.mode);
    assert.ok(b.seq.patterns.filter((p) => H.Patterns.hasMel(p)).length >= 2, 'al menos dos patrones traen notas');
  }
});
