export function isWorker() {
  return typeof self !== "undefined" && self.document === undefined;
}
