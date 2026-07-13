/** Collision detection. REQ-COL-01. */
import { Vec, distance } from "../engine/vector2.ts";

/**
 * Circle-circle overlap test. Exact touching (distance == r1 + r2) counts as no hit.
 * v1 simplification: does not account for toroidal wrap distance.
 */
export const circleHit = (aPos: Vec, aRadius: number, bPos: Vec, bRadius: number): boolean =>
  distance(aPos, bPos) < aRadius + bRadius;

/**
 * Does a circle (center `p`, `radius`) overlap the segment `a`–`b`?
 * Used for the station beam vs. the ship. Clamps the projection to the segment.
 */
export function segmentHitsCircle(a: Vec, b: Vec, p: Vec, radius: number): boolean {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const len2 = abx * abx + aby * aby;
  let t = len2 === 0 ? 0 : ((p.x - a.x) * abx + (p.y - a.y) * aby) / len2;
  t = t < 0 ? 0 : t > 1 ? 1 : t; // nearest point stays on the segment
  const cx = a.x + abx * t;
  const cy = a.y + aby * t;
  const dx = p.x - cx;
  const dy = p.y - cy;
  return dx * dx + dy * dy < radius * radius;
}
