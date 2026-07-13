/** Friendly wingman drones from the Titan hangar upgrade. REQ-SHIP-05. */
import { Vec, vec } from "../engine/vector2.ts";
import { WINGMAN } from "./constants.ts";

export interface Wingman {
  position: Vec;
  angle: number; // facing (toward its target, else the ship heading)
  fireTimer: number; // seconds until it can fire again
  slot: number; // formation slot index (into WINGMAN.offsets)
}

export function createWingman(slot: number, pos: Vec): Wingman {
  return { position: { ...pos }, angle: -Math.PI / 2, fireTimer: 0, slot };
}

/**
 * Move the wingman toward its formation `target`. Snaps into place if it has fallen
 * far behind (e.g. when the ship wraps across a screen edge) to avoid a cross-map dash.
 */
export function steerWingman(wm: Wingman, target: Vec, dt: number): void {
  const dx = target.x - wm.position.x;
  const dy = target.y - wm.position.y;
  if (Math.hypot(dx, dy) > WINGMAN.snapDist) {
    wm.position = { ...target };
    return;
  }
  const k = Math.min(1, WINGMAN.follow * dt); // exponential smoothing toward the slot
  wm.position = vec(wm.position.x + dx * k, wm.position.y + dy * k);
}
