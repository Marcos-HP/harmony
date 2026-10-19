// node --test tools/test/stems.test.mjs
// Extractor: el worker y su librería enlazan bien (un import roto deja el worker sin arrancar, sin más aviso),
// y el WAV que sale de un trozo es correcto (cabecera, largo, mezcla y fundidos sin clic).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const ROOT = new URL('../../', import.meta.url).pathname;

test('el worker de separación carga sus módulos (imports y exports que cuadran)', async () => {
  const posted = [];
  globalThis.self = { postMessage: (m) => posted.push(m) };
  await import(ROOT + 'workers/demucs/worker.js');
  assert.equal(typeof globalThis.self.onmessage, 'function');
  const { CONSTANTS } = await import(ROOT + 'workers/demucs/constants.js');
  assert.match(CONSTANTS.DEFAULT_MODEL_URL, /^https:\/\/huggingface\.co\//);
  assert.deepEqual(CONSTANTS.TRACKS, ['drums', 'bass', 'other', 'vocals']);
  delete globalThis.self;
});

function load() {
  const ctx = { window: { H: {} }, location: { protocol: 'https:', href: 'https://x/' }, document: {}, navigator: {}, Blob };
  ctx.window.window = ctx.window;
  vm.createContext(ctx);
  vm.runInContext(readFileSync(ROOT + 'js/lib/stems.js', 'utf8'), ctx);
  return ctx.window.H.Stems;
}
const fakeBuf = (L, R, rate = 1000) => ({ sampleRate: rate, length: L.length, numberOfChannels: 2, duration: L.length / rate, getChannelData: (c) => (c ? R : L) });

test('WAV de un trozo: cabecera, largo, mezcla con ganancias y fundidos', async () => {
  const S = load();
  const n = 1000, a = fakeBuf(new Float32Array(n).fill(0.5), new Float32Array(n).fill(-0.5)), b = fakeBuf(new Float32Array(n).fill(0.25), new Float32Array(n).fill(0.25));
  const blob = S.wav([a, b], 0.2, 0.7, [1, 1]);   // 500 muestras a 1 kHz
  const buf = Buffer.from(await blob.arrayBuffer()), dv = new DataView(buf.buffer, buf.byteOffset);
  assert.equal(buf.slice(0, 4).toString(), 'RIFF'); assert.equal(buf.slice(8, 12).toString(), 'WAVE');
  assert.equal(dv.getUint16(22, true), 2, 'estéreo'); assert.equal(dv.getUint32(24, true), 1000);
  assert.equal(dv.getUint32(40, true), 500 * 4, 'largo del trozo');
  const s = (i, c) => dv.getInt16(44 + i * 4 + c * 2, true) / 32767;
  assert.ok(Math.abs(s(250, 0) - 0.75) < 0.001, 'izquierda: 0,5 + 0,25');
  assert.ok(Math.abs(s(250, 1) + 0.25) < 0.001, 'derecha: −0,5 + 0,25');
  assert.equal(s(0, 0), 0, 'empieza en silencio (fundido)'); assert.ok(Math.abs(s(499, 0)) < 0.2, 'acaba fundido');
  const peaks = S.peaks(a, 10);
  assert.equal(peaks.length, 10); assert.ok(peaks.every((v) => Math.abs(v - 0.5) < 1e-6));
});
