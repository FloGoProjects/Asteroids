/** Collectible loot dropped by enemies. REQ-LOOT-01. */
import { Vec, add, scale } from "../engine/vector2.ts";
import { wrapVec } from "../engine/wrap.ts";
import { WorldBounds } from "./ship.ts";
import { Rng } from "../engine/random.ts";
import { LOOT, LootKind } from "./constants.ts";

export interface Loot {
  position: Vec;
  velocity: Vec;
  radius: number;
  kind: LootKind;
  life: number; // seconds before it disappears
  spin: number; // render rotation phase
}

export function createLoot(position: Vec, kind: LootKind, rng?: Rng): Loot {
  const dir = rng ? rng.range(0, Math.PI * 2) : 0;
  return {
    position: { ...position },
    velocity: {
      x: Math.cos(dir) * LOOT.drift,
      y: Math.sin(dir) * LOOT.drift,
    },
    radius: LOOT.radius,
    kind,
    life: LOOT.life,
    spin: 0,
  };
}

export function updateLoot(l: Loot, dt: number, world: WorldBounds): void {
  l.position = wrapVec(add(l.position, scale(l.velocity, dt)), world.width, world.height);
  l.spin += dt;
  l.life -= dt;
}

export const isLootGone = (l: Loot): boolean => l.life <= 0;
