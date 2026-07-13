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
- `src/game/` — Spiellogik: `world` (Zustand), `ship`/`wingman`, `asteroid`, `bullet`/`rocket`/`mine`, `enemy`, `collision`, `loot`, `shop`, `base`, `planet`, `constants`
- `src/input/keyboard.ts` — Tastatureingabe
- `src/render/` — Zeichnen: `renderer` (Haupt-Renderer), `particles`
- `test/` — Vitest-Specs (spiegeln `src/game`, `src/engine`)
- `requirements.json` — Anforderungen (Single Source of Truth, via `reqcheck` geprüft)

## Konventionen
- Requirements-first + TDD: Test vor Implementierung, kleine Inkremente.
- Logik deterministisch und render-frei halten (testbar ohne Canvas). Keine Import-Zyklen.
- Vor dem Push `npm test` grün halten; `npm run build` fängt TS-Fehler ab, die CI sonst rot machen.
