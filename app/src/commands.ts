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

export interface StateResponse {
  kind: 'state';
  gallery: string[];
  deck: DeckState;
  playmat: PieceState[];
}


// TODO: add commands for
//  * play card
//  * move card
//  * shuffle deck (maybe via state update)
//  * getting initial state from a session

export type Command = AdjustCardCommand|RemoveCardCommand;

export interface PostMessage {
  kind: 'state';
}

export type NotifyMessage = StateResponse;

export interface ServerToClientEvents {
  post: (msg: PostMessage) => void;
  notify: (msg: NotifyMessage) => void;
}

export interface ClientToServerEvents extends ServerToClientEvents {
  join: (msg: {room: string, host: number}) => void;
}