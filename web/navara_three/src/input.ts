import type { Core } from "@navara/engine";

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
    core.input(mouseEvent);
  };
  const mouseup = () => {
    core.input({
      ...(mouseEvent ?? {}),
      type: "mouseup",
    });
    mouseEvent = undefined;
  };

  const mousemove = (event: MouseEvent) => {
    const width = element.clientWidth;
    const height = element.clientHeight;
    const aspectRatio = width / height;
    core.input({
      type: "mousemove",
      x: (event.clientX / width) * aspectRatio,
      y: event.clientY / height,
    });
  };

  const touchstart = (event: TouchEvent) => {
    event.preventDefault();
    
    const width = element.clientWidth;
    const height = element.clientHeight;
    
    for (const touch of event.changedTouches) {
      core.input({
        type: "touchstart",
        x: (touch.clientX / width),
        y: touch.clientY / height,
        id: touch.identifier,
      });
    }

  };

  const touchend = (event: TouchEvent) => {
    event.preventDefault();

    const width = element.clientWidth;
    const height = element.clientHeight;

    for (const touch of event.changedTouches) {
      core.input({
        type: "touchend",
        x: (touch.clientX / width),
        y: touch.clientY / height,
        id: touch.identifier,
      });
    }
    
  };

  const touchmove = (event: TouchEvent) => {
    event.preventDefault();

    const width = element.clientWidth;
    const height = element.clientHeight;

    for (const touch of event.changedTouches) {
      core.input({
        type: "touchmove",
        x: (touch.clientX / width),
        y: touch.clientY / height,
        id: touch.identifier,
      });
    }
  }

  const wheel = (event: WheelEvent) => {
    core.input({
      type: "wheel",
      x: event.deltaX,
      y: event.deltaY,
    });
    console.log("wheel", event.deltaX, event.deltaY);
  };

  const keydown = (event: KeyboardEvent) => {
    core.input({
      type: "keydown",
      key_code: event.code,
      key: event.key,
    });
  };

  const keyup = (event: KeyboardEvent) => {
    core.input({
      type: "keyup",
      key_code: event?.code,
      key: event?.key,
    });
  };
  // This is used to emit a key up event without any params.
  const keyupEmpty = () => {
    core.input({
      type: "keyup",
    });
  };

  element.addEventListener("mousedown", mousedown);
  element.addEventListener("mouseup", mouseup);
  element.addEventListener("mouseleave", mouseup);
  element.addEventListener("mouseleave", keyupEmpty);
  element.addEventListener("mousemove", mousemove);
  element.addEventListener("touchstart", touchstart);
  element.addEventListener("touchend", touchend);
  element.addEventListener("touchmove", touchmove);
  element.addEventListener("wheel", wheel);
  document.addEventListener("keydown", keydown);
  document.addEventListener("keyup", keyup);

  return () => {
    element.removeEventListener("mousedown", mousedown);
    element.removeEventListener("mouseup", mouseup);
    element.removeEventListener("mouseleave", mouseup);
    element.removeEventListener("mouseleave", keyupEmpty);
    element.removeEventListener("mousemove", mousemove);
    element.removeEventListener("touchstart", touchstart);
    element.removeEventListener("touchend", touchend);
    element.removeEventListener("touchmove", touchmove);
    element.removeEventListener("wheel", wheel);
    document.removeEventListener("keydown", keydown);
    document.removeEventListener("keyup", keyup);
  };
}
