/**
 * Presentation-only sound effects, synthesised with the Web Audio API (no asset files).
 * REQ-SFX-01.
 *
 * A LOT happens on screen at once, so the mix is deliberately defensive: every sound has a
 * minimum gap to itself and there is a cap on concurrent voices. Low-priority sounds (shots,
 * sparks) are simply dropped when the mix is busy; important ones (big explosions, game over,
 * event starts) always get through. The decision lives in SfxGate, which is pure and tested.
 */
export type SfxKind =
  | "shoot"
  | "hit"
  | "explosionSmall"
  | "explosionBig"
  | "shield"
  | "pickup"
  | "land"
  | "event"
  | "gameover";

interface SfxSpec {
  minGap: number; // seconds before this same sound may play again
  duration: number; // seconds it occupies a voice
  priority: number; // >= PRIORITY_ALWAYS ignores the voice cap
}

export const PRIORITY_ALWAYS = 2;
export const SFX_MAX_VOICES = 6;
export const SFX_MASTER = 0.35; // keep the whole mix well under the music-less ambience
/**
 * A shared floor between ANY two low-priority sounds. Per-sound gaps alone still let shots +
 * sparks + small blasts stack into a rattle, so the whole chatter layer shares one budget.
 */
export const SFX_LOW_PRIORITY_GAP = 0.07;

export const SFX: Record<SfxKind, SfxSpec> = {
  // frequent, low value -> wide gaps, dropped first when busy
  shoot: { minGap: 0.12, duration: 0.08, priority: 0 },
  hit: { minGap: 0.2, duration: 0.06, priority: 0 },
  explosionSmall: { minGap: 0.16, duration: 0.3, priority: 1 },
  // rare and meaningful -> always audible
  explosionBig: { minGap: 0.3, duration: 0.55, priority: PRIORITY_ALWAYS },
  shield: { minGap: 0.2, duration: 0.25, priority: PRIORITY_ALWAYS },
  pickup: { minGap: 0.12, duration: 0.25, priority: PRIORITY_ALWAYS },
  land: { minGap: 0.5, duration: 0.6, priority: PRIORITY_ALWAYS },
  event: { minGap: 1.0, duration: 0.8, priority: 3 },
  gameover: { minGap: 1.0, duration: 1.2, priority: 3 },
};

/** Decides whether a sound may play — keeps the mix from turning into a rattle. Pure/testable. */
export class SfxGate {
  private last = new Map<SfxKind, number>();
  private lastLow = -Infinity; // last time ANY low-priority sound played
  private busy: number[] = []; // end times of the voices still sounding

  constructor(private maxVoices: number = SFX_MAX_VOICES) {}

  /** Voices still sounding at `now` (also prunes finished ones). */
  active(now: number): number {
    this.busy = this.busy.filter((end) => end > now);
    return this.busy.length;
  }

  allow(kind: SfxKind, now: number): boolean {
    const spec = SFX[kind];
    const active = this.active(now);
    const important = spec.priority >= PRIORITY_ALWAYS;

    const lastAt = this.last.get(kind);
    if (lastAt !== undefined && now - lastAt < spec.minGap) return false; // too soon after itself
    if (!important) {
      if (now - this.lastLow < SFX_LOW_PRIORITY_GAP) return false; // chatter layer is saturated
      if (active >= this.maxVoices) return false; // mix is full — drop the cheap sound
    }

    this.last.set(kind, now);
    if (!important) this.lastLow = now;
    this.busy.push(now + spec.duration);
    return true;
  }
}

export class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private gate = new SfxGate();
  private playedCount = 0;
  private suppressedCount = 0;

  /** Stats for verification (how much the gate is actually holding back). */
  get stats(): { played: number; suppressed: number } {
    return { played: this.playedCount, suppressed: this.suppressedCount };
  }

  /** Must be called from a user gesture — browsers block audio before that. */
  resume(): void {
    if (!this.ctx) {
      const AC =
        (window as unknown as { AudioContext?: typeof AudioContext }).AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return; // no Web Audio -> silently stay mute
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = SFX_MASTER;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  play(kind: SfxKind): void {
    if (!this.ctx || !this.master) return; // not unlocked yet
    const t = this.ctx.currentTime;
    if (!this.gate.allow(kind, t)) {
      this.suppressedCount += 1;
      return;
    }
    this.playedCount += 1;
    const rnd = 0.92 + Math.random() * 0.16; // slight detune so repeats don't sound machine-gunned

    if (kind === "shoot") this.tone(t, 900 * rnd, 260, 0.07, 0.09, "square");
    else if (kind === "hit") this.noise(t, 0.05, 0.06, 2600, 900);
    else if (kind === "explosionSmall") this.noise(t, 0.28, 0.16, 1400 * rnd, 120);
    else if (kind === "explosionBig") {
      this.noise(t, 0.5, 0.22, 900 * rnd, 60);
      this.tone(t, 120, 42, 0.45, 0.14, "sine");
    } else if (kind === "shield") this.tone(t, 700, 1500, 0.2, 0.1, "triangle");
    else if (kind === "pickup") {
      this.tone(t, 660, 680, 0.07, 0.07, "triangle");
      this.tone(t + 0.07, 990, 1010, 0.13, 0.07, "triangle");
    } else if (kind === "land") {
      this.tone(t, 180, 90, 0.5, 0.09, "sine");
      this.noise(t, 0.45, 0.05, 700, 120);
    } else if (kind === "event") {
      this.tone(t, 440, 445, 0.16, 0.1, "square");
      this.tone(t + 0.18, 660, 665, 0.3, 0.1, "square");
    } else if (kind === "gameover") this.tone(t, 400, 80, 1.0, 0.15, "sawtooth");
  }

  /** A pitched blip: f0 -> f1 with a fast attack and exponential decay. */
  private tone(
    t0: number,
    f0: number,
    f1: number,
    dur: number,
    gain: number,
    type: OscillatorType,
  ): void {
    const ctx = this.ctx as AudioContext;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t0);
    o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g);
    g.connect(this.master as GainNode);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }

  /** A filtered noise burst (impacts, explosions), sweeping the lowpass downward. */
  private noise(t0: number, dur: number, gain: number, f0: number, f1: number): void {
    const ctx = this.ctx as AudioContext;
    const n = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const flt = ctx.createBiquadFilter();
    flt.type = "lowpass";
    flt.frequency.setValueAtTime(f0, t0);
    flt.frequency.exponentialRampToValueAtTime(Math.max(60, f1), t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(flt);
    flt.connect(g);
    g.connect(this.master as GainNode);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  }
}
