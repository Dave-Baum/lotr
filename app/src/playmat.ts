import {Adjustment, PieceState, Point} from 'commands';

import {assertValid} from './common/util';
import {getCard} from './database';
import {imageCache} from './image_cache';
import {submitMessage} from './main';

const CARD_WIDTH = 240;
const CARD_HEIGHT = CARD_WIDTH * 7 / 5;
const PLAY_FIRST_X = 20;
const PLAY_FIRST_Y = 10;
const PLAY_DELTA_X = 20;
const PLAY_DELTA_Y = 10;
const QUEST_X = 840;
const QUEST_Y = 10;
const COUNTER_RADIUS = 20;
const COUNTER_PAD = 5;
const SELECT_COLOR = '#f5f5d7';
const COUNTER_COLOR = '#caedcd';
const COUNTER_FONT = '20px Arial';
const ENCOUNTER_IMAGE = 'encounter.webp';

const ZOOMED_RATE = 0.004;
const ZOOMED_MAX_SCALE = 0.5;

abstract class Piece {
  private counter = 0;
  private phase = 0;
  private zoom = 0;
  private zoomStartTime = 0;
  private zoomStartValue = 0;
  private zoomDirection = 0;

  constructor(
      readonly uid: number, private readonly images: HTMLImageElement[],
      public x: number, public y: number, private readonly width: number,
      private readonly height: number) {}

  abstract getState(): PieceState;

  protected createState(kind: 'encounter'|'quest'|'shadow', cards: string[]):
  PieceState{
    return {
      kind, cards, uid: this.uid, x: this.x, y: this.y, phase: this.phase,
          counter: this.counter,
    }
  };

  abstract discardId(): string|null;

  needsAnimation(): boolean {
    return this.zoomDirection !== 0;
  }

  adjustZoom(): number {
    if (this.zoomDirection) {
      let zoom = this.zoomStartValue +
          (Date.now() - this.zoomStartTime) * ZOOMED_RATE * this.zoomDirection;
      if (zoom < 0) {
        zoom = 0;
        this.zoomDirection = 0;
      } else if (zoom > ZOOMED_MAX_SCALE) {
        zoom = ZOOMED_MAX_SCALE;
        this.zoomDirection = 0;
      }
      this.zoom = zoom;
    }
    return this.zoom;
  }

  draw(ctx: CanvasRenderingContext2D, selected: boolean): void {
    this.drawImage(ctx);
    if (this.zoom) {
      return;
    }

    if (this.counter) {
      const offset = COUNTER_RADIUS + COUNTER_PAD;
      const counterX = this.x + this.width - offset;
      const counterY = this.y + offset;
      ctx.fillStyle = COUNTER_COLOR;
      ctx.beginPath();
      ctx.arc(counterX, counterY, COUNTER_RADIUS, 0, Math.PI * 2);
      ctx.closePath();
      ctx.fill();
      const text = `${this.counter}`;
      ctx.fillStyle = 'black';
      ctx.font = COUNTER_FONT;
      const metrics = ctx.measureText(text);
      const baselineAdjust =
          (metrics.actualBoundingBoxAscent - metrics.actualBoundingBoxDescent) /
          2;
      ctx.fillText(
          text, counterX - metrics.width / 2, counterY + baselineAdjust);
    }

    if (selected) {
      ctx.strokeStyle = SELECT_COLOR;
      ctx.lineWidth = 10;
      ctx.strokeRect(this.x - 5, this.y - 5, this.width + 10, this.height + 10);
    }
  }

  private drawImage(ctx: CanvasRenderingContext2D): void {
    const r = this.zoom / 2;
    ctx.drawImage(
        this.images[this.phase], this.x - r * this.width,
        this.y - r * this.height, this.width * (1 + this.zoom),
        this.height * (1 + this.zoom));
  }

  contains(x: number, y: number): boolean {
    return x >= this.x && y >= this.y && x < (this.x + this.width) &&
        y < (this.y + this.height);
  }

  adjustCounter(amount: number): void {
    this.counter = Math.max(this.counter + amount, 0);
  }

  adjustPhase(amount: number): void {
    this.phase =
        Math.min(Math.max(this.phase + amount, 0), this.images.length - 1);
    this.counter = 0;
  }

  setZoomDirection(direction: number): void {
    if (this.zoomDirection === direction) {
      return;
    }
    this.zoomDirection = direction;
    if (direction) {
      this.zoomStartTime = Date.now();
      this.zoomStartValue = this.zoom;
    }
  }
}

function getEncounterImages(id: string, shadow: boolean) {
  const images = [];
  if (shadow) {
    images.push(imageCache.get(ENCOUNTER_IMAGE));
  }
  images.push(imageCache.get(getCard(id).image));
  return images;
}

class EncounterPiece extends Piece {
  constructor(
      uid: number, private readonly id: string,
      private readonly shadow: boolean, x: number, y: number) {
    super(uid, getEncounterImages(id, shadow), x, y, CARD_WIDTH, CARD_HEIGHT);
  }

  discardId(): string|null {
    return this.id;
  }

  getState(): PieceState {
    return this.createState(this.shadow ? 'shadow' : 'encounter', [this.id]);
  }
}

class QuestPiece extends Piece {
  private cardIds: string[];

  constructor(uid: number, cardIds: string[], x: number, y: number) {
    const images = [];
    for (const id of cardIds) {
      const card = getCard(id);
      images.push(imageCache.get(card.image));
      images.push(imageCache.get(assertValid(card.imageB)));
    }
    super(uid, images, x, y, CARD_HEIGHT, CARD_WIDTH);
    this.cardIds = cardIds;
  }

  getState(): PieceState {
    return this.createState('quest', this.cardIds);
  }

  discardId(): string|null {
    return null;
  }
}

export class Playmat {
  private pieces: Piece[] = [];
  private playX = 0;
  private playY = 0;
  private modified = false;
  private selectedPiece: Piece|null = null;
  private dragging = false;
  private dragOffsetX = 0;
  private dragOffsetY = 0;
  private foundPiece: Piece|null = null;
  private zoomedPiece: Piece|null = null;
  private shiftKey = false;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.canvas.addEventListener('mousedown', event => {
      this.mouseDown(event.offsetX, event.offsetY);
      this.update();
    });
    this.canvas.addEventListener('mousemove', event => {
      this.mouseMove(event.offsetX, event.offsetY);
      this.update();
    });
    this.canvas.addEventListener('mouseup', event => {
      this.mouseUp(event.offsetX, event.offsetY);
      this.update();
    });
    this.canvas.addEventListener('mouseleave', event => {
      this.dragging = false;
    });

    const resizeObserver = new ResizeObserver(entries => {
      const bounds = this.canvas.getBoundingClientRect();
      this.canvas.width = bounds.width;
      this.canvas.height = bounds.height;
      this.update(true);
    });
    resizeObserver.observe(this.canvas);
  }

  getState(): PieceState[] {
    return this.pieces.map(p => p.getState());
  }

  setState(state: PieceState[]): void {
    this.clear();
    for (const s of state) {
      let p: Piece;
      if (s.kind === 'quest') {
        p = new QuestPiece(s.uid, s.cards, s.x, s.y);
      } else {
        p = new EncounterPiece(
            s.uid, s.cards[0], s.kind === 'shadow', s.x, s.y);
      }
      p.adjustPhase(s.phase);
      p.adjustCounter(s.counter);
      this.pieces.push(p);
    }
    this.modified = true;
  }

  clear(): void {
    this.pieces.splice(0, this.pieces.length);
    this.selectedPiece = null;
    this.foundPiece = null;
    this.zoomedPiece = null;
    this.dragging = false;
    this.modified = true;
    this.playX = 0;
    this.playY = 0;
  }

  selectedUid(): number|undefined {
    return this.selectedPiece?.uid;
  }

  adjustCard(uid: number, adjustment: Adjustment, amount: number): void {
    const piece = this.lookup(uid);
    if (!piece) {
      return;
    }

    switch (adjustment) {
      case 'counter':
        piece.adjustCounter(amount);
        break;
      case 'phase':
        piece.adjustPhase(amount);
        break;
      case 'order':
        const i = this.pieces.indexOf(piece);
        this.pieces.splice(i, 1);
        if (amount > 0) {
          this.pieces.push(piece);
        } else {
          this.pieces.unshift(piece);
        }
        break;
      default:
        throw new Error(`invalid adjustment ${adjustment}`);
    }
    this.modified = true;
    return;
  }

  removeCard(uid: number): string|undefined {
    const piece = this.lookup(uid);
    if (!piece) {
      return;
    }
    const id = piece.discardId();
    if (!id) {
      return;
    }
    const i = this.pieces.indexOf(piece);
    this.pieces.splice(i, 1);
    if (this.selectedPiece === piece) {
      this.selectedPiece =
          this.pieces.length ? this.pieces[this.pieces.length - 1] : null;
    }
    this.modified = true;
    return id;
  }

  moveCard(uid: number, point: Point) {
    const piece = this.lookup(uid);
    if (!piece) {
      return;
    }
    piece.x = point.x;
    piece.y = point.y;
    this.modified = true;
  }

  private lookup(uid: number): Piece|undefined {
    // TODO: use a map for faster uid lookup
    for (const p of this.pieces) {
      if (p.uid === uid) {
        return p;
      }
    }
    return;
  }

  isEncounterSelected(): boolean {
    return !!(this.selectedPiece && this.selectedPiece.discardId());
  }

  setQuest(uid: number, questIds: string[]): void {
    this.pieces.push(new QuestPiece(uid, questIds, QUEST_X, QUEST_Y));
    this.modified = true;
  }

  getPlayPoint(): Point {
    let x;
    let y;
    if (this.findPiece(PLAY_FIRST_X, PLAY_FIRST_Y)) {
      x = this.playX + PLAY_DELTA_X;
      y = this.playY + PLAY_DELTA_Y;
    } else {
      x = PLAY_FIRST_X;
      y = PLAY_FIRST_Y;
    }
    return {x, y};
  }

  play(uid: number, id: string, point: Point, faceDown = false): void {
    this.playX = point.x;
    this.playY = point.y;
    const p = new EncounterPiece(uid, id, faceDown, point.x, point.y);
    if (faceDown) {
      this.pieces.unshift(p);
    } else {
      this.pieces.push(p);
    }
    this.selectedPiece = p;
    this.modified = true;
  }

  update(force = false): void {
    if (!this.modified && !force) {
      return;
    }
    const ctx = assertValid(this.canvas.getContext('2d'));
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    const onTop = [];
    let needsAnimation = false;
    for (const p of this.pieces) {
      if (p.adjustZoom()) {
        onTop.push(p);
      } else {
        p.draw(ctx, p === this.selectedPiece);
      }
      if (p.needsAnimation()) {
        needsAnimation = true;
      }
    }
    for (const p of onTop) {
      p.draw(ctx, false);
    }
    if (needsAnimation) {
      setTimeout(() => {
        this.update(true);
      }, 15);
    }

    this.modified = false;
  }

  private findPiece(x: number, y: number): Piece|null {
    for (let i = this.pieces.length - 1; i >= 0; i--) {
      if (this.pieces[i].contains(x, y)) {
        return this.pieces[i];
      }
    }
    return null;
  }

  private mouseDown(x: number, y: number): void {
    this.foundPiece = this.findPiece(x, y);
    if (!this.foundPiece) {
      this.selectedPiece = null;
      this.modified = true;
      return;
    }
    this.selectedPiece = this.foundPiece;
    this.modified = true;
    this.dragging = true;
    this.dragOffsetX = x - this.foundPiece.x;
    this.dragOffsetY = y - this.foundPiece.y;
  }

  private mouseMove(x: number, y: number): void {
    if (this.dragging) {
      const p = assertValid(this.selectedPiece);
      p.x = x - this.dragOffsetX;
      p.y = y - this.dragOffsetY;
      this.modified = true;
    }
    this.foundPiece = this.findPiece(x, y);
    this.checkZoom();
  }

  private mouseUp(x: number, y: number): void {
    if (!this.dragging || !this.selectedPiece) {
      return;
    }
    // TODO: this seam is uneven with how changes are applied
    submitMessage({
      kind: 'move',
      uid: this.selectedPiece.uid,
      point: {
        x: x - this.dragOffsetX,
        y: y - this.dragOffsetY,
      },
    });
    this.dragging = false;
  }

  setShiftKey(shiftKey: boolean): void {
    this.shiftKey = shiftKey;
    this.checkZoom();
  }

  private checkZoom(): void {
    const newZoom = (!this.dragging && this.shiftKey) ? this.foundPiece : null;
    if (newZoom !== this.zoomedPiece) {
      this.zoomedPiece?.setZoomDirection(-1);
      this.zoomedPiece = newZoom;
      newZoom?.setZoomDirection(1);
      this.modified = true;
    }
  }
}
