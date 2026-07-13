/** Entry point: canvas bootstrap + fixed-timestep game loop. */
import {
  createWorld,
  updateWorld,
  equipWeapon,
  equipAmmo,
  cycleWeapon,
  cycleAmmo,
  cycleSecondary,
  closeShop,
  World,
} from "./game/world.ts";
import { createKeyboardInput } from "./input/keyboard.ts";
import { Renderer } from "./render/renderer.ts";
import { Particles } from "./render/particles.ts";
import { fromAngle, add } from "./engine/vector2.ts";
import { AMMO } from "./game/constants.ts";
import { visiblePages, visibleItems, purchase } from "./game/shop.ts";

const canvas = document.getElementById("game") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;

let width = 0;
let height = 0;
let renderer: Renderer;
let world: World;
const particles = new Particles();
const input = createKeyboardInput();

const LOOT_HUE: Record<string, number> = { shield: 190, antigrav: 275, ammo: 45, rocket: 22, mine: 0 };

function attachHooks(w: World): void {
  w.onExplosion = (pos, big) => particles.emitExplosion(pos, big);
  w.onHit = (pos) => particles.emitSpark(pos);
  w.onPickup = (pos, kind) => particles.emitPickup(pos, LOOT_HUE[kind] ?? 190);
  w.onShieldHit = (pos) => particles.emitPickup(pos, 190); // cyan shield spark
}

function newGame(): void {
  world = createWorld({ width, height, seed: (Math.random() * 1e9) | 0 });
  attachHooks(world);
  (window as unknown as { game: unknown }).game = {
    get world() {
      return world;
    },
  };
}

function resize(): void {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  width = window.innerWidth;
  height = window.innerHeight;
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  canvas.style.width = width + "px";
  canvas.style.height = height + "px";
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (!renderer) renderer = new Renderer(ctx, width, height);
  else renderer.resize(width, height);
  if (world) {
    world.width = width;
    world.height = height;
  }
}

window.addEventListener("resize", resize);
window.addEventListener("keydown", (e) => {
  // Shop menu navigation (world is paused). Arrows or WASD.
  if (world.state === "shop") {
    const pages = visiblePages(world);
    const pageItems = visibleItems(world, pages[world.shopPage]);
    if (e.code === "ArrowLeft" || e.code === "KeyA") {
      world.shopPage = (world.shopPage - 1 + pages.length) % pages.length;
      world.shopIndex = 0;
    } else if (e.code === "ArrowRight" || e.code === "KeyD") {
      world.shopPage = (world.shopPage + 1) % pages.length;
      world.shopIndex = 0;
    } else if (e.code === "ArrowUp" || e.code === "KeyW") {
      if (pageItems.length) world.shopIndex = (world.shopIndex - 1 + pageItems.length) % pageItems.length;
    } else if (e.code === "ArrowDown" || e.code === "KeyS") {
      if (pageItems.length) world.shopIndex = (world.shopIndex + 1) % pageItems.length;
    } else if (e.code === "Enter") {
      const item = pageItems[world.shopIndex];
      if (item) purchase(world, item);
    } else if (e.code === "Escape") {
      closeShop(world);
    }
    e.preventDefault();
    return;
  }

  if (e.code === "Enter" && world.state === "gameover") {
    newGame();
    return;
  }
  // Pause / resume with P
  if (e.code === "KeyP" && (world.state === "playing" || world.state === "paused")) {
    world.state = world.state === "playing" ? "paused" : "playing";
    return;
  }
  if (world.state !== "playing") return;
  // weapon select
  if (e.code === "Digit1") equipWeapon(world, "laser");
  else if (e.code === "Digit2") equipWeapon(world, "vulkan");
  else if (e.code === "Digit3") equipWeapon(world, "ballista");
  // ammo select
  else if (e.code === "Digit4") equipAmmo(world, "standard");
  else if (e.code === "Digit5") equipAmmo(world, "ap");
  else if (e.code === "Digit6") equipAmmo(world, "explosive");
  // cycle through owned weapons (E) / ammo types (Q) / secondary weapon (X)
  else if (e.code === "KeyE") cycleWeapon(world);
  else if (e.code === "KeyQ") cycleAmmo(world);
  else if (e.code === "KeyX") cycleSecondary(world);
  // DEV: temporary unlock until the shop exists (remove before release)
  else if (e.code === "Digit9") {
    if (!world.ownedWeapons.includes("vulkan")) world.ownedWeapons.push("vulkan");
    if (!world.ownedWeapons.includes("ballista")) world.ownedWeapons.push("ballista");
    if (!world.ownedShips.includes("deltaRaptor")) world.ownedShips.push("deltaRaptor");
    if (!world.ownedShips.includes("titan")) world.ownedShips.push("titan");
    world.ammoCounts.ap += AMMO.ap.packSize;
    world.ammoCounts.explosive += AMMO.explosive.packSize;
    world.rocketAmmo += 10;
    world.mineAmmo += 12;
    world.credits += 5000;
  }
});

resize();
newGame();

// Fixed timestep loop for deterministic physics.
const STEP = 1 / 120;
let last = performance.now();
let acc = 0;

function frame(now: number): void {
  let dt = (now - last) / 1000;
  last = now;
  if (dt > 0.25) dt = 0.25; // clamp after tab switches
  acc += dt;

  while (acc >= STEP) {
    updateWorld(world, input.state, STEP);
    if (world.state === "playing" && world.ship.thrusting) {
      const tail = add(world.ship.position, fromAngle(world.ship.angle, -world.ship.radius));
      particles.emitThrust(tail, world.ship.angle + Math.PI);
    }
    acc -= STEP;
  }

  // rocket exhaust trails (render-side, smooth per frame)
  if (world.state === "playing") {
    for (const r of world.rockets) {
      const ang = Math.atan2(r.velocity.y, r.velocity.x);
      particles.emitThrust(r.position, ang + Math.PI);
    }
  }

  particles.update(dt);
  renderer.render(world, particles, dt);
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
