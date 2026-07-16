# Asteroids — Projekt-Landkarte

Modernes, grungy Sci-Fi-Asteroids. TypeScript + Canvas, Build/Dev mit Vite, Tests mit Vitest.
Deterministische Spiellogik (`src/game`, `src/engine`) strikt getrennt vom Rendering (`src/render`).

## Befehle
- `npm run dev` — Dev-Server (Vite, HMR)
- `npm run build` — Produktions-Build nach `dist/` (`tsc && vite build`)
- `npm run preview` — gebauten `dist/`-Stand lokal servieren
- `npm test` — Tests einmalig (Vitest)
- `npm run test:watch` — Tests im Watch-Modus
- `npm run coverage` — Testabdeckung
- `npm run reqcheck` — Abgleich Code ↔ `requirements.json`

## Deployment (GitHub Pages)
- **Automatisch:** Jeder Push auf `main` triggert `.github/workflows/deploy.yml` → Build → Deploy.
- **Live-URL:** https://flogoprojects.github.io/Asteroids/
- **Status prüfen:** https://github.com/FloGoProjects/Asteroids/actions
- **Pages-Quelle:** Settings → Pages → Source = „GitHub Actions" (einmalig gesetzt).
- **`base: './'`** in `vite.config.ts` — relative Pfade, nötig für den Pages-Unterordner. Nicht auf absolute Pfade ändern, sonst weiße Seite.

### Änderung veröffentlichen
```bash
npm test && npm run build   # lokal grün? (build fängt TS-Fehler, die CI sonst rot machen)
git add -A
git commit -m "…"
git push                    # löst Deploy automatisch aus
```

## Datei-Landkarte
- `src/main.ts` — Einstiegspunkt, Game-Loop
- `src/engine/` — reine Utilities: `vector2` (Mathe), `wrap` (Bildschirmrand), `random` (deterministischer RNG)
- `src/game/` — Spiellogik: `world` (Zustand), `ship`/`wingman`, `asteroid`, `bullet`/`rocket`/`mine`/`siege` (Belagerungs-/Jäger-Rakete), `enemy`, `collision`, `loot`, `crate` (Belohnungs-Kiste), `convoy` (Frachter), `shop`, `base`, `planet` (normal/shipyard), `constants`
- **Schiffe** (REQ-SHIP-06): Sekundärwaffe ist schiffsgebunden (kein X-Toggle). `SHIPS[id].secondary` → `world.secondary` in `equipShip`. Minenleger `seeder` ('Sämann', Katamaran) legt Minen; die übrigen feuern Raketen.
- **Großkampfschiffe** (nur an Werft-Planeten): `titan` (2 Türme + 5 Upgrades) und `cruiser` ('Hydra', REQ-SHIP-07: baut Raketen selbst bis `CRUISER.magazine`, feuert Salven via `fireRocketSalvo`, 1 Turm, keine Upgrades). Der `seeder` baut analog Minen nach (`SEEDER`), seine Minen kriechen auf nahe Gegner zu (`MINE.seekRange`).
- **Event-Exklusivität** (REQ-EVENT-03): `eventActive` (Event läuft) / `eventBlocking` (Event läuft ODER Schlachtschiff da). Während eines Events spawnen keine Schlachtschiffe, und mit Schlachtschiff startet kein Event.
- **Dev-Shop** (REQ-DEV-01): **Ä** öffnet `openDevShop` — alle Shop-Sperren aufgehoben (Titan-Upgrades weiterhin nur mit Titan).
- **Belohnungs-Kisten** (REQ-REWARD-01): Boss/Schlachtschiff/Event droppt eine Kiste; Einsammeln öffnet `state 'reward'` mit Auswahl 1-von-3 (`rollRewardChoices`/`applyReward`/`chooseReward`).
- **Events**: Kopfgeld-Elite (REQ-EVENT-01, `createEliteBattleship`/`updateBounty`, gebufftes Schlachtschiff mit `BOUNTY`) und Konvoi-Eskorte (REQ-EVENT-02, `convoy.ts`/`updateConvoy`, Frachter schützen; Raider = `Enemy.hunting==='convoy'`). Beide droppen Belohnungs-Kisten.
- **Titan-Werft-Event** (REQ-WERFT-01): ab Welle `WERFT.eventWave` verteidigt man einen Shipyard-Planeten gegen Belagerungsraketen; Zustand in `world.werft`; danach ist der Titan nur an Shipyard-Planeten (`atShipyard`) kaufbar. Shop-Items schalten per `unlockWave` nach Welle frei (REQ-SHOP-05).
- `src/input/keyboard.ts` — Tastatureingabe
- `src/render/` — Zeichnen: `renderer` (Haupt-Renderer), `particles`
- `test/` — Vitest-Specs (spiegeln `src/game`, `src/engine`)
- `requirements.json` — Anforderungen (Single Source of Truth, via `reqcheck` geprüft)

## Konventionen
- Requirements-first + TDD: Test vor Implementierung, kleine Inkremente.
- Logik deterministisch und render-frei halten (testbar ohne Canvas). Keine Import-Zyklen.
- Vor dem Push `npm test` grün halten; `npm run build` fängt TS-Fehler ab, die CI sonst rot machen.
