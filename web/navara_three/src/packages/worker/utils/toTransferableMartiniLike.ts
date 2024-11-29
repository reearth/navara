import type { TransferableMartiniLike } from "@navara/core";
import { TransferableMartini } from "@navara/engine-worker";

export function toTransferableMartini(like: TransferableMartiniLike) {
  return new TransferableMartini(like.size, like.coords);
}
