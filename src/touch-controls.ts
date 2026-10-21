import { neutral, type Command } from "./controls";
export function bindTouchControls(
  root: HTMLElement,
  send: (command: Command) => void,
) {
  const held = new Map<number, string>();
  const emit = (action?: string) => {
    const command = neutral();
    for (const value of held.values()) {
      if (value === "left") command.move = -1;
      if (value === "right") command.move = 1;
      if (value === "defend") command.defend = true;
    }
    command.jump = action === "jump";
    command.attack = action === "attack";
    send(command);
  };
  root.addEventListener("pointerdown", (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>(
      "button[data-touch]",
    );
    if (!button) return;
    event.preventDefault();
    try {
      button.setPointerCapture(event.pointerId);
    } catch {
      /* Synthetic pointers have no capture. */
    }
    held.set(event.pointerId, button.dataset.touch!);
    emit(button.dataset.touch);
  });
  const release = (event: PointerEvent) => {
    if (held.delete(event.pointerId)) emit();
  };
  root.addEventListener("pointerup", release);
  root.addEventListener("pointercancel", release);
  root.addEventListener("lostpointercapture", release);
  const clear = () => {
    if (held.size) {
      held.clear();
      emit();
    }
  };
  window.addEventListener("blur", clear);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) clear();
  });
  return clear;
}
