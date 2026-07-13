/** Space mines: dropped behind the ship, detonate on contact. REQ-MINE-01. */
import { Vec, add, scale } from "../engine/vector2.ts";
import { wrapVec } from "../engine/wrap.ts";
import { WorldBounds } from "./ship.ts";
import { MINE } from "./constants.ts";

export interface Mine {
  position: Vec;
  velocity: Vec;
  radius: number; // trigger radius
  life: number; // seconds before it fizzles
  damage: number;
  pulse: number; // render blink phase
}

export function createMine(position: Vec, velocity: Vec): Mine {
  return {
    position: { ...position },
    velocity: { ...velocity },
    radius: MINE.radius,
    life: MINE.life,
    damage: MINE.damage,
    pulse: 0,
  };
}

export function updateMine(m: Mine, dt: number, world: WorldBounds): void {
  m.position = wrapVec(add(m.position, scale(m.velocity, dt)), world.width, world.height);
  m.pulse += dt * 5;
  m.life -= dt;
}

export const isMineGone = (m: Mine): boolean => m.life <= 0;
