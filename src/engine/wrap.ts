/** Toroidal screen wrap. REQ-WRAP-01. */
import { Vec } from "./vector2.ts";

export const wrap = (value: number, max: number): number => {
  const m = ((value % max) + max) % max;
  return m;
};

export const wrapVec = (pos: Vec, width: number, height: number): Vec => ({
  x: wrap(pos.x, width),
  y: wrap(pos.y, height),
});
