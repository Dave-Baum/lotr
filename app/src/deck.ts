function randomInt(max: number): number {
  return Math.floor(Math.random() * max);
}

export enum DeckPosition {
  TOP,
  BOTTOM,
  DISCARD,
}

export class Deck {
  private readonly drawPile: string[] = [];
  private readonly discardPile: string[] = [];
  private readonly counts = new Map<string, number>();
  private modified = false;

  clear(): void {
    this.drawPile.splice(0, this.drawPile.length);
    this.discardPile.splice(0, this.discardPile.length);
    this.counts.clear();
    this.modified = true;
  }

  private adjustCount(id: string, amount: number): void {
    this.counts.set(id, (this.counts.get(id) || 0) + amount);
  }

  getCount(id: string): number {
    return this.counts.get(id) || 0;
  }

  add(id: string, position: DeckPosition, count = 1): void {
    this.modified = true;
    this.adjustCount(id, count);
    while (count--) {
      switch (position) {
        case DeckPosition.TOP:
          this.drawPile.push(id);
          break;
        case DeckPosition.BOTTOM:
          this.drawPile.unshift(id);
          break;
        case DeckPosition.DISCARD:
          this.discardPile.push(id);
          break;
      }
    }
  }

  reveal(): string|undefined {
    this.modified = true;
    const id = this.drawPile.pop();
    if (id) {
      this.adjustCount(id, 1);
    }
    return id;
  }

  drawCount(): number {
    return this.drawPile.length;
  }

  discardCount(): number {
    return this.discardPile.length;
  }

  shuffle(includeDiscard = false): void {
    this.modified = true;
    if (includeDiscard) {
      while (true) {
        let c = this.discardPile.pop();
        if (!c) {
          break;
        }
        this.drawPile.push(c);
      }
    }

    for (let i = this.drawPile.length - 1; i > 0; i--) {
      const j = randomInt(i);
      if (i !== j) {
        const t = this.drawPile[i];
        this.drawPile[i] = this.drawPile[j];
        this.drawPile[j] = t;
      }
    }
  }

  pick(id: string): boolean {
    const pickFrom = (pile: string[]) => {
      const i = pile.indexOf(id);
      if (i === -1) {
        return false;
      }
      pile.splice(i, 1);
      this.adjustCount(id, -1);
      return true;
    };

    this.modified = true;
    return pickFrom(this.drawPile) || pickFrom(this.discardPile);
  }

  checkModified(): boolean {
    const old = this.modified;
    this.modified = false;
    return old;
  }
}