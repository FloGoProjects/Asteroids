/** Presentation-only particle system (explosions, thruster smoke). */
import { Vec, vec, add, scale, fromAngle } from "../engine/vector2.ts";

export interface Particle {
  pos: Vec;
  vel: Vec;
  life: number;
  maxLife: number;
  size: number;
  hue: number; // color hue (grungy orange/red)
  drag: number;
}

export class Particles {
  private items: Particle[] = [];

  get count(): number {
    return this.items.length;
  }

  emitExplosion(pos: Vec, big: boolean): void {
    const n = big ? 90 : 46;
    for (let i = 0; i < n; i++) {
      const speed = (big ? 260 : 190) * (0.3 + Math.random() * 0.7);
      const angle = Math.random() * Math.PI * 2;
      this.items.push({
        pos: { ...pos },
        vel: fromAngle(angle, speed),
        life: 0,
        maxLife: 0.5 + Math.random() * (big ? 0.9 : 0.6),
        size: 1 + Math.random() * (big ? 3.5 : 2.4),
        hue: 12 + Math.random() * 34, // deep orange -> amber
        drag: 1.6,
      });
    }
  }

  emitSpark(pos: Vec): void {
    for (let i = 0; i < 8; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 90 + Math.random() * 120;
      this.items.push({
        pos: { ...pos },
        vel: fromAngle(angle, speed),
        life: 0,
        maxLife: 0.18 + Math.random() * 0.22,
        size: 1 + Math.random() * 1.6,
        hue: 44 + Math.random() * 16, // bright amber sparks
        drag: 3,
      });
    }
  }

  emitPickup(pos: Vec, hue: number): void {
    for (let i = 0; i < 22; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 60 + Math.random() * 160;
      this.items.push({
        pos: { ...pos },
        vel: fromAngle(angle, speed),
        life: 0,
        maxLife: 0.4 + Math.random() * 0.5,
        size: 1.2 + Math.random() * 2.2,
        hue,
        drag: 2.2,
      });
    }
  }

  emitThrust(pos: Vec, angle: number): void {
    for (let i = 0; i < 2; i++) {
      const spread = (Math.random() - 0.5) * 0.7;
      const speed = 120 + Math.random() * 90;
      this.items.push({
        pos: add(pos, vec((Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4)),
        vel: fromAngle(angle + spread, speed),
        life: 0,
        maxLife: 0.25 + Math.random() * 0.35,
        size: 1 + Math.random() * 2.2,
        hue: 20 + Math.random() * 20,
        drag: 2.4,
      });
    }
  }

  update(dt: number): void {
    for (const p of this.items) {
      p.life += dt;
      p.pos = add(p.pos, scale(p.vel, dt));
      p.vel = scale(p.vel, Math.max(0, 1 - p.drag * dt));
    }
    this.items = this.items.filter((p) => p.life < p.maxLife);
  }

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const p of this.items) {
      const t = 1 - p.life / p.maxLife; // 1 -> 0
      const alpha = t * t;
      ctx.beginPath();
      ctx.fillStyle = `hsla(${p.hue}, 95%, ${50 + t * 20}%, ${alpha})`;
      ctx.arc(p.pos.x, p.pos.y, p.size * (0.5 + t), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}
