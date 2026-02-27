export class Plugin<TView = unknown> {
  async init(_view: TView): Promise<void> {}
}
