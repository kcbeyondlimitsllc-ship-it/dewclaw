/* Cedar Hollow world data. Everything here is original to KC: Open Trail.
   Coordinates: +x east, +z south, y up. Playable area is -300..300 on x and z. */
export const HALF = 300;          /* playable half-size */
export const EXT = 340;           /* terrain half-size (rim hills beyond the playable square) */
export const WATER_Y = 0;
export const BASE_Y = 3;

export const KC_COLORS = { coat: 0xf1dcae, shade: 0xdcc08a, belly: 0xfcf5e6, ear: 0xd9a866, tailTip: 0xfbf1dc, nose: 0xb57f78, eye: 0x4a2e1c, harness: 0x1f1f22, collar: 0x3f7fd6, tongue: 0xff8fa3, ballA: 0xff8a2a, ballB: 0x2f6fd6 };

export const RIVER = [[235, -345], [175, -245], [128, -150], [106, -60], [118, 40], [148, 128], [176, 178]];
export const LAKE = { x: 200, z: 224, rx: 64, rz: 52 };
export const MOUNTAIN = { x: -45, z: -250, h: 56, s: 82 };
export const LOOKOUT = { x: -24, z: -220 };
export const SPAWN = { x: 20, z: 47, yaw: Math.PI / 2 };
export const RANGER_POST = { x: 92, z: 71 };

export function riverX(z) {
  for (let i = 0; i < RIVER.length - 1; i++) { const a = RIVER[i], b = RIVER[i + 1]; if (z >= a[1] && z <= b[1]) return a[0] + (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]); }
  return z < RIVER[0][1] ? RIVER[0][0] : RIVER[RIVER.length - 1][0];
}

/* kind: road (asphalt), gravel, trail (dirt footpath) */
export const ROADS = [
  { id: 'main', name: 'Main Street', kind: 'road', w: 9, pts: [[-104, 40], [-40, 40], [40, 40], [100, 40], [136, 40], [170, 52], [196, 100], [205, 150]] },
  { id: 'fern', name: 'Fern Lane', kind: 'road', w: 8, pts: [[-104, 40], [-98, -6], [-88, -20], [84, -20], [96, -6], [100, 40]] },
  { id: 'cedar', name: 'Cedar Avenue', kind: 'road', w: 8, pts: [[-10, -78], [-10, -20], [-10, 40], [-10, 150], [-40, 190], [-100, 214], [-132, 214]] },
  { id: 'camp', name: 'Pinecone Road', kind: 'gravel', w: 7, pts: [[-104, 40], [-140, 34], [-176, 12], [-198, 6]] },
  { id: 'forest', name: 'Whispering Loop', kind: 'trail', w: 3.6, pts: [[-198, 6], [-236, -40], [-246, -100], [-200, -138], [-150, -112], [-124, -50], [-140, 34]] },
  { id: 'mountain', name: 'Waggle Switchbacks', kind: 'trail', w: 3.6, pts: [[-10, -78], [-50, -112], [2, -140], [-60, -168], [-10, -194], [-24, -216]] },
  { id: 'river', name: 'Otter Bend Trail', kind: 'trail', w: 3.6, pts: [[98, 30], [88, -20], [89, -60], [101, -110], [111, -150], [143, -214]] },
  { id: 'foot', name: 'Heron Path', kind: 'trail', w: 3.6, pts: [[89, -60], [122, -60], [160, -30], [170, 52]] },
  { id: 'farmtrail', name: 'Hayfield Path', kind: 'trail', w: 3.6, pts: [[-132, 214], [-176, 198], [-224, 150], [-216, 60], [-198, 6]] },
  { id: 'shore', name: 'Mirror Lake Loop', kind: 'trail', w: 3.6, pts: [[205, 150], [258, 166], [278, 224], [252, 276], [200, 288], [150, 268], [128, 226]] },
  { id: 'meadow', name: 'Meadow Way', kind: 'trail', w: 3.6, pts: [[-10, 150], [40, 178], [96, 206], [128, 226]] },
  { id: 'pier', name: 'Fishing Pier Path', kind: 'trail', w: 3, pts: [[84, 100], [118, 100]] },
  { id: 'hill', name: 'Heron Hill Path', kind: 'trail', w: 3.2, pts: [[160, -30], [200, -52], [234, -70]] }
];

/* Zones, checked in order; the first match names where KC is. */
export const ZONES = [
  { id: 'camp', name: 'Camp Pinecone', circle: [-204, 0, 36] },
  { id: 'lookout', name: 'Eagle Perch Lookout', circle: [-24, -220, 20] },
  { id: 'park', name: 'Fountain Green', rect: [12, 52, 86, 142] },
  { id: 'beach', name: 'Pebble Beach', rect: [176, 148, 252, 178] },
  { id: 'lake', name: 'Mirror Lake', ellipse: [200, 224, 78, 66] },
  { id: 'farm', name: 'Sunny Paw Farm', rect: [-204, 170, -56, 286] },
  { id: 'town', name: 'Cedar Hollow', rect: [-112, -52, 104, 150] },
  { id: 'mountain', name: 'Mount Waggle', fn: (x, z, h) => h > 11 && z < -95 && x < 80 && x > -200 },
  { id: 'riverside', name: 'Otter Bend', fn: (x, z, h, w) => w.riverDist(x, z) < 26 },
  { id: 'forest', name: 'Whispering Firs', rect: [-300, -170, -112, 160] },
  { id: 'meadows', name: 'Heron Meadows', rect: [130, -300, 300, 150] },
  { id: 'valley', name: 'Cedar Valley', fn: () => true }
];
export const DISTRICT_LABELS = [
  ['Cedar Hollow', -10, 12], ['Fountain Green', 49, 96], ['Otter Bend', 112, -90], ['Whispering Firs', -205, -80], ['Camp Pinecone', -204, 0],
  ['Mirror Lake', 200, 228], ['Pebble Beach', 214, 160], ['Sunny Paw Farm', -130, 240], ['Mount Waggle', -60, -180], ['Eagle Perch', -24, -228], ['Heron Meadows', 220, -40]
];

/* Shops and buildings. f = facing side of the door (s = +z, n = -z, e = +x, w = -x). */
const P = { cream: 0xf2e6cf, brick: 0xb5563f, sage: 0x8fae8b, sky: 0x8fb8d8, butter: 0xf0cf73, rose: 0xd98d8d, slate: 0x6f7f8f, wood: 0x9a6a42, white: 0xf4f4ef, teal: 0x4f9a94, plum: 0x8a6a9a, moss: 0x6f8f4f, barn: 0xa8402f };
export const BUILDINGS = [
  /* Main Street, north side (doors face south) */
  { id: 'vet', x: -84, z: 23, w: 18, d: 14, h: 6.5, col: P.sky, roof: 'flat', f: 's', sign: 'Happy Tails Vet', awn: 0xffffff, kind: 'shop' },
  { id: 'books', x: -64, z: 23, w: 18, d: 14, h: 7.5, col: P.plum, roof: 'gable', f: 's', sign: 'The Dog-Eared Page', awn: 0xe8d9a8, kind: 'shop' },
  { id: 'bakery', x: -44, z: 23, w: 18, d: 14, h: 6.5, col: P.butter, roof: 'flat', f: 's', sign: 'Crumb & Wag Bakery', awn: 0xd9534f, kind: 'shop', stripe: true },
  { id: 'pets', x: 12, z: 23, w: 18, d: 14, h: 7, col: P.teal, roof: 'flat', f: 's', sign: 'Paws & Co. Pet Supply', awn: 0xffd27a, kind: 'shop', stripe: true },
  { id: 'outfit', x: 32, z: 23, w: 18, d: 14, h: 8, col: P.wood, roof: 'gable', f: 's', sign: 'Trailhead Outfitters', awn: 0x4f6f3f, kind: 'shop' },
  { id: 'cafe', x: 52, z: 23, w: 18, d: 14, h: 6.5, col: P.sage, roof: 'flat', f: 's', sign: 'Mossy Mug Cafe', awn: 0x7a4f2f, kind: 'shop', stripe: true },
  { id: 'hall', x: 73, z: 22, w: 19, d: 15, h: 9, col: P.cream, roof: 'gable', f: 's', sign: 'Cedar Hollow Town Hall', kind: 'hall' },
  /* Main Street, south side (doors face north) */
  { id: 'post', x: -84, z: 57, w: 18, d: 14, h: 6.5, col: P.brick, roof: 'flat', f: 'n', sign: 'Hollow Post', awn: 0x2f4f7f, kind: 'shop' },
  { id: 'scoops', x: -64, z: 57, w: 18, d: 14, h: 6, col: P.rose, roof: 'flat', f: 'n', sign: 'Scoops & Sticks', awn: 0xffffff, kind: 'shop', stripe: true },
  { id: 'music', x: -44, z: 57, w: 18, d: 14, h: 7.5, col: P.slate, roof: 'gable', f: 'n', sign: 'Fern & Fiddle Music', awn: 0xe0b040, kind: 'shop' },
  { id: 'ranger', x: 92, z: 62, w: 11, d: 9, h: 4.6, col: P.moss, roof: 'gable', f: 's', sign: 'Ranger Station', kind: 'cabin' },
  /* Fern Lane houses */
  ...[[-80, 0], [-58, 1], [-36, 2], [14, 3], [36, 4], [58, 5]].map(([x, i]) => ({ id: 'hs' + i, x, z: -5, w: 12, d: 10, h: 5, col: [P.cream, P.sky, P.butter, P.rose, P.sage, P.white][i], roof: 'gable', f: 'n', kind: 'house', roofCol: [0x7a4a3a, 0x4a5a6a, 0x6a4a4a, 0x5a5a5a, 0x7a5a3a, 0x4a6a5a][i] })),
  ...[[-84, 0], [-62, 1], [-40, 2], [12, 3], [34, 4], [56, 5], [76, 6]].map(([x, i]) => ({ id: 'hn' + i, x, z: -36, w: 12, d: 10, h: 5.2, col: [P.sage, P.white, P.plum, P.butter, P.sky, P.cream, P.rose][i], roof: 'gable', f: 's', kind: 'house', roofCol: [0x5a4a3a, 0x7a3a3a, 0x4a4a5a, 0x6a5a4a, 0x5a3a3a, 0x4a5a4a, 0x6a6a6a][i] })),
  /* farm */
  { id: 'barn', x: -164, z: 240, w: 20, d: 14, h: 8, col: P.barn, roof: 'gable', f: 'n', sign: 'Sunny Paw Farm', kind: 'barn', roofCol: 0x5a5a5e },
  { id: 'farmhouse', x: -112, z: 244, w: 13, d: 10, h: 5.4, col: P.white, roof: 'gable', f: 'n', kind: 'house', roofCol: 0x7a3a3a },
  { id: 'coop', x: -136, z: 252, w: 6, d: 5, h: 3, col: P.wood, roof: 'gable', f: 'n', kind: 'shed', roofCol: 0x8a3a2a },
  /* riverside, camp, beach */
  { id: 'boathouse', x: 158, z: 86, w: 12, d: 9, h: 4.8, col: 0x4f7f9f, roof: 'gable', f: 'w', sign: 'Otter Bend Boathouse', kind: 'cabin', roofCol: 0x6a4a3a },
  { id: 'campoffice', x: -184, z: -18, w: 10, d: 8, h: 4.4, col: P.wood, roof: 'gable', f: 's', sign: 'Camp Pinecone', kind: 'cabin', roofCol: 0x3f5f3f },
  { id: 'snack', x: 232, z: 152, w: 9, d: 7, h: 4, col: 0xf0b860, roof: 'flat', f: 's', sign: 'Pebble Beach Snacks', awn: 0x3f9fd6, kind: 'shop', stripe: true }
];

export const STALLS = [
  { x: 22, z: 60, name: 'Sausage Shack', col: 0xd9534f, sausage: true },
  { x: 36, z: 60, name: 'Honey Hut', col: 0xf0b030 },
  { x: 62, z: 60, name: 'Berry Best', col: 0x8a4fae },
  { x: 76, z: 60, name: 'Cheese Please', col: 0x3f9f7f }
];

/* Rideables (kind: skateboard | canoe | van) */
export const RIDEABLES = [
  { id: 'board-park', kind: 'skateboard', x: 24, z: 76, yaw: 0.6 },
  { id: 'board-beach', kind: 'skateboard', x: 204, z: 158, yaw: 2 },
  { id: 'canoe-dock', kind: 'canoe', x: 0, z: 73, yaw: 0, dock: true },     /* x is set from the river at build time */
  { id: 'canoe-lake', kind: 'canoe', x: 208, z: 176.5, yaw: 1.2 },
  { id: 'van-camp', kind: 'van', x: -190, z: 16, yaw: 1.2 },
  { id: 'van-town', kind: 'van', x: -24, z: 66, yaw: 0 }
];

/* Traffic routes follow road centre lines, offset to the right-hand lane. loop = closed circuit. */
export const TRAFFIC = [
  { id: 'car-a', style: 'hatch', col: 0xd9534f, loop: true, pts: [[-104, 40], [-40, 40], [40, 40], [100, 40], [96, -6], [84, -20], [-88, -20], [-98, -6]] },
  { id: 'car-b', style: 'hatch', col: 0x4f8fd6, loop: true, pts: [[-104, 40], [-98, -6], [-88, -20], [84, -20], [96, -6], [100, 40], [40, 40], [-40, 40]], t0: 0.5 },
  { id: 'car-c', style: 'pickup', col: 0x5f9f6f, road: 'main', from: 3 },
  { id: 'car-d', style: 'pickup', col: 0xe0a040, road: 'cedar', from: 2 },
  { id: 'mail', style: 'van', col: 0xf4f4ef, road: 'cedar', from: 0, to: 3, t0: 0.4 }
];

/* Pedestrian walking routes (they pause, wave at KC and can pet her). */
export const PED_ROUTES = [
  { pts: [[-92, 33.5], [80, 33.5]], n: 3 },
  { pts: [[-92, 46.5], [96, 46.5]], n: 3 },
  { pts: [[18, 64], [80, 64], [80, 136], [18, 136]], loop: true, n: 2 },
  { pts: [[49, 66], [49, 88], [38, 100], [49, 112], [49, 134], [60, 100]], loop: true, n: 1 },
  { pts: [[-4.5, -70], [-4.5, 28]], n: 1 },
  { pts: [[-198, 6], [-236, -40], [-246, -100], [-200, -138], [-150, -112], [-124, -50], [-140, 34]], n: 1, hiker: true },
  { pts: [[190, 158], [246, 160]], n: 2, beach: true },
  { pts: [[-12, -84], [-50, -112], [2, -140], [-60, -168], [-10, -194], [-22, -214]], n: 1, hiker: true },
  { pts: [[-120, 220], [-150, 228], [-128, 238]], loop: true, n: 1, farmer: true },
  { pts: [[98, 30], [88, -20], [89, -60], [101, -110]], n: 1, hiker: true },
  { pts: [[-212, 8], [-196, -8], [-206, -20], [-220, -4]], loop: true, n: 1, hiker: true }
];
export const DOG_SPOTS = [
  { x: 34, z: 118, r: 14, name: 'Biscuit', coat: 0x8a5a3a, ear: 0x5a3a24, belly: 0xc9a27a, s: 0.9 },
  { x: 62, z: 86, r: 12, name: 'Pepper', coat: 0x3a3a3e, ear: 0x222226, belly: 0xe8e8e8, s: 1.1 },
  { x: 218, z: 163, r: 10, name: 'Sandy', coat: 0xd9b26a, ear: 0xb98a4a, belly: 0xf4e6c8, s: 1.0 },
  { x: -150, z: 228, r: 12, name: 'Clover', coat: 0xf4f4f0, ear: 0x2a2a2a, belly: 0xffffff, s: 1.05 },
  { x: -210, z: 12, r: 9, name: 'Moss', coat: 0x9a9a9a, ear: 0x6a6a6a, belly: 0xdadada, s: 0.8 }
];
/* critter groups: kind, centre, radius, count */
export const CRITTERS = [
  ['bird', 49, 92, 7, 6], ['bird', -30, 40, 5, 4], ['bird', -150, 205, 8, 5], ['bird', 215, 165, 8, 5], ['bird', -24, -214, 5, 4], ['bird', 60, 40, 4, 3],
  ['bird', 150, -40, 8, 5], ['bird', -196, -20, 6, 4],
  ['duck', 200, 205, 16, 6], ['duck', 132, 92, 5, 3], ['duck', 112, -40, 4, 3], ['duck', 232, 240, 12, 4],
  ['squirrel', -220, -70, 26, 5], ['squirrel', -150, -80, 20, 4], ['squirrel', 30, 120, 12, 2], ['squirrel', -230, 100, 22, 4], ['squirrel', -70, -120, 18, 3],
  ['chicken', -134, 244, 7, 7], ['sheep', -172, 204, 13, 6]
];

export const GOLDEN_BALLS = [
  [49, 104.5], [73, 9.5], [-64, 12], [92, 52], [118, 46], [141, 70], [-205, -6], [-246, -104], [-152, -116], [-24, -224], [-58, -170], [4, -142],
  [143, -216], [236, -72], [214, 172], [200, 224], [276, 226], [150, 270], [-164, 228], [-82, 262], [-224, 152], [60, 180], [-10, -80], [108, -60]
];
export const DIG_SPOTS = [
  [30, 92], [70, 130], [-70, 8], [-126, 60], [-208, -32], [-232, -60], [-176, -128], [-36, -128], [-40, -200], [96, -90], [152, -120], [220, -30],
  [186, 160], [240, 164], [262, 250], [70, 196], [-90, 196], [-182, 222], [-218, 100], [130, 12]
];
export const PHOTO_SPOTS = [
  { id: 'fountain', x: 49, z: 90, name: 'Fountain Green' }, { id: 'bridge', x: 118, z: 40, name: 'Cedar Bridge' }, { id: 'lookout', x: -24, z: -222, name: 'Eagle Perch' },
  { id: 'camp', x: -204, z: 2, name: 'Camp Pinecone' }, { id: 'beach', x: 210, z: 166, name: 'Pebble Beach' }, { id: 'barn', x: -160, z: 224, name: 'Sunny Paw Barn' },
  { id: 'falls', x: 141, z: -212, name: 'Salmon Steps' }, { id: 'oldfir', x: -200, z: -134, name: 'The Old Fir' }, { id: 'hill', x: 234, z: -70, name: 'Heron Hill' }, { id: 'main', x: -10, z: 40, name: 'Main Street' }
];
export const SIGNPOSTS = [
  { id: 'welcome', x: -2, z: 47, title: 'Welcome to Cedar Hollow', text: 'Population: friendly. Dogs welcome everywhere. Follow the trails, sniff everything, and mind the ranger!' },
  { id: 'park', x: 16, z: 70, title: 'Fountain Green', text: 'Please keep paws out of the flower beds. (The ranger is watching. Mostly.)' },
  { id: 'trailhead', x: -15, z: -76, title: 'Waggle Switchbacks', text: 'A steady climb to Eagle Perch Lookout. Take water, take breaks, take in the view.' },
  { id: 'river', x: 94, z: 26, title: 'Otter Bend', text: 'Strong swimmers only past the bridge. Canoes at the boathouse dock on the east bank.' },
  { id: 'camp', x: -192, z: 8, title: 'Camp Pinecone', text: 'Quiet hours after dark. Sausages are for campers. Yes, that means you too, pup.' },
  { id: 'forest', x: -238, z: -44, title: 'Whispering Loop', text: 'Old firs, soft moss and squirrels with opinions. The big fir is halfway round.' },
  { id: 'lake', x: 208, z: 153, title: 'Mirror Lake', text: 'On a still morning you can see Mount Waggle in the water. The loop trail goes all the way round.' },
  { id: 'farm', x: -128, z: 210, title: 'Sunny Paw Farm', text: 'Eggs, wool and pumpkins. Please do not herd the sheep unless asked nicely.' },
  { id: 'lookout', x: -18, z: -214, title: 'Eagle Perch Lookout', text: 'You made it! The whole valley from the firs to the lake. Good dog.' },
  { id: 'falls', x: 139, z: -208, title: 'Salmon Steps', text: 'In autumn the salmon climb here on their way home. Look, do not lick.' },
  { id: 'hill', x: 230, z: -66, title: 'Heron Hill', text: 'Herons nest in the meadow below. Quiet paws see more birds.' },
  { id: 'meadow', x: 44, z: 182, title: 'Meadow Way', text: 'Shortcut to the lake. Wildflowers bloom along here most of the year.' }
];
export const FLOWER_BEDS = [[30, 84, 7, 4], [68, 84, 7, 4], [30, 116, 7, 4], [68, 116, 7, 4]]; /* x, z, w, d: digging here is mischief */
export const SAUSAGE_SPOTS = [{ id: 'stall', x: 22.6, z: 60.5, y: 1.3 }, { id: 'camp', x: -208, z: 10, y: 0.95 }, { id: 'beach', x: 226, z: 158, y: 0.95 }];
