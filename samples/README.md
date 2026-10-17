# Samples originales de Harmony

Sonidos hechos para Harmony por síntesis y procesado digital (`tools/samples/`), sin grabaciones ni samples de terceros.
Cada pack es una carpeta; su receta está en `tools/samples/packs/<pack>.mjs` y sus metadatos, en `js/data/samples.js`.

| Pack | Contenido | Licencia |
|---|---|---|
| `harmony-01` | 41 sonidos: kicks de hardcore, newstyle y uptempo, palmas y cajas, percusión y redobles, impactos, transiciones, subidas y efectos | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/deed.es): dominio público, uso libre (también comercial) sin atribución |

Formato: WAV PCM de 16 bits a 44,1 kHz, mono (kicks, cajas, bajos) o estéreo (efectos, espacios), pico real máximo −1 dBTP.
Para reconstruirlos: `node tools/samples/build.mjs` (determinista: la misma receta da los mismos archivos). Las medidas de cada uno están en `tools/samples/report.md`.
