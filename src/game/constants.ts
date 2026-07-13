/** Central tuning constants for gameplay. */

export const WORLD = {
  width: 1280,
  height: 720,
};

export const SHIP = {
  radius: 16,
  turnSpeed: 4.2, // radians per second
  thrust: 340, // px per second^2
  friction: 0.55, // velocity retention per second (v *= friction^dt)
  maxSpeed: 440, // px per second
  invulnTime: 2.0, // seconds of invulnerability after (re)spawn
};

// --- Ships --------------------------------------------------------------
export type ShipId = "vanguard" | "deltaRaptor" | "titan";

/** A hull-mounted, mouse-aimed gun turret. Offsets are in local hull space (+x = nose). */
export interface TurretMount {
  x: number; // mount offset along the hull (forward +)
  y: number; // mount offset across the hull
  barrel: number; // barrel length: muzzle sits this far out along the aim direction
}

export interface ShipSpec {
  id: ShipId;
  name: string;
  radius: number; // collision radius / hitbox
  turnSpeed: number; // radians per second
  thrust: number; // px/s^2
  maxSpeed: number; // px/s
  price: number; // shop cost in credits
  shieldCapacity?: number; // built-in rechargeable shield charges (0/undefined = none)
  turrets?: TurretMount[]; // mouse-aimed turrets; the weapon fires from each muzzle
}

export const SHIPS: Record<ShipId, ShipSpec> = {
  vanguard: {
    id: "vanguard",
    name: "Vanguard",
    radius: SHIP.radius,
    turnSpeed: SHIP.turnSpeed,
    thrust: SHIP.thrust,
    maxSpeed: SHIP.maxSpeed,
    price: 0,
  },
  deltaRaptor: {
    id: "deltaRaptor",
    name: "Delta Raptor",
    radius: 13, // smaller hitbox
    turnSpeed: 5.7, // more agile
    thrust: 435, // stronger engines
    maxSpeed: 520, // higher top speed
    price: 2500,
  },
  titan: {
    id: "titan",
    name: "Titan",
    radius: 24, // big, easy-to-hit hull
    turnSpeed: 1.15, // extremely sluggish to turn (engine upgrade helps a lot)
    thrust: 90, // heavy, crawls without upgraded engines
    maxSpeed: 150, // low top speed (engine upgrade nearly doubles it)
    price: 6500,
    shieldCapacity: 1, // light base shield — the shield generator upgrade boosts it
    // two mouse-aimed turrets on the flanks (the autocannon upgrade adds a third)
    turrets: [
      { x: 4, y: -11, barrel: 16 },
      { x: 4, y: 11, barrel: 16 },
    ],
  },
};

// --- Titan ship upgrades (bought at the shop, shown on the hull) --------
// Each upgrade is a one-time purchase that only applies while the Titan is flown.
export type UpgradeId = "shieldGen" | "engines" | "autocannon" | "tractor" | "hangar";

export interface UpgradeSpec {
  id: UpgradeId;
  name: string;
  price: number;
  desc: string;
}

export const UPGRADES: Record<UpgradeId, UpgradeSpec> = {
  shieldGen: {
    id: "shieldGen",
    name: "Schildgenerator",
    price: 1800,
    desc: "+3 Schildladungen · Kuppel am Heck",
  },
  engines: {
    id: "engines",
    name: "Schub-Triebwerke",
    price: 1600,
    desc: "Mehr Schub, Tempo & Wendigkeit · größere Düsen",
  },
  autocannon: {
    id: "autocannon",
    name: "Autogeschütz",
    price: 2200,
    desc: "Dritter Turm · zielt & feuert selbst",
  },
  tractor: {
    id: "tractor",
    name: "Traktorstrahl",
    price: 2400,
    desc: "Zieht Brocken heran, zerlegt sie · viele Extra-Credits",
  },
  hangar: {
    id: "hangar",
    name: "Hangar",
    price: 3000,
    desc: "Zwei Wingman-Drohnen fliegen mit & feuern selbst",
  },
};

/** Display/cycle order of upgrades in the shop. */
export const UPGRADE_ORDER: UpgradeId[] = [
  "shieldGen",
  "engines",
  "autocannon",
  "tractor",
  "hangar",
];

/** Tuning for how each upgrade changes the Titan. */
export const TITAN_UPGRADE = {
  shieldGenBonus: 3, // extra shield charges from the shield generator
  engineThrust: 120, // extra thrust (px/s^2) from upgraded engines
  engineMaxSpeed: 120, // extra top speed (px/s)
  engineTurn: 0.9, // extra turn rate (rad/s)
};

/** Auto-aiming turret added by the autocannon upgrade. REQ-SHIP-05. */
export const AUTOCANNON = {
  damage: 1,
  cooldown: 0.5, // seconds between auto-shots
  bulletSpeed: 560,
  bulletLife: 0.95, // ~530px reach
  range: 340, // only engages targets within this distance
  mount: { x: 10, y: 0, barrel: 13 }, // front-deck turret (hull-local, +x = nose)
};

/** Hangar upgrade: friendly wingman drones that fly in formation and auto-fire. REQ-SHIP-05. */
export const WINGMAN = {
  count: 2, // drones launched
  offsets: [
    { x: -8, y: -40 },
    { x: -8, y: 40 },
  ], // formation slots in hull-local space (+x = nose)
  follow: 5, // formation steering smoothing (per second)
  snapDist: 260, // teleport to the slot if it falls this far behind (handles screen wrap)
  range: 330, // engages enemies within this distance (enemies only, not asteroids)
  engageDist: 120, // how far from the ship a drone advances toward its target
  engageSpread: 26, // lateral offset so the two drones flank the target
  cooldown: 0.7, // seconds between drone shots
  damage: 1,
  bulletSpeed: 560,
  bulletLife: 0.9,
  radius: 7, // draw size / hitbox (drones can be shot down)
  respawn: 12, // seconds before a downed drone returns
};

/** Tractor-beam upgrade: reels in small asteroids, shatters them for bonus credits, and pulls loot. REQ-SHIP-05. */
export const TRACTOR = {
  range: 230, // radius that small asteroids and loot are pulled from
  pullSpeed: 260, // px/s reel-in speed for small asteroids
  lootPullSpeed: 340, // px/s pull speed for loot (a bit faster)
  grabMargin: 12, // shatter once within (ship.radius + asteroid.radius + this)
  absorbCreditMult: 5, // absorbed asteroids pay this multiple of their normal credits (economy upgrade)
};

export const BULLET = {
  speed: 620, // px per second
  life: 1.1, // seconds
  radius: 2.5,
  cooldown: 0.22, // seconds between shots
};

export type AsteroidSize = "large" | "medium" | "small" | "boss";

export const ASTEROID = {
  // score = points shown on the HUD; credits = spendable money (deliberately much
  // lower than score so asteroid farming isn't the main income — kills pay better).
  sizes: {
    boss: { radius: 92, score: 500, credits: 150, next: "large" as AsteroidSize, hp: 14, splits: 3 },
    large: { radius: 46, score: 20, credits: 6, next: "medium" as AsteroidSize, hp: 3, splits: 2 },
    medium: { radius: 28, score: 50, credits: 15, next: "small" as AsteroidSize, hp: 2, splits: 2 },
    small: { radius: 15, score: 100, credits: 30, next: null, hp: 1, splits: 0 },
  },
  minSpeed: 42, // spawn speed range for large asteroids
  maxSpeed: 95,
  bossSpeed: 30, // bosses drift slowly
  childSpeedFactor: 1.28, // children fly off a bit faster than the parent
  startCount: 5,
};

// --- Weapons ------------------------------------------------------------
export type WeaponId = "laser" | "vulkan" | "ballista";

export interface WeaponSpec {
  id: WeaponId;
  name: string;
  cooldown: number; // seconds between shots
  bulletSpeed: number; // px/s
  bulletLife: number; // seconds -> effective range
  spread: number; // total spread in radians
  pellets: number; // projectiles per shot
  damage: number; // damage per projectile (asteroid hp units)
  price: number; // shop cost in credits
}

export const WEAPONS: Record<WeaponId, WeaponSpec> = {
  laser: {
    id: "laser",
    name: "Basis-Laser",
    cooldown: BULLET.cooldown,
    bulletSpeed: BULLET.speed,
    bulletLife: BULLET.life,
    spread: 0,
    pellets: 1,
    damage: 1,
    price: 0,
  },
  vulkan: {
    id: "vulkan",
    name: "Vulkan MK",
    cooldown: 0.08, // very fast, one bullet at a time
    bulletSpeed: 540,
    bulletLife: 0.42, // short range (~227px)
    spread: Math.PI / 6, // 30 degree spread cone (random per shot)
    pellets: 1, // single pellet per shot
    damage: 1,
    price: 900,
  },
  ballista: {
    id: "ballista",
    name: "Ballista",
    cooldown: 0.78, // slow
    bulletSpeed: 920,
    bulletLife: 1.9, // long range (~1748px)
    spread: 0, // precise
    pellets: 1,
    damage: 3, // one-shots a large asteroid
    price: 1600,
  },
};

// --- Ammo ---------------------------------------------------------------
export type AmmoId = "standard" | "ap" | "explosive";

export interface AmmoSpec {
  id: AmmoId;
  name: string;
  damageMult: number;
  radiusMult: number;
  blast: number; // proximity/AoE radius: detonates near a target (explosive); 0 = direct hit only
  price: number; // cost per pack in the shop
  packSize: number; // rounds per purchased pack
}

/** Cycle order for the ammo selector (Q key). REQ-INPUT-01. */
export const AMMO_ORDER: AmmoId[] = ["standard", "ap", "explosive"];

export const AMMO: Record<AmmoId, AmmoSpec> = {
  standard: { id: "standard", name: "Standard", damageMult: 1, radiusMult: 1, blast: 0, price: 0, packSize: 0 },
  ap: { id: "ap", name: "Panzerbrechend", damageMult: 2, radiusMult: 1, blast: 0, price: 250, packSize: 60 },
  // Explosive detonates when it gets close to a target (proximity fuse) -> forgiving to aim.
  explosive: { id: "explosive", name: "Explosiv", damageMult: 1, radiusMult: 1, blast: 42, price: 350, packSize: 50 },
};

export const GAME = {
  startLives: 3,
  maxLives: 9, // cap for buyable extra lives
};

// --- Shop equipment (extra life + special gear) ------------------------
export const EQUIPMENT = {
  extraLife: { price: 1200 },
  shield: { price: 1200 },
  antigrav: { price: 700 },
};

export const SHOP = {
  equipmentChance: 0.5, // chance each random equipment item is stocked per visit
  randomEquipment: ["equip-antigrav"] as string[], // stocked randomly (shield is now a reliable buy)
};

// --- Enemies ------------------------------------------------------------
export type EnemyKind = "fighter" | "station";

export const ENEMY = {
  radius: 15,
  hp: 3,
  speed: 95, // drift speed
  life: 15, // seconds before the enemy leaves on its own
  fireCooldown: 1.7, // seconds between aimed shots
  bulletSpeed: 260,
  bulletLife: 3.2,
  bulletRadius: 4,
  score: 150,
  credits: 320, // kills are the main income now (was 150)
  firstSpawn: 16, // seconds until the first enemy
  interval: 20, // seconds between enemy spawns
  maxAlive: 3, // room for a wingman pair to attack at once
  stationChance: 0.4, // from wave 2, chance a spawn is a station instead of a fighter
  pairFromWave: 2, // from this wave a spawn can bring a second attacker
  pairChance: 0.5, // chance a spawn comes as a pair (from pairFromWave on)
};

// Heavily-armored, slow stations (from wave 2). They fire a charging beam. REQ-ENEMY-02.
export const STATION = {
  radius: 30,
  hp: 14,
  speed: 34,
  life: 26,
  score: 400,
  credits: 750, // fat payout for cracking a station (was 400)
  // Charging beam weapon: aim -> telegraphed charge -> short live beam -> cooldown.
  beamAim: 1.1, // seconds of settling before the charge begins
  beamCharge: 1.3, // telegraphed wind-up (aim is locked at its start)
  beamTime: 0.4, // seconds the beam is live and dealing damage
  beamCooldown: 2.4, // rest before the next aim
  beamRange: 640, // beam length in px
  beamWidth: 7, // beam half-width added to the ship radius for the hit test
  beamDamage: 1, // a hit costs a life (or a shield charge) like any other
};

// --- Enemy battleships (single big hostile ships with one health bar). REQ-BASE-01. --
export type BattleshipDesign = "dreadnought" | "mandible" | "fortress";

export interface BattleshipSpec {
  design: BattleshipDesign;
  name: string;
  hp: number; // one health bar for the whole ship
  radius: number; // hull collision radius
  speed: number; // drift speed across the field
  score: number;
  credits: number;
  shieldMax: number; // rechargeable shield charges shown as a blue hull outline (0 = none)
  // Main gun: a volley fired at the ship on `fireCooldown`.
  fireCooldown: number;
  bulletSpeed: number;
  bulletLife: number;
  bulletRadius: number;
  bulletDamage: number;
  range: number; // only engages the ship within this distance
  pellets: number; // shots per volley
  spread: number; // radians: fan across the aim (>0). 0 = parallel barrels
  muzzleGap: number; // lateral spacing between parallel barrels (used when spread = 0)
  // Hangar (fortress only): periodically launches capped fighters.
  hangar: boolean;
  hangarCooldown: number;
  hangarMaxFighters: number;
  hangarLaunchSpeed: number;
}

export const BASE = {
  fromWave: 3, // battleships appear from this wave on (later than before)
  chance: 0.2, // starting chance a station spawn is a battleship (only a few early on)
  chancePerWave: 0.12, // that chance grows by this much per wave beyond fromWave
  maxChance: 0.6, // cap on the battleship spawn chance
  life: 30, // seconds before it leaves the field
  shieldRechargeDelay: 5, // seconds without a hit to regain one shield charge
};

/** The three battleship designs (A Dreadnought, B Mandible raider, C Shipyard fortress). REQ-BASE-01. */
export const BATTLESHIPS: Record<BattleshipDesign, BattleshipSpec> = {
  // A — armoured capital ship: twin heavy cannon + a shield. Tanky.
  dreadnought: {
    design: "dreadnought",
    name: "Dreadnought",
    hp: 34,
    radius: 46,
    speed: 34,
    score: 360,
    credits: 700,
    shieldMax: 3,
    fireCooldown: 2.0,
    bulletSpeed: 320,
    bulletLife: 3.2,
    bulletRadius: 5, // heavy bolts
    bulletDamage: 1,
    range: 820,
    pellets: 2, // twin parallel cannon
    spread: 0,
    muzzleGap: 12,
    hangar: false,
    hangarCooldown: 0,
    hangarMaxFighters: 0,
    hangarLaunchSpeed: 0,
  },
  // B — predatory raider: rapid triple-spread from the mandibles, no shield (glass cannon).
  mandible: {
    design: "mandible",
    name: "Mandibel-Räuber",
    hp: 18,
    radius: 40,
    speed: 46, // faster, aggressive
    score: 300,
    credits: 620,
    shieldMax: 0,
    fireCooldown: 1.3,
    bulletSpeed: 340,
    bulletLife: 3.0,
    bulletRadius: 4,
    bulletDamage: 1,
    range: 820,
    pellets: 3, // spread fan
    spread: 0.5,
    muzzleGap: 0,
    hangar: false,
    hangarCooldown: 0,
    hangarMaxFighters: 0,
    hangarLaunchSpeed: 0,
  },
  // C — shipyard fortress: flak battery + launches fighters, strong shield. Slow, very tanky.
  fortress: {
    design: "fortress",
    name: "Werft-Festung",
    hp: 46,
    radius: 52,
    speed: 24,
    score: 440,
    credits: 860,
    shieldMax: 4,
    fireCooldown: 1.8,
    bulletSpeed: 300,
    bulletLife: 3.0,
    bulletRadius: 4,
    bulletDamage: 1,
    range: 820,
    pellets: 2, // twin flak
    spread: 0,
    muzzleGap: 16,
    hangar: true,
    hangarCooldown: 6.0,
    hangarMaxFighters: 4,
    hangarLaunchSpeed: 90,
  },
};

// --- Homing rockets ----------------------------------------------------
export const ROCKET = {
  radius: 6,
  speed: 350,
  turnRate: 3.4, // rad/s homing steer
  life: 3.6, // seconds before it fizzles
  damage: 4, // high damage (limited resource)
  cooldown: 0.45, // seconds between launches
  packSize: 5, // rockets per shop purchase
  price: 550, // shop cost per pack
  lootGrant: 3, // rockets from a loot pickup
  acquireCone: 1.25, // half-angle (rad) for "in front of the ship" (~72 deg)
};

// --- Space mines -------------------------------------------------------
export const MINE = {
  radius: 11, // trigger radius (larger so targets run into it)
  drift: 12, // slight drift speed
  life: 15, // seconds before it fizzles
  damage: 5, // high contact damage
  clusterSize: 3, // mines laid per activation ("small minefield")
  spread: 22, // px spread of the field (kept below backDist so mines stay behind)
  backDist: 42, // dropped this far behind the ship
  cooldown: 0.6, // seconds between drops
  packSize: 9, // mines per shop purchase
  price: 500, // shop cost per pack
  lootGrant: 4, // mines from a loot pickup
};

// The two secondary weapons share the S / down fire button. REQ-MINE-01.
export type SecondaryId = "rocket" | "mine";

// --- Loot & special equipment ------------------------------------------
export type LootKind = "shield" | "antigrav" | "ammo" | "rocket" | "mine";

export const LOOT = {
  radius: 13,
  life: 12, // seconds before a drop disappears
  drift: 22, // slow drift speed
  antigravTime: 16, // seconds of antigrav from a pickup
  antigravRadius: 175, // asteroids within this range are pushed away
  antigravForce: 320, // px/s^2 repulsion
  ammoGrant: 30, // rounds of each type from an ammo pickup
  // Drop weights (rest goes evenly to antigrav/ammo): shield & rocket rare, mines occasional.
  shieldDropChance: 0.06,
  mineDropChance: 0.12,
  rocketDropChance: 0.12,
};

// Rechargeable hit-shield (special equipment). REQ-EQUIP-01.
// The shield levels up (1..maxLevel) by buying/looting more shields; higher levels
// regenerate faster. Level 0 = no bought shield (e.g. the Titan's built-in shield).
export const SHIELD = {
  capacity: 1, // hits absorbed before it breaks
  rechargeDelay: 12, // base recharge seconds (level 0 / built-in shields) — deliberately slow
  rechargeByLevel: [12, 8, 5] as number[], // recharge seconds at shield level 1 / 2 / 3
  maxLevel: 3, // shields stack up to this level to shorten the recharge
  hitGrace: 0.6, // brief invuln after a shield absorbs a hit
};

// --- Waves --------------------------------------------------------------
export const WAVE = {
  baseCount: 5, // large asteroids on wave 1
  perWave: 1, // additional asteroids each following wave
  speedScale: 0.08, // spawn-speed increase per wave
  delay: 2.2, // seconds between clearing a wave and the next spawning
  bannerTime: 2.2, // seconds the "WELLE N" banner is shown
  bossEvery: 3, // a boss asteroid appears on every Nth wave
};

// --- Planet (shop landing pad) -----------------------------------------
export const PLANET = {
  radius: 74, // large landing target
  speed: 52, // slow horizontal drift (px/s)
  firstSpawn: 10, // seconds until the first planet appears
  interval: 30, // seconds between planets after one leaves
  landTime: 2.5, // seconds the ship must hold on the planet to land
};

// --- Titan shipyard-defense event (REQ-WERFT-01) -----------------------
// A one-off "level": a planet ringed by an orbital shipyard drifts to the
// centre and is besieged by slow incoming missiles. Intercept enough of them
// (keep the shipyard's damage bar above 0) and the Titan becomes buyable there.
// Afterwards ~1/3 of planets carry a shipyard (the only place to buy the Titan).
export const WERFT = {
  eventWave: 5, // the defense event first appears once this wave is reached
  approachSpeed: 80, // px/s the event planet drifts toward screen centre
  arriveDist: 8, // snap to centre / switch to "defend" within this many px
  shipyardHp: 6, // damage bar: each missile that gets through chips one off
  siegeCount: 10, // missiles launched across the whole defense
  siegeInterval: 1.5, // seconds between missile launches
  siegeFirstDelay: 1.2, // seconds after arrival before the first missile
  siegeSpeed: 62, // slow missile approach speed (px/s)
  siegeRadius: 9, // missile size / hit + intercept radius
  siegeScore: 60, // score for intercepting a missile
  siegeCredits: 45, // credits for intercepting a missile
  spawnChance: 0.34, // ~every third planet carries a shipyard (after the event)
};
