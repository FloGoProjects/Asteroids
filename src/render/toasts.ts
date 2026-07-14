/** Presentation-only floating pickup texts ("3× Raketen"). Render layer, not game logic. */
interface Toast {
  text: string;
  x: number;
  y: number;
  life: number;
  maxLife: number;
}

export class Toasts {
  private items: Toast[] = [];

  get count(): number {
    return this.items.length;
  }

  push(text: string, x: number, y: number): void {
    // nudge stacked toasts up a little so simultaneous pickups don't fully overlap
    const overlap = this.items.filter((t) => Math.abs(t.x - x) < 60 && Math.abs(t.y - y) < 24).length;
    this.items.push({ text, x, y: y - overlap * 20, life: 0, maxLife: 1.4 });
  }

  update(dt: number): void {
    for (const t of this.items) {
      t.life += dt;
      t.y -= 34 * dt; // float upward
    }
    this.items = this.items.filter((t) => t.life < t.maxLife);
  }

  draw(ctx: CanvasRenderingContext2D): void {
    if (this.items.length === 0) return;
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "700 16px 'Segoe UI', system-ui, sans-serif";
    for (const t of this.items) {
      const k = 1 - t.life / t.maxLife; // 1 -> 0
      ctx.globalAlpha = Math.min(1, k * 1.6);
      ctx.fillStyle = "#ffe6a0";
      ctx.shadowColor = "#ffd166";
      ctx.shadowBlur = 8;
      ctx.fillText(`+ ${t.text}`, t.x, t.y);
    }
    ctx.restore();
  }
}
