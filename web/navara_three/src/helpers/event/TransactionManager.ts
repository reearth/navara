export class TransactionManager {
  private record: { [K in string]: Transaction | undefined } = {};
  getOrInsert(id: string) {
    if (this.record[id]) {
      return this.record[id];
    }
    this.record[id] = new Transaction(id);
    return this.record[id];
  }
}

export class Transaction {
  id: string;
  continuable: boolean;
  currentPending?: Promise<void>;
  next?: Transaction;
  parent?: Transaction;

  constructor(id: string, continuable = true) {
    this.id = id;
    this.continuable = continuable;
  }

  then(cb: () => Promise<void>) {
    if (!this.next) {
      this.next = new Transaction(this.id, false);
      this.next.parent = this;
    }
    if (!this.currentPending && this.continuable) {
      this.continuable = false;
      this.next.continuable = false;
      this.currentPending = cb().then(() => {
        this.currentPending = undefined;
        if (this.next) {
          this.next.continuable = true;
        }
      });
    }
    return this.next;
  }

  end() {
    if (!this.continuable) {
      return;
    }

    let parent: Transaction | undefined = this.parent;
    if (!parent) {
      // Root parent should be true.
      this.continuable = true;
      return;
    }

    this.continuable = false;

    while (true) {
      if (!parent.parent) {
        break;
      }
      parent = parent.parent;
    }
    parent.continuable = true;
  }
}
