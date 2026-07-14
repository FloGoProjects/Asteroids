import { describe, it, expect } from "vitest";
import {
  createWorld,
  updateWorld,
  equipWeapon,
  equipAmmo,
  equipShip,
  closeShop,
  rollShopStock,
  cycleWeapon,
  cycleAmmo,
  rollRewardChoices,
  applyReward,
  chooseReward,
} from "../src/game/world.ts";
import { createAsteroid } from "../src/game/asteroid.ts";
import { createPlanet } from "../src/game/planet.ts";
import { createEnemy } from "../src/game/enemy.ts";
import { createLoot } from "../src/game/loot.ts";
import { createBullet } from "../src/game/bullet.ts";
import { createBattleship, createEliteBattleship } from "../src/game/base.ts";
import { createSiege } from "../src/game/siege.ts";
import { createCrate } from "../src/game/crate.ts";
import { createFreighter } from "../src/game/convoy.ts";
import { vec, length } from "../src/engine/vector2.ts";
import {
  SHIP,
  BULLET,
  ASTEROID,
  PLANET,
  WEAPONS,
  AMMO,
  SHIPS,
  WAVE,
  ENEMY,
  STATION,
  BASE,
  BATTLESHIPS,
  TRACTOR,
  WINGMAN,
  SHOP,
  SHIELD,
  ROCKET,
  MINE,
  HUNTER,
  REWARD,
  BOUNTY,
  CONVOY,
  WERFT,
  CRUISER,
} from "../src/game/constants.ts";

const IDLE = { turnLeft: false, turnRight: false, thrust: false, fire: false, fireSecondary: false };

// REQ-WORLD-01
describe("world setup", () => {
  it("starts with a ship in the center and at least one asteroid", () => {
    const w = createWorld({ width: 800, height: 600, seed: 1 });
    expect(w.ship.position.x).toBeCloseTo(400);
    expect(w.ship.position.y).toBeCloseTo(300);
    expect(w.asteroids.length).toBeGreaterThanOrEqual(1);
    expect(w.state).toBe("playing");
    expect(w.lives).toBeGreaterThan(0);
    expect(w.score).toBe(0);
  });
});

// REQ-BULLET-01 + REQ-WORLD-01
describe("pause", () => {
  it("freezes the world while paused (no movement, no firing)", () => {
    const w = createWorld({ width: 800, height: 600, seed: 1, asteroids: 3 });
    w.ship.angle = 0;
    w.state = "paused";
    const before = w.asteroids.map((a) => ({ x: a.position.x, y: a.position.y }));
    updateWorld(w, { ...IDLE, thrust: true, fire: true }, 0.1);
    w.asteroids.forEach((a, i) => {
      expect(a.position.x).toBe(before[i].x);
      expect(a.position.y).toBe(before[i].y);
    });
    expect(w.bullets.length).toBe(0); // firing is ignored while paused
  });
});

describe("firing", () => {
  it("spawns a bullet at the ship nose moving in the facing direction", () => {
    const w = createWorld({ width: 800, height: 600, seed: 1, asteroids: 0 });
    w.ship.angle = 0; // facing +x
    updateWorld(w, { ...IDLE, fire: true }, 0.016);
    expect(w.bullets.length).toBe(1);
    const b = w.bullets[0];
    expect(b.position.x).toBeGreaterThan(w.ship.position.x); // ahead of ship on +x
    expect(b.velocity.x).toBeGreaterThan(0);
    expect(length(b.velocity)).toBeCloseTo(BULLET.speed, 0);
  });

  it("enforces a fire cooldown (no unlimited rapid fire)", () => {
    const w = createWorld({ width: 800, height: 600, seed: 1, asteroids: 0 });
    updateWorld(w, { ...IDLE, fire: true }, 0.016);
    updateWorld(w, { ...IDLE, fire: true }, 0.016); // still within cooldown
    expect(w.bullets.length).toBe(1);
  });

  it("removes expired bullets", () => {
    const w = createWorld({ width: 800, height: 600, seed: 1, asteroids: 0 });
    updateWorld(w, { ...IDLE, fire: true }, 0.016);
    expect(w.bullets.length).toBe(1);
    // advance beyond bullet lifetime
    for (let i = 0; i < 5; i++) updateWorld(w, IDLE, BULLET.life / 4 + 0.01);
    expect(w.bullets.length).toBe(0);
  });
});

// REQ-COL-02
describe("bullet hits asteroid", () => {
  it("destroys a small asteroid, removes the bullet and scores its value", () => {
    const w = createWorld({ width: 800, height: 600, seed: 1, asteroids: 0 });
    w.ship.angle = 0;
    w.asteroids.push(
      createAsteroid(vec(w.ship.position.x + 40, w.ship.position.y), vec(0, 0), "small"),
    );
    const scoreBefore = w.score;
    updateWorld(w, { ...IDLE, fire: true }, 0.016);
    for (let i = 0; i < 10; i++) updateWorld(w, IDLE, 0.016);
    expect(w.asteroids.length).toBe(0);
    expect(w.bullets.length).toBe(0);
    expect(w.score).toBe(scoreBefore + ASTEROID.sizes.small.score);
  });
});

// REQ-AST-02 (integration): breaking apart like classic Asteroids
describe("bullet splits a large asteroid", () => {
  it("replaces a large asteroid with two medium ones and scores the large value", () => {
    const w = createWorld({ width: 800, height: 600, seed: 1, asteroids: 0 });
    w.ship.angle = 0;
    const target = createAsteroid(vec(w.ship.position.x + 40, w.ship.position.y), vec(0, 0), "large");
    target.hp = 1; // isolate split behaviour from the HP model (one shot destroys it)
    w.asteroids.push(target);
    const scoreBefore = w.score;
    updateWorld(w, { ...IDLE, fire: true }, 0.016);
    for (let i = 0; i < 10; i++) updateWorld(w, IDLE, 0.016);
    expect(w.asteroids.length).toBe(2);
    expect(w.asteroids.every((a) => a.size === "medium")).toBe(true);
    expect(w.score).toBe(scoreBefore + ASTEROID.sizes.large.score);
  });
});

// REQ-DMG-01: asteroids have hit points, damage matters
describe("asteroid hit points in the world", () => {
  it("a single laser shot damages but does not destroy a large asteroid", () => {
    const w = createWorld({ width: 800, height: 600, seed: 1, asteroids: 0 });
    w.ship.angle = 0;
    w.asteroids.push(
      createAsteroid(vec(w.ship.position.x + 40, w.ship.position.y), vec(0, 0), "large"),
    );
    const scoreBefore = w.score;
    updateWorld(w, { ...IDLE, fire: true }, 0.016);
    for (let i = 0; i < 6; i++) updateWorld(w, IDLE, 0.016);
    expect(w.asteroids.length).toBe(1);
    expect(w.asteroids[0].size).toBe("large");
    expect(w.asteroids[0].hp).toBeLessThan(w.asteroids[0].maxHp);
    expect(w.score).toBe(scoreBefore); // no score until destroyed
  });
});

// REQ-ECON-01: credits
describe("credits", () => {
  it("awards the asteroid's credit value (decoupled from score) when destroyed", () => {
    const w = createWorld({ width: 800, height: 600, seed: 1, asteroids: 0 });
    w.ship.angle = 0;
    w.asteroids.push(
      createAsteroid(vec(w.ship.position.x + 30, w.ship.position.y), vec(0, 0), "small"),
    );
    expect(w.credits).toBe(0);
    updateWorld(w, { ...IDLE, fire: true }, 0.016);
    for (let i = 0; i < 6; i++) updateWorld(w, IDLE, 0.016);
    expect(w.asteroids.length).toBe(0);
    expect(w.credits).toBe(ASTEROID.sizes.small.credits);
    expect(w.score).toBe(ASTEROID.sizes.small.score); // score stays high, credits are lower
  });
});

// REQ-WEAPON-01: multiple weapons
describe("explosive ammo (proximity)", () => {
  it("detonates near a target without a direct hit and destroys it", () => {
    const w = createWorld({ width: 800, height: 600, seed: 1, asteroids: 0 });
    w.ammo = "explosive";
    w.ammoCounts.explosive = 10;
    w.ship.angle = 0; // fire along +x
    // asteroid offset above the bullet's flight line: a direct hit would miss
    const a = createAsteroid(vec(w.ship.position.x + 60, w.ship.position.y - 26), vec(0, 0), "small");
    a.hp = 1;
    w.asteroids.push(a);
    updateWorld(w, { ...IDLE, fire: true }, 0.016);
    for (let i = 0; i < 20; i++) updateWorld(w, IDLE, 0.016);
    expect(w.asteroids.length).toBe(0); // taken out by the proximity blast
  });

  it("standard rounds do NOT hit the same off-line target (control)", () => {
    const w = createWorld({ width: 800, height: 600, seed: 1, asteroids: 0 });
    w.ammo = "standard";
    w.ship.angle = 0;
    const a = createAsteroid(vec(w.ship.position.x + 60, w.ship.position.y - 26), vec(0, 0), "small");
    a.hp = 1;
    w.asteroids.push(a);
    updateWorld(w, { ...IDLE, fire: true }, 0.016);
    for (let i = 0; i < 20; i++) updateWorld(w, IDLE, 0.016);
    expect(w.asteroids.length).toBe(1); // a plain round flies past
  });
});

describe("weapons in the world", () => {
  it("only equips weapons the player owns", () => {
    const w = createWorld({ width: 800, height: 600, seed: 1, asteroids: 0 });
    equipWeapon(w, "ballista"); // not owned yet
    expect(w.weapon).toBe("laser");
    w.ownedWeapons.push("ballista");
    equipWeapon(w, "ballista");
    expect(w.weapon).toBe("ballista");
  });

  it("Vulkan MK fires a single pellet per shot", () => {
    const w = createWorld({ width: 800, height: 600, seed: 1, asteroids: 0 });
    w.ownedWeapons.push("vulkan");
    equipWeapon(w, "vulkan");
    w.ship.angle = 0;
    updateWorld(w, { ...IDLE, fire: true }, 0.016);
    expect(w.bullets.length).toBe(1);
  });

  it("Vulkan MK spreads its shots randomly within the cone", () => {
    const w = createWorld({ width: 800, height: 600, seed: 1, asteroids: 0 });
    w.ownedWeapons.push("vulkan");
    equipWeapon(w, "vulkan");
    w.ship.angle = 0; // facing +x
    const headings = new Set<number>();
    for (let i = 0; i < 12; i++) {
      w.fireCooldown = 0; // force a shot each iteration
      updateWorld(w, { ...IDLE, fire: true }, 0.016);
      const b = w.bullets[w.bullets.length - 1];
      headings.add(Math.round(Math.atan2(b.velocity.y, b.velocity.x) * 1000));
    }
    expect(headings.size).toBeGreaterThan(1); // random -> varying headings
    for (const b of w.bullets) {
      const h = Math.atan2(b.velocity.y, b.velocity.x);
      expect(Math.abs(h)).toBeLessThanOrEqual(WEAPONS.vulkan.spread / 2 + 1e-6);
    }
  });
});

// REQ-AMMO-01: ammo modifiers and consumption
describe("ammo in the world", () => {
  it("armor-piercing ammo doubles damage and is consumed per shot", () => {
    const w = createWorld({ width: 800, height: 600, seed: 1, asteroids: 0 });
    w.ship.angle = 0;
    w.ammoCounts.ap = 5;
    equipAmmo(w, "ap");
    updateWorld(w, { ...IDLE, fire: true }, 0.016);
    expect(w.ammoCounts.ap).toBe(4);
    expect(w.bullets[0].damage).toBe(WEAPONS.laser.damage * AMMO.ap.damageMult);
  });

  it("explosive ammo gives the round a proximity blast radius", () => {
    const w = createWorld({ width: 800, height: 600, seed: 1, asteroids: 0 });
    w.ammoCounts.explosive = 3;
    equipAmmo(w, "explosive");
    updateWorld(w, { ...IDLE, fire: true }, 0.016);
    expect(w.bullets[0].blast).toBe(AMMO.explosive.blast);
    expect(w.bullets[0].blast).toBeGreaterThan(0);
  });

  it("falls back to standard rounds when special ammo is empty", () => {
    const w = createWorld({ width: 800, height: 600, seed: 1, asteroids: 0 });
    w.ammoCounts.ap = 0;
    equipAmmo(w, "ap");
    updateWorld(w, { ...IDLE, fire: true }, 0.016);
    expect(w.bullets[0].damage).toBe(WEAPONS.laser.damage); // not doubled
    expect(w.ammoCounts.ap).toBe(0);
  });
});

// REQ-PLANET-01: a shop planet drifts across the screen from time to time
describe("planet spawning in the world", () => {
  const advance = (w: ReturnType<typeof createWorld>, seconds: number) => {
    const steps = Math.round(seconds * 60);
    for (let i = 0; i < steps; i++) updateWorld(w, IDLE, 1 / 60);
  };

  it("has no planet at the very start", () => {
    const w = createWorld({ width: 800, height: 600, seed: 1, asteroids: 0 });
    expect(w.planet).toBeNull();
  });

  it("spawns a planet after the spawn delay, drifting horizontally", () => {
    const w = createWorld({ width: 800, height: 600, seed: 1, asteroids: 0 });
    advance(w, 14); // past the first-spawn delay, before it can cross
    expect(w.planet).not.toBeNull();
    expect(w.planet!.velocity.y).toBeCloseTo(0);
    expect(Math.abs(w.planet!.velocity.x)).toBeGreaterThan(0);
  });

  it("keeps at most one planet on screen at a time", () => {
    const w = createWorld({ width: 800, height: 600, seed: 1, asteroids: 0 });
    advance(w, 14);
    const first = w.planet;
    expect(first).not.toBeNull();
    advance(w, 3);
    expect(w.planet).toBe(first); // not replaced while still on screen
  });

  it("despawns the planet after it crosses the screen", () => {
    const w = createWorld({ width: 800, height: 600, seed: 1, asteroids: 0 });
    advance(w, 14);
    const p = w.planet!;
    expect(p).not.toBeNull();
    // push it just past its far edge and step once
    p.position.x = p.velocity.x > 0 ? w.width + p.radius + 5 : -p.radius - 5;
    updateWorld(w, IDLE, 1 / 60);
    expect(w.planet).toBeNull();
  });
});

// REQ-WAVE-01: continuous asteroid waves
describe("waves", () => {
  it("starts on wave 1 with a field of asteroids", () => {
    const w = createWorld({ width: 800, height: 600, seed: 1 });
    expect(w.wave).toBe(1);
    expect(w.asteroids.length).toBeGreaterThan(0);
  });

  it("advances to a stronger wave once the field is cleared", () => {
    const w = createWorld({ width: 800, height: 600, seed: 1 });
    const first = w.asteroids.length;
    w.asteroids.length = 0; // clear the field
    const steps = Math.ceil(WAVE.delay / 0.1) + 5;
    for (let i = 0; i < steps; i++) updateWorld(w, IDLE, 0.1);
    expect(w.wave).toBe(2);
    expect(w.asteroids.length).toBeGreaterThanOrEqual(first);
  });

  it("does not spawn waves in fixed-asteroid test mode", () => {
    const w = createWorld({ width: 800, height: 600, seed: 1, asteroids: 0 });
    for (let i = 0; i < 40; i++) updateWorld(w, IDLE, 0.1);
    expect(w.asteroids.length).toBe(0);
    expect(w.wave).toBe(1);
  });
});

// REQ-SHIP-03: purchasable ships
describe("ships in the world", () => {
  it("starts owning only the Vanguard", () => {
    const w = createWorld({ width: 800, height: 600, seed: 1, asteroids: 0 });
    expect(w.ownedShips).toEqual(["vanguard"]);
    expect(w.shipId).toBe("vanguard");
    expect(w.ship.radius).toBe(SHIPS.vanguard.radius);
  });

  it("equips a ship only if owned", () => {
    const w = createWorld({ width: 800, height: 600, seed: 1, asteroids: 0 });
    equipShip(w, "deltaRaptor"); // not owned
    expect(w.shipId).toBe("vanguard");
    w.ownedShips.push("deltaRaptor");
    equipShip(w, "deltaRaptor");
    expect(w.shipId).toBe("deltaRaptor");
  });

  it("equipping a ship applies its stats to the ship", () => {
    const w = createWorld({ width: 800, height: 600, seed: 1, asteroids: 0 });
    w.ownedShips.push("deltaRaptor");
    equipShip(w, "deltaRaptor");
    expect(w.ship.radius).toBe(SHIPS.deltaRaptor.radius);
    expect(w.ship.turnSpeed).toBe(SHIPS.deltaRaptor.turnSpeed);
    expect(w.ship.thrust).toBe(SHIPS.deltaRaptor.thrust);
    expect(w.ship.maxSpeed).toBe(SHIPS.deltaRaptor.maxSpeed);
  });
});

// REQ-LAND-01 + REQ-SHOP-01 (pause)
describe("landing on the planet opens the shop", () => {
  // put a stationary planet exactly under the (centered) ship
  const landShipOnPlanet = (w: ReturnType<typeof createWorld>) => {
    w.planet = createPlanet({ ...w.ship.position }, vec(0, 0), PLANET.radius);
  };

  it("accumulates landing progress while the ship sits on the planet", () => {
    const w = createWorld({ width: 800, height: 600, seed: 1, asteroids: 0 });
    landShipOnPlanet(w);
    updateWorld(w, IDLE, 0.5);
    expect(w.landProgress).toBeGreaterThan(0);
    expect(w.state).toBe("playing"); // not enough yet
  });

  it("resets progress when the ship leaves the planet", () => {
    const w = createWorld({ width: 800, height: 600, seed: 1, asteroids: 0 });
    landShipOnPlanet(w);
    updateWorld(w, IDLE, 0.5);
    expect(w.landProgress).toBeGreaterThan(0);
    w.planet!.position.x += 400; // move the planet out from under the ship
    updateWorld(w, IDLE, 0.1);
    expect(w.landProgress).toBe(0);
  });

  it("opens the shop after the required hold time, pausing the world", () => {
    const w = createWorld({ width: 800, height: 600, seed: 1, asteroids: 0 });
    landShipOnPlanet(w);
    const steps = Math.ceil(PLANET.landTime / 0.1) + 2;
    for (let i = 0; i < steps; i++) updateWorld(w, IDLE, 0.1);
    expect(w.state).toBe("shop");
  });

  it("does not advance the world while the shop is open", () => {
    const w = createWorld({ width: 800, height: 600, seed: 1, asteroids: 0 });
    w.state = "shop";
    const a = createAsteroid(vec(100, 100), vec(50, 0), "large");
    w.asteroids.push(a);
    updateWorld(w, IDLE, 0.5);
    expect(a.position.x).toBe(100); // world paused
  });

  it("closeShop resumes play and blocks immediate re-landing until the ship leaves", () => {
    const w = createWorld({ width: 800, height: 600, seed: 1, asteroids: 0 });
    landShipOnPlanet(w);
    const steps = Math.ceil(PLANET.landTime / 0.1) + 2;
    for (let i = 0; i < steps; i++) updateWorld(w, IDLE, 0.1);
    expect(w.state).toBe("shop");

    closeShop(w);
    expect(w.state).toBe("playing");
    // ship is still on the planet, but landing must not re-trigger
    for (let i = 0; i < steps; i++) updateWorld(w, IDLE, 0.1);
    expect(w.state).toBe("playing");
    expect(w.landProgress).toBe(0);
  });
});

// REQ-SHOP-04: random shop equipment stock
describe("shop stock", () => {
  it("opening the shop rolls a fresh equipment stock (subset of random equipment)", () => {
    const w = createWorld({ width: 800, height: 600, seed: 1, asteroids: 0 });
    rollShopStock(w);
    for (const id of w.shopStock) expect(SHOP.randomEquipment).toContain(id);
  });
});

// REQ-ENEMY-01: enemies
describe("enemies", () => {
  it("spawns an enemy in wave mode when the timer elapses", () => {
    const w = createWorld({ width: 800, height: 600, seed: 1 });
    w.ship.invuln = 999; // stay alive for the test
    w.enemyTimer = 0.01;
    updateWorld(w, IDLE, 0.02);
    expect(w.enemies.length).toBe(1);
  });

  it("does not spawn enemies in fixed-asteroid test mode", () => {
    const w = createWorld({ width: 800, height: 600, seed: 1, asteroids: 0 });
    w.enemyTimer = 0;
    for (let i = 0; i < 40; i++) updateWorld(w, IDLE, 0.1);
    expect(w.enemies.length).toBe(0);
  });

  it("from wave 2 a spawn can bring a wingman so two attack at once", () => {
    const w = createWorld({ width: 800, height: 600, seed: 1 });
    w.ship.invuln = 999;
    w.wave = 2;
    w.enemies = [];
    w.enemyTimer = 0.01;
    // 0.45: above stationChance (0.4) -> fighters (no base), below pairChance (0.5) -> a pair spawns
    w.rng = { next: () => 0.45, range: (min, max) => min + (max - min) * 0.45 };
    updateWorld(w, IDLE, 0.02);
    expect(w.enemies.length).toBe(2);
  });

  it("does not pair-spawn before wave 2", () => {
    const w = createWorld({ width: 800, height: 600, seed: 1 });
    w.ship.invuln = 999;
    w.wave = 1;
    w.enemies = [];
    w.enemyTimer = 0.01;
    w.rng = { next: () => 0.1, range: (min, max) => min + (max - min) * 0.1 };
    updateWorld(w, IDLE, 0.02);
    expect(w.enemies.length).toBe(1);
  });

  it("an enemy fires a projectile aimed at the ship", () => {
    const w = createWorld({ width: 800, height: 600, seed: 1, asteroids: 0 });
    const e = createEnemy(vec(w.ship.position.x + 100, w.ship.position.y), vec(0, 0));
    e.fireTimer = 0; // ready to fire
    w.enemies.push(e);
    updateWorld(w, IDLE, 0.02);
    expect(w.enemyBullets.length).toBe(1);
    expect(w.enemyBullets[0].velocity.x).toBeLessThan(0); // toward the ship (to -x)
  });

  it("an enemy bullet hits the ship and costs a life", () => {
    const w = createWorld({ width: 800, height: 600, seed: 1, asteroids: 0, lives: 3 });
    w.ship.invuln = 0;
    w.enemyBullets.push({
      position: { ...w.ship.position },
      velocity: vec(0, 0),
      life: 2,
      radius: ENEMY.bulletRadius,
      damage: 1,
      blast: 0,
    });
    updateWorld(w, IDLE, 0.016);
    expect(w.lives).toBe(2);
  });

  it("a player bullet destroys an enemy, awarding score, credits and dropping loot", () => {
    const w = createWorld({ width: 800, height: 600, seed: 1, asteroids: 0 });
    w.ship.angle = 0;
    const e = createEnemy(vec(w.ship.position.x + 40, w.ship.position.y), vec(0, 0));
    e.hp = 1; // one shot
    e.fireTimer = 999; // don't let it shoot back during the test
    w.enemies.push(e);
    const scoreBefore = w.score;
    const creditsBefore = w.credits;
    updateWorld(w, { ...IDLE, fire: true }, 0.016);
    for (let i = 0; i < 10; i++) updateWorld(w, IDLE, 0.016);
    expect(w.enemies.length).toBe(0);
    expect(w.score).toBe(scoreBefore + ENEMY.score);
    expect(w.credits).toBe(creditsBefore + ENEMY.credits);
    expect(w.loot.length).toBe(1);
  });

  it("a station's charging beam damages the ship when it is on the locked line", () => {
    const w = createWorld({ width: 800, height: 600, seed: 1, asteroids: 0 });
    const cy = w.ship.position.y;
    const s = createEnemy(vec(w.ship.position.x - 100, cy), vec(0, 0), "station");
    w.enemies.push(s);
    w.ship.invuln = 0;
    const lives = w.lives;
    // ride through aim + charge into the live beam; the idle ship stays on the line
    const total = STATION.beamAim + STATION.beamCharge + STATION.beamTime + 0.1;
    for (let i = 0, n = Math.ceil(total / 0.05); i < n; i++) updateWorld(w, IDLE, 0.05);
    expect(w.lives).toBe(lives - 1); // one clean hit; respawn invuln blocks the rest
  });

  it("a station's beam misses when the ship leaves the locked line", () => {
    const w = createWorld({ width: 800, height: 600, seed: 1, asteroids: 0 });
    const cy = w.ship.position.y;
    const s = createEnemy(vec(w.ship.position.x - 100, cy), vec(0, 0), "station");
    w.enemies.push(s);
    w.ship.invuln = 0;
    // advance until the aim locks (into the charge phase)
    while (s.beamPhase === "idle") updateWorld(w, IDLE, 0.05);
    const lives = w.lives;
    // dodge off the locked horizontal line and hold there through the whole beam
    const rest = STATION.beamCharge + STATION.beamTime + 0.1;
    for (let i = 0, n = Math.ceil(rest / 0.05); i < n; i++) {
      w.ship.position = vec(w.ship.position.x, cy - 250);
      w.ship.invuln = 0;
      updateWorld(w, IDLE, 0.05);
    }
    expect(w.lives).toBe(lives);
  });

  it("shield is a rare enemy drop — mid-range rolls yield other loot", () => {
    const w = createWorld({ width: 800, height: 600, seed: 1, asteroids: 0 });
    w.ship.angle = 0;
    const e = createEnemy(vec(w.ship.position.x + 40, w.ship.position.y), vec(0, 0));
    e.hp = 1;
    e.fireTimer = 999;
    w.enemies.push(e);
    // roll 0.2 is above the shield drop chance, so the drop must be something else
    w.rng = { next: () => 0.2, range: (min, max) => min + (max - min) * 0.2 };
    updateWorld(w, { ...IDLE, fire: true }, 0.016);
    for (let i = 0; i < 10; i++) updateWorld(w, IDLE, 0.016);
    expect(w.enemies.length).toBe(0);
    expect(w.loot.length).toBe(1);
    expect(w.loot[0].kind).not.toBe("shield");
  });

  it("an enemy can occasionally drop mines", () => {
    const w = createWorld({ width: 800, height: 600, seed: 1, asteroids: 0 });
    w.ship.angle = 0;
    const e = createEnemy(vec(w.ship.position.x + 40, w.ship.position.y), vec(0, 0));
    e.hp = 1;
    e.fireTimer = 999;
    w.enemies.push(e);
    // roll 0.1 falls in the mine band (shield 0.06 .. mine 0.18)
    w.rng = { next: () => 0.1, range: (min, max) => min + (max - min) * 0.1 };
    updateWorld(w, { ...IDLE, fire: true }, 0.016);
    for (let i = 0; i < 10; i++) updateWorld(w, IDLE, 0.016);
    expect(w.enemies.length).toBe(0);
    expect(w.loot.length).toBe(1);
    expect(w.loot[0].kind).toBe("mine");
  });
});

// REQ-LOOT-01: loot pickups & special equipment
describe("loot pickups", () => {
  it("picking up shield loot grants a temporary shield", () => {
    const w = createWorld({ width: 800, height: 600, seed: 1, asteroids: 0 });
    w.loot.push(createLoot({ ...w.ship.position }, "shield"));
    updateWorld(w, IDLE, 0.016);
    expect(w.ship.shield).toBeGreaterThan(0);
    expect(w.loot.length).toBe(0);
  });

  it("picking up ammo loot refills ammunition", () => {
    const w = createWorld({ width: 800, height: 600, seed: 1, asteroids: 0 });
    const ap0 = w.ammoCounts.ap;
    w.loot.push(createLoot({ ...w.ship.position }, "ammo"));
    updateWorld(w, IDLE, 0.016);
    expect(w.ammoCounts.ap).toBeGreaterThan(ap0);
    expect(w.loot.length).toBe(0);
  });

  it("picking up rocket loot grants rockets", () => {
    const w = createWorld({ width: 800, height: 600, seed: 1, asteroids: 0 });
    const before = w.rocketAmmo;
    w.loot.push(createLoot({ ...w.ship.position }, "rocket"));
    updateWorld(w, IDLE, 0.016);
    expect(w.rocketAmmo).toBe(before + ROCKET.lootGrant);
    expect(w.loot.length).toBe(0);
  });

  it("picking up mine loot grants mines", () => {
    const w = createWorld({ width: 800, height: 600, seed: 1, asteroids: 0 });
    const before = w.mineAmmo;
    w.loot.push(createLoot({ ...w.ship.position }, "mine"));
    updateWorld(w, IDLE, 0.016);
    expect(w.mineAmmo).toBe(before + MINE.lootGrant);
    expect(w.loot.length).toBe(0);
  });

  it("picking up ammo while on standard auto-switches to the new ammo", () => {
    const w = createWorld({ width: 800, height: 600, seed: 1, asteroids: 0 });
    expect(w.ammo).toBe("standard");
    w.loot.push(createLoot({ ...w.ship.position }, "ammo"));
    updateWorld(w, IDLE, 0.016);
    expect(w.ammo).not.toBe("standard"); // now firing the picked-up ammo
  });

  it("keeps an already-selected special ammo when picking up ammo", () => {
    const w = createWorld({ width: 800, height: 600, seed: 1, asteroids: 0 });
    w.ammo = "explosive";
    w.loot.push(createLoot({ ...w.ship.position }, "ammo"));
    updateWorld(w, IDLE, 0.016);
    expect(w.ammo).toBe("explosive"); // don't override the player's choice
  });

  it("a shield prevents losing a life", () => {
    const w = createWorld({ width: 800, height: 600, seed: 1, asteroids: 0, lives: 3 });
    w.ship.invuln = 0;
    w.ship.shield = 5;
    w.enemyBullets.push({
      position: { ...w.ship.position },
      velocity: vec(0, 0),
      life: 2,
      radius: ENEMY.bulletRadius,
      damage: 1,
      blast: 0,
    });
    updateWorld(w, IDLE, 0.016);
    expect(w.lives).toBe(3); // shielded, no loss
  });

  it("antigrav deflects a nearby asteroid away from the ship", () => {
    const w = createWorld({ width: 800, height: 600, seed: 1, asteroids: 0 });
    w.ship.antigrav = 5;
    const a = createAsteroid(vec(w.ship.position.x + 50, w.ship.position.y), vec(0, 0), "large");
    a.hp = 99;
    w.asteroids.push(a);
    updateWorld(w, IDLE, 0.05);
    expect(a.velocity.x).toBeGreaterThan(0); // pushed away (+x, away from the ship)
  });
});

// REQ-INPUT-01: cycling weapons (E) and ammo (Q)
describe("cycling weapons and ammo", () => {
  it("cycleWeapon steps through the owned weapons and wraps", () => {
    const w = createWorld({ width: 800, height: 600, seed: 1, asteroids: 0 });
    w.ownedWeapons.push("vulkan", "ballista"); // owned: laser, vulkan, ballista
    expect(w.weapon).toBe("laser");
    cycleWeapon(w);
    expect(w.weapon).toBe("vulkan");
    cycleWeapon(w);
    expect(w.weapon).toBe("ballista");
    cycleWeapon(w);
    expect(w.weapon).toBe("laser"); // wraps around
  });

  it("cycleWeapon keeps the laser when nothing else is owned", () => {
    const w = createWorld({ width: 800, height: 600, seed: 1, asteroids: 0 });
    cycleWeapon(w);
    expect(w.weapon).toBe("laser");
  });

  it("cycleAmmo steps through standard, ap and explosive and wraps", () => {
    const w = createWorld({ width: 800, height: 600, seed: 1, asteroids: 0 });
    expect(w.ammo).toBe("standard");
    cycleAmmo(w);
    expect(w.ammo).toBe("ap");
    cycleAmmo(w);
    expect(w.ammo).toBe("explosive");
    cycleAmmo(w);
    expect(w.ammo).toBe("standard"); // wraps around
  });
});

// REQ-ROCKET-01: homing rockets
describe("homing rockets", () => {
  it("firing a rocket consumes ammo and locks the nearest target in front", () => {
    const w = createWorld({ width: 800, height: 600, seed: 1, asteroids: 0 });
    w.ship.angle = 0; // facing +x
    w.rocketAmmo = 3;
    // an enemy in front (+x) and an asteroid behind (-x, even closer)
    const front = createEnemy(vec(w.ship.position.x + 120, w.ship.position.y), vec(0, 0));
    const behind = createAsteroid(vec(w.ship.position.x - 60, w.ship.position.y), vec(0, 0), "large");
    w.enemies.push(front);
    w.asteroids.push(behind);
    updateWorld(w, { ...IDLE, fireSecondary: true }, 0.016);
    expect(w.rockets.length).toBe(1);
    expect(w.rocketAmmo).toBe(2);
    expect(w.rockets[0].target).toBe(front); // locked the target in front, not the closer one behind
  });

  it("does not fire a rocket without ammo", () => {
    const w = createWorld({ width: 800, height: 600, seed: 1, asteroids: 0 });
    w.rocketAmmo = 0;
    updateWorld(w, { ...IDLE, fireSecondary: true }, 0.016);
    expect(w.rockets.length).toBe(0);
  });

  it("a rocket homes in on and destroys its target", () => {
    const w = createWorld({ width: 800, height: 600, seed: 1, asteroids: 0 });
    w.ship.angle = 0;
    w.rocketAmmo = 1;
    const enemy = createEnemy(vec(w.ship.position.x + 150, w.ship.position.y), vec(0, 0));
    w.enemies.push(enemy);
    const scoreBefore = w.score;
    updateWorld(w, { ...IDLE, fireSecondary: true }, 0.016);
    for (let i = 0; i < 80; i++) updateWorld(w, IDLE, 0.016);
    expect(w.enemies.length).toBe(0); // destroyed by the rocket
    expect(w.score).toBeGreaterThan(scoreBefore);
  });
});

// REQ-MINE-01: space mines (secondary weapon)
describe("space mines", () => {
  it("the secondary weapon is ship-bound: the Sämann lays mines, other ships fire rockets", () => {
    const w = createWorld({ width: 800, height: 600, seed: 1, asteroids: 0 });
    expect(w.secondary).toBe("rocket"); // Vanguard = rockets
    w.ownedShips.push("seeder");
    equipShip(w, "seeder");
    expect(w.secondary).toBe("mine"); // the mine-layer
    equipShip(w, "vanguard");
    expect(w.secondary).toBe("rocket"); // back to rockets, no toggle needed
  });

  it("dropping mines lays a field behind the ship and consumes mine ammo", () => {
    const w = createWorld({ width: 800, height: 600, seed: 1, asteroids: 0 });
    w.ship.angle = 0; // facing +x -> mines drop toward -x (behind)
    w.secondary = "mine";
    w.mineAmmo = 5;
    updateWorld(w, { ...IDLE, fireSecondary: true }, 0.016);
    expect(w.mines.length).toBe(MINE.clusterSize);
    expect(w.mineAmmo).toBe(5 - MINE.clusterSize);
    for (const m of w.mines) expect(m.position.x).toBeLessThan(w.ship.position.x); // behind the ship
  });

  it("does not drop mines without ammo or when rockets are selected", () => {
    const noAmmo = createWorld({ width: 800, height: 600, seed: 1, asteroids: 0 });
    noAmmo.secondary = "mine";
    noAmmo.mineAmmo = 0;
    updateWorld(noAmmo, { ...IDLE, fireSecondary: true }, 0.016);
    expect(noAmmo.mines.length).toBe(0);

    const rocketMode = createWorld({ width: 800, height: 600, seed: 1, asteroids: 0 });
    rocketMode.secondary = "rocket";
    rocketMode.mineAmmo = 9;
    updateWorld(rocketMode, { ...IDLE, fireSecondary: true }, 0.016);
    expect(rocketMode.mines.length).toBe(0);
  });

  it("a mine detonates on an asteroid dealing damage", () => {
    const w = createWorld({ width: 800, height: 600, seed: 1, asteroids: 0 });
    const a = createAsteroid(vec(w.ship.position.x + 200, w.ship.position.y), vec(0, 0), "large");
    a.hp = 1; // one hit destroys it
    w.asteroids.push(a);
    // place a mine right on the asteroid
    w.mines.push({
      position: { ...a.position },
      velocity: vec(0, 0),
      radius: MINE.radius,
      life: MINE.life,
      damage: MINE.damage,
      pulse: 0,
    });
    const scoreBefore = w.score;
    updateWorld(w, IDLE, 0.016);
    expect(w.mines.length).toBe(0); // detonated
    expect(w.score).toBeGreaterThan(scoreBefore); // asteroid took lethal damage
  });
});

// REQ-EQUIP-01: rechargeable hit-shield
describe("rechargeable shield", () => {
  const putBulletOnShip = (w: ReturnType<typeof createWorld>) =>
    w.enemyBullets.push({
      position: { ...w.ship.position },
      velocity: vec(0, 0),
      life: 2,
      radius: ENEMY.bulletRadius,
      damage: 1,
      blast: 0,
    });

  it("a shield charge absorbs a hit instead of a life", () => {
    const w = createWorld({ width: 800, height: 600, seed: 1, asteroids: 0, lives: 3 });
    w.ship.invuln = 0;
    w.ship.shieldMax = SHIELD.capacity;
    w.ship.shield = SHIELD.capacity;
    w.ship.shieldRecharge = SHIELD.rechargeDelay;
    putBulletOnShip(w);
    updateWorld(w, IDLE, 0.016);
    expect(w.ship.shield).toBe(SHIELD.capacity - 1);
    expect(w.lives).toBe(3);
  });

  it("when shield charges are gone a hit costs a life", () => {
    const w = createWorld({ width: 800, height: 600, seed: 1, asteroids: 0, lives: 3 });
    w.ship.invuln = 0;
    w.ship.shieldMax = SHIELD.capacity;
    w.ship.shield = 0;
    w.ship.shieldRecharge = 5; // won't recharge this frame
    putBulletOnShip(w);
    updateWorld(w, IDLE, 0.016);
    expect(w.lives).toBe(2);
  });

  it("the shield recharges a charge after the delay", () => {
    const w = createWorld({ width: 800, height: 600, seed: 1, asteroids: 0 });
    w.ship.shieldMax = SHIELD.capacity;
    w.ship.shield = 0;
    w.ship.shieldRecharge = 0.05;
    updateWorld(w, IDLE, 0.1);
    expect(w.ship.shield).toBe(1);
  });
});

// REQ-ENEMY-02: stations do not shoot
describe("stations", () => {
  it("a station fires no projectiles (it uses a charging beam instead)", () => {
    const w = createWorld({ width: 800, height: 600, seed: 1, asteroids: 0 });
    const s = createEnemy(vec(w.ship.position.x + 100, w.ship.position.y), vec(0, 0), "station");
    s.fireTimer = 0; // would fire a bullet if it were a fighter
    w.enemies.push(s);
    updateWorld(w, IDLE, 0.05);
    expect(w.enemyBullets.length).toBe(0);
  });
});

// REQ-SHIP-04: Titan battleship with mouse-aimed turrets
describe("Titan battleship", () => {
  it("equipping the Titan installs its turrets and heavy shields (charged)", () => {
    const w = createWorld({ width: 800, height: 600, seed: 1, asteroids: 0 });
    expect(w.ship.turrets.length).toBe(0); // vanguard: single nose cannon
    expect(w.ship.shieldMax).toBe(0);
    w.ownedShips.push("titan");
    equipShip(w, "titan");
    expect(w.ship.turrets.length).toBe(SHIPS.titan.turrets!.length);
    expect(w.ship.shieldMax).toBe(SHIPS.titan.shieldCapacity);
    expect(w.ship.shield).toBe(SHIPS.titan.shieldCapacity); // comes charged
  });

  it("fires one bolt from every turret toward the mouse aim", () => {
    const w = createWorld({ width: 800, height: 600, seed: 1, asteroids: 0 });
    w.ownedShips.push("titan");
    equipShip(w, "titan");
    w.ship.angle = 0; // hull faces +x, but we aim straight up
    const aim = { x: w.ship.position.x, y: w.ship.position.y - 100 };
    updateWorld(w, { ...IDLE, fire: true, aim }, 0.016);
    expect(w.bullets.length).toBe(SHIPS.titan.turrets!.length); // one per turret (laser)
    for (const b of w.bullets) expect(b.velocity.y).toBeLessThan(0); // all travel toward the aim
  });

  it("a single-cannon ship still fires one bolt along its nose", () => {
    const w = createWorld({ width: 800, height: 600, seed: 1, asteroids: 0 });
    w.ship.angle = 0;
    updateWorld(w, { ...IDLE, fire: true }, 0.016); // no aim provided
    expect(w.bullets.length).toBe(1);
    expect(w.bullets[0].velocity.x).toBeGreaterThan(0); // forward (+x)
  });

  it("the autocannon upgrade auto-fires at a nearby target without player input", () => {
    const w = createWorld({ width: 800, height: 600, seed: 1, asteroids: 0 });
    w.ownedShips.push("titan");
    w.shipUpgrades.push("autocannon");
    equipShip(w, "titan");
    expect(w.ship.hasAutocannon).toBe(true);
    const e = createEnemy(vec(w.ship.position.x + 120, w.ship.position.y), vec(0, 0), "fighter");
    e.fireTimer = 999; // don't let it shoot back
    w.enemies.push(e);
    w.ship.autoCooldown = 0;
    updateWorld(w, IDLE, 0.05); // no fire input at all
    expect(w.bullets.length).toBeGreaterThan(0); // the autocannon fired on its own
  });

  it("the autocannon holds fire when no target is in range", () => {
    const w = createWorld({ width: 3000, height: 3000, seed: 1, asteroids: 0 });
    w.ownedShips.push("titan");
    w.shipUpgrades.push("autocannon");
    equipShip(w, "titan");
    w.ship.autoCooldown = 0;
    updateWorld(w, IDLE, 0.05);
    expect(w.bullets.length).toBe(0);
  });

  it("the tractor beam reels in a small asteroid and shatters it for bonus credits", () => {
    const w = createWorld({ width: 1200, height: 1200, seed: 1, asteroids: 0 });
    w.ownedShips.push("titan");
    w.shipUpgrades.push("tractor");
    equipShip(w, "titan");
    w.ship.invuln = 999; // isolate the tractor from ship-asteroid collision
    const a = createAsteroid(vec(w.ship.position.x + 200, w.ship.position.y), vec(0, 0), "small");
    w.asteroids.push(a);
    const creditsBefore = w.credits;
    for (let i = 0; i < 200; i++) updateWorld(w, IDLE, 1 / 120);
    expect(w.asteroids.length).toBe(0); // absorbed
    expect(w.credits).toBe(creditsBefore + ASTEROID.sizes.small.credits * TRACTOR.absorbCreditMult);
  });

  it("shatters only one small asteroid at a time, then waits out a cooldown", () => {
    const w = createWorld({ width: 1200, height: 1200, seed: 1, asteroids: 0 });
    w.ownedShips.push("titan");
    w.shipUpgrades.push("tractor");
    equipShip(w, "titan");
    w.ship.invuln = 999;
    // two small asteroids both already within grab range on opposite sides
    const near = w.ship.radius + ASTEROID.sizes.small.radius + 2;
    w.asteroids.push(createAsteroid(vec(w.ship.position.x + near, w.ship.position.y), vec(0, 0), "small"));
    w.asteroids.push(createAsteroid(vec(w.ship.position.x - near, w.ship.position.y), vec(0, 0), "small"));
    updateWorld(w, IDLE, 1 / 120);
    expect(w.asteroids.length).toBe(1); // only one shattered this tick
    expect(w.ship.tractorCooldown).toBeGreaterThan(0); // reload before the next
    // ride out the cooldown -> the second one gets absorbed too
    for (let i = 0; i < Math.ceil(TRACTOR.cooldown * 120) + 5; i++) updateWorld(w, IDLE, 1 / 120);
    expect(w.asteroids.length).toBe(0);
  });

  it("the tractor beam pulls nearby loot toward the ship", () => {
    const w = createWorld({ width: 1200, height: 1200, seed: 1, asteroids: 0 });
    w.ownedShips.push("titan");
    w.shipUpgrades.push("tractor");
    equipShip(w, "titan");
    w.ship.invuln = 999;
    const l = createLoot(vec(w.ship.position.x + 200, w.ship.position.y), "ammo");
    w.loot.push(l);
    const d0 = 200;
    updateWorld(w, IDLE, 1 / 120);
    const d1 = Math.hypot(l.position.x - w.ship.position.x, l.position.y - w.ship.position.y);
    expect(d1).toBeLessThan(d0); // pulled inward
  });

  it("the deflector pulse vaporises nearby enemy bullets", () => {
    const w = createWorld({ width: 900, height: 700, seed: 1, asteroids: 0 });
    w.ownedShips.push("titan");
    w.shipUpgrades.push("deflector");
    equipShip(w, "titan");
    w.ship.invuln = 999;
    w.ship.deflectorCooldown = 0; // fire on the next tick
    w.enemyBullets.push(createBullet({ ...w.ship.position }, vec(0, 0), 5, 4, 1));
    updateWorld(w, IDLE, 1 / 120);
    expect(w.enemyBullets.length).toBe(0); // cleared by the pulse
    expect(w.ship.deflectorCooldown).toBeGreaterThan(0); // pulse fired -> on cooldown
  });

  it("the deflector pulse damages and pushes a nearby enemy", () => {
    const w = createWorld({ width: 900, height: 700, seed: 1, asteroids: 0 });
    w.ownedShips.push("titan");
    w.shipUpgrades.push("deflector");
    equipShip(w, "titan");
    w.ship.invuln = 999;
    w.ship.deflectorCooldown = 0;
    const e = createEnemy(vec(w.ship.position.x + 60, w.ship.position.y), vec(0, 0), "fighter");
    e.fireTimer = 999;
    const hp0 = e.hp;
    w.enemies.push(e);
    updateWorld(w, IDLE, 1 / 120);
    const survivor = w.enemies[0];
    expect(survivor.hp).toBeLessThan(hp0); // took pulse damage
    expect(survivor.velocity.x).toBeGreaterThan(0); // knocked outward (+x)
  });

  // REQ-BASE-01: rockets and wingmen must also engage the big battleships
  it("a fired rocket homes onto and damages a battleship", () => {
    const w = createWorld({ width: 1200, height: 1200, seed: 1, asteroids: 0 });
    w.ship.invuln = 999;
    w.rocketAmmo = 3;
    w.secondary = "rocket";
    const base = createBattleship("mandible", vec(w.ship.position.x, w.ship.position.y - 300), vec(0, 0));
    const hp0 = base.hp; // mandible carries no shield -> hull takes the hit directly
    w.bases.push(base);
    updateWorld(w, { ...IDLE, fireSecondary: true }, 1 / 120); // launch a rocket
    expect(w.rockets.length).toBe(1);
    for (let i = 0; i < 260; i++) updateWorld(w, IDLE, 1 / 120);
    expect(base.hp).toBeLessThan(hp0); // rocket steered into the hull
  });

  it("wingmen engage battleships, not only fighters", () => {
    const w = createWorld({ width: 900, height: 700, seed: 1, asteroids: 0 });
    w.ownedShips.push("titan");
    w.hangarLevel = 1;
    equipShip(w, "titan");
    w.ship.invuln = 999;
    const base = createBattleship("mandible", vec(w.ship.position.x + 120, w.ship.position.y), vec(0, 0));
    const hp0 = base.hp;
    w.bases.push(base);
    for (let i = 0; i < 80; i++) updateWorld(w, IDLE, 0.05);
    expect(base.hp).toBeLessThan(hp0); // a drone fired on the battleship
  });

  // REQ-SHIP-05: hangar level = drone count
  it("launches one wingman per hangar level", () => {
    const w = createWorld({ width: 900, height: 700, seed: 1, asteroids: 0 });
    w.ownedShips.push("titan");
    equipShip(w, "titan");
    w.hangarLevel = 1;
    updateWorld(w, IDLE, 0.05);
    expect(w.wingmen.length).toBe(1);
    w.hangarLevel = 3;
    updateWorld(w, IDLE, 0.05);
    expect(w.wingmen.length).toBe(3);
  });

  // REQ-WERFT-02: post-event hunter missiles chase the ship
  it("spawns homing hunter missiles after the shipyard-defense is won", () => {
    const w = createWorld({ width: 900, height: 700, seed: 1 });
    w.asteroids = [];
    w.enemies = [];
    w.werftDone = true;
    w.werft = null;
    w.hunterTimer = 0;
    updateWorld(w, IDLE, 0.02);
    expect(w.siege.some((m) => m.homing)).toBe(true);
  });

  it("a hunter missile accelerates while chasing an invulnerable ship", () => {
    const w = createWorld({ width: 900, height: 700, seed: 1 });
    w.asteroids = [];
    w.enemies = [];
    w.werftDone = true;
    w.werft = null;
    w.ship.invuln = 999; // so it can't be consumed and keeps homing
    w.hunterTimer = 0;
    updateWorld(w, IDLE, 0.02); // spawn one
    const s0 = w.siege.find((m) => m.homing)!.speed;
    for (let i = 0; i < 40; i++) updateWorld(w, IDLE, 0.05);
    const m = w.siege.find((x) => x.homing);
    expect(m && m.speed).toBeGreaterThan(s0); // sped up over time
  });

  // REQ-SHIP-07: missile cruiser "Hydra" — forges rockets, fires salvos
  it("the cruiser forges rockets over time up to its magazine cap", () => {
    const w = createWorld({ width: 900, height: 700, seed: 1, asteroids: 0 });
    w.ownedShips.push("cruiser");
    equipShip(w, "cruiser");
    w.rocketAmmo = 0;
    // ride out enough time to forge well past the cap
    const steps = Math.ceil((CRUISER.produceInterval * (CRUISER.magazine + 3)) / 0.05);
    for (let i = 0; i < steps; i++) updateWorld(w, IDLE, 0.05);
    expect(w.rocketAmmo).toBe(CRUISER.magazine); // tops up, then stops at the cap
  });

  it("does not forge rockets on other ships", () => {
    const w = createWorld({ width: 900, height: 700, seed: 1, asteroids: 0 });
    w.rocketAmmo = 0; // Vanguard
    const steps = Math.ceil((CRUISER.produceInterval * 3) / 0.05);
    for (let i = 0; i < steps; i++) updateWorld(w, IDLE, 0.05);
    expect(w.rocketAmmo).toBe(0);
  });

  it("the cruiser fires a salvo of several rockets at once", () => {
    const w = createWorld({ width: 900, height: 700, seed: 1, asteroids: 0 });
    w.ownedShips.push("cruiser");
    equipShip(w, "cruiser");
    w.rocketAmmo = 6;
    updateWorld(w, { ...IDLE, fireSecondary: true }, 1 / 120);
    expect(w.rockets.length).toBe(CRUISER.salvoSize); // a volley, not a single rocket
    expect(w.rocketAmmo).toBe(6 - CRUISER.salvoSize);
    expect(w.secondaryCooldown).toBeGreaterThan(0); // salvo cooldown started
  });

  it("a salvo never fires more rockets than are loaded", () => {
    const w = createWorld({ width: 900, height: 700, seed: 1, asteroids: 0 });
    w.ownedShips.push("cruiser");
    equipShip(w, "cruiser");
    w.rocketAmmo = 1;
    updateWorld(w, { ...IDLE, fireSecondary: true }, 1 / 120);
    expect(w.rockets.length).toBe(1);
    expect(w.rocketAmmo).toBe(0);
  });

  // REQ-EVENT-01: bounty elite
  it("spawns a bounty elite from its wave on a timer", () => {
    const w = createWorld({ width: 1000, height: 700, seed: 1 });
    w.asteroids = [];
    w.enemies = [];
    w.wave = BOUNTY.fromWave;
    w.bountyTimer = 0;
    updateWorld(w, IDLE, 0.02);
    expect(w.bases.some((b) => b.elite)).toBe(true);
  });

  it("does not spawn a bounty elite before its wave", () => {
    const w = createWorld({ width: 1000, height: 700, seed: 1 });
    w.asteroids = [];
    w.enemies = [];
    w.wave = BOUNTY.fromWave - 1;
    w.bountyTimer = 0;
    updateWorld(w, IDLE, 0.02);
    expect(w.bases.some((b) => b.elite)).toBe(false);
  });

  it("killing a bounty elite pays the bounty and drops a crate", () => {
    const w = createWorld({ width: 1000, height: 700, seed: 1, asteroids: 0 });
    w.ship.invuln = 999;
    const elite = createEliteBattleship(vec(750, 350), vec(0, 0));
    elite.shield = 0;
    elite.shieldMax = 0; // strip shield so the hull takes the hit
    elite.hp = 1;
    w.bases.push(elite);
    const credits0 = w.credits;
    w.bullets.push(createBullet(vec(750, 350), vec(0, 0), 1, 3, 5));
    updateWorld(w, IDLE, 1 / 120);
    expect(w.bases.length).toBe(0); // destroyed
    expect(w.credits).toBe(credits0 + BATTLESHIPS.fortress.credits + BOUNTY.credits);
    expect(w.crates.length).toBeGreaterThanOrEqual(1); // guaranteed crate
  });

  // REQ-EVENT-02: convoy escort
  it("spawns a convoy from its wave on a timer", () => {
    const w = createWorld({ width: 1000, height: 700, seed: 1 });
    w.asteroids = [];
    w.enemies = [];
    w.wave = CONVOY.fromWave;
    w.convoyTimer = 0;
    updateWorld(w, IDLE, 0.02);
    expect(w.convoyActive).toBe(true);
    expect(w.convoy.length).toBe(CONVOY.count);
  });

  it("an enemy bullet damages a convoy freighter", () => {
    const w = createWorld({ width: 1000, height: 700, seed: 1, asteroids: 0 });
    const f = createFreighter(vec(500, 350), vec(0, 0));
    const hp0 = f.hp;
    w.convoy.push(f);
    w.convoyActive = true;
    w.enemyBullets.push(createBullet(vec(500, 350), vec(0, 0), 5, ENEMY.bulletRadius, 1));
    updateWorld(w, IDLE, 1 / 120);
    expect(w.convoy[0].hp).toBeLessThan(hp0);
    expect(w.enemyBullets.length).toBe(0); // bullet consumed on the freighter
  });

  it("delivering a freighter pays a bonus and drops a reward crate", () => {
    const w = createWorld({ width: 300, height: 300, seed: 1, asteroids: 0 });
    w.convoyActive = true;
    w.convoyDelivered = 0;
    w.convoy.push(createFreighter(vec(w.width + 25, 150), vec(CONVOY.speed, 0))); // just past the edge
    const credits0 = w.credits;
    updateWorld(w, IDLE, 1 / 120);
    expect(w.convoyActive).toBe(false); // event resolved
    expect(w.credits).toBe(credits0 + CONVOY.bonusCredits); // one delivered
    // the reward crate spawns at the ship and is collected immediately -> chooser opens
    expect(w.state).toBe("reward");
  });

  it("a convoy raider pays little and drops no loot", () => {
    const w = createWorld({ width: 900, height: 700, seed: 1, asteroids: 0 });
    w.ship.invuln = 999;
    const raider = createEnemy(vec(450, 350), vec(0, 0), "fighter");
    raider.hunting = "convoy";
    raider.credits = CONVOY.raiderCredits;
    raider.score = CONVOY.raiderScore;
    raider.hp = 1;
    w.enemies.push(raider);
    const credits0 = w.credits;
    w.bullets.push(createBullet(vec(450, 350), vec(0, 0), 1, 3, 5));
    updateWorld(w, IDLE, 1 / 120);
    expect(w.enemies.length).toBe(0); // killed
    expect(w.credits).toBe(credits0 + CONVOY.raiderCredits); // small payout, not the full fighter value
    expect(w.loot.length).toBe(0); // event raiders drop no loot
  });

  it("prioritises the Titan shipyard event at its wave, pausing other events until beaten", () => {
    const w = createWorld({ width: 1000, height: 700, seed: 1 });
    w.asteroids = [];
    w.enemies = [];
    w.wave = WERFT.eventWave; // 5
    w.werftDone = false;
    w.bountyTimer = 0;
    w.convoyTimer = 0;
    updateWorld(w, IDLE, 0.02);
    expect(w.bases.some((b) => b.elite)).toBe(false); // bounty suppressed
    expect(w.convoyActive).toBe(false); // convoy suppressed
  });

  it("starts the Titan shipyard event even with a normal battleship present", () => {
    const w = createWorld({ width: 1000, height: 700, seed: 1 });
    w.asteroids = [];
    w.enemies = [];
    w.wave = WERFT.eventWave;
    w.planet = null;
    w.planetTimer = 0;
    w.bases.push(createBattleship("mandible", vec(500, 350), vec(0, 0)));
    updateWorld(w, IDLE, 0.016);
    expect(w.werft).not.toBeNull(); // shipyard event started despite the battleship
  });

  it("no new event starts while a battleship is on the field", () => {
    const w = createWorld({ width: 1000, height: 700, seed: 1 });
    w.asteroids = [];
    w.enemies = [];
    w.wave = BOUNTY.fromWave;
    w.bountyTimer = 0;
    w.convoyTimer = 0;
    w.bases.push(createBattleship("mandible", vec(500, 350), vec(0, 0)));
    updateWorld(w, IDLE, 0.02);
    expect(w.bases.some((b) => b.elite)).toBe(false); // bounty blocked
    expect(w.convoyActive).toBe(false); // convoy blocked
  });

  // REQ-HUD: pickup toasts, event banners, death cause
  it("shows a pickup toast with the amount", () => {
    const w = createWorld({ width: 400, height: 400, seed: 1, asteroids: 0 });
    let toast = "";
    w.onToast = (t) => {
      toast = t;
    };
    w.loot.push(createLoot({ ...w.ship.position }, "rocket"));
    updateWorld(w, IDLE, 1 / 120);
    expect(toast).toContain("Raketen");
  });

  it("announces an event when it starts (eventBanner)", () => {
    const w = createWorld({ width: 1000, height: 700, seed: 1 });
    w.asteroids = [];
    w.enemies = [];
    w.wave = BOUNTY.fromWave;
    w.bountyTimer = 0;
    updateWorld(w, IDLE, 0.02);
    expect(w.eventBanner).not.toBeNull();
    expect(w.eventBanner?.title).toContain("KOPFGELD");
  });

  it("records the cause of death on game over", () => {
    const w = createWorld({ width: 400, height: 400, seed: 1, asteroids: 0 });
    w.lives = 1;
    w.ship.invuln = 0;
    w.ship.shield = 0;
    w.ship.shieldMax = 0;
    w.asteroids.push(createAsteroid({ ...w.ship.position }, vec(0, 0), "small"));
    updateWorld(w, IDLE, 1 / 120);
    expect(w.state).toBe("gameover");
    expect(w.deathCause).toContain("Asteroid");
  });

  // REQ-REWARD-01: reward crates ("pick 1 of 3")
  it("rolls REWARD.choices distinct reward options", () => {
    const w = createWorld({ width: 800, height: 600, seed: 1, asteroids: 0 });
    const opts = rollRewardChoices(w);
    expect(opts.length).toBe(REWARD.choices);
    expect(new Set(opts.map((o) => o.kind)).size).toBe(opts.length); // all distinct
  });

  it("applyReward grants credits, rockets and a life", () => {
    const w = createWorld({ width: 800, height: 600, seed: 1, asteroids: 0 });
    w.credits = 0;
    applyReward(w, { kind: "credits", amount: 500, label: "", desc: "" });
    expect(w.credits).toBe(500);
    const r0 = w.rocketAmmo;
    applyReward(w, { kind: "rockets", amount: 5, label: "", desc: "" });
    expect(w.rocketAmmo).toBe(r0 + 5);
    w.lives = 2;
    applyReward(w, { kind: "life", amount: 1, label: "", desc: "" });
    expect(w.lives).toBe(3);
  });

  it("collecting a crate opens the reward chooser and pauses the world", () => {
    const w = createWorld({ width: 800, height: 600, seed: 1, asteroids: 0 });
    w.crates.push(createCrate({ ...w.ship.position }));
    updateWorld(w, IDLE, 1 / 120);
    expect(w.state).toBe("reward");
    expect(w.rewardChoices.length).toBe(REWARD.choices);
    expect(w.crates.length).toBe(0); // consumed
  });

  it("chooseReward applies the pick and resumes play", () => {
    const w = createWorld({ width: 800, height: 600, seed: 1, asteroids: 0 });
    w.crates.push(createCrate({ ...w.ship.position }));
    updateWorld(w, IDLE, 1 / 120); // -> reward state
    const idx = Math.max(0, w.rewardChoices.findIndex((o) => o.kind === "credits"));
    const opt = w.rewardChoices[idx];
    const before = w.credits;
    chooseReward(w, idx);
    expect(w.state).toBe("playing");
    expect(w.rewardChoices.length).toBe(0);
    if (opt.kind === "credits") expect(w.credits).toBe(before + opt.amount);
  });

  it("a boss asteroid drops a reward crate", () => {
    const w = createWorld({ width: 800, height: 600, seed: 1, asteroids: 0 });
    w.ship.invuln = 999;
    const boss = createAsteroid(vec(600, 300), vec(0, 0), "boss");
    boss.hp = 1;
    w.asteroids.push(boss);
    w.bullets.push(createBullet(vec(600, 300), vec(0, 0), 1, 3, 5));
    updateWorld(w, IDLE, 1 / 120);
    expect(w.crates.length).toBeGreaterThanOrEqual(1);
  });

  it("a hunter missile that reaches a vulnerable ship costs a life", () => {
    const w = createWorld({ width: 400, height: 400, seed: 1, asteroids: 0 });
    w.werftDone = true;
    w.werft = null;
    w.hunterTimer = 999; // don't spawn more this test
    w.ship.invuln = 0;
    w.ship.shield = 0;
    w.ship.shieldMax = 0;
    const lives0 = w.lives;
    w.siege.push(createSiege({ ...w.ship.position }, vec(0, HUNTER.startSpeed), true, HUNTER.life));
    updateWorld(w, IDLE, 1 / 120);
    expect(w.lives).toBe(lives0 - 1);
  });

  it("the hangar upgrade launches wingmen that fly along and auto-fire", () => {
    const w = createWorld({ width: 900, height: 700, seed: 1, asteroids: 0 });
    w.ownedShips.push("titan");
    w.hangarLevel = WINGMAN.maxLevel;
    equipShip(w, "titan");
    const e = createEnemy(vec(w.ship.position.x + 120, w.ship.position.y), vec(0, 0), "fighter");
    e.fireTimer = 999;
    w.enemies.push(e);
    updateWorld(w, IDLE, 0.05);
    expect(w.wingmen.length).toBe(WINGMAN.maxLevel);
    expect(w.bullets.length).toBeGreaterThan(0); // the drones opened fire
  });

  it("wingmen are dismissed when leaving the Titan", () => {
    const w = createWorld({ width: 900, height: 700, seed: 1, asteroids: 0 });
    w.ownedShips.push("titan");
    w.hangarLevel = WINGMAN.maxLevel;
    equipShip(w, "titan");
    updateWorld(w, IDLE, 0.05);
    expect(w.wingmen.length).toBe(WINGMAN.maxLevel);
    equipShip(w, "vanguard"); // owned from the start
    updateWorld(w, IDLE, 0.05);
    expect(w.wingmen.length).toBe(0);
  });

  it("wingmen ignore asteroids and only fire at enemies", () => {
    const w = createWorld({ width: 900, height: 700, seed: 1, asteroids: 0 });
    w.ownedShips.push("titan");
    w.hangarLevel = WINGMAN.maxLevel;
    equipShip(w, "titan");
    w.ship.invuln = 999;
    w.asteroids.push(createAsteroid(vec(w.ship.position.x + 90, w.ship.position.y), vec(0, 0), "small"));
    for (let i = 0; i < 5; i++) updateWorld(w, IDLE, 0.05);
    expect(w.wingmen.length).toBe(WINGMAN.maxLevel);
    expect(w.bullets.length).toBe(0); // no enemy in range -> drones hold fire
  });

  it("a wingman shot down by an enemy bullet respawns after a delay", () => {
    const w = createWorld({ width: 900, height: 700, seed: 1, asteroids: 0 });
    w.ownedShips.push("titan");
    w.hangarLevel = WINGMAN.maxLevel;
    equipShip(w, "titan");
    w.ship.invuln = 999;
    for (let i = 0; i < 20; i++) updateWorld(w, IDLE, 0.05); // settle into formation
    expect(w.wingmen.length).toBe(WINGMAN.maxLevel);
    const wm = w.wingmen[0];
    w.enemyBullets.push(createBullet({ ...wm.position }, vec(0, 0), 5, ENEMY.bulletRadius, 1));
    updateWorld(w, IDLE, 1 / 240); // tiny step so the drone barely moves before impact
    expect(w.wingmen.length).toBe(WINGMAN.maxLevel - 1);
    expect(w.wingmanRespawn.length).toBe(1);
    // ride out the respawn delay
    const steps = Math.ceil(WINGMAN.respawn / 0.05) + 3;
    for (let i = 0; i < steps; i++) updateWorld(w, IDLE, 0.05);
    expect(w.wingmen.length).toBe(WINGMAN.maxLevel);
    expect(w.wingmanRespawn.length).toBe(0);
  });
});

// REQ-BASE-01: enemy battleships (single hull, one health bar)
describe("enemy battleships", () => {
  it("a player bullet damages a battleship hull", () => {
    const w = createWorld({ width: 800, height: 600, seed: 1, asteroids: 0 });
    w.ship.angle = 0;
    w.ship.invuln = 999;
    const base = createBattleship("mandible", vec(w.ship.position.x + 90, w.ship.position.y), vec(0, 0));
    const hp0 = base.hp;
    w.bases.push(base);
    for (let i = 0; i < 24; i++) updateWorld(w, { ...IDLE, fire: true }, 0.016);
    expect(base.hp).toBeLessThan(hp0);
  });

  it("destroying a battleship removes it, awards credits and drops loot", () => {
    const w = createWorld({ width: 800, height: 600, seed: 1, asteroids: 0 });
    w.ship.angle = 0;
    w.ship.invuln = 999;
    const base = createBattleship("mandible", vec(w.ship.position.x + 90, w.ship.position.y), vec(0, 0));
    base.hp = 1; // one shot to crack it
    w.bases.push(base);
    const creditsBefore = w.credits;
    for (let i = 0; i < 24; i++) updateWorld(w, { ...IDLE, fire: true }, 0.016);
    expect(w.bases.length).toBe(0);
    expect(w.credits).toBeGreaterThan(creditsBefore); // kill reward awarded
    expect(w.loot.length).toBe(1); // wreck drop
  });

  it("from wave 3 (BASE.fromWave) a station spawn can be a battleship", () => {
    const w = createWorld({ width: 900, height: 700, seed: 1 });
    w.ship.invuln = 999;
    w.wave = BASE.fromWave;
    w.enemies = [];
    w.bases = [];
    w.enemyTimer = 0.01;
    // 0.1 -> station (below stationChance) AND battleship (below the wave-3 base chance)
    w.rng = { next: () => 0.1, range: (min, max) => min + (max - min) * 0.1 };
    updateWorld(w, IDLE, 0.02);
    expect(w.bases.length).toBeGreaterThanOrEqual(1);
  });

  it("does not spawn battleships before BASE.fromWave (a station spawns instead)", () => {
    const w = createWorld({ width: 900, height: 700, seed: 1 });
    w.ship.invuln = 999;
    w.wave = BASE.fromWave - 1; // one wave too early
    w.enemies = [];
    w.bases = [];
    w.enemyTimer = 0.01;
    w.rng = { next: () => 0.1, range: (min, max) => min + (max - min) * 0.1 };
    updateWorld(w, IDLE, 0.02);
    expect(w.bases.length).toBe(0);
    expect(w.enemies.length).toBeGreaterThanOrEqual(1);
  });
});

// REQ-BASE-02: battleship shield (blue hull outline that absorbs hits)
describe("battleship shield", () => {
  it("absorbs hits until the shield is down, then the hull takes damage", () => {
    const w = createWorld({ width: 800, height: 600, seed: 1, asteroids: 0 });
    w.ship.angle = 0;
    w.ship.invuln = 999;
    const base = createBattleship("dreadnought", vec(w.ship.position.x + 90, w.ship.position.y), vec(0, 0));
    const maxHp = base.maxHp;
    const shieldMax = base.shieldMax;
    w.bases.push(base);
    // the first hit is soaked by the shield — the hull stays intact
    for (let i = 0; i < 8; i++) updateWorld(w, { ...IDLE, fire: true }, 0.016);
    expect(base.shield).toBeLessThan(shieldMax);
    expect(base.hp).toBe(maxHp);
    // keep firing: the shield fails and the hull starts taking damage
    for (let i = 0; i < 120; i++) updateWorld(w, { ...IDLE, fire: true }, 0.016);
    expect(base.shield).toBe(0);
    expect(base.hp).toBeLessThan(maxHp);
  });

  it("an unshielded raider takes hull damage from the first hits", () => {
    const w = createWorld({ width: 800, height: 600, seed: 1, asteroids: 0 });
    w.ship.angle = 0;
    w.ship.invuln = 999;
    const base = createBattleship("mandible", vec(w.ship.position.x + 90, w.ship.position.y), vec(0, 0));
    expect(base.shieldMax).toBe(0);
    w.bases.push(base);
    for (let i = 0; i < 24; i++) updateWorld(w, { ...IDLE, fire: true }, 0.016);
    expect(base.hp).toBeLessThan(base.maxHp);
  });
});

// REQ-BASE-03/04: battleship weapons (guns fire at the ship, fortress launches fighters)
describe("battleship weapons", () => {
  it("a battleship fires enemy bullets at the ship over time", () => {
    const w = createWorld({ width: 900, height: 700, seed: 1, asteroids: 0 });
    w.ship.invuln = 999;
    w.bases.push(createBattleship("mandible", vec(w.ship.position.x + 300, w.ship.position.y), vec(0, 0)));
    const steps = Math.ceil((BATTLESHIPS.mandible.fireCooldown + 0.2) / 0.02);
    for (let i = 0; i < steps; i++) updateWorld(w, IDLE, 0.02);
    expect(w.enemyBullets.length).toBeGreaterThanOrEqual(1);
  });

  it("a fortress launches fighters over time", () => {
    const w = createWorld({ width: 900, height: 700, seed: 1, asteroids: 0 });
    w.ship.invuln = 999;
    w.bases.push(createBattleship("fortress", vec(w.ship.position.x + 200, w.ship.position.y), vec(0, 0)));
    const steps = Math.ceil((BATTLESHIPS.fortress.hangarCooldown + 0.2) / 0.02);
    for (let i = 0; i < steps; i++) updateWorld(w, IDLE, 0.02);
    expect(w.enemies.filter((e) => e.kind === "fighter").length).toBeGreaterThanOrEqual(1);
  });

  it("a fortress stops launching at the fighter cap", () => {
    const w = createWorld({ width: 900, height: 700, seed: 1, asteroids: 0 });
    w.ship.invuln = 999;
    const cap = BATTLESHIPS.fortress.hangarMaxFighters;
    for (let i = 0; i < cap; i++) {
      w.enemies.push(createEnemy(vec(50 + i * 30, 50), vec(0, 0), "fighter"));
    }
    w.bases.push(createBattleship("fortress", vec(w.ship.position.x + 200, w.ship.position.y), vec(0, 0)));
    const steps = Math.ceil((BATTLESHIPS.fortress.hangarCooldown + 0.2) / 0.02);
    for (let i = 0; i < steps; i++) updateWorld(w, IDLE, 0.02);
    expect(w.enemies.filter((e) => e.kind === "fighter").length).toBe(cap); // no extra launches
  });
});

// REQ-BOSS-01: boss asteroids
describe("boss asteroid", () => {
  it("destroying a boss awards its score and drops loot", () => {
    const w = createWorld({ width: 800, height: 600, seed: 1, asteroids: 0 });
    w.ship.angle = 0;
    const boss = createAsteroid(vec(w.ship.position.x + 120, w.ship.position.y), vec(0, 0), "boss");
    boss.hp = 1; // one shot for the test
    w.asteroids.push(boss);
    const scoreBefore = w.score;
    updateWorld(w, { ...IDLE, fire: true }, 0.016);
    for (let i = 0; i < 12; i++) updateWorld(w, IDLE, 0.016);
    expect(w.score).toBe(scoreBefore + ASTEROID.sizes.boss.score);
    expect(w.asteroids.every((a) => a.size === "large")).toBe(true);
    expect(w.asteroids.length).toBe(ASTEROID.sizes.boss.splits);
    expect(w.loot.length).toBe(1);
  });
});

// REQ-COL-03
describe("ship hits asteroid", () => {
  it("loses a life and resets the ship while lives remain", () => {
    const w = createWorld({ width: 800, height: 600, seed: 1, asteroids: 0 });
    const livesBefore = w.lives;
    w.ship.velocity = vec(120, 0);
    w.asteroids.push(createAsteroid(w.ship.position, vec(0, 0), "large")); // overlapping the ship
    updateWorld(w, IDLE, 0.016);
    expect(w.lives).toBe(livesBefore - 1);
    expect(w.ship.position.x).toBeCloseTo(400);
    expect(w.ship.position.y).toBeCloseTo(300);
    expect(length(w.ship.velocity)).toBeCloseTo(0);
    expect(w.state).toBe("playing");
  });

  it("ends the game when the last life is lost", () => {
    const w = createWorld({ width: 800, height: 600, seed: 1, asteroids: 0, lives: 1 });
    w.asteroids.push(createAsteroid(w.ship.position, vec(0, 0), "large"));
    updateWorld(w, IDLE, 0.016);
    expect(w.lives).toBe(0);
    expect(w.state).toBe("gameover");
  });

  it("uses the ship collision radius from constants", () => {
    expect(SHIP.radius).toBeGreaterThan(0);
  });
});
