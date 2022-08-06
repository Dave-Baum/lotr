import * as DATA from '../../data/data.json';

import {assertValid} from './common/util.js';

const CARDS = new Map(DATA.cards.map(c => [c.id, c]));
const SCENARIOS = new Map(DATA.scenarios.map(s => [s.id, s]));

const staging = assertValid(document.getElementById('staging'));
const location = assertValid(document.getElementById('location'));
const engaged1 = assertValid(document.getElementById('engaged1'));
const engaged2 = assertValid(document.getElementById('engaged2'));
const gallery = assertValid(document.getElementById('gallery'));
const quest = assertValid(document.getElementById('quest'));

let selectedCard: Element|null = null;
const questStack: string[] = [];

document.addEventListener('keydown', (event) => {
  if (event.repeat) {
    return;
  }
  switch (event.key) {
    case 'd':
    case 'D':
      if (selectedCard) {
        selectedCard.classList.remove('select');
        selectedCard.remove();
        selectedCard = null;
      }
      break;
    case '1':
      if (selectedCard) {
        selectedCard.remove();
        engaged1.appendChild(selectedCard);
      }
      break;
    case '2':
      if (selectedCard) {
        selectedCard.remove();
        engaged2.appendChild(selectedCard);
      }
      break;
    case 't':
    case 'T':
      if (selectedCard) {
        selectedCard.remove();
        location.appendChild(selectedCard);
      }
      break;
    default:
      break;
  }
});


function updateQuest(): void {
  quest.setAttribute('src', questStack[questStack.length - 1]);
}

quest.addEventListener('click', () => {
  if (questStack.length > 1) {
    questStack.pop();
    updateQuest();
  }
});

function provideCards(scenarioName: string): void {
  const scenario = assertValid(SCENARIOS.get(scenarioName));
  const sortedCards = [];
  for (const id of Object.keys(scenario.encounters)) {
    sortedCards.push(assertValid(CARDS.get(id)));
  }
  sortedCards.sort((a, b) => a.name.localeCompare(b.name));
  for (const card of sortedCards) {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(card.name));
    gallery.appendChild(div);
    div.addEventListener('click', () => {
      playCard(card.id);
    });
  }

  for (const quest of scenario.quests) {
    const card = assertValid(CARDS.get(quest));
    questStack.unshift(card.image);
    questStack.unshift(assertValid(card.imageB));
  }
  updateQuest();
}

// provideCards('Into-the-Pit');
provideCards('Passage-Through-Mirkwood');
const inPlay: string[] = [];

function playCard(id: string): void {
  const div = document.createElement('div');
  div.classList.add('card');
  const img = document.createElement('img');
  const card = assertValid(CARDS.get(id));
  img.setAttribute('src', card.image);
  img.classList.add('card-image');
  div.appendChild(img);
  staging.appendChild(div);
  div.addEventListener('click', (event) => {
    if (div === selectedCard) {
      return;
    }
    if (selectedCard) {
      selectedCard.classList.remove('select');
    }
    selectedCard = div;
    div.classList.add('select');
  });
}
const _global = (window /* browser */ || global /* node */) as any;

class Piece {
  private loaded = false;
  public x: number;
  public y: number;
  private width: number;
  private height: number;
  private image: HTMLImageElement;

  constructor(src: string) {
    this.x = 0;
    this.y = 0;
    this.width = 200;
    this.height = 300;
    this.image = new Image();
    this.image.src = src;
    this.image.onload = drawBoard;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.drawImage(this.image, this.x, this.y, this.width, this.height);
    if (this === selectedPiece) {
      ctx.strokeStyle = '#f5f5d7';
      ctx.lineWidth = 10;
      ctx.strokeRect(this.x - 5, this.y - 5, this.width + 10, this.height + 10);
    }
  }

  drawEnlarged(ctx: CanvasRenderingContext2D): void {
    const r = (ENLARGED_SCALE - 1.0) / 2;
    ctx.drawImage(
        this.image, this.x - r * this.width, this.y - r * this.height,
        this.width * ENLARGED_SCALE, this.height * ENLARGED_SCALE);
  }

  contains(x: number, y: number): boolean {
    return x >= this.x && y >= this.y && x < (this.x + this.width) &&
        y < (this.y + this.height);
  }
}

const canvas =
    assertValid(document.getElementById('area')) as HTMLCanvasElement;

const pieces = [
  new Piece(
      'https://s3.amazonaws.com/hallofbeorn-resources/Images/Cards/The-Hills-of-Emyn-Muil-Nightmare/Tunneling-Nameless-Thing.jpg'),
  new Piece(DATA.cards[0].image),

];

const ENLARGED_SCALE = 1.3;

let selectedPiece: Piece|null = null;
let enlargedPiece: Piece|null = null;
let dragging = false;
let dragOffsetX = 0;
let dragOffsetY = 0;
let lastX = 0;
let lastY = 0;

function findPiece(x: number, y: number): Piece|null {
  for (let i = pieces.length - 1; i >= 0; i--) {
    if (pieces[i].contains(x, y)) {
      return pieces[i];
    }
  }
  return null;
};

function drawBoard(): void {
  const ctx = assertValid(canvas.getContext('2d'));
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (const p of pieces) {
    p.draw(ctx);
  }
  if (enlargedPiece) {
    enlargedPiece.drawEnlarged(ctx);
  }
}

canvas.addEventListener('mousedown', event => {
  const x = event.offsetX;
  const y = event.offsetY;
  lastX = x;
  lastY = y;
  const piece = findPiece(x, y);
  if (!piece) {
    return;
  }
  selectedPiece = piece;
  dragging = true;
  enlargedPiece = null;
  dragOffsetX = x - piece.x;
  dragOffsetY = y - piece.y;

  if (piece) {
    selectedPiece = piece;
  }
});

canvas.addEventListener('mousemove', event => {
  const x = event.offsetX;
  const y = event.offsetY;
  lastX = x;
  lastY = y;
  if (dragging) {
    const p = assertValid(selectedPiece);
    p.x = x - dragOffsetX;
    p.y = y - dragOffsetY;
    drawBoard();
    return;
  }
  checkEnlarge(event.shiftKey);
});

function checkEnlarge(shiftKey: boolean): void {
  if (shiftKey) {
    const p = findPiece(lastX, lastY);
    if (p !== enlargedPiece) {
      enlargedPiece = p;
      drawBoard();
    }
  } else if (enlargedPiece) {
    enlargedPiece = null;
    drawBoard();
  }
}

canvas.addEventListener('mouseup', event => {
  dragging = false;
});

canvas.addEventListener('keydown', event => {
  checkEnlarge(event.shiftKey);
});

canvas.addEventListener('keyup', event => {
  checkEnlarge(event.shiftKey);
});

drawBoard();