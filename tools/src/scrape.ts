import * as cheerio from 'cheerio';
import * as fs from 'fs';
import * as https from 'https';

import {Campaign, Card, CardList, Scenario} from './common/data_types';
import {assertValid} from './common/util';
import {Database} from './database';

const HOST = 'hallofbeorn.com';
const CACHE_DIR = 'cache';

// Set codes that cannot be inferred from the URL suffix
const SET_CODES = new Map<string, string>([
  ['Into Fangorn Nightmare', 'IFN'],
  ['The Drowned Ruins Nightmare', 'TDRuN'],
  ['The Battle of Five Armies Nightmare', 'TBoFAN'],
]);

const CARD_NUMBER_OVERRIDES = new Map<string, number>([
  ['The Champion\'s Cunning', 74],
]);

async function fetchHTTP(path: string): Promise<string> {
  const options = {
    hostname: HOST,
    path,
    method: 'GET',
  };

  return new Promise((resolve, reject) => {
    let data = '';
    const req = https.request(options, res => {
      if (res.statusCode !== 200) {
        reject(new Error(`HTTPS Status ${res.statusCode}`));
      }
      res.on('data', d => {
        data += d.toString();
      });
      res.on('end', () => {
        resolve(data);
      });
    });

    req.on('error', error => {
      reject(error);
    });

    req.end();
  });
}

async function fetch(path: string): Promise<string> {
  const key = path.split('/').join('_');
  const cachePath = `${CACHE_DIR}/${key}`;
  if (fs.existsSync(cachePath)) {
    return Promise.resolve(fs.readFileSync(cachePath, 'utf-8'));
  }

  const data = await fetchHTTP(path);
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, {recursive: true});
  }
  fs.writeFileSync(cachePath, data, 'utf-8');
  return Promise.resolve(data);
}

function getAttribute(el: cheerio.Element, name: string): string|undefined {
  for (const a of el.attributes) {
    if (a.name === name) {
      return a.value;
    }
  }
  return;
}

async function getCard(database: Database, path: string): Promise<Card> {
  let card = database.getCardForPage(path);
  if (card) {
    return Promise.resolve(card);
  }
  console.log('Loading card', path);
  const $ = cheerio.load(await fetch(path));
  const titleNameBox = $('.titleNameBox').first();
  const name = $('div', titleNameBox).first().text();
  const setName = $('span', titleNameBox).first().text().trim();
  const ident = $('span', titleNameBox).last().text();
  const images = $('.card-image');
  const cardImage = assertValid(images.get(0));
  const cardImageB = images.get(1);
  let set = SET_CODES.get(setName);
  if (!set) {
    set = assertValid(path.match(/.*-([^-]+)$/))[1];
  }
  let cardNumber = CARD_NUMBER_OVERRIDES.get(name);
  if (!cardNumber) {
    cardNumber = Number(assertValid(ident.match(/#(\d+)/))[1]);
  }
  const id = `${set}-${cardNumber}`;

  card = {
    id,
    set,
    name,
    page: path,
    image: assertValid(getAttribute(cardImage, 'src')),
  };

  if (cardImageB) {
    card.imageB = assertValid(getAttribute(cardImageB, 'src'));
  }
  database.addCard(card);
  return Promise.resolve(card);
}

interface ScenarioCounts {
  normal: number;
  easy: number;
  nightmare: number;
}

function parseCount(s: string): number {
  if (s === '-') {
    return 0;
  }
  const n = Number(s);
  if (!isFinite(n)) {
    throw new Error(`'${s}' is not a number`);
  }
  return n;
}

function extractScenarioTable(
    $: cheerio.CheerioAPI,
    selection: cheerio.Cheerio<cheerio.Element>): Map<string, ScenarioCounts> {
  const table = new Map<string, ScenarioCounts>();
  $('a', selection).each((i, el) => {
    if (el.parent) {
      const parts = $.text([el.parent]).split('\n').map(s => s.trim());
      if (parts.length !== 6) {
        return;
      }
      table.set(assertValid(getAttribute(el, 'href')), {
        normal: parseCount(parts[2]),
        easy: parseCount(parts[3]),
        nightmare: parseCount(parts[4]),
      });
    }
  });

  return table;
}

async function getScenario(database: Database, id: string): Promise<Scenario> {
  const path = `/LotR/Scenarios/${id}`;
  const $ = cheerio.load(await fetch(path));
  const name = $('h2').first().text();
  const div = $('#toggleChart').parent();
  const encounterTable = extractScenarioTable($, div);
  const encounters: CardList = {};
  for (const [page, counts] of encounterTable) {
    const card = await getCard(database, page);
    if (counts.easy) {
      encounters[card.id] = counts.easy;
    }
  }
  const questTable = extractScenarioTable($, div.prevUntil('h3'));
  const quests: string[] = [];
  for (const [page, counts] of questTable) {
    const card = await getCard(database, page);
    if (counts.easy) {
      // Reverse order because we're iterating backwards through the DOM
      quests.unshift(card.id);
    }
  }
  const scenario = {id, name, encounters, quests};
  database.addScenario(scenario);
  return Promise.resolve(scenario);
}

async function getCampaigns(): Promise<Campaign[]> {
  const campaigns: Campaign[] = [];
  const $ = cheerio.load(await fetch('/LotR/Scenarios'));
  const ids: string[] = [];
  let campaign: Campaign|null = null;
  let name = 'None';
  $('.scenario-title a, h3').each((i, el) => {
    if (el.tagName === 'h3') {
      name = $.text([el]);
      campaign = null;
      return;
    }
    const href = assertValid(getAttribute(el, 'href'));
    if (href.endsWith('-Campaign')) {
      return;
    }
    const id = assertValid(href.split('/').pop());
    if (!campaign) {
      campaign = {name, scenarios: []};
      campaigns.push(campaign);
    }
    campaign.scenarios.push(id);
  });
  return Promise.resolve(campaigns);
}

async function main() {
  try {
    const database = new Database();
    const campaigns = (await getCampaigns()).slice(0, 21);
    for (const c of campaigns) {
      database.addCampaign(c);
      for (const s of c.scenarios) {
        console.log(s);
        await getScenario(database, s);
      }
    }
    database.write();
  } catch (e) {
    console.log(e);
  }
}

main();