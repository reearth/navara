import type { TransferableMartiniLike } from "@navaramap/core";
import { TransferableMartini } from "@navaramap/engine-worker";

export function toTransferableMartini(like: TransferableMartiniLike) {
  return new TransferableMartini(like.size, like.coords);
}
