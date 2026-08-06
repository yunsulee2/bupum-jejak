import './style.css';

const app = document.querySelector('#app');
const loading = document.querySelector('#loading-screen');
const moduleButtons = {
  pc: document.querySelector('#start-button'),
  fluorescent: document.querySelector('#fluorescent-start-button'),
  shower: document.querySelector('#shower-start-button'),
  drawer: document.querySelector('#drawer-start-button'),
};

function setBootstrapState(button, state, label = '') {
  const status = button.querySelector('.module-card-copy small');
  if (!button.dataset.bootstrapStatus) button.dataset.bootstrapStatus = status.textContent;
  button.dataset.loadState = state;
  button.setAttribute('aria-busy', String(state === 'loading'));
  button.disabled = state === 'loading';
  status.textContent = label || button.dataset.bootstrapStatus;
}

async function launch(kind) {
  const button = moduleButtons[kind];
  setBootstrapState(button, 'loading', '3D 실습 엔진 불러오는 중…');
  try {
    const experience = await import('./app.js');
    setBootstrapState(button, 'ready');
    await experience.launchExperience(kind);
  } catch (error) {
    console.error(error);
    setBootstrapState(button, 'error', '불러오기 실패 · 다시 누르세요');
  }
}

Object.entries(moduleButtons).forEach(([kind, button]) => {
  button.disabled = false;
  button.addEventListener('click', () => launch(kind));
});

app.dataset.mode = 'intro';
loading.classList.add('is-complete');
window.setTimeout(() => { loading.hidden = true; }, 360);
