// ─── Bloom Planner PWA — Main Entry ──────────────────────────────────────────
import { openDB, seedIfNeeded, getOne } from './db.js';
import { applyTheme }  from './theme.js';
import { registerTab, initRouter } from './router.js';
import { renderToday }    from './today.js';
import { renderWeekly }   from './weekly.js';
import { renderMonthly }  from './monthly.js';
import { renderFitness }  from './fitness.js';
import { renderCalendar } from './calendar.js';
import { renderSettings } from './settings.js';

async function boot() {
  await openDB();
  await seedIfNeeded();

  // Load saved theme
  const theme = await getOne('settings', 'theme');
  if (theme?.baseColor) await applyTheme(theme.baseColor);

  // Register tabs
  registerTab('today',    renderToday);
  registerTab('weekly',   renderWeekly);
  registerTab('monthly',  renderMonthly);
  registerTab('fitness',  renderFitness);
  registerTab('calendar', renderCalendar);
  registerTab('settings', renderSettings);

  initRouter();
}

boot().catch(err => {
  console.error('Bloom boot error:', err);
  document.getElementById('main-content').innerHTML =
    `<div style="padding:32px;text-align:center;color:#A3465A">
      <p style="font-size:1.1rem;font-weight:600">Something went wrong loading Bloom</p>
      <p style="font-size:0.85rem;margin-top:8px;color:#6C6C70">${err.message}</p>
      <button onclick="location.reload()" style="margin-top:20px;padding:12px 24px;background:#C97B8A;color:white;border:none;border-radius:12px;font-size:1rem;cursor:pointer">Retry</button>
    </div>`;
});
