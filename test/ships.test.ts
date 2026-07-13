import { describe, it, expect } from "vitest";
import { SHIPS } from "../src/game/constants.ts";

// REQ-SHIP-03
describe("ship specs", () => {
  it("Delta Raptor is more agile than the Vanguard", () => {
    const v = SHIPS.vanguard;
    const d = SHIPS.deltaRaptor;
    expect(d.turnSpeed).toBeGreaterThan(v.turnSpeed);
    expect(d.thrust).toBeGreaterThan(v.thrust);
    expect(d.maxSpeed).toBeGreaterThan(v.maxSpeed);
    expect(d.radius).toBeLessThan(v.radius); // smaller hitbox
  });

  it("Titan is a slow, heavily-armored battleship with turrets and shields", () => {
    const v = SHIPS.vanguard;
    const t = SHIPS.titan;
    expect(t.turnSpeed).toBeLessThan(v.turnSpeed);
    expect(t.thrust).toBeLessThan(v.thrust);
    expect(t.maxSpeed).toBeLessThan(v.maxSpeed);
    expect(t.radius).toBeGreaterThan(v.radius); // big hull, easy to hit
    expect(t.shieldCapacity ?? 0).toBeGreaterThan(0);
    expect((t.turrets ?? []).length).toBeGreaterThanOrEqual(2);
  });
});
