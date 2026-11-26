/* Ibiza — a free AI DJ. Learns your taste, analyzes every track, mixes like a DJ. */
(function () {
  'use strict';
  const A = window.DJAnalysis;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ---------- storage (best effort) ----------
  const store = {
    get(k, d) { try { const v = localStorage.getItem('sel_' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem('sel_' + k, JSON.stringify(v)); } catch {} },
    del(k) { try { localStorage.removeItem('sel_' + k); } catch {} },
  };
  // a first-time visitor (no DJ picked before, not arriving from a shared DJ link) starts on their region's own DJ
  const FIRST_VISIT = store.get('genre', null) == null && !/[?&]dj=/.test(location.search);
  const REGION_DJ = { NG: 'afrobeats', GH: 'afrobeats', CI: 'afrobeats', SN: 'afrobeats', CM: 'afrobeats', KE: 'afrobeats', ZA: 'amapiano', IN: 'bollywood', MX: 'regional', BR: 'brazil', CO: 'reggaeton', AR: 'latin', CL: 'latin', PE: 'latin' };

  // ---------- state ----------
  const S = {
    taste: store.get('taste', { artists: {}, likes: {}, bans: {} }),
    mood: store.get('mood', 'balanced'),
    pace: store.get('pace', 'radio'),
    voice: store.get('voice', true),
    king: store.get('king', false),
    pool: new Map(),
    played: [],
    ready: [],
    analyzing: new Set(),
    energies: [],
    mode: 'preview', // or 'spotify'
    running: false,
    setIndex: 0,
    poolBuilt: false,
    region: store.get('region', ''),
    genre: store.get('genre', 'all'),
    localArtists: [],
  };
  const READY_MAX = 5;

  const CFG = { spotifyClientId: '', youtube: false, firebase: null, loaded: false };
  function saveTaste() { store.set('taste', S.taste); try { window.dispatchEvent(new CustomEvent('sel:taste')); } catch {} }

  // ---------- regions (Deezer's own country charts) ----------
  const REGIONS = [['US', 'United States'], ['MX', 'Mexico'], ['NG', 'Nigeria'], ['GB', 'United Kingdom'], ['BR', 'Brazil'], ['CO', 'Colombia'], ['AR', 'Argentina'], ['CL', 'Chile'], ['PE', 'Peru'], ['ES', 'Spain'], ['FR', 'France'], ['DE', 'Germany'], ['IT', 'Italy'], ['NL', 'Netherlands'], ['BE', 'Belgium'], ['PT', 'Portugal'], ['IE', 'Ireland'], ['CA', 'Canada'], ['AU', 'Australia'], ['ZA', 'South Africa'], ['GH', 'Ghana'], ['KE', 'Kenya'], ['CI', 'Ivory Coast'], ['SN', 'Senegal'], ['CM', 'Cameroon'], ['MA', 'Morocco'], ['EG', 'Egypt'], ['TR', 'Turkey'], ['IN', 'India'], ['PH', 'Philippines'], ['ID', 'Indonesia'], ['JP', 'Japan'], ['PL', 'Poland'], ['SE', 'Sweden']];
  const CHART_NAMES = { US: ['USA', 'United States'], GB: ['UK', 'United Kingdom'], CI: ["Côte d'Ivoire", 'Ivory Coast', 'Cote d Ivoire'], NL: ['Netherlands', 'Pays-Bas'], ZA: ['South Africa'] };
  const CHARTS_OWNER = 637006841, WORLD_CHART = 3155776842, NIGERIA_CHART = 1362516565;
  // Genre DJs: tap one and the whole set is that sound, stocked from current charts and big editorial playlists.
  const GENRES = [
    { id: 'all', name: 'Everything', sub: 'Your country + the world', c: ['#ff5f6d', '#a94bff'] },
    // the Ibiza DJ: the island's anthems every Ibiza party-goer knows, plus the big Ibiza playlists
    { id: 'ibiza', name: 'Ibiza', sub: 'The anthems the whole island knows', q: ['Ibiza Classics', 'Ibiza Anthems', 'Ibiza Hits', 'Ibiza 2026', 'Ibiza Closing Party'], n: 2, lim: 120, tracks: ["Mike Posner | I Took A Pill In Ibiza", "Vengaboys | We're Going to Ibiza", "Swedish House Mafia | Miami 2 Ibiza", "Faithless | Insomnia", "Faithless | God Is a DJ", "Faithless | We Come 1", "Robin S | Show Me Love", "Stardust | Music Sounds Better with You", "Daft Punk | One More Time", "Eric Prydz | Call on Me", "Eric Prydz | Pjanoo", "Eric Prydz | Opus", "Swedish House Mafia | Don't You Worry Child", "Swedish House Mafia | One", "Swedish House Mafia | Greyhound", "Swedish House Mafia | Save the World", "Avicii | Levels", "Avicii | Wake Me Up", "Avicii | Hey Brother", "Avicii | Silhouettes", "Avicii | The Nights", "Calvin Harris | Feel So Close", "Calvin Harris | Summer", "Calvin Harris | One Kiss", "Calvin Harris | How Deep Is Your Love", "Calvin Harris | Blame", "Calvin Harris | Miracle", "Rihanna | We Found Love", "David Guetta | Titanium", "David Guetta | Memories", "David Guetta | Love Is Gone", "David Guetta | I'm Good (Blue)", "Bob Sinclar | Love Generation", "Bob Sinclar | World Hold On", "Bob Sinclar | Rock This Party", "Benny Benassi | Satisfaction", "Spiller | Groovejet", "Modjo | Lady (Hear Me Tonight)", "Fedde Le Grand | Put Your Hands Up for Detroit", "Mylo | Drop the Pressure", "Armand Van Helden | You Don't Know Me", "Armand Van Helden | My My My", "Ian Van Dahl | Castles in the Sky", "ATB | 9 PM (Till I Come)", "Darude | Sandstorm", "Energy 52 | Café del Mar", "Sash! | Ecuador", "Alice Deejay | Better Off Alone", "Chicane | Saltwater", "Paul van Dyk | For an Angel", "Tiësto | Adagio for Strings", "Tiësto | Red Lights", "Tiësto | The Business", "Tiësto | The Motto", "Fatboy Slim | Right Here, Right Now", "Fatboy Slim | Praise You", "Underworld | Born Slippy", "The Shapeshifters | Lola's Theme", "Supermode | Tell Me Why", "Axwell | I Found U", "Axwell Λ Ingrosso | More Than You Know", "Sebastian Ingrosso | Reload", "Alesso | Heroes", "Hardwell | Spaceman", "Martin Garrix | Animals", "Martin Solveig | Hello", "Martin Solveig | Intoxicated", "Kungs | This Girl", "Robin Schulz | Prayer in C", "Lost Frequencies | Are You with Me", "Felix Jaehn | Ain't Nobody", "Duke Dumont | Need U (100%)", "Duke Dumont | Ocean Drive", "Disclosure | Latch", "Disclosure | You & Me", "Gorgon City | Ready for Your Love", "Route 94 | My Love", "Sigma | Nobody to Love", "Clean Bandit | Rather Be", "MK | 17", "Kygo | Firestone", "Fisher | Losing It", "Fisher | Yeah the Girls", "Chris Lake | Turn Off the Lights", "John Summit | Where You Are", "Fred again.. | Delilah (pull me out of this)", "Fred again.. | Marea (we've lost dancing)", "Peggy Gou | (It Goes Like) Nanana", "Purple Disco Machine | Hypnotized", "Purple Disco Machine | In the Dark", "Black Coffee | Drive", "Meduza | Piece of Your Heart", "Meduza | Lose Control", "CamelPhat | Cola", "Dom Dolla | Rhyme Dust", "Mau P | Drugs from Amsterdam", "Deadmau5 | Strobe", "Deadmau5 | Ghosts 'n' Stuff", "Basement Jaxx | Where's Your Head At", "Basement Jaxx | Romeo", "Groove Armada | Superstylin'", "Groove Armada | At the River", "Roger Sanchez | Another Chance", "Mousse T. | Horny '98", "Ultra Naté | Free", "Crystal Waters | Gypsy Woman", "Cassius | 1999", "Dimitri Vegas & Like Mike | Tremor", "Dimitri Vegas & Like Mike | Mammoth", "Joel Corry | Head & Heart", "Acraze | Do It To It", "Riton | Friday", "Jax Jones | You Don't Know Me", "Shouse | Love Tonight", "Sonique | It Feels So Good", "Lil Louis | French Kiss", "Inner City | Good Life", "Frankie Knuckles | Your Love", "The Prodigy | Out of Space", "Zombie Nation | Kernkraft 400", "Sophie Ellis-Bextor | Murder on the Dancefloor", "Klingande | Jubel", "Lana Del Rey | Summertime Sadness", "Ofenbach | Be Mine", "Becky Hill | Remember", "Cassö | Prada", "Gala | Freed from Desire", "Eiffel 65 | Blue (Da Ba Dee)", "Mr. Oizo | Flat Beat", "Daft Punk | Around the World", "Daft Punk | Harder, Better, Faster, Stronger", "Kanye West | Stronger", "Ellie Goulding | Lights", "Calvin Harris | Outside", "Eric Prydz | Every Day", "Tiësto | Traffic", "Swedish House Mafia | Moth to a Flame", "Avicii | Fade Into Darkness", "Cascada | Everytime We Touch", "Bodyrox | Yeah Yeah", "Wankelmut | My Head Is a Jungle", "Gesaffelstein | Pursuit", "Bicep | Glue", "Bicep | Apricots", "Solomun | Customer Is King", "Adam Beyer | Your Mind", "Charlotte de Witte | Doppler", "Amelie Lens | Feel It", "Keinemusik | Move", "&ME | The Rapture Pt.III", "Rampa | Les Gout", "Black Coffee | Superman", "Anyma | Eternity", "Tale Of Us | Nova", "Michael Bibi | Hanging Tree", "Jamie Jones | My Paradise", "Hot Since 82 | Buggin'", "Patrick Topping | Be Sharp Say Nowt", "Paco Osuna | Asi", "Joris Voorn | Ringo", "Chris Stussy | Desire", "Prospa | Want Need Love", "Sammy Virji | If U Need It", "Interplanetary Criminal | Slow Burner", "Notion | Fourth Dimension", "Ewan McVicar | Tell Me Something Good", "Jengi | Bel Mercy", "Calvin Harris | Desire", "Sonny Fodera | Mind Still", "Dennis Ferrer | Hey Hey", "Bob Moses | Tearing Me Up", "Kölsch | Grey", "Röyksopp | Eple", "Moby | Porcelain", "Café del Mar | Café del Mar", "José Padilla | Solito", "Bent | Magic Love", "Afterlife | Dub Mental"], tracksWord: 'Ibiza anthems', c: ['#ff9a3d', '#00c2ff'] },
    { id: 'blends', name: 'King of Blends', sub: 'Vocal blends, back to back', g: [2], q: ['TikTok Viral', 'Afrobeats Hits', 'Amapiano Hits', 'Pop Hits'], lim: 120, king: true, c: ['#ffcf3f', '#ff3d77'] },
    { id: 'tiktok', name: 'TikTok Viral', sub: 'The top viral sounds', q: ['TikTok Viral', 'Viral TikTok Hits', 'TikTok Hits', 'TikTok Songs', 'TikTok Trends'], n: 2, lim: 200, c: ['#25f4ee', '#fe2c55'] },
    { id: 'afrobeats', name: 'Afrobeats', sub: 'Lagos to London', g: [2], q: ['Afrobeats Hits', 'Naija Hits'], tracks: ["Suono Sai | Igbo Boy", "Suono Sai | Para Boy", "Suono Sai | THE MAKER", "Burna Boy | Last Last", "Wizkid | Essence", "Davido | Fall", "Rema | Calm Down", "Tems | Free Mind", "Ayra Starr | Rush", "Tiwa Savage | Koroba", "2Baba | African Queen", "2Baba | I Sing", "D'banj | Oliver Twist", "Asake | Lonely At The Top", "Burna Boy | Ye", "Wizkid | Ojuelegba", "Davido | If", "Rema | Dumebi", "Tems | Me & U", "Ayra Starr | Sability", "Tiwa Savage | Somebody's Son", "2Baba | Implication", "2Baba | True Love", "2Baba | Only Me", "2Baba | Rainbow", "2Baba | Amaka", "2Baba | E Be Like Say", "2Baba | Nfana Ibaga", "2Baba | For Instance", "D'banj | Fall in Love", "Asake | Terminator", "Burna Boy | On the Low", "Wizkid | Joro", "Davido | Assurance", "Rema | Charm", "Tems | Love Me JeJe", "Ayra Starr | Bloody Samaritan", "Tiwa Savage | All Over", "Asake | Sungba", "Burna Boy | Anybody", "Wizkid | Come Closer", "Davido | Unavailable", "Rema | Ozeba", "Ayra Starr | Commas", "Tiwa Savage | Kele Kele Love", "Asake | Joha", "Burna Boy | City Boys", "Wizkid | Soco", "Davido | FEM", "Rema | HEHEHE", "Tems | Higher", "Ayra Starr | Last Heartbreak Song", "D'banj | Why Me", "Burna Boy | Kilometre", "Wizkid | Bad To Me", "Davido | Skelewu", "Davido | Aye", "Davido | Dami Duro", "Burna Boy | Gbona", "Wizkid | Fever", "Burna Boy | For My Hand", "Davido | Feel", "Asake | Peace Be Unto You", "Tyla | Water", "CKay | Love Nwantiti", "Fireboy DML | Peru", "Kizz Daniel | Buga", "Omah Lay | Godly", "Omah Lay | soso", "P-Square | Personally", "P-Square | Do Me", "Flavour | Ada Ada", "Flavour | Nwa Baby", "Shallipopi | Elon Musk", "Seyi Vibez | Different Pattern", "Olamide | Science Student", "Wande Coal | Iskaba", "Mr Eazi | Leg Over", "Yemi Alade | Johnny", "Simi | Duduke", "Adekunle Gold | High", "Victony | Soweto", "Ruger | Asiwaju", "BNXN | Gwagwalada"], boostN: 3, boostArtists: [[244614492, 'Zaylevelten'], [133557012, 'Zen Univrse'], [278268331, '1Drag']], tracksWord: 'Afrobeats anthems', c: ['#ff9a3c', '#2ecc71'] },
    // the greatest Igbo songs of all time: highlife legends, Afrobeats stars and the new wave
    { id: 'igbo', name: 'Igbo', sub: 'Greatest Igbo songs, legends to new acts', tracks: ["Chief Stephen Osita Osadebe | Osondi Owendi", "Flavour | Ada Ada", "Phyno | Fada Fada", "Oliver De Coque | Biri Ka Mbiri", "Flavour | Nwa Baby", "Phyno | Alobam", "Bright Chimezie | Because of English", "Celestine Ukwu | Ilo Abu Chi", "Prince Nico Mbarga | Sweet Mother", "Flavour | Golibe", "Phyno | Connect", "Kcee | Limpopo", "Flavour | Ijele", "Phyno | Ride For You", "Psquare | Chop My Money", "Duncan Mighty | Obianuju", "Chidinma | Kedike", "J. Martins | Good or Bad", "Flavour | Baby Oku", "Phyno | Augment", "Zoro | Achikolo", "Umu Obiligbo | Culture", "Spyki | Ebere", "Suono Sai | Igbo Boy", "Zaylevelten | Tease Me", "Flavour | Chinedum", "Phyno | Man of the Year", "Kcee | Ojapiano", "Chike | Egwu", "Jeriq | Remember", "Flavour | Ololufe", "Phyno | Financial Woman", "Chief Stephen Osita Osadebe | Nwanem Ebezina", "Oliver De Coque | Nwanne Di Na Mba", "Celestine Ukwu | Ije Enu", "Bright Chimezie | African Style", "Flavour | Sake of Love", "Phyno | O Set", "Umu Obiligbo | Anwuli", "Zoro | Ogene", "Suono Sai | Super Power", "Zaylevelten | Wuse Tu", "Flavour | Big Baller", "Phyno | Deal With It", "Kcee | Erima", "Flavour | Levels", "Phyno | Ndewo", "Zoro | African Girl Bad", "Jeriq | Bondage", "Suono Sai | Gidigba", "Flavour | Most High", "Phyno | Nwa Aturu", "Umu Obiligbo | Udo Ga Adi", "Chief Stephen Osita Osadebe | Aye Mama", "Oliver De Coque | Akuchinyere Nwata", "Celestine Ukwu | Igede", "Flavour | OVAMI", "Phyno | Ikepentecost", "Kcee | Cultural Praise", "Zoro | Settings", "Zaylevelten | Pawon", "Flavour | Uzo Ano", "Phyno | Ije Enu", "Umu Obiligbo | Nwalie", "Odumeje | Powers", "Flavour | Pansa Pansa", "Zoro | Stainless"], c: ['#f5b700', '#c1121f'] },
    { id: 'amapiano', name: 'Amapiano', sub: 'Log drums all night', q: ['Amapiano Hits', 'Amapiano'], c: ['#f7c948', '#e8553b'] },
    { id: 'katseye', name: 'KATSEYE', sub: 'Every KATSEYE song, mixed', artist: 'KATSEYE', c: ['#ff4f9a', '#6a5cff'] },
    // the songs confirmed for the big 2026 open-world game's soundtrack (album, trailers, extended look)
    { id: 'gamenight', name: 'GT AutoTracks', sub: 'The 2026 game soundtrack, mixed', tracks: ["Justice | Starting From Zero", "Yung Lean | That's It", "Playboi Carti | AHH YEA", "Travis Scott | RHYNO", "CA7RIEL & Paco Amoroso | Sexy Magic", "Justice | Flower in a Hurricane", "Dua Lipa | Go Easy", "Morgan Wallen | Last Thing You Need", "JHAYCO | X", "Fuerza Regida | Suzuki", "Rauw Alejandro | Macacoa 2000", "A Boogie Wit da Hoodie | Dance with Me", "Burna Boy | Bigger", "Gunna | COUNT UP", "Kodak Black | Let's Rock", "Young Thug | WAKIN UP FLEX", "Tee Grizzley | IKYFL", "Don Toliver | TF?", "Cardi B | Don't Chart", "JT | GMA", "JENNIE | Power Trip", "Tove Lo | Blood In Your Eyes", "Zara Larsson | Fast Emotion", "Camila Cabello | Sweet Like Candy", "Fcukers | Only One", "Arca | Sandunguea", "Rina Sawayama | TRDWFE", "Rose Gray | All Again", "Lana Del Rey | Crazy for You", "Kali Uchis | Largate", "Omar Apollo | NO ME BUSQUES", "Keith Richards | Bright Lights, Big City", "Jesse Johnson | Stone Kold Krazy Luuv", "Stanley Clarke | Overtown Lights", "Justice | Pusher", "Tom Petty | Love Is a Long Road", "The Pointer Sisters | Hot Together", "Wang Chung | Everybody Have Fun Tonight", "Tammy Wynette | Talkin' to Myself Again", "Zenglen | Child Support", "Jay Ferguson | Thunder Island", "Birdman | Pop Bottles", "Sexyy Red | Pound Town", "Kodak Black | Skrilla", "The Bellamy Brothers | Let Your Love Flow", "Def Leppard | Love Bites", "Depeche Mode | People Are People", "Captain & Tennille | But I Think It's a Dream", "Prefab Sprout | Cars and Girls", "!!! | Off the Grid", "Cliff Richard | Devil Woman", "Chimbala | Se Me Nota", "Phil Collins | Against All Odds", "Aluna | Mine O' Mine", "Elderbrook | Inner Light"], c: ['#ff7a18', '#ff2e93'] },
    { id: 'y2026', name: '2026 DJ', sub: 'Master of the 2026 era', year: '2026', q: ['Hits 2026', 'Best of 2026', 'Top 2026', '2026 Hits', 'New Music 2026'], pl: [3155776842], g: [132], lim: 150, c: ['#00e5ff', '#ff2bd6'] },
    { id: 'y2016', name: '2016 DJ', sub: 'Master of the 2016 era', year: '2016', q: ['Hits 2016', 'Best of 2016', 'Top 2016', '2016 Hits', '2016 Party'], lim: 150, c: ['#f953c6', '#b91d73'] },
    { id: 'y2010', name: '2010 DJ', sub: 'Master of the 2010 era', year: '2010', q: ['Hits 2010', 'Best of 2010', 'Top 2010', '2010 Hits', '2010 Party'], lim: 150, c: ['#43cea2', '#185a9d'] },
    { id: 'y2003', name: '2003 DJ', sub: 'Master of the 2003 era', year: '2003', q: ['Hits 2003', 'Best of 2003', 'Top 2003', '2003 Hits', '2003 Party'], lim: 150, c: ['#ffb347', '#ff5e62'] },
    { id: 'y2000', name: '2000 DJ', sub: 'Master of the 2000 era', year: '2000', q: ['Hits 2000', 'Best of 2000', 'Best Songs 2000', '2000 Hits', 'Y2K Hits 2000'], lim: 150, c: ['#c471f5', '#fa71cd'] },
    { id: 'pop', name: 'Pop', sub: 'The biggest songs now', g: [132], q: ['Pop Hits'], c: ['#ff6fd8', '#3813c2'] },
    { id: 'hiphop', name: 'Hip-Hop', sub: 'Rap and trap', g: [116], q: ['Hip Hop Hits', 'Rap Hits'], c: ['#f12711', '#f5af19'] },
    { id: 'rnb', name: 'R&B', sub: 'Smooth and soulful', g: [165], q: ['R&B Hits'], c: ['#8e2de2', '#4a00e0'] },
    { id: 'latin', name: 'Latin', sub: 'Pop latino and more', g: [197], q: ['Latin Hits', 'Éxitos Latinos'], c: ['#ff512f', '#dd2476'] },
    { id: 'reggaeton', name: 'Reggaeton', sub: 'Perreo', g: [122], q: ['Reggaeton Hits'], c: ['#00c9ff', '#92fe9d'] },
    { id: 'regional', name: 'Regional Mexican', sub: 'Corridos and banda', g: [65], q: ['Regional Mexicano', 'Corridos'], c: ['#56ab2f', '#c0392b'] },
    { id: 'country', name: 'Country', sub: 'Nashville now', g: [84], q: ['Country Hits'], c: ['#c79081', '#7b4397'] },
    { id: 'house', name: 'EDM & House', sub: 'Festival energy', g: [113, 106], q: ['Dance Hits', 'House Hits'], c: ['#00f2fe', '#4facfe'] },
    { id: 'dancehall', name: 'Dancehall', sub: 'Reggae and dancehall', g: [144], q: ['Dancehall Hits'], c: ['#fceabb', '#f8b500'] },
    { id: 'kpop', name: 'K-Pop', sub: 'Seoul to the world', q: ['K-Pop Hits', 'KPop Hits'], c: ['#ff9a9e', '#a18cd1'] },
    { id: 'rock', name: 'Rock', sub: 'Guitars up', g: [152], q: ['Rock Hits'], c: ['#434343', '#c31432'] },
    { id: 'gospel', name: 'Gospel', sub: 'Praise and worship', g: [186], q: ['Gospel Hits', 'Worship Hits'], c: ['#f6d365', '#fda085'] },
    { id: 'kids', name: 'Kids', sub: 'The songs every kid knows', q: ['Kidz Bop', 'Kids Hits', 'Disney Hits', 'Kids Party'], tracks: ["Pinkfong | Baby Shark", "HUNTR/X | Golden", "Saja Boys | Soda Pop", "HUNTR/X | How It's Done", "HUNTR/X | What It Sounds Like", "Idina Menzel | Let It Go", "Kristen Bell | Do You Want to Build a Snowman?", "Carolina Gaitán | We Don't Talk About Bruno", "Auli'i Cravalho | How Far I'll Go", "Dwayne Johnson | You're Welcome", "Pharrell Williams | Happy", "Justin Timberlake | CAN'T STOP THE FEELING!", "Anna Kendrick | Get Back Up Again", "Shakira | Try Everything", "Smash Mouth | All Star", "Randy Newman | You've Got a Friend in Me", "Phil Collins | You'll Be in My Heart", "Carmen Twillie | Circle of Life", "Nathan Lane | Hakuna Matata", "Samuel E. Wright | Under the Sea", "Lin-Manuel Miranda | Dos Oruguitas", "Sebastián Yatra | Dos Oruguitas", "Ylvis | The Fox (What Does the Fox Say?)", "Mark Ronson | Uptown Funk", "Taylor Swift | Shake It Off", "Katy Perry | Roar", "Rachel Platten | Fight Song", "Bruno Mars | Count on Me", "Meghan Trainor | Better When I'm Dancin'", "Dua Lipa | Dance The Night", "Los del Rio | Macarena", "DJ Casper | Cha Cha Slide", "Psy | Gangnam Style", "The Wiggles | Hot Potato", "CoComelon | Wheels on the Bus", "CoComelon | Bath Song", "CoComelon | Yes Yes Vegetables Song", "CoComelon | Johny Johny Yes Papa", "Super Simple Songs | The Wheels On The Bus", "Bluey | Bluey Theme Tune", "Blippi | The Excavator Song", "Daniel Tiger | Daniel Tiger's Neighborhood Theme", "Kidz Bop Kids | Golden", "Kidz Bop Kids | Espresso", "Kidz Bop Kids | APT.", "Kidz Bop Kids | Shake It Off", "Moana | Where You Are", "Frozen 2 | Into the Unknown", "Idina Menzel | Into the Unknown", "Disney Junior | Mickey Mouse Clubhouse Theme", "Encanto | Surface Pressure", "Jessica Darrow | Surface Pressure", "Minions | Banana", "Vianney | Pas là", "Zootopia | Try Everything", "Trolls | Can't Stop the Feeling!", "Black Eyed Peas | I Gotta Feeling", "Sia | Unstoppable", "Walk the Moon | Shut Up and Dance", "Imagine Dragons | On Top Of The World", "Coldplay | Adventure of a Lifetime"], tracksWord: 'kids favorites', boostN: 61, kids: true, c: ['#ffd23f', '#3ec6ff'] },
    { id: 'bollywood', name: 'Bollywood', sub: 'Desi hits', g: [81], q: ['Bollywood Hits'], c: ['#ff8008', '#ffc837'] },
    { id: 'brazil', name: 'Brazilian', sub: 'Funk and sertanejo', g: [75], q: ['Funk Brasil Hits', 'Sertanejo Hits'], c: ['#11998e', '#f9d423'] },
    { id: 'soul', name: 'Soul & Funk', sub: 'Classic grooves', g: [169], q: ['Soul Classics'], c: ['#b24592', '#f15f79'] },
  ];
  const genreOf = (id) => GENRES.find((x) => x.id === id) || GENRES[0];
  async function genreTracks(gid, limit, extra) {
    const r = await dz(`/chart/${gid}/tracks`, { limit });
    return (r.data || []).filter((t) => t.preview).map((t, i) => addToPool(trackFromDz(t, { ...extra, chartPos: i + 1 })));
  }
  async function playlistFor(q) {
    const cache = store.get('gpl', {});
    if (cache[q] !== undefined) return cache[q];
    let id = null;
    try {
      const r = await dz('/search/playlist', { q, limit: 15 });
      const word = q.toLowerCase().split(' ')[0].replace(/[^a-z0-9&]/g, '');
      const ok = (r.data || []).filter((p) => p.nb_tracks >= 25 && p.title.toLowerCase().replace(/[^a-z0-9& ]/g, '').includes(word));
      const ed = ok.find((p) => p.user && (+p.user.id === CHARTS_OWNER || /deezer|editor/i.test(p.user.name || '')));
      id = (ed || ok[0] || {}).id || null;
    } catch {}
    cache[q] = id; store.set('gpl', cache);
    return id;
  }
  // several playlists per search; era DJs only take playlists named for their year
  async function playlistsFor(q, must, n) {
    const key = q + '|' + (must || '') + '|' + n;
    const cache = store.get('gpl2', {});
    if (cache[key] && cache[key].length) return cache[key];
    let ids = [];
    try {
      const r = await dz('/search/playlist', { q, limit: 25 });
      const word = String(must || q.toLowerCase().split(' ')[0]).toLowerCase().replace(/[^a-z0-9&]/g, '');
      const ok = (r.data || []).filter((p) => p.nb_tracks >= 25 && p.title.toLowerCase().replace(/[^a-z0-9& ]/g, '').includes(word));
      const ed = (p) => (p.user && (+p.user.id === CHARTS_OWNER || /deezer|editor/i.test(p.user.name || '')) ? 1 : 0);
      ids = ok.map((p, i) => [p, i]).sort((a, b) => (ed(b[0]) - ed(a[0])) || (a[1] - b[1])).slice(0, n).map((x) => x[0].id);
    } catch {}
    if (ids.length) { cache[key] = ids; store.set('gpl2', cache); }
    return ids;
  }
  async function loadArtistAll(G) {
    let a = G.aid ? { id: G.aid } : null;
    if (!a) {
      const r = await dz('/search/artist', { q: G.artist, limit: 5 });
      const same = (x) => x.name.toLowerCase() === G.artist.toLowerCase();
      a = (r.data || []).filter(same).sort((x, y) => (y.nb_fan || 0) - (x.nb_fan || 0))[0] || (r.data || [])[0];
    }
    if (!a) return;
    const aid = String(a.id);
    const mine = (t) => t.preview && ((t.artist && String(t.artist.id) === aid) || (t.contributors || []).some((c) => String(c.id) === aid));
    const skip = /instrumental|karaoke|sped ?up|slowed|a ?cappella|acapella|\(inst/i;
    const seenT = new Set();
    const fresh = (t) => { const k = String(t.title_short || t.title).toLowerCase().replace(/\(clean( edit)?\)|\(explicit\)|\(clean version\)/g, '').trim(); if (skip.test(t.title) || seenT.has(k)) return false; seenT.add(k); return true; };
    const [top, albums] = await Promise.all([dz(`/artist/${a.id}/top`, { limit: 100 }), dz(`/artist/${a.id}/albums`, { limit: 50 })]);
    // the artist's own songs lead; collabs where they're only featured come up now and then
    (top.data || []).filter((t) => mine(t) && fresh(t)).forEach((t, i) => addToPool(trackFromDz(t, { genre: G.id, chartPos: t.artist && String(t.artist.id) === aid ? i + 1 : 95 })));
    const albumTracks = await poolLimit(albums.data || [], 4, async (al) => ((await dz(`/album/${al.id}/tracks`, { limit: 100 })).data || []).map((t) => ({ ...t, album: t.album || { cover_medium: al.cover_medium } })));
    for (const list of albumTracks) for (const t of list || []) if (mine(t) && fresh(t)) addToPool(trackFromDz(t, { genre: G.id }));
  }
  // a DJ built from a fixed list of songs: find each on Deezer
  async function loadTrackList(G) {
    let found = 0;
    const norm = (x) => String(x || '').toLowerCase().replace(/\(.*?\)|\[.*?\]/g, '').replace(/[^a-z0-9]/g, '');
    await poolLimit(G.tracks.map((x, i) => [x, i]), 4, async ([x, i]) => {
      const [artist, title] = x.split(' | ');
      const want = norm(title), who = norm(artist);
      const hit = (list) => (list || []).find((t) => t.preview && norm(t.title_short || t.title).startsWith(want) && (norm(t.artist && t.artist.name).includes(who) || who.includes(norm(t.artist && t.artist.name)))) ;
      let t = null;
      try { t = hit((await dz('/search', { q: `artist:"${artist}" track:"${title}"`, limit: 5 })).data); } catch {}
      if (!t) { try { t = hit((await dz('/search', { q: `${artist} ${title}`, limit: 8 })).data); } catch {} }
      if (t) { const p = addToPool(trackFromDz(t, { genre: G.id, chartPos: i + 1 })); if (p && i < (G.boostN || 0)) p.boost = 2; found++; }
    });
    toast(`${G.name} DJ: ${found} of ${G.tracks.length} ${G.tracksWord || (G.id === 'igbo' ? 'Igbo classics' : 'soundtrack songs')} ready to mix.`);
  }
  async function loadGenre(G) {
    const jobs = [];
    const seen = new Set();
    for (const gid of G.g || []) jobs.push(genreTracks(gid, 100, { genre: G.id }));
    for (const id of G.pl || []) { seen.add(id); jobs.push(chartTracks(id, 100, { genre: G.id })); }
    for (const q of G.q || []) {
      jobs.push(playlistsFor(q, G.year, G.n || (G.year ? 3 : 1)).then((ids) => Promise.all(ids.filter((id) => !seen.has(id) && seen.add(id)).map((id) => chartTracks(id, G.lim || 80, { genre: G.id }).catch(() => null)))));
    }
    if (G.artist) jobs.push(loadArtistAll(G));
    // artists the DJ must feature: every song of theirs joins, and they come up early in the set
    if (G.boostArtists) jobs.push(poolLimit(G.boostArtists, 3, ([aid, artist]) => loadArtistAll({ id: G.id, artist, aid })).then(() => {
      const ids = new Set(G.boostArtists.map((x) => String(x[0])));
      for (const t of S.pool.values()) if (t.genre === G.id && !t.boost && ids.has(String(t.artistId))) t.boost = 1;
    }));
    // a long hand-picked list keeps arriving while the set plays, so the DJ starts at once from the playlists
    if (G.tracks) { const p = loadTrackList(G); if (G.tracks.length > 80 && G.q) p.catch(() => null); else jobs.push(p); }
    // the artist picker: every song of each artist you chose
    if (G.artistList) jobs.push(poolLimit(G.artistList, 3, (x) => loadArtistAll({ id: G.id, artist: x.name, aid: x.id })));
    await Promise.all(jobs.map((p) => p.catch(() => null)));
    topUp(G); // in the background: the set starts now, and the DJ keeps filling up to 500+ songs while it plays
  }
  // every DJ carries at least 500 songs; more of its kind keeps arriving while it plays.
  // (a single-artist DJ and your own artist picks stay just those artists)
  const POOL_MIN = 500;
  // the Ibiza DJ draws on house and Balearic playlists, so pop and rap hits stay out
  { const g = GENRES.find((x) => x.id === 'ibiza'); if (g) g.q = ['Ibiza Classics', 'Ibiza Anthems', 'Ibiza House', 'Ibiza Closing Party', 'Balearic House']; }
  const inGenre = (gid) => { let n = 0; for (const t of S.pool.values()) if (t.genre === gid) n++; return n; };
  async function topUp(G) {
    if (G.artist || G.artistList || G.king || G.topping) return;
    G.topping = true;
    const full = () => inGenre(G.id) >= POOL_MIN + 20 || S.poolGenre !== G.id;
    try {
      const more = G.id === 'gamenight' ? ['Video Game Soundtrack Hits', 'Gaming Hits', 'Gaming Playlist', 'Game Soundtrack']
        : [G.name + ' Hits', 'Best of ' + G.name, G.name + ' Party', G.name + ' Mix', G.name + ' Classics', G.name + ' Playlist', G.name + ' Throwback', G.name + ' Anthems'];
      const qs = [...new Set([...(G.q || []), ...more])], seen = new Set();
      for (const q of qs) {
        if (full()) break;
        const ids = await playlistsFor(q, G.year, 5).catch(() => []);
        for (const id of ids || []) {
          if (full()) break;
          if (seen.has(id)) continue; seen.add(id);
          await chartTracks(id, 200, { genre: G.id }).catch(() => null);
        }
      }
      for (const gid of G.g || []) { if (full()) break; await genreTracks(gid, 300, { genre: G.id }).catch(() => null); }
    } catch {}
    G.topping = false;
    if (S.running) fillQueue();
    window.dispatchEvent(new CustomEvent('sel:pool'));
  }
  const regionName = (cc) => (REGIONS.find((r) => r[0] === cc) || [cc, cc])[1];
  async function chartId(cc) {
    const cache = store.get('charts', {});
    if (cache[cc] !== undefined) return cache[cc];
    const names = CHART_NAMES[cc] || [regionName(cc)];
    let id = null;
    for (const n of names) {
      try {
        const r = await dz('/search/playlist', { q: 'Top ' + n, limit: 25 });
        const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[^a-z ]/g, '').trim();
        const hit = (r.data || []).find((p) => p.user && +p.user.id === CHARTS_OWNER && names.some((x) => norm(p.title) === norm('Top ' + x)));
        if (hit) { id = hit.id; break; }
      } catch {}
    }
    cache[cc] = id; store.set('charts', cache);
    return id;
  }
  async function chartTracks(id, limit, extra) {
    const r = await dz(`/playlist/${id}/tracks`, { limit });
    return (r.data || []).filter((t) => t.preview).map((t, i) => addToPool(trackFromDz(t, { ...extra, chartPos: i + 1 })));
  }
  async function loadRegion() {
    const cc = S.region;
    S.localArtists = [];
    const jobs = [];
    const localId = cc ? await chartId(cc) : null;
    if (localId) jobs.push(chartTracks(localId, 80, { local: true }).then((ts) => { S.localArtists = ts.filter(Boolean); }));
    else if (cc) toast(`No ${regionName(cc)} chart yet, so I'm mixing worldwide and US hits.`);
    if (cc !== 'US') { const us = await chartId('US'); if (us) jobs.push(chartTracks(us, 50, { us: true })); }
    jobs.push(chartTracks(WORLD_CHART, 60, { world: true }));
    // Afrobeats, Afro-fusion and amapiano in every set, wherever you are
    if (cc !== 'NG') jobs.push(chartTracks(NIGERIA_CHART, 45, { afro: true }));
    jobs.push(genreTracks(2, 50, { afro: true }));
    if (cc !== 'ZA') jobs.push(chartId('ZA').then((id) => (id ? chartTracks(id, 25, { afro: true }) : [])));
    await Promise.all(jobs.map((p) => p.catch(() => null)));
  }
  function artistW(id) { const a = S.taste.artists[id]; return a ? a.w : 0; }
  function seedArtists() {
    return Object.entries(S.taste.artists).filter(([, a]) => a.seed).map(([id, a]) => ({ id, ...a })).sort((a, b) => b.w - a.w);
  }

  // ---------- Deezer (through our proxy) ----------
  const dzQ = { n: 0, wait: [] };
  async function dz(path, params = {}, urgent = false) {
    if (!urgent) { if (dzQ.n >= 4) await new Promise((ok) => dzQ.wait.push(ok)); dzQ.n++; }
    try { return await dzRaw(path, params); }
    finally { if (!urgent) { dzQ.n--; const nx = dzQ.wait.shift(); if (nx) nx(); } }
  }
  async function dzRaw(path, params) {
    const q = new URLSearchParams({ p: path, ...params });
    for (let i = 0; i < 3; i++) {
      try {
        const r = await fetch('/api/dz?' + q.toString());
        const j = await r.json();
        if (j && j.error) { if (j.error.code === 4) { await sleep(1200 * (i + 1)); continue; } throw new Error(j.error.message || 'deezer error'); }
        return j;
      } catch (e) { if (i === 2) throw e; await sleep(600 * (i + 1)); }
    }
  }

  function trackFromDz(t, extra = {}) {
    return {
      id: 'dz' + t.id, dzId: t.id, title: t.title_short || t.title, artist: t.artist && t.artist.name,
      artistId: t.artist && String(t.artist.id), cover: t.album && (t.album.cover_medium || t.album.cover),
      duration: t.duration, rank: t.rank || 0, source: 'dz', explicit: !!t.explicit_lyrics, ...extra,
    };
  }

  // a video picked straight from YouTube search: plays as-is, skips Deezer/BPM analysis entirely
  function trackFromYt(v, extra = {}) {
    return {
      id: 'yt' + v.id, ytId: v.id, title: v.title, artist: v.channel, cover: v.thumb,
      duration: 240, rank: 0, source: 'yt', explicit: false, ...extra,
    };
  }

  async function poolLimit(items, n, fn) {
    const out = []; let i = 0;
    await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const k = i++; try { out[k] = await fn(items[k]); } catch { out[k] = null; } } }));
    return out;
  }

  function addToPool(t) {
    if (!t || !t.id || S.taste.bans[t.id]) return;
    // the Kids DJ never takes a song marked explicit
    if (t.genre === 'kids' && (t.explicit || (new Date().getMonth() !== 11 && /christmas|santa|rudolph|jingle|sleigh|snowm[ae]n|mistletoe|holiday/i.test((t.title || '') + ' ' + (t.album || ''))))) return;
    withProto(t);
    if (!S.pool.has(t.id)) S.pool.set(t.id, t);
    else Object.assign(S.pool.get(t.id), Object.fromEntries(Object.entries(t).filter(([, v]) => v != null)));
    return S.pool.get(t.id);
  }

  async function buildPool() {
    setStatus('Digging through the crates…');
    S.poolGenre = S.genre;
    if (S.genre !== 'all') {
      await loadGenre(genreOf(S.genre)).catch(() => null);
      S.poolBuilt = true;
      return;
    }
    await loadRegion().catch(() => null);
    const seeds = seedArtists().slice(0, 10);
    await poolLimit(seeds, 4, async (s) => {
      const [top, rel] = await Promise.all([dz(`/artist/${s.id}/top`, { limit: 14 }), dz(`/artist/${s.id}/related`, { limit: 10 })]);
      (top.data || []).forEach((t) => addToPool(trackFromDz(t)));
      (rel.data || []).forEach((a, i) => {
        const id = String(a.id);
        const cur = S.taste.artists[id];
        const w = s.w * (0.62 - i * 0.025);
        if (!cur) S.taste.artists[id] = { name: a.name, w, pic: a.picture_medium, seed: false, related: true };
        else if (!cur.seed && cur.w < w) cur.w = w;
      });
    });
    const related = Object.entries(S.taste.artists).filter(([, a]) => !a.seed && a.w > 0).sort((a, b) => b[1].w - a[1].w).slice(0, 18);
    await poolLimit(related, 4, async ([id]) => {
      const top = await dz(`/artist/${id}/top`, { limit: 6 });
      (top.data || []).forEach((t) => addToPool(trackFromDz(t, { discovery: true })));
    });
    saveTaste();
    S.poolBuilt = true;
  }

  function tasteScore(t) {
    const personal = seedArtists().length > 0;
    let s = artistW(t.artistId) || (t.fav ? 0.8 : personal ? 0.15 : 0.25);
    if (S.genre !== 'all' && t.genre === S.genre) s += 0.5 - Math.min(80, t.chartPos || 40) * 0.004;
    if (t.local) s += personal ? 0.45 : 0.62 - (t.chartPos || 40) * 0.003;
    else if (t.us) s += personal ? 0.28 : 0.42 - (t.chartPos || 30) * 0.003;
    else if (t.world) s += personal ? 0.25 : 0.36 - (t.chartPos || 30) * 0.003;
    if (t.afro) s += personal ? 0.22 : 0.4 - Math.min(40, t.chartPos || 20) * 0.003;
    if (t.boost && S.genre === t.genre) s += (t.boost > 1 ? 1.4 : 0.75) * Math.max(0, 1 - S.played.length / 24) + 0.15;
    if (S.taste.likes[t.id] || (t.dzId && S.taste.likes['dz' + t.dzId])) s += 0.6;
    if (t.fav) s += 0.5;
    s += (Math.log10((t.rank || 0) + 1) / 6) * 0.25;
    return s;
  }

  // ---------- analysis queue ----------
  let actx = null;
  function nextCandidate() {
    const busyArtists = {};
    for (const t of S.ready) busyArtists[t.artistKey()] = (busyArtists[t.artistKey()] || 0) + 1;
    for (const id of S.analyzing) { const t = S.pool.get(id); if (t) busyArtists[t.artistKey()] = (busyArtists[t.artistKey()] || 0) + 1; }
    const recent = S.played.slice(-6).map((t) => t.artistKey());
    let best = null, bestS = -Infinity;
    for (const t of S.pool.values()) {
      if (t.used || t.failed || t.analyzed || S.analyzing.has(t.id) || S.taste.bans[t.id]) continue;
      if (S.mode === 'spotify' && t.noSpotify) continue;
      if (S.mode === 'youtube' && t.noYt) continue;
      if (S.genre !== 'all' && t.genre !== S.genre) continue;
      let s = tasteScore(t) + Math.random() * 0.35 - 0.45 * (busyArtists[t.artistKey()] || 0) - (recent.includes(t.artistKey()) ? 0.5 : 0);
      if (t.discovery) s += 0.05 * Math.random();
      if (s > bestS) { bestS = s; best = t; }
    }
    return best;
  }

  function recycle() {
    const recent = new Set(S.played.slice(-40).map((t) => t.id));
    let n = 0;
    for (const t of S.pool.values()) {
      if (!t.used || t.failed || recent.has(t.id) || S.taste.bans[t.id]) continue;
      if (S.genre !== 'all' && t.genre !== S.genre) continue;
      t.used = false; t.analyzed = false; t.requested = 0; n++;
    }
    return n > 0;
  }
  function fillQueue() {
    if (!S.running && !S.warming) return;
    const kmax = kingOn() && S.mode === 'preview';
    while (S.ready.length + S.analyzing.size < (kmax ? 10 : READY_MAX) && S.analyzing.size < (kmax ? 3 : 2)) {
      let c = nextCandidate();
      if (!c && recycle()) c = nextCandidate();
      if (!c) break;
      S.analyzing.add(c.id);
      analyzeTrack(c)
        .then(() => { c.analyzed = true; S.ready.push(c); renderUpNext(); })
        .catch((e) => { c.failed = true; console.warn('skip track', c.title, e && e.message); })
        .finally(() => { S.analyzing.delete(c.id); setTimeout(fillQueue, 50); });
    }
  }

  async function resolveDeezer(t) {
    if (t.dzId) return;
    let found = null;
    if (t.isrc) { try { const r = await dz('/track/isrc:' + t.isrc); if (r && r.id) found = r; } catch {} }
    if (!found) {
      const r = await dz('/search', { q: `artist:"${t.artist}" track:"${t.title}"`, limit: 3 });
      found = r && r.data && r.data[0];
    }
    if (!found) throw new Error('no catalog match');
    t.dzId = found.id;
    if (!t.cover && found.album) t.cover = found.album.cover_medium;
  }

  async function analyzeTrack(t) {
    // picked straight from YouTube search: no Deezer match to analyze, so skip beat
    // analysis and give it neutral BPM/energy/key so the now-playing UI and sequencing
    // (which both read t.f) still work; it just won't beat-match into the mix.
    if (t.source === 'yt') {
      if (S.mode !== 'youtube') throw new Error('YouTube search results only play in YouTube mode');
      t.f = t.f || { bpm: 120, rmsDb: -15, energy: 0.5, beatOffset: 0, beatStrength: 0, camelot: '', key: '' };
      t.gain = t.gain == null ? 1 : t.gain;
      S.energies.push(t.f.energy);
      return;
    }
    await resolveDeezer(t);
    if (S.mode === 'spotify' && !t.spotifyUri) {
      const uri = await SP.findUri(t);
      if (!uri) { t.noSpotify = true; throw new Error('not on Spotify'); }
      t.spotifyUri = uri;
    }
    const d = await dz('/track/' + t.dzId);
    if (!d || !d.preview) throw new Error('no preview');
    t.duration = t.duration || d.duration;
    if (!t.cover && d.album) t.cover = d.album.cover_medium;
    const r = await fetch('/api/audio?u=' + encodeURIComponent(d.preview));
    if (!r.ok) throw new Error('audio ' + r.status);
    const ab = await r.arrayBuffer();
    const ctx = actx || new (window.OfflineAudioContext)(2, 44100, 44100);
    const buffer = await new Promise((res, rej) => ctx.decodeAudioData(ab, res, rej));
    t.f = await A.analyze(buffer, d.bpm);
    t.gain = clamp(Math.pow(10, (-15 - t.f.rmsDb) / 20), 0.45, 2.2);
    if (S.mode === 'youtube' && !t.ytId) {
      const id = await YTM.findVideo(t);
      if (!id) { t.noYt = true; throw new Error('not on YouTube'); }
      t.ytId = id;
    }
    if (S.mode === 'preview') t.buffer = buffer;
    S.energies.push(t.f.energy);
  }

  // ---------- sequencing ----------
  function energyPct(e) {
    const arr = S.energies;
    if (arr.length < 6) return e;
    let below = 0; for (const v of arr) if (v < e) below++;
    return below / arr.length;
  }
  const ARC_LEN = 18;
  function targetEnergy(i) {
    const t = (i % ARC_LEN) / ARC_LEN;
    let v;
    if (t < 0.25) v = 0.3 + (t / 0.25) * 0.25;
    else if (t < 0.6) v = 0.55 + ((t - 0.25) / 0.35) * 0.32;
    else if (t < 0.8) v = 0.9;
    else v = 0.9 - ((t - 0.8) / 0.2) * 0.35;
    const shift = S.mood === 'chill' ? -0.28 : S.mood === 'party' ? 0.12 : 0;
    return clamp(v + shift, 0.05, 0.98);
  }
  function arcPhase(i) {
    const t = (i % ARC_LEN) / ARC_LEN;
    return t < 0.25 ? 'warm' : t < 0.6 ? 'build' : t < 0.8 ? 'peak' : 'cool';
  }

  function scoreNext(prev, t, idx) {
    const parts = {};
    parts.taste = tasteScore(t);
    parts.harm = prev && prev.f ? A.harmonic(prev.f, t.f) : 0.7;
    let tempo = 0.7, ratio = 1;
    if (prev && prev.f) {
      const m = A.tempoMatch(prev.f.bpm * (prev._rate || 1), t.f.bpm);
      ratio = m.ratio;
      tempo = m.diff < 0.025 ? 1 : m.diff < 0.05 ? 0.8 : m.diff < 0.08 ? 0.45 : 0.05;
    }
    parts.tempo = tempo;
    const target = targetEnergy(idx);
    parts.energy = 1 - Math.min(1, Math.abs(energyPct(t.f.energy) - target) * 2.2);
    const recent = S.played.slice(-8).map((x) => x.artistKey());
    const last = recent.lastIndexOf(t.artistKey());
    parts.repeat = last < 0 ? 0 : (recent.length - last <= 3 ? -2.5 : -0.6);
    const kb = kingOn() && S.mode === 'preview';
    parts.blendable = 0;
    if (kb && t.f) {
      if (t.f.beatStrength < 1.2) parts.blendable -= 1.2;
      if (prev && prev.f && tempo >= 0.8 && parts.harm >= 0.3 && t.f.beatStrength > 1.2) parts.blendable += 1;
    }
    const total = parts.taste * 0.9 + parts.harm * (kb ? 1.6 : 1.1) + parts.tempo * (S.mode === 'preview' ? (kb ? 1.9 : 0.9) : 0.4) + parts.energy * (kb ? 0.6 : 1.0) + parts.repeat + parts.blendable;
    return { total, parts, ratio, target };
  }

  function kingOn() { return !!S.king || S.genre === 'blends'; }
  function syncKing() {
    document.body.dataset.king = kingOn() ? '1' : '';
    document.querySelectorAll('.king-sw').forEach((b) => { b.classList.toggle('on', kingOn()); b.setAttribute('aria-pressed', String(kingOn())); });
  }
  function chooseNext(prev) {
    let best = null;
    const req = S.ready.filter((t) => t.requested).sort((a, b) => a.requested - b.requested)[0];
    if (req) best = { t: req, s: scoreNext(prev, req, S.setIndex) };
    if (!best) for (const t of S.ready) {
      const s = scoreNext(prev, t, S.setIndex);
      if (!best || s.total > best.s.total) best = { t, s };
    }
    if (!best) return null;
    S.ready.splice(S.ready.indexOf(best.t), 1);
    best.t.used = true;
    S.played.push(best.t);
    S.setIndex++;
    fillQueue();
    return best;
  }

  function reasonText(prev, pick) {
    const t = pick.t, p = pick.s.parts, bits = [];
    if (prev && prev.f) {
      if (p.harm >= 0.85) bits.push(`${prev.f.camelot} → ${t.f.camelot} harmonic mix`);
      else if (p.harm >= 0.5) bits.push(`${prev.f.camelot} → ${t.f.camelot} key lift`);
      if (p.tempo >= 0.8) bits.push(`tempo locked at ${Math.round(prev.f.bpm * (prev._rate || 1))} BPM`);
    }
    const ph = arcPhase(S.setIndex - 1);
    bits.push({ warm: 'warming up', build: 'building energy', peak: 'peak time', cool: 'bringing it down' }[ph]);
    if (isNew(t)) bits.push('new find for you');
    else if (t.fav) bits.push('one of your favorites');
    return bits.join(' · ');
  }

  // ---------- DJ voice ----------
  // Default on computers: a free AI voice (Kokoro, runs in the browser, downloaded once and cached).
  // Phones, or if the AI voice can't load: the device's own best voice.
  const IS_PHONE = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  const AI_VOICES = [
    ['am_michael', 'Michael · radio host'],
    ['af_heart', 'Heart · smooth'],
    ['am_fenrir', 'Fenrir · deep'],
    ['af_bella', 'Bella · bright'],
    ['bm_george', 'George · British'],
    ['bf_emma', 'Emma · British'],
  ];
  if (!S.voiceId) S.voiceId = store.get('voiceId', IS_PHONE ? 'device' : 'ai:am_michael');
  const TTS_WORKER = [
    "import { KokoroTTS } from 'https://cdn.jsdelivr.net/npm/kokoro-js@1.2.1/dist/kokoro.web.js';",
    'let tts = null;',
    'self.onmessage = async (e) => { const m = e.data; try {',
    "  if (m.type === 'load') { if (!tts) tts = await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', { dtype: 'q8', device: 'wasm' }); self.postMessage({ id: m.id, ok: true }); }",
    "  else if (m.type === 'say') { const a = await tts.generate(m.text, { voice: m.voice, speed: 1.02 }); self.postMessage({ id: m.id, ok: true, audio: a.audio, rate: a.sampling_rate }); }",
    '} catch (err) { self.postMessage({ id: m.id, ok: false, err: String((err && err.message) || err) }); } };',
  ].join('\n');
  const AIVoice = {
    w: null, ready: false, p: null, failed: false, src: null, state: 'idle', n: 0, cbs: {},
    call(msg, ms) {
      return new Promise((res, rej) => {
        const id = ++this.n; this.cbs[id] = { res, rej };
        this.w.postMessage({ ...msg, id });
        setTimeout(() => { if (this.cbs[id]) { delete this.cbs[id]; rej(new Error('timeout')); } }, ms || 60000);
      });
    },
    load() {
      if (this.ready) return Promise.resolve(true);
      if (this.failed) return Promise.resolve(null);
      if (!this.p) {
        this.state = 'loading'; Voice.renderPicker();
        this.p = (async () => {
          try {
            this.w = new Worker(URL.createObjectURL(new Blob([TTS_WORKER], { type: 'text/javascript' })), { type: 'module' });
            this.w.onmessage = (e) => { const d = e.data, cb = this.cbs[d.id]; if (!cb) return; delete this.cbs[d.id]; if (d.ok) cb.res(d); else cb.rej(new Error(d.err)); };
            this.w.onerror = () => { for (const k of Object.keys(this.cbs)) { this.cbs[k].rej(new Error('voice worker failed')); delete this.cbs[k]; } };
            await this.call({ type: 'load' }, 180000);
            this.ready = true; this.state = 'ready'; Voice.renderPicker();
            return true;
          } catch (e) {
            console.warn('AI voice unavailable', e);
            this.failed = true; this.state = 'failed'; Voice.renderPicker();
            try { this.w && this.w.terminate(); } catch {}
            return null;
          }
        })();
      }
      return this.p;
    },
    stop() { try { if (this.src) this.src.stop(); } catch {} this.src = null; },
    // true when spoken, 'skip' when not ready in time, false when it can't work here
    async speak(text, voice) {
      const ok = this.ready || await Promise.race([this.load(), sleep(20000).then(() => 'late')]);
      if (ok === 'late') return 'skip';
      if (!ok) return false;
      let audio;
      try { const d = await this.call({ type: 'say', text, voice }, 30000); audio = { audio: d.audio, sampling_rate: d.rate }; } catch (e) { console.warn(e); return false; }
      if (!S.voice || !actx) return true;
      if (actx.state === 'suspended') { try { await actx.resume(); } catch {} }
      return new Promise((res) => {
        this.stop();
        const buf = actx.createBuffer(1, audio.audio.length, audio.sampling_rate);
        buf.copyToChannel(audio.audio, 0);
        const src = actx.createBufferSource(); src.buffer = buf;
        const hp = actx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 85;
        const pres = actx.createBiquadFilter(); pres.type = 'peaking'; pres.frequency.value = 3200; pres.gain.value = 3; pres.Q.value = 0.8;
        const comp = actx.createDynamicsCompressor(); comp.threshold.value = -22; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.2;
        const g = actx.createGain(); g.gain.value = 1.25;
        src.connect(hp).connect(pres).connect(comp).connect(g).connect(actx.destination);
        this.src = src;
        Engine.duck();
        src.onended = () => { if (this.src === src) this.src = null; Engine.unduck(); res(true); };
        src.start();
      });
    },
  };
  // ---------- Ibiza DJ voices (ElevenLabs): fixed lines, recorded once and kept, so every listener reuses them ----------
  const ELV = {
    info: null, bufs: new Map(), src: null,
    load() {
      if (!this.p) this.p = fetch('/api/voice?list=1').then((r) => r.json()).catch(() => ({ ready: false, voices: [] })).then((d) => { this.info = d; Voice.renderPicker(); return d; });
      return this.p;
    },
    ready() { return !!(this.info && this.info.ready); },
    scope(key) { const v = ((this.info && this.info.voices) || []).find((x) => x.key === key); return v ? v.scope : null; },
    // the main voices work on every DJ; the kids voices on the Kids DJ; the Indian voices on the Bollywood DJ; Ifeoma on the Afrobeats and Igbo DJs
    allowed(key, g) { const s = this.scope(key); return s === 'main' || (s === 'kids' && g === 'kids') || (s === 'hindi' && g === 'bollywood') || (s === 'afro' && (g === 'afrobeats' || g === 'igbo')); },
    pickLine(key, kind) {
      const s = this.scope(key), L = (this.info.lines || {})[s] || {}, ids = Object.keys(L);
      const any = (pre) => { const c = ids.filter((x) => x.startsWith(pre)); return c[Math.floor(Math.random() * c.length)]; };
      if (kind === 'intro') return s === 'hindi' ? 'intro_bollywood' : s === 'kids' ? 'intro_kids' : (L['intro_' + S.genre] ? 'intro_' + S.genre : 'intro_all');
      return s === 'hindi' ? any('hin') : s === 'kids' ? any('kid') : s === 'afro' ? any('afro') : any('drop');
    },
    async buffer(url, headers) {
      if (this.bufs.has(url)) return this.bufs.get(url);
      const r = await fetch(url, { headers });
      if (!r.ok) throw new Error('voice ' + r.status);
      const b = await actx.decodeAudioData(await r.arrayBuffer());
      this.bufs.set(url, b);
      return b;
    },
    play(buf) {
      return new Promise((res) => {
        this.stop();
        const src = actx.createBufferSource(); src.buffer = buf;
        const hp = actx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 90;
        const comp = actx.createDynamicsCompressor(); comp.threshold.value = -20; comp.ratio.value = 3; comp.attack.value = 0.004; comp.release.value = 0.2;
        const g = actx.createGain(); g.gain.value = 1.15;
        src.connect(hp).connect(comp).connect(g).connect(actx.destination);
        this.src = src; Engine.duck();
        src.onended = () => { if (this.src === src) this.src = null; Engine.unduck(); res(true); };
        src.start();
      });
    },
    stop() { try { if (this.src) this.src.stop(); } catch {} this.src = null; },
    // returns the words spoken, or null when this voice can't say it right now
    async speak(key, kind) {
      if (!this.ready() || !actx) return null;
      try {
        let url, headers, words;
        if (kind === 'name') {
          const u = window.firebase && window.firebase.apps && window.firebase.apps.length && window.firebase.auth().currentUser;
          if (!u) return null;
          url = `/api/voice?v=${encodeURIComponent(key)}&l=name`; headers = { authorization: 'Bearer ' + await u.getIdToken() };
          words = null;
        } else {
          const l = this.pickLine(key, kind); if (!l) return null;
          url = `/api/voice?v=${encodeURIComponent(key)}&l=${encodeURIComponent(l)}`;
          words = (this.info.text || {})[l] || null;
        }
        const buf = await this.buffer(url, headers);
        if (!S.voice) return '';
        if (actx.state === 'suspended') { try { await actx.resume(); } catch {} }
        if (words) setDjNote('🎙 ' + words);
        await this.play(buf);
        return words || '';
      } catch (e) { console.warn('DJ voice', e && e.message); return null; }
    },
  };
  // ---------- Kids DJ nickname: typed on this device, kept only on this device, spoken only by a voice that runs here ----------
  const Kid = {
    name() { const n = String(store.get('kidName', '') || '').trim(); return /^[\p{L}' -]{1,16}$/u.test(n) ? n : ''; },
    // never sent anywhere: the free AI voice runs in this browser; otherwise only an on-device system voice
    async say(text) {
      if (!S.voice) return;
      setDjNote('🎙 ' + text);
      if (!IS_PHONE && await Promise.race([AIVoice.load(), sleep(8000).then(() => null)])) { if ((await AIVoice.speak(text, 'af_heart')) === true) return; }
      if (!('speechSynthesis' in window)) return;
      const v = speechSynthesis.getVoices().find((x) => x.localService && /^en/i.test(x.lang));
      if (!v) return;
      await new Promise((res) => { try { const u = new SpeechSynthesisUtterance(text); u.voice = v; u.pitch = 1.15; u.rate = 1.02; let d = false; const end = () => { if (!d) { d = true; Engine.unduck(); res(); } }; u.onend = end; u.onerror = end; Engine.duck(); setTimeout(end, 8000); speechSynthesis.speak(u); } catch { res(); } });
    },
    // asked once, before the first Kids DJ set; a grown-up can type a nickname or skip
    ask() {
      return new Promise((done) => {
        if (store.get('kidAsked', false)) return done();
        const box = document.createElement('div');
        box.className = 'kid-ask';
        box.innerHTML = `<div class="kid-card" role="dialog" aria-label="Kids DJ nickname"><b>Want the DJ to say your child's name?</b><p>Grown-ups: type a first name or nickname. It stays on this device only, and Ibiza never receives it.</p><input id="kid-name" maxlength="16" autocomplete="off" placeholder="Nickname (optional)"><div class="kid-row"><button type="button" id="kid-skip">Skip</button><button type="button" id="kid-ok">Save</button></div></div>`;
        document.body.appendChild(box);
        const close = (save) => { if (save) store.set('kidName', String($('#kid-name').value || '').trim().slice(0, 16)); store.set('kidAsked', true); box.remove(); done(); };
        $('#kid-ok').onclick = () => close(true); $('#kid-skip').onclick = () => close(false);
        setTimeout(() => { try { $('#kid-name').focus(); } catch {} }, 50);
      });
    },
  };
  {
    const st = document.createElement('style');
    st.textContent = '.kid-ask{position:fixed;inset:0;z-index:120;display:grid;place-items:center;background:rgba(6,4,12,.7);backdrop-filter:blur(8px)}.kid-card{width:min(420px,calc(100vw - 32px));padding:22px;border-radius:22px;background:#171126;border:1px solid rgba(255,255,255,.12);color:#fff}.kid-card b{font-size:19px}.kid-card p{color:#c9c0e4;margin:8px 0 14px;font-size:14px}.kid-card input{width:100%;height:46px;border-radius:14px;border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.06);color:#fff;font:inherit;font-size:16px;padding:0 14px}.kid-row{display:flex;gap:10px;justify-content:flex-end;margin-top:14px}.kid-row button{height:42px;padding:0 18px;border-radius:21px;border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.06);color:#fff;font:inherit;font-weight:700;cursor:pointer}#kid-ok{border:0;background:linear-gradient(135deg,#ffd23f,#3ec6ff);color:#14101f}';
    document.head.appendChild(st);
  }
  // the voice in use on this DJ: your pick when it fits this DJ, the kids host on the Kids DJ
  function djVoice() {
    let id = S.voiceId || 'device';
    if (ELV.ready()) {
      // Ifeoma hosts the Afrobeats and Igbo DJs unless you picked another voice
      const host = ELV.allowed('ifeoma', S.genre) ? 'el:ifeoma' : 'el:jerry';
      if (!store.get('voiceId', null)) id = host;
      if (S.genre === 'kids' && !(id.startsWith('el:') && ELV.allowed(id.slice(3), 'kids'))) id = 'el:sparkles';
      if (id.startsWith('el:') && !ELV.allowed(id.slice(3), S.genre)) id = host;
    } else if (id.startsWith('el:')) id = IS_PHONE ? 'device' : 'ai:am_michael';
    return id;
  }
  const Voice = {
    v: null,
    deviceVoices() {
      if (!('speechSynthesis' in window)) return [];
      return speechSynthesis.getVoices().filter((x) => /^en/i.test(x.lang));
    },
    pick(uri) {
      if (!('speechSynthesis' in window)) return null;
      const vs = speechSynthesis.getVoices();
      if (uri) { const f = vs.find((x) => x.voiceURI === uri); if (f) return (this.v = f); }
      const pref = ['Google UK English Male', 'Microsoft Guy', 'Microsoft Andrew', 'Microsoft Christopher', 'Daniel', 'Google US English', 'Aaron', 'Alex', 'Samantha'];
      for (const n of pref) { const f = vs.find((x) => x.name.includes(n)); if (f) return (this.v = f); }
      return (this.v = vs.find((x) => /en[-_]US/i.test(x.lang)) || vs.find((x) => /^en/i.test(x.lang)) || null);
    },
    renderPicker() {
      const sel = document.getElementById('voice-pick'); if (!sel) return;
      const st = AIVoice.state;
      const tag = st === 'loading' ? ' (loading…)' : st === 'failed' ? ' (unavailable)' : '';
      const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
      const ai = AI_VOICES.map(([id, n]) => `<option value="ai:${id}">${n}${tag}</option>`).join('');
      const dev = this.deviceVoices().slice(0, 12).map((x) => `<option value="dev:${esc(x.voiceURI)}">${esc(x.name)}</option>`).join('');
      const el = ELV.ready() ? (ELV.info.voices || []).filter((x) => ELV.allowed(x.key, S.genre)).map((x) => `<option value="el:${esc(x.key)}">${esc(x.label)}</option>`).join('') : '';
      sel.innerHTML = (el ? `<optgroup label="Ibiza DJ voices">${el}</optgroup>` : '') + `<optgroup label="Free AI voices">${ai}</optgroup><optgroup label="This device"><option value="device">Best device voice</option>${dev}</optgroup>`;
      const cur = djVoice();
      sel.value = cur;
      if (sel.value !== cur) sel.value = 'device';
    },
    device(text, uri) {
      if (!('speechSynthesis' in window)) return Promise.resolve();
      return new Promise((res) => {
        try {
          speechSynthesis.cancel();
          const u = new SpeechSynthesisUtterance(text);
          this.pick(uri);
          if (this.v) u.voice = this.v;
          u.rate = 1.0; u.pitch = 0.92;
          let done = false;
          const end = () => { if (!done) { done = true; Engine.unduck(); res(); } };
          u.onend = end; u.onerror = end;
          Engine.duck();
          setTimeout(end, 14000);
          speechSynthesis.speak(u);
        } catch { res(); }
      });
    },
    async say(text, kind) {
      if (!text) return;
      if (!S.voice) { setDjNote('🎙 ' + text); return; }
      if (S.mode === 'preview' && Engine.mix) { setDjNote('🎙 ' + text); return; }
      let id = djVoice();
      if (id.startsWith('el:')) {
        if (kind === 'name') setDjNote('🎙 ' + text);
        if (kind && (await ELV.speak(id.slice(3), kind)) !== null) return;
        id = IS_PHONE ? 'device' : 'ai:am_michael';
      }
      setDjNote('🎙 ' + text);
      if (id.startsWith('ai:')) {
        const r = await AIVoice.speak(text, id.slice(3));
        if (r === true || r === 'skip') return;
      }
      return this.device(text, id.startsWith('dev:') ? id.slice(4) : null);
    },
    stopAll() { AIVoice.stop(); ELV.stop(); if ('speechSynthesis' in window) speechSynthesis.cancel(); try { Engine.unduck(); } catch {} },
  };
  if ('speechSynthesis' in window) speechSynthesis.onvoiceschanged = () => { Voice.pick(); Voice.renderPicker(); };
  ELV.load();

  function introLine() {
    const seeds = seedArtists().slice(0, 3).map((a) => a.name);
    const list = seeds.length > 1 ? seeds.slice(0, -1).join(', ') + ' and ' + seeds[seeds.length - 1] : seeds[0] || 'your favorites';
    const moodLine = S.mood === 'chill' ? "We're keeping it smooth and easy." : S.mood === 'party' ? "We're here to move, so let's get it going." : "We'll ease in, then take it up.";
    if (S.genre === 'artists') { const L = genreOf('artists').artistList || []; return `Welcome to Ibiza. Tonight is all about ${L.length > 3 ? L.slice(0, 3).map((x) => x.name).join(', ') + ' and ' + (L.length - 3) + ' more' : L.map((x) => x.name).join(' and ')}, back to back. ${moodLine}`; }
    if (S.genre === 'kids') return `Hey, hey! Welcome to the Kids DJ. All your favorite songs, one after another. Get ready to dance and sing along!`;
    if (S.genre === 'ibiza') return `Welcome to Ibiza. This is the Ibiza DJ: every anthem the island knows, back to back, from sunset to sunrise. Hands up, Ibiza! ${moodLine}`;
    if (S.genre === 'igbo') return `Welcome to Ibiza. Your Igbo DJ is on the decks: the greatest Igbo songs of all time, from the highlife legends to the new wave. Igbo kwenu! ${moodLine}`;
    if (S.genre === 'blends') return `Welcome to Ibiza. The King of Blends is on the decks. Vocals from one hit, over the beat of the next. ${moodLine}`;
    if (S.genre !== 'all') return `Welcome to Ibiza. This is your ${genreOf(S.genre).name} DJ, playing the biggest ${genreOf(S.genre).name} songs right now. ${moodLine}`;
    if (!seeds.length) return `Welcome to Ibiza. Tonight's set is the biggest songs in ${regionName(S.region || 'US')} and around the world, with plenty of Afrobeats. ${moodLine}`;
    return `Welcome to Ibiza. I built this set around ${list}, plus a few new finds I think you'll love. ${moodLine}`;
  }
  function betweenLine(prev, cur) {
    const ph = arcPhase(S.setIndex - 1);
    const phase = { warm: 'Still warming things up.', build: "Turning it up a notch.", peak: "This is the peak of the set, stay with me.", cool: "Let's bring it down nice and smooth." }[ph];
    const nw = isNew(cur) ? ` Here's someone new I think you'll like, ${cur.artist}.` : ` Up now, ${cur.artist}.`;
    return `That was ${prev.title} by ${prev.artist}. ${phase}${nw}`;
  }

  // ---------- Mixer controls shared by every mode (moved by the AI or by your hands) ----------
  const Ctl = { xf: 0, fader: [1, 1], hi: [0, 0], mid: [0, 0], low: [0, 0], flt: [0, 0], vox: [0, 0], inst: [0, 0], auto: true };
  const xfGains = (x) => [Math.cos((x * Math.PI) / 2), Math.sin((x * Math.PI) / 2)];
  const SEC_PER_TURN = 1.8; // one platter turn at 33⅓ rpm
  const dbToGain = (db) => Math.pow(10, db / 20);
  function eqDb(v) { return v < 0 ? v * 26 : v * 6; } // -1 kills the band, +1 boosts 6 dB

  // ---------- Engine: two-deck mixer for 30-second previews ----------
  const Engine = {
    bus: null, comp: null, analyser: null, ch: [], D: [], timer: null, mix: null, announced: null, ducked: false,
    init() {
      if (actx) return;
      actx = new (window.AudioContext || window.webkitAudioContext)();
      this.comp = actx.createDynamicsCompressor();
      this.comp.threshold.value = -14; this.comp.ratio.value = 3; this.comp.attack.value = 0.01; this.comp.release.value = 0.25;
      this.bus = actx.createGain();
      this.analyser = actx.createAnalyser(); this.analyser.fftSize = 256;
      this.bus.connect(this.comp); this.comp.connect(this.analyser); this.analyser.connect(actx.destination);
      for (let i = 0; i < 2; i++) {
        const c = {};
        c.trim = actx.createGain();
        c.low = actx.createBiquadFilter(); c.low.type = 'lowshelf'; c.low.frequency.value = 220;
        c.mid = actx.createBiquadFilter(); c.mid.type = 'peaking'; c.mid.frequency.value = 1100; c.mid.Q.value = 0.8;
        c.hi = actx.createBiquadFilter(); c.hi.type = 'highshelf'; c.hi.frequency.value = 3200;
        c.hp = actx.createBiquadFilter(); c.hp.type = 'highpass'; c.hp.frequency.value = 10; c.hp.Q.value = 0.9;
        c.lp = actx.createBiquadFilter(); c.lp.type = 'lowpass'; c.lp.frequency.value = 22000; c.lp.Q.value = 0.9;
        c.fader = actx.createGain(); c.xf = actx.createGain();
        c.an = actx.createAnalyser(); c.an.fftSize = 256;
        // vocal path: fold to mono (vocals sit in the middle), cut the kick and bass, lift presence
        c.dry = actx.createGain(); c.vox = actx.createGain(); c.vox.gain.value = 0;
        c.vhp1 = actx.createBiquadFilter(); c.vhp1.type = 'highpass'; c.vhp1.frequency.value = 260; c.vhp1.Q.value = 0.7;
        c.vhp2 = actx.createBiquadFilter(); c.vhp2.type = 'highpass'; c.vhp2.frequency.value = 260; c.vhp2.Q.value = 0.7;
        c.vpres = actx.createBiquadFilter(); c.vpres.type = 'peaking'; c.vpres.frequency.value = 2800; c.vpres.Q.value = 0.9; c.vpres.gain.value = 4;
        c.vlp = actx.createBiquadFilter(); c.vlp.type = 'lowpass'; c.vlp.frequency.value = 9500; c.vlp.Q.value = 0.7;
        c.vmono = actx.createGain(); c.vmono.channelCount = 1; c.vmono.channelCountMode = 'explicit'; c.vmono.channelInterpretation = 'speakers';
        c.sv = actx.createGain(); c.si = actx.createGain(); c.sv.connect(c.low); c.si.connect(c.low);
        c.trim.connect(c.dry); c.dry.connect(c.low);
        c.trim.connect(c.vmono); c.vmono.connect(c.vhp1); c.vhp1.connect(c.vhp2); c.vhp2.connect(c.vpres); c.vpres.connect(c.vlp); c.vlp.connect(c.vox); c.vox.connect(c.low);
        c.low.connect(c.mid); c.mid.connect(c.hi); c.hi.connect(c.hp); c.hp.connect(c.lp); c.lp.connect(c.fader);
        c.fader.connect(c.an); c.fader.connect(c.xf); c.xf.connect(this.bus);
        this.ch[i] = c;
        this.D[i] = { i, t: null, pick: null, buf: null, rev: null, src: null, rate: 1, bend: 0, curRate: 1, pos0: 0, ctx0: 0, playing: false, ended: false, cue: 0 };
      }
      this.applyCtl(true);
    },
    applyCtl(now) {
      if (!actx) return;
      const t = actx.currentTime, tc = now ? 0.001 : 0.02;
      const g = xfGains(Ctl.xf);
      for (let i = 0; i < 2; i++) {
        const c = this.ch[i]; if (!c) continue;
        c.xf.gain.setTargetAtTime(g[i], t, tc);
        c.fader.gain.setTargetAtTime(Ctl.fader[i] * Ctl.fader[i], t, tc);
        c.low.gain.setTargetAtTime(eqDb(Ctl.low[i]), t, tc);
        c.mid.gain.setTargetAtTime(eqDb(Ctl.mid[i]), t, tc);
        c.hi.gain.setTargetAtTime(eqDb(Ctl.hi[i]), t, tc);
        const v = Ctl.vox[i] || 0, ins = Ctl.inst[i] || 0;
        c.dry.gain.setTargetAtTime(1 - v, t, tc); c.vox.gain.setTargetAtTime(v * 1.5, t, tc);
        c.sv.gain.setTargetAtTime(1 - ins, t, tc); c.si.gain.setTargetAtTime(1 - v, t, tc);
        const f = Ctl.flt[i];
        c.lp.frequency.setTargetAtTime(f < 0 ? 22000 * Math.pow(180 / 22000, -f) : 22000, t, tc);
        c.hp.frequency.setTargetAtTime(f > 0 ? 10 * Math.pow(2500 / 10, f) : 10, t, tc);
      }
    },
    dur(d) { return d.buf ? d.buf.duration : 0; },
    pos(d) {
      if (!d.buf) return 0;
      if (d.scratching) return d.spos;
      if (d.playing) return clamp(d.pos0 + (actx.currentTime - d.ctx0) * d.curRate, 0, this.dur(d));
      return d.pos0;
    },
    stopSrc(d) {
      if (d.src) { try { d.src.onended = null; d.src.stop(); } catch {} try { d.src.disconnect(); } catch {} d.src = null; }
      if (d.src2) { try { d.src2.stop(); } catch {} try { d.src2.disconnect(); } catch {} d.src2 = null; }
    },
    startSrc(d, pos, rate, reverse) {
      this.stopSrc(d);
      const src = actx.createBufferSource();
      const stems = !reverse && d.vbuf && d.ibuf;
      src.buffer = reverse ? d.rev : stems ? d.ibuf : d.buf;
      src.playbackRate.value = Math.max(0.0001, rate);
      src.connect(stems ? this.ch[d.i].si : this.ch[d.i].trim);
      const dur = this.dur(d), at = actx.currentTime + (stems ? 0.005 : 0);
      const off = clamp(reverse ? dur - pos : pos, 0, Math.max(0, dur - 0.01));
      src.start(at, Math.min(off, Math.max(0, src.buffer.duration - 0.01)));
      if (stems) {
        const s2 = actx.createBufferSource(); s2.buffer = d.vbuf; s2.playbackRate.value = Math.max(0.0001, rate);
        s2.connect(this.ch[d.i].sv); s2.start(at, Math.min(off, Math.max(0, d.vbuf.duration - 0.01)));
        d.src2 = s2;
      }
      d.src = src;
      if (!reverse) {
        d.pos0 = pos; d.ctx0 = actx.currentTime; d.curRate = rate;
        src.onended = () => { if (d.src === src && d.playing && !d.scratching) { d.playing = false; d.pos0 = dur; d.ended = true; } };
      }
    },
    reversed(d) {
      if (d.rev || !d.buf) return d.rev;
      const b = d.buf, r = actx.createBuffer(b.numberOfChannels, b.length, b.sampleRate);
      for (let c = 0; c < b.numberOfChannels; c++) { const s = b.getChannelData(c), o = r.getChannelData(c), n = s.length; for (let k = 0; k < n; k++) o[k] = s[n - 1 - k]; }
      return (d.rev = r);
    },
    load(i, pick) {
      const d = this.D[i];
      this.stopSrc(d);
      d.t = pick.t; d.pick = pick; d.buf = pick.t.buffer; d.rev = null; pick.t.buffer = null;
      d.vbuf = pick.t.stems ? pick.t.stems.voc : null; d.ibuf = pick.t.stems ? pick.t.stems.inst : null;
      d.cue = Math.max(0, pick.t.f.beatOffset || 0); d.pos0 = d.cue; d.playing = false; d.ended = false; d.rate = 1; d.bend = 0; d.curRate = 1; d.t._rate = 1;
      d.announced = false; d.planned = null;
    },
    play(i) {
      const d = this.D[i]; if (!d.buf || d.playing) return;
      let p = this.pos(d);
      if (d.ended || p >= this.dur(d) - 0.05) p = d.cue;
      d.ended = false; d.playing = true;
      this.startSrc(d, p, d.rate * (1 + d.bend));
    },
    pause(i) { const d = this.D[i]; if (!d.playing) return; d.pos0 = this.pos(d); d.playing = false; this.stopSrc(d); },
    toCue(i) { const d = this.D[i]; this.pause(i); d.pos0 = d.cue; d.ended = false; },
    setRate(i, rate) {
      const d = this.D[i]; d.rate = clamp(rate, 0.84, 1.16); if (d.t) d.t._rate = d.rate;
      if (d.playing && !d.scratching && d.src) { d.pos0 = this.pos(d); d.ctx0 = actx.currentTime; d.curRate = d.rate * (1 + d.bend); d.src.playbackRate.setTargetAtTime(d.curRate, actx.currentTime, 0.01); if (d.src2) d.src2.playbackRate.setTargetAtTime(d.curRate, actx.currentTime, 0.01); }
    },
    nudge(i, amount) { const d = this.D[i]; d.bend = clamp(amount, -0.2, 0.2); this.setRate(i, d.rate); },
    beat(d) { return 60 / (d.t.f.bpm || 120); },
    phase(d) { const b = this.beat(d); return ((((this.pos(d) - (d.t.f.beatOffset || 0)) / b) % 1) + 1) % 1; },
    sync(i) {
      const d = this.D[i], m = this.D[1 - i];
      if (!d.t || !m.t || !m.playing) return false;
      const target = m.t.f.bpm * m.curRate;
      const tm = A.tempoMatch(target, d.t.f.bpm);
      if (Math.abs(1 - tm.ratio) > 0.16) return false;
      this.setRate(i, tm.ratio);
      // line the beats up with the master deck
      const b = this.beat(d), off = d.t.f.beatOffset || 0, ph = this.phase(m);
      const k = Math.floor((this.pos(d) - off) / b);
      let np = off + (k + ph) * b; if (np < 0) np += b;
      if (d.playing) this.startSrc(d, np, d.curRate); else d.pos0 = np;
      return true;
    },
    // scratching: the platter turns the record directly
    scratchStart(i) {
      const d = this.D[i]; if (!d.buf) return;
      d.wasPlaying = d.playing; d.spos = this.pos(d); d.scratching = true; d.sdir = 0;
      this.stopSrc(d);
    },
    scratchMove(i, dPos, dt) {
      const d = this.D[i]; if (!d.scratching) return;
      const dur = this.dur(d);
      d.spos = clamp(d.spos + dPos, 0, dur);
      const vel = dt > 0 ? dPos / dt : 0;
      const dir = vel > 0.02 ? 1 : vel < -0.02 ? -1 : 0;
      if (dir && dir !== d.sdir) {
        if (dir < 0) this.reversed(d);
        this.startSrc(d, d.spos, Math.abs(vel), dir < 0);
        d.sdir = dir;
      }
      if (d.src) d.src.playbackRate.setTargetAtTime(clamp(Math.abs(vel), 0.0001, 4), actx.currentTime, dir ? 0.012 : 0.05);
    },
    scratchEnd(i) {
      const d = this.D[i]; if (!d.scratching) return;
      d.scratching = false; this.stopSrc(d);
      d.pos0 = d.spos; d.ended = false;
      if (d.wasPlaying && d.spos < this.dur(d) - 0.05) { d.playing = true; this.startSrc(d, d.spos, d.rate * (1 + d.bend)); }
      else d.playing = false;
    },
    audible(i) { const d = this.D[i]; return d && d.buf && (d.playing || d.scratching) ? Ctl.fader[i] * xfGains(Ctl.xf)[i] : 0; },
    liveIdx() { const a = this.audible(0), b = this.audible(1); if (!a && !b) return this.announced ? this.announced.i : 0; return b > a ? 1 : 0; },
    // the AI's hands: animate the same controls you can touch
    animate(anims, ms, done) {
      this.mix = { anims, t0: performance.now(), ms, done };
    },
    stepMix() {
      const m = this.mix; if (!m) return;
      const x = clamp((performance.now() - m.t0) / m.ms, 0, 1);
      for (const a of m.anims) {
        if (a.from != null && x < a.from && m.anims.some((o) => o !== a && o.k === a.k && o.idx === a.idx && (o.to || 1) <= a.from)) continue;
        if (a.to != null && x > a.to && m.anims.some((o) => o !== a && o.k === a.k && o.idx === a.idx && (o.from || 0) >= a.to)) continue;
        const u = clamp((x - (a.from || 0)) / ((a.to || 1) - (a.from || 0)), 0, 1);
        const v = a.step != null ? (x >= a.step ? a.b : a.a) : a.a + (a.b - a.a) * (a.ease ? u * u * (3 - 2 * u) : u);
        if (a.idx != null) Ctl[a.k][a.idx] = v; else Ctl[a.k] = v;
      }
      if (x >= 1) { this.mix = null; m.done && m.done(); }
    },
    userTouch() {
      if (this.mix) this.mix = null;
      if (Ctl.auto) { Ctl.auto = false; window.dispatchEvent(new CustomEvent('sel:auto')); }
    },
    // AI-split stems arrive after a record is loaded; a playing deck switches over in place
    attachStems(t, st) {
      for (const d of this.D) {
        if (d.t !== t || !d.buf || !st) continue;
        d.vbuf = st.voc; d.ibuf = st.inst;
        if (d.playing && !d.scratching) this.startSrc(d, this.pos(d), d.curRate);
        if (d.planned && d.planned !== 'vox' && d.i !== this.liveIdx() && !this.mix) d.planned = null;
      }
    },
    hasStems(i) { const d = this.D[i]; return !!(d && d.vbuf && d.ibuf); },
    voxOk(I) {
      const di = this.D[I], dl = this.D[1 - I];
      if (!di.buf || !dl.buf || !di.pick) return false;
      const forced = di.t && di.t.forceVox;
      const stems = this.hasStems(I);
      return Math.abs(1 - di.pick.s.ratio) <= (forced ? 0.12 : stems ? 0.08 : 0.06) && (forced || stems || (di.t.f.beatStrength > 1.2 && dl.t.f.beatStrength > 1.2));
    },
    // how the AI plans to bring in the cued record; every few mixes it goes for a vocal blend
    plan(I) {
      const di = this.D[I]; if (!di.pick) return 'filter';
      if (di.planned) return di.planned;
      const harm = di.pick.s.parts.harm, ok = this.voxOk(I);
      S.mixN = (S.mixN || 0) + 1;
      if (di.t.forceVox) di.planned = ok ? 'vox' : 'filter';
      else if (kingOn()) di.planned = ok && (harm >= 0.3 || this.hasStems(I)) ? 'vox' : ok ? 'blend' : 'filter';
      else di.planned = ok && harm >= 0.5 && (S.mixN % 3 === 0 || Math.random() < 0.3) ? 'vox' : ok && harm >= 0.5 ? 'blend' : 'filter';
      return di.planned;
    },
    voxTiming() {
      const L = this.liveIdx(), dl = this.D[L], I = 1 - L;
      const beat = 60 / ((dl.t && dl.t.f.bpm || 120) * (dl.curRate || 1));
      // with clean stems the acapella rides the other beat for a proper remix section
      const want = this.hasStems(I) ? (this.D[I].t && this.D[I].t.forceVox ? 17 : 13) : 7.5;
      const bars = Math.max(2, Math.round(want / (4 * beat)));
      const dropS = bars * 4 * beat;
      return { dropS, total: dropS + Math.max(4, 8 * beat) };
    },
    vocalBlend() {
      const L = this.liveIdx(), I = 1 - L, dl = this.D[L], di = this.D[I];
      if (this.mix || !di.buf || !dl.buf) return 'busy';
      if (!this.voxOk(I)) return 'nofit';
      const remain = (this.dur(dl) - this.pos(dl)) / (dl.curRate || 1);
      if (remain < this.voxTiming().total + 0.5) return 'late';
      return this.transition('vox') ? 'ok' : 'busy';
    },
    transition(style) {
      const L = this.liveIdx(), I = 1 - L, dl = this.D[L], di = this.D[I];
      if (this.mix || !di.buf || !dl.buf) return false;
      const pick = di.pick, harm = pick.s.parts.harm;
      const ratioOk = Math.abs(1 - pick.s.ratio) <= 0.06 && di.t.f.beatStrength > 1.2 && dl.t.f.beatStrength > 1.2;
      if (style === 'vox' && ratioOk) {
        // the next record's vocal, alone, over this record's beat; then the beat swaps underneath
        const { dropS, total } = this.voxTiming();
        const k = dropS / total;
        di.styleHint = 'vox';
        const clean = this.hasStems(I);
        Ctl.fader[I] = 1; Ctl.low[I] = 0; Ctl.mid[I] = 0; Ctl.hi[I] = 0; Ctl.flt[I] = 0; Ctl.vox[I] = 1; Ctl.inst[I] = 0;
        this.sync(I);
        if (!di.playing) { const p0 = di.ended ? di.cue : this.pos(di); di.ended = false; di.playing = true; this.startSrc(di, p0, di.rate); this.sync(I); }
        const to = I === 1 ? 1 : 0, from = Ctl.xf;
        setDjNote(`🎛 Vocal blend: ${di.t.title} vocals over the ${dl.t.title} beat`);
        const anims = [
          { k: 'xf', a: from, b: 0.5, ease: true, to: Math.min(0.14, k * 0.5) },
          { k: 'vox', idx: I, a: 1, b: 0, step: k },
          { k: 'low', idx: L, a: Ctl.low[L], b: -1, step: k },
          { k: 'xf', a: 0.5, b: to, ease: true, from: k },
        ];
        // clean stems: mute this record's own vocals so only the new acapella sits on its beat
        if (this.hasStems(L)) anims.push({ k: 'inst', idx: L, a: 0, b: 1, ease: true, to: Math.min(0.1, k * 0.4) });
        else anims.push({ k: 'mid', idx: L, a: Ctl.mid[L], b: -0.45, ease: true, to: Math.min(0.14, k * 0.5) });
        if (clean) setDjNote(`\ud83c\udf9b Remix: ${di.t.title} acapella over the ${dl.t.title} beat`);
        this.animate(anims, total * 1000, () => {
          this.pause(L); dl.ended = true;
          Ctl.low[L] = 0; Ctl.mid[L] = 0; Ctl.hi[L] = 0; Ctl.flt[L] = 0; Ctl.fader[L] = 1; Ctl.vox[L] = 0; Ctl.vox[I] = 0; Ctl.inst[L] = 0; Ctl.inst[I] = 0;
          if (di.t) di.t.forceVox = false;
        });
        return true;
      }
      if (style === 'vox') style = null;
      if (!style) style = ratioOk && harm >= 0.5 ? 'blend' : 'filter';
      const fade = style === 'blend' ? 8000 : style === 'filter' ? 4500 : 1500;
      di.styleHint = style;
      Ctl.fader[I] = 1; Ctl.low[I] = style === 'blend' ? -1 : 0; Ctl.mid[I] = 0; Ctl.hi[I] = 0; Ctl.flt[I] = 0; Ctl.vox[I] = 0;
      if (ratioOk) this.sync(I); else this.setRate(I, 1);
      if (!di.playing) { const p0 = di.ended ? di.cue : this.pos(di); di.ended = false; di.playing = true; this.startSrc(di, p0, di.rate); if (ratioOk) this.sync(I); }
      const to = I === 1 ? 1 : 0, from = Ctl.xf;
      const anims = [{ k: 'xf', a: from, b: to, ease: true, from: style === 'filter' ? 0.3 : 0 }];
      if (style === 'blend') anims.push({ k: 'low', idx: I, a: -1, b: 0, step: 0.5 }, { k: 'low', idx: L, a: Ctl.low[L], b: -1, step: 0.5 });
      if (style === 'filter') anims.push({ k: 'flt', idx: L, a: Ctl.flt[L], b: -0.9, ease: true });
      this.animate(anims, fade, () => {
        this.pause(L); dl.ended = true;
        Ctl.low[L] = 0; Ctl.mid[L] = 0; Ctl.hi[L] = 0; Ctl.flt[L] = 0; Ctl.fader[L] = 1; Ctl.inst[L] = 0;
      });
      return true;
    },
    async start(first) {
      this.init();
      if (actx.state === 'suspended') await actx.resume();
      Object.assign(Ctl, { xf: 0, fader: [1, 1], hi: [0, 0], mid: [0, 0], low: [0, 0], flt: [0, 0], vox: [0, 0], inst: [0, 0], auto: true });
      this.announced = null; this.mix = null;
      this.load(0, first); this.applyCtl(true);
      this.play(0);
      clearInterval(this.timer);
      this.timer = setInterval(() => this.tick(), 30);
    },
    tick() {
      if (!S.running || !actx) return;
      this.stepMix();
      this.applyCtl(false);
      const L = this.liveIdx(), dl = this.D[L], I = 1 - L, di = this.D[I];
      // a deck that is now carrying the mix becomes "now playing"
      if (dl.pick && (dl.playing || dl.scratching) && !dl.announced) {
        dl.announced = true;
        const prev = this.announced && this.announced.t !== dl.t ? this.announced.t : null;
        this.announced = { i: L, t: dl.t };
        onNowPlaying(dl.pick, prev, prev ? (dl.styleHint || 'hand') : null);
      }
      // the AI keeps a record cued on the free deck
      const free = !this.mix && !di.playing && !di.scratching && (!di.buf || di.ended || di.announced);
      if (free && S.ready.length && dl.t) { const pick = chooseNext(dl.t); if (pick) { this.load(I, pick); Ctl.low[I] = 0; Ctl.flt[I] = 0; renderUpNext(); } }
      // repeat: loop the live record instead of mixing out
      if (S.repeat && !this.mix && dl.playing && !dl.scratching && dl.buf) {
        const left = (this.dur(dl) - this.pos(dl)) / (dl.curRate || 1);
        if (left <= 0.35) this.startSrc(dl, dl.cue || 0, dl.curRate || dl.rate || 1);
      }
      if (S.repeat && !this.mix && !dl.playing && dl.ended && dl.buf && dl.pick) { dl.ended = false; dl.playing = true; this.startSrc(dl, dl.cue || 0, dl.curRate || 1); }
      // AI auto-mix: start the blend so it lands before the record runs out
      if (Ctl.auto && !S.repeat && !this.mix && dl.playing && di.buf && !di.playing && !di.announced) {
        const remain = (this.dur(dl) - this.pos(dl)) / (dl.curRate || 1);
        const plan = this.plan(I);
        const need = (plan === 'vox' ? this.voxTiming().total : plan === 'blend' ? 8 : 4.5) + 0.6;
        const early = plan === 'vox' && di.t.forceVox && this.pos(dl) > (dl.cue || 0) + 3 && (this.hasStems(I) || this.pos(dl) > (dl.cue || 0) + 12) && remain > need;
        if (remain <= need || early) this.transition(remain < 2.5 ? 'cut' : plan);
      }
      // the live record ran out with nothing mixed in: the AI drops the next one straight in
      if (Ctl.auto && !S.repeat && !this.mix && !dl.playing && !dl.scratching && dl.ended && di.buf && !di.playing && !di.announced) this.transition('cut');
      const idle = !dl.playing && !di.playing && !dl.scratching && !di.scratching;
      const msg = idle && dl.ended && !this.mix ? (Ctl.auto ? 'Loading the next record…' : 'Both decks are stopped. Press play on a deck.') : '';
      if (msg !== this.lastMsg) { this.lastMsg = msg; setStatus(msg); }
      renderProgress();
    },
    skip() { if (!this.transition('cut')) toast('The next record is still loading.'); },
    duck() { if (!this.bus) return; const now = actx.currentTime; this.bus.gain.cancelScheduledValues(now); this.bus.gain.setTargetAtTime(0.32, now, 0.12); },
    unduck() { if (!this.bus) return; const now = actx.currentTime; this.bus.gain.cancelScheduledValues(now); this.bus.gain.setTargetAtTime(1, now, 0.35); },
    progress() { const d = this.D[this.liveIdx()]; return d && d.buf ? this.pos(d) / this.dur(d) : 0; },
    stop() {
      clearInterval(this.timer); this.mix = null; this.announced = null;
      for (const d of this.D) { this.stopSrc(d); Object.assign(d, { t: null, pick: null, buf: null, rev: null, vbuf: null, ibuf: null, playing: false, ended: false, scratching: false }); }
    },
  };

  // ---------- Spotify (log in with your own Spotify developer app) ----------
  const SP = {
    clientId: store.get('sp_client', ''),
    useSite() { if (CFG.spotifyClientId && !store.get('sp_client', '')) this.clientId = CFG.spotifyClientId; },
    tok: store.get('sp_tok', null),
    redirect: location.origin + '/',
    scopes: 'user-top-read user-read-recently-played user-library-read streaming user-read-email user-read-private user-read-playback-state user-modify-playback-state playlist-modify-private',
    connected() { return !!(this.tok && this.tok.refresh_token && this.clientId); },
    b64url(buf) { return btoa(String.fromCharCode(...new Uint8Array(buf))).split('+').join('-').split('/').join('_').replace(/=+$/, ''); },
    async login() {
      if (!this.clientId) return;
      const arr = new Uint8Array(48); crypto.getRandomValues(arr);
      const verifier = this.b64url(arr);
      const challenge = this.b64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
      const st = this.b64url(crypto.getRandomValues(new Uint8Array(12)));
      store.set('sp_verifier', verifier); store.set('sp_state', st);
      const q = new URLSearchParams({ client_id: this.clientId, response_type: 'code', redirect_uri: this.redirect, code_challenge_method: 'S256', code_challenge: challenge, scope: this.scopes, state: st });
      location.href = 'https://accounts.spotify.com/authorize?' + q.toString();
    },
    async handleRedirect() {
      const q = new URLSearchParams(location.search);
      if (!q.has('code') && !q.has('error')) return false;
      history.replaceState(null, '', location.pathname);
      if (q.get('error')) { toast('Spotify login was cancelled.'); return true; }
      if (q.get('state') !== store.get('sp_state')) { toast('Spotify login check failed, please try again.'); return true; }
      const body = new URLSearchParams({ client_id: this.clientId, grant_type: 'authorization_code', code: q.get('code'), redirect_uri: this.redirect, code_verifier: store.get('sp_verifier', '') });
      const r = await fetch('https://accounts.spotify.com/api/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body });
      const j = await r.json();
      if (!r.ok) { toast('Spotify said: ' + (j.error_description || j.error || r.status)); return true; }
      this.saveTok(j);
      store.del('sp_verifier');
      return true;
    },
    saveTok(j) {
      this.tok = { access_token: j.access_token, refresh_token: j.refresh_token || (this.tok && this.tok.refresh_token), exp: Date.now() + (j.expires_in - 60) * 1000 };
      store.set('sp_tok', this.tok);
    },
    async token() {
      if (!this.tok) throw new Error('not connected');
      if (Date.now() < this.tok.exp) return this.tok.access_token;
      const body = new URLSearchParams({ client_id: this.clientId, grant_type: 'refresh_token', refresh_token: this.tok.refresh_token });
      const r = await fetch('https://accounts.spotify.com/api/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body });
      const j = await r.json();
      if (!r.ok) { this.logout(); throw new Error('Spotify session expired'); }
      this.saveTok(j);
      return this.tok.access_token;
    },
    logout() { this.tok = null; store.del('sp_tok'); store.set('src', ''); renderConnect(); },
    async api(path, opts = {}) {
      for (let i = 0; i < 3; i++) {
        const r = await fetch('https://api.spotify.com/v1' + path, { ...opts, headers: { authorization: 'Bearer ' + (await this.token()), 'content-type': 'application/json', ...(opts.headers || {}) } });
        if (r.status === 429) { await sleep((+r.headers.get('retry-after') || 2) * 1000); continue; }
        if (r.status === 204) return {};
        const j = await r.json().catch(() => ({}));
        if (!r.ok) { const e = new Error((j.error && j.error.message) || 'Spotify ' + r.status); e.status = r.status; throw e; }
        return j;
      }
      throw new Error('Spotify is busy, try again');
    },
    async importTaste() {
      setStatus('Reading your Spotify listening…');
      const ranges = ['short_term', 'medium_term', 'long_term'];
      const arts = {};
      for (const [ri, range] of ranges.entries()) {
        try {
          const j = await this.api(`/me/top/artists?limit=30&time_range=${range}`);
          (j.items || []).forEach((a, i) => { arts[a.name] = (arts[a.name] || 0) + (1 - i / 40) * [1, 0.8, 0.5][ri]; });
        } catch (e) { if (e.status === 403) throw new Error('Spotify blocked this app (check the app is set up and your account is added as a user).'); }
      }
      const favs = [];
      for (const range of ['short_term', 'medium_term']) {
        try {
          const j = await this.api(`/me/top/tracks?limit=50&time_range=${range}`);
          (j.items || []).forEach((t) => favs.push(t));
        } catch {}
      }
      favs.forEach((t, i) => { const n = t.artists && t.artists[0] && t.artists[0].name; if (n) arts[n] = (arts[n] || 0) + 0.15; });
      const names = Object.entries(arts).sort((a, b) => b[1] - a[1]).slice(0, 16);
      const max = names.length ? names[0][1] : 1;
      await poolLimit(names, 4, async ([name, score]) => {
        const r = await dz('/search/artist', { q: name, limit: 3 });
        const hit = (r.data || []).find((a) => a.name.toLowerCase() === name.toLowerCase()) || (r.data || [])[0];
        if (!hit) return;
        const id = String(hit.id);
        S.taste.artists[id] = { name: hit.name, w: clamp(0.5 + 0.6 * (score / max), 0.5, 1.1), pic: hit.picture_medium, seed: true, from: 'spotify' };
      });
      const seen = new Set();
      for (const t of favs) {
        if (seen.has(t.id)) continue; seen.add(t.id);
        const a = t.artists && t.artists[0];
        const dzArtist = Object.entries(S.taste.artists).find(([, x]) => a && x.name.toLowerCase() === a.name.toLowerCase());
        addToPool({
          id: 'sp' + t.id, title: t.name, artist: a && a.name, artistId: dzArtist ? dzArtist[0] : undefined,
          isrc: t.external_ids && t.external_ids.isrc, spotifyUri: t.uri, cover: t.album && t.album.images && (t.album.images[1] || t.album.images[0] || {}).url,
          duration: Math.round(t.duration_ms / 1000), fav: true, source: 'sp',
        });
      }
      saveTaste();
      store.set('sp_imported', Date.now());
      return names.length;
    },
    async findUri(t) {
      try {
        const q = `track:${t.title} artist:${t.artist}`;
        const j = await this.api('/search?type=track&limit=3&q=' + encodeURIComponent(q));
        const items = (j.tracks && j.tracks.items) || [];
        const hit = items.find((x) => x.artists.some((a) => a.name.toLowerCase() === String(t.artist).toLowerCase())) || items[0];
        return hit ? hit.uri : null;
      } catch { return null; }
    },
    // --- full-song player (Spotify Premium) ---
    player: null, deviceId: null, cur: null, timer: null, vol: 0.85, busy: false,
    loadSdk() {
      return new Promise((res, rej) => {
        if (window.Spotify) return res();
        window.onSpotifyWebPlaybackSDKReady = res;
        const s = document.createElement('script'); s.src = 'https://sdk.scdn.co/spotify-player.js'; s.onerror = rej;
        document.head.appendChild(s);
        setTimeout(() => rej(new Error('Spotify player did not load')), 15000);
      });
    },
    async startPlayer() {
      await this.loadSdk();
      return new Promise((res, rej) => {
        const p = new window.Spotify.Player({ name: 'Ibiza DJ', getOAuthToken: (cb) => this.token().then(cb), volume: this.vol });
        p.addListener('ready', ({ device_id }) => { this.deviceId = device_id; res(); });
        p.addListener('account_error', () => rej(new Error('premium')));
        p.addListener('authentication_error', () => rej(new Error('auth')));
        p.addListener('initialization_error', (e) => rej(new Error(e.message)));
        p.connect();
        this.player = p;
        setTimeout(() => rej(new Error('Spotify player timed out')), 15000);
      });
    },
    async playUri(uri, posMs) {
      await this.api(`/me/player/play?device_id=${this.deviceId}`, { method: 'PUT', body: JSON.stringify({ uris: [uri], position_ms: Math.max(0, Math.round(posMs)) }) });
    },
    async fadeTo(v, ms) {
      if (!this.player) return;
      const steps = Math.max(1, Math.round(ms / 80)); const from = this.curVol == null ? this.vol : this.curVol;
      for (let i = 1; i <= steps; i++) { this.curVol = from + (v - from) * (i / steps); try { await this.player.setVolume(clamp(this.curVol, 0, 1)); } catch {} await sleep(80); }
    },
    plan(t) {
      const dur = (t.duration || 200) * 1000;
      const intro = S.pace === 'full' ? 0 : Math.min(dur * 0.12, 25000);
      const len = S.pace === 'full' ? dur - intro : S.pace === 'radio' ? Math.min(dur - intro, 150000) : Math.min(dur - intro, 75000);
      return { startMs: intro, mixMs: intro + len - 7000 };
    },
    async start(first) {
      this.cur = { pick: first, ...this.plan(first.t) };
      this.curVol = 0; try { await this.player.setVolume(0); } catch {}
      await this.playUri(first.t.spotifyUri, this.cur.startMs);
      this.fadeTo(this.vol, 1500);
      onNowPlaying(first, null);
      clearInterval(this.timer);
      this.timer = setInterval(() => this.tick(), 500);
    },
    async tick() {
      if (!S.running || !this.player || this.busy || !this.cur) return;
      const st = await this.player.getCurrentState().catch(() => null);
      if (!st) return;
      this.pos = st.position; this.dur = st.duration;
      renderProgress();
      if (S.repeat && st.position >= Math.min(this.cur.mixMs, st.duration - 1500)) { this.player.seek(0).catch(() => {}); return; }
      if (st.position >= this.cur.mixMs || (st.paused && st.position === 0 && this.cur.started && Date.now() - this.cur.started > 5000)) this.next(false);
      if (!this.cur.started && !st.paused) this.cur.started = Date.now();
    },
    async next(quick) {
      if (this.busy) return;
      const pick = chooseNext(this.cur && this.cur.pick.t);
      if (!pick) return;
      this.busy = true;
      const prev = this.cur && this.cur.pick.t;
      try {
        await this.fadeTo(0, quick ? 700 : 3200);
        this.cur = { pick, ...this.plan(pick.t) };
        await this.playUri(pick.t.spotifyUri, this.cur.startMs);
        onNowPlaying(pick, prev, quick ? 'cut' : 'fade');
        await this.fadeTo(this.vol, quick ? 600 : 1800);
      } catch (e) { toast(e.message); }
      this.busy = false;
    },
    duck() { if (this.player) this.player.setVolume(this.vol * 0.3).catch(() => {}); },
    unduck() { if (this.player) this.player.setVolume(this.vol).catch(() => {}); },
    stop() { clearInterval(this.timer); if (this.player) this.player.pause().catch(() => {}); this.cur = null; },
    async saveSet() {
      const uris = [...S.played, ...S.ready].map((t) => t.spotifyUri).filter(Boolean);
      if (!uris.length) { toast('Nothing to save yet.'); return; }
      const name = 'Ibiza set · ' + new Date().toLocaleDateString();
      const pl = await this.api('/me/playlists', { method: 'POST', body: JSON.stringify({ name, public: false, description: 'Mixed by Ibiza, your AI DJ' }) });
      try { await this.api(`/playlists/${pl.id}/items`, { method: 'POST', body: JSON.stringify({ uris: uris.slice(0, 100) }) }); }
      catch { await this.api(`/playlists/${pl.id}/tracks`, { method: 'POST', body: JSON.stringify({ uris: uris.slice(0, 100) }) }); }
      toast(`Saved “${name}” to your Spotify.`);
    },
  };

  // ---------- YouTube (two embedded YouTube players as decks) ----------
  const YTM = {
    key: store.get('yt_key', ''),
    cache: store.get('yt_cache', {}),
    demo: new URLSearchParams(location.search).has('ytdemo'),
    decks: [], failed: [false, false], cur: null, timer: null, busy: false, pos: 0, dur: 0,
    ios: /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1),
    available() { return CFG.youtube || !!this.key || this.demo; },
    loadApi() {
      return new Promise((res, rej) => {
        if (window.YT && window.YT.Player) return res();
        window.onYouTubeIframeAPIReady = res;
        const s = document.createElement('script'); s.src = 'https://www.youtube.com/iframe_api'; s.onerror = () => rej(new Error('YouTube did not load'));
        document.head.appendChild(s);
        setTimeout(() => rej(new Error('YouTube timed out')), 15000);
      });
    },
    async init() {
      if (this.decks.length === 2) return;
      await this.loadApi();
      await Promise.all(['deckA', 'deckB'].map((id, i) => new Promise((res, rej) => {
        const p = new window.YT.Player(id, {
          // YouTube's privacy-enhanced player: no YouTube cookies until a video plays
          host: 'https://www.youtube-nocookie.com',
          width: '100%', height: '100%',
          playerVars: { playsinline: 1, rel: 0, controls: 1, cc_load_policy: 0, iv_load_policy: 3 },
          events: { onReady: () => res(), onError: (e) => this.onError(i, e) },
        });
        this.decks[i] = p;
        setTimeout(() => rej(new Error('YouTube player timed out')), 15000);
      })));
    },
    async findVideo(t) {
      const k = (t.artist + '|' + t.title).toLowerCase();
      if (k in this.cache) return this.cache[k];
      if (this.demo) { const ids = ['5NV6Rdv1a3I', 'dQw4w9WgXcQ', 'kJQP7kiw5Fk']; this.n = (this.n || 0) + 1; return ids[this.n % ids.length]; }
      if (this.quotaOut) throw new Error('YouTube search limit reached for today');
      if (CFG.youtube) {
        const r = await fetch('/api/yt?' + new URLSearchParams({ a: t.artist, t: t.title }).toString());
        const j = await r.json().catch(() => ({}));
        if (r.status === 429) { this.quotaOut = true; toast('Today’s free YouTube searches are used up. Songs found before still play.'); }
        if (!r.ok) throw new Error('YouTube ' + (j.error || r.status));
        this.cache[k] = j.id || null; store.set('yt_cache', this.cache);
        return j.id || null;
      }
      const q = new URLSearchParams({ part: 'snippet', type: 'video', maxResults: '3', videoEmbeddable: 'true', videoCategoryId: '10', q: `${t.artist} ${t.title} official audio`, key: this.key });
      const r = await fetch('https://www.googleapis.com/youtube/v3/search?' + q.toString());
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        const reason = j.error && j.error.errors && j.error.errors[0] && j.error.errors[0].reason;
        if (reason === 'quotaExceeded' || reason === 'dailyLimitExceeded') { this.quotaOut = true; toast('YouTube’s free daily search limit is used up. Songs found before still play.'); }
        throw new Error((j.error && j.error.message) || 'YouTube ' + r.status);
      }
      const items = j.items || [];
      const want = String(t.artist).toLowerCase();
      const hit = items.find((x) => (x.snippet.channelTitle + ' ' + x.snippet.title).toLowerCase().includes(want)) || items[0];
      const id = hit ? hit.id.videoId : null;
      const keys = Object.keys(this.cache);
      if (keys.length > 1500) for (const old of keys.slice(0, 300)) delete this.cache[old];
      this.cache[k] = id;
      store.set('yt_cache', this.cache);
      return id;
    },
    forget(t) { const k = (t.artist + '|' + t.title).toLowerCase(); this.cache[k] = null; store.set('yt_cache', this.cache); t.noYt = true; },
    onError(i, e) {
      this.failed[i] = true;
      const sl = this.slots[i]; if (sl && !sl.announced && (!this.cur || this.cur.deckIdx !== i)) this.forget(sl.pick.t);
      if (this.cur && this.cur.deckIdx === i && !this.busy) { this.forget(this.cur.pick.t); this.next(true); }
    },
    // like a real DJ: skip the slow intro, drop in where the song kicks in, and mix out before the outro,
    // so the next song is already coming in while this one still has about 15 seconds to go
    plan(t, dur) {
      const d = dur || t.duration || 200;
      if (S.pace === 'full') return { startS: 0, mixS: d - 9 };
      const start = d < 90 ? 0 : Math.min(Math.max(d * 0.06, 8), 30);
      const len = S.pace === 'radio' ? 150 : 75;
      return { startS: start, mixS: Math.max(start + 30, Math.min(start + len, d - 15) - 8) };
    },
    setVol(p, v) { try { p.setVolume(Math.round(clamp(v, 0, 100))); } catch {} },
    async waitPlaying(i, ms) {
      const p = this.decks[i], t0 = Date.now();
      while (Date.now() - t0 < ms) {
        if (this.failed[i]) return false;
        try { if (p.getPlayerState() === 1) return true; } catch {}
        await sleep(150);
      }
      return false;
    },
    showDeck(i) { $$('.deck').forEach((el, k) => el.classList.toggle('live', k === i)); },
    slots: [null, null], _v: [-1, -1], ducked: false, cuedAt: 0, incoming: null,
    applyVols(force) {
      const g = xfGains(Ctl.xf), duck = this.ducked ? 0.3 : 1;
      for (let i = 0; i < 2; i++) {
        const v = Math.round(100 * Ctl.fader[i] * Ctl.fader[i] * g[i] * duck);
        if (force || this._v[i] !== v) { this._v[i] = v; this.setVol(this.decks[i], v); }
      }
    },
    state(i) { try { return this.decks[i].getPlayerState(); } catch { return -1; } },
    async start(first) {
      const i = 0, p = this.decks[i];
      this.failed[i] = false;
      Object.assign(Ctl, { xf: 0, fader: [1, 1], hi: [0, 0], mid: [0, 0], low: [0, 0], flt: [0, 0], auto: true });
      this.slots = [{ pick: first, announced: true }, null];
      const pl = this.plan(first.t);
      this.setVol(p, 0); this._v = [-1, -1];
      p.loadVideoById({ videoId: first.t.ytId, startSeconds: pl.startS });
      this.cur = { pick: first, deckIdx: i, mixS: null, loadedAt: Date.now() };
      this.showDeck(i);
      this.busy = true; // the opening track is not mixed out while it loads
      const ok = await this.waitPlaying(i, 12000);
      this.busy = false;
      if (!ok && this.failed[i]) { this.forget(first.t); this.cur = null; const n = chooseNext(null); if (n) return this.start(n); return; }
      if (!ok) setStatus('Tap play on the YouTube deck to start the set.');
      for (let v = 0; v <= 100; v += 10) { this.setVol(p, v); await sleep(80); }
      this.applyVols(true);
      onNowPlaying(first, null);
      // two records on the decks from the start: the AI's next pick waits, cued, on deck B
      this.cuedAt = 0; this.cueNext(1);
      clearInterval(this.timer);
      this.timer = setInterval(() => this.tick(), 250);
    },
    cueNext(i) {
      if (Date.now() - this.cuedAt < 2500 || !this.cur) return;
      this.cuedAt = Date.now();
      const pick = chooseNext(this.cur.pick.t);
      if (!pick) return;
      this.slots[i] = { pick };
      this.failed[i] = false;
      try { this.decks[i].cueVideoById({ videoId: pick.t.ytId, startSeconds: this.plan(pick.t).startS }); } catch {}
      renderUpNext();
    },
    tick() {
      if (!S.running || !this.cur) return;
      const p = this.decks[this.cur.deckIdx];
      let st = -1, pos = 0, dur = 0;
      try { st = p.getPlayerState(); pos = p.getCurrentTime(); dur = p.getDuration(); } catch {}
      this.pos = pos; this.dur = dur;
      if (st === 1 && $('#status') && !$('#status').hidden) setStatus('');
      if (this.busy) return;
      this.applyVols();
      if (dur > 0 && this.cur.mixS == null) this.cur.mixS = this.plan(this.cur.pick.t, dur).mixS;
      renderProgress();
      const live = this.cur.deckIdx, o = 1 - live;
      if (Ctl.auto) {
        // 8 seconds before the mix the next record starts rolling, silent, so the blend starts on time;
        // otherwise the idle deck stays quiet and only the live deck plays
        const so = this.slots[o];
        const pre = !S.repeat && so && !so.announced && !this.failed[o] && this.cur.mixS != null && pos >= this.cur.mixS - 8;
        if (pre) { if (!so.rolling && this.state(o) !== 1) { so.rolling = true; this._v[o] = 0; this.setVol(this.decks[o], 0); try { this.decks[o].playVideo(); } catch {} } }
        else if (this.state(o) === 1) { try { this.decks[o].pauseVideo(); } catch {} }
        // and always keep the AI's next record cued on it, ready to blend in
        if (!this.slots[o] || this.slots[o].announced || this.failed[o]) this.cueNext(o);
        if (S.repeat && (st === 0 || (this.cur.mixS != null && pos >= this.cur.mixS))) { try { p.seekTo(this.plan(this.cur.pick.t, dur).startS || 0, true); p.playVideo(); } catch {} }
        else if (st === 0 || (this.cur.mixS != null && pos >= this.cur.mixS)) this.next(false);
        else if (st !== 1 && st !== 2 && Date.now() - this.cur.loadedAt > 20000) { this.cur.loadedAt = Date.now(); setStatus('This song is slow to start. Tap play on the deck, or skip.'); }
        return;
      }
      // hand mixing: whichever deck you bring up becomes the one that's playing
      const g = xfGains(Ctl.xf);
      const aud = (i) => (this.state(i) === 1 ? Ctl.fader[i] * g[i] : 0);
      if (aud(o) > aud(live) && this.slots[o] && !this.slots[o].announced) {
        const prevT = this.cur.pick.t;
        this.slots[o].announced = true;
        this.cur = { pick: this.slots[o].pick, deckIdx: o, mixS: null, loadedAt: Date.now() };
        this.showDeck(o);
        onNowPlaying(this.cur.pick, prevT, 'hand');
      }
      const f = 1 - this.cur.deckIdx;
      if (this.state(f) !== 1 && (!this.slots[f] || this.slots[f].announced || this.failed[f])) this.cueNext(f);
    },
    async next(quick) {
      if (this.busy || !this.cur) return;
      const outI = this.cur.deckIdx, inI = 1 - outI, out = this.decks[outI], inp = this.decks[inI];
      const slot = this.slots[inI];
      const fromSlot = !!(slot && !slot.announced && !this.failed[inI]);
      const pick = fromSlot ? slot.pick : chooseNext(this.cur.pick.t);
      if (!pick) return;
      this.busy = true;
      const prevT = this.cur.pick.t;
      let shown = false;
      try {
        this.failed[inI] = false;
        const pl = this.plan(pick.t);
        Ctl.fader[inI] = 1;
        if (!(fromSlot && this.state(inI) === 1)) {
          this.setVol(inp, 0); this._v[inI] = 0;
          if (fromSlot && (this.state(inI) === 5 || this.state(inI) === 2)) inp.playVideo();
          else inp.loadVideoById({ videoId: pick.t.ytId, startSeconds: pl.startS });
        }
        this.incoming = { pick, deckIdx: inI };
        this.slots[inI] = { pick };
        const ok = await this.waitPlaying(inI, 8000);
        if (!ok) {
          try { inp.stopVideo(); } catch {}
          if (this.failed[inI]) this.forget(pick.t);
          const ix = S.played.indexOf(pick.t); if (ix >= 0 && !fromSlot) { S.played.splice(ix, 1); S.setIndex = Math.max(0, S.setIndex - 1); }
          this.slots[inI] = null; this.incoming = null;
          this.busy = false;
          if (this.ios || !this.failed[inI]) setStatus('Tap play on the next YouTube deck if it doesn’t start on its own.');
          return; // the tick will try another track
        }
        const harm = pick.s.parts.harm;
        const style = quick || this.ios ? 'cut' : harm >= 0.5 ? 'crossfade' : 'fade';
        const fadeMs = style === 'cut' ? 900 : style === 'crossfade' ? 8000 : 6000;
        const to = inI === 1 ? 1 : 0, from = Ctl.xf;
        if (this.ios) { try { out.pauseVideo(); } catch {} Ctl.xf = to; this.applyVols(true); shown = true; this.showDeck(inI); onNowPlaying(pick, prevT, 'cut'); }
        else {
          const steps = Math.max(1, Math.round(fadeMs / 100));
          for (let k = 1; k <= steps; k++) {
            if (!Ctl.auto && !quick) break; // you grabbed the crossfader
            const x = k / steps, e = x * x * (3 - 2 * x);
            Ctl.xf = from + (to - from) * e;
            this.applyVols();
            if (!shown && x >= 0.5) { shown = true; this.showDeck(inI); onNowPlaying(pick, prevT, style); }
            await sleep(100);
          }
          if (shown && (Ctl.auto || quick)) { try { out.pauseVideo(); } catch {} }
        }
        if (shown) { this.slots[inI].announced = true; this.cur = { pick, deckIdx: inI, mixS: null, loadedAt: Date.now() }; }
      } catch (e) { toast(e.message); }
      this.incoming = null;
      this.busy = false;
    },
    duck() { this.ducked = true; this.applyVols(); },
    unduck() { this.ducked = false; if (!this.busy) this.applyVols(); },
    stop() { clearInterval(this.timer); for (const p of this.decks) try { p.pauseVideo(); } catch {} this.cur = null; this.slots = [null, null]; this.incoming = null; },
  };

  // Engine facade used by the voice (ducking) when Spotify mode is on
  const _duck = Engine.duck.bind(Engine), _unduck = Engine.unduck.bind(Engine);
  Engine.duck = () => (S.mode === 'spotify' ? SP.duck() : S.mode === 'youtube' ? YTM.duck() : _duck());
  Engine.unduck = () => (S.mode === 'spotify' ? SP.unduck() : S.mode === 'youtube' ? YTM.unduck() : _unduck());

  function takeTrack(t) {
    const prev = S.nowT;
    S.ready.splice(S.ready.indexOf(t), 1);
    t.used = true; S.played.push(t); S.setIndex++;
    const pick = { t, s: scoreNext(prev, t, S.setIndex - 1) };
    fillQueue();
    return pick;
  }
  function giveBack(t) {
    const ix = S.played.indexOf(t); if (ix >= 0) { S.played.splice(ix, 1); S.setIndex = Math.max(0, S.setIndex - 1); }
    t.used = false; if (!S.ready.includes(t)) S.ready.push(t);
  }
  // play a song again: re-cue it and mix straight into it; the DJ carries on from there
  async function replay(id) {
    const t = S.pool.get(id) || [...S.pool.values()].find((x) => String(x.id) === String(id)) || (S.nowT && String(S.nowT.id) === String(id) ? S.nowT : null);
    if (!t) { toast('That song is no longer in the crate.'); return; }
    if (!S.running) { toast('Start a set first.'); return; }
    if (S.replaying) { toast('Hold on, still bringing back the last one.'); return; }
    S.replaying = true;
    toast(`Bringing back ${t.title}…`);
    try {
      const ix = S.ready.indexOf(t); if (ix >= 0) S.ready.splice(ix, 1);
      t.used = false; t.failed = false; t.requested = Date.now();
      if (S.mode === 'preview' && !t.buffer) t.analyzed = false;
      if (!t.analyzed) { S.analyzing.add(t.id); try { await analyzeTrack(t); } finally { S.analyzing.delete(t.id); } t.analyzed = true; }
      S.ready.push(t); renderUpNext();
      if (S.mode === 'preview') {
        const wait = async (fn, ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (fn()) return true; await sleep(200); } return false; };
        await wait(() => !Engine.mix, 20000);
        const I = 1 - Engine.liveIdx(), d = Engine.D[I];
        if (d.t !== t) {
          if (d.pick && !d.announced && d.buf) { d.pick.t.buffer = d.buf; giveBack(d.pick.t); }
          if (d.playing) Engine.pause(I);
          Engine.load(I, takeTrack(t)); Ctl.low[I] = 0; Ctl.flt[I] = 0;
        }
        await wait(() => Engine.D[I].buf && Engine.D[I].t === t, 8000);
        if (!Engine.transition('filter')) Engine.transition('cut');
      } else if (S.mode === 'youtube') YTM.next(true);
      else SP.next(true);
    } catch { t.requested = 0; toast(`I couldn't bring back ${t.title} right now.`); }
    finally { S.replaying = false; }
  }
  function loadTrack(id) {
    const t = S.ready.find((x) => String(x.id) === String(id)); if (!t) return false;
    if (S.mode === 'preview') {
      const I = 1 - Engine.liveIdx(), d = Engine.D[I];
      if (!d || d.playing || d.scratching || Engine.mix) { toast(`Deck ${I ? 'B' : 'A'} is busy. Stop it first.`); return false; }
      if (d.pick && !d.announced && d.buf) { d.pick.t.buffer = d.buf; giveBack(d.pick.t); }
      Engine.load(I, takeTrack(t)); Ctl.low[I] = 0; Ctl.flt[I] = 0;
      toast(`Loaded ${t.title} on deck ${I ? 'B' : 'A'}.`);
    } else if (S.mode === 'youtube') {
      const I = 1 - (YTM.cur ? YTM.cur.deckIdx : 0);
      if (YTM.busy || YTM.state(I) === 1) { toast(`Deck ${I ? 'B' : 'A'} is busy. Stop it first.`); return false; }
      const old = YTM.slots[I]; if (old && !old.announced) giveBack(old.pick.t);
      const pick = takeTrack(t);
      YTM.slots[I] = { pick }; YTM.failed[I] = false;
      try { YTM.decks[I].cueVideoById({ videoId: t.ytId, startSeconds: YTM.plan(t).startS }); } catch {}
      toast(`Loaded ${t.title} on deck ${I ? 'B' : 'A'}.`);
    } else { toast('With Spotify, the DJ picks the next song for you.'); return false; }
    renderUpNext();
    return true;
  }
  window.Selector = { S, CFG, GENRES, buildPool: () => buildPool(), saveTaste, renderSeeds: () => renderSeeds(), toast: (m) => toast(m), Engine, YTM, SP, Ctl, scoreNext, arcPhase, energyPct, targetEnergy, loadTrack, isNew: (t) => isNew(t), get actx() { return actx; },
    dz: (p, q) => dz(p, q, true), replay: (id) => replay(id), queueSong: (raw, extra) => queueSong(raw, extra), startSet: () => startSet(), kingOn: () => kingOn(), pickGenre: (g) => pickGenre(g), setDjNote: (m) => setDjNote(m), IS_PHONE, renderUpNext: () => renderUpNext(),
    say: (m) => Voice.say(m), stopVoice: () => Voice.stopAll(), stopSet: () => stopSet(), show: (v) => show(v), store };

  // ---------- track helpers ----------
  const proto = { artistKey() { return this.artistId || String(this.artist || '').toLowerCase(); } };
  // ensure every pooled track has artistKey()
  function withProto(t) { if (t && !t.artistKey) Object.setPrototypeOf(t, proto); return t; }
  function isNew(t) { const a = S.taste.artists[t.artistId]; return !!t.discovery && !(a && a.seed); }

  // ---------- now playing / UI ----------
  let lastVoiceAt = -1, lastTalk = 0, greeted = null;
  function firstName() {
    try { const u = window.firebase && window.firebase.apps && window.firebase.apps.length && window.firebase.auth().currentUser; const n = u && String(u.displayName || '').trim().split(/\s+/)[0]; return n && /^[\p{L}'-]{1,20}$/u.test(n) ? n : null; } catch { return null; }
  }
  function onNowPlaying(pick, prevT, style) {
    const t = pick.t;
    S.nowT = t; S.nowStarted = Date.now();
    S.history = S.history || [];
    if (prevT) S.history.unshift({ ...prevT, buffer: null });
    S.history = S.history.slice(0, 30);
    $('#np-cover').src = t.cover || '';
    $('#np-title').textContent = t.title;
    $('#np-artist').textContent = t.artist;
    $('#np-bpm').textContent = Math.round(t.f.bpm * (t._rate || 1)) + ' BPM';
    $('#np-key').textContent = t.f.camelot + ' · ' + t.f.key;
    $('#np-energy').style.setProperty('--e', Math.round(energyPct(t.f.energy) * 100) + '%');
    $('#np-tag').textContent = S.genre !== 'all' ? genreOf(S.genre).name.toUpperCase() + ' DJ' : t.fav ? 'YOUR FAVORITE' : isNew(t) ? 'NEW FIND' : S.taste.artists[t.artistId] && S.taste.artists[t.artistId].seed ? 'FROM YOUR TASTE' : t.local ? 'HOT IN ' + regionName(S.region).toUpperCase() : t.afro ? 'AFROBEATS' : t.us ? 'TOP IN THE US' : t.world ? 'GLOBAL HIT' : 'FROM YOUR TASTE';
    $('#like').classList.toggle('on', !!S.taste.likes[t.id]);
    const why = reasonText(prevT, pick) + (style ? ` · ${{ blend: 'beat-matched blend', vox: 'vocal blend over the beat', filter: 'filter fade', cut: 'quick cut', fade: 'smooth fade', crossfade: 'two-deck crossfade', hand: 'your hand mix' }[style]}` : '');
    setDjNote(why);
    S.lastReason = why;
    try { window.dispatchEvent(new CustomEvent('sel:now', { detail: { pick, prevT, style, why } })); } catch {}
    setStatus('');
    renderUpNext(); renderHistory(); drawArc();
    document.title = `${t.title} · ${t.artist} — Ibiza`;
    if ('mediaSession' in navigator) {
      try { navigator.mediaSession.metadata = new MediaMetadata({ title: t.title, artist: t.artist, album: 'Ibiza', artwork: t.cover ? [{ src: t.cover, sizes: '250x250' }] : [] }); } catch {}
    }
    // DJ talk: intro, then every 4 tracks
    const i = S.setIndex;
    const now = Date.now();
    if (!prevT) { lastTalk = now; Voice.say(introLine(), 'intro').then(() => { const k = S.genre === 'kids' && Kid.name(); if (k) setTimeout(() => Kid.say(`Hi ${k}! This party is just for you!`), 800); }); }
    else if (now - lastTalk > 120000) {
      // a listener who just signed in hears their first name once (never on the Kids DJ)
      const name = S.genre !== 'kids' && firstName();
      if (name && greeted !== name) { greeted = name; lastTalk = now; lastVoiceAt = i; setTimeout(() => Voice.say(`Hey ${name}! Good to have you here on Ibiza.`, 'name'), 1500); }
      else if (S.genre === 'kids' && Kid.name() && i - lastVoiceAt >= 3 && Math.random() < 0.5) { const k = Kid.name(); lastTalk = now; lastVoiceAt = i; const L = [`${k}, show me your best dance!`, `Great dancing, ${k}!`, `This one's for you, ${k}!`, `${k}, are you ready? Let's go!`]; setTimeout(() => Kid.say(L[Math.floor(Math.random() * L.length)]), 1500); }
      else if (i - lastVoiceAt >= 4 || (arcPhase(i - 1) !== arcPhase(i - 2) && i - lastVoiceAt >= 2)) { lastTalk = now; lastVoiceAt = i; setTimeout(() => Voice.say(betweenLine(prevT, t), 'drop'), 1500); }
    }
  }

  function setDjNote(s) { const el = $('#dj-note'); if (el) el.textContent = s; }
  function setStatus(s) { const el = $('#status'); if (el) { el.textContent = s; el.hidden = !s; } }
  let toastT;
  function toast(s) { const el = $('#toast'); el.textContent = s; el.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('show'), 4200); }

  function renderUpNext() {
    const el = $('#upnext'); if (!el) return;
    const prev = S.nowT;
    const list = S.ready.map((t) => ({ t, s: scoreNext(prev, t, S.setIndex) })).sort((a, b) => (b.t.requested ? 1e9 - b.t.requested / 1e4 : b.s.total) - (a.t.requested ? 1e9 - a.t.requested / 1e4 : a.s.total)).slice(0, 4);
    el.innerHTML = list.length ? list.map(({ t }) => `<li data-id="${esc(t.id)}"${t.requested ? ' class="req"' : ''} title="Tap to load on the free deck"><img src="${esc(t.cover || '')}" alt=""><div><b>${esc(t.title)}</b><span>${esc(t.artist)}</span></div><em>${Math.round(t.f.bpm)} · ${esc(t.f.camelot)}</em></li>`).join('') : '<li class="dim">Analyzing records…</li>';
  }
  function renderHistory() {
    const el = $('#history'); if (!el) return;
    el.innerHTML = (S.history || []).slice(0, 12).map((t) => `<li data-replay="${esc(t.id)}" title="Tap to play it again"><img src="${esc(t.cover || '')}" alt=""><div><b>${esc(t.title)}</b><span>${esc(t.artist)}</span></div><em class="again">Play again</em></li>`).join('');
  }
  function renderProgress() {
    let p = 0;
    if (S.mode === 'spotify') p = SP.dur ? SP.pos / SP.dur : 0; else if (S.mode === 'youtube') p = YTM.dur ? YTM.pos / YTM.dur : 0; else p = Engine.progress();
    const el = $('#np-prog'); if (el) el.style.width = (p * 100).toFixed(1) + '%';
  }

  // energy arc + live visualizer
  function drawArc() {
    const c = $('#arc'); if (!c) return;
    const dpr = window.devicePixelRatio || 1, w = c.clientWidth, h = c.clientHeight;
    c.width = w * dpr; c.height = h * dpr;
    const g = c.getContext('2d'); g.scale(dpr, dpr); g.clearRect(0, 0, w, h);
    const start = Math.max(0, S.setIndex - 10), N = 18;
    g.strokeStyle = 'rgba(255,255,255,.18)'; g.setLineDash([4, 4]); g.beginPath();
    for (let i = 0; i <= N; i++) { const x = (i / N) * w, y = h - 8 - targetEnergy(start + i) * (h - 16); i ? g.lineTo(x, y) : g.moveTo(x, y); }
    g.stroke(); g.setLineDash([]);
    const pts = S.played.slice(start, S.setIndex).map((t, k) => [(k / N) * w, h - 8 - energyPct(t.f.energy) * (h - 16)]);
    if (pts.length) {
      const grad = g.createLinearGradient(0, 0, w, 0); grad.addColorStop(0, '#7c5cff'); grad.addColorStop(1, '#ff4fa3');
      g.strokeStyle = grad; g.lineWidth = 2.5; g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke();
      pts.forEach(([x, y], i) => { g.fillStyle = i === pts.length - 1 ? '#fff' : '#ff4fa3'; g.beginPath(); g.arc(x, y, i === pts.length - 1 ? 4.5 : 3, 0, 7); g.fill(); });
    }
  }
  function vizLoop() {
    const c = $('#viz');
    if (c && Engine.analyser && S.mode === 'preview') {
      const dpr = window.devicePixelRatio || 1, w = c.clientWidth, h = c.clientHeight;
      if (c.width !== w * dpr) { c.width = w * dpr; c.height = h * dpr; }
      const g = c.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
      const data = new Uint8Array(Engine.analyser.frequencyBinCount); Engine.analyser.getByteFrequencyData(data);
      const bars = 48, bw = w / bars;
      for (let i = 0; i < bars; i++) {
        const v = data[Math.floor(i * (data.length * 0.8) / bars)] / 255;
        const bh = Math.max(2, v * h);
        g.fillStyle = `hsla(${260 + i * 1.8}, 90%, ${55 + v * 15}%, ${0.35 + v * 0.65})`;
        g.fillRect(i * bw + 1, h - bh, bw - 2, bh);
      }
    }
    requestAnimationFrame(vizLoop);
  }

  // ---------- add a song: search any song and it plays next ----------
  function buildExtras() {
    const css = `.fullset-btn{display:flex;align-items:center;gap:12px;width:100%;margin-top:16px;padding:16px 20px;border-radius:20px;border:1px solid var(--line);background:linear-gradient(135deg,rgba(124,92,255,.18),rgba(255,79,163,.14));color:inherit;text-align:left;cursor:pointer}
.fullset-btn span{flex:1}.fullset-btn b{display:block;font-size:17px}.fullset-btn em{font-style:normal;color:var(--dim);font-size:14px}.fullset-btn i{font-style:normal;font-size:28px;opacity:.7}
.fs-sheet{position:fixed;inset:0;z-index:95;display:flex;align-items:flex-end;justify-content:center;background:rgba(6,4,12,.72);backdrop-filter:blur(10px)}
.fs-sheet[hidden]{display:none}
@media(min-width:760px){.fs-sheet{align-items:center}}
.fs-box{width:min(760px,100%);max-height:90vh;display:flex;flex-direction:column;background:linear-gradient(180deg,#191226,#0e0a17);border:1px solid var(--line);border-radius:24px 24px 0 0;overflow:hidden}
@media(min-width:760px){.fs-box{border-radius:24px;max-height:84vh}}
.fs-head{display:flex;align-items:center;gap:12px;padding:18px 20px 10px}.fs-head h2{flex:1;margin:0;font-size:20px}
.fs-x{width:40px;height:40px;border-radius:20px;border:1px solid var(--line);background:rgba(255,255,255,.06);color:inherit;font-size:20px}
.fs-search{display:block;padding:0 20px 10px}.fs-search input{width:100%;height:46px;padding:0 16px;border-radius:23px;border:1px solid var(--line);background:rgba(255,255,255,.07);color:inherit;font:inherit}
.fs-list{overflow-y:auto;padding:0 10px 16px;overscroll-behavior:contain}
.fs-list button{display:flex;align-items:center;gap:12px;width:100%;padding:8px 10px;border-radius:12px;text-align:left;color:inherit}
.fs-list button:hover{background:rgba(255,255,255,.06)}
.fs-list .no{width:30px;text-align:right;color:var(--dim);font-size:13px;flex:none}
.fs-list img{width:42px;height:42px;border-radius:8px;flex:none;object-fit:cover}
.fs-list div{flex:1;min-width:0}.fs-list b{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.fs-list div span{display:block;color:var(--dim);font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.fs-list em{font-style:normal;font-size:12px;font-weight:700;color:var(--b);white-space:nowrap}
.addsong{margin-top:16px;position:relative;z-index:40}.addsong .searchwrap{position:relative}.addsong .searchwrap{display:flex;gap:10px;align-items:center}.addsong input{flex:1}
#song-res{position:absolute;z-index:6;left:0;right:0;top:calc(100% + 6px);background:#1a1626;border:1px solid var(--line);border-radius:14px;overflow-x:hidden;overflow-y:auto;max-height:min(62vh,520px);overscroll-behavior:contain;box-shadow:0 20px 50px rgba(0,0,0,.5)}
#song-res .song-head{position:sticky;top:0;z-index:1;padding:8px 12px;font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:var(--dim);background:#1a1626;border-bottom:1px solid var(--line)}
#song-res button{display:flex;align-items:center;gap:12px;width:100%;padding:9px 12px;text-align:left}
#song-res button:hover,#song-res button:focus{background:rgba(255,255,255,.06);outline:none}
#song-res img{width:40px;height:40px;border-radius:8px;flex:0 0 40px}
#song-res b{display:block;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#song-res span{display:block;color:var(--dim);font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#song-res div{min-width:0;flex:1}#song-res em{font-style:normal;font-size:12px;color:var(--b);font-weight:700;white-space:nowrap}
.voxbtn{display:inline-flex;align-items:center;gap:8px;border-radius:24px;padding:0 16px;height:48px;background:linear-gradient(135deg,rgba(37,244,238,.18),rgba(254,44,85,.22));border:1px solid rgba(255,255,255,.14);font-weight:700}
body:not([data-mode=preview]) .voxbtn{display:none}
#upnext li.req b:after{content:" · requested";color:var(--b);font-weight:700;font-size:12px}
.kingcard{position:relative;display:flex;align-items:center;gap:16px;width:100%;margin:0 0 14px;padding:18px 20px;border-radius:22px;text-align:left;overflow:hidden;isolation:isolate;background:linear-gradient(120deg,#2a1606 0%,#5a1030 55%,#2b0d4a 100%);border:1px solid rgba(255,207,63,.45);box-shadow:0 18px 50px -20px rgba(255,61,119,.7),inset 0 1px 0 rgba(255,255,255,.08);transition:transform .25s cubic-bezier(.2,.8,.2,1)}
.kingcard:hover{transform:translateY(-2px)}.kingcard:active{transform:scale(.985)}
.kingcard:before{content:"";position:absolute;inset:-40%;background:conic-gradient(from 0deg,transparent,rgba(255,207,63,.18),transparent 30%);animation:spin 9s linear infinite;z-index:-1}
.kingcard .crown{flex:0 0 58px;height:58px;border-radius:18px;display:grid;place-items:center;font-size:30px;background:linear-gradient(135deg,#ffcf3f,#ff8a3d);box-shadow:0 8px 24px -8px rgba(255,207,63,.8)}
.kingcard b{display:block;font-size:22px;font-weight:800;letter-spacing:-.01em;background:linear-gradient(90deg,#ffe28a,#ffcf3f 40%,#ff7aa8);-webkit-background-clip:text;background-clip:text;color:transparent}
.kingcard span{display:block;color:rgba(255,255,255,.82);font-size:14px;margin-top:2px}
.kingcard em{margin-left:auto;font-style:normal;font-weight:800;font-size:13px;padding:8px 14px;border-radius:999px;background:#ffcf3f;color:#2a1606;white-space:nowrap}
.kingcard.on{box-shadow:0 0 0 2px #ffcf3f,0 18px 50px -20px rgba(255,61,119,.7)}
@media(max-width:599px){.kingcard em{display:none}.kingcard b{font-size:19px}}
.mix30-sw.on i{background:linear-gradient(135deg,#00e5ff,#7c5cff)!important}
.king-sw.on i{background:linear-gradient(135deg,#ffcf3f,#ff3d77)!important}
body[data-king="1"] .aibar{border-color:rgba(255,207,63,.45);box-shadow:0 0 0 1px rgba(255,207,63,.2),0 10px 40px -16px rgba(255,207,63,.5)}
body[data-king="1"] .ailabel:after{content:"👑 KING OF BLENDS";margin-left:10px;color:#ffcf3f;letter-spacing:.14em}
body[data-king="1"] .booth:before{background:radial-gradient(600px 160px at 50% 0,rgba(255,207,63,.16),transparent 70%)}`;
    document.head.insertAdjacentHTML('beforeend', `<style>${css}</style>`);
    const panels = $('.panels');
    // the DJ's full set: one tap opens every song it has, without making the page longer
    if (panels && !$('#fullset-btn')) {
      panels.insertAdjacentHTML('afterend', `<button class="fullset-btn" id="fullset-btn" type="button"><span><b>Full set</b><em id="fullset-n">Every song in this DJ</em></span><i aria-hidden="true">›</i></button>
<div class="fs-sheet" id="fs-sheet" hidden role="dialog" aria-modal="true" aria-label="Full set"><div class="fs-box"><div class="fs-head"><h2 id="fs-title">Full set</h2><button class="fs-x" id="fs-x" type="button" aria-label="Close">×</button></div>
<label class="fs-search"><input id="fs-q" type="search" placeholder="Filter the set" autocomplete="off" aria-label="Filter the set"></label><div class="fs-list" id="fs-list"></div></div></div>`);
      const fsDraw = () => {
        const q = $('#fs-q').value.trim(), list = poolSongs(q);
        const G = genreOf(S.genre);
        $('#fs-title').textContent = `${S.genre === 'all' ? 'Your' : G.name} full set · ${poolSongs('').length} songs`;
        fsHits = list.slice(0, 1500);
        $('#fs-list').innerHTML = fsHits.map((t, i) => `<button data-fs="${i}"><span class="no">${i + 1}</span><img loading="lazy" src="${esc(t.cover || '')}" alt=""><div><b>${esc(t.title)}</b><span>${esc(t.artist)}</span></div><em>${S.nowT === t ? 'Playing' : t.used ? 'Played' : 'Play next'}</em></button>`).join('')
          || `<div class="dim pad">${S.pool.size ? 'No songs match.' : 'Press Start and the whole set shows up here.'}</div>`;
      };
      let fsHits = [];
      const fsCount = () => { const n = poolSongs('').length; const el = $('#fullset-n'); if (el) el.textContent = n ? `${n} songs · tap to see them all` : 'Every song in this DJ'; };
      $('#fullset-btn').addEventListener('click', () => { $('#fs-sheet').hidden = false; $('#fs-q').value = ''; fsDraw(); });
      $('#fs-x').addEventListener('click', () => { $('#fs-sheet').hidden = true; });
      $('#fs-sheet').addEventListener('click', (e) => { if (e.target.id === 'fs-sheet') $('#fs-sheet').hidden = true; });
      $('#fs-q').addEventListener('input', fsDraw);
      $('#fs-list').addEventListener('click', (e) => { const b = e.target.closest('[data-fs]'); if (!b) return; const t = fsHits[+b.dataset.fs]; if (t) { queueSong({ pool: t }); b.querySelector('em').textContent = 'Up next'; } });
      document.addEventListener('keydown', (e) => { if (e.key === 'Escape') $('#fs-sheet').hidden = true; });
      window.addEventListener('sel:pool', fsCount); window.addEventListener('sel:now', fsCount); setInterval(fsCount, 5000);
    }
    if (panels && !$('#song-q')) panels.insertAdjacentHTML('beforebegin', `<div class="card addsong"><h3>Add a song</h3><div class="searchwrap"><input id="song-q" type="search" placeholder="Tap to pick a song, or search any song…" autocomplete="off" aria-label="Search a song to add"><div id="song-res" hidden></div></div></div>`);
    const djs = $('#genres');
    if (djs && !$('#kingcard')) djs.insertAdjacentHTML('beforebegin', `<button class="kingcard" id="kingcard" type="button"><span class="crown" aria-hidden="true">👑</span><span><b>King of Blends</b><span>The master blend DJ. One hit's vocals over the next hit's beat, back to back.</span></span><em>Start blending</em></button>`);
    const mixBtn = `<button class="autosw mix30-sw" type="button" aria-pressed="false" title="Mix 30-second previews of every song, fast, instead of full songs"><i></i><span>⚡ 30-sec mix</span></button>`;
    { const a = $('.aisw'); if (a && !a.querySelector('.mix30-sw')) a.querySelector('.voice-sw').insertAdjacentHTML('afterend', mixBtn); }
    { const o = $('.opts'); if (o && !o.querySelector('.mix30-sw')) o.insertAdjacentHTML('beforeend', mixBtn); }
    const kingBtn = `<button class="autosw king-sw" type="button" aria-pressed="false" title="Blend vocals over beats in any DJ"><i></i><span>👑 King of Blends</span></button>`;
    const aisw = $('.aisw'); if (aisw && !aisw.querySelector('.king-sw')) aisw.querySelector('.voice-sw').insertAdjacentHTML('afterend', kingBtn);
    const opts = $('.opts'); if (opts && !opts.querySelector('.king-sw')) opts.insertAdjacentHTML('beforeend', kingBtn);
    const skip = $('#skip');
    if (skip && !$('#vox-now')) skip.insertAdjacentHTML('afterend', `<button class="voxbtn" id="vox-now" title="Lay the next song's vocals over this beat"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.9V22h2v-3.1A7 7 0 0 0 19 12z"/></svg>Vocal blend</button>`);
  }
  // the song picker: tap the field and every song this DJ has is right there to scroll and tap;
  // typing filters them, and anything else on Deezer shows up underneath
  let songT, songHits = [], songN = 0;
  const songKey = (title, artist) => (String(title || '') + '|' + String(artist || '')).toLowerCase().replace(/\(.*?\)|\[.*?\]/g, '').replace(/[^a-z0-9|]/g, '');
  function poolSongs(q) {
    const want = String(q || '').toLowerCase().trim();
    const seen = new Set(), out = [];
    const list = [...S.pool.values()].filter((t) => !t.failed && !t.noYt && (!S.genre || S.genre === 'all' || t.genre === S.genre))
      .sort((a, b) => (a.chartPos || 999) - (b.chartPos || 999));
    for (const t of list) {
      if (want && !(t.title + ' ' + t.artist).toLowerCase().includes(want)) continue;
      const k = songKey(t.title, t.artist); if (seen.has(k)) continue; seen.add(k); out.push(t);
    }
    return out;
  }
  function songRow(i, title, artist, cover, tag) {
    return `<button data-song="${i}"><img loading="lazy" src="${esc(cover || '')}" alt=""><div><b>${esc(title)}</b><span>${esc(artist)}</span></div><em>${tag}</em></button>`;
  }
  function drawSongs(q, extra, yt) {
    const box = $('#song-res');
    const mine = poolSongs(q).slice(0, 600);
    const seen = new Set(mine.map((t) => songKey(t.title, t.artist)));
    const more = (extra || []).filter((t) => t.preview && !seen.has(songKey(t.title_short || t.title, t.artist && t.artist.name)) && seen.add(songKey(t.title_short || t.title, t.artist && t.artist.name)));
    // any video the user picks straight off YouTube search, including ones with no match on Deezer
    const ytHits = (yt || []).map((v) => ({ pool: addToPool(trackFromYt(v)) }));
    songHits = mine.map((t) => ({ pool: t })).concat(more.map((t) => ({ raw: t }))).concat(ytHits);
    const head = mine.length ? `<div class="song-head">${q ? 'In this DJ' : `All ${mine.length} songs in this DJ`}</div>` : '';
    const rows = mine.map((t, i) => songRow(i, t.title, t.artist, t.cover, S.nowT === t ? 'Playing' : 'Play next'));
    const rows2 = more.map((t, j) => songRow(mine.length + j, t.title_short || t.title, t.artist && t.artist.name, t.album && t.album.cover_small, 'Play next'));
    const rows3 = ytHits.map(({ pool: t }, k) => songRow(mine.length + more.length + k, t.title, t.artist, t.cover, 'Play next'));
    box.innerHTML = head + rows.join('') + (rows2.length ? `<div class="song-head">More songs</div>${rows2.join('')}` : '') + (rows3.length ? `<div class="song-head">From YouTube</div>${rows3.join('')}` : '')
      || (S.pool.size ? '<div class="dim pad">No songs found. Try another spelling.</div>' : '<div class="dim pad">Press Start and every song in this DJ shows up here.</div>');
    box.hidden = false;
  }
  function onSongSearch(e) {
    const q = e.target.value.trim(); clearTimeout(songT);
    const n = ++songN;
    drawSongs(q);
    if (q.length < 2) return;
    songT = setTimeout(async () => {
      // search Deezer's catalog as before, plus — in YouTube mode — a free-text YouTube
      // search so people can find and play any video, not just what's in the catalog
      const wantYt = S.mode === 'youtube' && YTM.available();
      const [dzRes, ytRes] = await Promise.allSettled([
        dz('/search', { q, limit: 10 }),
        wantYt ? fetch('/api/yt-search?' + new URLSearchParams({ q }).toString()).then((r) => r.json()) : Promise.resolve(null),
      ]);
      if (n !== songN) return;
      const extra = dzRes.status === 'fulfilled' ? dzRes.value.data || [] : [];
      const yt = ytRes.status === 'fulfilled' && ytRes.value ? ytRes.value.items || [] : [];
      drawSongs(q, extra, yt);
    }, 250);
  }
  async function queueSong(raw, extra) {
    const t = raw && raw.pool ? raw.pool : addToPool(trackFromDz(raw, S.genre !== 'all' ? { genre: S.genre } : {}));
    if (!t) { toast('That song is on your skip list.'); return; }
    t.requested = Date.now(); t.used = false; t.failed = false;
    if (extra) Object.assign(t, extra);
    if (S.ready.includes(t)) { renderUpNext(); if (!extra || !extra.quiet) toast(`${t.title} is up next.`); return t; }
    if (!S.running) { toast('Start a set first, then add songs.'); return; }
    toast(`Adding ${t.title}…`);
    S.analyzing.add(t.id);
    try {
      if (!t.analyzed) await analyzeTrack(t);
      t.analyzed = true; S.ready.push(t);
      if (S.mode === 'preview' || S.mode === 'youtube') {
        const I = S.mode === 'preview' ? 1 - Engine.liveIdx() : 1 - (YTM.cur ? YTM.cur.deckIdx : 0);
        const busy = S.mode === 'preview' ? (Engine.mix || Engine.D[I].playing) : (YTM.busy || YTM.state(I) === 1);
        if (!busy) loadTrack(t.id);
      }
      renderUpNext();
      if (!extra || !extra.quiet) toast(`${t.title} plays next.`);
      return t;
    } catch { t.requested = 0; toast(`I couldn't load ${t.title}. Try another version.`); }
    finally { S.analyzing.delete(t.id); }
  }

  // ---------- taste editor ----------
  function renderSeeds() {
    const el = $('#seeds');
    const seeds = seedArtists();
    el.innerHTML = seeds.map((a) => `<span class="chip"><img src="${esc(a.pic || '')}" alt="">${esc(a.name)}<button data-rm="${esc(a.id)}" aria-label="Remove">×</button></span>`).join('') || '<span class="dim">No artists yet. The DJ starts from what’s hot where you are.</span>';
    $('#mine summary small').textContent = seeds.length ? `${seeds.length} artist${seeds.length > 1 ? 's' : ''} you love` : 'Add artists you love. Optional.';
  }
  function addSeed(a) {
    const id = String(a.id);
    S.taste.artists[id] = { ...(S.taste.artists[id] || {}), name: a.name, pic: a.picture_medium || a.pic, w: Math.max(1, (S.taste.artists[id] || {}).w || 0), seed: true };
    saveTaste(); renderSeeds(); S.poolBuilt = false;
  }
  let searchT;
  async function onSearch(e) {
    const q = e.target.value.trim();
    clearTimeout(searchT);
    const box = $('#results');
    if (q.length < 2) { box.hidden = true; return; }
    searchT = setTimeout(async () => {
      try {
        const r = await dz('/search/artist', { q, limit: 6 }, true);
        if (e.target.value.trim() !== q) return;
        box.innerHTML = (r.data || []).map((a) => `<button data-add='${esc(JSON.stringify({ id: a.id, name: a.name, picture_medium: a.picture_medium }))}'><img src="${esc(a.picture_medium)}" alt="">${esc(a.name)}<small>${(a.nb_fan || 0).toLocaleString()} fans</small></button>`).join('') || '<div class="dim pad">No artists found</div>';
        box.hidden = false;
      } catch {
        if (e.target.value.trim() !== q) return;
        box.innerHTML = '<div class="dim pad">Search is busy for a second. Trying again…</div>'; box.hidden = false;
        clearTimeout(searchT); searchT = setTimeout(() => onSearch(e), 2500);
      }
    }, 250);
  }
  async function loadPopular() {
    try {
      let list = [];
      const id = S.region ? await chartId(S.region) : null;
      if (id) {
        const r = await dz(`/playlist/${id}/tracks`, { limit: 60 }, true);
        const seen = new Set();
        for (const t of r.data || []) { const ar = t.artist; if (!ar || seen.has(ar.id)) continue; seen.add(ar.id); list.push({ id: ar.id, name: ar.name, picture_medium: ar.picture_medium }); if (list.length >= 14) break; }
        $('#pop-title').textContent = 'Popular in ' + regionName(S.region);
      }
      if (!list.length) { const r = await dz('/chart/0/artists', { limit: 14 }, true); list = r.data || []; $('#pop-title').textContent = 'Popular right now'; }
      $('#popular').innerHTML = list.map((a) => `<button class="pop" data-add='${esc(JSON.stringify({ id: a.id, name: a.name, picture_medium: a.picture_medium }))}'><img src="${esc(a.picture_medium)}" alt="">${esc(a.name)}</button>`).join('');
      if (!list.length) throw new Error('empty');
      popTries = 0;
    } catch { if (popTries++ < 5) setTimeout(loadPopular, 3000 * popTries); }
  }
  let popTries = 0;
  async function detectRegion() {
    if (!S.region) {
      try { const r = await fetch('/api/geo'); const j = await r.json(); if (j.country && REGIONS.some((x) => x[0] === j.country)) S.region = j.country; } catch {}
      if (!S.region) S.region = 'US';
    }
    const sel = $('#region');
    sel.innerHTML = REGIONS.map(([cc, n]) => `<option value="${cc}">${esc(n)}</option>`).join('');
    sel.value = S.region;
    renderGenres();
    $('#kicker').textContent = `AI DJ · ${regionName(S.region)} + worldwide`;
  }

  function renderGenres() {
    const el = $('#genres'); if (!el) return;
    const kc = $('#kingcard');
    if (kc) kc.classList.toggle('on', S.genre === 'blends');
    el.innerHTML = GENRES.filter((g) => !g.king && !g.hidden).map((g) => `<button class="gtile${g.id === S.genre ? ' on' : ''}" data-genre="${g.id}" style="--g1:${g.c[0]};--g2:${g.c[1]}"><b>${esc(g.name)}</b><span>${esc(g.sub)}</span><i aria-hidden="true"></i></button>`).join('');
  }
  function pickGenre(id) {
    S.genre = genreOf(id).id; store.set('genre', S.genre);
    renderGenres(); Voice.renderPicker();
    $('#start-label').textContent = S.genre === 'all' ? 'Start the party' : `Start ${genreOf(S.genre).name} DJ`;
    syncKing();
  }

  // ---------- connections ----------
  function renderConnect() {
    const on = SP.connected();
    $('#sp-login').hidden = on || !SP.clientId;
    $('#sp-on').hidden = !on;
    $('#save-set').hidden = true;
  }
  // Spotify's rules: Spotify songs and data stay in the Spotify DJ (spotify.js); the blend DJs never use them
  function pickSource() {
    if (S.mix30) return 'preview'; // the 30-second mix: free previews of every song, blended back to back
    if (YTM.available()) return 'youtube';
    return 'preview';
  }

  // ---------- run ----------
  async function startSet() {
    if (S.genre === 'kids') await Kid.ask();
    const src = pickSource();
    const wantSpotify = src === 'spotify' && SP.connected();
    const wantYt = src === 'youtube' && YTM.available();
    Engine.init();
    if (actx.state === 'suspended') actx.resume();
    if ('speechSynthesis' in window) { try { speechSynthesis.speak(new SpeechSynthesisUtterance('')); } catch {} }
    show('player'); syncKing();
    if (!(history.state && history.state.v === 'player')) history.pushState({ v: 'player' }, '', '#live');
    S.mode = 'preview';
    if (wantSpotify) {
      setStatus('Connecting to Spotify player…');
      try { await SP.startPlayer(); S.mode = 'spotify'; }
      catch (e) {
        toast(e.message === 'premium' ? 'Playing full songs from Spotify needs Premium, so the DJ is mixing other sources instead.' : 'Spotify could not start, so the DJ is mixing other sources instead.');
      }
    } else if (wantYt) {
      setStatus('Loading the YouTube decks…');
      document.body.dataset.mode = 'youtube';
      try { await YTM.init(); S.mode = 'youtube'; }
      catch (e) { toast('YouTube could not start (' + e.message + '). Mixing previews instead.'); }
    }
    document.body.dataset.mode = S.mode;
    $('#np-source').textContent = (S.genre !== 'all' ? genreOf(S.genre).name + ' DJ · ' : '') + (S.mode === 'spotify' ? 'Full songs from your Spotify' : S.mode === 'youtube' ? 'Full songs · two-deck mix' : 'Live mix · song previews');
    S.warming = true;
    if (!S.poolBuilt || S.poolGenre !== S.genre) await buildPool();
    [...S.pool.values()].forEach(withProto);
    S.running = true;
    fillQueue();
    setStatus('Analyzing tempo, key and energy…');
    const t0 = Date.now();
    while (S.ready.length < 3 && Date.now() - t0 < 25000) { await sleep(300); if (S.ready.length >= 1 && Date.now() - t0 > 12000) break; }
    if (!S.ready.length) { setStatus('Could not load music right now. Please try again in a minute.'); S.running = false; return; }
    // open on a warm-up track
    const first = chooseNext(null);
    if (S.mode === 'spotify') await SP.start(first); else if (S.mode === 'youtube') await YTM.start(first); else await Engine.start(first);
  }

  function stopSet() {
    S.running = false; S.warming = false;
    Engine.stop(); SP.stop(); YTM.stop();
    for (const t of S.ready) { t.analyzed = false; t.buffer = null; }
    S.ready = [];
    Voice.stopAll();
  }

  function like() {
    const t = S.nowT; if (!t) return;
    const on = !S.taste.likes[t.id];
    if (on) { S.taste.likes[t.id] = 1; if (t.artistId) { const a = S.taste.artists[t.artistId] || (S.taste.artists[t.artistId] = { name: t.artist, w: 0.5 }); a.w = Math.min(1.6, a.w + 0.25); } toast('Got it, more like this.'); }
    else delete S.taste.likes[t.id];
    $('#like').classList.toggle('on', on);
    saveTaste();
  }
  function skip() {
    const t = S.nowT;
    if (t && Date.now() - S.nowStarted < 15000) {
      S.taste.bans[t.id] = 1;
      if (t.artistId && S.taste.artists[t.artistId]) S.taste.artists[t.artistId].w = Math.max(0.05, S.taste.artists[t.artistId].w - 0.15);
      saveTaste();
    }
    if (S.mode === 'spotify') SP.next(true); else if (S.mode === 'youtube') YTM.next(true); else Engine.skip();
  }

  function show(view) { $$('section[data-view]').forEach((v) => (v.hidden = v.dataset.view !== view)); document.body.dataset.view = view; }
  function goHome() {
    if (document.body.dataset.view !== 'player') { window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    stopSet(); show('setup'); renderSeeds(); window.scrollTo(0, 0);
  }
  function leavePlayer() { if (history.state && history.state.v === 'player') history.back(); else goHome(); }
  window.addEventListener('popstate', () => { if (document.body.dataset.view === 'player') goHome(); });

  // ---------- wire up ----------
  function bind() {
    buildExtras();
    $('#search').addEventListener('input', onSearch);
    $('#song-q').addEventListener('input', onSongSearch);
    $('#song-res').addEventListener('click', (e) => { const b = e.target.closest('[data-song]'); if (!b) return; const h = songHits[+b.dataset.song]; $('#song-res').hidden = true; $('#song-q').value = ''; if (h) queueSong(h.pool ? h : h.raw); });
    for (const ev of ['focus', 'click']) $('#song-q').addEventListener(ev, (e) => { if ($('#song-res').hidden) drawSongs(e.target.value.trim()); });
    document.addEventListener('click', (e) => { if (!e.target.closest('.addsong')) { const r = $('#song-res'); if (r) r.hidden = true; } });
    $('#kingcard').addEventListener('click', () => { pickGenre('blends'); startSet(); });
    S.mix30 = !!store.get('mix30', false);
    const syncMix30 = () => document.querySelectorAll('.mix30-sw').forEach((b) => { b.classList.toggle('on', S.mix30); b.setAttribute('aria-pressed', String(S.mix30)); });
    syncMix30();
    document.querySelectorAll('.mix30-sw').forEach((b) => b.addEventListener('click', () => {
      S.mix30 = !S.mix30; store.set('mix30', S.mix30); syncMix30();
      toast(S.mix30 ? '30-sec mix on: the best 30 seconds of every song, blended back to back.' : '30-sec mix off: full songs, mixed like a club set.');
      // switch the set that's playing over to the other mode, same DJ
      if (S.running || S.warming) { stopSet(); setTimeout(() => startSet(), 300); }
    }));
    document.querySelectorAll('.king-sw').forEach((b) => b.addEventListener('click', () => {
      if (S.genre === 'blends') { toast('The King of Blends DJ always blends. Pick another DJ to switch it off.'); syncKing(); return; }
      S.king = !S.king; store.set('king', S.king); syncKing();
      Engine.D.forEach((d) => { d.planned = null; });
      toast(S.king ? 'King of Blends on. Every mix that fits becomes a vocal blend.' : 'King of Blends off.');
    }));
    syncKing();
    $('#vox-now').addEventListener('click', () => {
      const r = Engine.vocalBlend();
      if (r === 'nofit') toast('These two songs are too far apart in tempo for a vocal blend. Try Mix now, or wait for the next pair.');
      else if (r === 'late') toast('Not enough of this song left for a vocal blend. Try on the next one.');
      else if (r === 'busy') toast('The next record is still loading.');
    });
    document.addEventListener('click', (e) => {
      const add = e.target.closest('[data-add]');
      if (add) { addSeed(JSON.parse(add.dataset.add)); $('#results').hidden = true; $('#search').value = ''; return; }
      const rm = e.target.closest('[data-rm]');
      if (rm) { const a = S.taste.artists[rm.dataset.rm]; if (a) { a.seed = false; a.w = 0; } saveTaste(); renderSeeds(); S.poolBuilt = false; return; }
      if (!e.target.closest('.searchwrap')) $('#results').hidden = true;
    });
    $('#start').addEventListener('click', startSet);
    $('#like').addEventListener('click', like);
    $('#skip').addEventListener('click', skip);
    $('#back').addEventListener('click', leavePlayer);
    $('#hback').addEventListener('click', leavePlayer);
    $('#home-link').addEventListener('click', (e) => { e.preventDefault(); if (document.body.dataset.view === 'player') leavePlayer(); else goHome(); });
    const vbs = $$('.voice-sw');
    const setV = () => vbs.forEach((b) => { b.classList.toggle('on', S.voice); b.setAttribute('aria-pressed', String(S.voice)); b.title = S.voice ? 'DJ voice is on. Tap to turn it off.' : 'DJ voice is off. Tap to turn it on.'; });
    vbs.forEach((b) => b.addEventListener('click', () => {
      S.voice = !S.voice; store.set('voice', S.voice); setV();
      if (!S.voice) Voice.stopAll(); else if ((S.voiceId || '').startsWith('ai:')) AIVoice.load();
      toast(S.voice ? 'DJ voice on.' : 'DJ voice off. The DJ will stay quiet and just mix.');
    }));
    setV();
    Voice.renderPicker();
    $('#voice-pick').addEventListener('change', (e) => {
      S.voiceId = e.target.value; store.set('voiceId', S.voiceId);
      const demo = "Ibiza in the mix. This is how I'll sound tonight.";
      if (!S.voice) return;
      Engine.init();
      if (S.voiceId.startsWith('ai:')) AIVoice.load().then(() => { if (AIVoice.ready) Voice.say(demo); });
      else Voice.say(demo, 'intro');
    });
    const moods = $$('[name=mood],[name=mood2]');
    moods.forEach((r) => { r.checked = r.value === S.mood; r.addEventListener('change', () => { S.mood = r.value; store.set('mood', S.mood); moods.forEach((x) => (x.checked = x.value === S.mood)); drawArc(); renderUpNext(); }); });
    $$('[name=pace]').forEach((r) => { r.checked = r.value === S.pace; r.addEventListener('change', () => { S.pace = r.value; store.set('pace', S.pace); }); });
    $('#region').addEventListener('change', (e) => { S.region = e.target.value; store.set('region', S.region); S.pool.clear(); S.poolBuilt = false; $('#kicker').textContent = `AI DJ · ${regionName(S.region)} + worldwide`; loadPopular(); });
    $('#genres').addEventListener('click', (e) => { const b = e.target.closest('[data-genre]'); if (!b) return; pickGenre(b.dataset.genre); startSet(); });
    $('#sp-login').addEventListener('click', () => SP.login());
    $('#sp-logout').addEventListener('click', () => SP.logout());
    $('#save-set').addEventListener('click', () => SP.saveSet().catch((e) => toast(e.message)));
    $('#reset').addEventListener('click', () => { if (confirmReset()) { S.taste = { artists: {}, likes: {}, bans: {} }; saveTaste(); S.pool.clear(); renderSeeds(); } });
    window.addEventListener('resize', drawArc);
    window.addEventListener('sel:toast', (e) => toast(e.detail));
    if ('mediaSession' in navigator) { try { navigator.mediaSession.setActionHandler('nexttrack', skip); } catch {} }
  }
  function confirmReset() { return window.confirm('Clear your saved artists, likes and skips?'); }

  async function init() {
    document.head.insertAdjacentHTML('beforeend', '<style>[hidden]{display:none!important}</style>');
    bind();
    try { const r = await fetch('/api/config', { cache: 'no-store' }); Object.assign(CFG, await r.json(), { loaded: true }); } catch {}
    try { window.dispatchEvent(new CustomEvent('sel:config', { detail: CFG })); } catch {}
    SP.useSite();
    const came = await SP.handleRedirect().catch((e) => { toast(e.message); return false; });
    renderConnect(); renderSeeds(); vizLoop();
    if (location.hash === '#live') history.replaceState(null, '', location.pathname + location.search);
    show('setup');
    if (!IS_PHONE && S.voice && (S.voiceId || '').startsWith('ai:')) setTimeout(() => AIVoice.load(), 5000);
    // taste imported from Spotify by older versions is removed: Spotify data only powers the Spotify DJ
    { let n = 0; for (const [id, a] of Object.entries(S.taste.artists)) if (a && a.from === 'spotify') { delete S.taste.artists[id]; n++; } if (n) { saveTaste(); renderSeeds(); } }
    for (const f of ['/studio.js?v=1', '/spotify.js?v=1', '/controls.js?v=1', '/artists.js?v=1']) { const st = document.createElement('script'); st.src = f; st.defer = true; document.head.appendChild(st); }
    await detectRegion(); if (FIRST_VISIT) S.genre = REGION_DJ[S.region] || 'all'; pickGenre(S.genre); loadPopular();
    if (came && SP.connected()) toast('Spotify connected. Your Spotify DJ is getting ready.');
    try { window.dispatchEvent(new CustomEvent('sel:spotify', { detail: { came: !!came } })); } catch {}
  }
  init();
})();
