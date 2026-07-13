/** Siege missile: slow projectile that flies at the shipyard planet and detonates on it. REQ-WERFT-01. */
import { Vec, add, scale } from "../engine/vector2.ts";
import { WERFT } from "./constants.ts";

export interface SiegeMissile {
  position: Vec;
  velocity: Vec; // constant heading toward the planet centre
  radius: number; // hit radius (planet impact + player intercept)
}

export function createSiege(position: Vec, velocity: Vec): SiegeMissile {
  return { position: { ...position }, velocity: { ...velocity }, radius: WERFT.siegeRadius };
}

export function updateSiege(m: SiegeMissile, dt: number): void {
  m.position = add(m.position, scale(m.velocity, dt));
}
