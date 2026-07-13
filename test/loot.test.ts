import { describe, it, expect } from "vitest";
import { createLoot, updateLoot, isLootGone } from "../src/game/loot.ts";
import { vec } from "../src/engine/vector2.ts";
import { LOOT } from "../src/game/constants.ts";

const world = { width: 800, height: 600 };

// REQ-LOOT-01
describe("loot", () => {
  it("carries its kind and a collision radius", () => {
    const l = createLoot(vec(100, 100), "shield");
    expect(l.kind).toBe("shield");
    expect(l.radius).toBe(LOOT.radius);
    expect(l.life).toBeCloseTo(LOOT.life);
  });

  it("drifts, wraps and counts down its life", () => {
    const l = createLoot(vec(795, 100), "ammo");
    l.velocity = vec(100, 0);
    updateLoot(l, 0.1, world); // 795 + 10 = 805 -> wraps to 5
    expect(l.position.x).toBeCloseTo(5);
    expect(l.life).toBeLessThan(LOOT.life);
  });

  it("is gone when its life runs out", () => {
    const l = createLoot(vec(100, 100), "antigrav");
    l.life = 0.05;
    expect(isLootGone(l)).toBe(false);
    updateLoot(l, 0.1, world);
    expect(isLootGone(l)).toBe(true);
  });
});
