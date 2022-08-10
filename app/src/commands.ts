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

export interface StateRequest {
  kind: 'state';
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

// TODO: add commands for
//  * play card
//  * shuffle deck (maybe via state update)

export type Command = AdjustCardCommand|RemoveCardCommand|MoveCardCommand;

export type PostMessage = StatePost|Command;
export type NotifyMessage = StateNotify|Command;

export interface ServerToClientEvents {
  post: (msg: PostMessage) => void;
  notify: (msg: NotifyMessage) => void;
}

export interface ClientToServerEvents extends ServerToClientEvents {
  join: (msg: {room: string, host: number}) => void;
}