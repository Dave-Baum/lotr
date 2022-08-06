import * as https from 'https';

const HOST = 'ringsdb.com';

async function fetch(path: string): Promise<string> {
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

function addCards(listing: Object, cards: Set<string>): void {
  for (const c of Object.keys(listing)) {
    cards.add(c);
  }
}

async function getCardsInDeck(deck: string): Promise<Set<string>> {
  const data = JSON.parse(await fetch(`/api/public/decklist/${deck}.json`));
  const cards = new Set<string>();
  addCards(data.heroes, cards);
  addCards(data.slots, cards);
  addCards(data.sideslots, cards);
  return cards;
}

async function getPack(card: string): Promise<string> {
  const data = JSON.parse(await fetch(`/api/public/card/${card}`));
  return data.pack_code;
}

async function printDeck(deck: string) {
  const cards = await getCardsInDeck(deck);
  const counts = new Map<string, number>();
  for (const c of cards) {
    const pack = await getPack(c);
    counts.set(pack, (counts.get(pack) || 0) + 1);
  }

  for (const [key, value] of counts.entries()) {
    console.log(key, value);
  }
}

async function main() {
  // printDeck('26087');  // Elves
  printDeck('26089');  // Dwarves
}

main();