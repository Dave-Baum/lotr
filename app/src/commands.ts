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

// TODO: add commands for
//  * play card
//  * move card
//  * shuffle deck (maybe via state update)
//  * getting initial state from a session

export type Command = AdjustCardCommand|RemoveCardCommand;
