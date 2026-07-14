/** Shop catalog and purchasing. REQ-SHOP-01, REQ-SHIP-03, REQ-SHOP-04. */
import type { World } from "./world.ts";
import { equipShip, equipWeapon, installShipUpgrade } from "./world.ts";
import { grantShield } from "./ship.ts";
import {
  WEAPONS,
  AMMO,
  SHIPS,
  EQUIPMENT,
  GAME,
  LOOT,
  SHIELD,
  ROCKET,
  MINE,
  SHOP,
  UPGRADES,
  UPGRADE_ORDER,
  WINGMAN,
  WeaponId,
  AmmoId,
  ShipId,
  UpgradeId,
} from "./constants.ts";

export type ShopItemKind = "weapon" | "ammo" | "ship" | "upgrade" | "equipment";
export type EquipmentRef = "life" | "shield" | "antigrav";

export interface ShopItem {
  id: string;
  kind: ShopItemKind;
  name: string;
  price: number;
  ref: WeaponId | AmmoId | ShipId | UpgradeId | EquipmentRef | "rocket" | "mine"; // what the purchase grants
  desc: string;
  random?: boolean; // stocked only randomly (see world.shopStock)
  unlockWave?: number; // shop reveals this item only from this wave on (default 1). REQ-SHOP-05
  shipyardOnly?: boolean; // sold only at shipyard planets (Titan). REQ-WERFT-01
}

export const SHOP_ITEMS: ShopItem[] = [
  {
    id: "vulkan",
    kind: "weapon",
    name: WEAPONS.vulkan.name,
    price: WEAPONS.vulkan.price,
    ref: "vulkan",
    desc: "Kurze Reichweite · Streuschuss · sehr schnell",
  },
  {
    id: "ballista",
    kind: "weapon",
    name: WEAPONS.ballista.name,
    price: WEAPONS.ballista.price,
    ref: "ballista",
    desc: "Große Reichweite · präzise · hoher Schaden",
    unlockWave: 2,
  },
  {
    id: "ammo-ap",
    kind: "ammo",
    name: `${AMMO.ap.name} ×${AMMO.ap.packSize}`,
    price: AMMO.ap.price,
    ref: "ap",
    desc: "Doppelter Schaden pro Schuss",
  },
  {
    id: "ammo-explosive",
    kind: "ammo",
    name: `${AMMO.explosive.name} ×${AMMO.explosive.packSize}`,
    price: AMMO.explosive.price,
    ref: "explosive",
    desc: "Dreifacher Trefferradius",
    unlockWave: 2,
  },
  {
    id: "ammo-rocket",
    kind: "ammo",
    name: `Raketen ×${ROCKET.packSize}`,
    price: ROCKET.price,
    ref: "rocket",
    desc: "Zielsuchend · S / ↓ abfeuern",
    unlockWave: 3,
  },
  {
    id: "ammo-mine",
    kind: "ammo",
    name: `Weltraum-Minen ×${MINE.packSize}`,
    price: MINE.price,
    ref: "mine",
    desc: "Minenfeld hinterm Schiff · X wechseln",
    unlockWave: 4,
  },
  {
    id: "ship-deltaRaptor",
    kind: "ship",
    name: SHIPS.deltaRaptor.name,
    price: SHIPS.deltaRaptor.price,
    ref: "deltaRaptor",
    desc: "Wendiger Interceptor · schneller & agiler",
    unlockWave: 3,
  },
  {
    id: "ship-seeder",
    kind: "ship",
    name: SHIPS.seeder.name,
    price: SHIPS.seeder.price,
    ref: "seeder",
    desc: "Minenleger · legt Minen (S / ↓) · wendiger Katamaran",
    unlockWave: 4,
  },
  {
    id: "ship-titan",
    kind: "ship",
    name: SHIPS.titan.name,
    price: SHIPS.titan.price,
    ref: "titan",
    desc: "Schlachtschiff · sehr träge · 2 Türme zur Maus · aufrüstbar",
    shipyardOnly: true, // only buyable in a planet's orbital shipyard. REQ-WERFT-01
  },
  {
    id: "extra-life",
    kind: "equipment",
    name: "Extra-Leben",
    price: EQUIPMENT.extraLife.price,
    ref: "life",
    desc: "+1 Leben",
  },
  {
    id: "equip-shield",
    kind: "equipment",
    name: "Schild",
    price: EQUIPMENT.shield.price,
    ref: "shield",
    desc: `Trefferschild · je Level schnellere Regeneration (max ${SHIELD.maxLevel})`,
    unlockWave: 3, // strong defensive item — held back until wave 3. REQ-SHOP-05
  },
  {
    id: "equip-antigrav",
    kind: "equipment",
    name: "Antigrav-Generator",
    price: EQUIPMENT.antigrav.price,
    ref: "antigrav",
    desc: "Lenkt nahe Asteroiden ab",
    random: SHOP.randomEquipment.includes("equip-antigrav"),
  },
  // Titan upgrades (only visible once the Titan is owned). REQ-SHIP-05.
  ...UPGRADE_ORDER.map(
    (id): ShopItem => ({
      id: `upgrade-${id}`,
      kind: "upgrade",
      name: UPGRADES[id].name,
      price: UPGRADES[id].price,
      ref: id,
      desc: UPGRADES[id].desc,
    }),
  ),
];

/** Shop pages in display order: Munition, Waffen, Schiffe, Upgrades, Ausrüstung. REQ-SHOP-02/04/05. */
export const SHOP_PAGES: ShopItemKind[] = ["ammo", "weapon", "ship", "upgrade", "equipment"];

/** Pages actually shown this visit: the Upgrades tab only exists at a shipyard planet. REQ-WERFT-01. */
export function visiblePages(world: World): ShopItemKind[] {
  return SHOP_PAGES.filter((k) => k !== "upgrade" || world.atShipyard);
}

/** Items belonging to a given page/category, in catalog order. */
export function itemsForPage(kind: ShopItemKind): ShopItem[] {
  return SHOP_ITEMS.filter((i) => i.kind === kind);
}

/** Items on a page that are actually available this visit. REQ-SHOP-04, REQ-SHIP-05. */
export function visibleItems(world: World, kind: ShopItemKind): ShopItem[] {
  return itemsForPage(kind).filter((i) => {
    if ((i.unlockWave ?? 1) > world.wave) return false; // not yet unlocked this wave. REQ-SHOP-05
    if (i.random && !world.shopStock.includes(i.id)) return false; // random equipment out of stock
    if (i.shipyardOnly && !world.atShipyard) return false; // Titan sold only at shipyards. REQ-WERFT-01
    // Titan upgrades need the Titan AND an orbital shipyard to fit them. REQ-WERFT-01
    if (i.kind === "upgrade" && (!world.atShipyard || !world.ownedShips.includes("titan"))) return false;
    return true;
  });
}

/**
 * The single next unlock on a page, shown greyed as a "coming soon" teaser. REQ-SHOP-05.
 * Only the item(s) unlocking on the nearest future wave are returned, so the shop isn't
 * cluttered with everything that is still far off.
 */
export function lockedItems(world: World, kind: ShopItemKind): ShopItem[] {
  const locked = itemsForPage(kind).filter((i) => {
    if ((i.unlockWave ?? 1) <= world.wave) return false; // already unlocked
    if (i.kind === "upgrade") return false; // upgrades are Titan-/shipyard-gated, not wave-gated
    if (i.random && !world.shopStock.includes(i.id)) return false; // don't tease out-of-stock random gear
    return true;
  });
  if (locked.length === 0) return [];
  const nextWave = Math.min(...locked.map((i) => i.unlockWave ?? 1));
  return locked.filter((i) => (i.unlockWave ?? 1) === nextWave); // just the next unlock
}

export type PurchaseResult = "ok" | "equipped" | "insufficient" | "owned" | "max";

/**
 * Whether the player already owns this item. Weapons and ships are permanent unlocks;
 * the shield is a fitted, self-recharging subsystem, so once installed it counts as owned
 * (shown as equipped, not re-buyable). Ammo, extra lives and antigrav stay repeatable.
 */
export function isOwned(world: World, item: ShopItem): boolean {
  if (item.kind === "weapon") return world.ownedWeapons.includes(item.ref as WeaponId);
  if (item.kind === "ship") return world.ownedShips.includes(item.ref as ShipId);
  if (item.kind === "upgrade") {
    // the hangar levels up (1..3 drones) — "owned" only once maxed. REQ-SHIP-05
    if (item.ref === "hangar") return world.hangarLevel >= WINGMAN.maxLevel;
    return world.shipUpgrades.includes(item.ref as UpgradeId);
  }
  // The shield is a levelling subsystem: "owned" (no longer buyable) only once maxed out. REQ-EQUIP-01.
  if (item.kind === "equipment" && item.ref === "shield") return world.ship.shieldLevel >= SHIELD.maxLevel;
  return false;
}

/** Whether this item is the one currently equipped/active/installed (the "AUSGERÜSTET" row). */
export function isEquipped(world: World, item: ShopItem): boolean {
  if (item.kind === "weapon") return world.weapon === item.ref;
  if (item.kind === "ship") return world.shipId === item.ref;
  if (item.kind === "upgrade") {
    if (item.ref === "hangar") return world.hangarLevel >= WINGMAN.maxLevel; // show price until maxed
    return world.shipUpgrades.includes(item.ref as UpgradeId);
  }
  // Show the shield as "equipped" only at max level; below that it still displays a price to level up.
  if (item.kind === "equipment" && item.ref === "shield") return world.ship.shieldLevel >= SHIELD.maxLevel;
  return false;
}

/** Attempt to buy an item, mutating the world's credits/loadout. */
export function purchase(world: World, item: ShopItem): PurchaseResult {
  // Owned ships/weapons can be re-equipped for free — switch loadout at the planet. REQ-SHIP-03.
  if ((item.kind === "ship" || item.kind === "weapon") && isOwned(world, item)) {
    if (isEquipped(world, item)) return "owned"; // already the active one
    if (item.kind === "ship") equipShip(world, item.ref as ShipId);
    else equipWeapon(world, item.ref as WeaponId);
    return "equipped";
  }
  if (isOwned(world, item)) return "owned"; // installed shield — nothing to switch
  if (item.id === "extra-life" && world.lives >= GAME.maxLives) return "max";
  if (world.credits < item.price) return "insufficient";

  world.credits -= item.price;

  if (item.kind === "weapon") {
    const id = item.ref as WeaponId;
    if (!world.ownedWeapons.includes(id)) world.ownedWeapons.push(id);
    world.weapon = id; // auto-equip the newly bought weapon
  } else if (item.kind === "ship") {
    const id = item.ref as ShipId;
    if (!world.ownedShips.includes(id)) world.ownedShips.push(id);
    equipShip(world, id); // auto-equip the newly bought ship
  } else if (item.kind === "upgrade") {
    installShipUpgrade(world, item.ref as UpgradeId); // fit the Titan upgrade
  } else if (item.kind === "equipment") {
    const ref = item.ref as EquipmentRef;
    if (ref === "life") world.lives += 1;
    else if (ref === "shield") grantShield(world.ship);
    else if (ref === "antigrav") world.ship.antigrav += LOOT.antigravTime;
  } else if (item.ref === "rocket") {
    world.rocketAmmo += ROCKET.packSize;
  } else if (item.ref === "mine") {
    world.mineAmmo += MINE.packSize;
  } else {
    const id = item.ref as "ap" | "explosive";
    world.ammoCounts[id] += AMMO[id].packSize;
    world.ammo = id; // auto-select the ammo just bought
  }
  return "ok";
}
