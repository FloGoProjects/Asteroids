import { describe, it, expect } from "vitest";
import {
  createEnemy,
  updateEnemy,
  isEnemyGone,
  pickEnemyKind,
  advanceStationBeam,
} from "../src/game/enemy.ts";
import { vec } from "../src/engine/vector2.ts";
import { ENEMY, STATION } from "../src/game/constants.ts";

const world = { width: 800, height: 600 };

// REQ-ENEMY-01
describe("enemy", () => {
  it("starts with hp and a collision radius", () => {
    const e = createEnemy(vec(100, 100), vec(50, 0));
    expect(e.hp).toBe(ENEMY.hp);
    expect(e.radius).toBe(ENEMY.radius);
  });

  it("moves by its velocity and wraps, counting down its life", () => {
    const e = createEnemy(vec(795, 100), vec(100, 0));
    updateEnemy(e, 0.1, world); // 795 + 10 = 805 -> wraps to 5
    expect(e.position.x).toBeCloseTo(5);
    expect(e.life).toBeLessThan(ENEMY.life);
  });

  it("is gone when its life runs out", () => {
    const e = createEnemy(vec(100, 100), vec(0, 0));
    e.life = 0.05;
    expect(isEnemyGone(e)).toBe(false);
    updateEnemy(e, 0.1, world);
    expect(isEnemyGone(e)).toBe(true);
  });
});

// REQ-ENEMY-02
describe("space stations", () => {
  it("a station has much more hp and a larger radius than a fighter", () => {
    const fighter = createEnemy(vec(0, 0), vec(0, 0), "fighter");
    const station = createEnemy(vec(0, 0), vec(0, 0), "station");
    expect(station.kind).toBe("station");
    expect(station.hp).toBe(STATION.hp);
    expect(station.hp).toBeGreaterThan(fighter.hp);
    expect(station.radius).toBeGreaterThan(fighter.radius);
  });

  it("pickEnemyKind stays a fighter on wave 1 and can be a station from wave 2", () => {
    expect(pickEnemyKind(1, 0)).toBe("fighter"); // never a station before wave 2
    expect(pickEnemyKind(2, 0)).toBe("station"); // low roll -> station
    expect(pickEnemyKind(2, 0.99)).toBe("fighter"); // high roll -> fighter
  });

  it("charging beam cycles aim -> charge -> fire -> cooldown, live only while firing", () => {
    const e = createEnemy(vec(0, 0), vec(0, 0), "station");
    expect(e.beamPhase).toBe("idle");

    // aim window elapses -> starts charging and locks the aim
    let live = advanceStationBeam(e, STATION.beamAim + 0.01, 0.5);
    expect(e.beamPhase).toBe("charging");
    expect(e.beamAngle).toBeCloseTo(0.5);
    expect(live).toBe(false);

    // charge elapses -> beam goes live; aim stays locked even as the target moves
    live = advanceStationBeam(e, STATION.beamCharge + 0.01, 2.0);
    expect(e.beamPhase).toBe("firing");
    expect(e.beamAngle).toBeCloseTo(0.5);
    expect(live).toBe(true);

    // still within the firing window
    live = advanceStationBeam(e, STATION.beamTime * 0.5, 2.0);
    expect(live).toBe(true);

    // firing ends -> back to idle (cooldown), no longer live
    live = advanceStationBeam(e, STATION.beamTime, 2.0);
    expect(e.beamPhase).toBe("idle");
    expect(live).toBe(false);
  });
});
