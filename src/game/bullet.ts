/** Projectiles. REQ-BULLET-01, REQ-BULLET-02. */
import { Vec, add, scale } from "../engine/vector2.ts";
import { wrapVec } from "../engine/wrap.ts";
import { WorldBounds } from "./ship.ts";
import { BULLET } from "./constants.ts";

export interface Bullet {
  position: Vec;
  velocity: Vec;
  life: number; // remaining seconds
  radius: number; // collision radius (enlarged by explosive ammo)
  damage: number; // damage dealt to an asteroid on hit
  blast: number; // proximity/AoE radius (explosive ammo); 0 = plain direct-hit round
}

export function createBullet(
  position: Vec,
  velocity: Vec,
  life: number,
  radius: number = BULLET.radius,
  damage: number = 1,
  blast: number = 0,
): Bullet {
  return {
    position: { ...position },
    velocity: { ...velocity },
    life,
    radius,
    damage,
    blast,
  };
}

export function updateBullet(bullet: Bullet, dt: number, world: WorldBounds): void {
  bullet.position = wrapVec(
    add(bullet.position, scale(bullet.velocity, dt)),
    world.width,
    world.height,
  );
  bullet.life -= dt;
}

export const isExpired = (bullet: Bullet): boolean => bullet.life <= 0;
