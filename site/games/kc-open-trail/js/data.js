/* World data for KC: Open Trail. A stylised, compressed St. Helens, Oregon,
   Highway 30, Sauvie Island and a compact Portland district, laid out on the
   10 x 10 grid in the setting brief (columns A-J = x -500..500, rows 1-10 =
   z -500..500, 100 units a cell). Real public place names are used; every
   shop, cart and private business name is invented for this game.
   Coordinates: +x east, +z south, y up. */
export const HALF = 500;          /* playable half-size */
export const EXT = 540;           /* terrain half-size (rim hills beyond the playable square) */
export const WATER_Y = 0;
export const BASE_Y = 3;

export const KC_COLORS = { coat: 0xf1dcae, shade: 0xdcc08a, belly: 0xfcf5e6, ear: 0xd9a866, tailTip: 0xfbf1dc, nose: 0xb57f78, eye: 0x4a2e1c, harness: 0x1f1f22, collar: 0x3f7fd6, tongue: 0xff8fa3, ballA: 0xff8a2a, ballB: 0x2f6fd6 };

/* ---------- water: polylines of [x, z, half-width] ---------- */
export const RIVERS = [
  { id: 'columbia', name: 'Columbia River', pts: [[10, -560, 100], [8, -400, 100], [8, -260, 100], [30, -160, 84], [130, -85, 66], [232, -12, 58], [292, 58, 56], [400, 92, 58], [560, 100, 60]] },
  { id: 'willamette', name: 'Willamette River', pts: [[150, 560, 30], [128, 450, 30], [80, 360, 30], [98, 250, 30], [150, 160, 32], [240, 84, 36], [292, 58, 40]] },
  { id: 'channel', name: 'Multnomah Channel', pts: [[104, 224, 18], [0, 196, 18], [-90, 178, 18], [-150, 120, 18], [-165, 20, 18], [-170, -50, 24], [-140, -100, 22], [-95, -140, 22], [-55, -178, 24]] }
];
/* still water: ellipses [x, z, rx, rz] */
export const LAKES = [
  { id: 'dalton', name: 'Dalton Lake', e: [-232, -456, 40, 19] },
  { id: 'bay', name: 'Scappoose Bay', e: [-212, -52, 32, 30] },
  { id: 'sturgeon', name: 'Sturgeon Lake', e: [112, -6, 36, 24] }
];
/* islands inside a river: land wins over the river carve */
export const ISLANDS = [{ id: 'sand', name: 'Sand Island', e: [-46, -298, 19, 92], h: 2.3 }];
/* painted (ankle-deep) creek, no carve */
export const CREEK = [[-505, -96], [-440, -84], [-390, -92], [-330, -70], [-282, -66], [-246, -60]];
/* the railway beside Highway 30, always on the river side of it; it ends at a buffer stop in the Linnton yard.
   A freight train (invented livery, no logos) shuttles along it: see TRAIN and js/vehicles.js */
export const RAIL = [[-438, -535], [-438, -150], [-431, -62], [-336, 48], [-236, 148], [-156, 228]];
export const TRAIN = { cars: 5, gap: 13.2, speed: 8.5, dwell: 22, from: 62, endPad: 6 };   /* from / endPad: how far the consist stays from each end of the rail */

/* ---------- terrain shaping ---------- */
/* soft bumps [x, z, height, sigma] */
export const BUMPS = [
  [-246, -132, 9, 30],     /* Nob Hill bluff */
  [-152, -404, 4.5, 26],   /* Grey Cliffs bluff */
  [360, 440, 21, 46],      /* Mt. Tabor */
  [-330, -438, 8, 30]      /* quarry rim */
];
/* flat pads [x, z, radius, edge, height] applied after bumps */
export const PADS = [
  [28, 250, 9, 30, 7.95], [172, 250, 9, 26, 7.95],          /* St. Johns Bridge abutments */
  [86, 470, 5, 16, 4.1], [178, 470, 5, 16, 4.1],            /* Hawthorne Bridge ends */
  [78, 432, 5, 15, 4.1], [164, 432, 5, 15, 4.1],            /* Tilikum Crossing ends */
  [-62, 212, 5, 14, 3.9], [-62, 153, 5, 14, 3.9],           /* Wapato Bridge ends */
  [-250, 452, 26, 30, 33],                                  /* mansion viewpoint */
  [360, 440, 16, 20, 23],                                   /* Mt. Tabor summit */
  [-330, -438, 13, 9, 2.2],                                 /* quarry floor */
  [-246, -132, 9, 10, 11.5],                                /* Nob Hill viewpoint */
  [-152, -404, 14, 12, 7.2], [-128, -404, 13, 5, 7.2]       /* Grey Cliffs lawn, carried east to the cliff edge above the river */
];
/* flat (low-noise) rectangles [x0, z0, x1, z1, edge] */
export const FLATS = [
  [-470, -420, -96, -118, 24],     /* St. Helens */
  [-400, -70, -230, 110, 20],      /* mill + Scappoose */
  [-150, 290, 110, 505, 18],       /* Portland west side */
  [120, 240, 320, 500, 18],        /* Portland east side */
  [-40, 0, 140, 140, 22],          /* Wapato Patch Farm */
  [-200, 224, -110, 304, 14]       /* Linnton */
];
/* crest of the Tualatin hills / Forest Park ridge: [x, z]; land west of it stays high */
export const RIDGE = [[-560, 40], [-430, 170], [-330, 285], [-262, 400], [-250, 540]];
export const RIDGE_H = 33, RIDGE_W = 118;

export const SPAWN = { x: -168, z: -166, yaw: Math.PI / 2 };
export const PLAZA = { x: -170, z: -250 };          /* Lantern Stack */
export const COURTHOUSE = { x: -121, z: -250 };
export const SJB = { x0: 28, x1: 172, z: 250, top: 8, w: 11 };
export const MORRISON = { x0: 86, x1: 178, z: 470, top: 4.2, w: 10 };   /* Hawthorne Bridge */
export const TILIKUM = { x0: 78, x1: 164, z: 432, top: 4.2, w: 9 };      /* car-free bridge: walkers, wheels, paws and the tram */
/* the Heron Line: an invented two-stop tram (made-up name and colours) between Waterfront Park and the east bank */
export const TRAM = { id: 'tram', name: 'Heron Line', z: 432, x0: 18, x1: 232, stops: [{ x: 26, name: 'Waterfront Park' }, { x: 224, name: 'Eastbank' }], speed: 8, dwell: 11 };
/* no trees here: view corridors from the two viewpoints, and the tram line */
export const CLEARINGS = [[-226, -131, 15], [-206, -126, 14], [-188, -120, 12], [-224, 452, 15], [-205, 452, 14], [-186, 452, 12], [-128, -404, 15]];
/* zebra crossings: [x, z, ns] ns = 1 when the road runs north-south (painted on the ground texture and drawn again as crisp geometry) */
export const CROSSWALKS = [[-205, -262, 1], [-205, -238, 1], [-140, -250, 1], [-205, -300, 1], [-350, -262, 1], [-272, 60, 1], [-100, 430, 1], [5, 430, 1], [-50, 390, 0], [-50, 470, 0], [245, 428, 1], [245, 290, 1]];
/* where a road crosses the railway: [x, z, road yaw] (planked crossing and a plain crossbuck sign, no railway branding) */
export const RAIL_CROSSINGS = [[-438, -350, Math.PI / 2], [-438, -250, Math.PI / 2], [-438, -150, Math.PI / 2], [-255.2, 128.8, 0.24]];
export const WAPATO = { x: -62, z0: 153, z1: 212, top: 4.0, w: 9 };
export const LIGHTHOUSE = { x: -34, z: -92 };
export const MANSION = { x: -252, z: 448 };

/* ---------- roads. kind: road (asphalt), gravel, trail (dirt footpath), walk (paved path) ---------- */
export const ROADS = [
  { id: 'hwy30', name: 'Highway 30', kind: 'road', w: 11, pts: [[-450, -535], [-450, -350], [-450, -250], [-452, -150], [-445, -60], [-350, 50], [-250, 150], [-150, 250], [-105, 320], [-100, 400], [-100, 470], [-100, 520]] },
  { id: 'columbia', name: 'Columbia Blvd', kind: 'road', w: 9, pts: [[-450, -250], [-350, -250], [-205, -250]] },
  { id: 'sthelens', name: 'St. Helens Street', kind: 'road', w: 9, pts: [[-450, -350], [-350, -350], [-205, -340], [-140, -340]] },
  { id: 'first', name: 'S 1st Street', kind: 'road', w: 9, pts: [[-205, -340], [-205, -250], [-205, -185]] },
  { id: 'strand', name: 'The Strand', kind: 'road', w: 8, pts: [[-140, -340], [-140, -250], [-140, -193]] },
  { id: 'cowlitz', name: 'Cowlitz Street', kind: 'road', w: 8, pts: [[-205, -185], [-140, -193]] },
  { id: 'oldportland', name: 'Old Portland Road', kind: 'road', w: 9, pts: [[-205, -185], [-300, -180], [-320, -100], [-300, -20], [-272, 60], [-250, 150]] },
  { id: 'milton', name: 'Milton Way', kind: 'road', w: 8, pts: [[-350, -350], [-350, -250], [-350, -150]] },
  { id: 'mccormick', name: 'McCormick Park Road', kind: 'road', w: 8, pts: [[-452, -150], [-350, -150], [-300, -180]] },
  { id: 'sauvieW', name: 'Sauvie Island Road', kind: 'road', w: 8, pts: [[-150, 250], [-100, 226], [-62, 212]] },
  { id: 'sauvieE', name: 'Sauvie Island Road', kind: 'road', w: 8, pts: [[-62, 153], [-45, 100], [18, 60], [50, 40]] },
  { id: 'bridgeW', name: 'Bridge Avenue', kind: 'road', w: 9, pts: [[-105, 320], [-40, 290], [2, 258], [28, 250]] },
  { id: 'eastside', name: 'Willamette Blvd', kind: 'road', w: 9, pts: [[172, 250], [225, 255], [245, 300], [245, 400], [250, 470]] },
  { id: 'morrisonW', name: 'Hawthorne Blvd', kind: 'road', w: 9, pts: [[-100, 470], [5, 470], [86, 470]] },
  { id: 'morrisonE', name: 'Hawthorne Blvd', kind: 'road', w: 9, pts: [[178, 470], [250, 470], [318, 460]] },
  { id: 'burnside', name: 'Burnside Street', kind: 'road', w: 8, pts: [[-100, 390], [5, 390]] },
  { id: 'naito', name: 'Naito Parkway', kind: 'road', w: 8, pts: [[2, 258], [5, 300], [5, 390], [5, 470], [5, 505]] },
  /* gravel */
  { id: 'reeder', name: 'Reeder Road', kind: 'gravel', w: 6, pts: [[50, 40], [46, -20], [4, -52], [-22, -78]] },
  { id: 'beachroad', name: 'Island Beach Road', kind: 'gravel', w: 6, pts: [[50, 40], [110, 50], [166, 54]] },
  { id: 'pittock', name: 'Pittock Drive', kind: 'gravel', w: 6, pts: [[-100, 436], [-160, 428], [-205, 440], [-236, 452]] },
  { id: 'quarryroad', name: 'Quarry Lane', kind: 'gravel', w: 6, pts: [[-330, -350], [-332, -396], [-330, -424]] },
  { id: 'millroad', name: 'Mill Lane', kind: 'gravel', w: 6, pts: [[-312, -40], [-334, -34]] },
  /* paved walks */
  { id: 'riverwalk', name: 'Riverwalk', kind: 'walk', w: 4, pts: [[-112, -352], [-103, -300], [-102, -250], [-104, -200], [-118, -150], [-160, -134], [-196, -140]] },
  { id: 'promenade', name: 'Waterfront Promenade', kind: 'walk', w: 4, pts: [[40, 316], [44, 380], [70, 430], [84, 462], [80, 500]] },
  /* trails */
  { id: 'nobhill', name: 'Nob Hill Loop', kind: 'trail', w: 3.4, pts: [[-232, -176], [-262, -150], [-266, -122], [-246, -108], [-226, -124], [-228, -156], [-232, -176]] },
  { id: 'greycliffs', name: 'Grey Cliffs Path', kind: 'trail', w: 3.4, pts: [[-140, -344], [-146, -372], [-152, -398], [-168, -418]] },
  { id: 'dalton', name: 'Dalton Lake Loop', kind: 'trail', w: 3.4, pts: [[-168, -418], [-190, -428], [-232, -428], [-278, -444], [-282, -464], [-240, -484], [-196, -480], [-180, -456], [-190, -428]] },
  { id: 'mccloop', name: 'McCormick Loop', kind: 'trail', w: 3.4, pts: [[-400, -144], [-424, -126], [-424, -86], [-398, -66], [-352, -70], [-338, -104], [-352, -138], [-400, -144]] },
  { id: 'sandisland', name: 'Sand Island Trail', kind: 'trail', w: 3.2, pts: [[-46, -374], [-42, -330], [-48, -290], [-44, -250], [-46, -222]] },
  { id: 'warrior', name: 'Warrior Rock Trail', kind: 'trail', w: 3.4, pts: [[-22, -78], [-34, -90]] },
  { id: 'wildlife', name: 'Wildlife Loop', kind: 'trail', w: 3.4, pts: [[46, -20], [70, -40], [112, -44], [150, -28], [156, 6], [124, 28], [80, 24], [50, 40]] },
  { id: 'wildwood', name: 'Wildwood Trail', kind: 'trail', w: 3.4, pts: [[-158, 268], [-196, 296], [-232, 300], [-250, 330], [-218, 356], [-240, 388], [-282, 400], [-272, 430], [-256, 440]] },
  { id: 'tabor', name: 'Mt. Tabor Loop', kind: 'trail', w: 3.4, pts: [[318, 460], [330, 420], [364, 408], [392, 432], [386, 466], [352, 478], [324, 462], [348, 444], [360, 440]] },
  { id: 'cathedral', name: 'Cathedral Park Path', kind: 'walk', w: 3.4, pts: [[190, 262], [170, 284], [140, 290], [150, 306], [196, 306], [228, 290]] },
  { id: 'tramway', name: 'Heron Line', kind: 'walk', w: 5, pts: [[12, 432], [78, 432], [164, 432], [240, 432]] },
  { id: 'farmtrail', name: 'Maze Path', kind: 'trail', w: 3.2, pts: [[50, 40], [40, 62], [10, 70]] }
];

/* ---------- districts, checked in order; the first match names where KC is ---------- */
export const ZONES = [
  { id: 'plaza', name: 'Courthouse Plaza', rect: [-198, -276, -104, -226] },
  { id: 'cvpark', name: 'Columbia View Park', rect: [-200, -188, -96, -120] },
  { id: 'marina', name: 'North Marina', rect: [-136, -372, -84, -322] },
  { id: 'greycliffs', name: 'Grey Cliffs Park', circle: [-152, -404, 30] },
  { id: 'dalton', name: 'Dalton Lake', ellipse: [-232, -456, 58, 36] },
  { id: 'quarry', name: 'The Old Quarry', circle: [-330, -438, 34] },
  { id: 'nobhill', name: 'Nob Hill Nature Park', circle: [-246, -136, 36] },
  { id: 'sand', name: 'Sand Island', ellipse: [-46, -298, 24, 98] },
  { id: 'oldtown', name: 'Riverfront Old Town', rect: [-232, -342, -96, -188] },
  { id: 'mccormick', name: 'McCormick Park', rect: [-442, -146, -328, -58] },
  { id: 'mill', name: 'The Paper Mill', rect: [-392, -60, -296, 12] },
  { id: 'sthelens', name: 'St. Helens', rect: [-505, -505, -96, -118] },
  { id: 'scappoose', name: 'Scappoose', rect: [-318, 12, -226, 112] },
  { id: 'lighthouse', name: 'Warrior Rock Light', circle: [-34, -92, 22] },
  { id: 'farm', name: 'Wapato Patch Farm', rect: [-36, 4, 136, 136] },
  { id: 'islandbeach', name: 'Island Beach', rect: [150, 20, 215, 90] },
  { id: 'wildlife', name: 'Sauvie Island Wildlife Area', rect: [40, -70, 175, 30] },
  { id: 'stjohns', name: 'St. Johns Bridge', rect: [9, 242, 182, 258] },
  { id: 'tilikum', name: 'Tilikum Crossing', rect: [72, 426.5, 170, 437.5] },
  { id: 'hawthorne', name: 'Hawthorne Bridge', rect: [82, 464, 182, 476] },
  { id: 'cathedral', name: 'Cathedral Park', rect: [128, 258, 232, 314] },
  { id: 'chimney', name: 'Chimney Park', rect: [164, 316, 236, 388] },
  { id: 'carts', name: 'Food Cart Pod', rect: [258, 396, 306, 458] },
  { id: 'tabor', name: 'Mt. Tabor Park', circle: [360, 440, 52] },
  { id: 'mansion', name: 'Pittock Mansion', circle: [-250, 452, 30] },
  { id: 'square', name: 'Pioneer Courthouse Square', rect: [-90, 398, -6, 462] },
  { id: 'makers', name: 'Bridgeside Makers Market', rect: [12, 476, 86, 500] },
  { id: 'waterfront', name: 'Waterfront Park', fn: (x, z, h, w) => x > 9 && x < 110 && z > 300 && z < 505 && h > 0.2 },
  { id: 'linnton', name: 'Linnton', rect: [-198, 224, -112, 302] },
  { id: 'downtown', name: 'Downtown Portland', rect: [-150, 240, 9, 505] },
  { id: 'forestpark', name: 'Forest Park', fn: (x, z, h, w) => z > 200 && (w.ridgeDx(x, z) < 96 || (x < -150 && w.ridgeDx(x, z) < 190)) },
  { id: 'sauvie', name: 'Sauvie Island', fn: (x, z, h, w) => h > 0.2 && x > -150 && x < 250 && z > -112 && z < 205 && w.riverSd(x, z, 'channel') > 0 && w.riverSd(x, z, 'columbia') > 0 && w.riverSd(x, z, 'willamette') > 0 && (x + 0.5 * z > -150) },
  { id: 'columbia', name: 'Columbia River', fn: (x, z, h, w) => h < 0.2 && w.riverSd(x, z, 'columbia') < 12 },
  { id: 'channel', name: 'Multnomah Channel', fn: (x, z, h, w) => h < 0.2 && w.riverSd(x, z, 'channel') < 12 },
  { id: 'willamette', name: 'Willamette River', fn: (x, z, h, w) => h < 0.2 && w.riverSd(x, z, 'willamette') < 12 },
  { id: 'stjohnstown', name: 'St. Johns', rect: [120, 222, 330, 318] },
  { id: 'eastside', name: 'Eastside', rect: [120, 318, 330, 505] },
  { id: 'hwy30', name: 'Highway 30', fn: (x, z, h, w) => w.roadDist('hwy30', x, z) < 34 },
  { id: 'farshore', name: 'The Far Shore', fn: (x, z, h, w) => w.riverSd(x, z, 'columbia') > 0 && (x > 100 && z < 60) },
  { id: 'tualatin', name: 'Tualatin Hills', fn: (x, z, h, w) => w.ridgeDx(x, z) < 96 },
  { id: 'bottoms', name: 'Scappoose Bottoms', fn: (x, z) => x < -140 && z > -118 && z < 236 },
  { id: 'valley', name: 'Lower Columbia', fn: () => true }
];
/* names drawn on the minimap and the big map: [name, x, z, big?] */
export const DISTRICT_LABELS = [
  ['St. Helens', -330, -300, 1], ['Old Town', -206, -300], ['Courthouse Plaza', -160, -262], ['Columbia View Park', -150, -152], ['Sand Island', -46, -300], ['North Marina', -112, -358],
  ['Grey Cliffs', -156, -410], ['Dalton Lake', -232, -456], ['Old Quarry', -330, -440], ['Nob Hill', -246, -118], ['McCormick Park', -386, -100], ['Paper Mill', -356, -26],
  ['Highway 30', -398, 30], ['Scappoose', -272, 62, 1], ['Columbia River', 60, -330, 1], ['Multnomah Channel', -160, 60], ['Sauvie Island', 60, 110, 1], ['Wapato Patch Farm', 50, 66],
  ['Warrior Rock Light', -34, -100], ['Wildlife Area', 108, -44], ['Island Beach', 180, 56], ['Linnton', -176, 262], ['St. Johns Bridge', 100, 240], ['Cathedral Park', 180, 290],
  ['Chimney Park', 200, 352], ['Forest Park', -230, 340, 1], ['Pittock Mansion', -250, 466], ['Portland', -50, 320, 1], ['Pioneer Courthouse Sq.', -50, 430], ['Waterfront Park', 46, 420],
  ['Makers Market', 48, 492], ['Tilikum Crossing', 121, 424], ['Hawthorne Bridge', 132, 478], ['St. Johns', 262, 276], ['Food Carts', 282, 428], ['Mt. Tabor', 360, 452], ['Willamette River', 112, 372], ['Tualatin Hills', -420, 330, 1], ['The Far Shore', 300, -280, 1]
];

/* ---------- buildings. w = size along x, d = size along z, f = side the door faces (s = +z, n = -z, e = +x, w = -x) ---------- */
const P = { cream: 0xf2e6cf, brick: 0xb5563f, sage: 0x8fae8b, sky: 0x8fb8d8, butter: 0xf0cf73, rose: 0xd98d8d, slate: 0x6f7f8f, wood: 0x9a6a42, white: 0xf4f4ef, teal: 0x4f9a94, plum: 0x8a6a9a, moss: 0x6f8f4f, barn: 0xa8402f, basalt: 0x6a6e76, sand: 0xd8c8a4, ochre: 0xc9953a, navy: 0x3a4f7a, mint: 0xa8d8c0 };
const HOUSE_COLS = [P.cream, P.sky, P.butter, P.rose, P.sage, P.white, P.mint, P.plum, P.sand], ROOF_COLS = [0x7a4a3a, 0x4a5a6a, 0x6a4a4a, 0x5a5a5a, 0x7a5a3a, 0x4a6a5a, 0x6a6a6a, 0x5a3a3a];
let hn = 0;
const house = (x, z, f, over = {}) => { const side = f === 'e' || f === 'w', i = hn++; return { id: 'h' + i, x, z, w: side ? 10 : 12, d: side ? 12 : 10, h: 5 + (i % 3) * 0.3, col: HOUSE_COLS[(i * 5) % HOUSE_COLS.length], roof: 'gable', f, kind: 'house', roofCol: ROOF_COLS[(i * 3) % ROOF_COLS.length], yard: true, ...over }; };
const shop = (id, x, z, f, sign, col, awn, over = {}) => { const side = f === 'e' || f === 'w'; return { id, x, z, w: side ? 14 : 16, d: side ? 16 : 14, h: 6.5 + ((x * 7 + z * 3) % 3 + 3) % 3 * 0.6, col, roof: (Math.abs(x + z) % 2) ? 'flat' : 'gable', f, sign, awn, kind: 'shop', stripe: Math.abs(x) % 4 < 2, ...over }; };
const block = (id, x, z, w, d, h, col, f, over = {}) => ({ id, x, z, w, d, h, col, roof: 'flat', f, kind: 'block', ...over });

export const BUILDINGS = [
  /* ===== St. Helens: S 1st Street, west side (doors face east) ===== */
  { id: 'picturehouse', x: -222, z: -312, w: 16, d: 28, h: 9.5, col: P.cream, roof: 'flat', f: 'e', sign: 'The Riverfront Picture House', kind: 'cinema' },
  shop('bakery', -221, -286, 'e', 'Flour & Paw Bakery', P.butter, 0xd9534f),
  shop('tailor', -221, -268, 'e', 'Stitch & Sit Costume Tailor', P.plum, 0xe8d9a8),
  shop('pets', -221, -232, 'e', 'Tailwind Pet Supply', P.teal, 0xffd27a),
  shop('records', -221, -214, 'e', 'Low Tide Records', P.slate, 0xe0b040),
  /* east side (doors face west) */
  shop('cafe', -189, -322, 'w', 'Fogline Coffee', P.sage, 0x7a4f2f),
  shop('toys', -189, -304, 'w', 'Driftwood Toys', P.rose, 0xffffff),
  shop('hardware', -189, -286, 'w', 'Basalt Hardware', P.brick, 0x2f4f7f),
  shop('icecream', -189, -214, 'w', 'Scoop Dock Ice Cream', P.sky, 0xffffff),
  /* plaza, south side (doors face north) */
  shop('gallery', -170, -212, 'n', 'Tideline Gallery', P.sand, 0x4f6f3f, { w: 16 }),
  shop('diner', -154, -212, 'n', 'Columbia Diner', P.ochre, 0xd9534f, { w: 13 }),
  /* civic */
  { id: 'cityhall', x: -166, z: -291, w: 24, d: 15, h: 8, col: P.brick, roof: 'flat', f: 's', sign: 'St. Helens City Hall', kind: 'civic' },
  { id: 'courthouse', x: COURTHOUSE.x, z: COURTHOUSE.z, w: 18, d: 34, h: 10, col: P.basalt, f: 'w', sign: 'Columbia County Courthouse', kind: 'courthouse' },
  /* the Strand, north */
  shop('chandlery', -156, -322, 'e', 'Knot & Oar Chandlery', P.navy, 0xf4f4ef),
  shop('fishfry', -156, -306, 'e', 'Sturgeon Fry House', P.white, 0x3f9fd6, { d: 14 }),
  { id: 'marinaoffice', x: -118, z: -350, w: 13, d: 9, h: 4.8, col: 0x4f7f9f, roof: 'gable', f: 's', sign: 'North Marina', kind: 'cabin', roofCol: 0x6a4a3a },
  /* victorian houses on the bluff */
  ...[[-232, 0], [-254, 1], [-276, 2]].map(([x, i]) => ({ id: 'vic' + i, x, z: -164, w: 11, d: 11, h: 8, col: [P.plum, P.mint, P.butter][i], roof: 'gable', f: 'n', kind: 'victorian', roofCol: [0x4a4a5a, 0x5a3a3a, 0x4a5a4a][i], yard: true })),
  /* uptown houses: Milton Way */
  ...[-325, -303, -281, -225, -203, -181].flatMap(z => [house(-367, z, 'e'), house(-333, z, 'w')]),
  /* Columbia Blvd */
  ...[-420, -398, -302, -280, -258].flatMap(x => [house(x, -267, 's'), house(x, -233, 'n')]),
  /* St. Helens Street */
  /* the two nearest S 1st Street sit further back: St. Helens Street angles south there */
  ...[-420, -398, -302, -280, -258, -236].map(x => house(x === -236 ? -238 : x, x === -236 ? -328 : x === -258 ? -331 : -333, 'n')),
  ...[-420, -398, -376, -290, -268, -246].map(x => house(x, -367, 's')),
  shop('grocer', -238, -233, 'n', 'Houlton Corner Grocer', P.moss, 0xffffff, { w: 14 }),
  shop('laundry', -238, -267, 's', 'Sudsy Paws Laundromat', P.sky, 0x3f7fd6, { w: 14 }),
  /* McCormick Park */
  { id: 'mccshelter', x: -386, z: -126, w: 10, d: 7, h: 3.6, col: P.wood, roof: 'gable', f: 's', sign: 'McCormick Park', kind: 'cabin', roofCol: 0x3f5f3f },
  /* the Paper Mill */
  { id: 'mill', x: -356, z: -28, w: 32, d: 22, h: 10, col: 0x8a8f96, roof: 'flat', f: 'e', sign: 'The Paper Mill', kind: 'mill' },
  { id: 'millshed', x: -362, z: -4, w: 18, d: 10, h: 5, col: 0x7a8088, roof: 'gable', f: 'e', kind: 'shed', roofCol: 0x5a5f66 },
  /* Scappoose */
  shop('fuel', -297, 40, 'e', 'Scappoose Fuel & Treats', P.white, 0xd9534f, { roof: 'flat' }),
  shop('feed', -288, 62, 'e', 'Peak Feed & Seed', P.barn, 0xffffff),
  shop('pie', -282, 80, 'e', 'Blue Heron Pie Co.', P.butter, 0x3f7fd6, { w: 12, d: 12 }),
  shop('antiques', -252, 46, 'w', 'Second Wind Antiques', P.sage, 0xe8d9a8),
  shop('bikes', -246, 68, 'w', 'Channel Cyclery', P.teal, 0xffd27a),
  house(-240, 92, 'w'), house(-306, 16, 'e'),
  /* Linnton */
  /* both stand well back from Highway 30, on the Forest Park side (an invented farm-supply shed and cafe, not modelled on any real shop) */
  { id: 'linnton1', x: -186, z: 244, w: 20, d: 12, h: 6, col: 0x8a8f96, roof: 'gable', f: 's', sign: 'River Road Farm Supply', kind: 'cabin', roofCol: 0x5a5f66 },
  { id: 'linnton2', x: -153, z: 293, w: 10, d: 14, h: 5, col: P.wood, roof: 'gable', f: 'e', sign: 'Trailhead Cafe', kind: 'cabin', roofCol: 0x3f5f3f },
  /* Sauvie Island */
  { id: 'barn', x: 76, z: 60, w: 20, d: 14, h: 8, col: P.barn, roof: 'gable', f: 'w', sign: 'Wapato Patch Farm', kind: 'barn', roofCol: 0x5a5a5e },
  { id: 'farmhouse', x: 32, z: 20, w: 13, d: 10, h: 5.4, col: P.white, roof: 'gable', f: 's', kind: 'house', roofCol: 0x7a3a3a },
  { id: 'coop', x: 92, z: 34, w: 6, d: 5, h: 3, col: P.wood, roof: 'gable', f: 's', kind: 'shed', roofCol: 0x8a3a2a },
  { id: 'keeper', x: -18, z: -70, w: 8, d: 7, h: 4, col: P.white, roof: 'gable', f: 'e', sign: 'Lightkeeper', kind: 'cabin', roofCol: 0x8a3a2a },
  { id: 'farm2', x: -90, z: 60, w: 16, d: 12, h: 7, col: 0xc9c2a8, roof: 'gable', f: 'e', kind: 'barn', sign: 'Channel Dairy', roofCol: 0x6a4a3a },
  { id: 'farm2h', x: -84, z: 36, w: 12, d: 10, h: 5.2, col: P.butter, roof: 'gable', f: 'e', kind: 'house', roofCol: 0x5a5a5a },
  { id: 'farm3', x: 150, z: 110, w: 16, d: 12, h: 7, col: P.barn, roof: 'gable', f: 'w', kind: 'barn', sign: 'East Shore Orchard', roofCol: 0x5a5a5e },
  /* ===== Portland, west side ===== */
  block('books', -50, 352, 62, 40, 11, P.brick, 's', { sign: 'Rain City Books', kind: 'bookshop' }),
  block('twr1', -130, 336, 24, 26, 20, 0x9fb0bf, 'e', { sign: 'Hotel Fernfall' }),
  block('twr2', -130, 368, 24, 26, 30, 0x7f8f9f, 'e'),
  block('twr3', -130, 404, 24, 30, 24, 0xc9b99f, 'e', { sign: 'Bridge City Bank' }),
  block('twr4', -130, 468, 24, 30, 34, 0x8fa6b8, 'e'),
  block('twr5', -68, 490, 30, 20, 26, 0xb5563f, 'n', { sign: 'The Puddle Works', neon: true }),
  block('twr6', -28, 490, 26, 20, 18, 0xd8c8a4, 'n'),
  shop('donut', -89, 329, 's', 'Good Dog Donuts', P.rose, 0xffffff, { w: 12, d: 12 }),
  shop('ramen', -14, 322, 's', 'Umbrella Noodle Bar', P.navy, 0xd9534f, { w: 12, d: 12 }),
  /* east side */
  ...[284, 306, 328, 350].map(z => house(264, z, 'w')),
  ...[200, 222, 290].map(x => house(x, 487, 'n')),
  ...[196, 218, 240, 266, 288].map(x => house(x, 232, 's')),
  shop('stjcafe', 216, 273, 'e', 'Span & Bean Cafe', P.mint, 0x4f6f3f, { w: 12, d: 12 }),
  shop('stjbikes', 262, 262, 'w', 'Cathedral Cycle Works', P.ochre, 0x2f4f7f, { w: 12, d: 12 }),
  { id: 'training', x: 226, z: 372, w: 9, d: 7, h: 4, col: P.moss, roof: 'gable', f: 'w', sign: 'Trick School', kind: 'cabin', roofCol: 0x6a4a3a },
  { id: 'mansion', x: MANSION.x, z: MANSION.z, w: 26, d: 16, h: 9, col: 0xd8c8a4, f: 'e', sign: 'Pittock Mansion', kind: 'mansion' }
];

export const STALLS = [
  /* Bridgeside Makers Market */
  { x: 22, z: 487, name: 'Knotty Collars', col: 0xd9534f, ry: Math.PI }, { x: 34, z: 487, name: 'Tag & Stamp', col: 0xf0b030, ry: Math.PI }, { x: 46, z: 487, name: 'Bandana Bay', col: 0x8a4fae, ry: Math.PI },
  { x: 58, z: 487, name: 'Clay Paws', col: 0x3f9f7f, ry: Math.PI }, { x: 70, z: 487, name: 'Wool & Whistle', col: 0x3f7fd6, ry: Math.PI },
  /* St. Helens plaza market */
  { x: -182, z: -234, name: 'Plaza Cider', col: 0xc9953a }, { x: -182, z: -266, name: 'Kettle Corn', col: 0xd9534f, ry: Math.PI },
  /* farm stands */
  { x: -374, z: 54, name: 'Highway Farm Stand', col: 0x5f9f4f, ry: 0.7 }, { x: 44, z: 50, name: 'Wapato Patch Stand', col: 0xf08a2a, ry: Math.PI / 2 }
];
/* food carts: [x, z, name, colour, yaw] */
export const CARTS = [
  [268, 408, 'Biscuit Wheel', 0xf0b860, Math.PI / 2], [268, 422, 'Noodle Tail', 0xd9534f, Math.PI / 2], [268, 436, 'Good Bowl', 0x4fae8f, Math.PI / 2], [268, 450, 'Waffle Wag', 0xf0c040, Math.PI / 2],
  [298, 412, 'Smoke & Stick', 0x8a4fae, -Math.PI / 2], [298, 428, 'Pup Cup Creamery', 0x8fb8d8, -Math.PI / 2], [298, 444, 'Rice Paper Kite', 0xe07a5a, -Math.PI / 2]
];
/* painted ground patches: [x0, z0, x1, z1, colour, surface] surface: 5 paving, 3 sand, 0 none */
export const PATCHES = [
  [-198, -274, -146, -228, '#b9a58f', 5],       /* courthouse plaza */
  [-134, -270, -108, -230, '#c9c0ae', 5],       /* courthouse forecourt */
  [-200, -186, -98, -124, '#7fc668', 0],        /* Columbia View Park lawn */
  [-196, -184, -166, -170, '#6a6c72', 5],       /* park parking */
  [-132, -372, -100, -330, '#8f8a80', 5],       /* marina yard */
  [-440, -144, -330, -60, '#7cc064', 0],        /* McCormick lawn */
  [-433, -136, -404, -106, '#b8b4aa', 5],       /* skate park slab */
  [-396, -112, -350, -74, '#8fcf70', 0],        /* off-leash meadow */
  [-378, -52, -330, 6, '#8d8a84', 5],           /* mill yard */
  [-304, 30, -280, 52, '#6a6c72', 5],           /* fuel forecourt */
  [-198, 228, -172, 262, '#8d8a84', 5],         /* Linnton yard */
  [-86, 400, -14, 460, '#b5694f', 5],           /* Pioneer Courthouse Square brick */
  [12, 476, 84, 498, '#cfc6b4', 5],             /* makers market paving */
  [132, 262, 232, 312, '#7fc668', 0],           /* Cathedral Park */
  [166, 318, 234, 386, '#8fcf70', 0],           /* Chimney Park */
  [258, 398, 306, 458, '#a9a295', 5],           /* food cart pod gravel */
  [-264, 436, -236, 466, '#c9c0ae', 5],         /* mansion terrace */
  [28, 6, 96, 44, '#b59a6a', 0],                /* farm yard */
  [-10, 398, 0, 412, '#6a6c72', 5],             /* square parking bay */
  [14, 426, 38, 438, '#c9c0ae', 5], [212, 426, 238, 438, '#c9c0ae', 5],   /* tram stops */
  [152, 22, 222, 88, '#dcc890', 3]              /* Island Beach sand */
];
/* crop fields: [x0, z0, x1, z1, kind] kind: pumpkin, corn, rows, pasture, orchard */
export const FIELDS = [
  [58, 76, 128, 128, 'pumpkin'], [-28, 72, 34, 130, 'corn'], [-30, 6, 20, 36, 'rows'], [100, 8, 134, 44, 'pasture'],
  [-128, 20, -100, 110, 'rows'], [-80, 76, -40, 130, 'pasture'], [120, 96, 190, 150, 'orchard'], [0, 140, 110, 176, 'rows'], [150, 76, 200, 92, 'rows']
];
export const MAZE = { x0: -26, z0: 74, x1: 32, z1: 128 };

/* ---------- rideables (kind: skateboard | canoe | van) ---------- */
export const RIDEABLES = [
  { id: 'board-park', kind: 'skateboard', x: -160, z: -160, yaw: 0.6 },
  { id: 'board-skatepark', kind: 'skateboard', x: -412, z: -122, yaw: 2 },
  { id: 'board-waterfront', kind: 'skateboard', x: 30, z: 446, yaw: 0 },
  { id: 'canoe-dock', kind: 'canoe', x: -71, z: -215.2, yaw: Math.PI / 2 },
  { id: 'canoe-sand', kind: 'canoe', x: -73, z: -300, yaw: 3.1 },
  { id: 'canoe-cathedral', kind: 'canoe', x: 114, z: 296, yaw: 0.3 },
  { id: 'canoe-beach', kind: 'canoe', x: 226, z: 46, yaw: 1.2 },
  { id: 'van-park', kind: 'van', x: -181, z: -177, yaw: Math.PI / 2 },
  { id: 'van-scappoose', kind: 'van', x: -292, z: 22, yaw: 0.3 },
  { id: 'van-portland', kind: 'van', x: -6, z: 404, yaw: Math.PI },
  { id: 'van-farm', kind: 'van', x: 56, z: 26, yaw: -0.6 }
];

/* ---------- traffic: routes follow road centre lines, offset to the right-hand lane. loop = closed circuit ---------- */
export const TRAFFIC = [
  { id: 'car-a', style: 'hatch', col: 0xd9534f, loop: true, pts: [[-450, -250], [-350, -250], [-205, -250], [-205, -340], [-350, -350], [-450, -350]] },
  { id: 'car-b', style: 'hatch', col: 0x4f8fd6, loop: true, pts: [[-205, -250], [-205, -185], [-300, -180], [-350, -150], [-350, -250]], t0: 0.4 },
  { id: 'car-c', style: 'pickup', col: 0x5f9f6f, road: 'hwy30', from: 1, to: 10 },
  { id: 'car-d', style: 'hatch', col: 0xe0a040, road: 'hwy30', from: 1, to: 10, t0: 0.3 },
  { id: 'mail', style: 'van', col: 0xf4f4ef, road: 'oldportland', from: 0, t0: 0.5 },
  { id: 'car-e', style: 'hatch', col: 0x9a6fd0, loop: true, pts: [[-100, 390], [5, 390], [5, 470], [-100, 470]] },
  { id: 'car-f', style: 'pickup', col: 0x4fb0b0, loop: true, pts: [[-105, 320], [-40, 290], [2, 258], [28, 250], [172, 250], [225, 255], [245, 300], [245, 400], [250, 470], [178, 470], [86, 470], [5, 470], [-100, 470], [-100, 400]], t0: 0.2 },
  { id: 'car-g', style: 'hatch', col: 0xf4f4ef, loop: true, pts: [[-105, 320], [-40, 290], [2, 258], [28, 250], [172, 250], [225, 255], [245, 300], [245, 400], [250, 470], [178, 470], [86, 470], [5, 470], [-100, 470], [-100, 400]], t0: 0.7 },
  { id: 'tractor', style: 'pickup', col: 0x3f9f4f, road: 'sauvieE', from: 0 }
];

/* ---------- pedestrians (they pause, wave at KC, chat and can pet her) ---------- */
export const PED_ROUTES = [
  { pts: [[-212, -332], [-212, -196]], n: 3, where: 'oldtown' },
  { pts: [[-198, -332], [-198, -280]], n: 2, where: 'oldtown' },
  { pts: [[-192, -270], [-150, -270], [-150, -232], [-192, -232]], loop: true, n: 3, where: 'plaza' },
  { pts: [[-146, -330], [-146, -200]], n: 2, where: 'oldtown' },
  { pts: [[-110, -340], [-103, -300], [-102, -250], [-104, -200], [-118, -152], [-160, -136]], n: 3, where: 'riverwalk' },
  { pts: [[-190, -176], [-120, -176], [-112, -140], [-180, -134]], loop: true, n: 3, where: 'cvpark' },
  { pts: [[-428, -257], [-232, -257]], n: 2, where: 'uptown' },
  { pts: [[-357, -340], [-357, -160]], n: 2, where: 'uptown' },
  { pts: [[-400, -144], [-424, -126], [-424, -86], [-398, -66], [-352, -70], [-338, -104], [-352, -138]], loop: true, n: 3, where: 'mccormick' },
  { pts: [[-232, -176], [-262, -150], [-266, -122], [-246, -108], [-226, -124], [-228, -156]], loop: true, n: 1, hiker: true, where: 'nobhill' },
  { pts: [[-190, -428], [-232, -428], [-278, -444], [-282, -464], [-240, -484], [-196, -480], [-180, -456]], loop: true, n: 2, hiker: true, where: 'dalton' },
  { pts: [[-46, -370], [-42, -330], [-48, -290], [-44, -250], [-46, -226]], n: 2, beach: true, where: 'sand' },
  { pts: [[-300, 26], [-280, 70], [-268, 104]], n: 2, where: 'scappoose' },
  { pts: [[-326, -30], [-336, -10], [-334, 6]], loop: true, n: 1, worker: true, where: 'mill' },
  { pts: [[46, 34], [62, 50], [46, 64], [30, 46]], loop: true, n: 2, farmer: true, where: 'farm' },
  { pts: [[60, 82], [124, 82], [124, 122], [60, 122]], loop: true, n: 2, where: 'farm' },
  { pts: [[46, -20], [70, -40], [112, -44], [150, -28], [156, 6], [124, 28], [80, 24]], loop: true, n: 1, hiker: true, where: 'wildlife' },
  { pts: [[-24, -76], [-32, -86], [-26, -92]], loop: true, n: 1, where: 'lighthouse' },
  { pts: [[160, 46], [200, 44], [196, 66], [164, 64]], loop: true, n: 2, beach: true, where: 'islandbeach' },
  { pts: [[34, 244.6], [166, 244.6]], n: 2, where: 'stjohns' },
  { pts: [[190, 264], [170, 284], [142, 290], [150, 306], [196, 306], [226, 290]], loop: true, n: 3, where: 'cathedral' },
  { pts: [[174, 326], [226, 326], [226, 378], [174, 378]], loop: true, n: 3, where: 'chimney' },
  { pts: [[274, 404], [292, 404], [292, 452], [274, 452]], loop: true, n: 4, where: 'carts' },
  { pts: [[330, 420], [364, 408], [392, 432], [386, 466], [352, 478], [324, 462]], loop: true, n: 2, hiker: true, where: 'tabor' },
  { pts: [[-80, 406], [-20, 406], [-20, 454], [-80, 454]], loop: true, n: 4, where: 'square' },
  { pts: [[-93, 306], [-93, 500]], n: 3, where: 'downtown' },
  { pts: [[-2, 306], [-2, 500]], n: 2, where: 'downtown' },
  { pts: [[-92, 383], [-4, 383]], n: 2, where: 'downtown' },
  { pts: [[40, 318], [44, 380], [70, 430], [84, 462], [80, 498]], n: 4, where: 'waterfront' },
  { pts: [[18, 481], [78, 481]], n: 3, where: 'makers' },
  { pts: [[-158, 268], [-196, 296], [-232, 300], [-250, 330], [-218, 356], [-240, 388], [-282, 400], [-272, 430], [-256, 440]], n: 3, hiker: true, where: 'forestpark' },
  { pts: [[-262, 440], [-240, 440], [-240, 462], [-262, 462]], loop: true, n: 2, where: 'mansion' },
  { pts: [[-178, 252], [-164, 262], [-144, 284]], n: 1, worker: true, where: 'linnton' },
  { pts: [[30, 437.4], [70, 436], [84, 435.2], [160, 435.2], [206, 437.4]], n: 2, where: 'tilikum' }
];
/* what people say when KC says hi, by where they are (all original lines) */
export const CHATTER = {
  any: ['Well hello there, KC!', 'Who is a good girl? You are.', 'Nice harness, pup.', 'Lovely day for a sniff about.', 'Mind the puddles, they are the best part.'],
  oldtown: ['The Picture House has a dog-friendly matinee today.', 'Flour & Paw just pulled a tray out of the oven. You can smell it, right?', 'S 1st Street has been the shop street for a hundred years.'],
  plaza: ['Come back at dusk when the Lantern Stack is lit.', 'The courthouse clock keeps the whole town on time.', 'Every lantern on the Stack was made by somebody here.'],
  riverwalk: ['That is Sand Island out there. Canoes at the Courthouse Dock.', 'On a clear day you can see the mountain from here.', 'Ring the Old Fog Bell if you are feeling brave.'],
  cvpark: ['The stage is for the costume parade. Tails optional, but encouraged.', 'Splash pad is open. Shake after, please!'],
  uptown: ['Highway is that way, river is the other way.', 'Our street does the best porch pumpkins come October.'],
  mccormick: ['Off-leash meadow is past the skate park.', 'The loop is a good long sniff: woods, creek, the lot.'],
  nobhill: ['Oaks and camas up here. Stay on the trail and the flowers come back.', 'Best view of the river junction in town.'],
  dalton: ['Shh. Herons on the far bank.', 'Quiet paws see more birds.'],
  sand: ['You paddled over? Good sailor.', 'Best digging sand in the county.'],
  scappoose: ['Fuel for the van, treats for the dog.', 'Farm stand up the highway has the good apples.'],
  mill: ['Rolls go from bay one to bay two. Careful paws.'],
  farm: ['Welcome to Wapato Patch. Dogs are always welcome here.', 'The corn maze has one right answer and a lot of fun wrong ones.', 'Pick a pumpkin, any pumpkin.'],
  wildlife: ['Leashes in the wildlife area, usually. You look trustworthy.', 'Sandhill cranes come through in autumn.'],
  lighthouse: ['Warrior Rock is the smallest lighthouse in Oregon. Mighty, though.'],
  islandbeach: ['Driftwood for days. Take a stick, leave a stick.'],
  stjohns: ['Look up! Those towers are something.', 'Windy up here. Ears back!'],
  cathedral: ['The bridge makes the best roof a park ever had.', 'Off-leash meet-up is by the water.'],
  chimney: ['Trick School is in session. Sit is the first lesson.', 'Everyone here is a very good dog. I checked.'],
  carts: ['Pup Cup Creamery does a peanut butter swirl.', 'Seven carts, zero wrong choices.'],
  tabor: ['You are standing on an old volcano. A sleepy one.', 'Race you to the top? No? Wise.'],
  square: ['They call this square the city living room.', 'Adoption day is on the steps this weekend.'],
  downtown: ['Rain City Books lets dogs browse. Try the travel section.', 'Hills are that way, river is that way, snacks are every way.'],
  waterfront: ['Frisbee on the lawn in ten minutes if you want in.', 'The promenade goes all the way to the bridge.'],
  makers: ['Hand-stamped tags, made while you wag.', 'This bandana would suit you. Blue brings out your collar.'],
  forestpark: ['Wildwood Trail goes on for miles. Pace yourself.', 'Big trees, soft trail, good smells.'],
  mansion: ['Sunrise from this terrace is worth the climb.', 'You can see the whole city, and the mountain past it.'],
  linnton: ['Gateway to Portland, right here. The Wildwood Trail starts behind the cafe.'],
  tilikum: ['No cars on this bridge. Just feet, wheels, paws and the tram.', 'The Heron Line stops at both ends. Dogs ride free.']
};
export const DOG_SPOTS = [
  { x: -372, z: -92, r: 14, name: 'Biscuit', coat: 0x8a5a3a, ear: 0x5a3a24, belly: 0xc9a27a, s: 0.9 },
  { x: -150, z: -150, r: 12, name: 'Pepper', coat: 0x3a3a3e, ear: 0x222226, belly: 0xe8e8e8, s: 1.1 },
  { x: -152, z: -404, r: 10, name: 'Cliff', coat: 0x9a9a9a, ear: 0x6a6a6a, belly: 0xdadada, s: 1.0 },
  { x: -46, z: -280, r: 9, name: 'Sandy', coat: 0xd9b26a, ear: 0xb98a4a, belly: 0xf4e6c8, s: 1.0 },
  { x: 60, z: 30, r: 12, name: 'Clover', coat: 0xf4f4f0, ear: 0x2a2a2a, belly: 0xffffff, s: 1.05 },
  { x: 200, z: 352, r: 16, name: 'Mochi', coat: 0xe8d8c0, ear: 0xa8703f, belly: 0xffffff, s: 0.8 },
  { x: 186, z: 366, r: 14, name: 'Bruno', coat: 0x5a3a24, ear: 0x3a2416, belly: 0x8a5a3a, s: 1.2 },
  { x: 168, z: 292, r: 12, name: 'Juniper', coat: 0xb8b0a0, ear: 0x6a6258, belly: 0xe8e4dc, s: 0.95 },
  { x: 360, z: 446, r: 12, name: 'Tabor', coat: 0xc98a4a, ear: 0x8a5a2a, belly: 0xf0d8b0, s: 1.0 },
  { x: 44, z: 420, r: 12, name: 'Rosie', coat: 0xf0e0c0, ear: 0xd0a070, belly: 0xffffff, s: 0.85 }
];
/* critter groups: kind, centre x, z, radius, count */
export const CRITTERS = [
  ['bird', -170, -244, 8, 6], ['bird', -150, -160, 9, 5], ['bird', -386, -100, 9, 5], ['bird', -50, 430, 8, 6], ['bird', 44, 400, 9, 5], ['bird', 180, 288, 9, 5], ['bird', 282, 430, 6, 4],
  ['bird', -246, -132, 6, 4], ['bird', -46, -300, 8, 5], ['bird', 100, 100, 10, 6], ['bird', -250, 452, 7, 4], ['bird', -272, 62, 6, 4], ['bird', 100, 246, 4, 3],
  ['duck', -232, -456, 18, 7], ['duck', -82, -250, 6, 4], ['duck', -212, -52, 14, 5], ['duck', 112, -6, 16, 7], ['duck', 110, 300, 7, 4], ['duck', 120, 430, 6, 3], ['duck', -106, -350, 5, 3],
  ['squirrel', -246, -130, 18, 4], ['squirrel', -400, -110, 20, 4], ['squirrel', -230, 330, 26, 5], ['squirrel', -260, 420, 20, 4], ['squirrel', 360, 440, 22, 4], ['squirrel', 44, 440, 14, 3], ['squirrel', -230, -440, 18, 3],
  ['chicken', 92, 30, 6, 7], ['sheep', 116, 26, 12, 6], ['sheep', -60, 104, 13, 5]
];

export const GOLDEN_BALLS = [
  [-170, -243], [-121, -226], [-222, -296], [-102, -208], [-150, -148], [-46, -372], [-44, -224], [-152, -412], [-268, -470], [-330, -440], [-246, -132], [-420, -92],
  [-356, -12], [-272, 96], [-374, 60], [-34, -98], [2, 100], [94, 104], [112, -40], [190, 60], [-62, 182], [100, 250], [100, 242], [160, 294],
  [200, 380], [282, 452], [360, 440], [-250, 462], [-232, 304], [-50, 428], [-50, 372], [60, 396], [46, 494], [132, 470], [-176, 254], [300, -200]
];
export const DIG_SPOTS = [
  [-46, -340], [-50, -262], [-42, -236], [-160, -144], [-112, -130], [-252, -112], [-400, -80], [-360, -96], [-322, -430], [-210, -436], [-148, -396], [-330, 0],
  [-262, 30], [-380, 62], [70, 90], [110, 116], [-10, 50], [130, -34], [176, 48], [192, 70], [-28, -84], [150, 300], [192, 340], [210, 370],
  [348, 452], [374, 430], [30, 410], [60, 460], [-240, 470], [-226, 352], [-150, 280], [280, 440]
];
export const PHOTO_SPOTS = [
  { id: 'stack', x: -178, z: -250, name: 'The Lantern Stack' }, { id: 'courthouse', x: -146, z: -250, name: 'Columbia County Courthouse' }, { id: 'picturehouse', x: -206, z: -312, name: 'The Riverfront Picture House' },
  { id: 'fogbell', x: -108, z: -222, name: 'The Old Fog Bell' }, { id: 'sand', x: -46, z: -226, name: 'Sand Island' }, { id: 'nobhill', x: -246, z: -130, name: 'Nob Hill Viewpoint' },
  { id: 'dalton', x: -196, z: -436, name: 'Dalton Lake' }, { id: 'quarry', x: -330, z: -426, name: 'The Old Quarry' }, { id: 'warrior', x: -30, z: -86, name: 'Warrior Rock Light' },
  { id: 'patch', x: 62, z: 74, name: 'Wapato Patch Farm' }, { id: 'stjohns', x: 12, z: 262, name: 'St. Johns Bridge' }, { id: 'cathedral', x: 150, z: 282, name: 'Cathedral Park' },
  { id: 'square', x: -50, z: 446, name: 'Pioneer Courthouse Square' }, { id: 'waterfront', x: 40, z: 424, name: 'Waterfront Park' }, { id: 'mansion', x: -226, z: 456, name: 'Pittock Mansion Viewpoint' },
  { id: 'tabor', x: 360, z: 444, name: 'Mt. Tabor Summit' }
];
export const SIGNPOSTS = [
  { id: 'welcome', x: -172, z: -182, title: 'Columbia View Park', text: 'Welcome to St. Helens, Oregon: a river town at the meeting of the Columbia and the Multnomah Channel. Dogs welcome. Follow the Riverwalk north to the courthouse.' },
  { id: 'plaza', x: -194, z: -240, title: 'Courthouse Plaza', text: 'The heart of old town. Each autumn the Fog Bell Festival fills the plaza with lanterns, and the Lantern Stack is lit at dusk.' },
  { id: 'stack', x: -164, z: -256, title: 'The Lantern Stack', text: 'A spiral of lanterns and painted pumpkins on a basalt base, each one made by a neighbour, with a brass running dog on top to show which way the wind is wagging.', ry: Math.PI / 2 },
  { id: 'courthouse', x: -136, z: -270, title: 'Columbia County Courthouse', text: 'Built 1906 of local basalt. The white clock tower was added a few years later and has kept the town punctual ever since.', ry: Math.PI / 2 },
  { id: 'fogbell', x: -111, z: -218, title: 'The Old Fog Bell', text: 'Cast in 1855 and rung by hand to guide boats past the rocks in thick river fog. The little lighthouse beside it is a half-size replica of Warrior Rock Light.', ry: Math.PI / 2 },
  { id: 'dock', x: -100, z: -209, title: 'Courthouse Dock', text: 'Canoes for Sand Island and the lighthouse. Paddle north for the island beach; south and east for Warrior Rock.', ry: Math.PI / 2 },
  { id: 'sand', x: -50, z: -368, title: 'Sand Island', text: 'Reached only by water. Beaches, a trail down the middle, and sand that was made for digging.' },
  { id: 'marina', x: -126, z: -338, title: 'North Marina', text: 'Mind the ropes. Ferry shuttle helpers wanted: strong swimmers preferred.' },
  { id: 'greycliffs', x: -146, z: -388, title: 'Grey Cliffs Waterfront Park', text: 'Off-leash lawn on the bluff. The river is right below: sticks float, dogs fetch.' },
  { id: 'dalton', x: -178, z: -424, title: 'Dalton Lake Nature Preserve', text: 'A quiet wetland loop. Soft paws and no barking, please: the herons are shy.' },
  { id: 'quarry', x: -326, z: -402, title: 'The Old Quarry', text: 'Basalt from here paved streets up and down the river a century ago. Watch your step on the benches.' },
  { id: 'nobhill', x: -236, z: -172, title: 'Nob Hill Nature Park', text: 'Oak woodland on a basalt bluff above the river junction. Wildflowers in spring; keep to the trail.' },
  { id: 'mccormick', x: -404, z: -148, title: 'McCormick Park', text: 'The big one: loop trail, skate park, creek and an off-leash meadow. Zoomies encouraged.' },
  { id: 'mill', x: -318, z: -46, title: 'The Paper Mill', text: 'The old mill is quiet for now. People say it only needs the right owner, and a good dog, to get the rolls moving again.' },
  { id: 'hwy', x: -428, z: -214, title: 'Highway 30', text: 'South-east for Scappoose, Sauvie Island and Portland. Stay on the verge, pup: the road is for wheels.', ry: Math.PI / 2 },
  { id: 'scappoose', x: -286, z: 18, title: 'Scappoose', text: 'Rest stop: fuel, treats and a noticeboard. Portland is down the highway; St. Helens is back the way you came.' },
  { id: 'stand', x: -366, z: 62, title: 'Highway Farm Stand', text: 'Apples, squash and bandanas. Honesty box on the counter.' },
  { id: 'wapato', x: -54, z: 218, title: 'Wapato Bridge', text: 'The only road onto Sauvie Island. Farms, beaches and the smallest lighthouse in Oregon are all on the far side.', ry: Math.PI / 2 },
  { id: 'farm', x: 40, z: 34, title: 'Wapato Patch Farm', text: 'Pumpkins, a corn maze and hay bales to climb. A dog-friendly farm: please do not herd anything unless asked nicely.' },
  { id: 'wildlife', x: 52, z: -18, title: 'Sauvie Island Wildlife Area', text: 'Sturgeon Lake and the marshes belong to the birds. Walk the loop and see who is home.' },
  { id: 'warrior', x: -26, z: -82, title: 'Warrior Rock Light', text: 'Oregon\'s smallest lighthouse, at the north tip of the island. Reach it by canoe from St. Helens or by the long flat trail.' },
  { id: 'beach', x: 164, z: 60, title: 'Island Beach', text: 'Driftwood, sand and the wide Columbia. Ships pass close: wave with your tail.' },
  { id: 'linnton', x: -156, z: 262, title: 'Linnton', text: 'River industry on one side, Forest Park on the other. The railway ends here, and the Wildwood Trail starts beside the cafe.' },
  { id: 'wildwood', x: -164, z: 272, title: 'Wildwood Trail', text: 'Forest Park\'s long trail. Follow it uphill through the firs to the mansion viewpoint.' },
  { id: 'stjohns', x: 20, z: 258, title: 'St. Johns Bridge', text: 'Opened 1931. A steel suspension bridge with tall pointed towers, high above the Willamette. Cathedral Park is under the far end.' },
  { id: 'cathedral', x: 196, z: 268, title: 'Cathedral Park', text: 'Named for the arches of the bridge overhead. Off-leash area by the water; the dock has a canoe.' },
  { id: 'chimney', x: 236, z: 352, title: 'Chimney Park', text: 'A fenced park for off-leash play, and home of Trick School. Close the gate behind you.', ry: Math.PI / 2 },
  { id: 'carts', x: 256, z: 430, title: 'Food Cart Pod', text: 'String lights, picnic tables and seven carts. Something for every nose.', ry: Math.PI / 2 },
  { id: 'tabor', x: 322, z: 458, title: 'Mt. Tabor Park', text: 'An old volcanic cinder cone in the middle of the city. The loop climbs to the summit.' },
  { id: 'square', x: -88, z: 430, title: 'Pioneer Courthouse Square', text: 'The brick square in the middle of downtown. Steps for sitting, room for a crowd, and a market most weekends.', ry: Math.PI / 2 },
  { id: 'books', x: -50, z: 380, title: 'Rain City Books', text: 'A whole block of books. Lost-and-found box by the door: somebody is always missing a bookmark.' },
  { id: 'waterfront', x: 14, z: 396, title: 'Waterfront Park', text: 'Lawn, fountain and a promenade along the Willamette. Frisbees have right of way.', ry: Math.PI / 2 },
  { id: 'makers', x: 14, z: 480, title: 'Bridgeside Makers Market', text: 'Collars, tags and bandanas from the people who make them. Open under the bridge, rain or shine.' },
  { id: 'tilikum', x: 72, z: 438.4, title: 'Tilikum Crossing', text: 'A bridge with no cars at all: walkers, wheels, paws and the Heron Line tram share it. Hop on the tram at either end.' },
  { id: 'tramstop', x: 218, z: 439.2, title: 'Heron Line: Eastbank', text: 'The tram runs back and forth over Tilikum Crossing to Waterfront Park. Dogs ride free. The food carts are just across the road.' },
  { id: 'mansion', x: -238, z: 446, title: 'Pittock Mansion', text: 'A 1914 house on the hilltop, now owned by the city. On a clear morning the mountain floats above the skyline.', ry: Math.PI / 2 }
];
