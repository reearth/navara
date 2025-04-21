export class EventHandler<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  T extends Record<string, (...args: any[]) => unknown>,
  K extends keyof T = keyof T,
> {
  events: { [E in K]?: Set<T[E]> } = {};
  onceEvents: { [E in K]?: Set<T[E]> } = {};

  on<E extends K>(k: E, f: T[E]) {
    if (!this.events[k]) {
      this.events[k] = new Set();
    }
    this.events[k].add(f);
  }

  off<E extends K>(k: E, f: T[E]) {
    this.events[k]?.delete(f);
    this.onceEvents[k]?.delete(f);
  }

  clear<E extends K>(k: E) {
    this.events[k]?.clear();
    this.onceEvents[k]?.clear();
  }

  size<E extends K>(k: E) {
    return this.events[k]?.size || this.onceEvents[k]?.size;
  }

  /**
   * Register a callback that will be executed only once and then removed
   */
  once<E extends K>(k: E, f: T[E]) {
    if (!this.onceEvents[k]) {
      this.onceEvents[k] = new Set();
    }
    this.onceEvents[k].add(f);
  }

  emit<E extends K>(k: E, ...args: Parameters<T[E]>) {
    // Execute regular callbacks
    this.events[k]?.forEach((c) => c(...args));

    // Execute once callbacks and then remove them
    if (this.onceEvents[k]?.size) {
      this.onceEvents[k]?.forEach((c) => c(...args));
      this.onceEvents[k]?.clear();
    }
  }
}
