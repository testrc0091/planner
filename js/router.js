// ─── Tab Router ──────────────────────────────────────────────────────────────

const tabs = ['today', 'weekly', 'monthly', 'fitness', 'calendar', 'settings'];
let currentTab = 'today';
const handlers = {};

export function registerTab(name, renderFn) {
  handlers[name] = renderFn;
}

export function navigate(tab) {
  if (!tabs.includes(tab)) return;
  currentTab = tab;

  // Update nav pills
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });

  // Render content
  const content = document.getElementById('main-content');
  content.innerHTML = '';
  if (handlers[tab]) handlers[tab](content);

  // Scroll to top
  content.scrollTop = 0;
}

export function getCurrentTab() { return currentTab; }

export function initRouter() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => navigate(btn.dataset.tab));
  });
  navigate('today');
}
