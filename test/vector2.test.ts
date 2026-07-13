import { describe, it, expect } from "vitest";
import {
  vec,
  add,
  sub,
  scale,
  length,
  normalize,
  fromAngle,
  rotate,
  distance,
  limit,
} from "../src/engine/vector2.ts";

// REQ-VEC-01
describe("vector2", () => {
  it("add returns a new vector without mutating inputs", () => {
    const a = vec(1, 2);
    const b = vec(3, 4);
    const r = add(a, b);
    expect(r).toEqual({ x: 4, y: 6 });
    expect(a).toEqual({ x: 1, y: 2 });
    expect(b).toEqual({ x: 3, y: 4 });
  });

  it("sub subtracts component-wise", () => {
    expect(sub(vec(5, 5), vec(1, 2))).toEqual({ x: 4, y: 3 });
  });

  it("scale multiplies by a scalar", () => {
    expect(scale(vec(2, -3), 2)).toEqual({ x: 4, y: -6 });
  });

  it("length is euclidean", () => {
    expect(length(vec(3, 4))).toBe(5);
  });

  it("distance is euclidean between two points", () => {
    expect(distance(vec(0, 0), vec(3, 4))).toBe(5);
  });

  it("normalize returns a unit vector", () => {
    const n = normalize(vec(0, 5));
    expect(n.x).toBeCloseTo(0);
    expect(n.y).toBeCloseTo(1);
    expect(length(n)).toBeCloseTo(1);
  });

  it("normalize of the zero vector returns zero (no NaN)", () => {
    const n = normalize(vec(0, 0));
    expect(n).toEqual({ x: 0, y: 0 });
  });

  it("fromAngle(0) points along +x", () => {
    const v = fromAngle(0, 1);
    expect(v.x).toBeCloseTo(1);
    expect(v.y).toBeCloseTo(0);
  });

  it("fromAngle(PI/2) points along +y", () => {
    const v = fromAngle(Math.PI / 2, 1);
    expect(v.x).toBeCloseTo(0);
    expect(v.y).toBeCloseTo(1);
  });

  it("rotate turns a vector by an angle", () => {
    const v = rotate(vec(1, 0), Math.PI / 2);
    expect(v.x).toBeCloseTo(0);
    expect(v.y).toBeCloseTo(1);
  });

  it("limit caps magnitude but keeps direction", () => {
    const v = limit(vec(30, 40), 5); // length 50 -> capped to 5
    expect(length(v)).toBeCloseTo(5);
    expect(v.x).toBeCloseTo(3);
    expect(v.y).toBeCloseTo(4);
  });

  it("limit leaves shorter vectors untouched", () => {
    const v = limit(vec(3, 4), 10);
    expect(v).toEqual({ x: 3, y: 4 });
  });
});
