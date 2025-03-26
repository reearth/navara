export class EventHandler<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  T extends Record<string, (...args: any[]) => unknown>,
  K extends keyof T = keyof T,
> {
  events: { [E in K]?: Set<T[E]> } = {};

  on<E extends K>(k: E, f: T[E]) {
    if (!this.events[k]) {
      this.events[k] = new Set();
    }
    this.events[k].add(f);
  }

  off<E extends K>(k: E, f: T[E]) {
    this.events[k]?.delete(f);
  }

  emit<E extends K>(k: E, ...args: Parameters<T[E]>) {
    this.events[k]?.forEach((c) => c(...args));
  }
}
