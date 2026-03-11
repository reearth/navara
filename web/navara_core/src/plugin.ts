/**
 * Base `Plugin` abstract class.
 * This class doesn't have a logic, but has interfaces.
 * ```
 * class MyPlugin extends Plugin<ThreeView<MyCustomLayers>> {
 *   async init(view) {
 *     // ...
 *   }
 * }
 * ```
 */
// DO NOT add a logic to this class as much as possible.
export abstract class Plugin<TView = unknown> {
  abstract init(view: TView): Promise<void>;
}
