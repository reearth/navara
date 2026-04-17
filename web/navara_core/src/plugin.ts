/**
 * Base `Plugin` abstract class.
 * This class doesn't have a logic, but has interfaces.
 * ```
 * class MyPlugin extends Plugin<ThreeView<MyCustomDeclarations>, ViewContext> {
 *   async init(view, ctx) {
 *     // ...
 *   }
 * }
 * ```
 */
// DO NOT add a logic to this class as much as possible.
export abstract class Plugin<TView = unknown, TCtx = unknown> {
  abstract init(view: TView, ctx: TCtx): Promise<void>;
}
