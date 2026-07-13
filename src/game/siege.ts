/** Siege missile: slow projectile that flies at the shipyard planet and detonates on it. REQ-WERFT-01. */
import { Vec, add, scale } from "../engine/vector2.ts";
import { WERFT } from "./constants.ts";

export interface SiegeMissile {
  position: Vec;
  velocity: Vec; // heading (toward the planet, or toward the ship when homing)
  radius: number; // hit radius (planet/ship impact + player intercept)
  homing: boolean; // false = event missile (straight to planet), true = post-event hunter (chases ship)
  speed: number; // current speed magnitude (hunters accelerate this over time)
  life: number; // seconds left before it fizzles (hunters only; event missiles ignore it)
}

export function createSiege(position: Vec, velocity: Vec, homing = false, life = Infinity): SiegeMissile {
  return {
    position: { ...position },
    velocity: { ...velocity },
    radius: WERFT.siegeRadius,
    homing,
    speed: Math.hypot(velocity.x, velocity.y),
    life,
  };
}

export function updateSiege(m: SiegeMissile, dt: number): void {
  m.position = add(m.position, scale(m.velocity, dt));
}
