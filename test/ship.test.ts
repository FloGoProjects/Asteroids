import { describe, it, expect } from "vitest";
import { createShip, updateShip } from "../src/game/ship.ts";
import { length } from "../src/engine/vector2.ts";
import { SHIP } from "../src/game/constants.ts";
import { vec } from "../src/engine/vector2.ts";

const NO_INPUT = { turnLeft: false, turnRight: false, thrust: false };
const world = { width: 800, height: 600 };

// REQ-SHIP-01
describe("ship rotation", () => {
  it("turnRight increases the angle proportionally to dt", () => {
    const ship = createShip(vec(400, 300));
    ship.angle = 0;
    updateShip(ship, { ...NO_INPUT, turnRight: true }, 0.5, world);
    expect(ship.angle).toBeCloseTo(SHIP.turnSpeed * 0.5);
  });

  it("turnLeft decreases the angle", () => {
    const ship = createShip(vec(400, 300));
    ship.angle = 1;
    updateShip(ship, { ...NO_INPUT, turnLeft: true }, 0.5, world);
    expect(ship.angle).toBeCloseTo(1 - SHIP.turnSpeed * 0.5);
  });

  it("keeps the angle when no turn input is given", () => {
    const ship = createShip(vec(400, 300));
    ship.angle = 0.7;
    updateShip(ship, NO_INPUT, 0.5, world);
    expect(ship.angle).toBeCloseTo(0.7);
  });
});

// REQ-SHIP-02
describe("ship thrust and inertia", () => {
  it("thrust accelerates in the facing direction", () => {
    const ship = createShip(vec(400, 300));
    ship.angle = 0; // facing +x
    updateShip(ship, { ...NO_INPUT, thrust: true }, 0.1, world);
    expect(ship.velocity.x).toBeGreaterThan(0);
    expect(ship.velocity.y).toBeCloseTo(0);
  });

  it("keeps gliding (inertia) and slows down via friction without thrust", () => {
    const ship = createShip(vec(400, 300));
    ship.angle = 0;
    updateShip(ship, { ...NO_INPUT, thrust: true }, 0.2, world);
    const speedAfterThrust = length(ship.velocity);
    updateShip(ship, NO_INPUT, 0.2, world);
    const speedAfterCoast = length(ship.velocity);
    expect(speedAfterCoast).toBeGreaterThan(0); // still moving (inertia)
    expect(speedAfterCoast).toBeLessThan(speedAfterThrust); // friction slows it
  });

  it("caps speed at the maximum", () => {
    const ship = createShip(vec(400, 300));
    ship.angle = 0;
    for (let i = 0; i < 200; i++) {
      updateShip(ship, { ...NO_INPUT, thrust: true }, 0.1, world);
    }
    expect(length(ship.velocity)).toBeLessThanOrEqual(SHIP.maxSpeed + 1e-6);
  });

  it("moves the position by velocity and wraps around the edges", () => {
    const ship = createShip(vec(1, 300));
    ship.angle = Math.PI; // facing -x
    ship.velocity = vec(-100, 0);
    updateShip(ship, NO_INPUT, 0.1, world); // x: 1 - 10 = -9 -> wraps to 791
    expect(ship.position.x).toBeCloseTo(791);
  });
});
