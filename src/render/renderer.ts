/** Grungy sci-fi canvas renderer. Presentation only. */
import { World } from "../game/world.ts";
import { asteroidVertices } from "../game/asteroid.ts";
import { Bullet } from "../game/bullet.ts";
import { Planet } from "../game/planet.ts";
import { Enemy } from "../game/enemy.ts";
import { Loot } from "../game/loot.ts";
import { Crate } from "../game/crate.ts";
import { Freighter } from "../game/convoy.ts";
import { Rocket } from "../game/rocket.ts";
import { Mine } from "../game/mine.ts";
import { SiegeMissile } from "../game/siege.ts";
import { Wingman } from "../game/wingman.ts";
import { Base } from "../game/base.ts";
import { visiblePages, visibleItems, lockedItems, isOwned, isEquipped, ShopItem } from "../game/shop.ts";
import { WEAPONS, AMMO, PLANET, LOOT, GAME, SHIELD, STATION, SHIPS, AUTOCANNON, TRACTOR, DEFLECTOR, WINGMAN, BOUNTY, ShipId, LootKind } from "../game/constants.ts";
import { fromAngle, add, vec, distance, Vec } from "../engine/vector2.ts";
import { Particles } from "./particles.ts";

interface Star {
  x: number;
  y: number;
  z: number; // depth 0..1 (parallax + brightness)
}

const COLORS = {
  bg0: "#05060a",
  bg1: "#0a0d16",
  hull: "#c7d3e0",
  hullGlow: "rgba(120, 200, 255, 0.35)",
  thrust: "#ff7a2e",
  bullet: "#ffd166",
  rock: "#3a3f4b",
  rockEdge: "#8a94a6",
  danger: "#ff3b3b",
  hud: "#7fe7d9",
};

export class Renderer {
  private stars: Star[] = [];
  private w = 0;
  private h = 0;
  private t = 0;

  constructor(
    private ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
  ) {
    this.resize(width, height);
  }

  resize(width: number, height: number): void {
    this.w = width;
    this.h = height;
    const count = Math.floor((width * height) / 5200);
    this.stars = [];
    for (let i = 0; i < count; i++) {
      this.stars.push({
        x: Math.random() * width,
        y: Math.random() * height,
        z: Math.random(),
      });
    }
  }

  render(world: World, particles: Particles, dt: number): void {
    const ctx = this.ctx;
    this.t += dt;

    ctx.save();

    // screen shake
    if (world.shake > 0) {
      const s = world.shake * 14;
      ctx.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
    }

    this.drawBackground(ctx);
    this.drawStars(ctx);

    // Planet (shop landing pad) sits behind the action
    if (world.planet) {
      this.drawPlanet(ctx, world.planet);
      if (world.landProgress > 0)
        this.drawLandingArc(ctx, world.planet, world.landProgress / PLANET.landTime);
    }

    // Loot pickups (sit under the action)
    for (const l of world.loot) this.drawLoot(ctx, l);
    // Reward crates
    for (const c of world.crates) this.drawCrate(ctx, c);
    // Convoy freighters (friendly, escort event)
    for (const f of world.convoy) this.drawFreighter(ctx, f);

    // Asteroids
    for (const a of world.asteroids)
      this.drawAsteroid(ctx, asteroidVertices(a), a.position, a.radius, a.hp / a.maxHp, a.size === "boss");

    // Enemies
    for (const e of world.enemies) this.drawEnemy(ctx, e);

    // Modular bases
    for (const base of world.bases) this.drawBase(ctx, base);

    // Projectiles draw ON TOP of the field objects they strike, so the player's
    // laser stays visible even when it flies into a large base. REQ-BASE-01.
    // Bullets (glowing tracers, styled by ammo)
    for (const b of world.bullets) this.drawBullet(ctx, b);
    // Enemy projectiles (hostile red tracers)
    for (const b of world.enemyBullets) this.drawEnemyBullet(ctx, b);
    // Homing rockets
    for (const r of world.rockets) this.drawRocket(ctx, r);
    // Space mines
    for (const m of world.mines) this.drawMine(ctx, m);
    // Incoming siege missiles (shipyard-defense event)
    for (const m of world.siege) this.drawSiege(ctx, m);

    // Particles under/over ship
    particles.draw(ctx);

    // Wingmen (friendly drones) fly around the ship
    for (const wm of world.wingmen) this.drawWingman(ctx, wm);

    // Ship (also shown, frozen, while paused)
    if (world.state === "playing" || world.state === "paused") {
      if (world.shipId === "titan" && world.shipUpgrades.includes("tractor"))
        this.drawTractorField(ctx, world);
      this.drawShip(
        ctx,
        world.ship.position,
        world.ship.angle,
        world.ship.thrusting,
        world.ship.invuln,
        world.ship.shipId,
        world.ship.aimAngle,
        world.shipUpgrades,
        world.ship.autoAimAngle,
      );
      if (world.ship.antigrav > 0) this.drawAntigravField(ctx, world.ship.position, this.t);
      if (world.ship.deflectorFlash > 0)
        this.drawDeflectorPulse(ctx, world.ship.position, world.ship.deflectorFlash);
      if (world.ship.shieldMax > 0)
        this.drawShieldBubble(
          ctx,
          world.ship.position,
          world.ship.radius,
          this.t,
          world.ship.shield / world.ship.shieldMax,
        );
    }

    ctx.restore();

    this.drawVignette(ctx);
    this.drawHud(ctx, world);
    if (world.state === "playing") {
      const boss = world.asteroids.find((a) => a.size === "boss");
      if (boss) this.drawBossBar(ctx, boss.hp / boss.maxHp);
    }
    if (world.state === "playing" && world.waveBanner > 0) this.drawWaveBanner(ctx, world);
    if (world.state === "playing" && world.werft) this.drawWerftHud(ctx, world);
    if (world.state === "playing" && world.bases.some((b) => b.elite)) this.drawBountyBanner(ctx);
    if (world.state === "playing" && (world.convoyActive || world.convoyBanner > 0))
      this.drawConvoyHud(ctx, world);
    if (world.state === "shop") this.drawShop(ctx, world);
    if (world.state === "reward") this.drawReward(ctx, world);
    if (world.state === "gameover") this.drawGameOver(ctx, world);
    if (world.state === "paused") this.drawPause(ctx);
  }

  /** A slow incoming siege missile: warhead + fins + exhaust, pointing along its heading. REQ-WERFT-01. */
  private drawSiege(ctx: CanvasRenderingContext2D, m: SiegeMissile): void {
    const ang = Math.atan2(m.velocity.y, m.velocity.x);
    ctx.save();
    ctx.translate(m.position.x, m.position.y);
    ctx.rotate(ang);
    // exhaust flare at the tail
    const flick = 0.6 + 0.4 * Math.sin(this.t * 30 + m.position.x);
    ctx.fillStyle = `rgba(255, 140, 40, ${0.5 * flick})`;
    ctx.beginPath();
    ctx.moveTo(-m.radius, 0);
    ctx.lineTo(-m.radius - 12 * flick, -3);
    ctx.lineTo(-m.radius - 12 * flick, 3);
    ctx.closePath();
    ctx.fill();
    // body
    ctx.fillStyle = "#d94c3a";
    ctx.strokeStyle = "#ff9a6a";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(m.radius + 4, 0); // nose
    ctx.lineTo(-m.radius, -m.radius * 0.7);
    ctx.lineTo(-m.radius, m.radius * 0.7);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // warning glow
    ctx.shadowColor = "#ff5a3c";
    ctx.shadowBlur = 10;
    ctx.fillStyle = "#ffd0a0";
    ctx.beginPath();
    ctx.arc(m.radius * 0.2, 0, 1.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /** Shipyard-defense HUD: banner + shipyard damage bar + missiles remaining. REQ-WERFT-01. */
  private drawWerftHud(ctx: CanvasRenderingContext2D, world: World): void {
    const ev = world.werft;
    if (!ev) return;
    ctx.save();
    ctx.textAlign = "center";

    // banner
    ctx.font = "800 22px 'Segoe UI', system-ui, sans-serif";
    ctx.fillStyle = "#ffca6a";
    ctx.shadowColor = "#ff7a2e";
    ctx.shadowBlur = 14;
    const title = ev.phase === "approach" ? "◈ ORBITAL-WERFT NÄHERT SICH" : "◈ WERFT VERTEIDIGEN";
    ctx.fillText(title, this.w / 2, 44);

    if (ev.phase === "defend") {
      ctx.font = "600 13px 'Segoe UI', system-ui, sans-serif";
      ctx.shadowBlur = 0;
      ctx.fillStyle = "rgba(255,207,122,0.85)";
      const inFlight = world.siege.length;
      ctx.fillText(`Raketen abfangen — noch ${ev.toLaunch + inFlight} unterwegs`, this.w / 2, 64);

      // shipyard damage bar
      const barW = 240;
      const barH = 10;
      const bx = (this.w - barW) / 2;
      const by = 74;
      const ratio = Math.max(0, ev.hp / ev.hpMax);
      ctx.fillStyle = "rgba(255,255,255,0.12)";
      this.roundRect(ctx, bx, by, barW, barH, 5);
      ctx.fill();
      ctx.fillStyle = ratio > 0.5 ? "#5fdc7a" : ratio > 0.25 ? "#ffc04a" : "#ff5a5a";
      this.roundRect(ctx, bx, by, barW * ratio, barH, 5);
      ctx.fill();
      ctx.font = "700 11px 'Segoe UI', system-ui, sans-serif";
      ctx.fillStyle = "#cfd8e4";
      ctx.fillText(`WERFT-INTEGRITÄT  ${ev.hp}/${ev.hpMax}`, this.w / 2, by + barH + 14);
    }

    ctx.textAlign = "left";
    ctx.restore();
  }

  /** Top banner while a bounty elite is on the field. REQ-EVENT-01. */
  private drawBountyBanner(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.textAlign = "center";
    ctx.font = "800 22px 'Segoe UI', system-ui, sans-serif";
    ctx.fillStyle = "#ffca6a";
    ctx.shadowColor = "#ff7a2e";
    ctx.shadowBlur = 14;
    ctx.fillText(`◈ ${BOUNTY.name} · ${BOUNTY.credits} CR KOPFGELD`, this.w / 2, 44);
    ctx.restore();
  }

  /** Friendly convoy freighter (blue-green hull + hp pips). REQ-EVENT-02. */
  private drawFreighter(ctx: CanvasRenderingContext2D, f: Freighter): void {
    const s = f.radius;
    ctx.save();
    ctx.translate(f.position.x, f.position.y);
    ctx.fillStyle = "#3f6f7a";
    ctx.strokeStyle = "#7fe7d9";
    ctx.lineWidth = 2;
    ctx.shadowColor = "#7fe7d9";
    ctx.shadowBlur = 8;
    this.roundRect(ctx, -s, -s * 0.6, s * 2, s * 1.2, 4);
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;
    // cargo containers
    ctx.fillStyle = "#cfe9ff";
    ctx.fillRect(-s * 0.6, -s * 0.3, s * 0.5, s * 0.6);
    ctx.fillRect(s * 0.1, -s * 0.3, s * 0.5, s * 0.6);
    // hp pips above
    const pipW = (s * 2) / f.maxHp;
    for (let i = 0; i < f.maxHp; i++) {
      ctx.fillStyle = i < f.hp ? "#5fdc7a" : "rgba(255,255,255,0.15)";
      ctx.fillRect(-s + i * pipW + 1, -s * 0.6 - 8, pipW - 2, 3);
    }
    ctx.restore();
  }

  /** Convoy escort HUD: objective banner while active, result banner after. REQ-EVENT-02. */
  private drawConvoyHud(ctx: CanvasRenderingContext2D, world: World): void {
    ctx.save();
    ctx.textAlign = "center";
    ctx.font = "800 22px 'Segoe UI', system-ui, sans-serif";
    ctx.shadowBlur = 14;
    if (world.convoyActive) {
      ctx.fillStyle = "#7fe7d9";
      ctx.shadowColor = "#7fe7d9";
      ctx.fillText(`◈ KONVOI ESKORTIEREN · ${world.convoy.length} übrig`, this.w / 2, 44);
    } else {
      ctx.fillStyle = "#ffca6a";
      ctx.shadowColor = "#ff7a2e";
      ctx.fillText(`KONVOI: ${world.convoyDelivered} geliefert`, this.w / 2, 44);
    }
    ctx.restore();
  }

  private drawPause(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.fillStyle = "rgba(4,5,10,0.6)";
    ctx.fillRect(0, 0, this.w, this.h);
    ctx.textAlign = "center";
    ctx.fillStyle = COLORS.hud;
    ctx.shadowColor = COLORS.hud;
    ctx.shadowBlur = 16;
    ctx.font = "800 54px 'Segoe UI', system-ui, sans-serif";
    ctx.fillText("PAUSE", this.w / 2, this.h / 2 - 6);
    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(207,216,228,0.75)";
    ctx.font = "600 18px 'Segoe UI', system-ui, sans-serif";
    ctx.fillText("P  Weiter", this.w / 2, this.h / 2 + 34);
    ctx.textAlign = "left";
    ctx.restore();
  }

  private drawBackground(ctx: CanvasRenderingContext2D): void {
    const g = ctx.createLinearGradient(0, 0, this.w, this.h);
    g.addColorStop(0, COLORS.bg0);
    g.addColorStop(1, COLORS.bg1);
    ctx.fillStyle = g;
    ctx.fillRect(-40, -40, this.w + 80, this.h + 80);

    // drifting nebula haze
    const cx = this.w * 0.5 + Math.sin(this.t * 0.05) * 60;
    const cy = this.h * 0.45 + Math.cos(this.t * 0.04) * 40;
    const neb = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(this.w, this.h) * 0.6);
    neb.addColorStop(0, "rgba(40, 30, 70, 0.35)");
    neb.addColorStop(0.5, "rgba(20, 40, 60, 0.15)");
    neb.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = neb;
    ctx.fillRect(0, 0, this.w, this.h);
  }

  private drawStars(ctx: CanvasRenderingContext2D): void {
    for (const s of this.stars) {
      const twinkle = 0.4 + 0.6 * Math.abs(Math.sin(this.t * (0.5 + s.z) + s.x));
      ctx.globalAlpha = (0.2 + s.z * 0.8) * twinkle;
      ctx.fillStyle = s.z > 0.85 ? "#bcd8ff" : "#e8eef7";
      const size = s.z * 1.8;
      ctx.fillRect(s.x, s.y, size, size);
    }
    ctx.globalAlpha = 1;
  }

  private drawPlanet(ctx: CanvasRenderingContext2D, p: Planet): void {
    const { x, y } = p.position;
    const r = p.radius;
    const base = `hsl(${p.hue}, 45%`;

    ctx.save();

    // atmosphere glow
    const atmo = ctx.createRadialGradient(x, y, r * 0.85, x, y, r * 1.5);
    atmo.addColorStop(0, `hsla(${p.hue}, 80%, 60%, 0.35)`);
    atmo.addColorStop(1, `hsla(${p.hue}, 80%, 60%, 0)`);
    ctx.fillStyle = atmo;
    ctx.beginPath();
    ctx.arc(x, y, r * 1.5, 0, Math.PI * 2);
    ctx.fill();

    // planet body: lit from upper-left, dark terminator on the lower-right
    const body = ctx.createRadialGradient(x - r * 0.4, y - r * 0.4, r * 0.1, x, y, r);
    body.addColorStop(0, `${base}, 62%)`);
    body.addColorStop(0.6, `${base}, 32%)`);
    body.addColorStop(1, `hsl(${p.hue}, 40%, 8%)`);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = body;
    ctx.fill();

    // faint surface bands (clipped to the sphere)
    ctx.save();
    ctx.clip();
    ctx.globalAlpha = 0.12;
    ctx.strokeStyle = `hsl(${p.hue}, 60%, 75%)`;
    ctx.lineWidth = 3;
    for (let i = -3; i <= 3; i++) {
      const off = i * r * 0.28 + Math.sin(p.angle + i) * 4;
      ctx.beginPath();
      ctx.ellipse(x, y + off, r, r * 0.16, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();

    // crisp rim light on the lit edge
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 2;
    ctx.strokeStyle = `hsl(${p.hue}, 85%, 80%)`;
    ctx.beginPath();
    ctx.arc(x, y, r - 1, Math.PI * 0.9, Math.PI * 1.7);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // pulsing "landing zone" marker (signals the upcoming shop)
    const pulse = 0.5 + 0.5 * Math.sin(this.t * 3);
    ctx.setLineDash([6, 10]);
    ctx.lineDashOffset = -this.t * 20;
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = `rgba(127, 231, 217, ${0.35 + pulse * 0.45})`;
    ctx.shadowColor = COLORS.hud;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(x, y, r + 14, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // orbital shipyard ring (shipyard planets sell the Titan). REQ-WERFT-01
    if (p.kind === "shipyard") this.drawShipyardRing(ctx, p);

    // label above the planet
    ctx.shadowBlur = 6;
    const shipyard = p.kind === "shipyard";
    ctx.fillStyle = shipyard ? "#ffca6a" : COLORS.hud;
    ctx.shadowColor = shipyard ? "#ffca6a" : COLORS.hud;
    ctx.font = "600 13px 'Segoe UI', system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(shipyard ? "◈ ORBITAL-WERFT — TITAN" : "◊ LANDEZONE — SHOP", x, y - r - 22);
    ctx.textAlign = "left";

    ctx.restore();
  }

  /** Rotating amber shipyard ring drawn around a shipyard planet. REQ-WERFT-01. */
  private drawShipyardRing(ctx: CanvasRenderingContext2D, p: Planet): void {
    const { x, y } = p.position;
    const ringR = p.radius + 30;
    ctx.save();
    ctx.translate(x, y);
    // faint orbit track
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = "rgba(255, 190, 90, 0.35)";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.ellipse(0, 0, ringR, ringR * 0.42, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
    // dock modules riding the ring
    const modules = 6;
    for (let i = 0; i < modules; i++) {
      const a = this.t * 0.5 + (i / modules) * Math.PI * 2;
      const mx = Math.cos(a) * ringR;
      const my = Math.sin(a) * ringR * 0.42;
      const front = Math.sin(a) > 0; // near modules a touch brighter
      ctx.fillStyle = front ? "#ffcf7a" : "#a86f28";
      ctx.strokeStyle = "#5a3d15";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.rect(mx - 5, my - 3, 10, 6);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawLandingArc(ctx: CanvasRenderingContext2D, p: Planet, ratio: number): void {
    const r = p.radius + 14;
    const start = -Math.PI / 2;
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineWidth = 4;
    ctx.strokeStyle = COLORS.hud;
    ctx.shadowColor = COLORS.hud;
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(p.position.x, p.position.y, r, start, start + Math.PI * 2 * Math.min(1, ratio));
    ctx.stroke();

    ctx.shadowBlur = 6;
    ctx.fillStyle = COLORS.hud;
    ctx.font = "700 15px 'Segoe UI', system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`LANDEN ${Math.round(ratio * 100)}%`, p.position.x, p.position.y + p.radius + 40);
    ctx.textAlign = "left";
    ctx.restore();
  }

  private drawEnemy(ctx: CanvasRenderingContext2D, e: Enemy): void {
    if (e.kind === "station") {
      this.drawStation(ctx, e);
      return;
    }
    const cy = e.position.y + Math.sin(e.wobble) * 2;
    const x = e.position.x;
    const r = e.radius;
    ctx.save();
    ctx.translate(x, cy);

    // faint hostile aura
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const aura = ctx.createRadialGradient(0, 0, r * 0.4, 0, 0, r * 1.9);
    aura.addColorStop(0, "rgba(255,60,60,0.28)");
    aura.addColorStop(1, "rgba(255,0,0,0)");
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.9, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // angular hull (menacing manta shape)
    ctx.lineJoin = "round";
    const hull = ctx.createLinearGradient(0, -r, 0, r);
    hull.addColorStop(0, "#3a2230");
    hull.addColorStop(1, "#140a10");
    ctx.fillStyle = hull;
    ctx.strokeStyle = "#ff5a5a";
    ctx.lineWidth = 1.6;
    ctx.shadowColor = "rgba(255,60,60,0.5)";
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.5);
    ctx.lineTo(r, -r * 0.2);
    ctx.lineTo(r * 0.35, r * 0.2);
    ctx.lineTo(0, r);
    ctx.lineTo(-r * 0.35, r * 0.2);
    ctx.lineTo(-r, -r * 0.2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // glowing red eye
    const eye = 1.5 + (0.7 + 0.3 * Math.sin(e.wobble * 2)) * 2;
    ctx.shadowBlur = 10;
    ctx.fillStyle = "#ff3b3b";
    ctx.beginPath();
    ctx.arc(0, -r * 0.05, eye, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#ffd0d0";
    ctx.beginPath();
    ctx.arc(0, -r * 0.05, 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // hp bar while damaged
    if (e.hp < e.maxHp) {
      const w = r * 1.9;
      const hx = x - w / 2;
      const hy = cy - r - 9;
      ctx.save();
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.fillRect(hx, hy, w, 3);
      ctx.fillStyle = "#ff5a5a";
      ctx.fillRect(hx, hy, w * (e.hp / e.maxHp), 3);
      ctx.restore();
    }
  }

  private drawStation(ctx: CanvasRenderingContext2D, e: Enemy): void {
    const x = e.position.x;
    const y = e.position.y;
    const r = e.radius;

    // Charging telegraph / live beam (drawn under the hull so it seems to emit from the core)
    if (e.beamPhase !== "idle") {
      const firing = e.beamPhase === "firing";
      const ex = x + Math.cos(e.beamAngle) * STATION.beamRange;
      const ey = y + Math.sin(e.beamAngle) * STATION.beamRange;
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.lineCap = "round";
      if (firing) {
        // bright, thick beam with a hot white core
        ctx.strokeStyle = "rgba(255,80,55,0.85)";
        ctx.shadowColor = "#ff4030";
        ctx.shadowBlur = 22;
        ctx.lineWidth = STATION.beamWidth * 2;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(ex, ey);
        ctx.stroke();
        ctx.strokeStyle = "rgba(255,235,225,0.95)";
        ctx.lineWidth = STATION.beamWidth;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(ex, ey);
        ctx.stroke();
      } else {
        // thin, brightening dashed aim line during the charge (0..1 progress)
        const prog = 1 - e.beamTimer / STATION.beamCharge;
        ctx.strokeStyle = `rgba(255,90,70,${0.12 + prog * 0.5})`;
        ctx.shadowColor = "#ff4030";
        ctx.shadowBlur = 8 + prog * 14;
        ctx.lineWidth = 1 + prog * 2.5;
        ctx.setLineDash([6, 9]);
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(ex, ey);
        ctx.stroke();
      }
      ctx.restore();
    }

    ctx.save();
    ctx.translate(x, y);

    // faint aura
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const aura = ctx.createRadialGradient(0, 0, r * 0.5, 0, 0, r * 1.6);
    aura.addColorStop(0, "rgba(255,90,60,0.18)");
    aura.addColorStop(1, "rgba(255,0,0,0)");
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // slowly rotating armored hexagon hull
    ctx.rotate(e.wobble * 0.15);
    ctx.lineJoin = "round";
    const hull = ctx.createLinearGradient(-r, -r, r, r);
    hull.addColorStop(0, "#4a525e");
    hull.addColorStop(1, "#20252d");
    ctx.fillStyle = hull;
    ctx.strokeStyle = "#8894a6";
    ctx.lineWidth = 2;
    ctx.shadowColor = "rgba(140,160,190,0.4)";
    ctx.shadowBlur = 8;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const px = Math.cos(a) * r;
      const py = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // inner ring + core
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "rgba(136,148,166,0.6)";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.55, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "#2a3038";
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.34, 0, Math.PI * 2);
    ctx.fill();

    // blinking red warning lights at the corners
    const blink = 0.5 + 0.5 * Math.sin(e.wobble * 2);
    ctx.fillStyle = `rgba(255,70,70,${0.5 + blink * 0.5})`;
    ctx.shadowColor = "#ff4040";
    ctx.shadowBlur = 8;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * r * 0.7, Math.sin(a) * r * 0.7, 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // hp bar while damaged (stations have a lot of hp)
    if (e.hp < e.maxHp) {
      const w = r * 1.9;
      const hx = x - w / 2;
      const hy = y - r - 10;
      ctx.save();
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.fillRect(hx, hy, w, 4);
      ctx.fillStyle = "#ffb14d";
      ctx.fillRect(hx, hy, w * (e.hp / e.maxHp), 4);
      ctx.restore();
    }
  }

  private drawEnemyBullet(ctx: CanvasRenderingContext2D, b: Bullet): void {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.shadowColor = "#ff4040";
    ctx.shadowBlur = 12;
    ctx.fillStyle = "#ff5a5a";
    ctx.beginPath();
    ctx.arc(b.position.x, b.position.y, Math.max(2.8, b.radius), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawRocket(ctx: CanvasRenderingContext2D, r: Rocket): void {
    const angle = Math.atan2(r.velocity.y, r.velocity.x);

    // lock reticle on the current target
    if (r.target) {
      const t = r.target.position;
      ctx.save();
      ctx.strokeStyle = "rgba(255,120,60,0.7)";
      ctx.shadowColor = "#ff7a2e";
      ctx.shadowBlur = 6;
      ctx.lineWidth = 1.4;
      const s = 11;
      for (const [sx, sy] of [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ] as const) {
        ctx.beginPath();
        ctx.moveTo(t.x + sx * s, t.y + sy * s - sy * 5);
        ctx.lineTo(t.x + sx * s, t.y + sy * s);
        ctx.lineTo(t.x + sx * s - sx * 5, t.y + sy * s);
        ctx.stroke();
      }
      ctx.restore();
    }

    ctx.save();
    ctx.translate(r.position.x, r.position.y);
    ctx.rotate(angle);

    // engine glow
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const flick = 0.7 + Math.random() * 0.5;
    const fg = ctx.createLinearGradient(-6, 0, -6 - 14 * flick, 0);
    fg.addColorStop(0, "rgba(255,190,60,0.95)");
    fg.addColorStop(1, "rgba(255,60,0,0)");
    ctx.fillStyle = fg;
    ctx.beginPath();
    ctx.moveTo(-6, -2.4);
    ctx.lineTo(-6 - 14 * flick, 0);
    ctx.lineTo(-6, 2.4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // steel body with an orange warhead
    ctx.lineJoin = "round";
    ctx.fillStyle = "#c7d3e0";
    ctx.strokeStyle = "#5b6675";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(9, 0);
    ctx.lineTo(2, -3);
    ctx.lineTo(-7, -3);
    ctx.lineTo(-7, 3);
    ctx.lineTo(2, 3);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#ff7a2e";
    ctx.beginPath();
    ctx.moveTo(9, 0);
    ctx.lineTo(2, -3);
    ctx.lineTo(2, 3);
    ctx.closePath();
    ctx.fill();
    // tail fins
    ctx.fillStyle = "#8894a6";
    ctx.beginPath();
    ctx.moveTo(-7, -3);
    ctx.lineTo(-10, -5);
    ctx.lineTo(-6, -3);
    ctx.closePath();
    ctx.moveTo(-7, 3);
    ctx.lineTo(-10, 5);
    ctx.lineTo(-6, 3);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  private drawMine(ctx: CanvasRenderingContext2D, m: Mine): void {
    const blink = 0.5 + 0.5 * Math.sin(m.pulse);
    const fade = Math.min(1, m.life / 1.5); // fade out before it fizzles
    ctx.save();
    ctx.globalAlpha = fade;
    ctx.translate(m.position.x, m.position.y);

    // trigger-radius aura
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const aura = ctx.createRadialGradient(0, 0, 2, 0, 0, m.radius);
    aura.addColorStop(0, `rgba(255,90,60,${0.12 + blink * 0.14})`);
    aura.addColorStop(1, "rgba(255,0,0,0)");
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.arc(0, 0, m.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // spikes
    ctx.strokeStyle = "#8894a6";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * 4, Math.sin(a) * 4);
      ctx.lineTo(Math.cos(a) * 8, Math.sin(a) * 8);
      ctx.stroke();
    }

    // metal body
    ctx.fillStyle = "#3a4250";
    ctx.strokeStyle = "#5b6675";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(0, 0, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // blinking warning light
    ctx.fillStyle = `rgba(255,70,70,${0.4 + blink * 0.6})`;
    ctx.shadowColor = "#ff4040";
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(0, 0, 2.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  private drawLoot(ctx: CanvasRenderingContext2D, l: Loot): void {
    const colors: Record<LootKind, string> = {
      shield: "#57e5ff",
      antigrav: "#b98cff",
      ammo: "#ffd166",
      rocket: "#ff7a2e",
      mine: "#ff5a5a",
    };
    const col = colors[l.kind];
    const pulse = 0.6 + 0.4 * Math.sin(l.spin * 4);
    const alpha = Math.min(1, l.life / 1.5); // fade before vanishing
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(l.position.x, l.position.y);
    ctx.shadowColor = col;
    ctx.shadowBlur = 8 + 8 * pulse;

    // rotating hex frame
    ctx.save();
    ctx.rotate(l.spin);
    ctx.strokeStyle = col;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const px = Math.cos(a) * l.radius;
      const py = Math.sin(a) * l.radius;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.restore();

    // upright glyph per kind
    ctx.fillStyle = col;
    ctx.strokeStyle = col;
    if (l.kind === "shield") {
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, -6);
      ctx.lineTo(5, -3);
      ctx.lineTo(5, 3);
      ctx.lineTo(0, 7);
      ctx.lineTo(-5, 3);
      ctx.lineTo(-5, -3);
      ctx.closePath();
      ctx.stroke();
    } else if (l.kind === "antigrav") {
      ctx.beginPath();
      ctx.arc(0, 0, 2.2, 0, Math.PI * 2);
      ctx.fill();
      for (const a of [0, 2.09, 4.18]) {
        ctx.beginPath();
        ctx.arc(Math.cos(a + l.spin) * 6, Math.sin(a + l.spin) * 6, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (l.kind === "rocket") {
      // small missile pointing up
      ctx.beginPath();
      ctx.moveTo(0, -7);
      ctx.lineTo(2.6, -2);
      ctx.lineTo(2.6, 4);
      ctx.lineTo(-2.6, 4);
      ctx.lineTo(-2.6, -2);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-2.6, 4);
      ctx.lineTo(-4.5, 6.5);
      ctx.lineTo(-2.6, 6.5);
      ctx.closePath();
      ctx.moveTo(2.6, 4);
      ctx.lineTo(4.5, 6.5);
      ctx.lineTo(2.6, 6.5);
      ctx.closePath();
      ctx.fill();
    } else if (l.kind === "mine") {
      // spiked mine: spikes + core
      ctx.lineWidth = 1.6;
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * 3, Math.sin(a) * 3);
        ctx.lineTo(Math.cos(a) * 7, Math.sin(a) * 7);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(0, 0, 3, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.moveTo(-2.6, 4);
      ctx.lineTo(-2.6, -3);
      ctx.lineTo(0, -6);
      ctx.lineTo(2.6, -3);
      ctx.lineTo(2.6, 4);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  private drawShieldBubble(
    ctx: CanvasRenderingContext2D,
    pos: Vec,
    radius: number,
    t: number,
    strength: number,
  ): void {
    const r = radius * 2.3;
    const pulse = 0.5 + 0.5 * Math.sin(t * 4);
    ctx.save();
    ctx.translate(pos.x, pos.y);
    ctx.shadowColor = "#57e5ff";
    if (strength <= 0) {
      // broken — faint dashed ring shows it is recharging
      ctx.shadowBlur = 6;
      ctx.strokeStyle = "rgba(87,229,255,0.28)";
      ctx.lineWidth = 1.4;
      ctx.setLineDash([5, 9]);
      ctx.lineDashOffset = -t * 18;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    } else {
      ctx.shadowBlur = 14;
      ctx.strokeStyle = `rgba(87,229,255,${0.4 + strength * 0.3 + pulse * 0.2})`;
      ctx.lineWidth = 1.5 + strength * 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = `rgba(87,229,255,${(0.05 + pulse * 0.04) * strength})`;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private drawAntigravField(ctx: CanvasRenderingContext2D, pos: Vec, t: number): void {
    ctx.save();
    ctx.translate(pos.x, pos.y);
    ctx.rotate(t * 0.6);
    ctx.strokeStyle = "rgba(185,140,255,0.28)";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([8, 14]);
    ctx.beginPath();
    ctx.arc(0, 0, LOOT.antigravRadius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = "rgba(185,140,255,0.16)";
    ctx.beginPath();
    ctx.arc(0, 0, LOOT.antigravRadius * 0.62, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  private drawBullet(ctx: CanvasRenderingContext2D, b: Bullet): void {
    // Colour by loaded ammo: explosive = orange shell, AP = hot magenta, standard = amber.
    const explosive = b.blast > 0;
    const ap = !explosive && b.damage >= 2;
    const color = explosive ? "#ff7a2e" : ap ? "#ff4d6d" : COLORS.bullet;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    if (explosive) {
      // A small armed shell in flight (orange body + hot core). It only "blooms" into a
      // blast animation once it detonates near the target (see onExplosion at detonation).
      ctx.shadowColor = color;
      ctx.shadowBlur = 10;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(b.position.x, b.position.y, 3.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#ffe6a0";
      ctx.beginPath();
      ctx.arc(b.position.x, b.position.y, 1.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }
    const r = Math.max(2.4, b.radius * 1.4);
    ctx.shadowColor = color;
    ctx.shadowBlur = 12;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(b.position.x, b.position.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawAsteroid(
    ctx: CanvasRenderingContext2D,
    verts: Vec[],
    center: Vec,
    radius: number,
    hpRatio: number,
    isBoss = false,
  ): void {
    if (verts.length === 0) return;
    ctx.save();

    const damaged = hpRatio < 0.999;
    const heat = 1 - hpRatio; // 0 = pristine, 1 = nearly destroyed

    // boss: menacing red aura behind the rock
    if (isBoss) {
      const pulse = 0.5 + 0.5 * Math.sin(this.t * 3);
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const aura = ctx.createRadialGradient(center.x, center.y, radius * 0.5, center.x, center.y, radius * 1.5);
      aura.addColorStop(0, `rgba(255,60,40,${0.22 + pulse * 0.14})`);
      aura.addColorStop(1, "rgba(255,0,0,0)");
      ctx.fillStyle = aura;
      ctx.beginPath();
      ctx.arc(center.x, center.y, radius * 1.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // rocky fill with radial shading (offset light source scales with size)
    const off = radius * 0.22;
    const grad = ctx.createRadialGradient(
      center.x - off,
      center.y - off,
      radius * 0.08,
      center.x,
      center.y,
      radius * 1.1,
    );
    // damaged rocks glow warmer at the core (molten cracks)
    grad.addColorStop(0, damaged ? `rgba(${90 + heat * 120}, ${80}, 70, 1)` : "#4a505d");
    grad.addColorStop(1, "#23262e");

    ctx.beginPath();
    ctx.moveTo(verts[0].x, verts[0].y);
    for (let i = 1; i < verts.length; i++) ctx.lineTo(verts[i].x, verts[i].y);
    ctx.closePath();

    ctx.fillStyle = grad;
    ctx.fill();

    // etched edge (warmer + brighter as it takes damage)
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = damaged ? `rgba(255, ${170 - heat * 90}, 90, ${0.6 + heat * 0.4})` : COLORS.rockEdge;
    ctx.shadowColor = damaged ? "rgba(255,120,60,0.6)" : "rgba(140,160,190,0.5)";
    ctx.shadowBlur = 8;
    ctx.stroke();

    // interior crack detail
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "rgba(0,0,0,0.35)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(center.x, center.y);
    ctx.lineTo(verts[Math.floor(verts.length / 3)].x, verts[Math.floor(verts.length / 3)].y);
    ctx.moveTo(center.x, center.y);
    ctx.lineTo(verts[Math.floor((2 * verts.length) / 3)].x, verts[Math.floor((2 * verts.length) / 3)].y);
    ctx.stroke();

    // boss: hot molten core + glowing red rim
    if (isBoss) {
      const pulse = 0.5 + 0.5 * Math.sin(this.t * 3);
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const core = ctx.createRadialGradient(center.x, center.y, 0, center.x, center.y, radius * 0.7);
      core.addColorStop(0, `rgba(255,140,60,${0.5 + pulse * 0.3})`);
      core.addColorStop(1, "rgba(255,60,0,0)");
      ctx.fillStyle = core;
      ctx.beginPath();
      ctx.arc(center.x, center.y, radius * 0.7, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      ctx.strokeStyle = `rgba(255,80,60,${0.6 + pulse * 0.4})`;
      ctx.lineWidth = 2.4;
      ctx.shadowColor = "#ff4030";
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.moveTo(verts[0].x, verts[0].y);
      for (let i = 1; i < verts.length; i++) ctx.lineTo(verts[i].x, verts[i].y);
      ctx.closePath();
      ctx.stroke();
    }

    ctx.restore();
  }

  private drawShip(
    ctx: CanvasRenderingContext2D,
    pos: Vec,
    angle: number,
    thrusting: boolean,
    invuln: number,
    shipId: ShipId,
    aimAngle: number,
    upgrades: readonly string[],
    autoAimAngle: number,
  ): void {
    ctx.save();
    ctx.translate(pos.x, pos.y);
    ctx.rotate(angle);

    // blink while invulnerable
    if (invuln > 0 && Math.floor(invuln * 12) % 2 === 0) {
      ctx.globalAlpha = 0.35;
    }

    ctx.lineJoin = "round";
    if (shipId === "deltaRaptor") this.drawDeltaRaptorBody(ctx, thrusting);
    else if (shipId === "titan")
      this.drawTitanBody(ctx, thrusting, aimAngle - angle, upgrades, autoAimAngle - angle);
    else this.drawVanguardBody(ctx, thrusting);

    ctx.restore();
  }

  /** "Vanguard" — heavy armored fighter. Forward = +x. */
  private drawVanguardBody(ctx: CanvasRenderingContext2D, thrusting: boolean): void {

    // twin thruster flames from the two tail nozzles (y = ±5)
    if (thrusting) {
      const flick = 0.7 + Math.random() * 0.5;
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (const ey of [-5, 5]) {
        const fg = ctx.createLinearGradient(-15, ey, -15 - 22 * flick, ey);
        fg.addColorStop(0, "rgba(255,190,60,0.95)");
        fg.addColorStop(1, "rgba(255,60,0,0)");
        ctx.fillStyle = fg;
        ctx.beginPath();
        ctx.moveTo(-14, ey - 3.2);
        ctx.lineTo(-15 - 22 * flick, ey);
        ctx.lineTo(-14, ey + 3.2);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }

    // shoulder armor plates (wide angular blocks on each side)
    ctx.fillStyle = "#333b47";
    ctx.strokeStyle = "#5b6675";
    ctx.lineWidth = 1.2;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(4, 8 * s);
      ctx.lineTo(-2, 18 * s);
      ctx.lineTo(-12, 18 * s);
      ctx.lineTo(-11, 8 * s);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    // heavy engine housings at the tail
    ctx.fillStyle = "#171b22";
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(-13, 3 * s);
      ctx.lineTo(-13, 7.5 * s);
      ctx.lineTo(-17, 6.5 * s);
      ctx.lineTo(-17, 3.5 * s);
      ctx.closePath();
      ctx.fill();
    }

    // main hull (broad armored body) with gunmetal shading + glow
    ctx.shadowColor = COLORS.hullGlow;
    ctx.shadowBlur = 12;
    const hull = ctx.createLinearGradient(-15, -8, 19, 8);
    hull.addColorStop(0, "#2a3340");
    hull.addColorStop(1, "#8aa0b8");
    ctx.fillStyle = hull;
    ctx.strokeStyle = COLORS.hull;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(19, 0); // nose
    ctx.lineTo(11, -8);
    ctx.lineTo(-11, -8);
    ctx.lineTo(-15, -5);
    ctx.lineTo(-15, 5);
    ctx.lineTo(-11, 8);
    ctx.lineTo(11, 8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // bright central spine plate
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#aeb9c9";
    ctx.beginPath();
    ctx.moveTo(16, 0);
    ctx.lineTo(-13, -2.6);
    ctx.lineTo(-13, 2.6);
    ctx.closePath();
    ctx.fill();

    // twin nose cannon barrels
    ctx.strokeStyle = "#8894a6";
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(14, -4.2);
    ctx.lineTo(24, -4.2);
    ctx.moveTo(14, 4.2);
    ctx.lineTo(24, 4.2);
    ctx.stroke();

    // cockpit (teal canopy)
    ctx.fillStyle = COLORS.hud;
    ctx.shadowColor = COLORS.hud;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.ellipse(4, 0, 5, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#d8fff9";
    ctx.beginPath();
    ctx.ellipse(5, 0, 2, 1.3, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  /** "Delta Raptor" — agile delta-wing interceptor. Forward = +x. */
  private drawDeltaRaptorBody(ctx: CanvasRenderingContext2D, thrusting: boolean): void {
    // twin thruster flames (cooler exhaust to signal the faster ship)
    if (thrusting) {
      const flick = 0.7 + Math.random() * 0.5;
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (const ey of [-5, 5]) {
        const fg = ctx.createLinearGradient(-9, ey, -9 - 26 * flick, ey);
        fg.addColorStop(0, "rgba(120,220,255,0.9)");
        fg.addColorStop(1, "rgba(0,120,255,0)");
        ctx.fillStyle = fg;
        ctx.beginPath();
        ctx.moveTo(-8, ey - 2.6);
        ctx.lineTo(-9 - 26 * flick, ey);
        ctx.lineTo(-8, ey + 2.6);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }

    // engine nozzles at the tail
    ctx.fillStyle = "#141922";
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(-8, 3.5 * s);
      ctx.lineTo(-8, 6.5 * s);
      ctx.lineTo(-12, 6 * s);
      ctx.lineTo(-12, 4 * s);
      ctx.closePath();
      ctx.fill();
    }

    // swept delta-wing hull
    ctx.shadowColor = COLORS.hullGlow;
    ctx.shadowBlur = 12;
    const hull = ctx.createLinearGradient(-13, -12, 20, 12);
    hull.addColorStop(0, "#243244");
    hull.addColorStop(1, "#88a2c2");
    ctx.fillStyle = hull;
    ctx.strokeStyle = COLORS.hull;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(20, 0); // nose
    ctx.lineTo(-13, -15); // left wingtip
    ctx.lineTo(-9, 0); // tail notch
    ctx.lineTo(-13, 15); // right wingtip
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // bright central spine
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#b9c8dc";
    ctx.beginPath();
    ctx.moveTo(18, 0);
    ctx.lineTo(-9, -2.4);
    ctx.lineTo(-9, 2.4);
    ctx.closePath();
    ctx.fill();

    // wingtip accent lights
    ctx.fillStyle = COLORS.hud;
    ctx.shadowColor = COLORS.hud;
    ctx.shadowBlur = 8;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(-12, 14 * s, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }

    // cockpit (teal canopy)
    ctx.beginPath();
    ctx.fillStyle = COLORS.hud;
    ctx.ellipse(6, 0, 4.5, 2.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#d8fff9";
    ctx.beginPath();
    ctx.ellipse(7, 0, 1.8, 1.1, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  /** Silhouette points (local space, nose along +x) for a battleship design. */
  private battleshipHull(design: Base["design"]): number[][] {
    if (design === "dreadnought")
      return [[48, 0], [26, -15], [-30, -18], [-48, -10], [-48, 10], [-30, 18], [26, 15]];
    if (design === "fortress")
      return [[50, -8], [50, 8], [34, 26], [-44, 22], [-54, 8], [-54, -8], [-44, -22], [34, -26]];
    // mandible: an open-jawed envelope with a front notch between the two claws
    return [[52, -12], [30, -22], [-30, -18], [-40, 0], [-30, 18], [30, 22], [52, 12], [20, 0]];
  }

  /** A large enemy battleship: one hull, one health bar, blue shield outline. REQ-BASE-01. */
  private drawBase(ctx: CanvasRenderingContext2D, base: Base): void {
    const hull = this.battleshipHull(base.design);
    const trace = (pts: number[][], k = 1): void => {
      ctx.beginPath();
      pts.forEach(([x, y], i) => (i ? ctx.lineTo(x * k, y * k) : ctx.moveTo(x * k, y * k)));
      ctx.closePath();
    };
    const glow = (fn: () => void): void => {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      fn();
      ctx.restore();
    };

    ctx.save();
    ctx.translate(base.position.x, base.position.y);
    ctx.rotate(base.angle);
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    if (base.elite) {
      // pulsing golden bounty ring around the hull
      const pulse = 0.5 + 0.5 * Math.sin(this.t * 4);
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.strokeStyle = `rgba(255,209,102,${0.4 + pulse * 0.4})`;
      ctx.lineWidth = 3;
      ctx.shadowColor = "#ffd166";
      ctx.shadowBlur = 16;
      ctx.beginPath();
      ctx.arc(0, 0, base.radius + 10, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // hull body
    const g = ctx.createLinearGradient(0, -28, 0, 28);
    g.addColorStop(0, "#3a4451");
    g.addColorStop(1, "#262d38");
    ctx.fillStyle = g;
    ctx.strokeStyle = "#5a6474";
    ctx.lineWidth = 2;
    ctx.shadowColor = "rgba(0,0,0,0.5)";
    ctx.shadowBlur = 6;
    trace(hull);
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;

    if (base.design === "dreadnought") this.drawDreadnought(ctx, base, glow);
    else if (base.design === "mandible") this.drawMandible(ctx, base, glow);
    else this.drawFortress(ctx, base, glow);

    // damage smoke tint over a badly hurt hull
    const hpRatio = base.hp / base.maxHp;
    if (hpRatio < 0.5) {
      ctx.globalAlpha = (0.5 - hpRatio) * 0.6;
      ctx.fillStyle = "#ff4030";
      trace(hull);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // Shield: a glowing BLUE LINE hugging the hull (like the player's ship shield),
    // never a filled-blue hull. Brightness scales with remaining charges. REQ-BASE-02.
    if (base.shieldMax > 0) {
      const strength = base.shield / base.shieldMax;
      const pulse = 0.5 + 0.5 * Math.sin(base.wobble * 4);
      ctx.shadowColor = "#57e5ff";
      if (base.shield > 0) {
        ctx.shadowBlur = 12;
        ctx.strokeStyle = `rgba(120,235,255,${0.5 + strength * 0.3 + pulse * 0.15})`;
        ctx.lineWidth = 1.6 + strength * 1.6;
        trace(hull, 1.16);
        ctx.stroke();
      } else {
        // shield down: faint dashed outline while it recharges
        ctx.shadowBlur = 5;
        ctx.strokeStyle = "rgba(120,235,255,0.22)";
        ctx.lineWidth = 1.2;
        ctx.setLineDash([6, 8]);
        ctx.lineDashOffset = -base.wobble * 20;
        trace(hull, 1.16);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.shadowBlur = 0;
    }

    ctx.restore();

    this.drawBaseHealthBar(ctx, base);
  }

  /** A — armoured capital ship: bridge spine, twin nose cannon, twin rear engines. */
  private drawDreadnought(ctx: CanvasRenderingContext2D, base: Base, glow: (fn: () => void) => void): void {
    // raised bridge
    ctx.fillStyle = "#20262f";
    ctx.strokeStyle = "#4a5361";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(18, -4);
    ctx.lineTo(-2, -13);
    ctx.lineTo(-22, -12);
    ctx.lineTo(-26, -4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // bridge window (pulsing)
    const blink = 0.5 + 0.5 * Math.sin(base.wobble * 3);
    ctx.fillStyle = `rgba(255,80,48,${0.55 + blink * 0.4})`;
    ctx.fillRect(-10, -10, 8, 4);
    // twin nose cannons
    ctx.strokeStyle = "#454e59";
    ctx.lineWidth = 4;
    for (const y of [-6, 6]) {
      ctx.beginPath();
      ctx.moveTo(24, y);
      ctx.lineTo(50, y);
      ctx.stroke();
    }
    // plate seams
    ctx.strokeStyle = "rgba(20,24,30,0.7)";
    ctx.lineWidth = 1.4;
    for (const x of [-28, -8, 12]) {
      ctx.beginPath();
      ctx.moveTo(x, -16);
      ctx.lineTo(x, 16);
      ctx.stroke();
    }
    // twin rear engines
    glow(() => {
      ctx.fillStyle = "rgba(255,70,50,0.5)";
      for (const y of [-6, 6]) {
        ctx.beginPath();
        ctx.ellipse(-54, y, 12, 6, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    });
    ctx.fillStyle = "#ff5030";
    for (const y of [-6, 6]) {
      ctx.beginPath();
      ctx.arc(-48, y, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /** B — predatory raider: two forward claws, glowing red core eye, rear engine. */
  private drawMandible(ctx: CanvasRenderingContext2D, base: Base, glow: (fn: () => void) => void): void {
    ctx.fillStyle = "#2f3743";
    ctx.strokeStyle = "#5a6474";
    ctx.lineWidth = 1.4;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(8, 6 * s);
      ctx.lineTo(30, 20 * s);
      ctx.lineTo(50, 13 * s);
      ctx.lineTo(45, 6 * s);
      ctx.lineTo(24, 9 * s);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    // claw tips
    ctx.fillStyle = "#ffae57";
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(50, 13 * s, 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
    // glowing core eye
    const pulse = 0.5 + 0.5 * Math.sin(base.wobble * 3);
    glow(() => {
      ctx.fillStyle = `rgba(255,60,40,${0.4 + pulse * 0.4})`;
      ctx.beginPath();
      ctx.arc(6, 0, 16, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.fillStyle = "#ff3b28";
    ctx.beginPath();
    ctx.arc(6, 0, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffd0a0";
    ctx.beginPath();
    ctx.arc(6, 0, 4, 0, Math.PI * 2);
    ctx.fill();
    // rear engine
    glow(() => {
      ctx.fillStyle = "rgba(255,70,50,0.5)";
      ctx.beginPath();
      ctx.ellipse(-42, 0, 11, 7, 0, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  /** C — shipyard fortress: superstructure, gun turrets, red-lit hangar bay, rear engines. */
  private drawFortress(ctx: CanvasRenderingContext2D, base: Base, glow: (fn: () => void) => void): void {
    // superstructure blocks
    ctx.fillStyle = "#39414e";
    ctx.strokeStyle = "#565f6d";
    ctx.lineWidth = 1.3;
    for (const [x, w] of [[-8, 22], [18, 14]]) {
      ctx.beginPath();
      ctx.rect(x, -26, w, 8);
      ctx.fill();
      ctx.stroke();
    }
    // gun turrets on the deck
    ctx.fillStyle = "#2a313c";
    for (const x of [-2, 14]) {
      ctx.beginPath();
      ctx.arc(x, -14, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x, -14);
      ctx.lineTo(x + 10, -18);
      ctx.stroke();
    }
    // hangar bay with red interior + gold rim
    ctx.fillStyle = "#140f0e";
    ctx.strokeStyle = "#ffd24a";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.rect(-34, 4, 26, 18);
    ctx.fill();
    ctx.stroke();
    const blink = 0.5 + 0.5 * Math.sin(base.wobble * 5);
    ctx.fillStyle = `rgba(255,90,60,${0.5 + blink * 0.4})`;
    ctx.fillRect(-34, 4, 6, 18);
    // plate seams
    ctx.strokeStyle = "rgba(20,24,30,0.6)";
    ctx.lineWidth = 1.4;
    for (const x of [-20, 6]) {
      ctx.beginPath();
      ctx.moveTo(x, -22);
      ctx.lineTo(x, 22);
      ctx.stroke();
    }
    // twin rear engines
    glow(() => {
      ctx.fillStyle = "rgba(255,70,50,0.5)";
      for (const y of [-8, 8]) {
        ctx.beginPath();
        ctx.ellipse(-58, y, 12, 6, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    });
    ctx.fillStyle = "#ff5030";
    for (const y of [-8, 8]) {
      ctx.beginPath();
      ctx.arc(-54, y, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /** One health bar (plus a thin blue shield sub-bar) floating above a battleship. */
  private drawBaseHealthBar(ctx: CanvasRenderingContext2D, base: Base): void {
    const w = Math.max(46, base.radius * 1.5);
    const h = 5;
    const x = base.position.x - w / 2;
    const y = base.position.y - base.radius - 18;
    const ratio = Math.max(0, base.hp / base.maxHp);
    ctx.save();
    ctx.fillStyle = "rgba(10,12,18,0.82)";
    ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
    ctx.fillStyle = ratio > 0.5 ? "#5fd66b" : ratio > 0.25 ? "#ffb347" : "#ff4d4d";
    ctx.fillRect(x, y, w * ratio, h);
    ctx.strokeStyle = "rgba(200,210,225,0.35)";
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, w, h);
    if (base.shieldMax > 0 && base.shield > 0) {
      ctx.fillStyle = "rgba(120,235,255,0.9)";
      ctx.fillRect(x, y + h + 2, w * (base.shield / base.shieldMax), 2);
    }
    ctx.restore();
  }

  /** A friendly wingman drone: small teal delta pointing at its target. REQ-SHIP-05. */
  private drawWingman(ctx: CanvasRenderingContext2D, wm: Wingman): void {
    const r = WINGMAN.radius;
    ctx.save();
    ctx.translate(wm.position.x, wm.position.y);
    ctx.rotate(wm.angle);
    ctx.lineJoin = "round";
    // engine glow
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = "rgba(120,220,255,0.7)";
    ctx.shadowColor = "#7fe7d9";
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(-r * 0.7, 0, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // hull
    ctx.fillStyle = "#274050";
    ctx.strokeStyle = COLORS.hud;
    ctx.shadowColor = COLORS.hud;
    ctx.shadowBlur = 6;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(r, 0);
    ctx.lineTo(-r * 0.7, -r * 0.7);
    ctx.lineTo(-r * 0.4, 0);
    ctx.lineTo(-r * 0.7, r * 0.7);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // cockpit dot
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#d8fff9";
    ctx.beginPath();
    ctx.arc(r * 0.1, 0, 1.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /** Tractor-beam field: a pull ring plus beams to the small asteroids and loot in range. REQ-SHIP-05. */
  private drawTractorField(ctx: CanvasRenderingContext2D, world: World): void {
    const s = world.ship.position;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const pulse = 0.5 + 0.5 * Math.sin(this.t * 3);
    ctx.strokeStyle = `rgba(185,140,255,${0.06 + pulse * 0.07})`;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 8]);
    ctx.beginPath();
    ctx.arc(s.x, s.y, TRACTOR.range, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.shadowColor = "#b98cff";
    ctx.shadowBlur = 8;
    const beam = (tx: number, ty: number, strong: boolean): void => {
      const g = ctx.createLinearGradient(s.x, s.y, tx, ty);
      g.addColorStop(0, `rgba(205,175,255,${strong ? 0.6 : 0.4})`);
      g.addColorStop(1, "rgba(185,140,255,0.04)");
      ctx.strokeStyle = g;
      ctx.lineWidth = strong ? 3 : 2;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(tx, ty);
      ctx.stroke();
    };
    for (const a of world.asteroids)
      if (a.size === "small" && distance(a.position, s) <= TRACTOR.range)
        beam(a.position.x, a.position.y, true);
    for (const l of world.loot)
      if (distance(l.position, s) <= TRACTOR.range) beam(l.position.x, l.position.y, false);
    ctx.restore();
  }

  /** "Titan" — heavy battleship with mouse-aimed turrets. Forward = +x, turrets swivel by turretRot. */
  private drawTitanBody(
    ctx: CanvasRenderingContext2D,
    thrusting: boolean,
    turretRot: number,
    upgrades: readonly string[],
    autoTurretRot: number,
  ): void {
    // heavy quad thruster flames
    if (thrusting) {
      const flick = 0.7 + Math.random() * 0.5;
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (const ey of [-9, -3, 3, 9]) {
        const fg = ctx.createLinearGradient(-20, ey, -20 - 18 * flick, ey);
        fg.addColorStop(0, "rgba(255,170,60,0.9)");
        fg.addColorStop(1, "rgba(255,60,0,0)");
        ctx.fillStyle = fg;
        ctx.beginPath();
        ctx.moveTo(-19, ey - 2.4);
        ctx.lineTo(-20 - 18 * flick, ey);
        ctx.lineTo(-19, ey + 2.4);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }

    // main armored hull (broad fortress slab)
    ctx.shadowColor = COLORS.hullGlow;
    ctx.shadowBlur = 14;
    const hull = ctx.createLinearGradient(-20, -14, 22, 14);
    hull.addColorStop(0, "#2b3542");
    hull.addColorStop(1, "#7f93aa");
    ctx.fillStyle = hull;
    ctx.strokeStyle = COLORS.hull;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(22, 0); // nose
    ctx.lineTo(14, -12);
    ctx.lineTo(-14, -14);
    ctx.lineTo(-20, -6);
    ctx.lineTo(-20, 6);
    ctx.lineTo(-14, 14);
    ctx.lineTo(14, 12);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // armor ridge plates along the flanks
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#3a4552";
    ctx.strokeStyle = "#586475";
    ctx.lineWidth = 1;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(10, 3 * s);
      ctx.lineTo(-14, 5 * s);
      ctx.lineTo(-14, 10 * s);
      ctx.lineTo(8, 8 * s);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    // central bridge / shield core (teal glow)
    ctx.fillStyle = COLORS.hud;
    ctx.shadowColor = COLORS.hud;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.ellipse(-2, 0, 4.5, 3.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#d8fff9";
    ctx.beginPath();
    ctx.ellipse(-1, 0, 1.8, 1.3, 0, 0, Math.PI * 2);
    ctx.fill();

    // three mouse-aimed turrets: base ring on the hull, barrel swivelled to the aim
    for (const t of SHIPS.titan.turrets ?? []) {
      ctx.save();
      ctx.translate(t.x, t.y);
      ctx.fillStyle = "#20262e";
      ctx.strokeStyle = "#8894a6";
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(0, 0, 5.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.rotate(turretRot); // barrels aim independently of the hull
      ctx.fillStyle = "#454f5c";
      ctx.strokeStyle = "#9fb0c4";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.rect(0, -2.2, t.barrel, 4.4);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#c9d4e2";
      ctx.beginPath();
      ctx.arc(t.barrel, 0, 2, 0, Math.PI * 2);
      ctx.fill();
      // turret cap over the base
      ctx.fillStyle = "#2b3440";
      ctx.strokeStyle = "#8894a6";
      ctx.beginPath();
      ctx.arc(0, 0, 3.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // Installed upgrades, shown on the hull. REQ-SHIP-05.
    if (upgrades.includes("autocannon")) {
      // auto-aiming turret on the front deck (swivels toward its target)
      const m = AUTOCANNON.mount;
      ctx.save();
      ctx.translate(m.x, m.y);
      ctx.fillStyle = "#242b34";
      ctx.strokeStyle = "#c98a3a"; // brass ring to set it apart
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(0, 0, 4.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.rotate(autoTurretRot);
      ctx.fillStyle = "#4a5560";
      ctx.strokeStyle = "#d7a24a";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.rect(0, -1.8, m.barrel, 3.6);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#ffcf7a";
      ctx.shadowColor = "#ffb14d";
      ctx.shadowBlur = 5;
      ctx.beginPath();
      ctx.arc(m.barrel, 0, 1.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    if (upgrades.includes("hangar")) {
      // launch-bay openings on the aft flanks where the drones deploy
      ctx.save();
      ctx.fillStyle = "#12161c";
      ctx.strokeStyle = "#7fe7d9";
      ctx.shadowColor = "#7fe7d9";
      ctx.shadowBlur = 6;
      ctx.lineWidth = 1;
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.rect(-14, 6 * s - (s < 0 ? 3 : 0), 7, 3);
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();
    }
    if (upgrades.includes("tractor")) {
      // tractor emitter dish on the belly/front (the pull field itself is drawn in world space)
      ctx.save();
      ctx.translate(14, 0);
      ctx.strokeStyle = "#b98cff";
      ctx.fillStyle = "rgba(185,140,255,0.3)";
      ctx.shadowColor = "#b98cff";
      ctx.shadowBlur = 8;
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.arc(0, 0, 3.4, Math.PI * 0.6, Math.PI * 1.4, true); // dish cup opening forward
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#e6d8ff";
      ctx.beginPath();
      ctx.arc(1.5, 0, 1.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    if (upgrades.includes("engines")) {
      // glowing upgraded engine nozzles at the tail (visible even when coasting)
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = "rgba(120,200,255,0.85)";
      ctx.shadowColor = "#6cc4ff";
      ctx.shadowBlur = 10;
      for (const ey of [-9, -3, 3, 9]) {
        ctx.beginPath();
        ctx.arc(-20, ey, 2.3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
    if (upgrades.includes("deflector")) {
      // deflector emitter coil on the aft deck (the pulse ring is drawn in world space)
      ctx.save();
      ctx.translate(-7, 0);
      ctx.strokeStyle = "#7fd8ff";
      ctx.shadowColor = "#57e5ff";
      ctx.shadowBlur = 8;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(0, 0, 5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, 2.4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  /** Expanding shockwave ring for a deflector pulse. REQ-SHIP-05. */
  private drawDeflectorPulse(ctx: CanvasRenderingContext2D, pos: Vec, flash: number): void {
    const progress = 1 - flash / DEFLECTOR.flashTime; // 0 -> 1 as the ring expands
    const radius = progress * DEFLECTOR.radius;
    const alpha = flash / DEFLECTOR.flashTime; // fade out as it grows
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = `rgba(127,216,255,${0.5 * alpha})`;
    ctx.shadowColor = "#57e5ff";
    ctx.shadowBlur = 16;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 1;
    ctx.strokeStyle = `rgba(220,245,255,${0.35 * alpha})`;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, radius * 0.82, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  private drawVignette(ctx: CanvasRenderingContext2D): void {
    const g = ctx.createRadialGradient(
      this.w / 2,
      this.h / 2,
      Math.min(this.w, this.h) * 0.35,
      this.w / 2,
      this.h / 2,
      Math.max(this.w, this.h) * 0.75,
    );
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, "rgba(0,0,0,0.72)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.w, this.h);

    // faint scanlines for a grungy CRT feel
    ctx.globalAlpha = 0.05;
    ctx.fillStyle = "#000";
    for (let y = 0; y < this.h; y += 3) ctx.fillRect(0, y, this.w, 1);
    ctx.globalAlpha = 1;
  }

  private drawHud(ctx: CanvasRenderingContext2D, world: World): void {
    ctx.save();
    ctx.font = "600 20px 'Segoe UI', system-ui, sans-serif";
    ctx.textBaseline = "top";
    ctx.fillStyle = COLORS.hud;
    ctx.shadowColor = COLORS.hud;
    ctx.shadowBlur = 10;
    ctx.fillText(`SCORE ${String(world.score).padStart(6, "0")}`, 24, 20);

    // credits (top-right)
    ctx.textAlign = "right";
    ctx.fillStyle = "#ffd166";
    ctx.shadowColor = "#ffd166";
    ctx.fillText(`◈ ${world.credits} CR`, this.w - 24, 20);

    // wave number (below credits)
    ctx.fillStyle = "#9fb0c3";
    ctx.shadowColor = "#9fb0c3";
    ctx.shadowBlur = 6;
    ctx.font = "600 15px 'Segoe UI', system-ui, sans-serif";
    ctx.fillText(`WELLE ${world.wave}`, this.w - 24, 46);
    ctx.textAlign = "left";

    // active weapon + ammo (below score)
    this.drawLoadout(ctx, world);

    // lives as mini ship icons matching the equipped ship
    ctx.shadowBlur = 6;
    const delta = world.shipId === "deltaRaptor";
    for (let i = 0; i < world.lives; i++) {
      ctx.save();
      ctx.translate(30 + i * 28, 56);
      ctx.rotate(-Math.PI / 2); // forward (+x) points up
      ctx.scale(0.5, 0.5);
      ctx.lineJoin = "round";
      ctx.strokeStyle = COLORS.hull;
      ctx.fillStyle = "#2a3340";
      ctx.lineWidth = 2.4;
      if (delta) {
        // delta-wing silhouette
        ctx.beginPath();
        ctx.moveTo(20, 0);
        ctx.lineTo(-13, -15);
        ctx.lineTo(-9, 0);
        ctx.lineTo(-13, 15);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else {
        // shoulder plates
        ctx.fillStyle = "#333b47";
        for (const s of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(4, 8 * s);
          ctx.lineTo(-2, 18 * s);
          ctx.lineTo(-12, 18 * s);
          ctx.lineTo(-11, 8 * s);
          ctx.closePath();
          ctx.fill();
        }
        ctx.fillStyle = "#2a3340";
        ctx.beginPath();
        ctx.moveTo(19, 0);
        ctx.lineTo(11, -8);
        ctx.lineTo(-11, -8);
        ctx.lineTo(-15, -5);
        ctx.lineTo(-15, 5);
        ctx.lineTo(-11, 8);
        ctx.lineTo(11, 8);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      // cockpit dot
      ctx.fillStyle = COLORS.hud;
      ctx.beginPath();
      ctx.arc(delta ? 6 : 4, 0, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  private drawLoadout(ctx: CanvasRenderingContext2D, world: World): void {
    const spec = WEAPONS[world.weapon];
    const y = 86;
    ctx.save();
    ctx.textBaseline = "top";
    ctx.font = "600 14px 'Segoe UI', system-ui, sans-serif";
    ctx.shadowBlur = 6;

    ctx.fillStyle = COLORS.hud;
    ctx.shadowColor = COLORS.hud;
    ctx.fillText(`WAFFE  ${spec.name}`, 24, y);

    let ammoLabel = AMMO[world.ammo].name;
    if (world.ammo !== "standard") ammoLabel += `  ×${world.ammoCounts[world.ammo]}`;
    const ammoColor =
      world.ammo === "explosive" ? "#ff7a2e" : world.ammo === "ap" ? "#ff4d6d" : "#9fb0c3";
    ctx.fillStyle = ammoColor;
    ctx.shadowColor = ammoColor;
    ctx.fillText(`MUN  ${ammoLabel}`, 24, y + 20);

    // rockets on hand
    let by = y + 42;
    // secondary weapon (active one marked ▸)
    if (world.rocketAmmo > 0 || world.mineAmmo > 0 || world.mines.length > 0) {
      const label =
        world.secondary === "mine"
          ? `MINEN  ×${world.mineAmmo}`
          : `RAKETEN  ×${world.rocketAmmo}`;
      ctx.fillStyle = "#ff9a4d";
      ctx.shadowColor = "#ff7a2e";
      ctx.fillText(`▸ ${label}`, 24, by);
      by += 20;
    }
    if (world.ship.shieldMax > 0) {
      const pips = "●".repeat(world.ship.shield) + "○".repeat(world.ship.shieldMax - world.ship.shield);
      const lvl = world.ship.shieldLevel > 0 ? ` L${world.ship.shieldLevel}` : "";
      ctx.fillStyle = "#57e5ff";
      ctx.shadowColor = "#57e5ff";
      ctx.fillText(`SCHILD${lvl}  ${pips}`, 24, by);
      by += 20;
    }
    if (world.ship.antigrav > 0) {
      ctx.fillStyle = "#b98cff";
      ctx.shadowColor = "#b98cff";
      ctx.fillText(`ANTIGRAV  ${Math.ceil(world.ship.antigrav)}s`, 24, by);
    }
    ctx.restore();
  }

  private drawShop(ctx: CanvasRenderingContext2D, world: World): void {
    ctx.save();
    ctx.fillStyle = "rgba(4,5,10,0.82)"; // dim the frozen world
    ctx.fillRect(0, 0, this.w, this.h);

    const labels: Record<string, string> = {
      ammo: "MUNITION",
      weapon: "WAFFEN",
      ship: "SCHIFFE",
      upgrade: "UPGRADES",
      equipment: "AUSRÜSTUNG",
    };
    const pages = visiblePages(world); // Upgrades tab only appears at a shipyard. REQ-WERFT-01
    const activeKind = pages[world.shopPage];
    const items = visibleItems(world, activeKind);
    const locked = lockedItems(world, activeKind); // greyed teasers below the buyable rows

    const panelW = Math.min(600, this.w - 80);
    const headerH = 62;
    const tabH = 46;
    const footerH = 46;
    const rowH = 86;
    const rowCount = Math.max(items.length + locked.length, 1);
    const panelH = headerH + tabH + rowCount * rowH + footerH;
    const px = (this.w - panelW) / 2;
    const py = (this.h - panelH) / 2;

    // panel
    ctx.fillStyle = "rgba(12,16,24,0.97)";
    ctx.strokeStyle = "rgba(127,231,217,0.35)";
    ctx.lineWidth = 1.5;
    this.roundRect(ctx, px, py, panelW, panelH, 14);
    ctx.fill();
    ctx.stroke();

    // title + credits
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = COLORS.hud;
    ctx.shadowColor = COLORS.hud;
    ctx.shadowBlur = 14;
    ctx.textAlign = "left";
    ctx.font = "800 24px 'Segoe UI', system-ui, sans-serif";
    ctx.fillText("◊ ORBITAL-SHOP", px + 26, py + 42);
    ctx.shadowBlur = 8;
    ctx.textAlign = "right";
    ctx.fillStyle = "#ffd166";
    ctx.shadowColor = "#ffd166";
    ctx.font = "700 21px 'Segoe UI', system-ui, sans-serif";
    ctx.fillText(`◈ ${world.credits} CR`, px + panelW - 26, py + 42);
    ctx.shadowBlur = 0;

    // tabs (Munition / Waffen / Schiffe)
    const tabY = py + headerH;
    const tabW = (panelW - 44) / pages.length;
    pages.forEach((kind, i) => {
      const tx = px + 22 + i * tabW;
      const active = i === world.shopPage;
      if (active) {
        ctx.fillStyle = "rgba(127,231,217,0.14)";
        this.roundRect(ctx, tx + 3, tabY, tabW - 6, tabH - 8, 8);
        ctx.fill();
      }
      ctx.textAlign = "center";
      ctx.fillStyle = active ? "#ffffff" : "#6f8092";
      ctx.font = `${active ? 700 : 600} 14px 'Segoe UI', system-ui, sans-serif`;
      ctx.fillText(labels[kind], tx + tabW / 2, tabY + tabH / 2 + 2);
      if (active) {
        ctx.fillStyle = COLORS.hud;
        ctx.fillRect(tx + tabW / 2 - 18, tabY + tabH - 7, 36, 3);
      }
    });

    // items on the active page
    const listTop = py + headerH + tabH + 6;
    if (items.length === 0 && locked.length === 0) {
      ctx.textAlign = "center";
      ctx.fillStyle = "#7f8ea3";
      ctx.font = "600 16px 'Segoe UI', system-ui, sans-serif";
      const msg =
        activeKind === "upgrade"
          ? world.atShipyard
            ? "Titan-Schiff erforderlich"
            : "Nur in der Orbital-Werft"
          : "— leer —";
      ctx.fillText(msg, this.w / 2, listTop + rowH / 2);
      ctx.textAlign = "left";
    }
    items.forEach((item, i) => {
      const y = listTop + i * rowH;
      const selected = i === world.shopIndex;
      const equipped = isEquipped(world, item);
      const switchable = !equipped && isOwned(world, item); // owned but not active
      const affordable = world.credits >= item.price;

      if (selected) {
        ctx.fillStyle = "rgba(127,231,217,0.12)";
        this.roundRect(ctx, px + 14, y + 8, panelW - 28, rowH - 14, 10);
        ctx.fill();
        ctx.fillStyle = COLORS.hud;
        ctx.fillRect(px + 14, y + 14, 4, rowH - 26);
      }

      // item icon in a rounded tile
      const iconSize = 54;
      const iconX = px + 28;
      const iconY = y + (rowH - iconSize) / 2;
      ctx.fillStyle = "rgba(255,255,255,0.05)";
      this.roundRect(ctx, iconX, iconY, iconSize, iconSize, 10);
      ctx.fill();
      this.drawShopIcon(ctx, item, iconX, iconY, iconSize);

      // name + description
      const textX = iconX + iconSize + 18;
      ctx.textAlign = "left";
      ctx.fillStyle = selected ? "#ffffff" : "#cfd8e4";
      ctx.font = "700 19px 'Segoe UI', system-ui, sans-serif";
      ctx.fillText(item.name, textX, y + rowH / 2 - 4);
      ctx.font = "500 13px 'Segoe UI', system-ui, sans-serif";
      ctx.fillStyle = "#7f8ea3";
      ctx.fillText(item.desc, textX, y + rowH / 2 + 18);

      // right side: owned / max / price (+ stock/status)
      ctx.textAlign = "right";
      const atMax = item.id === "extra-life" && world.lives >= GAME.maxLives;
      if (equipped) {
        ctx.fillStyle = COLORS.hud;
        ctx.font = "700 16px 'Segoe UI', system-ui, sans-serif";
        ctx.fillText("✓ AUSGERÜSTET", px + panelW - 30, y + rowH / 2 + 2);
      } else if (switchable) {
        // owned but not active — Enter switches to it for free
        ctx.fillStyle = "#ffd166";
        ctx.font = "700 16px 'Segoe UI', system-ui, sans-serif";
        ctx.fillText("► WECHSELN", px + panelW - 30, y + rowH / 2 + 2);
      } else if (atMax) {
        ctx.fillStyle = "#7f8ea3";
        ctx.font = "700 16px 'Segoe UI', system-ui, sans-serif";
        ctx.fillText("MAX", px + panelW - 30, y + rowH / 2 + 2);
      } else {
        ctx.fillStyle = affordable ? "#ffd166" : "#ff5a5a";
        ctx.font = "700 18px 'Segoe UI', system-ui, sans-serif";
        ctx.fillText(`${item.price} CR`, px + panelW - 30, y + rowH / 2 - 4);
        ctx.fillStyle = "#7f8ea3";
        ctx.font = "500 12px 'Segoe UI', system-ui, sans-serif";
        if (item.kind === "ammo") {
          const stock =
            item.ref === "rocket"
              ? world.rocketAmmo
              : item.ref === "mine"
                ? world.mineAmmo
                : world.ammoCounts[item.ref as "ap" | "explosive"];
          ctx.fillText(`Bestand: ${stock}`, px + panelW - 30, y + rowH / 2 + 16);
        } else if (item.id === "extra-life") {
          ctx.fillText(`Leben: ${world.lives}/${GAME.maxLives}`, px + panelW - 30, y + rowH / 2 + 16);
        } else if (item.ref === "shield") {
          ctx.fillText(
            `Level: ${world.ship.shieldLevel}/${SHIELD.maxLevel}`,
            px + panelW - 30,
            y + rowH / 2 + 16,
          );
        } else if (item.ref === "hangar") {
          ctx.fillText(
            `Level: ${world.hangarLevel}/${WINGMAN.maxLevel}`,
            px + panelW - 30,
            y + rowH / 2 + 16,
          );
        }
      }
    });

    // locked teasers: greyed rows with "ab Welle N" instead of a price (not selectable). REQ-SHOP-05
    locked.forEach((item, li) => {
      const y = listTop + (items.length + li) * rowH;
      ctx.globalAlpha = 0.4;

      const iconSize = 54;
      const iconX = px + 28;
      const iconY = y + (rowH - iconSize) / 2;
      ctx.fillStyle = "rgba(255,255,255,0.04)";
      this.roundRect(ctx, iconX, iconY, iconSize, iconSize, 10);
      ctx.fill();
      this.drawShopIcon(ctx, item, iconX, iconY, iconSize);

      const textX = iconX + iconSize + 18;
      ctx.textAlign = "left";
      ctx.fillStyle = "#8a97a8";
      ctx.font = "700 19px 'Segoe UI', system-ui, sans-serif";
      ctx.fillText(item.name, textX, y + rowH / 2 - 4);
      ctx.font = "500 13px 'Segoe UI', system-ui, sans-serif";
      ctx.fillStyle = "#5c6a7a";
      ctx.fillText(item.desc, textX, y + rowH / 2 + 18);

      ctx.textAlign = "right";
      ctx.fillStyle = "#7f8ea3";
      ctx.font = "700 15px 'Segoe UI', system-ui, sans-serif";
      ctx.fillText(`🔒 ab Welle ${item.unlockWave}`, px + panelW - 30, y + rowH / 2 + 2);
      ctx.globalAlpha = 1;
    });

    // controls hint
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(207,216,228,0.6)";
    ctx.font = "600 14px 'Segoe UI', system-ui, sans-serif";
    ctx.fillText(
      "A D / ← →  Kategorie     W S / ↑ ↓  Auswahl     ENTER  Kaufen/Wechseln     ESC  Abheben",
      this.w / 2,
      py + panelH - 20,
    );
    ctx.textAlign = "left";
    ctx.restore();
  }

  /** Small glyph for a shop item, drawn inside the box at (x,y) of the given size. */
  private drawShopIcon(
    ctx: CanvasRenderingContext2D,
    item: ShopItem,
    x: number,
    y: number,
    size: number,
  ): void {
    const cx = x + size / 2;
    const cy = y + size / 2;
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    if (item.id === "vulkan") {
      // fanning spread of bolts
      ctx.strokeStyle = COLORS.bullet;
      ctx.shadowColor = COLORS.bullet;
      ctx.shadowBlur = 6;
      ctx.lineWidth = 3;
      for (const a of [-0.42, 0, 0.42]) {
        ctx.beginPath();
        ctx.moveTo(cx - 12, cy);
        ctx.lineTo(cx - 12 + 22 * Math.cos(a), cy + 22 * Math.sin(a));
        ctx.stroke();
      }
    } else if (item.id === "ballista") {
      // one long precise bolt with an arrowhead
      ctx.strokeStyle = COLORS.bullet;
      ctx.fillStyle = COLORS.bullet;
      ctx.shadowColor = COLORS.bullet;
      ctx.shadowBlur = 6;
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(cx - 16, cy);
      ctx.lineTo(cx + 10, cy);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx + 17, cy);
      ctx.lineTo(cx + 8, cy - 6);
      ctx.lineTo(cx + 8, cy + 6);
      ctx.closePath();
      ctx.fill();
    } else if (item.id === "ammo-ap") {
      // armor-piercing shell silhouette
      ctx.fillStyle = "#ff4d6d";
      ctx.shadowColor = "#ff4d6d";
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.moveTo(cx + 15, cy);
      ctx.lineTo(cx + 3, cy - 8);
      ctx.lineTo(cx - 14, cy - 8);
      ctx.lineTo(cx - 14, cy + 8);
      ctx.lineTo(cx + 3, cy + 8);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "#ffd0da";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx - 2, cy - 8);
      ctx.lineTo(cx + 8, cy);
      ctx.lineTo(cx - 2, cy + 8);
      ctx.stroke();
    } else if (item.id === "ammo-explosive") {
      // radiating burst
      ctx.strokeStyle = "#ff7a2e";
      ctx.shadowColor = "#ff7a2e";
      ctx.shadowBlur = 8;
      ctx.lineWidth = 3;
      for (let k = 0; k < 8; k++) {
        const a = (k * Math.PI) / 4;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * 6, cy + Math.sin(a) * 6);
        ctx.lineTo(cx + Math.cos(a) * 16, cy + Math.sin(a) * 16);
        ctx.stroke();
      }
      ctx.fillStyle = "#ffd79a";
      ctx.beginPath();
      ctx.arc(cx, cy, 4.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (item.id === "ammo-rocket") {
      // homing missile: pointed body, tail fins, exhaust flame
      ctx.translate(cx, cy);
      ctx.rotate(-Math.PI / 4); // point up-right for a dynamic look
      ctx.fillStyle = "#d7e0ea";
      ctx.strokeStyle = "#9fb0c4";
      ctx.shadowColor = "#ff9a3c";
      ctx.shadowBlur = 6;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(15, 0); // nose
      ctx.lineTo(4, -5);
      ctx.lineTo(-10, -5);
      ctx.lineTo(-10, 5);
      ctx.lineTo(4, 5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // tail fins
      ctx.fillStyle = "#ff7a3c";
      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.moveTo(-10, -4);
      ctx.lineTo(-15, -9);
      ctx.lineTo(-9, -1);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-10, 4);
      ctx.lineTo(-15, 9);
      ctx.lineTo(-9, 1);
      ctx.closePath();
      ctx.fill();
      // exhaust flame
      ctx.fillStyle = "#ffd166";
      ctx.shadowColor = "#ffd166";
      ctx.shadowBlur = 9;
      ctx.beginPath();
      ctx.moveTo(-10, -2.6);
      ctx.lineTo(-20, 0);
      ctx.lineTo(-10, 2.6);
      ctx.closePath();
      ctx.fill();
    } else if (item.id === "ammo-mine") {
      // spiked mine sphere with a red trigger light
      ctx.strokeStyle = "#9fb0c4";
      ctx.shadowColor = "#ff5a5a";
      ctx.shadowBlur = 5;
      ctx.lineWidth = 2.5;
      for (let k = 0; k < 8; k++) {
        const a = (k * Math.PI) / 4;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * 7, cy + Math.sin(a) * 7);
        ctx.lineTo(cx + Math.cos(a) * 14, cy + Math.sin(a) * 14);
        ctx.stroke();
      }
      ctx.fillStyle = "#2b3440";
      ctx.strokeStyle = "#8794a6";
      ctx.lineWidth = 2;
      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.arc(cx, cy, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#ff5a5a";
      ctx.shadowColor = "#ff4040";
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(cx, cy, 2.6, 0, Math.PI * 2);
      ctx.fill();
    } else if (item.id === "ship-deltaRaptor") {
      // mini delta-wing silhouette pointing up
      ctx.translate(cx, cy);
      ctx.rotate(-Math.PI / 2);
      ctx.fillStyle = "#243244";
      ctx.strokeStyle = COLORS.hud;
      ctx.shadowColor = COLORS.hud;
      ctx.shadowBlur = 6;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(16, 0);
      ctx.lineTo(-11, -13);
      ctx.lineTo(-7, 0);
      ctx.lineTo(-11, 13);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = COLORS.hud;
      ctx.beginPath();
      ctx.arc(5, 0, 2, 0, Math.PI * 2);
      ctx.fill();
    } else if (item.id === "ship-titan") {
      // chunky battleship silhouette with turret dots, pointing up
      ctx.translate(cx, cy);
      ctx.rotate(-Math.PI / 2);
      ctx.fillStyle = "#243244";
      ctx.strokeStyle = COLORS.hud;
      ctx.shadowColor = COLORS.hud;
      ctx.shadowBlur = 6;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(15, 0);
      ctx.lineTo(9, -9);
      ctx.lineTo(-11, -11);
      ctx.lineTo(-14, -5);
      ctx.lineTo(-14, 5);
      ctx.lineTo(-11, 11);
      ctx.lineTo(9, 9);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // turret dots
      ctx.shadowBlur = 0;
      ctx.fillStyle = COLORS.hud;
      for (const p of [[6, 0], [-7, -6], [-7, 6]]) {
        ctx.beginPath();
        ctx.arc(p[0], p[1], 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (item.id === "upgrade-deflector") {
      // deflector pulse: a small emitter with concentric shockwave rings
      ctx.strokeStyle = "#57e5ff";
      ctx.shadowColor = "#57e5ff";
      ctx.shadowBlur = 8;
      ctx.lineWidth = 2;
      for (const rr of [6, 11, 16]) {
        ctx.beginPath();
        ctx.arc(cx, cy, rr, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#eaffff";
      ctx.beginPath();
      ctx.arc(cx, cy, 2.4, 0, Math.PI * 2);
      ctx.fill();
    } else if (item.id === "upgrade-engines") {
      // twin exhaust nozzles with a blue flame
      ctx.fillStyle = "#3a4552";
      ctx.strokeStyle = "#9fb0c4";
      ctx.lineWidth = 1.5;
      for (const ey of [-6, 6]) {
        ctx.beginPath();
        ctx.rect(cx - 2, cy + ey - 4, 8, 8);
        ctx.fill();
        ctx.stroke();
      }
      ctx.globalCompositeOperation = "lighter";
      ctx.shadowColor = "#6cc4ff";
      ctx.shadowBlur = 9;
      for (const ey of [-6, 6]) {
        const fg = ctx.createLinearGradient(cx - 2, cy + ey, cx - 16, cy + ey);
        fg.addColorStop(0, "rgba(150,215,255,0.95)");
        fg.addColorStop(1, "rgba(0,120,255,0)");
        ctx.fillStyle = fg;
        ctx.beginPath();
        ctx.moveTo(cx - 2, cy + ey - 3.2);
        ctx.lineTo(cx - 16, cy + ey);
        ctx.lineTo(cx - 2, cy + ey + 3.2);
        ctx.closePath();
        ctx.fill();
      }
    } else if (item.id === "upgrade-autocannon") {
      // turret base with a barrel and a small target reticle
      ctx.fillStyle = "#2b3440";
      ctx.strokeStyle = "#d7a24a";
      ctx.shadowColor = "#ffb14d";
      ctx.shadowBlur = 6;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx - 4, cy + 4, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx - 4, cy + 4);
      ctx.lineTo(cx + 12, cy - 12);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = "#ff5a5a";
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(cx + 13, cy - 13, 4, 0, Math.PI * 2);
      ctx.moveTo(cx + 13 - 6, cy - 13);
      ctx.lineTo(cx + 13 + 6, cy - 13);
      ctx.moveTo(cx + 13, cy - 13 - 6);
      ctx.lineTo(cx + 13, cy - 13 + 6);
      ctx.stroke();
    } else if (item.id === "upgrade-tractor") {
      // emitter with a widening tractor cone drawing a chunk in
      ctx.fillStyle = "#b98cff";
      ctx.shadowColor = "#b98cff";
      ctx.shadowBlur = 7;
      ctx.beginPath();
      ctx.arc(cx - 13, cy, 3, 0, Math.PI * 2); // emitter
      ctx.fill();
      ctx.globalCompositeOperation = "lighter";
      const cone = ctx.createLinearGradient(cx - 13, cy, cx + 12, cy);
      cone.addColorStop(0, "rgba(205,175,255,0.7)");
      cone.addColorStop(1, "rgba(185,140,255,0.05)");
      ctx.fillStyle = cone;
      ctx.beginPath();
      ctx.moveTo(cx - 11, cy - 1.5);
      ctx.lineTo(cx + 12, cy - 9);
      ctx.lineTo(cx + 12, cy + 9);
      ctx.lineTo(cx - 11, cy + 1.5);
      ctx.closePath();
      ctx.fill();
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = "#8a97a8"; // the chunk being pulled
      ctx.beginPath();
      ctx.arc(cx + 9, cy, 3.4, 0, Math.PI * 2);
      ctx.fill();
    } else if (item.id === "upgrade-hangar") {
      // carrier bay with two small drone deltas flying out
      ctx.fillStyle = "#243244";
      ctx.strokeStyle = "#7fe7d9";
      ctx.shadowColor = "#7fe7d9";
      ctx.shadowBlur = 6;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.rect(cx - 12, cy - 6, 9, 12); // bay
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = COLORS.hud;
      for (const dy of [-5, 5]) {
        ctx.beginPath();
        ctx.moveTo(cx + 13, cy + dy);
        ctx.lineTo(cx + 3, cy + dy - 4);
        ctx.lineTo(cx + 6, cy + dy);
        ctx.lineTo(cx + 3, cy + dy + 4);
        ctx.closePath();
        ctx.fill();
      }
    } else if (item.id === "extra-life") {
      // heart
      ctx.fillStyle = "#ff5a7a";
      ctx.shadowColor = "#ff5a7a";
      ctx.shadowBlur = 7;
      ctx.beginPath();
      ctx.arc(cx - 3.4, cy - 2, 3.4, 0, Math.PI * 2);
      ctx.arc(cx + 3.4, cy - 2, 3.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(cx - 6.6, cy - 0.6);
      ctx.lineTo(cx + 6.6, cy - 0.6);
      ctx.lineTo(cx, cy + 8);
      ctx.closePath();
      ctx.fill();
    } else if (item.id === "equip-shield") {
      // filled shield crest
      ctx.strokeStyle = "#57e5ff";
      ctx.fillStyle = "rgba(87,229,255,0.25)";
      ctx.shadowColor = "#57e5ff";
      ctx.shadowBlur = 7;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy - 9);
      ctx.lineTo(cx + 8, cy - 4);
      ctx.lineTo(cx + 8, cy + 3);
      ctx.lineTo(cx, cy + 10);
      ctx.lineTo(cx - 8, cy + 3);
      ctx.lineTo(cx - 8, cy - 4);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (item.id === "equip-antigrav") {
      // purple orbit swirl
      ctx.fillStyle = "#b98cff";
      ctx.shadowColor = "#b98cff";
      ctx.shadowBlur = 7;
      ctx.beginPath();
      ctx.arc(cx, cy, 3, 0, Math.PI * 2);
      ctx.fill();
      for (const a of [0, 2.09, 4.18]) {
        ctx.beginPath();
        ctx.arc(cx + Math.cos(a) * 9, cy + Math.sin(a) * 9, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  private roundRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
  ): void {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  private drawBossBar(ctx: CanvasRenderingContext2D, ratio: number): void {
    const w = Math.min(420, this.w - 120);
    const x = (this.w - w) / 2;
    const y = 26;
    ctx.save();
    ctx.textAlign = "center";
    ctx.fillStyle = "#ff5a5a";
    ctx.shadowColor = "#ff4040";
    ctx.shadowBlur = 10;
    ctx.font = "800 15px 'Segoe UI', system-ui, sans-serif";
    ctx.fillText("◆ BOSS-ASTEROID ◆", this.w / 2, y - 6);
    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(x, y, w, 8);
    ctx.fillStyle = "#ff5a5a";
    ctx.shadowColor = "#ff4040";
    ctx.shadowBlur = 8;
    ctx.fillRect(x, y, w * Math.max(0, ratio), 8);
    ctx.strokeStyle = "rgba(255,120,110,0.5)";
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, w, 8);
    ctx.textAlign = "left";
    ctx.restore();
  }

  private drawWaveBanner(ctx: CanvasRenderingContext2D, world: World): void {
    const alpha = Math.min(1, world.waveBanner); // fade out over the last second
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = COLORS.hud;
    ctx.shadowColor = COLORS.hud;
    ctx.shadowBlur = 20;
    ctx.font = "800 46px 'Segoe UI', system-ui, sans-serif";
    ctx.fillText(`WELLE ${world.wave}`, this.w / 2, this.h * 0.28);
    ctx.restore();
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
  }

  /** Reward crate on the field: a glowing gift box. REQ-REWARD-01. */
  private drawCrate(ctx: CanvasRenderingContext2D, c: Crate): void {
    const s = c.radius;
    ctx.save();
    ctx.translate(c.position.x, c.position.y);
    const pulse = 0.5 + 0.5 * Math.sin(this.t * 4);
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = `rgba(255,209,102,${0.14 + pulse * 0.16})`;
    ctx.beginPath();
    ctx.arc(0, 0, s * 1.9, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";
    ctx.rotate(Math.sin(c.spin * 0.8) * 0.15);
    ctx.fillStyle = "#caa23a";
    ctx.strokeStyle = "#ffe6a0";
    ctx.lineWidth = 2;
    ctx.shadowColor = "#ffd166";
    ctx.shadowBlur = 12;
    this.roundRect(ctx, -s, -s, s * 2, s * 2, 4);
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "#fff2c8";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(0, -s);
    ctx.lineTo(0, s);
    ctx.moveTo(-s, 0);
    ctx.lineTo(s, 0);
    ctx.stroke();
    ctx.restore();
  }

  /** "Pick 1 of 3" reward chooser overlay (world paused). REQ-REWARD-01. */
  private drawReward(ctx: CanvasRenderingContext2D, world: World): void {
    ctx.save();
    ctx.fillStyle = "rgba(4,5,10,0.82)";
    ctx.fillRect(0, 0, this.w, this.h);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#ffd166";
    ctx.shadowColor = "#ffd166";
    ctx.shadowBlur = 14;
    ctx.font = "800 30px 'Segoe UI', system-ui, sans-serif";
    ctx.fillText("◈ BELOHNUNG WÄHLEN", this.w / 2, this.h / 2 - 150);
    ctx.shadowBlur = 0;

    const opts = world.rewardChoices;
    const n = Math.max(opts.length, 1);
    const cardW = Math.min(220, (this.w - 80) / n - 24);
    const cardH = 150;
    const gap = 24;
    const totalW = n * cardW + (n - 1) * gap;
    const startX = this.w / 2 - totalW / 2;
    const cy = this.h / 2;
    opts.forEach((o, i) => {
      const x = startX + i * (cardW + gap);
      const sel = i === world.rewardIndex;
      ctx.fillStyle = sel ? "rgba(255,209,102,0.14)" : "rgba(12,16,24,0.95)";
      ctx.strokeStyle = sel ? "#ffd166" : "rgba(127,231,217,0.3)";
      ctx.lineWidth = sel ? 2.5 : 1.5;
      this.roundRect(ctx, x, cy - cardH / 2, cardW, cardH, 12);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "rgba(127,231,217,0.7)";
      ctx.font = "700 14px 'Segoe UI', system-ui, sans-serif";
      ctx.fillText(`[${i + 1}]`, x + cardW / 2, cy - cardH / 2 + 24);
      ctx.fillStyle = sel ? "#ffffff" : "#cfd8e4";
      ctx.font = "700 20px 'Segoe UI', system-ui, sans-serif";
      ctx.fillText(o.label, x + cardW / 2, cy - 6);
      ctx.fillStyle = "#7f8ea3";
      ctx.font = "500 13px 'Segoe UI', system-ui, sans-serif";
      ctx.fillText(o.desc, x + cardW / 2, cy + 22);
    });

    ctx.fillStyle = "rgba(207,216,228,0.65)";
    ctx.font = "600 14px 'Segoe UI', system-ui, sans-serif";
    ctx.fillText("← →  Wählen     1–3  Direkt     ENTER  Bestätigen", this.w / 2, cy + cardH / 2 + 40);
    ctx.restore();
  }

  private drawGameOver(ctx: CanvasRenderingContext2D, world: World): void {
    ctx.save();
    ctx.fillStyle = "rgba(4,5,10,0.66)";
    ctx.fillRect(0, 0, this.w, this.h);

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    ctx.fillStyle = COLORS.danger;
    ctx.shadowColor = COLORS.danger;
    ctx.shadowBlur = 24;
    ctx.font = "800 72px 'Segoe UI', system-ui, sans-serif";
    ctx.fillText("GAME OVER", this.w / 2, this.h / 2 - 30);

    ctx.shadowBlur = 8;
    ctx.fillStyle = COLORS.hud;
    ctx.font = "600 24px 'Segoe UI', system-ui, sans-serif";
    ctx.fillText(`FINAL SCORE  ${world.score}`, this.w / 2, this.h / 2 + 34);

    ctx.fillStyle = "rgba(230,238,247,0.7)";
    ctx.font = "500 18px 'Segoe UI', system-ui, sans-serif";
    ctx.fillText("Press  ENTER  to relaunch", this.w / 2, this.h / 2 + 78);
    ctx.restore();
  }
}

/** Ship nose position helper (used by the render/thrust glue). */
export function shipNose(pos: Vec, angle: number, radius: number): Vec {
  return add(pos, fromAngle(angle, radius));
}

export { vec };
