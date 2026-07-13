import { describe, it, expect } from "vitest";
import { createBattleship, createEliteBattleship, updateBase, isBaseDead } from "../src/game/base.ts";
import { vec } from "../src/engine/vector2.ts";
import { BASE, BATTLESHIPS, BOUNTY } from "../src/game/constants.ts";

// REQ-BASE-01: enemy battleships (single hull, one health bar)
describe("enemy battleship", () => {
  it("the bounty elite is a buffed fortress worth a bounty", () => {
    const e = createEliteBattleship(vec(0, 0), vec(-10, 0));
    expect(e.elite).toBe(true);
    expect(e.bounty).toBe(BOUNTY.credits);
    expect(e.hp).toBeGreaterThan(BATTLESHIPS.fortress.hp);
    expect(e.shieldMax).toBeGreaterThan(BATTLESHIPS.fortress.shieldMax);
  });

  it("builds a ship from its design spec (hp, radius, shield)", () => {
    const spec = BATTLESHIPS.dreadnought;
    const b = createBattleship("dreadnought", vec(100, 100), vec(0, 0));
    expect(b.design).toBe("dreadnought");
    expect(b.hp).toBe(spec.hp);
    expect(b.maxHp).toBe(spec.hp);
    expect(b.radius).toBe(spec.radius);
    expect(b.shieldMax).toBe(spec.shieldMax);
    expect(b.shield).toBe(spec.shieldMax);
    expect(b.life).toBe(BASE.life);
  });

  it("faces its travel direction", () => {
    const b = createBattleship("mandible", vec(0, 0), vec(-10, 0)); // drifting left
    expect(b.angle).toBeCloseTo(Math.PI);
  });

  it("the mandible raider carries no shield", () => {
    const b = createBattleship("mandible", vec(0, 0), vec(0, 0));
    expect(b.shieldMax).toBe(0);
    expect(b.shield).toBe(0);
  });

  it("drifts, wraps and counts down its life", () => {
    const b = createBattleship("dreadnought", vec(795, 100), vec(100, 0));
    const life0 = b.life;
    updateBase(b, 0.1, { width: 800, height: 600 }); // 795 + 10 -> wraps to 5
    expect(b.position.x).toBeCloseTo(5);
    expect(b.life).toBeLessThan(life0);
  });

  it("regenerates a spent shield charge after the recharge delay", () => {
    const b = createBattleship("fortress", vec(0, 0), vec(0, 0));
    b.shield -= 1; // spend one charge
    const spent = b.shield;
    b.shieldRecharge = 0.05;
    updateBase(b, 0.1, { width: 800, height: 600 });
    expect(b.shield).toBe(spent + 1);
    expect(b.shieldRecharge).toBeCloseTo(BASE.shieldRechargeDelay);
  });

  it("is dead only once its health bar is empty", () => {
    const b = createBattleship("mandible", vec(0, 0), vec(0, 0));
    expect(isBaseDead(b)).toBe(false);
    b.hp = 0;
    expect(isBaseDead(b)).toBe(true);
  });
});
