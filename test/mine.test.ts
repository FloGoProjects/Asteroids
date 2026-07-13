import { describe, it, expect } from "vitest";
import { createMine, updateMine, isMineGone } from "../src/game/mine.ts";
import { vec } from "../src/engine/vector2.ts";
import { MINE } from "../src/game/constants.ts";

const world = { width: 800, height: 600 };

// REQ-MINE-01
describe("mine", () => {
  it("creates a mine with a trigger radius, life and damage", () => {
    const m = createMine(vec(100, 100), vec(0, 0));
    expect(m.radius).toBe(MINE.radius);
    expect(m.life).toBeCloseTo(MINE.life);
    expect(m.damage).toBe(MINE.damage);
  });

  it("drifts, wraps and counts down its life", () => {
    const m = createMine(vec(795, 100), vec(100, 0));
    updateMine(m, 0.1, world); // 795 + 10 = 805 -> wraps to 5
    expect(m.position.x).toBeCloseTo(5);
    expect(m.life).toBeLessThan(MINE.life);
  });

  it("is gone when its life runs out", () => {
    const m = createMine(vec(100, 100), vec(0, 0));
    m.life = 0.05;
    expect(isMineGone(m)).toBe(false);
    updateMine(m, 0.1, world);
    expect(isMineGone(m)).toBe(true);
  });
});
