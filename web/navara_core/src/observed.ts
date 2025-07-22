import { EventHandler } from "./eventHandler";

export type ObservedEvent<T> = {
  changed: (v: T) => void;
};

export class Observed<T> extends EventHandler<ObservedEvent<T>> {
  private _value: T;
  constructor(v: T) {
    super();
    this._value = v;
  }

  get value() {
    return this._value;
  }

  set value(v: T) {
    this._value = v;
    this.emit("changed", v);
  }

  changed(f: (v: T) => void) {
    const wrap = (v: T) => {
      f(v);
      this.off("changed", wrap);
    };
    this.on("changed", wrap);
  }
}
