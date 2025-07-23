export class NamedIndexMap<T extends { name: string }> {
  list: T[] = [];
  indexMap: Record<string, number> = {};

  add(v: T): void {
    this.assertUnique(v.name);
    const idx = this.list.length;
    this.list.push(v);
    this.indexMap[v.name] = idx;
  }

  insertBefore(targetName: string, v: T): number {
    const idx = this.findIndex(targetName);
    return this.insertAt(idx, v);
  }

  insertAfter(targetName: string, v: T): number {
    const idx = this.findIndex(targetName);
    return this.insertAt(idx + 1, v);
  }

  private insertAt(index: number, v: T): number {
    this.assertUnique(v.name);
    if (index < 0 || index > this.list.length) {
      throw new RangeError(`index out of range: ${index}`);
    }

    this.list.splice(index, 0, v);

    for (let i = index; i < this.list.length; i++) {
      this.indexMap[this.list[i].name] = i;
    }

    return index;
  }

  private findIndex(name: string): number {
    const idx = this.indexMap[name];
    if (idx === undefined) {
      throw new Error(`target not found: ${name}`);
    }
    return idx;
  }

  private assertUnique(name: string): void {
    if (this.indexMap[name] !== undefined) {
      throw new Error(`duplicate name: ${name}`);
    }
  }
}
