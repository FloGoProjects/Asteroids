import { describe, it, expect } from "vitest";
import { SfxGate, SFX, PRIORITY_ALWAYS, SFX_LOW_PRIORITY_GAP } from "../src/render/sfx.ts";

// REQ-SFX-01: the gate is what stops "a lot happening at once" from becoming a rattle
describe("sfx gate: repeat throttling", () => {
  it("suppresses the same sound inside its minimum gap", () => {
    const g = new SfxGate();
    expect(g.allow("shoot", 0)).toBe(true);
    expect(g.allow("shoot", SFX.shoot.minGap / 2)).toBe(false); // too soon
  });

  it("allows the same sound again once the gap has passed", () => {
    const g = new SfxGate();
    expect(g.allow("shoot", 0)).toBe(true);
    expect(g.allow("shoot", SFX.shoot.minGap + 0.001)).toBe(true);
  });

  it("keeps each sound's own gap, but different sounds may alternate", () => {
    const g = new SfxGate();
    expect(g.allow("shoot", 0)).toBe(true);
    expect(g.allow("hit", SFX_LOW_PRIORITY_GAP)).toBe(true); // different sound, past the chatter gap
    expect(g.allow("hit", SFX_LOW_PRIORITY_GAP + 0.01)).toBe(false); // its own gap still holds
  });

  it("collapses a burst of rapid-fire shots into a few voices", () => {
    const g = new SfxGate();
    let played = 0;
    // 60 shots fired over one second (far faster than the ear can separate)
    for (let i = 0; i < 60; i++) if (g.allow("shoot", i * (1 / 60))) played += 1;
    expect(played).toBeLessThanOrEqual(Math.ceil(1 / SFX.shoot.minGap) + 1);
    expect(played).toBeGreaterThan(0); // but shooting still sounds
  });

  it("caps the whole chatter layer, however the small sounds are mixed", () => {
    const g = new SfxGate();
    const secs = 2;
    const attemptsPerSec = 200; // absurdly dense: shots, sparks and blasts all at once
    let played = 0;
    for (let i = 0; i < secs * attemptsPerSec; i++) {
      const t = i / attemptsPerSec;
      const kind = i % 3 === 0 ? "shoot" : i % 3 === 1 ? "hit" : "explosionSmall";
      if (g.allow(kind, t)) played += 1;
    }
    // never denser than the shared chatter budget -> no rattle
    expect(played / secs).toBeLessThanOrEqual(1 / SFX_LOW_PRIORITY_GAP + 1);
  });
});

describe("sfx gate: voice cap", () => {
  const t2 = SFX.explosionSmall.minGap; // past its own gap, but the first voice still sounds

  it("drops low-priority sounds while the mix is full", () => {
    const g = new SfxGate(1); // tiny cap for the test
    expect(g.allow("explosionSmall", 0)).toBe(true); // one voice, still sounding at t2
    expect(g.allow("explosionSmall", t2)).toBe(false); // cap reached -> dropped
  });

  it("still lets important sounds through at the cap", () => {
    const g = new SfxGate(1);
    g.allow("explosionSmall", 0);
    expect(g.active(t2)).toBe(1); // full
    expect(SFX.explosionBig.priority).toBeGreaterThanOrEqual(PRIORITY_ALWAYS);
    expect(g.allow("explosionBig", t2)).toBe(true);
    expect(g.allow("gameover", t2)).toBe(true);
  });

  it("frees voices again once they have finished sounding", () => {
    const g = new SfxGate(1);
    g.allow("explosionSmall", 0);
    const after = SFX.explosionSmall.duration + 1;
    expect(g.active(after)).toBe(0); // finished
    expect(g.allow("explosionSmall", after)).toBe(true);
  });
});
