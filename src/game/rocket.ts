/** Homing rockets. REQ-ROCKET-01. */
import { Vec, add, scale, fromAngle } from "../engine/vector2.ts";
import { wrapVec } from "../engine/wrap.ts";
import { WorldBounds } from "./ship.ts";
import { ROCKET } from "./constants.ts";

/** Anything a rocket can chase (enemies and asteroids both have a position). */
export interface Targetable {
  position: Vec;
}

export interface Rocket {
  position: Vec;
  velocity: Vec;
  radius: number;
  life: number; // seconds until it fizzles
  damage: number;
  target: Targetable | null; // locked target, or null when flying straight
}

export function createRocket(position: Vec, angle: number, target: Targetable | null): Rocket {
  return {
    position: { ...position },
    velocity: fromAngle(angle, ROCKET.speed),
    radius: ROCKET.radius,
    life: ROCKET.life,
    damage: ROCKET.damage,
    target,
  };
}

/** Turn the rocket's heading toward the target, limited by the turn rate. */
export function steerRocket(r: Rocket, targetPos: Vec, dt: number): void {
  const desired = Math.atan2(targetPos.y - r.position.y, targetPos.x - r.position.x);
  const current = Math.atan2(r.velocity.y, r.velocity.x);
  let diff = desired - current;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const maxTurn = ROCKET.turnRate * dt;
  const turn = Math.max(-maxTurn, Math.min(maxTurn, diff));
  r.velocity = fromAngle(current + turn, ROCKET.speed);
}

export function updateRocket(r: Rocket, dt: number, world: WorldBounds): void {
  r.position = wrapVec(add(r.position, scale(r.velocity, dt)), world.width, world.height);
  r.life -= dt;
}

export const isRocketGone = (r: Rocket): boolean => r.life <= 0;
