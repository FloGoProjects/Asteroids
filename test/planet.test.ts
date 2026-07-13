import { describe, it, expect } from "vitest";
import { createPlanet, updatePlanet, isPlanetGone } from "../src/game/planet.ts";
import { vec } from "../src/engine/vector2.ts";

// REQ-PLANET-01
describe("planet", () => {
  it("drifts horizontally with no vertical motion", () => {
    const p = createPlanet(vec(-70, 300), vec(55, 0), 70);
    updatePlanet(p, 1);
    expect(p.position.x).toBeCloseTo(-15);
    expect(p.position.y).toBeCloseTo(300);
  });

  it("is not gone while still partly on screen", () => {
    const width = 800;
    const p = createPlanet(vec(width + 70 - 1, 300), vec(55, 0), 70);
    expect(isPlanetGone(p, width)).toBe(false);
  });

  it("is gone once fully past the right edge", () => {
    const width = 800;
    const p = createPlanet(vec(width + 70 + 1, 300), vec(55, 0), 70);
    expect(isPlanetGone(p, width)).toBe(true);
  });

  it("is gone once fully past the left edge", () => {
    const p = createPlanet(vec(-71, 300), vec(-55, 0), 70);
    expect(isPlanetGone(p, 800)).toBe(true);
  });
});
