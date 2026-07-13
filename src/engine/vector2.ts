/** Immutable 2D vector helpers. REQ-VEC-01. */
export interface Vec {
  x: number;
  y: number;
}

export const vec = (x: number, y: number): Vec => ({ x, y });

export const add = (a: Vec, b: Vec): Vec => ({ x: a.x + b.x, y: a.y + b.y });

export const sub = (a: Vec, b: Vec): Vec => ({ x: a.x - b.x, y: a.y - b.y });

export const scale = (a: Vec, s: number): Vec => ({ x: a.x * s, y: a.y * s });

export const length = (a: Vec): number => Math.hypot(a.x, a.y);

export const distance = (a: Vec, b: Vec): number => Math.hypot(a.x - b.x, a.y - b.y);

export const normalize = (a: Vec): Vec => {
  const len = length(a);
  return len === 0 ? { x: 0, y: 0 } : { x: a.x / len, y: a.y / len };
};

/** Unit-ish vector from an angle (radians). 0 -> +x, PI/2 -> +y. */
export const fromAngle = (angle: number, len = 1): Vec => ({
  x: Math.cos(angle) * len,
  y: Math.sin(angle) * len,
});

export const rotate = (a: Vec, angle: number): Vec => {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return { x: a.x * c - a.y * s, y: a.x * s + a.y * c };
};

/** Cap a vector's magnitude while preserving its direction. */
export const limit = (a: Vec, max: number): Vec => {
  const len = length(a);
  return len > max && len > 0 ? scale(a, max / len) : { x: a.x, y: a.y };
};
