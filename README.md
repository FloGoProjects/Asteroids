# Asteroids — grungy sci-fi

Modernes Asteroids-Remake in **TypeScript + HTML5 Canvas**, Spiellogik nach **TDD** (Vitest) entwickelt und strikt vom Rendering getrennt.

## Steuerung
- **W / ↑** — Schub
- **A D / ← →** — Drehen
- **Leertaste** — Feuern
- **Enter** — Neustart (nach Game Over)

## Befehle
```bash
npm install       # Abhängigkeiten
npm run dev       # Dev-Server (Spiel im Browser)
npm test          # Alle Tests (Vitest)
npm run test:watch
npm run build     # Typecheck + Produktions-Build
```

## Architektur
```
src/
  engine/     # wiederverwendbare, framework-freie Bausteine
    vector2.ts  random.ts  wrap.ts
  game/       # reine, getestete Spiellogik (kein DOM/Canvas)
    constants.ts  ship.ts  bullet.ts  asteroid.ts  collision.ts  world.ts
  input/      # Tastatur -> Input
  render/     # Canvas-Renderer + Partikel (nur Präsentation)
  main.ts     # Bootstrap + fixed-timestep Game-Loop
test/         # Vitest-Suiten pro Modul
requirements.json  # Requirements <-> Tests <-> Teststatus
```

Die gesamte Physik ist **deterministisch** (seedbares RNG), damit die Weltlogik testbar bleibt. Der Renderer und die Partikel berühren die getestete Logik nicht.

## Status
v1 (Kern-Gameplay) vollständig: Schiff (Rotation, Schub, Trägheit, Umlauf), Schießen mit Cooldown, ein Asteroidentyp, Kollisionen (Projektil↔Asteroid, Schiff↔Asteroid), Score, Leben, Game Over. **40/40 Tests grün**, TypeScript strict.

Nächste Schritte (geplant): Asteroiden-Splitting & Größen, Wellen, Shop, Waffen, Schiffe. Siehe `requirements.json` → `milestones.future`.
