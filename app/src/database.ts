import * as DATA from '../../data/data.json';

import {Campaign, Card, Scenario} from './common/data_types';
import {assertValid} from './common/util';

export const CARDS = new Map<string, Card>(DATA.cards.map(c => [c.id, c]));
export const SCENARIOS = new Map<string, Scenario>(
    DATA.scenarios.map(s => [s.id, s as any as Scenario]));
export const CAMPAIGNS =
    new Map<string, Campaign>(DATA.campaigns.map(c => [c.name, c]));

export function getCard(id: string): Card {
  return assertValid(CARDS.get(id));
}

export function getScenario(id: string): Scenario {
  return assertValid(SCENARIOS.get(id));
}
