import * as fs from 'fs';

import {Campaign, Card, Data, Scenario} from './common/data_types';

const DATA_DIR = 'data';
const DATA_JSON = `${DATA_DIR}/data.json`;
// const DATA_JS = `${DATA_DIR}/data.js`;

export class Database {
  private cards = new Map<string, Card>();
  private scenarios = new Map<string, Scenario>();
  private campaigns = new Map<string, Campaign>();

  private cardForPage = new Map<string, Card>();

  constructor() {
    if (fs.existsSync(DATA_JSON)) {
      const data = JSON.parse(fs.readFileSync(DATA_JSON, 'utf-8')) as Data;
      for (const card of data.cards) {
        this.addCard(card);
      }
      for (const scenario of data.scenarios) {
        // this.addScenario(scenario);
      }
    }
  }

  write(): void {
    const data: Data = {
      cards: [...this.cards.values()],
      scenarios: [...this.scenarios.values()],
      campaigns: [...this.campaigns.values()],
    };
    const raw = JSON.stringify(data, null, 1);
    fs.writeFileSync(DATA_JSON, raw, 'utf-8');
    // fs.writeFileSync(DATA_JS, `const DATA = ${raw};\n`, 'utf-8');
  }

  getCardForPage(page: string): Card|undefined {
    return this.cardForPage.get(page);
  }

  addCard(card: Card): void {
    this.cards.set(card.id, card);
    this.cardForPage.set(card.page, card);
  }

  addScenario(scenario: Scenario): void {
    this.scenarios.set(scenario.id, scenario);
  }

  addCampaign(campaign: Campaign): void {
    this.campaigns.set(campaign.name, campaign);
  }
}