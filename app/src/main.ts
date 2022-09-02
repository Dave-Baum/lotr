import {io, Socket} from 'socket.io-client';

import {Adjustment, ClientToServerEvents, Destination, NotifyMessage, PostMessage, ServerToClientEvents, SymmetricMessage} from './commands';
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
    id => submitMessage({kind: 'play', uid: generateUid(), id}));

enum Mode {
  IDLE = 'idle',
  HOSTING = 'hosting',  // Also includes local play
  JOINING = 'joining',
  JOINED = 'joined',
}

let mode: Mode = Mode.IDLE;
let socket: Socket<ServerToClientEvents, ClientToServerEvents>|undefined;
let nextUid = 1;

type PostKind = PostMessage['kind'];
type NotifyKind = NotifyMessage['kind'];
type Handler<M> = (m: M) => void;

type MessageTypes = {
  [M in PostMessage | NotifyMessage as M['kind']]: M;
};
type PostDispatch = {
  [M in PostMessage as M['kind']]: Handler<M>;
};
type NotifyDispatch = {
  [M in NotifyMessage as M['kind']]: Handler<M>;
};

const postDispatch: Partial<PostDispatch> = {};
const notifyDispatch: Partial<NotifyDispatch> = {};
const joiningMessages = new Set<NotifyKind>();

function definePost<K extends keyof PostDispatch>(
    kind: K, handler: PostDispatch[K]): void {
  postDispatch[kind] = handler;
}

function defineNotify<K extends NotifyKind>(
    kind: K, handler: NotifyDispatch[K]): void {
  notifyDispatch[kind] = handler;
}

function defineSymmetric<K extends SymmetricMessage['kind']>(
    kind: K, handler: Handler<MessageTypes[K]>): void {
  definePost<K>(kind, (m: SymmetricMessage) => {
    handler(m as any);
    if (socket) {
      socket.emit('notify', m);
    }
  });
  defineNotify(kind, handler as any);
}

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
  if (mode !== Mode.HOSTING) {
    return;
  }
  const h = postDispatch[message.kind] as Handler<PostMessage>;
  if (!h) {
    throw new Error(`No handler for post ${message.kind}`);
  }
  h(message);
}

function handleNotify(message: NotifyMessage): void {
  console.log('notify', message);
  const h = notifyDispatch[message.kind] as Handler<NotifyMessage>;
  if (!h) {
    throw new Error(`No handler for notify ${message.kind}`);
  }
  if (mode === Mode.JOINED ||
      (mode === Mode.JOINING && joiningMessages.has(message.kind))) {
    h(message);
  }
}

definePost('state_p', m => {
  assertValid(socket).emit('notify', {
    kind: 'state_n',
    gallery: gallery.getIds(),
    deck: deck.getState(),
    playmat: playmat.getState(),
  });
});

defineNotify('state_n', m => {
  if (mode !== Mode.JOINING) {
    return;
  }
  gallery.setIds(m.gallery);
  deck.setState(m.deck);
  playmat.setState(m.playmat);
  update();
  mode = Mode.JOINED;
});
joiningMessages.add('state_n');

defineSymmetric('adjust', m => {
  playmat.adjustCard(m.uid, m.adjustment, m.amount);
  update();
});

defineSymmetric('remove', m => {
  const id = playmat.removeCard(m.uid);
  if (id) {
    deck.add(id, m.destination);
    update();
  }
});

defineSymmetric('move', m => {
  playmat.moveCard(m.uid, m.point);
  update();
});

defineSymmetric('play', m => {
  if (!m.uid) {
    m.uid = generateUid();
  }
  if (!m.point) {
    m.point = playmat.getPlayPoint();
  }
  let id;
  if (m.id) {
    if (deck.pick(m.id)) {
      id = m.id;
    }
  } else {
    id = deck.reveal();
  }
  if (id) {
    playmat.play(m.uid, id, m.point, !!m.shadow);
  }
  update();
});

definePost('shuffle_p', m => {
  deck.shuffle(m.includeDiscard);
  if (socket) {
    socket.emit('notify', {kind: 'shuffle_n', deck: deck.getState()});
  }
  update();
});

defineNotify('shuffle_n', m => {
  deck.setState(m.deck);
  update();
});

definePost('play_discards_p', m => {
  // TODO: Add an ability to explicitly play a card from the discard pile.
  while (true) {
    const id = deck.peekDiscard();
    if (!id) {
      break;
    }
    // This relies on the fact that deck.pick() checks discards before
    // the draw pile.
    submitMessage({kind: 'play', uid: 0, id});
  }
  update();
});

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
  submitMessage({kind: 'play', uid: generateUid()});
});

shadowButton.addEventListener('click', () => {
  submitMessage({kind: 'play', uid: generateUid(), shadow: true});
});

shuffleButton.addEventListener('click', () => {
  submitMessage({kind: 'shuffle_p', includeDiscard: false});
});

refreshButton.addEventListener('click', () => {
  submitMessage({kind: 'shuffle_p', includeDiscard: true});
});

putTopButton.addEventListener('click', () => {
  removeCard('top');
});

putBottomButton.addEventListener('click', () => {
  removeCard('bottom');
});

showDiscardButton.addEventListener('click', () => {
  submitMessage({kind: 'play_discards_p'});
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

export function submitMessage(message: PostMessage): void {
  switch (mode) {
    case Mode.HOSTING:
      handlePost(message);
      break;
    case Mode.JOINED:
    case Mode.JOINING:
      assertValid(socket).emit('post', message);
      break;
    default:
      // Ignore the command
      break;
  }
}

function adjustCard(adjustment: Adjustment, amount: number): void {
  const uid = playmat.selectedUid();
  if (uid) {
    submitMessage({kind: 'adjust', uid, adjustment, amount});
  }
}

function removeCard(destination: Destination): void {
  const uid = playmat.selectedUid();
  if (uid) {
    submitMessage({kind: 'remove', uid, destination});
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
      mode = Mode.HOSTING;
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
