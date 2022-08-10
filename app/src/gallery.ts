import {assertValid} from './common/util';
import {getCard} from './database';
import {Deck} from './deck';
import {imageCache} from './image_cache';

export class Gallery {
  private ids: string[] = [];

  constructor(
      private readonly element: Element,
      private readonly callback: (id: string) => void) {}

  update(deck: Deck): void {
    for (const child of this.element.childNodes) {
      const el = child as HTMLElement;
      const count = deck.getCount(assertValid(el.dataset['cardId']));
      if (count) {
        el.classList.remove('disabled');
      } else {
        el.classList.add('disabled');
      }
    }
  }

  setIds(cardIds: string[]): void {
    this.ids = cardIds;
    this.element.innerHTML = '';
    for (const id of cardIds) {
      const card = getCard(id);
      // prefetch the card image
      imageCache.get(card.image);

      const div = document.createElement('div');
      div.dataset['cardId'] = card.id;
      div.appendChild(document.createTextNode(card.name));
      this.element.appendChild(div);
      div.addEventListener('click', () => {
        this.callback(card.id);
      });
    }
  }

  getIds(): string[] {
    return this.ids;
  }
}
