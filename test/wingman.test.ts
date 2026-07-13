import { describe, it, expect } from "vitest";
import { createWingman, steerWingman } from "../src/game/wingman.ts";
import { vec } from "../src/engine/vector2.ts";
import { WINGMAN } from "../src/game/constants.ts";

// REQ-SHIP-05: hangar wingmen
describe("wingman drone", () => {
  it("starts at the given position in its slot", () => {
    const wm = createWingman(1, vec(100, 50));
    expect(wm.position).toEqual({ x: 100, y: 50 });
    expect(wm.slot).toBe(1);
    expect(wm.fireTimer).toBe(0);
  });

  it("eases toward its formation target without teleporting", () => {
    const wm = createWingman(0, vec(0, 0));
    steerWingman(wm, vec(100, 0), 0.1);
    expect(wm.position.x).toBeGreaterThan(0);
    expect(wm.position.x).toBeLessThan(100);
  });

  it("snaps into place when it falls far behind (screen wrap)", () => {
    const wm = createWingman(0, vec(0, 0));
    const target = vec(WINGMAN.snapDist + 50, 0);
    steerWingman(wm, target, 0.016);
    expect(wm.position).toEqual(target);
  });
});
