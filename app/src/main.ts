import {io, Socket} from 'socket.io-client';

import {Adjustment, Command, Destination} from './commands';
import {assertValid} from './common/util';
import {CAMPAIGNS, CARDS, getCard, getScenario} from './database';
import {Deck} from './deck';
import {Gallery} from './gallery';
import {imageCache} from './image_cache';
import {Playmat} from './playmat';

console.log('Running main.ts');

const help = getElement('help');
const mat = getElement('mat') as HTMLCanvasElement;
const supplyCount = getElement('supply-count');
const discardCount = getElement('discard-count');
const revealButton = getElement('reveal-button') as HTMLButtonElement;
const shadowButton = getElement('shadow-button') as HTMLButtonElement;
const shuffleButton = getElement('shuffle-button') as HTMLButtonElement;
const refreshButton = getElement('refresh-button') as HTMLButtonElement;
const showDiscardButton =
    getElement('show-discard-button') as HTMLButtonElement;
const putTopButton = getElement('put-top-button') as HTMLButtonElement;
const putBottomButton = getElement('put-bottom-button') as HTMLButtonElement;

const deck = new Deck();
const playmat = new Playmat(mat);
const gallery = new Gallery(getElement('gallery'), playCard);

enum Mode {
  IDLE = 'idle',
  HOSTING = 'hosting',
  JOINING = 'joining',
  JOINED = 'joined',
}

const localOnly = window.location.protocol === 'file:';
let mode: Mode = Mode.IDLE;
let socket: Socket|undefined;

function connectToServer(room: string, host: boolean) {
  if (localOnly) {
    throw new Error('Sockets are not allowed when running from files');
  }
  socket = io();
  socket.on('post', handlePost);
  socket.on('notify', handleNotify);
  console.log('Socket.io initialized');
  socket.emit('join', {room, host: host ? 1 : 0});
  if (host) {
    mode = Mode.HOSTING;
  } else {
    mode = Mode.JOINING;
    socket.emit('post', {kind: 'state'});
  }
}

function handlePost(message: any): void {
  // TODO: add type safety
  console.log('post!!!', message);
  if (!socket || mode !== Mode.HOSTING) {
    return;
  }
  if (message.kind === 'state') {
    socket.emit('notify', {
      kind: 'state',
      gallery: gallery.getIds(),
      deck: deck.getState(),
      playmat: playmat.getState(),
    });
  }
}

function handleNotify(message: any): void {
  // TODO: add type safety
  console.log('notify', message);
  if (mode === Mode.JOINING) {
    if (message.kind === 'state') {
      gallery.setIds(message.gallery);
      deck.setState(message.deck);
      playmat.setState(message.playmat);
      update();
      mode = Mode.JOINED;
    }
  }
}

function getElement(id: string): Element {
  return assertValid(document.getElementById(id));
}

function playCard(id: string): void {
  if (deck.pick(id)) {
    playmat.play(id);
  }
  update();
}

function setupCollapsibles() {
  for (const c of document.getElementsByClassName('collapsible')) {
    c.addEventListener('click', () => {
      c.classList.toggle('active');
      const content = assertValid(c.nextElementSibling) as HTMLElement;
      if (content.style.display === 'block') {
        content.style.display = 'none';
      } else {
        content.style.display = 'block';
      }
    });
  }
}

function buildScenarioPicker(): void {
  const parts = [];
  for (const campaign of CAMPAIGNS.values()) {
    parts.push(`<div class="collapsible">${campaign.name}</div>`);
    parts.push('<div class="content">');
    for (const id of campaign.scenarios) {
      const scenario = getScenario(id);
      parts.push(`<div class="scenario" data-sid="${scenario.id}">${
          scenario.name}</div>`);
    }
    parts.push('</div>');
  }
  getElement('scenario-list').innerHTML = parts.join('\n');
  setupCollapsibles();
  for (const s of document.getElementsByClassName('scenario')) {
    const el = s as HTMLElement;
    el.addEventListener('click', () => {
      switchToScenario(assertValid(el.dataset['sid']));
    });
  }
}

function update() {
  updateDeck();

  revealButton.disabled = deck.drawCount() === 0;
  shadowButton.disabled = deck.drawCount() === 0;
  shuffleButton.disabled = deck.drawCount() === 0;
  refreshButton.disabled = deck.drawCount() === 0 && deck.discardCount() === 0;
  putTopButton.disabled = !playmat.isEncounterSelected();
  putBottomButton.disabled = !playmat.isEncounterSelected();
  showDiscardButton.disabled = deck.discardCount() === 0;
  playmat.update();
}

imageCache.setLoadDoneCallback(() => {
  console.log('image loading complete');
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
  removeCard('top');
});

putBottomButton.addEventListener('click', () => {
  removeCard('bottom');
});

showDiscardButton.addEventListener('click', () => {
  while (true) {
    const id = deck.popDiscard();
    if (!id) {
      break;
    }
    playmat.play(id, false);
  }
  update();
});

getElement('help-button').addEventListener('click', () => {
  help.classList.remove('hide');
});

help.addEventListener('click', () => {
  help.classList.add('hide');
});

function updateDeck(): void {
  if (!deck.checkModified()) {
    return;
  }
  supplyCount.innerHTML = `${deck.drawCount()}`;
  discardCount.innerHTML = `${deck.discardCount()}`;
  gallery.update(deck);
}

function provideCards(scenarioId: string): void {
  const scenario = getScenario(scenarioId);
  const sortedCards = [];
  for (const [id, count] of Object.entries(scenario.encounters)) {
    sortedCards.push(assertValid(CARDS.get(id)));
    deck.add(id, 'top', count);
  }
  deck.shuffle();

  sortedCards.sort((a, b) => a.name.localeCompare(b.name));
  const sortedIds = sortedCards.map(c => c.id);
  gallery.setIds(sortedIds);

  playmat.setQuest(scenario.quests);
}

function handleCommand(command: Command): void {
  console.log(command);
  switch (command.kind) {
    case 'adjust':
      playmat.adjustCard(command.uid, command.adjustment, command.amount);
      break;
    case 'remove':
      const id = playmat.removeCard(command.uid);
      if (id) {
        deck.add(id, command.destination);
      }
      break;
    default:
      throw new Error(`invalid command: ${command}`);
  }
  update();
}

function queueCommand(command: Command): void {
  handleCommand(command);
}

function adjustCard(adjustment: Adjustment, amount: number): void {
  const uid = playmat.selectedUid();
  if (uid) {
    queueCommand({kind: 'adjust', uid, adjustment, amount});
  }
}

function removeCard(destination: Destination): void {
  const uid = playmat.selectedUid();
  if (uid) {
    queueCommand({kind: 'remove', uid, destination});
  }
}

document.addEventListener('keydown', event => {
  playmat.setShiftKey(event.shiftKey);
  if (event.repeat) {
    return;
  }
  const uid = playmat.selectedUid();
  switch (event.key) {
    case 'Backspace':
      removeCard('discard');
      break;
    case '[':
      adjustCard('order', -1);
      break;
    case ']':
      adjustCard('order', 1);
      break;
    case '=':
      adjustCard('counter', 1);
      break;
    case '-':
      adjustCard('counter', -1);
      break;
    case '.':
    case ' ':
      adjustCard('phase', 1);
      break;
    case ',':
      adjustCard('phase', -1);
      break;
    default:
      break;
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
  const params = new URLSearchParams(window.location.search);
  const scenario = decodeURIComponent(params.get('scenario') || '');
  const room = params.get('room' || '');
  if (!room && !scenario) {
    // selection
    getElement('scenario-tab').classList.remove('hide');
    getElement('game-tab').classList.add('hide');
    mode = Mode.IDLE;
  } else {
    getElement('scenario-tab').classList.add('hide');
    getElement('game-tab').classList.remove('hide');
    if (room) {
      connectToServer(room, !!scenario);
    }
    if (scenario) {
      startScenario(scenario);
    }
  }
}

function switchToScenario(scenario: string): void {
  // TODO: why does this need a cast to any?
  const url = new URL(window.location as any);
  url.searchParams.set('scenario', scenario);
  window.history.pushState({}, '', url.toString());
  routeToPage();
}

addEventListener('popstate', e => {
  routeToPage();
});

buildScenarioPicker();

routeToPage();
