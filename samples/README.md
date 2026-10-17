# Samples originales de Harmony

Sonidos hechos para Harmony por síntesis y procesado digital (`tools/samples/`), sin grabaciones de personas ni samples de terceros.
Cada pack es una carpeta; su receta está en `tools/samples/packs/<pack>.mjs` y sus metadatos, en `js/data/samples.js`.

| Pack | Contenido | Licencia |
|---|---|---|
| `harmony-01` | 41 sonidos: kicks de hardcore, newstyle y uptempo, palmas y cajas, percusión y redobles, impactos, transiciones, subidas y efectos | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/deed.es): dominio público, uso libre (también comercial) sin atribución |
| `harmony-02` | 40 voces: frases de MC en inglés y en castellano, gritos, efectos de voz (megáfono, radio, demonio, vocoder…) y coros. Voz de base de las frases: eSpeak NG (sintetizador de voz libre, GPL-3.0); coros por síntesis de formantes | CC0 1.0, igual que el anterior |
| `harmony-03` | 39 sonidos: bucles melódicos por kits (hardstyle, hardcore, uptempo, mákina, newstyle, techno, hard trance) que duran compases exactos, notas sueltas y efectos de 8 bits. Melodías compuestas para Harmony | CC0 1.0 |
| `harmony-04` | 30 bucles melódicos más en ocho kits (mákina II y III, hardcore II, newstyle II, uptempo II, hardstyle II, happy hardcore, hard trance II). Melodías compuestas para Harmony | CC0 1.0 |

Formato: WAV PCM de 16 bits a 44,1 kHz, mono (kicks, cajas, bajos, radio, 8 bits) o estéreo (efectos, espacios, voces, melodías), pico real máximo −1 dBTP. Los bucles duran compases exactos a su tempo y empalman consigo mismos.
Para reconstruirlos: `node tools/samples/build.mjs` (las tomas de voz ya están en `tools/samples/voices/src/`; solo hace falta eSpeak NG para cambiarlas, con `node tools/samples/voices/make.mjs`) (determinista: la misma receta da los mismos archivos). Las medidas de cada uno están en `tools/samples/report.md`.
