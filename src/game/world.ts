/** Authoritative game state and update loop. REQ-WORLD-01 (+ collisions). */
import { Vec, vec, add, sub, scale, normalize, fromAngle, rotate, distance } from "../engine/vector2.ts";
import { createRng, Rng } from "../engine/random.ts";
import { Ship, ShipInput, createShip, updateShip, grantShield, shieldRechargeDelay } from "./ship.ts";
import { Bullet, createBullet, updateBullet, isExpired } from "./bullet.ts";
import { Asteroid, createAsteroid, updateAsteroid, splitAsteroid } from "./asteroid.ts";
import { Planet, PlanetKind, createPlanet, updatePlanet, isPlanetGone } from "./planet.ts";
import { SiegeMissile, createSiege, updateSiege } from "./siege.ts";
import {
  Enemy,
  createEnemy,
  updateEnemy,
  isEnemyGone,
  pickEnemyKind,
  advanceStationBeam,
} from "./enemy.ts";
import { Loot, createLoot, updateLoot, isLootGone } from "./loot.ts";
import {
  Rocket,
  Targetable,
  createRocket,
  steerRocket,
  updateRocket,
  isRocketGone,
} from "./rocket.ts";
import { Mine, createMine, updateMine, isMineGone } from "./mine.ts";
import { Wingman, createWingman, steerWingman } from "./wingman.ts";
import { Base, createBattleship, updateBase, isBaseDead } from "./base.ts";
import { circleHit, segmentHitsCircle } from "./collision.ts";
import {
  SHIP,
  BULLET,
  ASTEROID,
  AsteroidSize,
  GAME,
  PLANET,
  WAVE,
  ENEMY,
  STATION,
  BASE,
  BATTLESHIPS,
  BattleshipDesign,
  LOOT,
  SHIELD,
  ROCKET,
  MINE,
  SHOP,
  WERFT,
  LootKind,
  SecondaryId,
  WEAPONS,
  AMMO,
  AMMO_ORDER,
  SHIPS,
  TITAN_UPGRADE,
  AUTOCANNON,
  TRACTOR,
  WINGMAN,
  WeaponId,
  AmmoId,
  ShipId,
  UpgradeId,
} from "./constants.ts";

export type GameState = "playing" | "paused" | "shop" | "gameover";

/** Active state of the Titan shipyard-defense event. REQ-WERFT-01. */
export interface WerftEvent {
  phase: "approach" | "defend"; // approach: drifting to centre; defend: under siege
  hp: number; // shipyard damage bar remaining
  hpMax: number;
  toLaunch: number; // missiles still to be launched this defense
  launchTimer: number; // seconds until the next missile launches
}

export interface Input extends ShipInput {
  fire: boolean;
  fireSecondary: boolean; // rockets or mines (whichever is selected)
  aim?: Vec | null; // world-space mouse target for turret ships (null = no pointer)
}

export interface WorldOptions {
  width: number;
  height: number;
  seed?: number;
  asteroids?: number;
  lives?: number;
}

export interface World {
  width: number;
  height: number;
  ship: Ship;
  bullets: Bullet[];
  asteroids: Asteroid[];
  planet: Planet | null; // shop landing pad drifting across, null when none
  planetTimer: number; // seconds until the next planet appears
  werft: WerftEvent | null; // active Titan shipyard-defense event (REQ-WERFT-01)
  werftDone: boolean; // true once the defense has been won (shipyards may now spawn)
  siege: SiegeMissile[]; // in-flight siege missiles attacking the shipyard
  atShipyard: boolean; // the shop currently open was reached at a shipyard planet
  enemies: Enemy[]; // hostile fighters
  enemyBullets: Bullet[]; // projectiles fired by enemies
  enemyTimer: number; // seconds until the next enemy spawns
  bases: Base[]; // modular enemy bases (hex-module clusters)
  loot: Loot[]; // collectible drops
  rockets: Rocket[]; // in-flight homing rockets
  mines: Mine[]; // deployed space mines
  wingmen: Wingman[]; // friendly drones from the hangar upgrade
  wingmanRespawn: number[]; // countdown timers for downed drones waiting to relaunch
  secondary: SecondaryId; // equipped secondary weapon (rocket or mine)
  rocketAmmo: number; // rockets the player can still fire
  mineAmmo: number; // mines the player can still deploy
  secondaryCooldown: number; // seconds until the next rocket/mine can launch
  landProgress: number; // seconds the ship has held on the planet (0..landTime)
  landLock: boolean; // true after a shop visit until the ship leaves the planet
  shopIndex: number; // currently highlighted shop row (UI navigation)
  shopPage: number; // active shop page/category index (UI navigation)
  shopStock: string[]; // ids of random equipment available this shop visit
  wave: number; // current wave number (1-based)
  wavesEnabled: boolean; // auto-spawn next wave when the field is cleared
  waveTimer: number; // seconds counted since the field was cleared
  waveBanner: number; // seconds the "WELLE N" banner is shown (render only)
  score: number;
  credits: number; // spendable currency earned by destroying asteroids
  lives: number;
  state: GameState;
  fireCooldown: number;
  shake: number; // screen-shake energy (render only)
  rng: Rng;
  // --- loadout ---
  weapon: WeaponId; // equipped weapon
  ammo: AmmoId; // equipped ammo type
  ammoCounts: { ap: number; explosive: number }; // remaining special rounds
  ownedWeapons: WeaponId[]; // weapons the player has unlocked/bought
  shipId: ShipId; // equipped ship model
  ownedShips: ShipId[]; // ships the player owns
  shipUpgrades: UpgradeId[]; // installed Titan upgrades (applied while flying the Titan)
  /** Presentation hooks (render layer only, not part of game logic). */
  onExplosion?: (pos: Vec, big: boolean) => void;
  onHit?: (pos: Vec) => void; // asteroid damaged but not destroyed
  onLand?: () => void; // shop opened
  onPickup?: (pos: Vec, kind: LootKind) => void; // loot collected
  onShieldHit?: (pos: Vec) => void; // shield absorbed a hit
}

function spawnAsteroid(world: World, size: AsteroidSize = "large"): Asteroid {
  const rng = world.rng;
  const center = vec(world.width / 2, world.height / 2);
  // keep asteroids off the ship, but stay safe on tiny viewports (bounded retries)
  const minDist = Math.min(180, Math.min(world.width, world.height) * 0.35);
  let pos = vec(rng.range(0, world.width), rng.range(0, world.height));
  for (let tries = 0; tries < 40 && distance(pos, center) < minDist; tries++) {
    pos = vec(rng.range(0, world.width), rng.range(0, world.height));
  }
  const dir = rng.range(0, Math.PI * 2);
  const speedScale = 1 + WAVE.speedScale * (world.wave - 1);
  const base = size === "boss" ? ASTEROID.bossSpeed : rng.range(ASTEROID.minSpeed, ASTEROID.maxSpeed);
  return createAsteroid(pos, fromAngle(dir, base * speedScale), size, rng);
}

/** Number of large asteroids for a given wave. */
function asteroidsForWave(wave: number): number {
  return WAVE.baseCount + (wave - 1) * WAVE.perWave;
}

/** Populate the field for the current wave, adding a boss on boss waves. REQ-WAVE-01, REQ-BOSS-01. */
function spawnWaveAsteroids(world: World): void {
  const n = asteroidsForWave(world.wave);
  for (let i = 0; i < n; i++) world.asteroids.push(spawnAsteroid(world));
  if (world.wave % WAVE.bossEvery === 0) world.asteroids.push(spawnAsteroid(world, "boss"));
}

export function createWorld(opts: WorldOptions): World {
  const world: World = {
    width: opts.width,
    height: opts.height,
    ship: createShip(vec(opts.width / 2, opts.height / 2)),
    bullets: [],
    asteroids: [],
    planet: null,
    planetTimer: PLANET.firstSpawn,
    werft: null,
    werftDone: false,
    siege: [],
    atShipyard: false,
    enemies: [],
    enemyBullets: [],
    enemyTimer: ENEMY.firstSpawn,
    bases: [],
    loot: [],
    rockets: [],
    mines: [],
    wingmen: [],
    wingmanRespawn: [],
    secondary: "rocket",
    rocketAmmo: 0,
    mineAmmo: 0,
    secondaryCooldown: 0,
    landProgress: 0,
    landLock: false,
    shopIndex: 0,
    shopPage: 0,
    shopStock: [],
    wave: 1,
    wavesEnabled: opts.asteroids === undefined,
    waveTimer: 0,
    waveBanner: 0,
    score: 0,
    credits: 0,
    lives: opts.lives ?? GAME.startLives,
    state: "playing",
    fireCooldown: 0,
    shake: 0,
    rng: createRng(opts.seed ?? 1),
    weapon: "laser",
    ammo: "standard",
    ammoCounts: { ap: 0, explosive: 0 },
    ownedWeapons: ["laser"],
    shipId: "vanguard",
    ownedShips: ["vanguard"],
    shipUpgrades: [],
  };
  if (world.wavesEnabled) {
    spawnWaveAsteroids(world); // wave 1
    world.waveBanner = WAVE.bannerTime;
  } else {
    // fixed count for tests / deterministic scenarios
    for (let i = 0; i < (opts.asteroids ?? 0); i++) world.asteroids.push(spawnAsteroid(world));
  }
  return world;
}

/** After the shipyard-defense is won, ~every third planet carries a shipyard. REQ-WERFT-01. */
function nextPlanetKind(world: World): PlanetKind {
  return world.werftDone && world.rng.next() < WERFT.spawnChance ? "shipyard" : "normal";
}

/** Spawn a planet just off one side, drifting horizontally across. REQ-PLANET-01. */
function spawnPlanet(world: World): void {
  const rng = world.rng;
  const fromLeft = rng.next() < 0.5;
  const y = rng.range(world.height * 0.28, world.height * 0.72);
  const r = PLANET.radius;
  const x = fromLeft ? -r : world.width + r;
  const vx = (fromLeft ? 1 : -1) * PLANET.speed;
  const kind = nextPlanetKind(world);
  world.planet = createPlanet(vec(x, y), vec(vx, 0), r, rng, kind);
}

/** Kick off the Titan shipyard-defense: a shipyard planet drifts in from an edge toward centre. REQ-WERFT-01. */
function startWerftEvent(world: World): void {
  const rng = world.rng;
  const fromLeft = rng.next() < 0.5;
  const r = PLANET.radius;
  const y = rng.range(world.height * 0.3, world.height * 0.7);
  const x = fromLeft ? -r : world.width + r;
  world.planet = createPlanet(vec(x, y), vec(0, 0), r, rng, "shipyard");
  world.siege = [];
  world.werft = {
    phase: "approach",
    hp: WERFT.shipyardHp,
    hpMax: WERFT.shipyardHp,
    toLaunch: WERFT.siegeCount,
    launchTimer: WERFT.siegeFirstDelay,
  };
}

/** Spawn one siege missile from a random screen edge, aimed straight at the shipyard planet. */
function launchSiege(world: World, planet: Planet): void {
  const rng = world.rng;
  const side = Math.floor(rng.next() * 4);
  let p: Vec;
  if (side === 0) p = vec(rng.range(0, world.width), -20);
  else if (side === 1) p = vec(world.width + 20, rng.range(0, world.height));
  else if (side === 2) p = vec(rng.range(0, world.width), world.height + 20);
  else p = vec(-20, rng.range(0, world.height));
  const dir = normalize(sub(planet.position, p));
  world.siege.push(createSiege(p, scale(dir, WERFT.siegeSpeed)));
}

/** Advance the shipyard-defense: approach to centre, launch/track missiles, resolve win/loss. REQ-WERFT-01. */
function updateWerftEvent(world: World, dt: number): void {
  const ev = world.werft;
  const planet = world.planet;
  if (!ev || !planet) return;
  planet.angle += planet.spin * dt; // keep the surface turning (render only)

  if (ev.phase === "approach") {
    const center = vec(world.width / 2, world.height / 2);
    const toC = sub(center, planet.position);
    const d = Math.hypot(toC.x, toC.y);
    if (d <= WERFT.arriveDist) {
      planet.position = center;
      planet.velocity = vec(0, 0);
      ev.phase = "defend";
    } else {
      planet.position = add(planet.position, scale(toC, Math.min(1, (WERFT.approachSpeed * dt) / d)));
    }
    return;
  }

  // defend: launch missiles on a timer, move them, detonate those that reach the planet
  if (ev.toLaunch > 0) {
    ev.launchTimer -= dt;
    if (ev.launchTimer <= 0) {
      launchSiege(world, planet);
      ev.toLaunch -= 1;
      ev.launchTimer = WERFT.siegeInterval;
    }
  }
  const survivors: SiegeMissile[] = [];
  for (const m of world.siege) {
    updateSiege(m, dt);
    if (distance(m.position, planet.position) <= planet.radius + m.radius) {
      ev.hp -= 1; // struck the shipyard
      world.shake = Math.max(world.shake, 0.5);
      world.onExplosion?.(m.position, false);
    } else {
      survivors.push(m);
    }
  }
  world.siege = survivors;

  if (ev.hp <= 0) {
    // shipyard overrun — the defense fails and the event re-appears later
    world.onExplosion?.(planet.position, true);
    world.shake = Math.max(world.shake, 0.9);
    world.planet = null;
    world.werft = null;
    world.siege = [];
    world.planetTimer = PLANET.interval;
    return;
  }
  if (ev.toLaunch === 0 && world.siege.length === 0) {
    // defense won — Titan unlocked; hand the shipyard back to the normal drift so it can be landed on
    world.werftDone = true;
    const dir = planet.position.x < world.width / 2 ? 1 : -1;
    planet.velocity = vec(dir * PLANET.speed, 0);
    world.werft = null;
  }
}

/** Drive the active shipyard-defense event, or the normal planet drift/spawn cycle. */
function updatePlanets(world: World, dt: number): void {
  if (world.werft) {
    updateWerftEvent(world, dt);
    return;
  }
  if (world.planet) {
    updatePlanet(world.planet, dt);
    if (isPlanetGone(world.planet, world.width)) {
      world.planet = null;
      world.planetTimer = PLANET.interval;
    }
  } else {
    world.planetTimer -= dt;
    if (world.planetTimer <= 0) {
      if (!world.werftDone && world.wavesEnabled && world.wave >= WERFT.eventWave) startWerftEvent(world);
      else spawnPlanet(world);
    }
  }
}

/** Spawn the next, stronger wave once the field is cleared. REQ-WAVE-01. */
function updateWaves(world: World, dt: number): void {
  if (world.waveBanner > 0) world.waveBanner = Math.max(0, world.waveBanner - dt);
  if (!world.wavesEnabled) return;
  if (world.asteroids.length > 0) {
    world.waveTimer = 0; // wave still in progress
    return;
  }
  world.waveTimer += dt;
  if (world.waveTimer >= WAVE.delay) {
    world.waveTimer = 0;
    world.wave += 1;
    spawnWaveAsteroids(world);
    world.waveBanner = WAVE.bannerTime;
  }
}

/** Landing: hold the ship on the planet to open the shop. REQ-LAND-01. */
function updateLanding(world: World, dt: number): void {
  if (world.werft) {
    world.landProgress = 0; // no landing while the shipyard is still under siege. REQ-WERFT-01
    return;
  }
  const p = world.planet;
  const onPad = p !== null && distance(world.ship.position, p.position) <= p.radius;
  if (!onPad) {
    world.landProgress = 0;
    world.landLock = false; // left the planet -> may land again next time
    return;
  }
  if (world.landLock) return; // already shopped this visit; wait until the ship leaves
  world.landProgress += dt;
  if (world.landProgress >= PLANET.landTime) {
    world.landProgress = 0;
    world.landLock = true;
    world.atShipyard = p.kind === "shipyard"; // shipyard planets sell the Titan. REQ-WERFT-01
    world.state = "shop";
    world.shopIndex = 0;
    world.shopPage = 0;
    rollShopStock(world);
    world.onLand?.();
  }
}

/** Roll which random equipment items are stocked this shop visit. REQ-SHOP-04. */
export function rollShopStock(world: World): void {
  world.shopStock = SHOP.randomEquipment.filter(() => world.rng.next() < SHOP.equipmentChance);
}

/** Leave the shop and resume play with a brief takeoff grace period. */
export function closeShop(world: World): void {
  if (world.state !== "shop") return;
  world.state = "playing";
  world.ship.invuln = Math.max(world.ship.invuln, 1.2);
}

function resetShip(world: World): void {
  world.ship.position = vec(world.width / 2, world.height / 2);
  world.ship.velocity = vec(0, 0);
  world.ship.angle = -Math.PI / 2;
  world.ship.invuln = SHIP.invulnTime;
}

/** The ship can be struck only when not in its invulnerability window. */
function shipVulnerable(world: World): boolean {
  return world.ship.invuln <= 0;
}

/** A hit lands on the ship: the shield absorbs it if charged, else a life is lost. REQ-EQUIP-01. */
function damageShip(world: World): void {
  if (world.ship.shield > 0) {
    world.ship.shield -= 1;
    world.ship.shieldRecharge = shieldRechargeDelay(world.ship);
    world.ship.invuln = SHIELD.hitGrace; // brief grace so one overlap can't drain it all
    world.shake = Math.max(world.shake, 0.4);
    world.onShieldHit?.(world.ship.position);
  } else {
    loseLife(world);
  }
}

/** Apply a hit to the ship: lose a life, reset or end the game. */
function loseLife(world: World): void {
  world.lives -= 1;
  world.shake = 0.8;
  world.onExplosion?.(world.ship.position, true);
  if (world.lives <= 0) {
    world.lives = 0;
    world.state = "gameover";
  } else {
    resetShip(world);
  }
}

const BATTLESHIP_DESIGNS: BattleshipDesign[] = ["dreadnought", "mandible", "fortress"];

/** Spawn a drifting enemy battleship just off one side of the field. REQ-BASE-01. */
function spawnBase(world: World): void {
  const rng = world.rng;
  const design = BATTLESHIP_DESIGNS[Math.floor(rng.next() * BATTLESHIP_DESIGNS.length)];
  const spec = BATTLESHIPS[design];
  const fromLeft = rng.next() < 0.5;
  const y = rng.range(world.height * 0.25, world.height * 0.75);
  const margin = spec.radius + 30;
  const x = fromLeft ? -margin : world.width + margin;
  const vx = (fromLeft ? 1 : -1) * spec.speed;
  const vy = rng.range(-spec.speed * 0.15, spec.speed * 0.15);
  world.bases.push(createBattleship(design, vec(x, y), vec(vx, vy)));
}

// --- Enemies (REQ-ENEMY-01, REQ-ENEMY-02) ------------------------------
/** Chance a station spawn becomes a battleship: small at fromWave, growing with the wave. REQ-BASE-01. */
function baseChanceForWave(wave: number): number {
  if (wave < BASE.fromWave) return 0;
  return Math.min(BASE.maxChance, BASE.chance + (wave - BASE.fromWave) * BASE.chancePerWave);
}

/** How many battleships may be on the field at once — few early, more in later waves. */
function baseCapForWave(wave: number): number {
  return Math.min(3, 1 + Math.floor((wave - BASE.fromWave) / 2));
}

function spawnEnemy(world: World): void {
  const rng = world.rng;
  const kind = pickEnemyKind(world.wave, rng.next());
  // From wave BASE.fromWave, some station spawns become battleships — rare early, more later. REQ-BASE-01.
  if (
    kind === "station" &&
    world.wave >= BASE.fromWave &&
    world.bases.length < baseCapForWave(world.wave) &&
    rng.next() < baseChanceForWave(world.wave)
  ) {
    spawnBase(world);
    return;
  }
  const speed = kind === "station" ? STATION.speed : ENEMY.speed;
  const radius = kind === "station" ? STATION.radius : ENEMY.radius;
  const fromLeft = rng.next() < 0.5;
  const y = rng.range(world.height * 0.2, world.height * 0.8);
  const x = fromLeft ? -radius : world.width + radius;
  const vx = (fromLeft ? 1 : -1) * speed;
  const vy = rng.range(-speed * 0.3, speed * 0.3);
  world.enemies.push(createEnemy(vec(x, y), vec(vx, vy), kind));
}

function fireEnemyBullet(world: World, e: Enemy): void {
  const dir = normalize(sub(world.ship.position, e.position));
  const velocity = scale(dir, ENEMY.bulletSpeed);
  world.enemyBullets.push(
    createBullet(e.position, velocity, ENEMY.bulletLife, ENEMY.bulletRadius, 1),
  );
}

/** A live station beam strikes the ship if it stands on the locked line. REQ-ENEMY-02. */
function fireStationBeam(world: World, e: Enemy): void {
  if (!shipVulnerable(world)) return;
  const end = add(e.position, fromAngle(e.beamAngle, STATION.beamRange));
  const hitRadius = world.ship.radius + STATION.beamWidth;
  if (segmentHitsCircle(e.position, end, world.ship.position, hitRadius)) {
    damageShip(world);
  }
}

function dropLoot(world: World, pos: Vec): void {
  const roll = world.rng.next();
  const shield = LOOT.shieldDropChance;
  const mine = shield + LOOT.mineDropChance;
  const rocket = mine + LOOT.rocketDropChance;
  let kind: LootKind;
  if (roll < shield) {
    kind = "shield"; // rare
  } else if (roll < mine) {
    kind = "mine"; // occasional
  } else if (roll < rocket) {
    kind = "rocket"; // rare (was common)
  } else {
    // the remainder splits evenly between antigrav and ammo (the common drops)
    const r = (roll - rocket) / (1 - rocket);
    kind = r < 0.5 ? "antigrav" : "ammo";
  }
  world.loot.push(createLoot(pos, kind, world.rng));
}

function applyLoot(world: World, kind: LootKind): void {
  if (kind === "shield") {
    grantShield(world.ship);
  } else if (kind === "antigrav") {
    world.ship.antigrav = LOOT.antigravTime;
  } else if (kind === "rocket") {
    world.rocketAmmo += ROCKET.lootGrant;
  } else if (kind === "mine") {
    world.mineAmmo += MINE.lootGrant;
  } else {
    world.ammoCounts.ap += LOOT.ammoGrant;
    world.ammoCounts.explosive += LOOT.ammoGrant;
    // If still on plain standard rounds, start using the special ammo just picked up.
    if (world.ammo === "standard") world.ammo = "ap";
  }
  world.onPickup?.(world.ship.position, kind);
}

function updateEnemies(world: World, dt: number): void {
  // spawn (gated to wave mode so fixed-asteroid test worlds stay quiet)
  if (world.wavesEnabled) {
    world.enemyTimer -= dt;
    if (world.enemyTimer <= 0 && world.enemies.length < ENEMY.maxAlive) {
      spawnEnemy(world);
      // From wave 2 on, a spawn can bring a wingman so two attack at once. REQ-ENEMY-01.
      if (
        world.wave >= ENEMY.pairFromWave &&
        world.enemies.length < ENEMY.maxAlive &&
        world.rng.next() < ENEMY.pairChance
      ) {
        spawnEnemy(world);
      }
      world.enemyTimer = ENEMY.interval;
    }
  }
  // move + fire: fighters shoot aimed bolts, stations sweep a charging beam
  for (const e of world.enemies) {
    updateEnemy(e, dt, world);
    if (e.kind === "fighter") {
      e.fireTimer -= dt;
      if (e.fireTimer <= 0) {
        fireEnemyBullet(world, e);
        e.fireTimer = ENEMY.fireCooldown;
      }
    } else if (e.kind === "station") {
      const aim = Math.atan2(
        world.ship.position.y - e.position.y,
        world.ship.position.x - e.position.x,
      );
      const live = advanceStationBeam(e, dt, aim);
      if (live) fireStationBeam(world, e);
    }
  }
  world.enemies = world.enemies.filter((e) => !isEnemyGone(e));

  // enemy projectiles move / wrap / expire
  for (const b of world.enemyBullets) updateBullet(b, dt, world);
  world.enemyBullets = world.enemyBullets.filter((b) => !isExpired(b));
}

/** Antigrav field pushes nearby asteroids away from the ship. REQ-LOOT-01. */
function applyAntigrav(world: World, dt: number): void {
  if (world.ship.antigrav <= 0) return;
  for (const a of world.asteroids) {
    const d = distance(a.position, world.ship.position);
    if (d > 0 && d < LOOT.antigravRadius) {
      const push = scale(normalize(sub(a.position, world.ship.position)), LOOT.antigravForce * dt);
      a.velocity = add(a.velocity, push);
    }
  }
}

// --- Rockets (REQ-ROCKET-01) -------------------------------------------
/** Nearest enemy/asteroid inside a forward cone from `from` along `heading`. */
function acquireTarget(
  world: World,
  from: Vec,
  heading: number,
  coneHalf: number,
): Targetable | null {
  const hx = Math.cos(heading);
  const hy = Math.sin(heading);
  const minDot = Math.cos(coneHalf);
  let best: Targetable | null = null;
  let bestDist = Infinity;
  const candidates: Targetable[] = [...world.enemies, ...world.asteroids];
  for (const t of candidates) {
    const dx = t.position.x - from.x;
    const dy = t.position.y - from.y;
    const d = Math.hypot(dx, dy);
    if (d < 1) continue;
    if ((dx / d) * hx + (dy / d) * hy < minDot) continue; // not in front
    if (d < bestDist) {
      bestDist = d;
      best = t;
    }
  }
  return best;
}

/** Whether a locked target is still present in the world. */
function isTargetAlive(world: World, t: Targetable): boolean {
  for (const e of world.enemies) if (e === t) return true;
  for (const a of world.asteroids) if (a === t) return true;
  return false;
}

function updateRockets(world: World, dt: number): void {
  for (const r of world.rockets) {
    if (r.target && !isTargetAlive(world, r.target)) r.target = null;
    if (!r.target) {
      const heading = Math.atan2(r.velocity.y, r.velocity.x);
      r.target = acquireTarget(world, r.position, heading, ROCKET.acquireCone);
    }
    if (r.target) steerRocket(r, r.target.position, dt);
    updateRocket(r, dt, world);
  }
  world.rockets = world.rockets.filter((r) => !isRocketGone(r));
}

/** Lay a small minefield behind the ship, consuming mine ammo. REQ-MINE-01. */
function dropMines(world: World): void {
  const rng = world.rng;
  const back = add(world.ship.position, fromAngle(world.ship.angle, -MINE.backDist));
  const count = Math.min(MINE.clusterSize, world.mineAmmo);
  for (let i = 0; i < count; i++) {
    const pos = add(back, vec(rng.range(-MINE.spread, MINE.spread), rng.range(-MINE.spread, MINE.spread)));
    const vel = fromAngle(rng.range(0, Math.PI * 2), rng.range(0, MINE.drift));
    world.mines.push(createMine(pos, vel));
  }
  world.mineAmmo -= count;
}

function updateMines(world: World, dt: number): void {
  for (const m of world.mines) updateMine(m, dt, world);
  world.mines = world.mines.filter((m) => !isMineGone(m));
}

/** Apply damage to an asteroid; on death score it, split it and drop boss loot. */
function hitAsteroid(
  world: World,
  a: Asteroid,
  dmg: number,
  fragments: Asteroid[],
  deadAsteroids: Set<Asteroid>,
): void {
  a.hp -= dmg;
  if (a.hp <= 0) {
    deadAsteroids.add(a);
    const spec = ASTEROID.sizes[a.size];
    world.score += spec.score;
    world.credits += spec.credits; // REQ-ECON-01 (credits << score: kills pay better)
    const big = a.size === "large" || a.size === "boss";
    world.shake = Math.max(world.shake, a.size === "boss" ? 0.8 : big ? 0.45 : 0.3);
    world.onExplosion?.(a.position, big);
    fragments.push(...splitAsteroid(a, world.rng));
    if (a.size === "boss") dropLoot(world, a.position); // REQ-BOSS-01
  } else {
    world.shake = Math.max(world.shake, 0.12);
    world.onHit?.(a.position);
  }
}

/** Apply damage to an enemy; on death score it and drop loot. */
function hitEnemy(world: World, e: Enemy, dmg: number, deadEnemies: Set<Enemy>): void {
  e.hp -= dmg;
  if (e.hp <= 0) {
    deadEnemies.add(e);
    world.score += e.score;
    world.credits += e.credits;
    world.shake = Math.max(world.shake, 0.4);
    world.onExplosion?.(e.position, true);
    dropLoot(world, e.position);
  } else {
    world.onHit?.(e.position);
  }
}

// --- Enemy battleships (REQ-BASE-01) -----------------------------------
/** Apply a hit to a battleship: its shield absorbs it if charged, else its health bar drops. */
function damageBase(world: World, base: Base, dmg: number): void {
  if (base.shield > 0) {
    base.shield -= 1;
    base.shieldRecharge = BASE.shieldRechargeDelay;
    world.shake = Math.max(world.shake, 0.15);
    world.onShieldHit?.(base.position); // blue shield spark
    return;
  }
  base.hp -= dmg;
  world.shake = Math.max(world.shake, base.hp <= 0 ? 0.4 : 0.12);
  world.onHit?.(base.position); // death explosion + reward handled in retireDeadBases
}

/**
 * Apply a projectile to enemy battleships. Direct rounds strike the first hull hit and are
 * consumed; explosive rounds (blast>0) damage every hull in range. Returns true if it struck.
 */
function hitBases(world: World, pos: Vec, radius: number, blast: number, damage: number): boolean {
  let struck = false;
  for (const base of world.bases) {
    if (base.hp <= 0) continue;
    if (blast > 0) {
      if (distance(pos, base.position) <= blast + base.radius) {
        damageBase(world, base, damage);
        struck = true;
      }
    } else if (circleHit(pos, radius, base.position, base.radius)) {
      damageBase(world, base, damage);
      return true; // direct hit: consumed by this hull
    }
  }
  return struck;
}

/** Fire the battleship's main gun at the ship: a fan (spread) or parallel barrels. REQ-BASE-03. */
function fireBattleshipGun(world: World, base: Base): void {
  const spec = BATTLESHIPS[base.design];
  const dir = normalize(sub(world.ship.position, base.position));
  const aim = Math.atan2(dir.y, dir.x);
  const perp = vec(-dir.y, dir.x); // lateral for parallel barrels
  for (let i = 0; i < spec.pellets; i++) {
    let angle = aim;
    let origin = base.position;
    if (spec.spread > 0 && spec.pellets > 1) {
      angle = aim + (i / (spec.pellets - 1) - 0.5) * spec.spread; // fan
    } else if (spec.muzzleGap > 0) {
      const off = (i - (spec.pellets - 1) / 2) * spec.muzzleGap; // symmetric parallel muzzles
      origin = add(base.position, scale(perp, off));
    }
    const velocity = fromAngle(angle, spec.bulletSpeed);
    world.enemyBullets.push(
      createBullet(origin, velocity, spec.bulletLife, spec.bulletRadius, spec.bulletDamage),
    );
  }
}

/** Tick a battleship's weapons: main gun volleys + (fortress) capped fighter launches. REQ-BASE-03, REQ-BASE-04. */
function updateBaseWeapons(world: World, base: Base, dt: number): void {
  const spec = BATTLESHIPS[base.design];
  const inRange = distance(world.ship.position, base.position) <= spec.range;
  base.fireTimer -= dt;
  if (base.fireTimer <= 0) {
    base.fireTimer = spec.fireCooldown;
    if (inRange) fireBattleshipGun(world, base);
  }
  if (spec.hangar) {
    base.hangarTimer -= dt;
    if (base.hangarTimer <= 0) {
      base.hangarTimer = spec.hangarCooldown;
      if (world.enemies.length < spec.hangarMaxFighters) {
        const dir = normalize(sub(world.ship.position, base.position));
        world.enemies.push(createEnemy(base.position, scale(dir, spec.hangarLaunchSpeed), "fighter"));
      }
    }
  }
}

/** Drift battleships, let them fire, and drop those that have drifted off (no reward). */
function updateBases(world: World, dt: number): void {
  for (const base of world.bases) {
    updateBase(base, dt, world);
    updateBaseWeapons(world, base, dt);
  }
  world.bases = world.bases.filter((base) => base.life > 0);
}

/** Retire destroyed battleships with a big explosion, reward + loot (called after projectile hits). */
function retireDeadBases(world: World): void {
  const survivors: Base[] = [];
  for (const base of world.bases) {
    if (isBaseDead(base)) {
      const spec = BATTLESHIPS[base.design];
      world.score += spec.score;
      world.credits += spec.credits;
      world.shake = Math.max(world.shake, 0.7);
      world.onExplosion?.(base.position, true);
      dropLoot(world, base.position); // REQ-BASE-01
    } else {
      survivors.push(base);
    }
  }
  world.bases = survivors;
}

/** Player projectiles (bullets/rockets/mines) knock down incoming siege missiles. REQ-WERFT-01. */
function interceptSiege(
  world: World,
  deadBullets: Set<Bullet>,
  deadRockets: Set<Rocket>,
  deadMines: Set<Mine>,
): void {
  if (world.siege.length === 0) return;
  const downed = new Set<SiegeMissile>();
  const tryHit = (pos: Vec, radius: number): boolean => {
    for (const m of world.siege) {
      if (downed.has(m)) continue;
      if (circleHit(pos, radius, m.position, m.radius)) {
        downed.add(m);
        return true;
      }
    }
    return false;
  };
  for (const b of world.bullets) {
    if (!deadBullets.has(b) && tryHit(b.position, b.radius)) deadBullets.add(b);
  }
  for (const r of world.rockets) {
    if (!deadRockets.has(r) && tryHit(r.position, r.radius)) deadRockets.add(r);
  }
  for (const m of world.mines) {
    if (!deadMines.has(m) && tryHit(m.position, m.radius)) deadMines.add(m);
  }
  if (downed.size) {
    for (const m of downed) {
      world.score += WERFT.siegeScore;
      world.credits += WERFT.siegeCredits;
      world.onExplosion?.(m.position, false);
    }
    world.siege = world.siege.filter((m) => !downed.has(m));
  }
}

/** Equip a weapon the player owns (ignored otherwise). */
export function equipWeapon(world: World, id: WeaponId): void {
  if (world.ownedWeapons.includes(id)) world.weapon = id;
}

/** Select the ammo type to load (special types fall back to standard when empty). */
export function equipAmmo(world: World, id: AmmoId): void {
  world.ammo = id;
}

/** Switch to the next owned weapon, wrapping around. REQ-INPUT-01. */
export function cycleWeapon(world: World): void {
  const owned = world.ownedWeapons;
  if (owned.length === 0) return;
  const i = owned.indexOf(world.weapon); // -1 -> starts at the first owned weapon
  world.weapon = owned[(i + 1) % owned.length];
}

/** Switch to the next ammo type, wrapping around. REQ-INPUT-01. */
export function cycleAmmo(world: World): void {
  const i = AMMO_ORDER.indexOf(world.ammo);
  world.ammo = AMMO_ORDER[(i + 1) % AMMO_ORDER.length];
}

/** Toggle the secondary weapon between rockets and mines. REQ-MINE-01. */
export function cycleSecondary(world: World): void {
  world.secondary = world.secondary === "rocket" ? "mine" : "rocket";
}

/** Equip an owned ship, applying its flight stats + installed upgrades in place. REQ-SHIP-03, REQ-SHIP-04, REQ-SHIP-05. */
export function equipShip(world: World, id: ShipId): void {
  if (!world.ownedShips.includes(id)) return;
  const spec = SHIPS[id];
  world.shipId = id;
  world.ship.shipId = id;
  world.ship.radius = spec.radius;
  world.ship.turnSpeed = spec.turnSpeed;
  world.ship.thrust = spec.thrust;
  world.ship.maxSpeed = spec.maxSpeed;
  world.ship.turrets = (spec.turrets ?? []).map((t) => ({ ...t }));
  world.ship.hasAutocannon = id === "titan" && world.shipUpgrades.includes("autocannon");

  if (id === "titan") {
    // Titan upgrades layer onto the base stats (recomputed from scratch each equip).
    if (world.shipUpgrades.includes("engines")) {
      world.ship.thrust += TITAN_UPGRADE.engineThrust;
      world.ship.maxSpeed += TITAN_UPGRADE.engineMaxSpeed;
      world.ship.turnSpeed += TITAN_UPGRADE.engineTurn;
    }
    // the Titan's shield is its own subsystem — set it authoritatively (comes charged)
    let cap = spec.shieldCapacity ?? 0;
    if (world.shipUpgrades.includes("shieldGen")) cap += TITAN_UPGRADE.shieldGenBonus;
    world.ship.shieldMax = cap;
    world.ship.shield = cap;
    world.ship.shieldRecharge = shieldRechargeDelay(world.ship);
  } else {
    // other ships: built-in shields only ever upgrade the hull's shield, never downgrade it
    const cap = spec.shieldCapacity ?? 0;
    if (cap > world.ship.shieldMax) {
      world.ship.shieldMax = cap;
      world.ship.shield = cap;
      world.ship.shieldRecharge = shieldRechargeDelay(world.ship);
    }
  }
}

/** Install a Titan upgrade and re-apply it if the Titan is currently flown. REQ-SHIP-05. */
export function installShipUpgrade(world: World, id: UpgradeId): void {
  if (!world.shipUpgrades.includes(id)) world.shipUpgrades.push(id);
  if (world.shipId === "titan") equipShip(world, "titan");
}

/** Muzzle positions for a shot: each turret's barrel tip, or the single nose cannon. */
function fireMuzzles(ship: Ship): Vec[] {
  if (ship.turrets.length === 0) {
    return [add(ship.position, fromAngle(ship.angle, ship.radius))]; // nose
  }
  // Turret bases sit on the (slowly turning) hull; barrels swivel to the aim direction.
  return ship.turrets.map((t) => {
    const base = add(ship.position, rotate(vec(t.x, t.y), ship.angle));
    return add(base, fromAngle(ship.aimAngle, t.barrel));
  });
}

/** Fire the equipped weapon, applying the loaded ammo modifiers. REQ-WEAPON-01, REQ-AMMO-01, REQ-SHIP-04. */
function fireWeapon(world: World): void {
  const spec = WEAPONS[world.weapon];

  // Resolve ammo once per volley: special rounds are consumed; fall back to standard when empty.
  let ammoId: AmmoId = world.ammo;
  if (ammoId !== "standard") {
    if (world.ammoCounts[ammoId] > 0) world.ammoCounts[ammoId] -= 1;
    else ammoId = "standard";
  }
  const ammo = AMMO[ammoId];
  const damage = spec.damage * ammo.damageMult;
  const radius = BULLET.radius * ammo.radiusMult;
  const blast = ammo.blast; // explosive rounds detonate on proximity

  const dir = world.ship.aimAngle; // turret ships track the mouse; others = nose angle
  for (const muzzle of fireMuzzles(world.ship)) {
    for (let i = 0; i < spec.pellets; i++) {
      let offset = 0;
      if (spec.pellets > 1) {
        // multi-pellet: spread evenly across the arc, plus a little jitter
        offset = (i / (spec.pellets - 1) - 0.5) * spec.spread + world.rng.range(-0.06, 0.06);
      } else if (spec.spread > 0) {
        // single pellet: random deflection within the spread cone (Vulkan MK)
        offset = world.rng.range(-spec.spread / 2, spec.spread / 2);
      }
      const velocity = fromAngle(dir + offset, spec.bulletSpeed);
      world.bullets.push(createBullet(muzzle, velocity, spec.bulletLife, radius, damage, blast));
    }
  }
  world.fireCooldown = spec.cooldown;
}

/** Nearest enemy/asteroid within `range` of `from` (any direction), or null. */
function nearestTargetInRange(world: World, from: Vec, range: number): Targetable | null {
  let best: Targetable | null = null;
  let bestDist = range;
  for (const t of [...world.enemies, ...world.asteroids]) {
    const d = distance(t.position, from);
    if (d < bestDist) {
      bestDist = d;
      best = t;
    }
  }
  return best;
}

/** Autocannon upgrade: an extra turret that auto-aims at the nearest target and fires. REQ-SHIP-05. */
function updateAutocannon(world: World, dt: number): void {
  const ship = world.ship;
  if (!ship.hasAutocannon) return;
  if (ship.autoCooldown > 0) ship.autoCooldown -= dt;
  const base = add(ship.position, rotate(vec(AUTOCANNON.mount.x, AUTOCANNON.mount.y), ship.angle));
  const target = nearestTargetInRange(world, base, AUTOCANNON.range);
  if (!target) return; // hold fire and keep the last aim
  ship.autoAimAngle = Math.atan2(target.position.y - base.y, target.position.x - base.x);
  if (ship.autoCooldown <= 0) {
    const muzzle = add(base, fromAngle(ship.autoAimAngle, AUTOCANNON.mount.barrel));
    const velocity = fromAngle(ship.autoAimAngle, AUTOCANNON.bulletSpeed);
    world.bullets.push(
      createBullet(muzzle, velocity, AUTOCANNON.bulletLife, BULLET.radius, AUTOCANNON.damage),
    );
    ship.autoCooldown = AUTOCANNON.cooldown;
  }
}

/** Tractor upgrade: reel small asteroids in, shatter them for bonus credits, and pull loot. REQ-SHIP-05. */
function updateTractor(world: World): void {
  if (world.shipId !== "titan" || !world.shipUpgrades.includes("tractor")) return;
  const ship = world.ship;

  // Reel in nearby small asteroids; shatter (absorb) the ones that reach the hull.
  const absorbed = new Set<Asteroid>();
  for (const a of world.asteroids) {
    if (a.size !== "small") continue; // only small chunks
    const d = distance(a.position, ship.position);
    if (d > TRACTOR.range) continue;
    if (d <= ship.radius + a.radius + TRACTOR.grabMargin) {
      absorbed.add(a);
    } else {
      a.velocity = scale(normalize(sub(ship.position, a.position)), TRACTOR.pullSpeed); // override drift
    }
  }
  if (absorbed.size) {
    for (const a of absorbed) {
      const spec = ASTEROID.sizes[a.size];
      world.score += spec.score;
      world.credits += spec.credits * TRACTOR.absorbCreditMult; // lucrative mining
      world.onExplosion?.(a.position, false);
    }
    world.asteroids = world.asteroids.filter((a) => !absorbed.has(a));
  }

  // Pull nearby loot toward the ship (existing fly-over pickup then collects it).
  for (const l of world.loot) {
    if (distance(l.position, ship.position) <= TRACTOR.range) {
      l.velocity = scale(normalize(sub(ship.position, l.position)), TRACTOR.lootPullSpeed);
    }
  }
}

/** Hangar upgrade: keep friendly wingmen in formation and let them auto-fire. REQ-SHIP-05. */
/** Nearest hostile enemy within `range` of `from` (wingmen ignore asteroids). REQ-SHIP-05. */
function nearestEnemyInRange(world: World, from: Vec, range: number): Enemy | null {
  let best: Enemy | null = null;
  let bestDist = range;
  for (const e of world.enemies) {
    const d = distance(e.position, from);
    if (d < bestDist) {
      bestDist = d;
      best = e;
    }
  }
  return best;
}

/** First formation slot (0..count-1) not currently taken by a live wingman, or -1. */
function firstFreeWingmanSlot(world: World): number {
  const used = new Set(world.wingmen.map((wm) => wm.slot));
  for (let s = 0; s < WINGMAN.count; s++) if (!used.has(s)) return s;
  return -1;
}

/** Hangar wingmen: fly formation, break off toward enemies, fire only at enemies, respawn if downed. REQ-SHIP-05. */
function updateWingmen(world: World, dt: number): void {
  const active = world.shipId === "titan" && world.shipUpgrades.includes("hangar");
  if (!active) {
    if (world.wingmen.length) world.wingmen = [];
    if (world.wingmanRespawn.length) world.wingmanRespawn = [];
    return;
  }

  // Tick respawn timers; relaunch a drone into a free slot when its timer elapses.
  if (world.wingmanRespawn.length) {
    const ready = world.wingmanRespawn.filter((t) => t - dt <= 0).length;
    world.wingmanRespawn = world.wingmanRespawn.map((t) => t - dt).filter((t) => t > 0);
    for (let k = 0; k < ready; k++) {
      const slot = firstFreeWingmanSlot(world);
      if (slot < 0) break;
      world.wingmen.push(createWingman(slot, world.ship.position));
    }
  }
  // Initial launch (right after install): fill remaining capacity immediately.
  while (world.wingmen.length + world.wingmanRespawn.length < WINGMAN.count) {
    const slot = firstFreeWingmanSlot(world);
    if (slot < 0) break;
    world.wingmen.push(createWingman(slot, world.ship.position));
  }

  const ship = world.ship;
  // A single shared target so both drones converge on (and flank) the same threat.
  const enemy = nearestEnemyInRange(world, ship.position, WINGMAN.range);
  for (const wm of world.wingmen) {
    if (wm.fireTimer > 0) wm.fireTimer -= dt;
    let target: Vec;
    if (enemy) {
      // break formation and advance a bit toward the enemy, flanking it
      const dir = normalize(sub(enemy.position, ship.position));
      const perp = vec(-dir.y, dir.x);
      const dist = distance(enemy.position, ship.position);
      const lead = Math.max(0, Math.min(dist - enemy.radius - 20, WINGMAN.engageDist));
      const lateral = wm.slot === 0 ? -WINGMAN.engageSpread : WINGMAN.engageSpread;
      target = add(add(ship.position, scale(dir, lead)), scale(perp, lateral));
      wm.angle = Math.atan2(enemy.position.y - wm.position.y, enemy.position.x - wm.position.x);
      if (wm.fireTimer <= 0) {
        const velocity = fromAngle(wm.angle, WINGMAN.bulletSpeed);
        world.bullets.push(
          createBullet(wm.position, velocity, WINGMAN.bulletLife, BULLET.radius, WINGMAN.damage),
        );
        wm.fireTimer = WINGMAN.cooldown;
      }
    } else {
      const slot = WINGMAN.offsets[wm.slot] ?? { x: 0, y: 0 };
      target = add(ship.position, rotate(vec(slot.x, slot.y), ship.angle));
      wm.angle = ship.angle; // idle: face the same way as the ship
    }
    steerWingman(wm, target, dt);
  }
}

export function updateWorld(world: World, input: Input, dt: number): void {
  if (world.shake > 0) world.shake = Math.max(0, world.shake - dt * 2);
  if (world.state !== "playing") return; // paused while in shop or after game over

  // Ship
  updateShip(world.ship, input, dt, world);

  // Aim: turret ships point their guns at the mouse; others fire along the nose. REQ-SHIP-04.
  if (world.ship.turrets.length > 0 && input.aim) {
    world.ship.aimAngle = Math.atan2(
      input.aim.y - world.ship.position.y,
      input.aim.x - world.ship.position.x,
    );
  } else {
    world.ship.aimAngle = world.ship.angle;
  }

  // Firing (REQ-BULLET-01, REQ-WEAPON-01, REQ-AMMO-01)
  world.fireCooldown -= dt;
  if (input.fire && world.fireCooldown <= 0) fireWeapon(world);

  // Secondary weapon: rockets or mines (REQ-ROCKET-01, REQ-MINE-01)
  world.secondaryCooldown -= dt;
  if (input.fireSecondary && world.secondaryCooldown <= 0) {
    if (world.secondary === "rocket" && world.rocketAmmo > 0) {
      const nose = add(world.ship.position, fromAngle(world.ship.angle, world.ship.radius));
      const target = acquireTarget(world, nose, world.ship.angle, ROCKET.acquireCone);
      world.rockets.push(createRocket(nose, world.ship.angle, target));
      world.rocketAmmo -= 1;
      world.secondaryCooldown = ROCKET.cooldown;
    } else if (world.secondary === "mine" && world.mineAmmo > 0) {
      dropMines(world);
      world.secondaryCooldown = MINE.cooldown;
    }
  }

  // Autocannon upgrade fires on its own at nearby targets (REQ-SHIP-05)
  updateAutocannon(world, dt);

  // Hangar wingmen fly in formation and auto-fire (REQ-SHIP-05)
  updateWingmen(world, dt);

  // Bullets: move, wrap, expire (REQ-BULLET-02)
  for (const b of world.bullets) updateBullet(b, dt, world);
  world.bullets = world.bullets.filter((b) => !isExpired(b));

  // Planet drift/spawn + Titan shipyard-defense event (REQ-PLANET-01, REQ-WERFT-01)
  updatePlanets(world, dt);

  // Landing on the planet opens the shop (REQ-LAND-01)
  updateLanding(world, dt);

  // Next wave once the field is cleared (REQ-WAVE-01)
  updateWaves(world, dt);

  // Antigrav field deflects nearby asteroids before they move (REQ-LOOT-01)
  applyAntigrav(world, dt);

  // Tractor upgrade reels in small asteroids + loot before they move (REQ-SHIP-05)
  updateTractor(world);

  // Asteroids (REQ-AST-01)
  for (const a of world.asteroids) updateAsteroid(a, dt, world);

  // Enemies + their projectiles (REQ-ENEMY-01)
  updateEnemies(world, dt);

  // Modular bases drift + retire (REQ-BASE-01)
  updateBases(world, dt);

  // Homing rockets steer + move (REQ-ROCKET-01)
  updateRockets(world, dt);

  // Space mines drift + expire (REQ-MINE-01)
  updateMines(world, dt);

  // Loot drifts, wraps and expires (REQ-LOOT-01)
  for (const l of world.loot) updateLoot(l, dt, world);
  world.loot = world.loot.filter((l) => !isLootGone(l));

  // Player projectiles -> asteroids / enemies (REQ-COL-02, REQ-AST-02, REQ-ENEMY-01, REQ-ROCKET-01)
  const deadBullets = new Set<Bullet>();
  const deadAsteroids = new Set<Asteroid>();
  const deadEnemies = new Set<Enemy>();
  const deadRockets = new Set<Rocket>();
  const deadMines = new Set<Mine>();
  const fragments: Asteroid[] = [];

  for (const b of world.bullets) {
    // Explosive rounds: detonate when they get close to a target and damage everything in the blast.
    if (b.blast > 0) {
      const R = b.blast;
      const near = (pos: Vec, radius: number): boolean => distance(b.position, pos) <= R + radius;
      let triggered = world.asteroids.some((a) => !deadAsteroids.has(a) && near(a.position, a.radius));
      if (!triggered)
        triggered = world.enemies.some((e) => !deadEnemies.has(e) && near(e.position, e.radius));
      if (triggered) {
        deadBullets.add(b);
        world.onExplosion?.(b.position, false); // small blast fx
        for (const a of world.asteroids)
          if (!deadAsteroids.has(a) && near(a.position, a.radius))
            hitAsteroid(world, a, b.damage, fragments, deadAsteroids);
        for (const e of world.enemies)
          if (!deadEnemies.has(e) && near(e.position, e.radius))
            hitEnemy(world, e, b.damage, deadEnemies);
      }
      continue;
    }

    let hit = false;
    for (const a of world.asteroids) {
      if (deadAsteroids.has(a)) continue;
      if (circleHit(b.position, b.radius, a.position, a.radius)) {
        deadBullets.add(b);
        hitAsteroid(world, a, b.damage, fragments, deadAsteroids);
        hit = true;
        break;
      }
    }
    if (hit) continue;
    for (const e of world.enemies) {
      if (deadEnemies.has(e)) continue;
      if (circleHit(b.position, b.radius, e.position, e.radius)) {
        deadBullets.add(b);
        hitEnemy(world, e, b.damage, deadEnemies);
        break;
      }
    }
  }

  // Rockets deal heavy damage and are consumed on impact (REQ-ROCKET-01)
  for (const r of world.rockets) {
    let hit = false;
    for (const a of world.asteroids) {
      if (deadAsteroids.has(a)) continue;
      if (circleHit(r.position, r.radius, a.position, a.radius)) {
        deadRockets.add(r);
        hitAsteroid(world, a, r.damage, fragments, deadAsteroids);
        hit = true;
        break;
      }
    }
    if (hit) continue;
    for (const e of world.enemies) {
      if (deadEnemies.has(e)) continue;
      if (circleHit(r.position, r.radius, e.position, e.radius)) {
        deadRockets.add(r);
        hitEnemy(world, e, r.damage, deadEnemies);
        break;
      }
    }
  }

  // Mines detonate on contact with an asteroid or enemy (REQ-MINE-01)
  for (const m of world.mines) {
    let hit = false;
    for (const a of world.asteroids) {
      if (deadAsteroids.has(a)) continue;
      if (circleHit(m.position, m.radius, a.position, a.radius)) {
        deadMines.add(m);
        hitAsteroid(world, a, m.damage, fragments, deadAsteroids);
        hit = true;
        break;
      }
    }
    if (hit) continue;
    for (const e of world.enemies) {
      if (deadEnemies.has(e)) continue;
      if (circleHit(m.position, m.radius, e.position, e.radius)) {
        deadMines.add(m);
        hitEnemy(world, e, m.damage, deadEnemies);
        break;
      }
    }
  }

  // Player projectiles -> base modules (REQ-BASE-01)
  for (const b of world.bullets) {
    if (deadBullets.has(b)) continue;
    if (hitBases(world, b.position, b.radius, b.blast, b.damage)) deadBullets.add(b);
  }
  for (const r of world.rockets) {
    if (deadRockets.has(r)) continue;
    if (hitBases(world, r.position, r.radius, 0, r.damage)) deadRockets.add(r);
  }
  for (const m of world.mines) {
    if (deadMines.has(m)) continue;
    if (hitBases(world, m.position, m.radius, 0, m.damage)) deadMines.add(m);
  }

  // Player projectiles intercept incoming siege missiles (REQ-WERFT-01)
  interceptSiege(world, deadBullets, deadRockets, deadMines);

  if (deadBullets.size) world.bullets = world.bullets.filter((b) => !deadBullets.has(b));
  if (deadRockets.size) world.rockets = world.rockets.filter((r) => !deadRockets.has(r));
  if (deadMines.size) world.mines = world.mines.filter((m) => !deadMines.has(m));
  if (deadAsteroids.size) world.asteroids = world.asteroids.filter((a) => !deadAsteroids.has(a));
  if (deadEnemies.size) world.enemies = world.enemies.filter((e) => !deadEnemies.has(e));
  if (fragments.length) world.asteroids.push(...fragments);
  retireDeadBases(world); // destroyed bases explode + drop loot

  // Ship picks up loot by flying over it (REQ-LOOT-01)
  if (world.loot.length) {
    const picked = new Set<Loot>();
    for (const l of world.loot) {
      if (circleHit(world.ship.position, world.ship.radius, l.position, l.radius)) {
        applyLoot(world, l.kind);
        picked.add(l);
      }
    }
    if (picked.size) world.loot = world.loot.filter((l) => !picked.has(l));
  }

  const deadEnemyBullets = new Set<Bullet>();

  // Enemy bullets can shoot down wingmen; downed drones respawn after a delay (REQ-SHIP-05)
  if (world.wingmen.length) {
    const downed = new Set<Wingman>();
    for (const b of world.enemyBullets) {
      for (const wm of world.wingmen) {
        if (downed.has(wm)) continue;
        if (circleHit(wm.position, WINGMAN.radius, b.position, b.radius)) {
          deadEnemyBullets.add(b);
          downed.add(wm);
          break;
        }
      }
    }
    if (downed.size) {
      for (const wm of downed) {
        world.onExplosion?.(wm.position, false);
        world.wingmanRespawn.push(WINGMAN.respawn);
      }
      world.wingmen = world.wingmen.filter((wm) => !downed.has(wm));
    }
  }

  // Enemy bullet -> ship (REQ-ENEMY-01, shield via REQ-EQUIP-01)
  for (const b of world.enemyBullets) {
    if (deadEnemyBullets.has(b)) continue;
    if (circleHit(world.ship.position, world.ship.radius, b.position, b.radius)) {
      deadEnemyBullets.add(b);
      if (shipVulnerable(world)) {
        damageShip(world);
        break;
      }
    }
  }
  if (deadEnemyBullets.size)
    world.enemyBullets = world.enemyBullets.filter((b) => !deadEnemyBullets.has(b));

  // Ship -> asteroid (REQ-COL-03, shield via REQ-EQUIP-01)
  if (shipVulnerable(world)) {
    for (const a of world.asteroids) {
      if (circleHit(world.ship.position, world.ship.radius, a.position, a.radius)) {
        damageShip(world);
        break;
      }
    }
  }
}
