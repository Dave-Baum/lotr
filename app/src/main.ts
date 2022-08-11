import {io, Socket} from 'socket.io-client';

import {Adjustment, ClientToServerEvents, Command, Destination, NotifyMessage, PostMessage, ServerToClientEvents} from './commands';
import {assertValid} from './common/util';
import {CARDS, getScenario} from './database';
import {Deck} from './deck';
import {Gallery} from './gallery';
import {imageCache} from './image_cache';
import {Playmat} from './playmat';
import {initStartScreen} from './start';
import {getElement, online} from './util';

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
const gallery = new Gallery(
    getElement('gallery'),
    id => queueCommand({kind: 'play', uid: generateUid(), id}));

enum Mode {
  IDLE = 'idle',
  HOSTING = 'hosting',
  JOINING = 'joining',
  JOINED = 'joined',
}

let mode: Mode = Mode.IDLE;
let socket: Socket<ServerToClientEvents, ClientToServerEvents>|undefined;
let nextUid = 1;

function generateUid(): number {
  return mode === Mode.HOSTING ? nextUid++ : 0;
}

function connectToServer(room: string, host: boolean) {
  if (!online) {
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
    socket.emit('post', {kind: 'state_p'});
  }
}

function handlePost(message: PostMessage): void {
  console.log('post', message);
  if (!socket || mode !== Mode.HOSTING) {
    return;
  }
  switch (message.kind) {
    case 'state_p':
      socket.emit('notify', {
        kind: 'state_n',
        gallery: gallery.getIds(),
        deck: deck.getState(),
        playmat: playmat.getState(),
      });
      break;
    case 'adjust':
    case 'remove':
    case 'move':
      queueCommand(message);
      break;
    case 'play':
      message.uid = generateUid();
      queueCommand(message);
      break;
  }
}

function handleNotify(message: NotifyMessage): void {
  console.log('notify', message);
  if (mode === Mode.JOINING) {
    if (message.kind === 'state_n') {
      gallery.setIds(message.gallery);
      deck.setState(message.deck);
      playmat.setState(message.playmat);
      update();
      mode = Mode.JOINED;
    }
  } else if (mode === Mode.JOINED) {
    switch (message.kind) {
      case 'adjust':
      case 'remove':
      case 'move':
      case 'play':
        handleCommand(message);
        break;
    }
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


revealButton.addEventListener('click', () => {
  queueCommand({kind: 'play', uid: generateUid()});
});

shadowButton.addEventListener('click', () => {
  queueCommand({kind: 'play', uid: generateUid(), shadow: true});
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
    playmat.play(nextUid++, id, false);
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

  playmat.setQuest(nextUid++, scenario.quests);
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
    case 'move':
      playmat.moveCard(command.uid, command.x, command.y);
      break;
    case 'play': {
      let id;
      if (command.id) {
        if (deck.pick(command.id)) {
          id = command.id;
        }
      } else {
        id = deck.reveal();
      }
      if (id) {
        playmat.play(command.uid, id, !!command.shadow);
      }
      break;
    }
    default:
      throw new Error(`invalid command: ${command}`);
  }
  update();
}

export function queueCommand(command: Command): void {
  switch (mode) {
    case Mode.HOSTING:
      handleCommand(command);
      assertValid(socket).emit('notify', command);
      break;
    case Mode.JOINED:
    case Mode.JOINING:
      assertValid(socket).emit('post', command);
      break;
    default:
      // Ignore the command
      break;
  }
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
  nextUid = 1;
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
    getElement('start-tab').classList.remove('hide');
    getElement('game-tab').classList.add('hide');
    mode = Mode.IDLE;
  } else {
    getElement('start-tab').classList.add('hide');
    getElement('game-tab').classList.remove('hide');
    if (room) {
      connectToServer(room, !!scenario);
    }
    if (scenario) {
      startScenario(scenario);
    }
  }
}

export function navigateTo(params: {scenario?: string, room?: string}): void {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) {
      query.set(key, value);
    }
  }
  window.history.pushState({}, '', '?' + query.toString());
  routeToPage();
}

addEventListener('popstate', e => {
  routeToPage();
});

initStartScreen();
routeToPage();
