import { describe, it, expect } from "vitest";
import { WEAPONS, AMMO } from "../src/game/constants.ts";

// REQ-WEAPON-01, REQ-AMMO-01
describe("weapon specs", () => {
  it("defines the laser, Vulkan MK and Ballista", () => {
    expect(WEAPONS.laser).toBeDefined();
    expect(WEAPONS.vulkan).toBeDefined();
    expect(WEAPONS.ballista).toBeDefined();
  });

  it("Vulkan MK: fast, short range, single shot with a wide spread cone", () => {
    expect(WEAPONS.vulkan.cooldown).toBeLessThan(WEAPONS.laser.cooldown);
    expect(WEAPONS.vulkan.bulletLife).toBeLessThan(WEAPONS.laser.bulletLife);
    expect(WEAPONS.vulkan.pellets).toBe(1); // one bullet at a time
    expect(WEAPONS.vulkan.spread).toBeGreaterThan(0.4); // ~30 degree cone
  });

  it("Ballista: slower, longer range, precise, higher damage", () => {
    expect(WEAPONS.ballista.cooldown).toBeGreaterThan(WEAPONS.laser.cooldown);
    expect(WEAPONS.ballista.bulletLife).toBeGreaterThan(WEAPONS.laser.bulletLife);
    expect(WEAPONS.ballista.spread).toBe(0);
    expect(WEAPONS.ballista.damage).toBeGreaterThan(WEAPONS.laser.damage);
  });
});

describe("ammo specs", () => {
  it("standard is neutral, AP doubles damage, explosive detonates on proximity", () => {
    expect(AMMO.standard.damageMult).toBe(1);
    expect(AMMO.standard.blast).toBe(0);
    expect(AMMO.ap.damageMult).toBe(2);
    expect(AMMO.ap.blast).toBe(0);
    expect(AMMO.explosive.blast).toBeGreaterThan(0); // proximity/AoE fuse
  });

  it("special ammo packs are sizeable", () => {
    expect(AMMO.ap.packSize).toBeGreaterThanOrEqual(50);
    expect(AMMO.explosive.packSize).toBeGreaterThanOrEqual(50);
  });
});
