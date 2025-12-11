import type { Core } from "@navara/engine";

// Input queue to hold inputs until next RAF frame
// This prevents recursive borrowing when Core.update is running and JS callbacks trigger input events
const pendingInputs: { core: Core; input: Record<string, unknown> }[] = [];
let rafScheduled = false;

// Flush all pending inputs in next RAF frame
// RAF callback is safe because it runs after Rust call stack has fully unwound
const flushInputs = () => {
  rafScheduled = false;
  if (pendingInputs.length === 0) return;

  // Process all queued inputs
  const items = pendingInputs.splice(0, pendingInputs.length);

  for (const { core, input } of items) {
    core.input(input);
  }
};

// Safe input wrapper using RAF queue pattern
// DOM events only queue inputs, never call Core.input directly
const safeInput = (core: Core, input: Record<string, unknown>) => {
  pendingInputs.push({ core, input });

  if (!rafScheduled) {
    rafScheduled = true;
    requestAnimationFrame(flushInputs);
  }
};

// TODO: Need to think about how to propagate these event to worker.
export function registerInputEvents(
  core: Core,
  element: HTMLElement,
): () => void {
  let mouseEvent:
    | {
        type: "mousedown" | "mouseup";
        button: number;
      }
    | undefined;
  const mousedown = (event: MouseEvent) => {
    mouseEvent = {
      type: "mousedown",
      button: event.button,
    };
    safeInput(core, mouseEvent);
  };
  const mouseup = () => {
    safeInput(core, {
      ...(mouseEvent ?? {}),
      type: "mouseup",
    });
    mouseEvent = undefined;
  };

  const mousemove = (event: MouseEvent) => {
    const width = element.clientWidth;
    const height = element.clientHeight;
    const aspectRatio = width / height;
    safeInput(core, {
      type: "mousemove",
      x: (event.clientX / width) * aspectRatio,
      y: event.clientY / height,
    });
  };

  const wheel = (event: WheelEvent) => {
    safeInput(core, {
      type: "wheel",
      x: event.deltaX,
      y: event.deltaY,
    });
  };

  const keydown = (event: KeyboardEvent) => {
    safeInput(core, {
      type: "keydown",
      key_code: event.code,
      key: event.key,
    });
  };

  const keyup = (event: KeyboardEvent) => {
    safeInput(core, {
      type: "keyup",
      key_code: event?.code,
      key: event?.key,
    });
  };
  // This is used to emit a key up event without any params.
  const keyupEmpty = () => {
    safeInput(core, {
      type: "keyup",
    });
  };

  element.addEventListener("mousedown", mousedown);
  element.addEventListener("mouseup", mouseup);
  element.addEventListener("mouseleave", mouseup);
  element.addEventListener("mouseleave", keyupEmpty);
  element.addEventListener("mousemove", mousemove);
  element.addEventListener("wheel", wheel);
  document.addEventListener("keydown", keydown);
  document.addEventListener("keyup", keyup);

  return () => {
    element.removeEventListener("mousedown", mousedown);
    element.removeEventListener("mouseup", mouseup);
    element.removeEventListener("mouseleave", mouseup);
    element.removeEventListener("mouseleave", keyupEmpty);
    element.removeEventListener("mousemove", mousemove);
    element.removeEventListener("wheel", wheel);
    document.removeEventListener("keydown", keydown);
    document.removeEventListener("keyup", keyup);
  };
}
