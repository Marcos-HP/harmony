// HARMONY · empaqueta index.html en un único archivo, sin dependencias.
//   node build.mjs  →  dist/index.html (documento completo, ábrelo con doble clic)
//                      dist/artifact.html (fragmento para publicar como artefacto de Claude)
//                      dist/art/          (diseño real de los discos que bajó el importador, si lo hay)
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, cpSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(root, 'index.html'), 'utf8');
const block = (name) => {
  const m = src.match(new RegExp(`<!--build:${name}-->([\\s\\S]*?)<!--/build:${name}-->`));
  if (!m) throw new Error('Falta el bloque ' + name);
  return m[1];
};
const files = (html, re) => [...html.matchAll(re)].map((m) => m[1]);
const css = files(block('css'), /href="([^"]+)"/g).map((f) => `/* ${f} */\n` + readFileSync(join(root, f), 'utf8')).join('\n');
const js = files(block('js'), /src="([^"]+)"/g).map((f) => `/* ${f} */\n` + readFileSync(join(root, f), 'utf8')).join('\n');
const safeJs = js.replace(/<\/script/gi, '<\\/script');

const head = src.slice(src.indexOf('<title>'), src.indexOf('<!--build:css-->')).trim();
const full = src
  .replace(block('css'), `\n<style>\n${css}\n</style>\n`)
  .replace(block('js'), `\n<script>\n${safeJs}\n</script>\n`)
  .replace(/<!--\/?build:(css|js)-->/g, '');

const fragment = `${head}\n<script>window.HMY_EMBED = 'claude-artifact';</script>\n<style>\n${css}\n</style>\n<noscript><p style="padding:24px;font-family:monospace">Harmony necesita JavaScript para funcionar.</p></noscript>\n<script>\n${safeJs}\n</script>\n`;

mkdirSync(join(root, 'dist'), { recursive: true });
writeFileSync(join(root, 'dist/index.html'), full);
writeFileSync(join(root, 'dist/artifact.html'), fragment);
console.log('dist/index.html', (full.length / 1024).toFixed(1) + ' KB');
console.log('dist/artifact.html', (fragment.length / 1024).toFixed(1) + ' KB');

// Las imágenes van aparte, con la misma ruta relativa (art/…): la web publicada no puede pedirlas a otro servidor.
rmSync(join(root, 'dist/art'), { recursive: true, force: true });
if (existsSync(join(root, 'art'))) {
  cpSync(join(root, 'art'), join(root, 'dist/art'), { recursive: true });
  console.log('dist/art', readdirSync(join(root, 'dist/art')).length + ' imágenes');
}
