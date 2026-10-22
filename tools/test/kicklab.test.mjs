// node --test tools/test/kicklab.test.mjs
// Laboratorio de kicks: el worker, montado como lo monta el build (dsp.js y hard.js copiados de tools/samples), da un kick
// afinado en la nota pedida, sin valores raros y a −1 dBTP, tanto duro como de frenchcore.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ROOT = new URL('../../', import.meta.url).pathname;
const BASE = { type: 'hard', note: 'D2', len: 300, semis: 34, drop: 130, saw: 0.3, refl: 0.35, mids: 11, res: 4, drive1: 11, drive2: 5, low: 0.45, scoop: -2, move: 'down', tok: 0.8, tick: 0.5, ott: 0.45, seed: 11, bpm: 200, at: 70, per: 3, decay: 0.6 };

async function worker() {
  const dir = mkdtempSync(join(tmpdir(), 'kick-'));
  writeFileSync(join(dir, 'package.json'), '{"type":"module"}');
  writeFileSync(join(dir, 'dsp.js'), readFileSync(join(ROOT, 'tools/samples/dsp.mjs'), 'utf8'));
  writeFileSync(join(dir, 'hard.js'), readFileSync(join(ROOT, 'tools/samples/hard.mjs'), 'utf8').replace("from './dsp.mjs'", "from './dsp.js'"));
  writeFileSync(join(dir, 'worker.js'), readFileSync(join(ROOT, 'workers/kick/worker.js'), 'utf8'));
  const out = [];
  globalThis.self = { postMessage: (m) => out.push(m) };
  await import(join(dir, 'worker.js'));
  const run = (p) => { out.length = 0; globalThis.self.onmessage({ data: { id: 1, p } }); return out[0]; };
  return run;
}

test('kick duro, de frenchcore y en otra nota: afinados, sin NaN y a −1 dBTP', async () => {
  const run = await worker();
  for (const [p, want] of [[BASE, 'D2'], [{ ...BASE, type: 'french' }, 'D2'], [{ ...BASE, note: 'F2', move: 'up' }, 'F2'], [{ ...BASE, move: 'wobble', note: 'C2' }, 'C2']]) {
    const m = run(p);
    assert.ok(!m.error, m.error);
    assert.ok(m.L.length > 4000 && m.L.every(Number.isFinite) && m.R.every(Number.isFinite));
    const semis = Math.abs(12 * Math.log2(m.hz / (want === 'D2' ? 73.42 : want === 'F2' ? 87.31 : 65.41)));
    assert.ok(semis <= 1.05, `${p.type}/${p.note}/${p.move}: cola en ${m.note} (${m.hz.toFixed(1)} Hz), pedida en ${want}`);
    assert.ok(m.peakDb <= -0.9 && m.peakDb >= -1.2, 'pico real a −1 dBTP');
  }
  delete globalThis.self;
});
