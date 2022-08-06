export interface Card {
  id: string;
  set: string;
  name: string;
  page: string;
  image: string;
  imageB?: string;
}

export type CardList = {
  [id: string]: number;
};

export interface Scenario {
  id: string;
  name: string;
  quests: string[];
  encounters: CardList;
}

export interface Campaign {
  name: string;
  scenarios: string[];
}

export interface Data {
  cards: Card[];
  scenarios: Scenario[];
  campaigns: Campaign[];
}
