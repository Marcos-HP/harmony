# Harmony

Archivo interactivo de música electrónica dura: hardcore, hardstyle, hard house, hard trance, techno, mákina y newstyle. HTML + CSS + JS sin backend ni dependencias (solo tipografías de Google Fonts: Archivo, Newsreader e IBM Plex Mono). Node 18+ solo para el build, el importador y los tests.

Edición 0.4 · 17-10-2026 · Biblioteca, Mixer y Soundpad con secuenciador; fases 1 y 2 funcionando; fase 3 con MusicBrainz (diseño real de 57 discos), muestras de Deezer y Discogs como segunda fuente.

## Cómo abrirlo
- `dist/index.html`: todo en un único archivo. Doble clic y listo. Si existe `dist/art/`, debe ir junto a él.
- `index.html`: versión de desarrollo con los archivos separados (también funciona abriéndola directamente).
- `npm run build` (o `node build.mjs`) regenera `dist/index.html`, `dist/artifact.html` (fragmento para publicar como artefacto de Claude) y copia `art/` a `dist/art/`.

## Importar desde MusicBrainz
```
node tools/mb-import.mjs --contact https://github.com/tu-usuario   # todo el catálogo (unos minutos la primera vez)
node tools/mb-import.mjs --only poing,mentasm         # solo esos registros; el resto se conserva
node tools/mb-import.mjs --refresh                    # ignora la caché
node tools/mb-import.mjs --offline                    # solo caché, sin red
node tools/mb-import.mjs --no-art                     # sin descargar imágenes
node build.mjs                                        # vuelve a empaquetar dist/
```
`--contact` (o la variable `HARMONY_CONTACT`) va en el User-Agent: MusicBrainz pide una forma de contacto (correo o URL) y limita más a los clientes anónimos. No hace falta cuenta.

**Qué hace, por registro**
1. Busca la grabación (temas) o el grupo de lanzamientos (EP, álbumes, recopilatorios, lanzamientos) por título y artista, con una segunda búsqueda más laxa si la primera no da nada.
2. Puntúa candidatos: título (normalizado, ignora «Original Mix» y variantes de puntuación), artista principal (acepta alias como «DJ Paul Elstak») y si es una versión (remix, edit, radio, live, VIP…). Entre los válidos, la grabación más antigua.
3. Elige la **edición original**: la más antigua que no sea recopilatorio, sesión de DJ, mixtape, directo, remezclas, emisión, banda sonora, bootleg ni «Various Artists», y que esté acreditada al artista. A igual año, la del sello que ya figura en el archivo (la original suele ser esa y no una licencia extranjera); después, oficial, single/EP y vinilo.
   - Si el tema solo aparece en recopilatorios, prueba con otras grabaciones del mismo tema y luego busca su single o EP (también títulos dobles, «A / B»).
   - Si la edición encontrada es posterior a la primera aparición del tema, o su año se aleja más de dos del archivo, no se aplica: queda para revisar.
4. Consulta ese lanzamiento: sello, n.º de catálogo, formato, país, fecha y enlaces directos de MusicBrainz (Discogs, Spotify, YouTube, Bandcamp, Beatport…), dando prioridad al enlace del tema sobre el del lanzamiento.
5. **Diseño real del disco**: si el lanzamiento tiene imágenes en Cover Art Archive, elige la portada (Front) y la foto de la galleta del vinilo (Medium; si hay varias, la de la cara A o la etiqueta) y, al final, las descarga a `art/` en 500 px.
6. **Si el original no es un vinilo** (CD, digital…), busca la primera edición en vinilo del mismo tema que no sea recopilatorio, sesión, remezclas ni bootleg, y trae también su portada y su galleta.

Una petición por segundo como máximo, reintentos con espera si el servidor responde 503 o 429, y caché en `tools/cache/`: repetir la importación no vuelve a pedir nada, y las imágenes que ya están en `art/` no se vuelven a bajar.

**Salidas**
- `js/data/mb.js`: capa de datos contrastados, separada del catálogo editorial. La web la fusiona al arrancar.
- `art/`: portadas y galletas reales (`<mbid del lanzamiento>-<id de la imagen>.jpg`).
- `tools/mb-report.md`: resumen, cambios respecto a lo editorial, lo que hay que revisar (con el MBID listo para fijarlo), lo que no se encontró y qué imágenes tiene cada lanzamiento.

**Qué se aplica**
- Solo los emparejados de confianza **alta** (título exacto, artista principal, sin versión) o fijados a mano. Los de confianza media o baja quedan en el informe y no tocan la web.
- Si el dato editorial no estaba contrastado, MusicBrainz lo sustituye y la ficha lo marca «Contrastado · MusicBrainz».
- Si ya estaba contrastado (con Wikipedia) y coincide, la ficha dice «Wikipedia y MusicBrainz». Si no coincide, **se mantiene** y la ficha muestra «Fuentes en desacuerdo» con los dos valores.
- Los sellos se reutilizan aunque el nombre varíe un poco («Downwards» ≈ «Downwards Records»); si no existen, se crean.
- BPM: MusicBrainz no tiene tempo.
- «Original» significa lo que MusicBrainz da como original. Cuando el CD y el vinilo son del mismo año, la ficha lo dice: no sabemos cuál salió antes.

**Corregir un emparejado** (en `js/data/catalog.js`, dentro de `T(...)`, y luego `--only <id>`):
```js
mb: { recording: '<mbid>' }        // usar esa grabación
mb: { release: '<mbid>' }          // usar ese lanzamiento como edición original
mb: { releaseGroup: '<mbid>' }     // EP, álbum o recopilatorio
mb: { title: '…', artist: '…' }   // buscar con otros términos
mb: { skip: true }                 // no buscarlo
```

**Tests**: `npm test` (74, incluidos los importadores de Deezer y Discogs contra servidores falsos, el modelo de bancos del Soundpad, el secuenciador con un reloj de audio falso y los packs de sonidos). Prueban normalización, emparejado, elección de edición, resumen, Cover Art Archive (elección de portada y galleta, descargas, `--no-art`), caché, reintentos, `--only`, `--offline`, el ritmo de peticiones, la fusión en la web, la coherencia de la capa importada de verdad (imágenes locales, galleta solo con vinilo), los desacuerdos entre fuentes editoriales y la integridad del catálogo (fuentes, artistas, sellos, rutas). El servidor falso tiene la forma real de las respuestas de la API; todos sus datos son inventados y nunca llegan al catálogo.

### Primera importación real (13-10-2026)
- **81 aplicados**, 13 para revisar y 8 sin encontrar, de 102. Formato del original según MusicBrainz: 32 vinilo, 18 CD, 29 digital y 2 otros.
- **Diseño real**: 57 portadas del original en color, más 2 discos (Amsterdam waar lech dat dan? y Stars) cuyo original en CD no tiene imagen y se ven con la funda de su edición en vinilo; 14 galletas del vinilo original y 4 de su edición en vinilo; 5 fundas de edición en vinilo junto a un original en CD o digital. 80 imágenes, 5,7 MB. Los otros 22 aplicados no tienen imágenes en Cover Art Archive y siguen con la funda generativa.
- **Para revisar** (solo en recopilatorios, o edición posterior / año que no cuadra): X, Higher State of Consciousness, To the Limit, Life Is Too Short, Make It Loud, Frozen Flame, Fight the Resistance, Enter the Time Machine, Extres, Boom Dem, The Drabel, Oh Break y Other Side.
- **Sin encontrar**: Impact, Time Is Up… Later!!!, Look at This, Pildo, Pont Aeri Vol. 3, Elements, Reaching Dreams y Sweet Revenge. Mucha mákina y newstyle no está en MusicBrainz; Discogs sería la segunda fuente.
- **Desacuerdos** que la ficha muestra con los dos valores: 14 (p. ej. Dominator: R&S según Wikipedia, 80 Aum según MusicBrainz; Into Deep: Titanic 2006 en vinilo frente a Aqualoop 2007 en digital).
- Emparejados fijados a mano en el catálogo: Surgeon EP, The Outside Agency EP, Not Intelligent, Three Wasted Souls y Flying Free.

## Muestras de 30 s de Deezer
```
node tools/dz-import.mjs --contact https://github.com/tu-usuario   # todo el catálogo
node tools/dz-import.mjs --only poing,mentasm                      # solo esos registros
node tools/dz-import.mjs --no-isrc                                 # sin comprobar ISRC en MusicBrainz
node build.mjs
```
También en GitHub, sin tu ordenador: Actions → *Importar muestras de Deezer* → Run workflow, con los ids en «only» (vacío = todo). Sube `dz.js` y el informe a la rama; después hay que relanzar *Publicar en GitHub Pages*.

Anonim en Deezer (reediciones digitales de DJ's At Work): suenan *Anonim* (con *Infinity*, el remix de DJ Konik de la cara B), *Vol. 2* y *Vol. 3*, este con el *Over Out Radio Edit* porque el *Vocal Mix* no está disponible en España. *Anonim 4* y *5* no están.

La API pública de Deezer no pide clave. El importador busca cada registro y guarda **solo el identificador** del tema en `js/data/dz.js`; nunca audio ni la URL de la muestra, que caduca a los pocos minutos. Al darle a play, la web pide la URL fresca a Deezer (JSONP, porque su API no admite otra cosa desde el navegador), descarga la muestra (su servidor la sirve con CORS) y la pasa al motor como si fuera un archivo: pitch de vinilo, ecualizador, filtro, BPM medido y forma de onda. Vive solo en la memoria de la pestaña.

**Qué se aplica**
- **Verificada**: el ISRC del tema de Deezer coincide con uno de la grabación de MusicBrainz. Es la misma grabación.
- **Alta**: mismo título y artista principal, sin remezclas y fuera de sesiones mezcladas. Una versión extendida, de radio o remasterizada vale, porque es la misma producción. Si solo está en un recopilatorio, se usa y la ficha lo dice.
- **Fijada a mano** en el catálogo: `dz: { track: 123456 }` (el número de deezer.com/track/…), `dz: { q: '…' }` para buscar con otros términos o `dz: { skip: true }`.
- Lo demás queda en `tools/dz-report.md` para revisar.
- EP, álbumes y lanzamientos: el tema que se llame como el registro o, si no hay, el primer corte. La ficha lo indica.

**Condiciones de Deezer**: uso no comercial y privado, y prohibido guardar el audio. Harmony lo dice junto a cada muestra y en el pie. Con esas condiciones, Harmony no puede monetizarse tal cual.

**Primera importación (13-10-2026)**: 72 registros con muestra (21 verificadas por ISRC, entre ellas *Flying Free*), 10 para revisar (remezclas de otros o solo en sesiones mezcladas) y 20 sin encontrar. Fijadas a mano: *Flying Free* (del *Pont Aeri, Vol. 4*, que Deezer acredita a «Pont Aeri»), *Wonderfull Days* y *Blame It On The Muzic*. De la mákina suenan *Así me gusta a mí*, *Impact*, *Boom Dem*, *Time Is Up… Later!!!*, *Look at This* y *Flying Free*; el resto no está en Deezer o solo hay otras versiones.

Lo que no es la misma producción no se aplica: cualquier palabra entre paréntesis que no sea extendida, de radio, original, remasterizada o un subtítulo de himno cuenta como otra versión (*Dominator (Slim Shore Edit)* no es *Dominator*).

**Dónde suena**: en la web publicada (GitHub Pages) y en `dist/index.html` abierto en local. **No suena dentro del artefacto de Claude**: su política de seguridad no deja pedir audio ni scripts a otros sitios. Ahí la ficha lo explica y ofrece el pulso o un archivo propio.

## Discogs: segunda fuente
```
DISCOGS_TOKEN=xxxx node tools/dc-import.mjs                 # todo el catálogo
node tools/dc-import.mjs --token xxxx --only anonim-vol-3   # solo ese registro
node tools/dc-import.mjs --no-art                           # sin bajar portadas
```
En PowerShell: `$env:DISCOGS_TOKEN="xxxx"; node tools/dc-import.mjs`. El token es personal y gratis: discogs.com → Settings → Developers → *Generate new token*. Va en una cabecera, nunca en la URL: no acaba en la caché, ni en `dc.js`, ni en el informe.

**Sin tocar tu ordenador**: el flujo de GitHub Actions *Importar desde Discogs* (`.github/workflows/discogs.yml`) ejecuta el importador en GitHub y sube `dc.js`, el informe y las portadas a la misma rama. Se lanza a mano desde la pestaña Actions o solo, al cambiar el catálogo en una rama que no sea `main`. Para que también busque, guarda el token como secreto `DISCOGS_TOKEN` del repositorio.

Para lo que MusicBrainz casi no tiene: la mákina, el newstyle y lo que solo salió en vinilo en España. Para cada registro elige una edición, por este orden:
1. **Fijada a mano** en el catálogo: `dc: { release: 597824 }` (o `{ master: … }`, `{ q: '…' }`, `{ skip: true }`).
2. **La que enlaza MusicBrainz** desde el lanzamiento ya aplicado. No necesita token.
3. **Búsqueda** (necesita token): la más antigua del artista con el mismo título, en vinilo antes que en otro formato y nunca un recopilatorio. Solo se aplica con confianza alta; si da otro año que MusicBrainz, queda para revisar.

Escribe `js/data/dc.js` y `tools/dc-report.md`, y baja la imagen principal de cada edición a `art/dc-<id>.jpg`. La web lo fusiona después de MusicBrainz con la misma regla: lo editorial se sustituye y lo contrastado que no coincide se marca como desacuerdo. Además aporta:
- **Caras del disco**: los cortes con su posición y duración. Si Discogs asocia vídeos de YouTube a la edición, cada corte enlaza el suyo (con varias mezclas del mismo tema, decide la versión; un vídeo que no se puede atribuir a un corte no se enlaza).
- **Portada** cuando Cover Art Archive no la tiene, con el crédito a Discogs.
- Enlace directo a la edición en Discogs y, en un registro de tipo tema, al vídeo de su corte.

**Primera importación (16-10-2026, en GitHub Actions y sin token)**: 87 aplicados, 18 fijados a mano y 69 por el enlace de MusicBrainz; 39 portadas nuevas, donde Cover Art Archive no tenía. Fijadas tras comprobarlas en Discogs: la serie Anonim (del primero al Vol. 7), Extres, Ex-P-Cial (el vinilo español de 1995, no el CD mexicano que enlazaba MusicBrainz), Impact, Pildo, Pont Aeri Vol. 3, Elements, Other Side, Boom Dem, Time Is Up… Later!!! (en el maxi *Leire*), The Drabel, Oh Break, Look at This (en *Evolution*; la biografía del grupo habla de *Vol. 6* y la ficha muestra el desacuerdo) y Enter the Time Machine. De la mákina y el newstyle, 20 de 22 registros tienen ya portada real y caras del disco. Sin edición propia en Discogs (solo recopilatorios): Reaching Dreams y Sweet Revenge. Quedan 20 sin buscar hasta que haya token.

## Biblioteca original de sonidos
267 sonidos hechos para Harmony por **síntesis y procesado digital**, sin grabaciones de personas, sin samples de terceros y sin melodías de nadie, con licencia **CC0** (dominio público), en ocho packs: `samples/harmony-01/` (41, batería y efectos), `samples/harmony-02/` (40, voces), `samples/harmony-03/` (39, melodías y 8 bits), `samples/harmony-04/` (30, más melodías), `samples/harmony-05/` (42, escuelas del hardcore y del newstyle) , `samples/harmony-06/` (14, pitidos del newstyle) , `samples/harmony-07/` (36, oscuro y distorsionado) y `samples/harmony-08/` (25, himnos de uptempo y frenchcore). Los nombres van por escuela, nunca por artista. WAV de 16 bits a 44,1 kHz que la web sirve tal cual.

Lo que no entra: sonidos sacados de juegos, discos o películas (el «¡Yahoo!» de un personaje, por ejemplo) ni imitaciones de su voz o de su melodía. Son de quien los hizo. Si tienes los tuyos, cárgalos en un pad: se quedan en tu navegador.

### Harmony 01 · Hardcore, Newstyle y Uptempo

| Grupo | Sonidos |
|---|---|
| Kicks hardcore (6) | gabber (Fa 1), mainstream (Sol# 1), industrial (Re# 1), crunch, early hardcore, millennium (Mi 1) |
| Kicks newstyle (4) + bajo | punch, con cola, duro, jump; bajo de contratiempo (La 1, 150 BPM) |
| Kicks uptempo (5) | screech, raw, tok, zaag, drop |
| Palmas y cajas (6) | palma con sala, palma hardcore, caja seca, caja hardcore, caja y palma, aro |
| Percusión y redobles (7) | charles cerrado y abierto, golpe metálico, crash, redoble de caja (180), de kick (200) y de toms (180) |
| Impactos y transiciones (6) | impacto grave, impacto hardcore, sub drop, bajada, crash al revés, parada de cinta |
| Subidas y efectos (6) | subida de ruido y de superserra (2 compases a 180), sirena, láser, stab estilo hoover, trompeta de rave |

### Harmony 02 · Voces
| Grupo | Sonidos |
|---|---|
| MC en inglés (15) | «Hardcore!», «Uptempo!», «New style!», «Harmony», «Make some noise!», «Are you ready?», «Let's go!», «Come on!», «Louder!», «Hands up!», «Bass!», «Drop!», «Rotterdam!», cuenta atrás «Three, two, one!» y cuenta «One, two, three, four!» (a negras, 150 BPM) |
| MC en castellano (6) | «¡Vamos!», «¡Dale caña!», «¡Más fuerte!», «¡Manos arriba!», «¡Makina!», «¡Que suene!» |
| Gritos (7) | de grupo: «¡Hey!», «¡Oi!», «¡Yeah!», «¡Ho!» y «¡Hey! ¡Hey! ¡Hey!» (150 BPM); de alegría: «¡Yahoo!» y «¡Yujuu!» (voz propia, sin imitar a nadie) |
| Efectos de voz (7) | megáfono «Warning!», radio «This is Harmony», demonio, «Ha-ha-ha-hardcore» (180 BPM), robot con vocoder en Do menor, susurro, entrada inversa |
| Coros (5) | «Aah» en La menor, «Ooh» en Fa# menor, golpes vocales «Ah» (Do# 4) y «Ey» (Fa# 4), acorde «Oh» en Sol# menor con reverb cortada |

- **Frases y gritos**: la voz de base es **eSpeak NG 1.53**, un sintetizador de voz por formantes (software libre, GPL-3.0); no hay ninguna grabación de una persona. `tools/samples/voices/sources.mjs` dice qué frase, voz, tono y velocidad tiene cada toma; `node tools/samples/voices/make.mjs` (o `npm run voices`) las genera con eSpeak en `tools/samples/voices/src/` junto con `manifest.json` (versión del programa y parámetros). Las tomas se guardan en el repositorio, así que el pack se reconstruye igual sin tener eSpeak instalado. Cada frase lleva dos voces distintas con la misma duración (se ajusta la velocidad de la segunda), dobladas en estéreo; después limpieza, presencia, compresión, saturación, sala y ecos a tempo. La licencia del programa no pasa a lo que genera (así lo explica la FAQ de la GPL), y lo que hace Harmony con esas tomas se publica CC0 como el resto. Un matiz: algunas consonantes sordas de eSpeak salen de fragmentos de ruido muy cortos que vienen con el propio programa.
- **Coros**: síntesis por formantes de Harmony (`tools/samples/voice.mjs`), sin tomas de nadie: fuente glotal aditiva (armónicos sin aliasing, vibrato, pequeñas derivas de tono y algo de aire) por cinco filtros de formante por vocal, con los valores de referencia de soprano, contralto, tenor y bajo; varias voces por nota, cada una con su desafinación y su sitio en el estéreo.
- **Vocoder** de 24 bandas en `tools/samples/voice.mjs` (las sibilantes pasan aparte para que se entienda la palabra).

### Harmony 03 · Melodías y retro
Bucles melódicos compuestos para Harmony, agrupados en **kits**: las piezas de un kit comparten tonalidad y tempo y duran compases exactos, así que se apilan (todas en el paso 1 del secuenciador, o en pads en modo bucle) y suenan juntas. Un bucle de la biblioteca entra en el pad en modo bucle.

| Kit | Tempo · tonalidad · acordes | Bucles |
|---|---|---|
| Hardstyle | 150 · Fa menor · Fam – Re♭ – La♭ – Mi♭ (4 compases) | lead eufórico (supersierra con su octava), acordes con «sidechain», arpegio pluck, bajo inverso; aparte, lead raw (2 compases) |
| Hardcore | 180 · La menor · Lam – Fa – Sol – Mim (4) | riff hoover, piano sincopado, lead saturado; aparte, piano happy hardcore en Sol mayor |
| Uptempo | 200 · Do# menor · Do#m – La / Si (2) | melodía screech, golpes raw, acordes cortados |
| Mákina | 175 · Re menor · Rem – Si♭ – Do – La (4) | melodía de cuadrada y sierras, arpegio, bajo a contratiempo |
| Newstyle | 150 · Sol# menor · Sol#m – Mi / Fa# (2) | melodía pluck, acordes de órgano a contratiempo |
| Techno | 144 · Mi menor (2) | línea acid (acentos y ligados), acorde dub con eco, bajo rodante |
| Hard trance | 140 · La menor · Lam – Fa – Do – Sol (4) | pad, acordes cortados; aparte, caja de música (150) |

Las tonalidades de uptempo y newstyle son las de sus kicks en Harmony 01 (Do# y Sol#). Además: **8 notas sueltas** para tocar con el tono del pad (stabs menor y mayor, órgano de rave, pluck, piano, campana FM, sub, lead) y **8 efectos de 8 bits** originales (salto, recoger, mejora, disparo, explosión, fin de partida, menú, victoria), con pulsos de ancho fijo, triángulo y ruido de registro de 15 bits como las consolas de entonces.
- **Instrumentos** en `tools/samples/synth.mjs`: supersierra, pluck, hoover, screech, lead raw, órgano, piano por parciales, campana FM, sub, bajo inverso, acid (una voz con acentos y ligados) y chiptune; las notas se escriben a tempo (paso, duración, altura) y los bucles se tocan dos veces para quedarse con la segunda vuelta, que lleva dentro las colas de la primera: empalman sin hueco.
- **Comprobado**: duración exacta de cada bucle (validación del build) y, en las melodías, la nota que domina en cada nota de la partitura (así se vio que el hoover se comía las semicorcheas con su caída de tono y que el screech sonaba a la quinta; las dos cosas están corregidas).

### Harmony 04 · Más melodías
Ocho kits más, con el mismo motor y las mismas reglas que Harmony 03 (y más mákina).

| Kit | Tempo · tonalidad · acordes | Bucles |
|---|---|---|
| Mákina II | 178 · La menor · Lam – Fa – Sol – Mi (4 compases) | melodía de cuadrada en frases de 3 + 3 + 2, piano, bajo galopante, campanas, órgano a contratiempo |
| Mákina III | 172 · Mi menor · Mim – Do – Re – Si (4) | melodía de hoover, arpegio pluck, bajo a contratiempo, golpes de órgano |
| Hardcore II | 190 · Fa# menor · Fa#m – Re – La – Do# (4) | himno en supersierra, piano para el break, acordes cortados, arpegio |
| Newstyle II | 150 · Fa menor · Fam – Re♭ – Mi♭ – Do (4) | melodía a contratiempo, bajo, piano a contratiempo, campanas |
| Uptempo II | 210 · Re menor · Rem – Si♭ (2) | screech, riff raw, acordes cortados |
| Hardstyle II | 150 · Sol menor · Solm – Mi♭ – Si♭ – Fa (4) | lead eufórico, arpegio, bajo inverso, pad con «sidechain» |
| Happy hardcore | 175 · Re mayor · Re – La – Sim – Sol (4) | lead, piano a contratiempo, campanas |
| Hard trance II | 140 · Re menor · Rem – Si♭ – Fa – Do (4) | lead de notas largas, arpegio que cruza el compás, bajo rodante |

- **Comprobado**: duración exacta de cada bucle y, en las 9 melodías, la altura que domina en cada nota de la partitura (el pack exporta sus partituras y un test lo mide): 166 de 177 notas exactas; las demás se leen como su quinta u octava, por los armónicos de la supersierra saturada en notas cortas.

### Harmony 05 · Escuelas del hardcore y del newstyle
42 sonidos agrupados por escuela, cada una con su tempo y su tonalidad para que todo encaje (y para los presets de banco). Recrean los rasgos de cada estilo (tempo, tipo de kick, distorsión, timbre), no los temas de nadie.

| Escuela | Tempo · tonalidad | Qué hay |
|---|---|---|
| Rotterdam / early | 175 · Re menor | kick 909 saturado hasta que zumba (realce en 1 kHz), kick early corto, hoover de alarma, stab de rave (Re m7), palma 909, charles abierto, riff de hoover (2 compases), sirena que sube |
| Hardcore italiano | 172 · Fa# menor | kicks con cola larga afinada (Fa# 1 y La 1), golpe de coro, lead épico (Fa#m – Re – Mi – Do#, 4 compases), cuerdas oscuras, redoble, kick al revés |
| Mainstream oscuro | 178 · Mi frigio | kick con chillido (Mi 1), kick rumble (Fa 1), chillido, campana de terror, drone, impacto, riff oscuro (2), golpe industrial |
| Mainstream melódico | 174 · La menor | kicks con cola tonal en La y Do (para seguir los acordes), lead eufórico (Lam – Fa – Do – Sol), piano, coro, arpegio |
| Raw / uptempo | 205 · Re menor | kick raw plegado, kick que sube, kick con ruido, grito de ruido, melodía de kicks (2), acorde raw |
| Newstyle | 150 · La menor | kick seco, kick «tok», bajo a contratiempo (golpe y bucle La – Fa – Sol – Mi), palma con sala, charles, golpe de órgano |

- **Comprobado**: la nota de la cola de cada kick (las de los kicks raw salen hasta un semitono por debajo de la anunciada por el plegado; se deja como aviso), duración exacta de los bucles y la altura de cada nota de los dos leads.

### Harmony 06 · Pitidos del newstyle
El pitido es un tono agudo casi puro. El timbre sale de **medir una referencia** que pasó el usuario (espectrograma y seguimiento de altura). Esa referencia no está en el repositorio, y de ella solo se han sacado medidas. Las mediciones:
- **Registro y timbre:** va de 1 a 1,9 kHz, con los armónicos 2.º y 3.º a −15 dB y el 4.º a −18 dB.
- **Afinación:** sin vibrato, con un portamento de 20 a 40 ms entre notas ligadas y arcos de pitch bend en el break.
- **Octava:** a veces va doblado una octava por debajo.

El pack trae 6 bucles a 175 BPM en La menor, con melodías de Harmony:
- melodía ligada con glide;
- melodía picada con su octava;
- la misma con un «sidechain» fuerte para el drop;
- pregunta y respuesta con bends;
- golpes a contratiempo;
- un break de notas largas.

Además hay 8 sueltos:
- notas en La 5 y Mi 6, y en La con su octava;
- un pitido que sube y otro que cae;
- un arco y un silbato;
- un trino.

Hecho por síntesis aditiva. **Comprobado**: los armónicos del sonido final coinciden con los medidos, y las notas de los tres bucles melódicos están a su altura.

### Harmony 07 · Oscuro y distorsionado
36 sonidos en dos familias, para ir más allá de las escuelas de Harmony 05.

| Familia | Tempo · tonalidad | Qué hay |
|---|---|---|
| Hardcore oscuro / industrial | 170 · Fa menor (frigio) | kick largo que gruñe (Fa 1), kick con golpe de metal (Sol# 1), kick sordo para medio tiempo, palma oscura, caja industrial a 8 bits, charles de chatarra, tubo de metal, portazo de fábrica, drone, coro grave «oh», golpe disonante (segunda menor), campana de iglesia con tercera menor, órgano siniestro (4 compases), riff oscuro (2), bajo rumble a contratiempo (4), subida de ruido, chillido de terror y latido |
| Uptempo distorsionado | 210 · Re menor | kick zaag (una sierra en la cola, plegado), kick que chilla, kick triturado (6 bits), kick tok rodante, kick con bajo inverso, palma, redoble raw, charles roto, screech triturado (2), golpes de lead raw con bends (2), melodía de kicks rodante (2), acordes cortados Rem – Do – Sib – La (4), sirena raw, grito, impacto, subida plegada, tartamudeo de kick y láser |

El uptempo va a 210 y en Re menor, como el kit Uptempo II de Harmony 04, para que se mezclen. **Comprobado**: notas de los kicks, duración de los bucles y la altura de cada nota del órgano y del screech.

### Harmony 08 · Himnos: uptempo y frenchcore
25 sonidos a 200 BPM en Re menor sobre Rem – Si♭ – Fa – Do (i – VI – III – VII), hechos con un motor de kicks nuevo, `tools/samples/hard.mjs`. Ese motor sigue cómo diseñan los kicks los productores de uptempo y frenchcore ([musicproductionwiki](https://musicproductionwiki.com/articles/how-to-recreate-the-hardstyle-kick), [idmforums](https://idmforums.com/t/tutorial-for-creating-uptempo-and-frenchcore-type-kicks/7795), [screechhouse](https://screechhouse.com/raw-kick-tutorial-how-to-make-hardstyle-rawstyle-hardcore-kicks-in-fl-studio-kick-layering/)):
1. La fuente es un bajo sostenido (seno y algo de sierra) que cae desde Do 5 hasta la nota en unos 130 ms.
2. Reflexiones tempranas antes de distorsionar.
3. Antes de cada una de las dos distorsiones se realzan los medios y una banda resonante.
4. Después se suben los graves, se recorta en 300 Hz, se añaden agudos y se pasa por un *soft clip*.
5. La cola se mueve: la banda resonante y un filtro cambian a lo largo del golpe (se cierra, se abre o va y viene).
6. El tok y el tick van limpios y aparte, los graves en mono por debajo de 180 Hz y hay compresión tipo OTT.
7. Frenchcore: un trozo pegado al ataque, de un número entero de ciclos de la nota, se repite unas tres veces por negra.

- **Kicks de uptempo afinados a cada acorde** (Re, Si♭, Fa, Do), y dos variantes en Re, una que se abre y una con vaivén. Así el kick sigue la armonía.
- **Frenchcore**: el kick con su cola zumbona y el bajo distorsionado a contratiempo en las cuatro notas.
- **Bucles de 4 compases**: el lead del himno, acordes, coro que sigue los acordes, piano, arpegio, cuerdas en staccato y chops de voz.
  - El lead es una melodía de Harmony en frases de 3 + 3 + 2. Lleva siete sierras que entran desde abajo, formantes, dos distorsiones, vibrato tardío, su octava y un screech debajo.
- **Percusión y efectos**: palma, charles, redoble, redoble de kick, subida, impacto y plato al revés.
- **Comprobado**: las notas de todos los kicks y bajos y la altura de cada nota del gancho. Además, el reparto de graves, medios y agudos se ha comparado con el del preset Uptempo distorsionado. En la primera versión el himno tenía 6 dB menos de medios; se corrigió en el kick y en el lead.

### Kicks de hardcore rehechos (22-10-2026)
Los 23 kicks de hardcore, gabber, early, italiano, mainstream, industrial y newstyle de Harmony 01, 05 y 07 se han rehecho con el motor de hardcore del Laboratorio de kicks (`hcKick` en `tools/samples/hard.mjs`, recetas en `js/data/kicks.js`). Antes eran casi un seno saturado y no sonaban duros. Ahora tienen la cola casi cuadrada, grano en los medios, la nota sola abajo y el final limpio, como los kicks de referencia (ver *Laboratorio de kicks*).
- **No cambian** el id, el nombre ni la nota, así que los presets que los usan suenan mejor sin desafinarse. El *Kick industrial con metal* conserva su golpe de tubo encima.
- **Los de uptempo y raw** (Harmony 01 `ut-*`, 05 `rw-*`, 07 `ud-*` y 08) no se tocan.
- Las versiones anteriores siguen en el historial de git.

### Cómo se hacen y se validan
- **Cómo se hacen**: `tools/samples/dsp.mjs` (osciladores sin aliasing, ruido con semilla, filtros barridos, saturación, limitador, reverb, WAV con dither) y una receta por sonido en `tools/samples/packs/<pack>.mjs`. `node tools/samples/build.mjs` (o `npm run samples`) los construye, los valida y escribe `js/data/samples.js` y `tools/samples/report.md`. Es determinista: la misma receta da el mismo audio, y un test lo comprueba.
- **Validación** (lo que no la pasa no se escribe): sin muestras recortadas, pico real ≤ −0,8 dBTP (normalizados a −1 dBTP con sobremuestreo ×4), sin continua ni infrasonidos, principio y final sin clic, duración razonable, y en los kicks y bajos, la nota medida en la cola (FFT de 65 536 puntos) igual a la anunciada. Además se revisaron forma de onda y espectrograma de todos (así se encontraron y corrigieron capas cortadas en seco, colas de kick que acababan de golpe y, en los coros, aliasing de la primera fuente glotal y falta de agudos) y se comparó su parecido espectral para no meter variantes casi iguales. **No se han escuchado**: este entorno no tiene salida de audio; la validación es técnica y visual. Con las voces es donde más falta hace escucharlas: lo que no se puede medir es si cada frase se entiende bien.
- **Metadatos** de cada sonido: id estable (`harmony-01/hc-kick-gabber`), nombre, categoría del Soundpad, estilo, tipo, etiquetas, nota, tempo, duración, canales, ruta, cómo se hizo y el pico y RMS medidos; el pack lleva la licencia y la procedencia.
- **Más packs**: un archivo más en `tools/samples/packs/` y volver a construir. La web los lista sola.

## Secciones: Biblioteca · Mixer · Soundpad
La cabecera tiene tres secciones. Cambiar de una a otra no recarga la página ni vuelve a pintar nada, y nunca arranca audio: lo que suena sigue sonando (la mesa, el plato y los pads a la vez).
- **Biblioteca** (`#inicio`, `#catalogo`, `#g-…`…): todo el archivo, con su submenú (Espectro, Géneros, Catálogo, Sonidos, Caja). Al volver de otra sección conserva la vista, los filtros y el scroll.
  - **Sonidos** (`#sonidos`): los sonidos de Harmony (con el banco de destino a elegir), tus bancos del Soundpad (con un mapa de sus pads por color), tus archivos privados (dónde se usa cada uno) y las muestras del catálogo. Todo se escucha ahí mismo, con una sola voz de escucha para toda la web, y se manda al primer pad libre.
- **Mixer** (`#mixer`): el plato y la mesa de siempre, ahora debajo de la cabecera. También se abre desde la barra inferior, con la tecla `D` o con «Poner en el plato». Esc o la X vuelven a la biblioteca.
- **Soundpad** (`#soundpad`): pads para disparar sonidos.

## Soundpad
- **16 pads por banco** (4×4 en el ordenador y en el móvil). Cada pad muestra su nombre, su tecla, la categoría (el único color de la interfaz: kick, bajo, percusión, voz, FX, loop, tema, otro), si está cargando, si no carga y si está sonando (se invierte y una barra marca el avance).
- **Sonidos**: los **originales de Harmony** (pestaña «Biblioteca de Harmony» junto a los pads: buscar por nombre, etiqueta o nota, filtrar por estilo y tipo, escuchar y mandar al pad elegido, o arrastrar al pad que quieras), archivos de tu equipo (botón o arrastrándolos al pad; MP3, WAV, OGG, FLAC, M4A… lo que lea el navegador) o **muestras del catálogo** (las de 30 s de Deezer de los registros que la tienen). Cada pad dice de dónde sale su sonido: **Harmony**, **Tuyo** (privado, en tu navegador) o **Deezer**.
- **Por pad**: nombre, categoría, volumen, modo (*disparo*: suena entero y al repetir vuelve a empezar; *bucle*: pulsar arranca y para), tecla, probar, detener y vaciar.
- **Efectos por pad** (no tocan el archivo, se aplican al disparar): **recorte** de inicio y fin sobre la forma de onda (en bucle, el bucle es el trozo), **tono** de −12 a +12 semitonos (cambia también la velocidad, como en un sampler; en un bucle sonando se oye al momento), **al revés** y **grupo de corte** 1–4: disparar un pad para los de su grupo (charles abierto/cerrado, dos voces que no deben pisarse). «Quitar todos» los deja como estaban.
- **Sonido por pad**, en tiempo real (en directo y en el secuenciador; se oye al momento, también en lo que ya suena, y no toca el archivo):
  - **Distorsión**: de 0 a 100 %, *suave* (tanh), *dura* (recorte) o *plegado* (la onda se dobla sobre sí misma). Compensa el volumen que añade.
  - **Filtro**: paso bajo, paso alto o banda, con frecuencia (20 Hz–20 kHz) y resonancia.
  - **Bits**: de 12 a 2, para ensuciarlo como un sampler antiguo.
  - **Eco**: cantidad, tiempo al tempo del secuenciador (1/16, 1/8, 1/8 con puntillo, 1/4) y repeticiones.
  - Cada pad lleva su propia cadena de Web Audio: distorsión (WaveShaper con sobremuestreo ×4), filtro (biquad), bits (cuantización) y eco (retardo realimentado con un paso bajo). «Quitar» la deja limpia. Va con el banco al guardarlo, duplicarlo y exportarlo.
- **Exportar e importar**: «Exportar» descarga el banco abierto y «Exportar todos», todos, en un `.json` con el audio de tus archivos dentro (base64), para llevarlo a otro navegador u ordenador. «Importar» los añade como bancos nuevos, sin pisar nada. Las muestras del catálogo viajan como referencia.
- **Audio**: cada sonido se decodifica una vez (precarga al abrir el Soundpad y al cambiar de banco) y se dispara al apretar, no al soltar. Varios pads suenan a la vez; un pad no corta a otro. «Detener todo» para los pads (no la mesa). Los pads van a un bus propio que entra en el máster de Harmony, con el mismo volumen general y el mismo compresor que la mesa.
- **Teclas**: por defecto 1–4, Q–R, A–F y Z–V; se cambian desde las opciones del pad («Cambiar tecla» y pulsar). Una tecla solo puede tener un pad: si ya era de otro, ese se queda sin tecla y se avisa. No se pueden usar espacio, Esc, Tab, Intro, flechas, `/` ni `?`. Con el Soundpad a la vista las teclas de los pads mandan sobre los atajos de Harmony; escribiendo en un campo no se dispara nada.
- **Secuenciador** (debajo de los pads): una fila por pad con sonido, para encajar kicks, palmas, cajas o lo que haya en el banco en un ritmo en bucle. Cada patrón dura **4, 8 o 16 tiempos** (uno, dos o cuatro compases de 16 semicorcheas; 16 por defecto) y se edita de compás en compás con el selector *Tiempos 1–4 · 5–8 · 9–12 · 13–16*, que marca también el que está sonando. Al alargar, los compases nuevos repiten lo que había; al acortar, lo de más se guarda.
  - **Sonidos**: cada pad con sonido es una fila. *Añadir sonido*, al final de la rejilla, abre la biblioteca apuntando al primer pad libre; al elegirlo con su botón ＋ se vuelve a la fila nueva (es la forma de hacerlo en el móvil, donde los navegadores no arrastran). En el ordenador también se puede soltar encima un sonido de la biblioteca o un archivo de audio (sobre una fila cambia el sonido de ese pad y conserva su ritmo). En pantallas estrechas, el panel lateral ya no se queda con el gesto: deslizar sobre los filtros mueve la página.
  - **Pasos**: clic pone o quita un golpe; clic derecho, Alt+clic o mantener pulsado en el móvil, golpe suave (en el móvil, un toque solo se descarta si el dedo se desplaza más de 10 px) (a medio volumen); con el ratón se arrastra para pintar varios. **Duración**, en el ordenador: arrastrando el borde derecho de una nota se alarga o se acorta (no pasa de la nota siguiente del pad); doble clic en el borde la deja *entera*. Una nota entera suena el sonido completo, como siempre, y en tenue se ve lo que dura; una con duración se corta ahí con un fundido corto, y en un pad en modo bucle repite el bucle hasta su final. *Rellenar… › Notas enteras* quita las duraciones de la fila. Se guarda aparte de los golpes (`lens` en cada patrón), así que los bancos de antes cargan igual. Cada fila: escuchar (el nombre), M (silenciar), S (solo) y *Rellenar…*: cada negra, a contratiempo, en el 2 y el 4, corcheas, semicorcheas, galope, mover un paso a cada lado y vaciar (sustituyen la fila), y *añadir redoble al final* (se suma: semicorcheas en el último tiempo del patrón).
  - **Modo notas y piano roll**: el botón ♪ de una fila pasa ese pad a modo notas: deja de tocar golpes y toca melodías con su propio sonido transpuesto, como un sampler (también un kick: melodías de kick para uptempo y frenchcore). La fila enseña los nombres de las notas y *Editar notas* abre el piano roll debajo de la rejilla: cuatro octavas (dos arriba y dos abajo de la nota del pad, que sale de la nota del sonido más su tono), el compás que se está editando, las teclas de la izquierda suenan al pulsarlas y la escala elegida (Do–Si, menor, menor armónica, frigia, mayor o cromática; por defecto Re menor) se ve sombreada. Con el ratón: clic en vacío pone una nota (arrastrando a la derecha se alarga), arrastrar una nota la mueve, arrastrar su borde derecho la alarga o acorta, clic sin mover la borra, Alt+clic la pone suave. En el móvil: un toque pone o quita una nota de la duración elegida (1/16, 1/8, 1/4, 1/2 o un compás entero) y arrastrando se desplaza el rollo. Varias notas a la vez forman acordes. Al cambiar de tono el sonido cambia también de duración (una octava arriba dura la mitad), como en un sampler clásico. Al volver a ♪ el pad recupera sus golpes, que no se borran. Se guarda aparte (`mel` en cada patrón, `melodic` y `scale` en el secuenciador), así que los bancos de antes cargan igual, y `render-preset.mjs` también toca las notas.
  - **Tempo**: 60–260 BPM (con − y +, escribiéndolo o con *Tap*) y swing de 0 a 100 % (retrasa la segunda semicorchea de cada corchea hasta medio paso).
  - **Patrones A–D** por banco; el cambio entra al acabar la vuelta. *Cadena* (p. ej. `AABA`) los toca en ese orden. Acciones: base 4×4 con los sonidos de los pads (kick a negras, palma o caja en el 2 y el 4, charles y bajo a contratiempo), vaciar y copiar a otro patrón, y tres **kits de Harmony** (hardcore 180, newstyle 150, uptempo 200) que llenan pads libres, ponen el tempo y dejan la base. *Rellenar…* tiene además dos rellenos de escuela: *subida* (negras, luego corcheas y luego semicorcheas, el kick roll antes del drop) y *tresillo* (3 · 3 · 2).
  - **Presets por escuela** (`js/data/presets.js`), en *Acciones* y en el secuenciador vacío. Cada preset crea un **banco nuevo**, sin tocar el que hay. Hay quince: Uptempo melódico (200) y Frenchcore melódico (200), Uptempo himno (200) y Frenchcore himno (200), Rotterdam (175), Hardcore italiano (172), Mainstream oscuro (178), Mainstream melódico (174), Raw / uptempo (205), Newstyle (150), Newstyle de pitidos (175), Hardcore oscuro (170), Industrial (170, a medio tiempo), Uptempo distorsionado (210) y Uptempo de kicks (210).
    - **En modo notas:** Uptempo melódico y Frenchcore melódico tocan desde el piano roll todo lo que tiene nota, con sonidos de una sola nota transpuestos. En el uptempo, un único kick sigue los acordes (Rem – Si♭ – Do – La, en Re menor armónica) y hace una melodía de kicks antes de volver al principio; además hay bajo a contratiempo, órgano en acordes, lead y chops de voz. En el frenchcore, el kick va en golpes y un único bajo sigue los acordes (Rem – Solm – Si♭ – La), con piano, arpegio de pluck, lead saturado y chops. Las melodías son originales. En `js/data/presets.js` las notas se escriben con `notas(raíz, compás 1, …)`: `D4` nota, `d4` suave, `D4+F4+A4` acorde, `-` sigue y `.` nada. Un test comprueba que todas las notas caen en la escala del preset. **Comprobado** además en el render: la nota que domina en cada nota del lead, del bajo y de los chops es la escrita, en todas. En el kick, las notas de una negra acaban en su nota; las de una corchea son sobre todo la caída de tono del kick y suenan uno o dos semitonos por encima, pero con los intervalos exactos, porque todas son la misma caída transpuesta.
    - **Efectos y duraciones:** los cuatro últimos traen ya puestos efectos de pad (filtro, bits, eco, distorsión) y notas con duración: en Industrial, el kick picado de la subida; en Hardcore oscuro, la campana del break cortada cada medio compás. En `js/data/presets.js` una nota con duración se escribe `x---`.
    - **Qué trae cada uno:** 16 pads de los packs 01–06, el tempo y cuatro patrones de 16 tiempos (A intro, B subida, C drop, D break) que suenan encadenados: `ABCCDBCC`.
    - **Reparto de pads, igual en todos:** del 1 al 8 (deck 1 de la FLX4), kicks, palma, charles, percusión, redoble y plato. Del 9 al 16 (deck 2), bucles, stabs, coros, subida, efecto, MC y grito.
    - **Bucles:** van en modo disparo y se lanzan al empezar sus compases. Duran compases exactos al tempo del preset; si cambias el tempo, se descuadran.
    - **Al crearlo**, el banco carga los 16 sonidos y avisa cuando están listos.
    - **Uptempo himno**: cuatro kicks afinados, uno por acorde, para que el kick siga la armonía compás a compás. El lead está dos veces: limpio para el drop y con un paso bajo para la intro y el break. **Frenchcore himno**: el bajo a contratiempo cambia de nota con cada acorde.
    - **Escuchar un preset sin la web**: `node tools/samples/render-preset.mjs <id> salida.wav` lo toca entero, como el secuenciador (cadena, cortes, duraciones, volúmenes y efectos aproximados), y lo guarda en WAV.
  - **Grabar**: con el secuenciador en marcha, lo que se toca con los pads (o sus teclas) entra en el paso más cercano.
  - **Audio**: cada golpe se programa con antelación contra el reloj de audio (120 ms por delante, tic cada 25 ms desde un worker para que no se frene con la pestaña en segundo plano), así que el ritmo va cuadrado aunque la página esté ocupada. En el secuenciador cada pad es monofónico: un golpe corta el anterior del mismo pad y los de su grupo de corte. Lo que se edita mientras suena se oye en la vuelta siguiente; el tempo, al momento.
  - **Se guarda con el banco** (en el navegador, al duplicarlo y al exportarlo). Vaciar un pad borra su fila; cambiarle el sonido la conserva.
- **Bancos**: nuevo, duplicar, renombrar, **vaciar** (quita el sonido de los 16 pads y sus filas del secuenciador; se quedan el nombre, las teclas y el tempo; pide confirmación con un segundo clic), eliminar (pide confirmación con un segundo clic; siempre queda uno) y cambiar con el selector.
- **Los sonidos de Harmony necesitan servirse por web** (GitHub Pages o un servidor local): con `dist/index.html` abierto desde el disco el navegador no deja leerlos, y la interfaz lo dice. Cada uno se descarga y se decodifica una sola vez por sesión, se use en uno o en varios pads o en la escucha previa.
- **Qué se guarda**: los bancos y sus ajustes, en `localStorage`; tus archivos, en **IndexedDB**, en este navegador y sin subirse a ningún sitio. Cuando un archivo deja de usarlo cualquier pad, se borra. Si el navegador no deja usar IndexedDB (algunos modos privados), la cabecera dice «solo en esta sesión» y tus archivos duran hasta cerrar la pestaña. Las muestras del catálogo **no se guardan nunca** (condiciones de Deezer): solo la referencia, y se vuelven a pedir en cada sesión; necesitan conexión y no suenan dentro del artefacto de Claude.

## Laboratorio de kicks
`#kicks` (Biblioteca › Kicks). Es el motor con el que se hacen los kicks de Harmony (`tools/samples/hard.mjs`), con sus mandos a la vista. Cada cambio recalcula el kick en un *worker* (`workers/kick/`) en unas décimas de segundo y lo hace sonar.
- **Mandos**:
  - Tipo (uptempo / raw, hardcore o frenchcore) y nota de la cola (de Mi 1 a Sol# 2).
  - Cómo se mueve la cola: se cierra, se abre, va y viene, o fija.
  - Golpe: largo, caída de tono, tiempo de caída, tok y tick.
  - Cola: sierra en la fuente, reflexiones, medios, resonancia y dos distorsiones.
  - Equilibrio: sub, hueco en 300 Hz y OTT.
  - En frenchcore, además: repeticiones por negra, desde dónde se coge el trozo y caída de la cola.
  - **Hardcore** es otro motor (`hcKick`), con sus mandos:
    - Golpe: largo, caída de tono, caída de volumen del 909, punch, tok, tick y curva final.
    - Distorsión: cuadrada en la fuente, rumble (sala antes de distorsionar), bits, válvula, medios, cuerpo, plegado, recorte, grano, recorte final y chillido.
    - Equilibrio: sub, hueco en 130–400 Hz, gabinete, oscuro, «se cierra», reflexiones y OTT.
- **Puntos de partida**: Uptempo (el kick del himno), Uptempo que se abre, Uptempo con vaivén, Raw corto, Gabber zumbón, Hardstyle y Frenchcore. De hardcore y hard techno: Early / Rotterdam, Gabber 909, Mainstream, Industrial, Crossbreed, Hard techno, Rumble y Terror. Hay también *Al azar*, dentro de lo que suena a kick duro, y *Otra variación*, que es la misma receta con otra semilla.
- **Escucharlo**: suelto o *en bucle* a un tempo, con palma y charles. Debajo dice en qué nota se mide la cola (y si no es la pedida), lo que dura, el RMS y lo que ha tardado en calcularse.
- **Llevárselo**: *Al pad* lo manda al primer pad libre del banco abierto, como archivo tuyo; *WAV* lo descarga. Los ajustes se recuerdan en este navegador.
- **Abrir un kick de la biblioteca**: los kicks de hardcore de la biblioteca salen de este motor. Sus ajustes están en `js/data/kicks.js` (`LIB`) y el catálogo los guarda con cada sonido. En Sonidos y en el Soundpad, el botón *Lab* de esos kicks lo abre en el laboratorio con sus ajustes exactos, para retocarlo; lo que se cambie no toca el sonido de la biblioteca.
- **Cómo se afinó el motor de hardcore**: se compararon sus kicks con kicks de hardcore de referencia que pasó Marcos, solo para analizarlos; no se guardan ni se usan en ningún sonido. Se midieron la cola (100–300 ms), su cresta y el nivel de cada banda respecto a la nota. Las referencias tienen la cola casi cuadrada (cresta de 3,5 dB) y la nota unos 20 dB por encima de 130–400 Hz. Los medios (400 Hz–4 kHz) quedan a −12/−20 dB, y además hay una joroba de ruido en 1–4 kHz. Los kicks de antes eran casi un seno (cresta de 6 dB, pocos medios), y de ahí salen el recorte final sobremuestreado, el hueco y el grano. Comprobado en espectrogramas.
- **El mismo motor**: el build copia `dsp.mjs` y `hard.mjs` de `tools/samples` junto al worker, así que no hay una segunda versión del código. Un test monta el worker como lo hace el build y comprueba que los kicks salen afinados y a −1 dBTP.
- **Cabecera**: con un apartado más en el menú, la cabecera pasa a dos filas por debajo de 1240 px (antes, 980). Comprobado de 360 a 1800 px sin desbordarse.

## Extractor: sacar samples de una canción
`#extractor` (Biblioteca › Extractor; también «De una canción», en las opciones de un pad del Soundpad). Subes una canción y la separa con IA en **voz, batería, bajo e instrumentos** (sintes, leads, pads…). Todo pasa en el navegador: la canción no se sube a ningún sitio.
- **El modelo**: HTDemucs, de Meta (licencia MIT), exportado a ONNX. Corre con ONNX Runtime Web, por WebGPU (la tarjeta gráfica) o, si no hay, por el procesador. La parte que lo maneja es [demucs-web](https://github.com/timcsy/demucs-web) (MIT), copiada en `workers/demucs/`.
  - Va en un *worker* para que la página no se congele.
  - La primera vez descarga el motor (de jsDelivr) y el modelo (unos 172 MB, de Hugging Face). El modelo queda en la caché del navegador y se puede borrar desde la página.
  - Sin aislamiento entre orígenes (GitHub Pages no deja poner esas cabeceras), por el procesador va con un solo hilo: funciona, pero lento. Con WebGPU (Chrome y Edge de ordenador) es lo rápido.
- **Cómo se usa**:
  1. Eliges la canción (o la arrastras).
  2. Si quieres, marcas el tramo que te interesa sobre su onda (8 minutos como mucho) y le das a *Separar*. Mientras trabaja, dice qué está haciendo, cuánto lleva y cuánto le queda, y se puede cancelar.
  3. Las cuatro partes se escuchan juntas, con solo y silencio por parte, cabezal y bucle en la selección.
  4. Arrastrando sobre cualquier onda marcas un trozo. *Al pad* lo manda al primer pad libre del banco abierto como archivo tuyo, con su categoría (voz, percusión, bajo, FX). *WAV* lo descarga.
  5. La fila *Lo que suena* hace lo mismo con las partes que no estén silenciadas, juntas (por ejemplo, la canción sin voz).
- **Límites**: solo saca esas cuatro partes. Los pitidos, los hoovers y los pads salen juntos en «instrumentos». El modelo está entrenado sobre todo con pop y rock: con kicks distorsionados de cola larga puede repartir el kick entre batería y bajo o dejar artefactos. Las partes viven en memoria y se pierden al recargar; lo que mandas a un pad, no.
- **Derechos**: es para practicar y hacerte samples para ti. Lo que sale de una canción sigue siendo de sus autores. Por eso las partes y los trozos se quedan en tu navegador, como tus archivos, y nunca entran en la biblioteca de Harmony.
- **Comprobado**: la interfaz entera (cargar, marcar el tramo, separar, escuchar, solo y silencio, mandar al pad y descargar el WAV) con un motor de pruebas en Playwright. También se ha probado que el worker de verdad arranca, carga su librería y avisa con claridad si no puede bajar el motor. La separación real no se ha podido probar desde el entorno de desarrollo, que no tiene tarjeta gráfica ni acceso a jsDelivr o Hugging Face: hay que probarla en un navegador normal.

## Controlador: Pioneer DDJ-FLX4
`#controlador` (icono del conector en la cabecera; un punto verde dice que hay una tabla conectada). Con **Web MIDI** (Chrome y Edge, también Chrome para Android; Safari no tiene MIDI): la FLX4 es *class compliant*, así que el navegador la ve sin drivers. Se conecta una vez con permiso del navegador y, si ya lo tenía, se reconecta sola al abrir Harmony.

| Control | En Harmony |
|---|---|
| PLAY/PAUSE · CUE | platos A (deck 1) y B (deck 2) de la mesa; CUE para y vuelve al principio (no hay puntos de cue) |
| TEMPO | pitch del plato con su rango (±8 / ±16 %); «Invertir el tempo» si va al revés |
| JOG | borde: empujar o frenar mientras gira; plato tocado: arrastrar tu archivo; SHIFT + jog: buscar |
| EQ · CFX · faders · crossfader | aislador de 3 bandas, filtro (izquierda paso bajo, derecha paso alto), faders de canal y crossfader |
| PADS | los 16 pads del Soundpad: deck 1 = pads 1–8, deck 2 = pads 9–16, en cualquier modo; SHIFT + pad lo para. Se encienden los que tienen sonido y parpadean mientras suenan |
| BEAT SYNC | deck 1: tocar o parar el secuenciador · deck 2: grabar en él lo que se toca con los pads |
| Navegador | la rueda recorre la cola (o los registros con muestra; con SHIFT, de 10 en 10), LOAD carga en el plato de ese lado y pulsar la rueda abre o cierra la mesa |

- **Luces**: PLAY, CUE, BEAT SYNC, pads y vúmetros. Opcional, el mensaje SysEx de «programa conectado» que mandan los programas de DJ cada pocos ms (pide un permiso más), por si la tabla no enciende luces sin él.
- **Monitor** en la misma página: cada mensaje que llega, en hexadecimal y con lo que significa. **No se ha probado con la tabla en la mano**: el mapeo sale de la lista de mensajes MIDI de Pioneer (los mismos números que usa el mapeo libre de Mixxx) y se ha comprobado con una FLX4 simulada en el navegador; si un control no responde como aquí, el monitor dice qué manda.
- **Sin función todavía**: CUE de auriculares (hace falta una segunda salida de audio), TRIM, LOOP, BEAT FX y SMART CFX. El sonido sale por la salida de audio del navegador: para oírlo por la FLX4, elígela como salida del equipo.
- Código: `js/lib/flx4.js` (qué significa cada mensaje, sin DOM ni audio, con tests), `js/lib/midi.js` (conexión, acciones y luces), `js/views/controller.js` (la página).

## Qué hay en la web
- **Inicio**: cabecera, **espectro** en dos vistas (ver abajo), dos rutas editoriales («De Chicago a Ámsterdam» y «De la Ruta a la Masía»), décadas e índice de géneros.
- **Espectro**: *Carriles* (por defecto en el móvil): una fila por género sobre una escala común, por tempo o por época; toca la escala para marcar un tempo o un año y toca una fila para ver sus temas. *Mapa* (por defecto en el ordenador): BPM × año, cada género una zona y cada registro un punto.
- **Géneros**: *Explorar* (por defecto): un género en el centro, arriba de dónde viene y abajo hacia dónde va y con qué convive, sobre una línea del tiempo que se ajusta a los años en juego. Las ramas bajan desde el año en que nace cada género nuevo. Toca cualquier fila y pasa al centro (las que siguen en pantalla se desplazan); el recorrido queda como migas para volver atrás, y hay selector por familias y «Al azar». Al lado, la ficha del género con un punto que late a su tempo central, sus registros y sus acciones. *Mapa completo*: todas las relaciones a la vez (en el móvil, desplazable). Página por género con rango de BPM, época, origen, nota de clasificación discutible, de dónde viene y hacia dónde va (con acceso directo al explorador), registros, artistas y sellos.
- **Catálogo**: búsqueda, filtros combinables (género, década, artista, sello, BPM con preajustes, solo año contrastado), chips para quitar filtros, orden y tres vistas: lista, editorial y vinilo (cajas por sello).
- **Ficha**: cada dato con su estado y su fuente, desacuerdos entre fuentes, caras del disco (Discogs), enlaces para escuchar fuera (Spotify, YouTube Music, YouTube y SoundCloud; directos o búsquedas), edición física, fuentes y relacionados con el motivo de la relación.
- **Diseño de los discos**: cuando el disco existe y Cover Art Archive tiene su imagen, se ve **tal cual y en color**. Harmony no redibuja ningún diseño real. Regla por formato:
  - **Listas, fichas, rutas y cajas** muestran la portada de la edición original, sea cual sea su formato. Un CD se ve como un CD: su portada dentro de una caja con bisagra, no estirada a funda de vinilo. Si el original no tiene imagen pero su edición en vinilo sí, se ve la funda del vinilo y la ficha lo dice.
  - **El plato y la mesa son tocadiscos: solo gira vinilo.** La galleta real sale del vinilo original o, si el original es un CD, de su primera edición en vinilo. Si no hay vinilo (o no hay foto de su galleta), gira el disco de Harmony, marcado «Prensa Harmony».
  - Junto al plato se apoya la funda: la del vinilo si existe; si no, la caja del CD. Una línea explica qué gira y por qué, y la ficha lo repite con el enlace a la edición en vinilo.
  - Sin imagen real, queda la funda generativa en blanco y negro, que la ficha identifica como tal.
- **Muestras de Deezer**: los registros emparejados suenan en el plato y en la mesa con su muestra de 30 s. La ficha dice de qué edición sale y si está verificada por ISRC, y enlaza al tema entero en Deezer. Al acabar, el plato pasa al siguiente de la cola.
- **Plato**: tocadiscos con brazo, pitch ±8/±16 %, estroboscopio, Start·Stop, cola, volumen, posición y barra mínima fija.
- **Mesa** (botón «Mesa» o tecla `M`): dos platos, mezclador de dos canales con EQ de aislamiento de tres bandas y corte por banda, filtro, faders, crossfader (curva suave o de corte) y vúmetro; medición de BPM y fase de tus archivos, forma de onda, nudge con el disco o con botones y un indicador de fase con los golpes de A y B. Sin sync automático: se mezcla de oído.
- **Tema claro y oscuro**: por defecto sigue la configuración del dispositivo y cambia en directo si cambia el sistema. Desde el botón de la cabecera (o la tecla `T`) puedes fijar claro u oscuro; la elección se guarda en el navegador y se aplica antes de pintar, sin parpadeo. Dentro de un visor que fija su propio tema (como el de Claude), «según el dispositivo» sigue al visor y tu elección manda sobre él.
- **Caja**: favoritos e historial en el navegador (localStorage).
- **Atajos**: `/` buscar · `Espacio` play/pausa · `S` sorpréndeme · `N`/`P` cola · `D` plato · `M` plato/mesa · `F` guardar · `T` tema claro/oscuro · `?` ayuda · `Esc` cerrar. En la mesa: `1`/`2` play A/B · `Z`/`X` nudge A · `,`/`.` nudge B · `[`/`]` crossfader.

## Estructura
```
samples/      sonidos originales de Harmony, un directorio por pack (WAV); los genera tools/samples/build.mjs
js/data/      samples.js (catálogo de samples, generado) · genres.js (6 familias, 24 géneros, relaciones) · catalog.js (capa editorial: 109 registros, sellos, artistas, fuentes, rutas)
              mb.js (MusicBrainz) · dc.js (Discogs) · dz.js (muestras de Deezer); las generan los importadores: no editar
js/lib/       flx4.js (mensajes de la DDJ-FLX4) · midi.js (controlador MIDI) · library.js (biblioteca de samples: búsqueda y filtros) · util.js · theme.js (tema claro/oscuro) · archive.js (índice, fusión con MusicBrainz y Discogs, búsqueda, filtros, orden, relacionados, sorpréndeme) · links.js
              banks.js (modelo de bancos, pads y efectos del Soundpad) · patterns.js (patrones del secuenciador) · padstore.js (guardado en localStorage + IndexedDB, exportar e importar)
js/art/       art.js → fundas generativas, etiqueta del disco, reglas de BPM y época
js/audio/     engine.js (mezclador Web Audio de dos canales; bus y decodificación para otros instrumentos) · analysis.js (BPM, fase y forma de onda) · deezer.js (muestras de 30 s) · pads.js (disparo de los pads) · sequencer.js (reloj del secuenciador)
js/ui/        libpanel.js (panel de la biblioteca, en Soundpad y Sonidos) · components.js · controls.js (potenciómetros y faders) · deck.js (plato + barra mínima) · mesa.js · soundpad.js · seqpanel.js (secuenciador) · sections.js (Biblioteca · Mixer · Soundpad)
js/views/     spectrum.js · lanes.js · home.js · lineage.js (explorador de linajes) · genres.js · catalog.js · pages.js (artista, sello, caja) · sounds.js (sonidos) · controller.js (controlador MIDI) · js/app.js (rutas, ficha, atajos)
css/          tokens.css (claro/oscuro) · base.css · views.css · deck.css · soundpad.css
art/          diseño real de los discos (generado por el importador)
tools/        samples/ (dsp.mjs, voice.mjs, voices/, packs/, build.mjs, report.md) · mb-import.mjs · dc-import.mjs · dz-import.mjs · sus informes *-report.md (generados) · cache/ (generada) · test/
```
Rutas con hash: `#mixer`, `#soundpad`, `#sonidos`, `#controlador`, `#espectro`, `#generos`, `#catalogo`, `#caja`, `#g-makina`, `#a-skudero`, `#l-bit-music`, `#t-flying-free`.

## Taxonomía
6 familias y 24 géneros: raíces, hardcore, hardstyle y jump, techno duro, hard house y trance, y **mákina y newstyle**.
- **Mákina**: nace en Valencia a principios de los 90, del bakalao de la Ruta, y toma forma propia en Cataluña en la segunda mitad de la década, con una variante por sala: technomákina en Chasis (Mataró), corte hard trance en Xque (Calella de Palafrugell) y hardcore-mákina en Pont Aeri (Manresa, Terrassa, Vallgorguina). 150–180 BPM. Sigue viva en salas, fiestas y sellos independientes.
- **Newstyle** es la escena española de la discoteca Masía (Sot de Ferrer, Castellón; abierta en 1991): sale del **hard house americano** a mediados de los 2000 y convive con el jumpstyle. Sellos: C.H.R. (Contraseña Hardcore Records), Newstyle Corps y Masia Records.
- **Nu style** es otra cosa: la etiqueta del hardcore de finales de los 90 (155–165 BPM). Se archiva en la familia hardcore.
- Ampliaciones del 13-10-2026: Rotterdam Terror Corps, Evil Activities, DJ Mad Dog y Nosferatu; Dr. Evil, Abel K Kaña, Dj Ogalla y Hermanos Kapiya; EX-3 y Chimo Bayo; y la mákina catalana: Pastis & Buenri, DJ Skudero, Xavi Metralla, DJ Ruboy y DJ X-Centrik, con los sellos Bit Music y Boy Records. Dj Balas, Wakan Dj, Bassdrum Project, Papero, Dj Aleix y Tony Bass (newstyle) y DJ Sisu, DJ Sonic, Gerard Requena, Dani Fiesta, Joan Creus y Fran Bit (mákina) figuran como nombres de referencia a la espera de producciones contrastadas.

## Datos: qué es verdad y qué no
- Cada registro lleva `ok` (campos contrastados), `okBy` (con qué fuente) y `src`. Las fuentes llevan su fecha de consulta: Wikipedia (12-10-2026); Wikipedia en otros idiomas, el diario Ara, la web de la Masía, HardMusic.es, Last.fm, Makinaria, La Màkina del Temps y otras (13-10-2026); las fichas de Discogs de la serie Anonim (16-10-2026). Capas de MusicBrainz y Discogs: ver arriba.
- La interfaz lo marca: ● contrastado · ◍ fuentes en desacuerdo · ○ editorial · ≈ estimado · — sin datos.
- **Desacuerdos entre fuentes editoriales**: `alt: { year: [1995, 'w-ex3'] }` en un registro muestra los dos valores en la ficha (p. ej. Ex-P-Cial: 1996 según la página de la mákina, 1995 según la de EX-3).
- **BPM**: estimados por la redacción según género y época (≈), salvo que la fuente dé el tempo (`ok` incluye `bpm`): Flying Free, 158 BPM.
- **Años de premios**: cuando la fuente solo da el año de un premio (Reaching Dreams, Sweet Revenge, Time Is Up), el año queda sin contrastar y la nota lo dice.
- **N.º de catálogo**: los de HardMusic.es (C.H.R. y Newstyle Corps), los de Discogs y los que vengan de MusicBrainz. El número HMY es el registro del archivo.
- **Enlaces**: directos solo si MusicBrainz o Discogs los tienen; si no, búsquedas (SoundCloud siempre lo es, salvo enlace de MusicBrainz). Sin precios ni disponibilidad.
- Géneros sin registros contrastados: uptempo, nu style, hard house americano y schranz.

Añadir un registro: una línea `T(...)` en `js/data/catalog.js` y `node tools/mb-import.mjs --only <id>`. Un género: un objeto en `js/data/genres.js` (+ relaciones). La interfaz se genera sola.

## Audio
- **Muestra de Deezer**: ver arriba. Prioridad al cargar un disco: tu archivo > la muestra de Deezer > el pulso (si lo has elegido).
- **Archivo propio**: se reproduce en local con el pitch como un vinilo (tono y tempo a la vez). Clic en el surco para bajar la aguja. Al cargarlo se mide su BPM y su fase.
- **Pulso de referencia**: bombo y patrón rítmico sintetizados con Web Audio al BPM del registro. La interfaz dice siempre que no es el tema.
- El disco solo gira cuando el estado es `playing`; acelera y frena con inercia.

Pendiente:
- **YouTube** (IFrame Player API) para el tema entero en el plato: el reproductor tiene que verse (mínimo 200×200, sin nada encima), no se puede separar ni modificar su audio (sin pitch de vinilo ni ecualizador) y para encontrar los vídeos hace falta una clave de la API de Google, que se quedaría en el importador, en local.
- **Spotify**: descartado. Desde febrero de 2026 una app en modo desarrollo exige que su dueño tenga Premium, admite pocos usuarios y cada oyente necesita Premium; además, su política prohíbe mezclar su contenido con otro audio.
- **Apple / iTunes**: descartado. Sus muestras solo pueden usarse para promocionar la venta, con el botón de la tienda.

## Publicar como artefacto de Claude
El artefacto no puede cargar imágenes de otros servidores. Por eso las imágenes de `dist/art/` se publican junto a `dist/artifact.html` con la misma ruta relativa (`art/…`).

## Siguientes pasos
1. Primera importación real de Discogs con token (`tools/dc-import.mjs`), revisar `tools/dc-report.md`, y luego `dz-import --only anonim,anonim-vol-2,anonim-vol-3,anonim-4,anonim-5` por si Deezer tiene la serie.
2. Revisar los 13 de `tools/mb-report.md` y los 8 sin encontrar: fijar la edición con `mb: {...}` o con `dc: {...}`.
3. YouTube para el tema entero en el plato, con el vídeo a la vista: los vídeos por corte de Discogs ya están en la capa.
4. Rellenar uptempo, schranz, nu style y hard house americano, y producciones contrastadas de los nombres de referencia de la mákina y el newstyle.
