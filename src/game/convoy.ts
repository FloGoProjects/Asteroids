/** Friendly cargo freighter for the "escort the convoy" event. REQ-EVENT-02. */
import { Vec, add, scale } from "../engine/vector2.ts";
import { CONVOY } from "./constants.ts";

export interface Freighter {
  position: Vec;
  velocity: Vec; // horizontal drift across the field
  hp: number;
  maxHp: number;
  radius: number;
}

export function createFreighter(position: Vec, velocity: Vec): Freighter {
  return {
    position: { ...position },
    velocity: { ...velocity },
    hp: CONVOY.hp,
    maxHp: CONVOY.hp,
    radius: CONVOY.radius,
  };
}

/** Freighters do not wrap — they cross the screen and are "delivered" off the far edge. */
export function updateFreighter(f: Freighter, dt: number): void {
  f.position = add(f.position, scale(f.velocity, dt));
}
