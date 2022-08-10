import {assertValid} from './common/util';

export function getElement(id: string): Element {
  return assertValid(document.getElementById(id));
}

export const online = window.location.protocol !== 'file:';
