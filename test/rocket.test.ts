import { describe, it, expect } from "vitest";
import { createRocket, steerRocket, updateRocket, isRocketGone } from "../src/game/rocket.ts";
import { vec } from "../src/engine/vector2.ts";
import { ROCKET } from "../src/game/constants.ts";

const world = { width: 800, height: 600 };

// REQ-ROCKET-01
describe("rocket", () => {
  it("creates a rocket with speed, life and an optional target", () => {
    const target = { position: vec(200, 100) };
    const r = createRocket(vec(100, 100), 0, target);
    expect(r.velocity.x).toBeCloseTo(ROCKET.speed); // fired along +x
    expect(r.velocity.y).toBeCloseTo(0);
    expect(r.life).toBeCloseTo(ROCKET.life);
    expect(r.damage).toBe(ROCKET.damage);
    expect(r.target).toBe(target);
  });

  it("steers its velocity toward the target within the turn rate", () => {
    const r = createRocket(vec(100, 100), 0, null); // heading +x (angle 0)
    steerRocket(r, vec(100, 300), 0.1); // target straight below -> desired angle +PI/2
    const angle = Math.atan2(r.velocity.y, r.velocity.x);
    expect(angle).toBeGreaterThan(0); // turned toward the target (+angle)
    expect(angle).toBeLessThanOrEqual(ROCKET.turnRate * 0.1 + 1e-6); // but capped by turn rate
  });

  it("moves, wraps and counts down its life", () => {
    const r = createRocket(vec(795, 100), 0, null);
    r.velocity = vec(100, 0);
    updateRocket(r, 0.1, world); // 795 + 10 = 805 -> wraps to 5
    expect(r.position.x).toBeCloseTo(5);
    expect(r.life).toBeLessThan(ROCKET.life);
  });

  it("is gone when its life runs out", () => {
    const r = createRocket(vec(100, 100), 0, null);
    r.life = 0.05;
    expect(isRocketGone(r)).toBe(false);
    updateRocket(r, 0.1, world);
    expect(isRocketGone(r)).toBe(true);
  });
});
