/**
 * A bottom-center timeline player for the curated gallery examples: a play/pause
 * icon button next to a range slider, styled to match the buttons in button.ts
 * (Tweakpane stays on the dev/debug pages).
 *
 * The example supplies callbacks and reflects playback position via the
 * returned `setValue`; the icon swap lives here.
 */

const PLAYER_BAR_CLASS = "example-player-bar";
const PLAYER_BUTTON_CLASS = "example-player-button";
const PLAYER_SLIDER_CLASS = "example-player-slider";

const PLAYER_CSS = `
.${PLAYER_BAR_CLASS} {
  position: fixed;
  bottom: 16px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 8px;
  width: min(560px, calc(100vw - 32px));
  padding: 4px 10px;
  background: #fff;
  border: 1px solid #d4d7da;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
  font-family: system-ui, sans-serif;
}
.${PLAYER_BUTTON_CLASS} {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  color: #333;
  background: transparent;
  border: none;
  border-radius: 6px;
  cursor: pointer;
}
.${PLAYER_BUTTON_CLASS}:hover {
  background: #eef0f2;
}
.${PLAYER_BUTTON_CLASS} svg {
  width: 15px;
  height: 15px;
  fill: currentColor;
}
.${PLAYER_SLIDER_CLASS} {
  flex: 1 1 auto;
  cursor: pointer;
}
`;

const PLAY_ICON = '<svg viewBox="0 0 16 16"><path d="M4 3l9 5-9 5z" /></svg>';
const PAUSE_ICON =
  '<svg viewBox="0 0 16 16"><rect x="4" y="3" width="3" height="10" /><rect x="9" y="3" width="3" height="10" /></svg>';

let styleInjected = false;
const injectStyle = () => {
  if (styleInjected) return;
  const style = document.createElement("style");
  style.textContent = PLAYER_CSS;
  document.head.appendChild(style);
  styleInjected = true;
};

export type Player = {
  /** Move the slider knob to `value` (e.g. to follow ongoing playback). */
  setValue: (value: number) => void;
};

/**
 * Appends a play/pause button and a range slider as one bottom bar and returns
 * a {@link Player}. `onToggle` receives the new playing state (the icon swaps
 * automatically); `onScrub` receives the slider value on drag.
 */
export const addPlayer = (options: {
  min: number;
  max: number;
  step?: number;
  value: number;
  playing: boolean;
  onToggle: (playing: boolean) => void;
  onScrub: (value: number) => void;
}): Player => {
  injectStyle();

  const bar = document.createElement("div");
  bar.className = PLAYER_BAR_CLASS;

  const button = document.createElement("button");
  button.className = PLAYER_BUTTON_CLASS;
  button.title = "Play / Pause";
  let playing = options.playing;
  button.innerHTML = playing ? PAUSE_ICON : PLAY_ICON;
  button.onclick = () => {
    playing = !playing;
    button.innerHTML = playing ? PAUSE_ICON : PLAY_ICON;
    options.onToggle(playing);
  };

  const slider = document.createElement("input");
  slider.type = "range";
  slider.className = PLAYER_SLIDER_CLASS;
  slider.min = String(options.min);
  slider.max = String(options.max);
  slider.step = String(options.step ?? 1);
  slider.value = String(options.value);
  slider.oninput = () => options.onScrub(Number(slider.value));

  // While the user is dragging the knob, ignore setValue() so ongoing playback
  // can't yank the slider back from under the cursor.
  let dragging = false;
  slider.addEventListener("pointerdown", () => (dragging = true));
  window.addEventListener("pointerup", () => (dragging = false));

  bar.append(button, slider);
  document.body.appendChild(bar);

  return {
    setValue: (value: number) => {
      if (dragging) return;
      slider.value = String(value);
    },
  };
};
