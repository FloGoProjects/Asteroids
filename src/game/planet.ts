/** Shop planet: drifts slowly and horizontally across the screen. REQ-PLANET-01. */
import { Vec, add, scale } from "../engine/vector2.ts";
import { Rng } from "../engine/random.ts";

export interface Planet {
  position: Vec;
  velocity: Vec; // horizontal only
  radius: number;
  hue: number; // base colour for visual variety
  spin: number; // slow surface rotation (render only)
  angle: number; // current surface rotation
}

export function createPlanet(position: Vec, velocity: Vec, radius: number, rng?: Rng): Planet {
  return {
    position: { ...position },
    velocity: { ...velocity },
    radius,
    hue: rng ? rng.range(180, 300) : 210, // teal..violet gas giants
    spin: rng ? rng.range(0.04, 0.12) : 0.08,
    angle: rng ? rng.range(0, Math.PI * 2) : 0,
  };
}

export function updatePlanet(p: Planet, dt: number): void {
  p.position = add(p.position, scale(p.velocity, dt));
  p.angle += p.spin * dt;
}

/** True once the planet has fully left the screen on either horizontal side. */
export function isPlanetGone(p: Planet, width: number): boolean {
  return p.position.x - p.radius > width || p.position.x + p.radius < 0;
}
