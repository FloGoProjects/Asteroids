/** Reward crate dropped by bosses/battleships/events; collect it to pick 1 of 3 rewards. REQ-REWARD-01. */
import { Vec, add, scale } from "../engine/vector2.ts";
import { wrapVec } from "../engine/wrap.ts";
import { WorldBounds } from "./ship.ts";
import { Rng } from "../engine/random.ts";
import { REWARD } from "./constants.ts";

export interface Crate {
  position: Vec;
  velocity: Vec;
  radius: number;
  life: number; // seconds before it drifts off / despawns
  spin: number; // render rotation phase
}

export function createCrate(position: Vec, rng?: Rng): Crate {
  const dir = rng ? rng.range(0, Math.PI * 2) : 0;
  return {
    position: { ...position },
    velocity: { x: Math.cos(dir) * REWARD.crateDrift, y: Math.sin(dir) * REWARD.crateDrift },
    radius: REWARD.crateRadius,
    life: REWARD.crateLife,
    spin: 0,
  };
}

export function updateCrate(c: Crate, dt: number, world: WorldBounds): void {
  c.position = wrapVec(add(c.position, scale(c.velocity, dt)), world.width, world.height);
  c.spin += dt;
  c.life -= dt;
}

export const isCrateGone = (c: Crate): boolean => c.life <= 0;
