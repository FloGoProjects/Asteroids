/** Keyboard input mapping to the game Input shape. */
import { Input } from "../game/world.ts";

export function createKeyboardInput(target: Window = window): {
  state: Input;
  dispose: () => void;
} {
  const state: Input = {
    turnLeft: false,
    turnRight: false,
    thrust: false,
    fire: false,
    fireSecondary: false,
    aim: null,
  };

  // Fire can come from the keyboard (Space) or the left mouse button; keep them independent.
  let keyFire = false;
  let mouseFire = false;
  const syncFire = (): void => {
    state.fire = keyFire || mouseFire;
  };

  const set = (code: string, down: boolean): boolean => {
    switch (code) {
      case "ArrowLeft":
      case "KeyA":
        state.turnLeft = down;
        return true;
      case "ArrowRight":
      case "KeyD":
        state.turnRight = down;
        return true;
      case "ArrowUp":
      case "KeyW":
        state.thrust = down;
        return true;
      case "Space":
        keyFire = down;
        syncFire();
        return true;
      case "ArrowDown":
      case "KeyS":
        state.fireSecondary = down;
        return true;
      default:
        return false;
    }
  };

  const onDown = (e: KeyboardEvent): void => {
    if (set(e.code, true)) e.preventDefault();
  };
  const onUp = (e: KeyboardEvent): void => {
    if (set(e.code, false)) e.preventDefault();
  };

  // Mouse: track the pointer as the aim target and fire on the left button.
  const onMove = (e: MouseEvent): void => {
    state.aim = { x: e.clientX, y: e.clientY };
  };
  const onMouseDown = (e: MouseEvent): void => {
    if (e.button === 0) {
      mouseFire = true;
      syncFire();
    }
  };
  const onMouseUp = (e: MouseEvent): void => {
    if (e.button === 0) {
      mouseFire = false;
      syncFire();
    }
  };

  target.addEventListener("keydown", onDown);
  target.addEventListener("keyup", onUp);
  target.addEventListener("mousemove", onMove);
  target.addEventListener("mousedown", onMouseDown);
  target.addEventListener("mouseup", onMouseUp);

  return {
    state,
    dispose: () => {
      target.removeEventListener("keydown", onDown);
      target.removeEventListener("keyup", onUp);
      target.removeEventListener("mousemove", onMove);
      target.removeEventListener("mousedown", onMouseDown);
      target.removeEventListener("mouseup", onMouseUp);
    },
  };
}
