/* Board and card data. A map is eight country sets, four airports and two
   companies poured into the standard forty-stop frame: the price ladder and
   rent tables are shared, so only the geography changes between maps. */

/* ---- countries -------------------------------------------------------- */
const GROUPS = {
  /* Classic map */
  brazil:  { name: 'Brazil',  color: '#8a6440', house: 50  },
  israel:  { name: 'Israel',  color: '#4a7f9c', house: 50  },
  italy:   { name: 'Italy',   color: '#a4586b', house: 100 },
  germany: { name: 'Germany', color: '#bd7738', house: 100 },
  france:  { name: 'France',  color: '#b79a45', house: 150 },
  uk:      { name: 'UK',      color: '#4d8358', house: 200 },
  /* Meridian map */
  mexico:  { name: 'Mexico',  color: '#7f7a48', house: 50  },
  turkey:  { name: 'Turkey',  color: '#a85246', house: 50  },
  korea:   { name: 'Korea',   color: '#5a6f9e', house: 100 },
  japan:   { name: 'Japan',   color: '#b4636f', house: 100 },
  myanmar: { name: 'Myanmar', color: '#c08a3a', house: 150 },
  spain:   { name: 'Spain',   color: '#8f7c3a', house: 200 },
  /* On both maps */
  china:   { name: 'China',   color: '#aa4740', house: 150 },
  usa:     { name: 'USA',     color: '#42608f', house: 200 }
};

/* ---- flags, drawn as inline SVG on an 18x12 field ---------------------- */
function starPoints(cx, cy, r, rot) {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const rad = (i % 2 === 0) ? r : r * 0.42;
    const a = (Math.PI / 5) * i - Math.PI / 2 + (rot || 0);
    pts.push((cx + rad * Math.cos(a)).toFixed(2) + ',' + (cy + rad * Math.sin(a)).toFixed(2));
  }
  return pts.join(' ');
}

const FLAG_SVG = {
  brazil: `<svg viewBox="0 0 18 12" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <rect width="18" height="12" fill="#1f7a4a"/>
    <polygon points="9,1.1 16.6,6 9,10.9 1.4,6" fill="#e3c93f"/>
    <circle cx="9" cy="6" r="2.5" fill="#25488c"/>
    <path d="M6.6 5.2 Q9 4.1 11.4 5.5" stroke="#f2efe6" stroke-width=".75" fill="none"/>
  </svg>`,

  israel: `<svg viewBox="0 0 18 12" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <rect width="18" height="12" fill="#f2efe6"/>
    <rect y="1.1" width="18" height="1.7" fill="#2c5aa8"/>
    <rect y="9.2" width="18" height="1.7" fill="#2c5aa8"/>
    <path d="M9 3.3 L11.1 7 H6.9 Z M9 8.7 L6.9 5 H11.1 Z" fill="none" stroke="#2c5aa8" stroke-width=".62"/>
  </svg>`,

  italy: `<svg viewBox="0 0 18 12" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <rect width="6" height="12" fill="#1f7a4a"/>
    <rect x="6" width="6" height="12" fill="#f2efe6"/>
    <rect x="12" width="6" height="12" fill="#b8392f"/>
  </svg>`,

  germany: `<svg viewBox="0 0 18 12" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <rect width="18" height="4" fill="#1b1b1b"/>
    <rect y="4" width="18" height="4" fill="#b8392f"/>
    <rect y="8" width="18" height="4" fill="#e3c93f"/>
  </svg>`,

  france: `<svg viewBox="0 0 18 12" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <rect width="6" height="12" fill="#2c5aa8"/>
    <rect x="6" width="6" height="12" fill="#f2efe6"/>
    <rect x="12" width="6" height="12" fill="#b8392f"/>
  </svg>`,

  uk: `<svg viewBox="0 0 18 12" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <rect width="18" height="12" fill="#26417e"/>
    <path d="M0 0 L18 12 M18 0 L0 12" stroke="#f2efe6" stroke-width="3"/>
    <path d="M0 0 L18 12 M18 0 L0 12" stroke="#b8392f" stroke-width="1.4"/>
    <path d="M9 0 V12 M0 6 H18" stroke="#f2efe6" stroke-width="4"/>
    <path d="M9 0 V12 M0 6 H18" stroke="#b8392f" stroke-width="2.2"/>
  </svg>`,

  china: `<svg viewBox="0 0 18 12" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <rect width="18" height="12" fill="#c0392f"/>
    <polygon points="${starPoints(3.6, 3.4, 1.9)}" fill="#e3c93f"/>
    <polygon points="${starPoints(6.9, 1.5, 0.72, 0.4)}" fill="#e3c93f"/>
    <polygon points="${starPoints(8.3, 3.1, 0.72, 0.8)}" fill="#e3c93f"/>
    <polygon points="${starPoints(8.2, 5.2, 0.72, 0.2)}" fill="#e3c93f"/>
    <polygon points="${starPoints(6.7, 6.6, 0.72, 0.6)}" fill="#e3c93f"/>
  </svg>`,

  usa: `<svg viewBox="0 0 18 12" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <rect width="18" height="12" fill="#f2efe6"/>
    ${[0, 2, 4, 6, 8, 10].map(y => `<rect y="${y}" width="18" height="1.1" fill="#b8392f"/>`).join('')}
    <rect width="8" height="6.5" fill="#26417e"/>
    ${[1.4, 4, 6.6].map(x => [1.4, 3.3, 5.2].map(y =>
      `<circle cx="${x}" cy="${y}" r=".42" fill="#f2efe6"/>`).join('')).join('')}
  </svg>`,

  mexico: `<svg viewBox="0 0 18 12" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <rect width="6" height="12" fill="#1f7a4a"/>
    <rect x="6" width="6" height="12" fill="#f2efe6"/>
    <rect x="12" width="6" height="12" fill="#b8392f"/>
    <circle cx="9" cy="6" r="1.6" fill="none" stroke="#6b4a2a" stroke-width=".7"/>
    <path d="M7.8 6.5c.75.95 2.65.95 3.4 0" fill="none" stroke="#1f7a4a" stroke-width=".5"/>
  </svg>`,

  turkey: `<svg viewBox="0 0 18 12" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <rect width="18" height="12" fill="#c0392f"/>
    <circle cx="7.3" cy="6" r="3" fill="#f2efe6"/>
    <circle cx="8.5" cy="6" r="2.4" fill="#c0392f"/>
    <polygon points="${starPoints(11.9, 6, 1.6)}" fill="#f2efe6"/>
  </svg>`,

  korea: `<svg viewBox="0 0 18 12" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <rect width="18" height="12" fill="#f2efe6"/>
    <circle cx="9" cy="6" r="3" fill="#c0392f"/>
    <path d="M6 6a1.5 1.5 0 0 1 3 0 1.5 1.5 0 0 0 3 0 3 3 0 0 1-6 0Z" fill="#26417e"/>
    <path d="M2.3 2.9h1.9M2.3 4.1h1.9M13.8 7.9h1.9M13.8 9.1h1.9"
          stroke="#1b1b1b" stroke-width=".5" stroke-linecap="round"/>
  </svg>`,

  japan: `<svg viewBox="0 0 18 12" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <rect width="18" height="12" fill="#f2efe6"/>
    <circle cx="9" cy="6" r="3.4" fill="#c0392f"/>
  </svg>`,

  myanmar: `<svg viewBox="0 0 18 12" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <rect width="18" height="4" fill="#e3c93f"/>
    <rect y="4" width="18" height="4" fill="#1f7a4a"/>
    <rect y="8" width="18" height="4" fill="#c0392f"/>
    <polygon points="${starPoints(9, 6, 3.7)}" fill="#f2efe6"/>
  </svg>`,

  spain: `<svg viewBox="0 0 18 12" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <rect width="18" height="12" fill="#c0392f"/>
    <rect y="3" width="18" height="6" fill="#e3c93f"/>
    <rect x="4.1" y="4.3" width="2.8" height="3.4" rx=".5" fill="none" stroke="#a8452f" stroke-width=".55"/>
    <path d="M5.5 4.3v3.4M4.1 6h2.8" stroke="#a8452f" stroke-width=".45"/>
  </svg>`
};

const AIRPORT_RENT = [25, 50, 100, 200];

/* ---- the frame every map is poured into -------------------------------- */
const RENTS = [
  [2, 10, 30, 90, 160, 250], [4, 20, 60, 180, 320, 450],
  [6, 30, 90, 270, 400, 550], [6, 30, 90, 270, 400, 550], [8, 40, 100, 300, 450, 600],
  [10, 50, 150, 450, 625, 750], [10, 50, 150, 450, 625, 750], [12, 60, 180, 500, 700, 900],
  [14, 70, 200, 550, 750, 950], [14, 70, 200, 550, 750, 950], [16, 80, 220, 600, 800, 1000],
  [18, 90, 250, 700, 875, 1050], [18, 90, 250, 700, 875, 1050], [20, 100, 300, 750, 925, 1100],
  [22, 110, 330, 800, 975, 1150], [22, 110, 330, 800, 975, 1150], [24, 120, 360, 850, 1025, 1200],
  [26, 130, 390, 900, 1100, 1275], [26, 130, 390, 900, 1100, 1275], [28, 150, 450, 1000, 1200, 1400],
  [35, 175, 500, 1100, 1300, 1500], [50, 200, 600, 1400, 1700, 2000]
];
const PRICES = [60, 60, 100, 110, 120, 130, 140, 160, 180, 190, 200,
                210, 220, 240, 260, 270, 280, 290, 300, 320, 360, 400];

/* Where the cities sit on the loop, cheapest first. */
const CITY_SLOTS = [1, 3, 6, 7, 9, 11, 13, 14, 16, 18, 19, 21, 23, 24, 26, 27, 29, 31, 32, 34, 37, 39];

function buildBoard(spec) {
  if (spec.layout) return buildLayout(spec);
  const board = new Array(40);
  board[0]  = { type: 'start', name: 'Start' };
  board[2]  = { type: 'treasure', name: 'Treasure' };
  board[4]  = { type: 'tax', name: 'Earnings Tax', rate: 0.1, cap: 200 };
  board[8]  = { type: 'surprise', name: 'Surprise' };
  board[10] = { type: 'jail', name: 'Prison' };
  board[12] = { type: 'utility', name: 'Power Company', price: 150 };
  board[17] = { type: 'treasure', name: 'Treasure' };
  board[20] = { type: 'vacation', name: 'Vacation' };
  board[22] = { type: 'surprise', name: 'Surprise' };
  board[28] = { type: 'utility', name: 'Water Company', price: 150 };
  board[30] = { type: 'gotojail', name: 'Go to Prison' };
  board[33] = { type: 'treasure', name: 'Treasure' };
  board[36] = { type: 'surprise', name: 'Surprise' };
  board[38] = { type: 'tax', name: 'Premium Tax', flat: 75 };
  [5, 15, 25, 35].forEach((slot, k) => {
    board[slot] = { type: 'airport', name: spec.airports[k], price: 200 };
  });

  const cities = [];
  spec.sets.forEach(set => set.cities.forEach(name => cities.push({ name, group: set.group })));
  cities.forEach((c, k) => {
    board[CITY_SLOTS[k]] = {
      type: 'city', name: c.name, group: c.group,
      price: PRICES[k], rents: RENTS[k], house: GROUPS[c.group].house
    };
  });

  board.forEach(d => {
    if (d.type === 'airport') d.icon = 'airport';
    else if (d.type === 'utility') d.icon = d.name.indexOf('Power') === 0 ? 'power' : 'water';
    else if (ICON_SVG[d.type]) d.icon = d.type;
  });
  return board;
}

/* ---- a map may lay out its own forty stops ----------------------------- */
/* Rent tables by asking price, so any city ladder can be priced. */
const RENT_BY_PRICE = {
  60: [4, 20, 60, 180, 320, 450],      80: [6, 30, 90, 270, 400, 550],
  100: [8, 40, 100, 300, 450, 600],    120: [10, 50, 150, 450, 625, 750],
  140: [12, 60, 180, 500, 700, 900],   160: [14, 70, 200, 550, 750, 950],
  180: [16, 80, 220, 600, 800, 1000],  200: [18, 90, 250, 700, 875, 1050],
  220: [20, 100, 300, 750, 925, 1100], 240: [22, 110, 330, 800, 975, 1150],
  260: [24, 120, 360, 850, 1025, 1200],280: [26, 130, 390, 900, 1100, 1275],
  300: [28, 150, 450, 1000, 1200, 1400],320: [30, 160, 470, 1050, 1250, 1450],
  350: [35, 175, 500, 1100, 1300, 1500],400: [50, 200, 600, 1400, 1700, 2000]
};

/* A laid-out map writes each stop as a short tuple. */
function buildLayout(spec) {
  const board = spec.layout.map(slot => {
    const [kind, a, b] = slot;
    switch (kind) {
      case 'city':   return { type: 'city', name: a, group: b, price: 0, rents: [] };
      case 'air':    return { type: 'airport', name: a, price: 200 };
      case 'util':   return { type: 'utility', name: a, price: 150 };
      case 'tax':    return { type: 'tax', name: a, rate: b, cap: 200 };
      case 'flat':   return { type: 'tax', name: a, flat: b };
      case 'refund': return { type: 'refund', name: a, amount: b };
      default:       return { type: kind, name: a };
    }
  });

  /* Prices climb with position round the loop. */
  const cities = board.filter(d => d.type === 'city');
  cities.forEach((d, k) => {
    d.price = spec.prices[k];
    d.rents = RENT_BY_PRICE[d.price];
    d.house = d.price <= 120 ? 50 : d.price <= 200 ? 100 : d.price <= 280 ? 150 : 200;
  });

  board.forEach(d => {
    if (d.type === 'airport') d.icon = 'airport';
    else if (d.type === 'utility') d.icon = d.name.indexOf('Power') === 0 ? 'power' : 'water';
    else if (ICON_SVG[d.type]) d.icon = d.type;
  });
  return board;
}

const MAPS = {
  classic: {
    name: 'Classic',
    blurb: 'Brazil, Israel, Italy, Germany, China, France, the UK, the USA.',
    airports: ['TLV Airport', 'MUC Airport', 'CDG Airport', 'JFK Airport'],
    sets: [
      { group: 'brazil',  cities: ['Salvador', 'Rio'] },
      { group: 'israel',  cities: ['Tel Aviv', 'Haifa', 'Jerusalem'] },
      { group: 'italy',   cities: ['Venice', 'Milan', 'Rome'] },
      { group: 'germany', cities: ['Frankfurt', 'Munich', 'Berlin'] },
      { group: 'china',   cities: ['Shenzhen', 'Beijing', 'Shanghai'] },
      { group: 'france',  cities: ['Lyon', 'Toulouse', 'Paris'] },
      { group: 'uk',      cities: ['Liverpool', 'Manchester', 'London'] },
      { group: 'usa',     cities: ['San Francisco', 'New York'] }
    ]
  },

  fortune: {
    name: 'Fortune',
    blurb: 'Half the deeds, twice the cards. Mexico, Turkey, Italy, Japan, Brazil, Korea, the UK, the USA.',
    luck: true,
    prices: [60, 80, 100, 120, 140, 160, 180, 200, 220, 240, 260, 280, 300, 320, 350, 400],
    layout: [
      ['start', 'Start'],
      ['city', 'Guadalajara', 'mexico'],
      ['surprise', 'Surprise'],
      ['city', 'Mexico City', 'mexico'],
      ['treasure', 'Treasure'],
      ['air', 'MEX Airport'],
      ['city', 'Izmir', 'turkey'],
      ['surprise', 'Surprise'],
      ['city', 'Istanbul', 'turkey'],
      ['fortune', 'Fortune'],
      ['jail', 'Prison'],
      ['city', 'Milan', 'italy'],
      ['treasure', 'Treasure'],
      ['city', 'Rome', 'italy'],
      ['surprise', 'Surprise'],
      ['air', 'IST Airport'],
      ['city', 'Kyoto', 'japan'],
      ['treasure', 'Treasure'],
      ['city', 'Tokyo', 'japan'],
      ['refund', 'Tax Refund', 50],
      ['vacation', 'Vacation'],
      ['city', 'Salvador', 'brazil'],
      ['surprise', 'Surprise'],
      ['city', 'Rio', 'brazil'],
      ['fortune', 'Fortune'],
      ['air', 'HND Airport'],
      ['city', 'Busan', 'korea'],
      ['treasure', 'Treasure'],
      ['city', 'Seoul', 'korea'],
      ['surprise', 'Surprise'],
      ['gotojail', 'Go to Prison'],
      ['city', 'Manchester', 'uk'],
      ['surprise', 'Surprise'],
      ['city', 'London', 'uk'],
      ['treasure', 'Treasure'],
      ['air', 'JFK Airport'],
      ['city', 'San Francisco', 'usa'],
      ['fortune', 'Fortune'],
      ['tax', 'Earnings Tax', 0.1],
      ['city', 'New York', 'usa']
    ]
  },

  meridian: {
    name: 'Meridian',
    blurb: 'Mexico, Turkey, Korea, Japan, China, Myanmar, Spain, the USA.',
    airports: ['IST Airport', 'HND Airport', 'RGN Airport', 'JFK Airport'],
    sets: [
      { group: 'mexico',  cities: ['Guadalajara', 'Mexico City'] },
      { group: 'turkey',  cities: ['Izmir', 'Ankara', 'Istanbul'] },
      { group: 'korea',   cities: ['Busan', 'Incheon', 'Seoul'] },
      { group: 'japan',   cities: ['Osaka', 'Kyoto', 'Tokyo'] },
      { group: 'china',   cities: ['Shenzhen', 'Beijing', 'Shanghai'] },
      { group: 'myanmar', cities: ['Nay Pyi Taw', 'Mandalay', 'Yangon'] },
      { group: 'spain',   cities: ['Valencia', 'Barcelona', 'Madrid'] },
      { group: 'usa',     cities: ['San Francisco', 'New York'] }
    ]
  }
};

/* Stop symbols on a 24-unit square, with soft cartoon colors for special deeds. */
const ICON_SVG = {
  airport: `<svg viewBox="0 0 24 24" fill="none" stroke="#536c77" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12 9 11 6 4 9 4 15 11 20 11Q23 11 23 13T20 15H15L9 21H6L9 15H4L1 9H3Z" fill="#e2f3f4"/><path d="M10 12h7M19 12h1" stroke="#73aebc"/><path d="m9 4 6 7M9 21l6-6" stroke="#cc959b"/></svg>`,

  power: `<svg viewBox="0 0 24 24" fill="none" stroke="#536c77" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 17C8 14 4 13 4 9a8 8 0 0 1 16 0c0 4-4 5-4 8Z" fill="#f3dc86"/><path d="m13 5-4 6h4l-2 5" fill="none"/><rect x="8" y="17" width="8" height="4" rx="1.5" fill="#a9cbd0"/><path d="M10 23h4M7 6l-1 2" stroke="#fff9e6"/></svg>`,

  water: `<svg viewBox="0 0 24 24" fill="none" stroke="#536c77" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 1C9 5 3 11 3 15a9 9 0 0 0 18 0c0-4-6-10-9-14Z" fill="#9ed6df"/><path d="M7 11q-3 5 0 7" stroke="#f3ffff" stroke-width="2.5"/><path d="M11 18q3 3 6-1" fill="none"/><circle cx="12" cy="14" r=".7" fill="#42636f" stroke="none"/><circle cx="18" cy="14" r=".7" fill="#42636f" stroke="none"/></svg>`,

  treasure: `<svg viewBox="0 0 24 24" fill="none" stroke="#536c77" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 11V8q0-5 5-5h10q5 0 5 5v3" fill="#ebbc91"/><rect x="2" y="10" width="20" height="11" rx="2" fill="#dca2a0"/><path d="M6 4v17M18 4v17" stroke="#f6df91" stroke-width="3"/><path d="M2 11h20"/><rect x="10" y="10" width="4" height="6" rx="1" fill="#fae6a0"/><path d="M12 12v2"/></svg>`,

  surprise: `<svg viewBox="0 0 24 24" fill="none" stroke="#536c77" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3h18v15H11l-5 4v-4H3Z" fill="#efb7bf"/><path d="M9 8a3 3 0 1 1 5 2c-2 1-2 1-2 3" fill="none" stroke="#704b5b" stroke-width="2.2"/><circle cx="12" cy="16" r="1" fill="#704b5b" stroke="none"/><path d="M5 5h2" stroke="#fff6f5"/></svg>`,

  tax: `<svg viewBox="0 0 24 24" fill="none" stroke="#536c77" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 2h10l4 4v16l-3-2-3 2-3-2-5 2Z" fill="#fff6d9"/><path d="M15 2v5h4" fill="#efd495"/><path d="M8 10h8M8 13h8M8 16h5" stroke="#ad8587"/></svg>`,

  start: `<svg viewBox="0 0 64 64" fill="none" stroke="#627783" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><g transform="translate(64 0) scale(-1 1)"><ellipse cx="32" cy="56" rx="28" ry="4" fill="#bacfc9" stroke="none"/><path d="M9 54V15M55 54V15" stroke="#819da7" stroke-width="4"/><path d="M7 13h50v13H7Z" fill="#f5eccf"/><path d="M7 13h7v6H7ZM21 13h7v6h-7ZM35 13h7v6h-7ZM49 13h8v6h-8ZM14 19h7v7h-7ZM28 19h7v7h-7ZM42 19h7v7h-7Z" fill="#91a9ae" stroke="none"/><path d="M10 13V5l12 3-12 4M54 13V5L42 8l12 4" fill="#daa6a4"/><path d="M24 33h10v-6l15 13-15 13v-7H19Z" fill="#8fc5b7"/><path d="M26 36h11v-3l8 7" stroke="#daf0d9" stroke-width="2"/><path d="M9 56h12M43 56h14" stroke="#c2b384" stroke-width="3"/><path d="M4 36h10M7 42h6M12 32h4" stroke="#a5c5bd"/></g></svg>`,

  jail: `<svg viewBox="0 0 64 64" fill="none" stroke="#627783" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><ellipse cx="32" cy="57" rx="27" ry="4" fill="#bdcdca" stroke="none"/><path d="M7 24h50v30H7Z" fill="#c2d5d9"/><path d="M18 18h28v36H18Z" fill="#e9eade"/><path d="m15 18 17-11 17 11Z" fill="#92a8b2"/><path d="M5 24v-7h5v4h4v-4h5v7M45 24v-7h5v4h4v-4h5v7" fill="#a6bdc5"/><path d="M23 54V35a9 9 0 0 1 18 0v19Z" fill="#7893a1"/><path d="M27 31v23M32 28v26M37 31v23M23 41h18" stroke="#f5f5e8" stroke-width="2"/><rect x="30" y="40" width="5" height="7" rx="1" fill="#e4c878"/><path d="M10 31h5v9h-5ZM49 31h5v9h-5Z" fill="#7893a1"/><path d="M10 47h5M49 47h5M18 56h28"/><circle cx="32" cy="15" r="2" fill="#f5d995"/></svg>`,

  gotojail: `<svg viewBox="0 0 64 64" fill="none" stroke="#746e73" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
 <circle cx="32" cy="30" r="26" fill="#f5e3dc" stroke="none"/>
 <ellipse cx="29" cy="58" rx="25" ry="3" fill="#c5cec5" stroke="none"/>
 <path d="M10 53h38v4H10Z" fill="#b79683"/>
 <path d="M14 50q15-6 30 0v5H14Z" fill="#d4b49a"/>
 <ellipse cx="29" cy="50" rx="15" ry="4" fill="#f0d7ad"/>
 <g transform="rotate(-35 24 27)">
   <rect x="29" y="23" width="29" height="8" rx="4" fill="#b98c7c"/>
   <path d="M35 25h18" stroke="#e5baa0" stroke-width="2"/>
   <rect x="17" y="14" width="15" height="27" rx="3" fill="#d2a392"/>
   <rect x="15" y="11" width="19" height="6" rx="2" fill="#ebc6ab"/>
   <rect x="15" y="38" width="19" height="6" rx="2" fill="#ebc6ab"/>
   <path d="M20 20v14" stroke="#f5dac3" stroke-width="2"/>
   <path d="M17 19h15M17 35h15" stroke="#b4897e"/>
 </g>
 <path d="m18 43-5-4m22 5 5-4M26 46v-5" stroke="#d2ad62" stroke-width="2.5"/>
 <path d="M5 23q-2 9 3 15M10 25q-1 5 2 8" stroke="#a8bfc4" stroke-width="2"/>
</svg>`,

  fortune: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.35"
                  stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="8.3"/>
    <path d="M12 3.7v16.6M3.7 12h16.6M6.1 6.1l11.8 11.8M17.9 6.1 6.1 17.9"/>
    <circle cx="12" cy="12" r="1.9" fill="currentColor" stroke="none"/></svg>`,

  refund: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.35"
                stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <rect x="3.2" y="6.6" width="17.6" height="10.8" rx="1.4"/>
    <circle cx="12" cy="12" r="2.5"/>
    <path d="M6.2 9.6v4.8M17.8 9.6v4.8"/></svg>`,

  house: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"
               stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M4.2 11.4 12 4.9l7.8 6.5"/>
    <path d="M6.4 10.2v8.7h11.2v-8.7"/>
    <path d="M10.2 18.9v-4.3h3.6v4.3"/></svg>`,

  hotel: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"
               stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M12 2.6v2.3"/>
    <path d="M5.3 19.4V7a1.2 1.2 0 0 1 1.2-1.2h11a1.2 1.2 0 0 1 1.2 1.2v12.4"/>
    <path d="M3.9 19.4h16.2"/>
    <path d="M8.4 9.2h2M13.6 9.2h2M8.4 12.6h2M13.6 12.6h2"/>
    <path d="M10.3 19.4v-3.5h3.4v3.5"/></svg>`,

  vacation: `<svg viewBox="0 0 64 64" fill="none" stroke="#627783" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="48" cy="13" r="7" fill="#f2d68a" stroke="#d5b56f"/><path d="M48 2V0M59 5l2-2M59 14h3M39 4l-2-2" stroke="#d5b56f"/><path d="M3 45q10-6 20 0t20 0 18 0v13H3Z" fill="#b1dfe1" stroke="none"/><path d="M4 52q17-10 31-2t25 3v6H4Z" fill="#f1dfac" stroke="none"/><path d="m25 19-6 33" stroke="#a48c72" stroke-width="3"/><path d="M6 25Q12 1 29 8q16 4 16 23l-12-6-9 1-8-5Z" fill="#e5aba9"/><path d="M16 21Q19 8 29 8q5 6 4 17l-9 1Z" fill="#fcf0d6"/><path d="m27 8 1-4"/><path d="m32 36 12 10h12M33 36l-3 5 10 10h15M40 51l-2 5M53 51l3 5" stroke="#8c9a90" stroke-width="2.2"/><path d="m33 37 10 10h12l-1 4H41L30 41Z" fill="#a3c9c7"/><path d="M5 43q4 2 8 0M47 39q5 2 10 0" stroke="#74b0bd"/><circle cx="11" cy="54" r="2" fill="#e6b5a1" stroke="none"/></svg>`
};

let CURRENT_MAP = 'classic';
let BOARD = buildBoard(MAPS.classic);

function applyMap(id) {
  CURRENT_MAP = MAPS[id] ? id : 'classic';
  BOARD = buildBoard(MAPS[CURRENT_MAP]);
  return BOARD;
}

const SURPRISE = [
  { text: 'Upgraded to first class. Advance to Start and collect $200.', act: p => G.moveTo(p, 0, true) },
  { text: () => `Board meeting in ${BOARD[39].name}. Advance there.`, act: p => G.moveTo(p, 39, true) },
  { text: () => `A long layover in ${BOARD[11].name}. Advance there.`, act: p => G.moveTo(p, 11, true) },
  { text: 'Gate change. Advance to the nearest airport.', act: p => G.advanceToNearest(p, 'airport') },
  { text: 'Grid inspection. Advance to the nearest utility; rent is ten times your roll.', act: p => G.advanceToNearest(p, 'utility') },
  { text: 'Dividend from your holdings. Collect $50.', act: p => G.credit(p, 50) },
  { text: 'A bond matured. Collect $150.', act: p => G.credit(p, 150) },
  { text: 'Customs fine. Pay $15.', act: p => G.debit(p, 15, null, true) },
  { text: 'Go back three spaces.', act: p => G.moveTo(p, (p.pos + 37) % 40, false) },
  { text: 'Travelling without a ticket. Go to prison.', act: p => G.sendToJail(p) },
  { text: 'Release paperwork. Keep it to leave prison free.', act: p => { p.pardons++; } },
  { text: 'Renovation levy: $40 per house, $115 per hotel.', act: p => G.debit(p, G.buildingCount(p, 40, 115), null, true) },
  { text: 'Currency swing in your favour. Every player pays you $50.', act: p => G.collectFromAll(p, 50) },
  { text: 'Speeding on the autobahn. Pay $75.', act: p => G.debit(p, 75, null, true) },
  { text: () => `Charter flight to ${BOARD[34].name}. Advance there.`, act: p => G.moveTo(p, 34, true) },
  { text: 'Refund on a cancelled booking. Collect $100.', act: p => G.credit(p, 100) }
];

const TREASURE = [
  { text: 'Strong quarter. Advance to Start and collect $200.', act: p => G.moveTo(p, 0, true) },
  { text: 'Bank error in your favour. Collect $200.', act: p => G.credit(p, 200) },
  { text: 'Clinic bill. Pay $100.', act: p => G.debit(p, 100, null, true) },
  { text: 'Consulting fee. Collect $50.', act: p => G.credit(p, 50) },
  { text: 'Tax refund. Collect $20.', act: p => G.credit(p, 20) },
  { text: 'Release paperwork. Keep it to leave prison free.', act: p => { p.pardons++; } },
  { text: 'Audit finding. Go to prison.', act: p => G.sendToJail(p) },
  { text: 'Birthday round. Every player gives you $30.', act: p => G.collectFromAll(p, 30) },
  { text: 'Insurance matured. Collect $100.', act: p => G.credit(p, 100) },
  { text: 'Hospital cover paid out. Collect $25.', act: p => G.credit(p, 25) },
  { text: 'Street repairs: $40 per house, $115 per hotel.', act: p => G.debit(p, G.buildingCount(p, 40, 115), null, true) },
  { text: 'Design award. Collect $10.', act: p => G.credit(p, 10) },
  { text: 'Legacy from an old partner. Collect $100.', act: p => G.credit(p, 100) },
  { text: 'Late filing penalty. Pay $50.', act: p => G.debit(p, 50, null, true) },
  { text: 'Warehouse clearance. Collect $45.', act: p => G.credit(p, 45) },
  { text: 'Freight surcharge. Pay $50.', act: p => G.debit(p, 50, null, true) }
];

/* Fortune stops draw from this: bigger swings, both ways. */
const FORTUNE = [
  { text: () => `A windfall out of nowhere. Collect $300.`, act: p => G.credit(p, 300) },
  { text: () => `The market turns on you. Pay $150.`, act: p => G.debit(p, 150, null, true) },
  { text: () => `Every player slips you $75.`, act: p => G.collectFromAll(p, 75) },
  { text: () => `You stand a round for the table. Pay every player $60.`, act: p => G.payAll(p, 60) },
  { text: () => `A deed falls into your lap: the bank hands over its cheapest unclaimed stop.`, act: p => G.giveCheapestDeed(p) },
  { text: () => `Paperwork error. The bank takes one of your stops back.`, act: p => G.seizeRandomDeed(p) },
  { text: () => `Chartered somewhere at random.`, act: p => G.moveTo(p, Math.floor(Math.random() * 40), true) },
  { text: () => `Change places with whoever is holding the most cash.`, act: p => G.swapWithLeader(p) },
  { text: () => `Fast-tracked to prison.`, act: p => G.sendToJail(p) },
  { text: () => `A pardon lands in your pocket.`, act: p => { p.pardons++; } },
  { text: () => `An insider tip pays off. Collect $200.`, act: p => G.credit(p, 200) },
  { text: () => `Surprise audit: $40 per house, $115 per hotel.`, act: p => G.debit(p, G.buildingCount(p, 40, 115), null, true) },
  { text: () => `The vacation pot is yours, if there is one.`, act: p => G.takePot(p) },
  { text: () => `Skip ahead three stops.`, act: p => G.moveTo(p, (p.pos + 3) % 40, true) },
  { text: () => `Legal fees. Pay $100.`, act: p => G.debit(p, 100, null, true) },
  { text: () => `A rival's contract lands with you. Collect $250.`, act: p => G.credit(p, 250) }
];

const TOKEN_COLORS = ['#d08b3a', '#4f9e8f', '#b8544f', '#7f8fbf', '#9a7fae', '#7d9a4a'];
const BOT_NAMES = ['Chiquiland', 'Kestrel', 'Silky Curve', 'Northbound', 'Delacroix'];

/* Player characters: a round body with a face, one accessory per seat. */
function shade(hex, amount) {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255]
    .map(v => Math.max(0, Math.min(255, Math.round(v + amount))));
  return '#' + c.map(v => v.toString(16).padStart(2, '0')).join('');
}

const AVATAR_PARTS = [
  // cat ears
  c => `<path d="M5.5 7.5 L7 2.6 L11 5.4 Z M18.5 7.5 L17 2.6 L13 5.4 Z" fill="${shade(c, -22)}"/>`,
  // antenna
  c => `<path d="M12 4.5 V1.9" stroke="${shade(c, -22)}" stroke-width="1.3" stroke-linecap="round"/>
        <circle cx="12" cy="1.6" r="1.5" fill="${shade(c, 26)}"/>`,
  // curl
  c => `<path d="M12 4.6 C12 1.4 15.8 1.2 15 4.2" stroke="${shade(c, -22)}" stroke-width="1.4" fill="none" stroke-linecap="round"/>`,
  // brimmed hat
  c => `<rect x="4" y="5.4" width="16" height="1.7" rx=".6" fill="${shade(c, -30)}"/>
        <path d="M8 5.4 V2.9 a4 4 0 0 1 8 0 V5.4 Z" fill="${shade(c, -18)}"/>`,
  // headphones
  c => `<path d="M2.2 14.2 a9.8 9.8 0 0 1 19.6 0" stroke="${shade(c, -30)}" stroke-width="1.5" fill="none"/>
        <rect x="0.9" y="12.2" width="3.4" height="5.2" rx="1.6" fill="${shade(c, -30)}"/>
        <rect x="19.7" y="12.2" width="3.4" height="5.2" rx="1.6" fill="${shade(c, -30)}"/>`,
  // little horns
  c => `<path d="M7.8 5.6 C6.6 3.4 7.4 2.2 9.2 2.4 C8.4 3.4 8.6 4.6 9.6 5.2 Z
                M16.2 5.6 C17.4 3.4 16.6 2.2 14.8 2.4 C15.6 3.4 15.4 4.6 14.4 5.2 Z" fill="${shade(c, -30)}"/>`
];

let avatarLightingId = 0;
function avatarSVG(color, seat, size) {
  const part = AVATAR_PARTS[seat % AVATAR_PARTS.length](color);
  const lightId = `avatar-light-${++avatarLightingId}`;
  return `<svg class="avatar" viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true">
    <defs>
      <radialGradient id="${lightId}" cx="70%" cy="24%" r="82%">
        <stop offset="0" stop-color="${shade(color, 55)}"/>
        <stop offset=".4" stop-color="${color}"/>
        <stop offset=".78" stop-color="${shade(color, -22)}"/>
        <stop offset="1" stop-color="${shade(color, -48)}"/>
      </radialGradient>
    </defs>
    <ellipse cx="11.6" cy="22" rx="7.1" ry="1.1" fill="#183d3824"/>
    ${part}
    <circle cx="12" cy="13.6" r="8.6" fill="url(#${lightId})" stroke="${shade(color, -32)}" stroke-width=".45"/>
    <path d="M12.3 6.3Q16.1 6.1 18.1 9.4" fill="none" stroke="#ffffff" stroke-opacity=".3" stroke-width=".85" stroke-linecap="round"/>
    <circle cx="8.7" cy="12.6" r="1.55" fill="#1b1f26"/>
    <circle cx="15.3" cy="12.6" r="1.55" fill="#1b1f26"/>
    <circle cx="9.2" cy="12.1" r=".5" fill="#f2efe6"/>
    <circle cx="15.8" cy="12.1" r=".5" fill="#f2efe6"/>
    <circle cx="6.6" cy="16" r="1.5" fill="rgba(0,0,0,.13)"/>
    <circle cx="17.4" cy="16" r="1.5" fill="rgba(0,0,0,.13)"/>
    <path d="M9.6 16.4 Q12 18.6 14.4 16.4" stroke="#1b1f26" stroke-width="1.15" fill="none" stroke-linecap="round"/>
  </svg>`;
}
