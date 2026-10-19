/* HARMONY · Extractor: separación de una canción en batería, bajo, resto y voz (HTDemucs de Meta, licencia MIT)
   Corre en un worker para que la página no se congele mientras separa. Todo pasa en el navegador: la canción no sale
   del equipo. Lo único que se descarga, la primera vez, es el motor (ONNX Runtime Web, de jsDelivr) y el modelo
   (unos 172 MB, de Hugging Face); el modelo se guarda en la caché del navegador para las siguientes veces.
   Mensajes:
     → { type: 'init' }                                   ← stage (cached | download | engine | compile), download, ready
     → { type: 'separate', left, right } (44,1 kHz)       ← progress, done { stems: { drums, bass, other, vocals } }
     → { type: 'forget' }                                 ← forgotten (borra el modelo de la caché)
     ← { type: 'error', where, message } */
import { DemucsProcessor } from './processor.js';
import { CONSTANTS } from './constants.js';

const ORT_BASE = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.21.0/dist/';
const MODEL_URL = CONSTANTS.DEFAULT_MODEL_URL;
const CACHE = 'harmony-modelos-v1';
let proc = null, backend = null, initP = null;
const post = (m, t) => self.postMessage(m, t || []);

async function openCache() { try { return await caches.open(CACHE); } catch (e) { return null; } }

async function modelBytes() {
  const cache = await openCache();
  if (cache) {
    const hit = await cache.match(MODEL_URL);
    if (hit) { post({ type: 'stage', stage: 'cached' }); return hit.arrayBuffer(); }
  }
  post({ type: 'stage', stage: 'download' });
  const res = await fetch(MODEL_URL);
  if (!res.ok) throw Object.assign(new Error('HTTP ' + res.status), { where: 'download' });
  const total = +res.headers.get('Content-Length') || 0, chunks = [];
  let got = 0, last = 0;
  if (res.body && res.body.getReader) {
    const rd = res.body.getReader();
    for (;;) {
      const { done, value } = await rd.read();
      if (done) break;
      chunks.push(value); got += value.length;
      const now = Date.now();
      if (now - last > 200) { last = now; post({ type: 'download', loaded: got, total }); }
    }
  } else chunks.push(new Uint8Array(await res.arrayBuffer()));
  const blob = new Blob(chunks, { type: 'application/octet-stream' });
  post({ type: 'download', loaded: blob.size, total: total || blob.size });
  // a la caché, para no volver a bajarlo (si no hay sitio, se usa igual y la próxima vez se baja de nuevo)
  if (cache) { try { await cache.put(MODEL_URL, new Response(blob, { headers: { 'Content-Type': 'application/octet-stream' } })); } catch (e) { post({ type: 'nocache' }); } }
  return blob.arrayBuffer();
}

async function init() {
  post({ type: 'stage', stage: 'engine' });
  let ort;
  try { ort = await import(ORT_BASE + 'ort.all.mjs'); }
  catch (e) { throw Object.assign(new Error(e.message || 'import'), { where: 'engine' }); }
  ort.env.wasm.wasmPaths = ORT_BASE;
  // sin aislamiento entre orígenes (GitHub Pages no deja ponerlo) el procesador va con un solo hilo
  ort.env.wasm.numThreads = self.crossOriginIsolated ? Math.min(8, navigator.hardwareConcurrency || 4) : 1;
  let gpu = false;
  if (navigator.gpu) { try { gpu = !!(await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' })); } catch (e) { gpu = false; } }
  backend = gpu ? 'webgpu' : 'wasm';
  const bytes = await modelBytes();
  post({ type: 'stage', stage: 'compile', backend });
  proc = new DemucsProcessor({
    ort,
    sessionOptions: { executionProviders: gpu ? ['webgpu', 'wasm'] : ['wasm'], graphOptimizationLevel: 'basic' },
    onProgress: (p) => post({ type: 'progress', progress: p.progress, segment: p.currentSegment, segments: p.totalSegments })
  });
  try { await proc.loadModel(bytes); }
  catch (e) { throw Object.assign(new Error(e.message || 'modelo'), { where: 'compile' }); }
  post({ type: 'ready', backend });
}

self.onmessage = async (ev) => {
  const m = ev.data || {};
  try {
    if (m.type === 'init') {
      if (!initP) initP = init().catch((e) => { initP = null; throw e; });
      await initP;
    } else if (m.type === 'separate') {
      if (!initP) initP = init();
      await initP;
      const r = await proc.separate(m.left, m.right);
      const stems = { drums: r.drums, bass: r.bass, other: r.other, vocals: r.vocals };
      post({ type: 'done', stems }, Object.values(stems).flatMap((s) => [s.left.buffer, s.right.buffer]));
    } else if (m.type === 'forget') {
      const cache = await openCache();
      if (cache) await cache.delete(MODEL_URL);
      post({ type: 'forgotten' });
    } else if (m.type === 'cached') {
      const cache = await openCache();
      post({ type: 'cached', value: !!(cache && (await cache.match(MODEL_URL))) });
    }
  } catch (e) {
    post({ type: 'error', where: e.where || (m.type === 'separate' ? 'separate' : 'init'), message: String((e && e.message) || e) });
  }
};
