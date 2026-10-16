/* HARMONY · Taxonomía
   Familias → géneros → relaciones. Rangos de BPM y épocas son orientativos (editoriales)
   salvo que `src` indique de dónde salen. Para ampliar: añade un género aquí y, si quieres,
   relaciones en RELATIONS. La interfaz se genera sola a partir de estos datos. */
(function () {
  const H = (window.H = window.H || {});
  H.data = H.data || {};

  // pattern: motivo gráfico de la familia en el espectro y en las fundas
  H.data.families = [
    { id: 'raices', name: 'Raíces', pattern: 'grid', blurb: 'Lo que vino antes: Chicago, Detroit, Bélgica.' },
    { id: 'hardcore', name: 'Hardcore', pattern: 'diag', blurb: 'De Fráncfort y Róterdam a los 200 BPM.' },
    { id: 'hardstyle', name: 'Hardstyle y jump', pattern: 'dots', blurb: 'El hard dance de Países Bajos, Bélgica e Italia.' },
    { id: 'techno', name: 'Techno duro', pattern: 'hlines', blurb: 'Ácido, Birmingham, schranz y el ciclo actual.' },
    { id: 'housetrance', name: 'Hard house y trance', pattern: 'vlines', blurb: 'El hard dance británico, el americano y el trance de Fráncfort.' },
    { id: 'espana', name: 'Mákina y newstyle', pattern: 'cross', blurb: 'La escena española: de la Ruta valenciana a la Masía.' }
  ];

  // era: [inicio, fin|null = sigue activo] · bpm: [min, max] orientativo
  H.data.genres = [
    {
      id: 'new-beat', name: 'New beat', family: 'raices', era: [1987, 1990], bpm: [105, 120],
      places: 'Bélgica',
      summary: 'EBM y acid house tocados más lentos en los clubes belgas: bombo pesado, sintes metálicos y voces sampleadas. Va más despacio que casi todo lo que vino después, pero varias de sus ideas pasaron directas al hardcore.',
      refs: ['101', 'Lords of Acid', 'The Project'], src: ['w-hardcore']
    },
    {
      id: 'acid-house', name: 'Acid house', family: 'raices', era: [1987, 1993], bpm: [118, 130],
      places: 'Chicago',
      summary: 'La línea de bajo de la Roland TB-303 llevada a la pista, con la resonancia y el filtro movidos a mano. Es el origen del sonido ácido que reaparece en el acid techno, el hard trance y el hardcore.',
      refs: ['Phuture', 'DJ Pierre'], src: ['w-phuture']
    },
    {
      id: 'techno-raiz', name: 'Techno de rave', family: 'raices', era: [1988, 1993], bpm: [125, 138],
      places: 'Detroit · Nueva York · Bélgica · Países Bajos',
      summary: 'El techno se endurece al cruzar el Atlántico: riffs de «hoover», stabs y bucles pensados para naves industriales. De aquí salen el sonido de R&S y buena parte del vocabulario del hardcore.',
      refs: ['Joey Beltram', 'Human Resource'], src: ['w-beltram', 'w-dominator']
    },
    {
      id: 'early-hardcore', name: 'Early hardcore', family: 'hardcore', era: [1990, 1995], bpm: [125, 190],
      places: 'Fráncfort · Bélgica · Países Bajos',
      summary: 'Hardcore techno de primera generación: bombos saturados, el riff «mentasm» y una velocidad que sube año a año. Fráncfort (Planet Core Productions), Bélgica y Róterdam lo empujan a la vez.',
      disputed: 'La frontera con el techno de rave es difusa: varios discos de 1990 y 1991 aparecen en una u otra categoría según la fuente. Por eso el rango de BPM es tan ancho.',
      refs: ['Mescalinum United', 'T99', 'Second Phase', 'Lords of Acid'], src: ['w-hardcore', 'w-acardipane']
    },
    {
      id: 'gabber', name: 'Gabber', family: 'hardcore', era: [1992, 1999], bpm: [160, 200],
      places: 'Róterdam',
      summary: 'La versión rotterdamesa: más rápida, más distorsionada y con mucho orgullo local (la rivalidad con Ámsterdam está hasta en los títulos). Thunderdome, de ID&T, lo convierte en fenómeno de masas desde 1993.',
      disputed: 'En los Países Bajos «gabber» nombra a la vez un sonido y una subcultura, y muchas fuentes lo usan como sinónimo de early hardcore. Aquí lo separamos para la escena de Róterdam de los 90.',
      refs: ['Paul Elstak', 'Rob Fabrie', '3 Steps Ahead', 'Neophyte'], src: ['w-hardcore', 'w-rotterdam']
    },
    {
      id: 'happy-hardcore', name: 'Happy hardcore', family: 'hardcore', era: [1993, 2000], bpm: [160, 180],
      places: 'Róterdam · Reino Unido',
      summary: 'La rama comercial y luminosa del gabber: pianos, voces aceleradas y estribillos de radio. Paul Elstak, fundador de Rotterdam Records, firmó varios de sus mayores éxitos.',
      disputed: 'El happy hardcore británico viene del breakbeat hardcore y suena distinto. Aquí se archiva sobre todo la variante neerlandesa.',
      refs: ['Paul Elstak', 'Charly Lownoise & Mental Theo'], src: ['w-hardcore', 'w-elstak']
    },
    {
      id: 'millennium', name: 'Millennium hardcore', family: 'hardcore', era: [1997, 2003], bpm: [160, 180],
      places: 'Países Bajos',
      summary: 'A finales de los 90 el hardcore neerlandés baja el tempo y oscurece el bombo: menos velocidad, más peso. Es el puente entre el gabber y el mainstream hardcore.',
      disputed: 'Término de escena: no todas las fuentes lo distinguen del mainstream hardcore.',
      refs: ['Neophyte', 'The Stunned Guys', 'DJ Promo'], src: []
    },
    {
      id: 'mainstream', name: 'Mainstream hardcore', family: 'hardcore', era: [2002, null], bpm: [160, 180],
      places: 'Países Bajos · Italia',
      summary: 'El hardcore de los grandes eventos: producción más limpia, estructuras largas y bombos afinados, con influencia del hardstyle y del industrial. «Mainstream» es jerga de escena, no un juicio.',
      refs: ['Angerfist', 'DJ Promo', 'Endymion', 'Art of Fighters', 'The Stunned Guys', 'DJ Mad Dog'], src: ['w-hardcore', 'w-angerfist']
    },
    {
      id: 'industrial', name: 'Industrial hardcore', family: 'hardcore', era: [1995, null], bpm: [140, 190],
      places: 'Países Bajos · Alemania · Reino Unido',
      summary: 'La cara oscura y experimental: atmósferas metálicas, ritmos rotos y bombos que suenan a maquinaria. Comparte escena con el darkcore y con el crossbreed.',
      disputed: 'En la Wikipedia inglesa «industrial hardcore» lleva a otra cosa (power noise). Aquí nombra la rama del hardcore techno.',
      refs: ['The Outside Agency', 'Ruffneck', 'Fifth Era'], src: ['w-hardcore', 'w-outside-agency']
    },
    {
      id: 'frenchcore', name: 'Frenchcore', family: 'hardcore', era: [1995, null], bpm: [180, 220],
      places: 'Francia · Países Bajos',
      summary: 'Sale de las raves y el freetekno francés de mediados de los 90. Lo define un bajo distorsionado a contratiempo sobre un tempo cercano a 200 BPM; desde mediados de los 2010 se vuelve melódico y llega a los grandes festivales.',
      refs: ['DJ Radium', 'Al Core', 'The Sickest Squad', 'Dr. Peacock', 'Sefa'], src: ['w-frenchcore']
    },
    {
      id: 'uptempo', name: 'Uptempo', family: 'hardcore', era: [2012, null], bpm: [200, 260],
      places: 'Países Bajos',
      summary: 'Hardcore por encima de 200 BPM, con bombos cortos y muy saturados. Comparte rango de tempo y carteles con el frenchcore, por eso muchos DJs mezclan ambos.',
      disputed: 'El tempo alto existía antes; lo que se generaliza a mediados de los 2010 es la etiqueta. Las fuentes no coinciden en una fecha de inicio.',
      refs: ['Partyraiser'], src: ['w-hardcore', 'w-frenchcore']
    },
    {
      id: 'nu-style', name: 'Nu style', family: 'hardcore', era: [1999, 2004], bpm: [155, 165],
      places: 'Países Bajos · Bélgica · España',
      summary: 'Etiqueta para el hardcore que toma el relevo del old skool a finales de los 90: algo más lento, entre 155 y 165 BPM, con bombos contundentes. Según La Màkina del Temps, hacia 1999 el hardcore se relanza con estilos como este y el jumper.',
      disputed: 'Término poco estandarizado: muchas fuentes lo funden con el millennium hardcore o con el primer hardstyle. No es el newstyle español de la Masía, que se archiva aparte.',
      refs: [], src: ['l-mdt']
    },
    {
      id: 'jumpstyle', name: 'Jumpstyle', family: 'hardstyle', era: [1997, 2009], bpm: [140, 150],
      places: 'Bélgica · Países Bajos',
      summary: 'Surge en Bélgica hacia 1997–1998 y vive su pico comercial entre 2006 y 2008, unido a un baile propio. Mezcla hardstyle, hard house, gabber y mákina.',
      disputed: 'Los éxitos de Scooter de 2007–2008 adoptan el estilo desde el pop; se archivan aquí con esa salvedad.',
      refs: ['Jeckyll & Hyde', 'Patrick Jumpen', 'Da Boy Tommy', 'Jens O.'], src: ['w-jumpstyle']
    },
    {
      id: 'hardstyle', name: 'Hardstyle', family: 'hardstyle', era: [1999, null], bpm: [140, 160],
      places: 'Países Bajos · Bélgica · Italia',
      summary: 'Bombo saturado con cola de bajo a contratiempo (el «reverse bass»), screeches y melodías épicas. Hacia 2002 Fusion Records y Scantraxx son los grandes sellos neerlandeses y Q-dance registra el término. El tempo pasa de unos 140 BPM al principio a 150 hoy.',
      refs: ['Technoboy', 'Showtek', 'Headhunterz', 'Zany', 'The Prophet'], src: ['w-hardstyle']
    },
    {
      id: 'euphoric', name: 'Euphoric hardstyle', family: 'hardstyle', era: [2009, null], bpm: [150, 158],
      places: 'Países Bajos',
      summary: 'La deriva melódica del hardstyle desde 2010: breaks largos, voces y estribillos para corear. Convive en los mismos festivales con el rawstyle.',
      disputed: 'Etiqueta de escena y promotores más que de sellos.',
      refs: ['Headhunterz', 'Wildstylez', 'Brennan Heart'], src: ['w-hardstyle']
    },
    {
      id: 'rawstyle', name: 'Rawstyle', family: 'hardstyle', era: [2010, null], bpm: [150, 160],
      places: 'Países Bajos',
      summary: 'La deriva oscura: menos melodía, bombos más agresivos y screeches como protagonistas.',
      disputed: 'Wikipedia clasifica a Ran-D como hardstyle. Su catálogo de 2011 a 2018 se archiva aquí como rawstyle por criterio editorial.',
      refs: ['Ran-D', 'Gunz for Hire', 'Radical Redemption', 'Warface'], src: ['w-hardstyle', 'w-rand']
    },
    {
      id: 'makina', name: 'Mákina', family: 'espana', era: [1991, null], bpm: [150, 180],
      places: 'Valencia · Cataluña · noreste de Inglaterra y Escocia',
      summary: 'Nace en Valencia a principios de los 90 a partir del bakalao de la Ruta y toma forma propia en Cataluña en la segunda mitad de la década, más cerca del hard trance y del happy hardcore. Es un subgénero del hardcore techno con un tempo de 150 a 180 BPM. Cada sala catalana tiene su variante: technomákina en Chasis (Mataró), mákina de corte hard trance en Xque (Calella de Palafrugell) y hardcore-mákina en Pont Aeri (Manresa, Terrassa y Vallgorguina). En cabina se pincha a menudo con tres o cuatro temas superpuestos. Vive su explosión comercial entre 1999 y 2001 y, desde finales de los 90, arraiga también en el noreste de Inglaterra y Escocia.',
      disputed: 'Las fuentes no fechan igual el apogeo: la Wikipedia en inglés lo sitúa entre 1995 y 1997 y la española habla de explosión comercial entre 1999 y 2001. En Valencia decae hacia 1996–1997; en Cataluña las grandes salas cierran entre 2001 y 2012, pero el género sigue vivo en salas, fiestas y sellos independientes. El rango de BPM viene de la Wikipedia en inglés; la española no lo da.',
      refs: ['Chimo Bayo', 'EX-3', 'Pastis & Buenri', 'DJ Skudero', 'Xavi Metralla', 'DJ Ruboy', 'DJ X-Centrik', 'DJ Sisu', 'DJ Sonic', 'Gerard Requena', 'Dani Fiesta', 'Joan Creus', 'Fran Bit'],
      src: ['w-makina', 'wes-makina', 'wes-pontaeri', 'ara-salas', 'l-mdt']
    },
    {
      id: 'newstyle', name: 'Newstyle', family: 'espana', era: [2004, null], bpm: [145, 160],
      places: 'Comunidad Valenciana, con salas en toda España',
      summary: 'Evolución española del hard house americano a mediados de los 2000, con centro en la discoteca Masía (Sot de Ferrer, Castellón; abierta en 1991). Sus residentes pasan del U.S. hard house a un sonido propio: Dj Ogalla empieza a producirlo en 2004 y Abel K Kaña entra ese año en la cabina como uno de sus cuatro residentes. Desde 2005 el sello Newstyle Corps, de Dr. Evil, reúne a la escena.',
      disputed: 'En España «newstyle» nombra este sonido; en otras fuentes, «newstyle» o «nu style» es un subgénero del hardcore de finales de los 90 (aquí, Nu style). El rango de BPM es orientativo: ninguna de las fuentes consultadas lo da.',
      refs: ['Dr. Evil', 'Abel K Kaña', 'Dj Ogalla', 'Hermanos Kapiya', 'Wakan Dj', 'Dj Balas', 'Bassdrum Project', 'Papero', 'Dj Aleix', 'Tony Bass'], src: ['masia-djs', 'hm-abel', 'lfm-ogalla', 'mforos-masia']
    },
    {
      id: 'us-hard-house', name: 'Hard house americano', family: 'housetrance', era: [1995, 2004], bpm: [140, 150],
      places: 'Los Ángeles · Chicago',
      summary: 'Surge a mediados de los 90 en Los Ángeles y Chicago, con Mark V & Poogie Bear, Raoul Zerna o DJ Attack y sellos como Waxworks y Abstract Music. Vive su apogeo hacia 1999–2000 y pierde fuerza desde 2002; en España se convierte en la base del newstyle.',
      disputed: 'El rango de BPM es orientativo. En España a veces se le llama directamente «newstyle», un uso que La Màkina del Temps considera erróneo.',
      refs: ['Mark V & Poogie Bear', 'Raoul Zerna', 'DJ Attack', 'DJ Tronic'], src: ['l-mdt']
    },
    {
      id: 'hard-techno', name: 'Hard techno', family: 'techno', era: [1993, null], bpm: [138, 160],
      places: 'Birmingham · Alemania · Países Bajos',
      summary: 'Techno de bombo duro y repetición física. En los 90 tiene un foco en Birmingham (el «Birmingham sound» de Surgeon y compañía); desde finales de los 2010 vuelve más rápido y cercano a la rave.',
      disputed: 'Las fuentes usan «industrial techno», «Birmingham sound» y «hard techno» para discos que se solapan.',
      refs: ['Surgeon', 'Sara Landry'], src: ['w-surgeon', 'w-landry']
    },
    {
      id: 'schranz', name: 'Schranz', family: 'techno', era: [1997, 2009], bpm: [150, 165],
      places: 'Alemania',
      summary: 'Techno alemán muy rápido, de percusión saturada y bucles cortos, con su apogeo en los 2000.',
      disputed: 'Muchas fuentes lo tratan como una rama del hard techno.',
      refs: ['Chris Liebing', 'Frank Kvitta', 'Arkus P.', 'Sven Wittekind'], src: []
    },
    {
      id: 'acid-techno', name: 'Acid techno', family: 'techno', era: [1993, null], bpm: [130, 150],
      places: 'Londres · Alemania · EE. UU.',
      summary: 'El chirrido de la 303 sobre un techno más duro. En Londres crece en una red de fiestas ilegales con los Liberators, D.A.V.E. The Drummer o The Geezer.',
      refs: ['Liberators', 'D.A.V.E. The Drummer', 'The Geezer', 'Hardfloor', 'Dave Clarke'], src: ['w-acidtechno']
    },
    {
      id: 'hard-house', name: 'Hard house', family: 'housetrance', era: [1995, 2006], bpm: [140, 150],
      places: 'Reino Unido',
      summary: 'House británico acelerado, con bajos a contratiempo, stabs y mucha energía de club. Tidy Trax (fundado en 1995) y Tony De Vit son sus nombres clave.',
      refs: ['Tony De Vit', 'Tidy Boys', 'Lisa Lashes', 'Andy Farley', 'Lee Haslam'], src: ['w-tdv', 'w-tidy']
    },
    {
      id: 'hard-trance', name: 'Hard trance', family: 'housetrance', era: [1992, 2006], bpm: [135, 150],
      places: 'Fráncfort · Países Bajos · Reino Unido',
      summary: 'Trance con bombo duro y ácido: nace en Fráncfort y alrededores a principios de los 90 y se recicla en el hard dance británico de los 2000. El «reverse bass» de Scot Project anticipa el hardstyle.',
      refs: ['Scot Project', 'Kai Tracid', 'Hardfloor'], src: ['w-hardfloor', 'w-scot', 'w-hardstyle']
    }
  ];

  // origen: A evoluciona hacia B · influencia: A aporta a B · paralelo: conviven y se cruzan
  H.data.relations = [
    ['new-beat', 'early-hardcore', 'origen'],
    ['acid-house', 'acid-techno', 'origen'],
    ['acid-house', 'hard-trance', 'influencia'],
    ['techno-raiz', 'early-hardcore', 'origen'],
    ['techno-raiz', 'hard-techno', 'origen'],
    ['early-hardcore', 'gabber', 'origen'],
    ['gabber', 'happy-hardcore', 'origen'],
    ['gabber', 'millennium', 'origen'],
    ['millennium', 'mainstream', 'origen'],
    ['early-hardcore', 'industrial', 'origen'],
    ['industrial', 'mainstream', 'influencia'],
    ['hardstyle', 'mainstream', 'influencia'],
    ['mainstream', 'uptempo', 'origen'],
    ['early-hardcore', 'frenchcore', 'origen'],
    ['frenchcore', 'uptempo', 'paralelo'],
    ['hard-trance', 'hardstyle', 'influencia'],
    ['new-beat', 'hardstyle', 'influencia'],
    ['hardstyle', 'jumpstyle', 'influencia'],
    ['hard-house', 'jumpstyle', 'influencia'],
    ['hardstyle', 'euphoric', 'origen'],
    ['hardstyle', 'rawstyle', 'origen'],
    ['euphoric', 'rawstyle', 'paralelo'],
    ['hard-techno', 'schranz', 'origen'],
    ['acid-techno', 'hard-techno', 'paralelo'],
    ['hard-house', 'hard-trance', 'paralelo'],
    ['gabber', 'nu-style', 'origen'],
    ['nu-style', 'millennium', 'paralelo'],
    ['nu-style', 'mainstream', 'influencia'],
    ['early-hardcore', 'hardstyle', 'influencia'],
    ['gabber', 'jumpstyle', 'influencia'],
    ['early-hardcore', 'makina', 'origen'],
    ['happy-hardcore', 'makina', 'influencia'],
    ['hard-trance', 'makina', 'influencia'],
    ['makina', 'jumpstyle', 'influencia'],
    ['hard-house', 'us-hard-house', 'paralelo'],
    ['us-hard-house', 'newstyle', 'origen'],
    ['jumpstyle', 'newstyle', 'paralelo']
  ];
})();
