import { describe, it, expect } from "vitest";
import { circleHit, segmentHitsCircle } from "../src/game/collision.ts";
import { vec } from "../src/engine/vector2.ts";

// REQ-COL-01
describe("circle collision", () => {
  it("detects overlapping circles", () => {
    expect(circleHit(vec(0, 0), 10, vec(5, 0), 10)).toBe(true);
  });

  it("reports no hit when circles are far apart", () => {
    expect(circleHit(vec(0, 0), 10, vec(100, 0), 10)).toBe(false);
  });

  it("treats exact touching (distance == sum of radii) as no hit", () => {
    expect(circleHit(vec(0, 0), 10, vec(20, 0), 10)).toBe(false);
  });
});

// station beam vs. ship
describe("segment vs circle", () => {
  const a = vec(0, 0);
  const b = vec(100, 0); // segment along the x-axis

  it("hits when the circle overlaps the segment", () => {
    expect(segmentHitsCircle(a, b, vec(50, 3), 5)).toBe(true); // 3 < 5
  });

  it("misses when the circle is beside the segment", () => {
    expect(segmentHitsCircle(a, b, vec(50, 20), 5)).toBe(false);
  });

  it("misses when the circle is past the segment end", () => {
    expect(segmentHitsCircle(a, b, vec(140, 0), 5)).toBe(false);
  });
});
