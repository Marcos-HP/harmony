# Harmony

Archivo interactivo de música electrónica dura: hardcore, hardstyle, hard house, hard trance, techno, mákina y newstyle. HTML + CSS + JS sin backend ni dependencias (solo tipografías de Google Fonts: Archivo, Newsreader e IBM Plex Mono). Node 18+ solo para el build, el importador y los tests.

Edición 0.3 · 16-10-2026 · fases 1 y 2 funcionando; fase 3 con MusicBrainz (diseño real de 57 discos), muestras de Deezer y Discogs como segunda fuente.

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

**Tests**: `npm test` (27, incluidos los importadores de Deezer y Discogs contra servidores falsos). Prueban normalización, emparejado, elección de edición, resumen, Cover Art Archive (elección de portada y galleta, descargas, `--no-art`), caché, reintentos, `--only`, `--offline`, el ritmo de peticiones, la fusión en la web, la coherencia de la capa importada de verdad (imágenes locales, galleta solo con vinilo), los desacuerdos entre fuentes editoriales y la integridad del catálogo (fuentes, artistas, sellos, rutas). El servidor falso tiene la forma real de las respuestas de la API; todos sus datos son inventados y nunca llegan al catálogo.

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
js/data/      genres.js (6 familias, 24 géneros, relaciones) · catalog.js (capa editorial: 107 registros, sellos, artistas, fuentes, rutas)
              mb.js (MusicBrainz) · dc.js (Discogs) · dz.js (muestras de Deezer); las generan los importadores: no editar
js/lib/       util.js · theme.js (tema claro/oscuro) · archive.js (índice, fusión con MusicBrainz, búsqueda, filtros, orden, relacionados, sorpréndeme) · links.js
js/art/       art.js → fundas generativas, etiqueta del disco, reglas de BPM y época
js/audio/     engine.js (mezclador Web Audio de dos canales) · analysis.js (BPM, fase y forma de onda) · deezer.js (muestras de 30 s)
js/ui/        components.js · controls.js (potenciómetros y faders) · deck.js (plato + barra mínima) · mesa.js
js/views/     spectrum.js · lanes.js · home.js · lineage.js (explorador de linajes) · genres.js · catalog.js · pages.js (artista, sello, caja) · js/app.js (rutas, ficha, atajos)
css/          tokens.css (claro/oscuro) · base.css · views.css · deck.css
art/          diseño real de los discos (generado por el importador)
tools/        mb-import.mjs · dc-import.mjs · dz-import.mjs · sus informes *-report.md (generados) · cache/ (generada) · test/
```
Rutas con hash: `#espectro`, `#generos`, `#catalogo`, `#caja`, `#g-makina`, `#a-skudero`, `#l-bit-music`, `#t-flying-free`.

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
