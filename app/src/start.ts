import {assertValid} from './common/util';
import {CAMPAIGNS, getScenario} from './database';
import {navigateTo} from './main';
import {getElement, online} from './util';

const playButton = getElement('play-button') as HTMLButtonElement;
const hostButton = getElement('host-button') as HTMLButtonElement;
const joinButton = getElement('join-button') as HTMLButtonElement;
const DEFAULT_ROOM = 'xyz';

let selectedScenario: HTMLElement|undefined;

function selectedId(): string {
  return assertValid(assertValid(selectedScenario).dataset['sid']);
}

playButton.addEventListener('click', () => {
  navigateTo({
    scenario: selectedId(),
  });
});

hostButton.addEventListener('click', () => {
  navigateTo({
    scenario: selectedId(),
    room: DEFAULT_ROOM,
  });
});

joinButton.addEventListener('click', () => {
  navigateTo({
    room: DEFAULT_ROOM,
  });
});

function updateButtons() {
  console.log('updating buttons');
  playButton.disabled = !selectedScenario;
  hostButton.disabled = !online || !selectedScenario;
  joinButton.disabled = !online;
}

function setupCollapsibles() {
  for (const c of document.getElementsByClassName('collapsible')) {
    c.addEventListener('click', () => {
      c.classList.toggle('active');
      const content = assertValid(c.nextElementSibling) as HTMLElement;
      if (content.style.display === 'block') {
        content.style.display = 'none';
      } else {
        content.style.display = 'block';
      }
    });
  }
}

function buildScenarioPicker(): void {
  const parts = [];
  for (const campaign of CAMPAIGNS.values()) {
    parts.push(`<div class="collapsible">${campaign.name}</div>`);
    parts.push('<div class="content">');
    for (const id of campaign.scenarios) {
      const scenario = getScenario(id);
      parts.push(`<div class="scenario" data-sid="${scenario.id}">${
          scenario.name}</div>`);
    }
    parts.push('</div>');
  }
  getElement('scenario-list').innerHTML = parts.join('\n');
  setupCollapsibles();
  for (const s of document.getElementsByClassName('scenario')) {
    const el = s as HTMLElement;
    el.addEventListener('click', () => {
      if (selectedScenario) {
        selectedScenario.classList.remove('selected');
      }
      selectedScenario = el;
      selectedScenario.classList.add('selected');
      updateButtons();
      // switchToScenario(assertValid(el.dataset['sid']));
    });
  }
}

export function initStartScreen(): void {
  buildScenarioPicker();
  updateButtons();
}