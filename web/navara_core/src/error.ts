export class Unimplemented extends Error {
  constructor(message?: string) {
    super(message ?? "Unimplemented");
  }
}

export class Unreachable extends Error {
  constructor(message?: string) {
    super(message ?? "Unreachable");
  }
}
