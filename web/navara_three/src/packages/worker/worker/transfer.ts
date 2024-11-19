import workerpool from "workerpool";

export const transfer = <T extends object>(
  message: T,
  transfer: Transferable[],
) => new workerpool.Transfer(message, transfer) as T;
