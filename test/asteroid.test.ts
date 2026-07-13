import { describe, it, expect } from "vitest";
import { createAsteroid, updateAsteroid, splitAsteroid } from "../src/game/asteroid.ts";
import { vec, length } from "../src/engine/vector2.ts";
import { ASTEROID } from "../src/game/constants.ts";
import { createRng } from "../src/engine/random.ts";

const world = { width: 800, height: 600 };

// REQ-AST-01
describe("asteroid movement", () => {
  it("moves according to its velocity", () => {
    const a = createAsteroid(vec(100, 100), vec(50, -30), "large");
    updateAsteroid(a, 0.1, world);
    expect(a.position.x).toBeCloseTo(105);
    expect(a.position.y).toBeCloseTo(97);
  });

  it("wraps around all edges", () => {
    const a = createAsteroid(vec(5, 5), vec(-100, -100), "large");
    updateAsteroid(a, 0.1, world); // (5-10, 5-10) = (-5,-5) -> (795, 595)
    expect(a.position.x).toBeCloseTo(795);
    expect(a.position.y).toBeCloseTo(595);
  });

  it("derives its collision radius from its size", () => {
    expect(createAsteroid(vec(0, 0), vec(0, 0), "large").radius).toBe(ASTEROID.sizes.large.radius);
    expect(createAsteroid(vec(0, 0), vec(0, 0), "medium").radius).toBe(ASTEROID.sizes.medium.radius);
    expect(createAsteroid(vec(0, 0), vec(0, 0), "small").radius).toBe(ASTEROID.sizes.small.radius);
  });
});

// REQ-DMG-01
describe("asteroid hit points", () => {
  it("starts with hp based on its size (large > medium > small)", () => {
    expect(createAsteroid(vec(0, 0), vec(0, 0), "large").hp).toBe(ASTEROID.sizes.large.hp);
    expect(createAsteroid(vec(0, 0), vec(0, 0), "medium").hp).toBe(ASTEROID.sizes.medium.hp);
    expect(createAsteroid(vec(0, 0), vec(0, 0), "small").hp).toBe(ASTEROID.sizes.small.hp);
  });

  it("exposes maxHp equal to the starting hp", () => {
    const a = createAsteroid(vec(0, 0), vec(0, 0), "large");
    expect(a.maxHp).toBe(a.hp);
  });
});

// REQ-AST-02
describe("asteroid splitting", () => {
  it("splits a large asteroid into two medium ones at its position", () => {
    const rng = createRng(7);
    const a = createAsteroid(vec(120, 200), vec(50, 0), "large", rng);
    const children = splitAsteroid(a, rng);
    expect(children).toHaveLength(2);
    for (const c of children) {
      expect(c.size).toBe("medium");
      expect(c.radius).toBe(ASTEROID.sizes.medium.radius);
      expect(c.position.x).toBeCloseTo(120);
      expect(c.position.y).toBeCloseTo(200);
    }
  });

  it("splits a medium asteroid into two small ones", () => {
    const rng = createRng(7);
    const a = createAsteroid(vec(0, 0), vec(60, 0), "medium", rng);
    const children = splitAsteroid(a, rng);
    expect(children).toHaveLength(2);
    expect(children.every((c) => c.size === "small")).toBe(true);
  });

  it("does not split a small asteroid (it is destroyed)", () => {
    const rng = createRng(7);
    const a = createAsteroid(vec(0, 0), vec(60, 0), "small", rng);
    expect(splitAsteroid(a, rng)).toHaveLength(0);
  });

  it("a boss asteroid has high hp and a large radius", () => {
    const boss = createAsteroid(vec(0, 0), vec(0, 0), "boss");
    expect(boss.hp).toBe(ASTEROID.sizes.boss.hp);
    expect(boss.radius).toBe(ASTEROID.sizes.boss.radius);
    expect(boss.radius).toBeGreaterThan(ASTEROID.sizes.large.radius);
    expect(boss.hp).toBeGreaterThan(ASTEROID.sizes.large.hp);
  });

  it("a boss splits into several large asteroids", () => {
    const rng = createRng(4);
    const boss = createAsteroid(vec(100, 100), vec(20, 0), "boss", rng);
    const children = splitAsteroid(boss, rng);
    expect(children.length).toBe(ASTEROID.sizes.boss.splits);
    expect(children.length).toBeGreaterThan(2);
    expect(children.every((c) => c.size === "large")).toBe(true);
  });

  it("gives children diverging headings and at least the parent's speed", () => {
    const rng = createRng(3);
    const a = createAsteroid(vec(300, 300), vec(80, 0), "large", rng);
    const parentSpeed = length(a.velocity);
    const [c1, c2] = splitAsteroid(a, rng);
    expect(length(c1.velocity)).toBeGreaterThanOrEqual(parentSpeed);
    expect(length(c2.velocity)).toBeGreaterThanOrEqual(parentSpeed);
    // headings differ from one another
    const h1 = Math.atan2(c1.velocity.y, c1.velocity.x);
    const h2 = Math.atan2(c2.velocity.y, c2.velocity.x);
    expect(Math.abs(h1 - h2)).toBeGreaterThan(0.1);
  });
});
