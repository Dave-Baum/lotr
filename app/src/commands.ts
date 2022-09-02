export type Adjustment = 'phase'|'counter'|'order';
export type Destination = 'discard'|'top'|'bottom';

export interface Point {
  x: number;
  y: number;
}

export interface AdjustCardMessage {
  kind: 'adjust';
  uid: number;
  adjustment: Adjustment;
  amount: number;
}

export interface RemoveCardMessage {
  kind: 'remove';
  uid: number;
  destination: Destination;
}

export interface MoveCardMessage {
  kind: 'move';
  uid: number;
  point: Point;
}

export interface PlayCardMessage {
  kind: 'play';
  uid: number;
  point?: Point;
  id?: string;
  shadow?: boolean;
}

export interface DeckState {
  draw: string[];
  discard: string[];
}

export interface PieceState {
  kind: 'quest'|'encounter'|'shadow';
  uid: number;
  cards: string[];
  x: number;
  y: number;
  phase: number;
  counter: number;
}

export interface StatePost {
  kind: 'state_p';
}

export interface StateNotify {
  kind: 'state_n';
  gallery: string[];
  deck: DeckState;
  playmat: PieceState[];
}

export interface ShufflePost {
  kind: 'shuffle_p';
  includeDiscard: boolean;
}

export interface ShuffleNotify {
  kind: 'shuffle_n';
  deck: DeckState;
}

export interface PlayDiscardsPost {
  kind: 'play_discards_p';
}

export type SymmetricMessage =
    AdjustCardMessage|RemoveCardMessage|MoveCardMessage|PlayCardMessage;

export type PostMessage =
    StatePost|ShufflePost|PlayDiscardsPost|SymmetricMessage;
export type NotifyMessage = StateNotify|ShuffleNotify|SymmetricMessage;

export interface ServerToClientEvents {
  post: (msg: PostMessage) => void;
  notify: (msg: NotifyMessage) => void;
}

export interface ClientToServerEvents extends ServerToClientEvents {
  join: (msg: {room: string, host: number}) => void;
}