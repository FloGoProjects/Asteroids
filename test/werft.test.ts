import { describe, it, expect } from "vitest";
import { createWorld, updateWorld } from "../src/game/world.ts";
import { createSiege } from "../src/game/siege.ts";
import { createBullet } from "../src/game/bullet.ts";
import { createPlanet } from "../src/game/planet.ts";
import { vec } from "../src/engine/vector2.ts";
import { WERFT, PLANET } from "../src/game/constants.ts";

const IDLE = { turnLeft: false, turnRight: false, thrust: false, fire: false, fireSecondary: false };

/** A live wave-mode world with the asteroid field cleared out for a focused test. */
const waveWorld = () => {
  const w = createWorld({ width: 1280, height: 720, seed: 1 });
  w.asteroids = [];
  w.enemies = [];
  return w;
};

/** Reset the planet slot in a helper so TS doesn't narrow w.planet to null across updateWorld. */
const armPlanetSpawn = (w: ReturnType<typeof waveWorld>) => {
  w.planet = null;
  w.planetTimer = 0;
};

describe("shipyard-defense event (REQ-WERFT-01)", () => {
  it("triggers at the event wave with an approaching shipyard planet", () => {
    const w = waveWorld();
    w.wave = WERFT.eventWave;
    armPlanetSpawn(w);
    updateWorld(w, IDLE, 0.016);
    expect(w.werft).not.toBeNull();
    expect(w.werft?.phase).toBe("approach");
    expect(w.planet?.kind).toBe("shipyard");
  });

  it("does not trigger before the event wave (normal planet instead)", () => {
    const w = waveWorld();
    w.wave = WERFT.eventWave - 1;
    armPlanetSpawn(w);
    updateWorld(w, IDLE, 0.016);
    expect(w.werft).toBeNull();
    expect(w.planet?.kind).toBe("normal");
  });

  it("drifts to the centre and switches to the defend phase", () => {
    const w = waveWorld();
    w.wave = WERFT.eventWave;
    armPlanetSpawn(w);
    updateWorld(w, IDLE, 0.016); // start the event
    for (let i = 0; i < 500 && w.werft?.phase === "approach"; i++) updateWorld(w, IDLE, 0.05);
    expect(w.werft?.phase).toBe("defend");
    expect(Math.abs(w.planet!.position.x - w.width / 2)).toBeLessThan(2);
    expect(Math.abs(w.planet!.position.y - w.height / 2)).toBeLessThan(2);
  });

  it("blocks landing while the shipyard is still under siege", () => {
    const w = waveWorld();
    w.werft = { phase: "defend", hp: 3, hpMax: 6, toLaunch: 5, launchTimer: 1 };
    w.planet = createPlanet(vec(w.width / 2, w.height / 2), vec(0, 0), PLANET.radius, undefined, "shipyard");
    w.ship.position = vec(w.width / 2, w.height / 2); // sitting on the pad
    updateWorld(w, IDLE, 0.2);
    expect(w.landProgress).toBe(0);
    expect(w.state).toBe("playing"); // shop did not open
  });

  it("intercepts a siege missile with a bullet, scoring credits", () => {
    const w = createWorld({ width: 800, height: 600, seed: 1, asteroids: 0 });
    w.credits = 0;
    w.siege = [createSiege(vec(400, 300), vec(0, 0))];
    w.bullets = [createBullet(vec(400, 300), vec(0, 0), 1, 3, 1)];
    updateWorld(w, IDLE, 0.016);
    expect(w.siege.length).toBe(0);
    expect(w.bullets.length).toBe(0);
    expect(w.credits).toBe(WERFT.siegeCredits);
  });

  it("wins once every missile is dealt with, handing the shipyard back to drift", () => {
    const w = createWorld({ width: 800, height: 600, seed: 1, asteroids: 0 });
    w.werft = { phase: "defend", hp: 3, hpMax: 6, toLaunch: 0, launchTimer: 99 };
    w.planet = createPlanet(vec(400, 300), vec(0, 0), PLANET.radius, undefined, "shipyard");
    w.siege = [];
    updateWorld(w, IDLE, 0.016);
    expect(w.werftDone).toBe(true);
    expect(w.werft).toBeNull();
    expect(w.planet).not.toBeNull();
    expect(Math.abs(w.planet!.velocity.x)).toBeGreaterThan(0); // drifting off again
  });

  it("fails when the shipyard's damage bar is depleted", () => {
    const w = createWorld({ width: 800, height: 600, seed: 1, asteroids: 0 });
    w.werft = { phase: "defend", hp: 1, hpMax: 6, toLaunch: 0, launchTimer: 99 };
    w.planet = createPlanet(vec(400, 300), vec(0, 0), PLANET.radius, undefined, "shipyard");
    w.siege = [createSiege(vec(400, 300), vec(0, 0))]; // sitting on the planet -> detonates
    updateWorld(w, IDLE, 0.016);
    expect(w.werft).toBeNull();
    expect(w.werftDone).toBe(false);
    expect(w.planet).toBeNull();
  });

  it("opens a shipyard shop (Titan available) when landing on a shipyard planet", () => {
    const w = createWorld({ width: 800, height: 600, seed: 1, asteroids: 0 });
    w.werftDone = true;
    w.planet = createPlanet(vec(400, 300), vec(0, 0), PLANET.radius, undefined, "shipyard");
    w.ship.position = vec(400, 300);
    const steps = Math.ceil(PLANET.landTime / 0.1) + 2;
    for (let i = 0; i < steps; i++) updateWorld(w, IDLE, 0.1);
    expect(w.state).toBe("shop");
    expect(w.atShipyard).toBe(true);
  });

  it("marks the shop as normal (no Titan) when landing on a normal planet", () => {
    const w = createWorld({ width: 800, height: 600, seed: 1, asteroids: 0 });
    w.planet = createPlanet(vec(400, 300), vec(0, 0), PLANET.radius, undefined, "normal");
    w.ship.position = vec(400, 300);
    const steps = Math.ceil(PLANET.landTime / 0.1) + 2;
    for (let i = 0; i < steps; i++) updateWorld(w, IDLE, 0.1);
    expect(w.state).toBe("shop");
    expect(w.atShipyard).toBe(false);
  });

  it("spawns shipyard planets (~1/3) only after the defense is won", () => {
    const w = createWorld({ width: 1280, height: 720, seed: 1, asteroids: 0 });
    w.werftDone = true;
    const kinds: (string | undefined)[] = [];
    for (let i = 0; i < 80; i++) {
      armPlanetSpawn(w);
      updateWorld(w, IDLE, 0.05);
      kinds.push(w.planet?.kind);
    }
    expect(kinds).toContain("shipyard");
    expect(kinds).toContain("normal");
  });
});
