export type Adjustment = 'phase'|'counter'|'order';
export type Destination = 'discard'|'top'|'bottom';

export interface AdjustCardCommand {
  kind: 'adjust';
  uid: number;
  adjustment: Adjustment;
  amount: number;
}

export interface RemoveCardCommand {
  kind: 'remove';
  uid: number;
  destination: Destination;
}

export interface MoveCardCommand {
  kind: 'move';
  uid: number;
  x: number;
  y: number;
}

export interface PlayCardCommand {
  kind: 'play';
  uid: number;
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

// TODO: add commands for
//  * show discards

export type Command =
    AdjustCardCommand|RemoveCardCommand|MoveCardCommand|PlayCardCommand;

export type PostMessage = StatePost|ShufflePost|Command;
export type NotifyMessage = StateNotify|ShuffleNotify|Command;

export interface ServerToClientEvents {
  post: (msg: PostMessage) => void;
  notify: (msg: NotifyMessage) => void;
}

export interface ClientToServerEvents extends ServerToClientEvents {
  join: (msg: {room: string, host: number}) => void;
}