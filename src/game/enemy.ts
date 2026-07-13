/** Hostile fighters and stations. REQ-ENEMY-01, REQ-ENEMY-02. */
import { Vec, add, scale } from "../engine/vector2.ts";
import { wrapVec } from "../engine/wrap.ts";
import { WorldBounds } from "./ship.ts";
import { ENEMY, STATION, EnemyKind } from "./constants.ts";

/** Station beam cycle: settling/cooldown -> telegraphed charge -> live beam. */
export type BeamPhase = "idle" | "charging" | "firing";

export interface Enemy {
  position: Vec;
  velocity: Vec;
  kind: EnemyKind;
  radius: number;
  hp: number;
  maxHp: number;
  fireTimer: number; // seconds until the next aimed shot (fighters only)
  life: number; // seconds until it leaves on its own
  score: number; // reward on destruction
  credits: number;
  wobble: number; // phase for the render bob
  beamPhase: BeamPhase; // charging-beam state (stations only)
  beamTimer: number; // seconds left in the current beam phase
  beamAngle: number; // aim direction, locked when the charge begins
}

export function createEnemy(position: Vec, velocity: Vec, kind: EnemyKind = "fighter"): Enemy {
  const cfg = kind === "station" ? STATION : ENEMY;
  return {
    position: { ...position },
    velocity: { ...velocity },
    kind,
    radius: cfg.radius,
    hp: cfg.hp,
    maxHp: cfg.hp,
    fireTimer: kind === "fighter" ? ENEMY.fireCooldown : Infinity,
    life: cfg.life,
    score: cfg.score,
    credits: cfg.credits,
    wobble: 0,
    beamPhase: "idle",
    beamTimer: kind === "station" ? STATION.beamAim : 0, // fighters never use the beam
    beamAngle: 0,
  };
}

/** Decide the kind of a spawn: stations only from wave 2, otherwise fighters. */
export function pickEnemyKind(wave: number, roll: number): EnemyKind {
  return wave >= 2 && roll < ENEMY.stationChance ? "station" : "fighter";
}

export function updateEnemy(e: Enemy, dt: number, world: WorldBounds): void {
  e.position = wrapVec(add(e.position, scale(e.velocity, dt)), world.width, world.height);
  e.wobble += dt * 3;
  e.life -= dt;
}

export const isEnemyGone = (e: Enemy): boolean => e.life <= 0;

/**
 * Advance a station's charging-beam cycle by dt. The aim is locked at the moment
 * the charge begins (so a moving ship can dodge). Returns true while the beam is
 * live (dealing damage). REQ-ENEMY-02.
 */
export function advanceStationBeam(e: Enemy, dt: number, aimAngle: number): boolean {
  e.beamTimer -= dt;
  if (e.beamTimer > 0) return e.beamPhase === "firing"; // still within the current phase
  if (e.beamPhase === "idle") {
    e.beamPhase = "charging";
    e.beamAngle = aimAngle; // lock the aim for the whole charge + fire
    e.beamTimer = STATION.beamCharge;
    return false;
  }
  if (e.beamPhase === "charging") {
    e.beamPhase = "firing";
    e.beamTimer = STATION.beamTime;
    return true; // beam goes live this frame
  }
  // firing -> cooldown
  e.beamPhase = "idle";
  e.beamTimer = STATION.beamCooldown;
  return false;
}
