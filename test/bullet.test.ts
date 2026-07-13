import { describe, it, expect } from "vitest";
import { createBullet, updateBullet, isExpired } from "../src/game/bullet.ts";
import { vec } from "../src/engine/vector2.ts";

const world = { width: 800, height: 600 };

// REQ-BULLET-02
describe("bullet", () => {
  it("moves according to its velocity", () => {
    const b = createBullet(vec(100, 100), vec(200, 0), 1);
    updateBullet(b, 0.1, world);
    expect(b.position.x).toBeCloseTo(120);
    expect(b.position.y).toBeCloseTo(100);
  });

  it("wraps around the edges", () => {
    const b = createBullet(vec(790, 100), vec(200, 0), 1);
    updateBullet(b, 0.1, world); // 790 + 20 = 810 -> wraps to 10
    expect(b.position.x).toBeCloseTo(10);
  });

  it("counts down its lifetime and expires", () => {
    const b = createBullet(vec(0, 0), vec(0, 0), 0.15);
    expect(isExpired(b)).toBe(false);
    updateBullet(b, 0.1, world);
    expect(isExpired(b)).toBe(false);
    updateBullet(b, 0.1, world); // total 0.2 > 0.15
    expect(isExpired(b)).toBe(true);
  });
});
