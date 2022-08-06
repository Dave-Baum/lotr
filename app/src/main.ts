import {assertValid} from './common/util';
import {CAMPAIGNS, CARDS, getScenario, SCENARIOS} from './database';
import {Deck, DeckPosition} from './deck';
import {imageCache} from './image_cache';
import {Order, Playmat} from './playmat';

const gallery = getElement('gallery');
const help = getElement('help');
const mat = getElement('mat') as HTMLCanvasElement;
const supplyCount = getElement('supply-count');
const discardCount = getElement('discard-count');
const revealButton = getElement('reveal-button') as HTMLButtonElement;
const shadowButton = getElement('shadow-button') as HTMLButtonElement;
const shuffleButton = getElement('shuffle-button') as HTMLButtonElement;
const refreshButton = getElement('refresh-button') as HTMLButtonElement;

const putTopButton = getElement('put-top-button') as HTMLButtonElement;
const putBottomButton = getElement('put-bottom-button') as HTMLButtonElement;

const deck = new Deck();
const playmat = new Playmat(mat);

console.log('Running main.ts');

function getElement(id: string): Element {
  return assertValid(document.getElementById(id));
}

function buildScenarioPicker(): void {
  const choices = [];
  for (const campaign of CAMPAIGNS.values()) {
    choices.push(`<h3>${campaign.name}</h3>`);
    for (const id of campaign.scenarios) {
      const scenario = getScenario(id);
      choices.push(`<div><a href="#${scenario.id}">${scenario.name}</a></div>`);
    }
  }
  getElement('scenario-list').innerHTML = choices.join('\n');
}

function update() {
  updateDeck();

  revealButton.disabled = deck.drawCount() === 0;
  shadowButton.disabled = deck.drawCount() === 0;
  shuffleButton.disabled = deck.drawCount() === 0;
  refreshButton.disabled = deck.drawCount() === 0 && deck.discardCount() === 0;
  putTopButton.disabled = !playmat.isEncounterSelected();
  putBottomButton.disabled = !playmat.isEncounterSelected();
  playmat.update();
}

imageCache.setLoadDoneCallback(() => {
  playmat.update(true);
});

function revealCard(faceDown: boolean) {
  const id = deck.reveal();
  if (id) {
    playmat.play(id, faceDown);
  }
}

revealButton.addEventListener('click', () => {
  revealCard(false);
  update();
});

shadowButton.addEventListener('click', () => {
  revealCard(true);
  update();
});

shuffleButton.addEventListener('click', () => {
  deck.shuffle(false);
  update();
});
refreshButton.addEventListener('click', () => {
  deck.shuffle(true);
  update();
});

putTopButton.addEventListener('click', () => {
  playmat.returnToDeck(deck, DeckPosition.TOP);
  update();
});

putBottomButton.addEventListener('click', () => {
  playmat.returnToDeck(deck, DeckPosition.BOTTOM);
  update();
});

getElement('help-button').addEventListener('click', () => {
  help.classList.remove('hide');
});

help.addEventListener('click', () => {
  help.classList.add('hide');
});

function updateGallery(): void {
  for (const child of gallery.childNodes) {
    const el = child as HTMLElement;
    const count = deck.getCount(assertValid(el.dataset['cardId']));
    console.log(count);
    if (count) {
      el.classList.remove('disabled');
    } else {
      console.log('hiding');
      el.classList.add('disabled');
    }
  }
}

function updateDeck(): void {
  if (!deck.checkModified()) {
    return;
  }
  supplyCount.innerHTML = `${deck.drawCount()}`;
  discardCount.innerHTML = `${deck.discardCount()}`;
  updateGallery();
}

function provideCards(scenarioId: string): void {
  const scenario = getScenario(scenarioId);
  const sortedCards = [];
  for (const [id, count] of Object.entries(scenario.encounters)) {
    sortedCards.push(assertValid(CARDS.get(id)));
    deck.add(id, DeckPosition.TOP, count);
  }
  deck.shuffle();

  gallery.innerHTML = '';
  sortedCards.sort((a, b) => a.name.localeCompare(b.name));
  for (const card of sortedCards) {
    // prefetch the card image
    imageCache.get(card.image);

    const div = document.createElement('div');
    div.dataset['cardId'] = card.id;
    div.appendChild(document.createTextNode(card.name));
    gallery.appendChild(div);
    div.addEventListener('click', () => {
      if (deck.pick(card.id)) {
        playmat.play(card.id);
      }
      update();
    });
  }

  playmat.setQuest(scenario.quests);
}

document.addEventListener('keydown', event => {
  playmat.setShiftKey(event.shiftKey);
  if (!event.repeat) {
    switch (event.key) {
      case 'Backspace':
        playmat.returnToDeck(deck, DeckPosition.DISCARD);
        break;
      case '[':
        playmat.changeOrder(Order.BOTTOM);
        break;
      case ']':
        playmat.changeOrder(Order.TOP);
        break;
      case '=':
        playmat.adjustCounter(1);
        break;
      case '-':
        playmat.adjustCounter(-1);
        break;
      case '.':
      case ' ':
        playmat.adjustPhase(1);
        break;
      case ',':
        playmat.adjustPhase(-1);
        break;
      default:
        break;
    }
  }
  update();
});

document.addEventListener('keyup', event => {
  playmat.setShiftKey(event.shiftKey);
  update();
});

function startScenario(id: string): void {
  deck.clear();
  playmat.clear();
  provideCards(id);
  update();
}

function routeToPage(): void {
  const hash = window.location.hash;
  if (hash) {
    getElement('scenario-tab').classList.add('hide');
    getElement('game-tab').classList.remove('hide');
    startScenario(hash.slice(1));
  } else {
    getElement('scenario-tab').classList.remove('hide');
    getElement('game-tab').classList.add('hide');
  }
}

buildScenarioPicker();

window.onhashchange = routeToPage;
routeToPage();
