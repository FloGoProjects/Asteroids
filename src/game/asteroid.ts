/** Asteroids. REQ-AST-01 (movement), REQ-AST-02 (splitting). */
import { Vec, vec, add, scale, length, fromAngle } from "../engine/vector2.ts";
import { wrapVec } from "../engine/wrap.ts";
import { WorldBounds } from "./ship.ts";
import { Rng } from "../engine/random.ts";
import { ASTEROID, AsteroidSize } from "./constants.ts";

export interface Asteroid {
  position: Vec;
  velocity: Vec;
  size: AsteroidSize;
  radius: number;
  hp: number; // remaining hit points
  maxHp: number; // starting hit points (for damage feedback)
  angle: number; // current visual rotation
  spin: number; // radians per second
  shape: number[]; // per-vertex radius multipliers for a jagged silhouette
}

/** Build a jagged silhouette (radius multipliers) for the grungy look. */
function makeShape(rng: Rng | undefined, points = 12): number[] {
  const shape: number[] = [];
  for (let i = 0; i < points; i++) {
    shape.push(rng ? rng.range(0.72, 1.12) : 1);
  }
  return shape;
}

export function createAsteroid(
  position: Vec,
  velocity: Vec,
  size: AsteroidSize,
  rng?: Rng,
): Asteroid {
  const spec = ASTEROID.sizes[size];
  return {
    position: { ...position },
    velocity: { ...velocity },
    size,
    radius: spec.radius,
    hp: spec.hp,
    maxHp: spec.hp,
    angle: rng ? rng.range(0, Math.PI * 2) : 0,
    spin: rng ? rng.range(-0.8, 0.8) : 0,
    shape: makeShape(rng, size === "boss" ? 16 : 12),
  };
}

export function updateAsteroid(a: Asteroid, dt: number, world: WorldBounds): void {
  a.position = wrapVec(add(a.position, scale(a.velocity, dt)), world.width, world.height);
  a.angle += a.spin * dt;
}

/**
 * Break an asteroid into fragments like classic Asteroids.
 * boss -> several large, large -> 2 medium, medium -> 2 small, small -> [] (destroyed).
 * Fragments spawn at the parent's position with diverging headings and
 * at least the parent's speed.
 */
export function splitAsteroid(a: Asteroid, rng: Rng): Asteroid[] {
  const spec = ASTEROID.sizes[a.size];
  const next = spec.next;
  if (!next || spec.splits <= 0) return [];

  const parentSpeed = length(a.velocity);
  const speed = Math.max(parentSpeed, ASTEROID.minSpeed) * ASTEROID.childSpeedFactor;
  const base = parentSpeed > 0 ? Math.atan2(a.velocity.y, a.velocity.x) : rng.range(0, Math.PI * 2);

  const children: Asteroid[] = [];
  for (let i = 0; i < spec.splits; i++) {
    const spread = ((i / spec.splits) * 2 - 1) * 0.9; // fan out across the split count
    const angle = base + spread + rng.range(-0.15, 0.15);
    children.push(createAsteroid(a.position, fromAngle(angle, speed), next, rng));
  }
  return children;
}

/** Absolute polygon vertices for rendering. */
export function asteroidVertices(a: Asteroid): Vec[] {
  const n = a.shape.length;
  const verts: Vec[] = [];
  for (let i = 0; i < n; i++) {
    const theta = a.angle + (i / n) * Math.PI * 2;
    const r = a.radius * a.shape[i];
    verts.push(add(a.position, vec(Math.cos(theta) * r, Math.sin(theta) * r)));
  }
  return verts;
}
