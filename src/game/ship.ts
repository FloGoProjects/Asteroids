/** Player ship. REQ-SHIP-01, REQ-SHIP-02, REQ-SHIP-03. */
import { Vec, vec, add, scale, fromAngle, limit } from "../engine/vector2.ts";
import { wrapVec } from "../engine/wrap.ts";
import { SHIP, SHIPS, SHIELD, ShipId, TurretMount } from "./constants.ts";

export interface ShipInput {
  turnLeft: boolean;
  turnRight: boolean;
  thrust: boolean;
}

export interface WorldBounds {
  width: number;
  height: number;
}

export interface Ship {
  position: Vec;
  velocity: Vec;
  angle: number; // radians
  shipId: ShipId; // equipped ship model
  radius: number; // from the equipped ship spec
  turnSpeed: number; // rad/s (per ship)
  thrust: number; // px/s^2 (per ship)
  maxSpeed: number; // px/s (per ship)
  thrusting: boolean;
  invuln: number; // seconds of remaining invulnerability
  shield: number; // current shield charges (0 = down)
  shieldMax: number; // shield capacity (0 = no shield equipment)
  shieldRecharge: number; // seconds until the next charge regenerates
  antigrav: number; // seconds of remaining antigrav field
  aimAngle: number; // direction the guns point (mouse aim for turret ships, else = angle)
  turrets: TurretMount[]; // mouse-aimed turrets (empty for single-cannon ships)
  hasAutocannon: boolean; // auto-aiming turret from the autocannon upgrade
  autoAimAngle: number; // direction the autocannon points (toward its target)
  autoCooldown: number; // seconds until the autocannon can fire again
}

export function createShip(position: Vec, shipId: ShipId = "vanguard"): Ship {
  const spec = SHIPS[shipId];
  const shieldCapacity = spec.shieldCapacity ?? 0;
  return {
    position: { ...position },
    velocity: vec(0, 0),
    angle: -Math.PI / 2, // pointing "up" on screen by default
    shipId,
    radius: spec.radius,
    turnSpeed: spec.turnSpeed,
    thrust: spec.thrust,
    maxSpeed: spec.maxSpeed,
    thrusting: false,
    invuln: 0,
    shield: shieldCapacity, // built-in shields (if any) come charged
    shieldMax: shieldCapacity,
    shieldRecharge: 0,
    antigrav: 0,
    aimAngle: -Math.PI / 2,
    turrets: spec.turrets ?? [],
    hasAutocannon: false,
    autoAimAngle: -Math.PI / 2,
    autoCooldown: 0,
  };
}

/** Fit/refresh the rechargeable hit-shield to full capacity. REQ-EQUIP-01. */
export function grantShield(ship: Ship): void {
  ship.shieldMax = SHIELD.capacity;
  ship.shield = SHIELD.capacity;
  ship.shieldRecharge = SHIELD.rechargeDelay;
}

export function updateShip(ship: Ship, input: ShipInput, dt: number, world: WorldBounds): void {
  // Rotation (REQ-SHIP-01) — uses the equipped ship's agility
  if (input.turnLeft) ship.angle -= ship.turnSpeed * dt;
  if (input.turnRight) ship.angle += ship.turnSpeed * dt;

  // Thrust (REQ-SHIP-02)
  ship.thrusting = input.thrust;
  if (input.thrust) {
    ship.velocity = add(ship.velocity, fromAngle(ship.angle, ship.thrust * dt));
  }

  // Speed cap
  ship.velocity = limit(ship.velocity, ship.maxSpeed);

  // Integrate position with current velocity + wrap
  ship.position = wrapVec(add(ship.position, scale(ship.velocity, dt)), world.width, world.height);

  // Friction / inertia (applied after integration so a set velocity moves fully once)
  ship.velocity = scale(ship.velocity, Math.pow(SHIP.friction, dt));

  if (ship.invuln > 0) ship.invuln = Math.max(0, ship.invuln - dt);
  if (ship.antigrav > 0) ship.antigrav = Math.max(0, ship.antigrav - dt);

  // Shield regenerates one charge after a quiet delay (REQ-EQUIP-01)
  if (ship.shieldMax > 0 && ship.shield < ship.shieldMax) {
    ship.shieldRecharge -= dt;
    if (ship.shieldRecharge <= 0) {
      ship.shield += 1;
      ship.shieldRecharge = SHIELD.rechargeDelay;
    }
  }
}
