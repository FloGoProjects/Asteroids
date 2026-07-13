/** Enemy battleships: single large hostile ships with one health bar. REQ-BASE-01. */
import { Vec, add, scale } from "../engine/vector2.ts";
import { wrapVec } from "../engine/wrap.ts";
import { WorldBounds } from "./ship.ts";
import { BASE, BATTLESHIPS, BOUNTY, BattleshipDesign } from "./constants.ts";

export type { BattleshipDesign } from "./constants.ts";

export interface Base {
  design: BattleshipDesign;
  position: Vec; // hull centre
  velocity: Vec;
  angle: number; // heading (radians); the hull points along its travel direction
  hp: number; // one health bar for the whole ship
  maxHp: number;
  shield: number; // current shield charges (0 = none/broken)
  shieldMax: number; // 0 = this design has no shield
  shieldRecharge: number; // seconds until the next shield charge regenerates
  radius: number; // hull collision radius
  life: number; // seconds before it leaves the field
  wobble: number; // render phase
  fireTimer: number; // seconds until the next main-gun volley
  hangarTimer: number; // seconds until the next fighter launch (fortress only)
  elite: boolean; // bounty elite: buffed hull, golden, drops a guaranteed crate. REQ-EVENT-01
  bounty: number; // extra credits paid for killing it (0 = normal battleship)
}

/** Build a battleship of the given design, heading along its velocity. */
export function createBattleship(design: BattleshipDesign, position: Vec, velocity: Vec): Base {
  const spec = BATTLESHIPS[design];
  return {
    design,
    position: { ...position },
    velocity: { ...velocity },
    angle: Math.atan2(velocity.y, velocity.x),
    hp: spec.hp,
    maxHp: spec.hp,
    shield: spec.shieldMax,
    shieldMax: spec.shieldMax,
    shieldRecharge: BASE.shieldRechargeDelay,
    radius: spec.radius,
    life: BASE.life,
    wobble: 0,
    fireTimer: spec.fireCooldown,
    hangarTimer: spec.hangarCooldown,
    elite: false,
    bounty: 0,
  };
}

/** A buffed "bounty elite" battleship (fortress-based): tankier, longer-lived, worth a bounty. REQ-EVENT-01. */
export function createEliteBattleship(position: Vec, velocity: Vec): Base {
  const b = createBattleship("fortress", position, velocity);
  b.hp = b.maxHp = Math.round(BATTLESHIPS.fortress.hp * BOUNTY.hpMult);
  b.shieldMax = b.shield = BATTLESHIPS.fortress.shieldMax + BOUNTY.shieldBonus;
  b.life = BOUNTY.life;
  b.elite = true;
  b.bounty = BOUNTY.credits;
  return b;
}

/** Drift, wrap, age, and recharge the shield. */
export function updateBase(base: Base, dt: number, world: WorldBounds): void {
  base.position = wrapVec(add(base.position, scale(base.velocity, dt)), world.width, world.height);
  base.wobble += dt;
  base.life -= dt;
  if (base.shieldMax > 0 && base.shield < base.shieldMax) {
    base.shieldRecharge -= dt;
    if (base.shieldRecharge <= 0) {
      base.shield += 1;
      base.shieldRecharge = BASE.shieldRechargeDelay;
    }
  }
}

/** True once the ship's health bar is empty. */
export const isBaseDead = (base: Base): boolean => base.hp <= 0;
