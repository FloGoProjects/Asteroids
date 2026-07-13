import { describe, it, expect } from "vitest";
import { wrap, wrapVec } from "../src/engine/wrap.ts";
import { vec } from "../src/engine/vector2.ts";

// REQ-WRAP-01
describe("screen wrap", () => {
  it("leaves in-bounds values unchanged", () => {
    expect(wrap(50, 100)).toBe(50);
  });

  it("wraps negative values to the far side", () => {
    expect(wrap(-1, 100)).toBe(99);
  });

  it("wraps values at/over the max back to the start", () => {
    expect(wrap(100, 100)).toBe(0);
    expect(wrap(120, 100)).toBe(20);
  });

  it("wrapVec wraps x and y independently", () => {
    expect(wrapVec(vec(-5, 105), 100, 100)).toEqual({ x: 95, y: 5 });
  });
});
