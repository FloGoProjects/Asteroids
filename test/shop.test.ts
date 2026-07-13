import { describe, it, expect } from "vitest";
import { createWorld } from "../src/game/world.ts";
import {
  SHOP_ITEMS,
  SHOP_PAGES,
  itemsForPage,
  visibleItems,
  purchase,
  isOwned,
  isEquipped,
} from "../src/game/shop.ts";
import { WEAPONS, AMMO, SHIPS, GAME, EQUIPMENT, ROCKET, MINE } from "../src/game/constants.ts";

const item = (id: string) => {
  const found = SHOP_ITEMS.find((i) => i.id === id);
  if (!found) throw new Error(`no shop item ${id}`);
  return found;
};

const newWorld = () => createWorld({ width: 800, height: 600, seed: 1, asteroids: 0 });

// REQ-SHOP-01
describe("shop catalog", () => {
  it("offers weapons, ammo, ship and equipment", () => {
    expect(SHOP_ITEMS.map((i) => i.id).sort()).toEqual([
      "ammo-ap",
      "ammo-explosive",
      "ammo-mine",
      "ammo-rocket",
      "ballista",
      "equip-antigrav",
      "equip-shield",
      "extra-life",
      "ship-deltaRaptor",
      "ship-titan",
      "upgrade-autocannon",
      "upgrade-engines",
      "upgrade-hangar",
      "upgrade-shieldGen",
      "upgrade-tractor",
      "vulkan",
    ]);
  });
});

// REQ-SHOP-02 / REQ-SHOP-04
describe("shop pages", () => {
  it("groups items into ammo, weapon, ship, upgrade and equipment pages", () => {
    expect(SHOP_PAGES).toEqual(["ammo", "weapon", "ship", "upgrade", "equipment"]);
    expect(itemsForPage("ammo").map((i) => i.id)).toEqual([
      "ammo-ap",
      "ammo-explosive",
      "ammo-rocket",
      "ammo-mine",
    ]);
    expect(itemsForPage("weapon").map((i) => i.id)).toEqual(["vulkan", "ballista"]);
    expect(itemsForPage("ship").map((i) => i.id)).toEqual(["ship-deltaRaptor", "ship-titan"]);
    expect(itemsForPage("upgrade").map((i) => i.id)).toEqual([
      "upgrade-shieldGen",
      "upgrade-engines",
      "upgrade-autocannon",
      "upgrade-tractor",
      "upgrade-hangar",
    ]);
    expect(itemsForPage("equipment").map((i) => i.id)).toEqual([
      "extra-life",
      "equip-shield",
      "equip-antigrav",
    ]);
  });
});

// REQ-SHOP-05: items unlock progressively as the waves advance
describe("progressive unlock by wave", () => {
  it("reveals weapons only from their unlock wave on", () => {
    const w = newWorld(); // wave 1
    expect(w.wave).toBe(1);
    expect(visibleItems(w, "weapon").map((i) => i.id)).toEqual(["vulkan"]);
    w.wave = 2;
    expect(visibleItems(w, "weapon").map((i) => i.id)).toEqual(["vulkan", "ballista"]);
  });

  it("reveals ammo packs one wave at a time", () => {
    const w = newWorld(); // wave 1
    expect(visibleItems(w, "ammo").map((i) => i.id)).toEqual(["ammo-ap"]);
    w.wave = 2;
    expect(visibleItems(w, "ammo").map((i) => i.id)).toEqual(["ammo-ap", "ammo-explosive"]);
    w.wave = 3;
    expect(visibleItems(w, "ammo").map((i) => i.id)).toEqual([
      "ammo-ap",
      "ammo-explosive",
      "ammo-rocket",
    ]);
    w.wave = 4;
    expect(visibleItems(w, "ammo").map((i) => i.id)).toEqual([
      "ammo-ap",
      "ammo-explosive",
      "ammo-rocket",
      "ammo-mine",
    ]);
  });

  it("keeps the Delta Raptor hidden until its unlock wave", () => {
    const w = newWorld(); // wave 1
    expect(visibleItems(w, "ship").map((i) => i.id)).not.toContain("ship-deltaRaptor");
    w.wave = 3;
    expect(visibleItems(w, "ship").map((i) => i.id)).toContain("ship-deltaRaptor");
  });
});

// REQ-WERFT-01: the Titan is only offered at shipyard planets
describe("shipyard-gated Titan", () => {
  it("hides the Titan in a normal shop and shows it at a shipyard", () => {
    const w = newWorld();
    w.wave = 9; // waves don't gate the Titan
    w.atShipyard = false;
    expect(visibleItems(w, "ship").map((i) => i.id)).not.toContain("ship-titan");
    w.atShipyard = true;
    expect(visibleItems(w, "ship").map((i) => i.id)).toContain("ship-titan");
  });

  it("hides Titan upgrades away from a shipyard even when the Titan is owned", () => {
    const w = newWorld();
    w.ownedShips.push("titan");
    w.atShipyard = false;
    expect(visibleItems(w, "upgrade").map((i) => i.id)).toEqual([]);
    w.atShipyard = true;
    expect(visibleItems(w, "upgrade").length).toBeGreaterThan(0);
  });
});

describe("purchasing", () => {
  it("buys a weapon: deducts credits, adds ownership, auto-equips", () => {
    const w = newWorld();
    w.credits = 2000;
    const r = purchase(w, item("ballista"));
    expect(r).toBe("ok");
    expect(w.credits).toBe(2000 - WEAPONS.ballista.price);
    expect(w.ownedWeapons).toContain("ballista");
    expect(w.weapon).toBe("ballista");
  });

  it("refuses to buy a weapon twice", () => {
    const w = newWorld();
    w.credits = 5000;
    purchase(w, item("vulkan"));
    const creditsAfterFirst = w.credits;
    const r = purchase(w, item("vulkan"));
    expect(r).toBe("owned");
    expect(w.credits).toBe(creditsAfterFirst); // no double charge
  });

  it("refuses when credits are insufficient", () => {
    const w = newWorld();
    w.credits = 100;
    const r = purchase(w, item("ballista"));
    expect(r).toBe("insufficient");
    expect(w.credits).toBe(100);
    expect(w.ownedWeapons).not.toContain("ballista");
  });

  it("buys an ammo pack: adds rounds and deducts credits", () => {
    const w = newWorld();
    w.credits = 1000;
    const r = purchase(w, item("ammo-ap"));
    expect(r).toBe("ok");
    expect(w.ammoCounts.ap).toBe(AMMO.ap.packSize);
    expect(w.credits).toBe(1000 - AMMO.ap.price);
  });

  it("allows buying ammo repeatedly (stacks)", () => {
    const w = newWorld();
    w.credits = 10000;
    purchase(w, item("ammo-explosive"));
    purchase(w, item("ammo-explosive"));
    expect(w.ammoCounts.explosive).toBe(AMMO.explosive.packSize * 2);
  });

  it("buying rockets grants rocket ammo", () => {
    const w = newWorld();
    w.credits = 5000;
    const before = w.rocketAmmo;
    const r = purchase(w, item("ammo-rocket"));
    expect(r).toBe("ok");
    expect(w.rocketAmmo).toBe(before + ROCKET.packSize);
    expect(w.credits).toBe(5000 - ROCKET.price);
  });

  it("buying mines grants mine ammo", () => {
    const w = newWorld();
    w.credits = 5000;
    const before = w.mineAmmo;
    const r = purchase(w, item("ammo-mine"));
    expect(r).toBe("ok");
    expect(w.mineAmmo).toBe(before + MINE.packSize);
    expect(w.credits).toBe(5000 - MINE.price);
  });

  it("buys the Delta Raptor: deducts credits, owns and equips it", () => {
    const w = newWorld();
    w.credits = 3000;
    const r = purchase(w, item("ship-deltaRaptor"));
    expect(r).toBe("ok");
    expect(w.credits).toBe(3000 - SHIPS.deltaRaptor.price);
    expect(w.ownedShips).toContain("deltaRaptor");
    expect(w.shipId).toBe("deltaRaptor");
    expect(w.ship.radius).toBe(SHIPS.deltaRaptor.radius);
  });

  it("buys the Titan: deducts credits, owns and equips it with turrets", () => {
    const w = newWorld();
    w.credits = SHIPS.titan.price + 100;
    const r = purchase(w, item("ship-titan"));
    expect(r).toBe("ok");
    expect(w.credits).toBe(100);
    expect(w.ownedShips).toContain("titan");
    expect(w.shipId).toBe("titan");
    expect(w.ship.turrets.length).toBeGreaterThan(0);
    expect(w.ship.shieldMax).toBe(SHIPS.titan.shieldCapacity);
  });

  it("refuses to re-buy the currently equipped ship (owned, no charge)", () => {
    const w = newWorld();
    w.credits = 10000;
    purchase(w, item("ship-deltaRaptor")); // becomes the active ship
    const after = w.credits;
    const r = purchase(w, item("ship-deltaRaptor"));
    expect(r).toBe("owned");
    expect(w.credits).toBe(after);
  });

  it("switches to an owned but unequipped ship for free (planet swap)", () => {
    const w = newWorld();
    w.credits = 20000;
    purchase(w, item("ship-titan")); // own + equip Titan
    purchase(w, item("ship-deltaRaptor")); // own + equip Delta Raptor (now active)
    expect(w.shipId).toBe("deltaRaptor");
    const credits = w.credits;
    const r = purchase(w, item("ship-titan")); // switch back to the owned Titan
    expect(r).toBe("equipped");
    expect(w.shipId).toBe("titan");
    expect(w.credits).toBe(credits); // free switch, no charge
    // only the active ship reads as equipped; the other is owned-not-equipped
    expect(isEquipped(w, item("ship-titan"))).toBe(true);
    expect(isEquipped(w, item("ship-deltaRaptor"))).toBe(false);
    expect(isOwned(w, item("ship-deltaRaptor"))).toBe(true);
  });

  it("switches to an owned but unequipped weapon for free", () => {
    const w = newWorld();
    w.credits = 20000;
    purchase(w, item("vulkan")); // own + equip Vulkan
    purchase(w, item("ballista")); // own + equip Ballista (now active)
    expect(w.weapon).toBe("ballista");
    const credits = w.credits;
    const r = purchase(w, item("vulkan"));
    expect(r).toBe("equipped");
    expect(w.weapon).toBe("vulkan");
    expect(w.credits).toBe(credits);
  });

  it("refuses the Delta Raptor when credits are insufficient", () => {
    const w = newWorld();
    w.credits = 100;
    const r = purchase(w, item("ship-deltaRaptor"));
    expect(r).toBe("insufficient");
    expect(w.ownedShips).not.toContain("deltaRaptor");
  });
});

// REQ-SHOP-04: equipment page (extra life + random special gear)
describe("equipment purchases", () => {
  it("extra life purchase adds a life and costs credits", () => {
    const w = newWorld();
    w.credits = 5000;
    w.lives = 3;
    const r = purchase(w, item("extra-life"));
    expect(r).toBe("ok");
    expect(w.lives).toBe(4);
    expect(w.credits).toBe(5000 - EQUIPMENT.extraLife.price);
  });

  it("refuses an extra life at the maximum", () => {
    const w = newWorld();
    w.credits = 5000;
    w.lives = GAME.maxLives;
    const r = purchase(w, item("extra-life"));
    expect(r).toBe("max");
    expect(w.lives).toBe(GAME.maxLives);
    expect(w.credits).toBe(5000); // not charged
  });

  it("buying a shield from the shop grants a shield", () => {
    const w = newWorld();
    w.credits = 5000;
    expect(w.ship.shield).toBe(0);
    const r = purchase(w, item("equip-shield"));
    expect(r).toBe("ok");
    expect(w.ship.shield).toBeGreaterThan(0);
    expect(w.credits).toBe(5000 - EQUIPMENT.shield.price);
  });

  it("shows an installed shield as owned and refuses a second purchase", () => {
    const w = newWorld();
    w.credits = 5000;
    const shield = item("equip-shield");
    expect(isOwned(w, shield)).toBe(false); // nothing fitted yet
    purchase(w, shield);
    expect(w.ship.shieldMax).toBeGreaterThan(0);
    expect(isOwned(w, shield)).toBe(true); // now displayed as "AUSGERÜSTET"
    const credits = w.credits;
    expect(purchase(w, shield)).toBe("owned"); // not charged again
    expect(w.credits).toBe(credits);
  });

  it("keeps repeatable equipment (extra life, antigrav) un-owned", () => {
    const w = newWorld();
    expect(isOwned(w, item("extra-life"))).toBe(false);
    expect(isOwned(w, item("equip-antigrav"))).toBe(false);
  });
});

describe("Titan upgrades", () => {
  it("hides upgrades until the Titan is owned at a shipyard, then shows them", () => {
    const w = newWorld();
    w.atShipyard = true; // upgrades are shipyard-gated. REQ-WERFT-01
    expect(visibleItems(w, "upgrade").map((i) => i.id)).toEqual([]);
    w.ownedShips.push("titan");
    expect(visibleItems(w, "upgrade").map((i) => i.id)).toEqual([
      "upgrade-shieldGen",
      "upgrade-engines",
      "upgrade-autocannon",
      "upgrade-tractor",
      "upgrade-hangar",
    ]);
  });

  it("buying the shield generator installs it and boosts the Titan's shield capacity", () => {
    const w = newWorld();
    w.credits = 20000;
    purchase(w, item("ship-titan")); // own + equip the Titan
    const baseCap = w.ship.shieldMax;
    const r = purchase(w, item("upgrade-shieldGen"));
    expect(r).toBe("ok");
    expect(w.shipUpgrades).toContain("shieldGen");
    expect(w.ship.shieldMax).toBeGreaterThan(baseCap); // capacity increased
    expect(isOwned(w, item("upgrade-shieldGen"))).toBe(true);
  });

  it("buying engines makes the Titan faster and more agile", () => {
    const w = newWorld();
    w.credits = 20000;
    purchase(w, item("ship-titan"));
    const base = { thrust: w.ship.thrust, maxSpeed: w.ship.maxSpeed, turnSpeed: w.ship.turnSpeed };
    const r = purchase(w, item("upgrade-engines"));
    expect(r).toBe("ok");
    expect(w.shipUpgrades).toContain("engines");
    expect(w.ship.thrust).toBeGreaterThan(base.thrust);
    expect(w.ship.maxSpeed).toBeGreaterThan(base.maxSpeed);
    expect(w.ship.turnSpeed).toBeGreaterThan(base.turnSpeed);
  });

  it("buying the autocannon fits an auto-turret to the Titan", () => {
    const w = newWorld();
    w.credits = 20000;
    purchase(w, item("ship-titan"));
    expect(w.ship.hasAutocannon).toBe(false);
    const r = purchase(w, item("upgrade-autocannon"));
    expect(r).toBe("ok");
    expect(w.shipUpgrades).toContain("autocannon");
    expect(w.ship.hasAutocannon).toBe(true);
  });

  it("buying the tractor beam installs it on the Titan", () => {
    const w = newWorld();
    w.credits = 20000;
    purchase(w, item("ship-titan"));
    const r = purchase(w, item("upgrade-tractor"));
    expect(r).toBe("ok");
    expect(w.shipUpgrades).toContain("tractor");
  });

  it("buying the hangar installs it on the Titan", () => {
    const w = newWorld();
    w.credits = 20000;
    purchase(w, item("ship-titan"));
    const r = purchase(w, item("upgrade-hangar"));
    expect(r).toBe("ok");
    expect(w.shipUpgrades).toContain("hangar");
  });

  it("refuses to buy an already-installed upgrade", () => {
    const w = newWorld();
    w.credits = 20000;
    purchase(w, item("ship-titan"));
    purchase(w, item("upgrade-shieldGen"));
    const credits = w.credits;
    const r = purchase(w, item("upgrade-shieldGen"));
    expect(r).toBe("owned");
    expect(w.credits).toBe(credits);
  });

  it("keeps the upgrade installed after switching ships and back", () => {
    const w = newWorld();
    w.credits = 20000;
    purchase(w, item("ship-titan"));
    purchase(w, item("upgrade-shieldGen"));
    const boosted = w.ship.shieldMax;
    // buy + switch to another ship, then switch back to the Titan
    purchase(w, item("ship-deltaRaptor"));
    purchase(w, item("ship-titan"));
    expect(w.shipId).toBe("titan");
    expect(w.ship.shieldMax).toBe(boosted); // upgrade re-applied
  });
});

describe("random equipment stock", () => {
  it("visibleItems hides random equipment that is out of stock", () => {
    const w = newWorld();
    w.shopStock = [];
    expect(visibleItems(w, "equipment").map((i) => i.id)).toEqual(["extra-life"]);
  });

  it("visibleItems shows random equipment that is in stock", () => {
    const w = newWorld();
    w.shopStock = ["equip-shield"];
    expect(visibleItems(w, "equipment").map((i) => i.id)).toEqual(["extra-life", "equip-shield"]);
  });
});
