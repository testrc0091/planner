// ─── Symptoms — Monthly Recap (accessed from Fitness tab) ─────────────────────

import { getAll } from './db.js';

export async function renderMonthlyRecap(container) {
  const [symptoms, sessions, periods] = await Promise.all([
    getAll('symptomLogs'), getAll('workoutSessions'), getAll('periodEntries')
  ]);

  let month = new Date();
  month.setDate(1);

  function render() {
    const monthSymptoms = symptoms.filter(s => sameMonth(new Date(s.date), month));
    const monthSessions = sessions.filter(s => sameMonth(new Date(s.date), month));

    container.innerHTML = `
      <div class="page-header">
        <div class="cal-nav">
          <button class="btn-icon" id="recap-prev">‹</button>
          <h1 class="page-title">${month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</h1>
          <button class="btn-icon" id="recap-next">›</button>
        </div>
      </div>

      <div class="card summary-card" style="margin-bottom:16px">
        ${recapStat(monthSessions.length, 'Workouts', '💪')}
        ${recapStat(monthSymptoms.length, 'Logs', '📊')}
        ${recapStat(avgPain(monthSymptoms), 'Avg Pain', '🩺')}
      </div>

      ${monthSymptoms.length === 0
        ? '<p class="empty-msg" style="padding:32px;text-align:center">No symptoms logged this month.<br>Log from the calendar or after a workout.</p>'
        : ['knees','back','leftShoulder','rightShoulder'].map(area => {
            const areaLogs = monthSymptoms.filter(s => s.bodyArea === area);
            if (!areaLogs.length) return '';
            return areaCard(area, areaLogs, monthSessions, periods, month);
          }).join('')}
    `;

    container.querySelector('#recap-prev')?.addEventListener('click', () => {
      month = new Date(month.getFullYear(), month.getMonth() - 1, 1);
      render();
    });
    container.querySelector('#recap-next')?.addEventListener('click', () => {
      month = new Date(month.getFullYear(), month.getMonth() + 1, 1);
      render();
    });
  }

  render();
}

function areaCard(area, logs, sessions, periods, month) {
  const sorted = logs.sort((a,b) => new Date(a.date) - new Date(b.date));
  const avg = (logs.reduce((s,l) => s + l.painScore, 0) / logs.length).toFixed(1);

  // Build simple bar chart with divs
  const maxScore = 10;
  const bars = sorted.map(l => {
    const h = (l.painScore / maxScore * 60).toFixed(0);
    const color = l.painScore <= 3 ? '#4caf50' : l.painScore <= 5 ? '#ff9800' : '#f44336';
    const label = new Date(l.date).getDate();
    return `
      <div class="bar-col">
        <div class="bar" style="height:${h}px;background:${color}" title="${l.painScore}/10 on ${new Date(l.date).toLocaleDateString()}"></div>
        <div class="bar-label">${label}</div>
      </div>
    `;
  }).join('');

  const insights = generateInsights(area, logs, sessions, periods, month);

  return `
    <div class="card" style="margin-bottom:14px">
      <div class="area-card-header">
        <div>
          <div class="task-title">${areaLabel(area)} ${areaIcon(area)}</div>
          <div class="task-meta">Avg ${avg}/10 · ${logs.length} log${logs.length !== 1 ? 's':''}</div>
        </div>
      </div>
      <div class="bar-chart">${bars}</div>
      <div class="insights">
        ${insights.map(i => `<div class="insight-row">💡 ${i}</div>`).join('')}
      </div>
    </div>
  `;
}

function generateInsights(area, logs, sessions, periods, month) {
  const results = [];
  const dateKey = d => new Date(d).toDateString();

  const workoutDays = new Set(sessions.map(s => dateKey(s.date)));
  const workoutLogs = logs.filter(l => workoutDays.has(dateKey(l.date)));
  const nonWorkoutLogs = logs.filter(l => !workoutDays.has(dateKey(l.date)));

  if (workoutLogs.length && nonWorkoutLogs.length) {
    const wAvg = avg(workoutLogs); const nwAvg = avg(nonWorkoutLogs);
    if (wAvg - nwAvg >= 1) results.push(`${areaLabel(area)} pain tends to be higher on workout days (avg ${wAvg.toFixed(1)} vs ${nwAvg.toFixed(1)})`);
    else if (nwAvg - wAvg >= 1) results.push(`${areaLabel(area)} pain is lower on workout days — movement may be helping!`);
  }

  const periodDays = new Set();
  periods.forEach(p => {
    const start = new Date(p.startDate); const end = p.endDate ? new Date(p.endDate) : new Date();
    for (let d = new Date(start); d <= end; d.setDate(d.getDate()+1)) {
      if (sameMonth(d, month)) periodDays.add(d.toDateString());
    }
  });

  if (periodDays.size) {
    const pLogs = logs.filter(l => periodDays.has(dateKey(l.date)));
    const npLogs = logs.filter(l => !periodDays.has(dateKey(l.date)));
    if (pLogs.length && npLogs.length) {
      const pAvg = avg(pLogs); const npAvg = avg(npLogs);
      if (pAvg - npAvg >= 1) results.push(`${areaLabel(area)} pain is higher during your period (avg ${pAvg.toFixed(1)} vs ${npAvg.toFixed(1)})`);
    }
  }

  const sorted = logs.sort((a,b) => new Date(a.date) - new Date(b.date));
  if (sorted.length >= 4) {
    const mid = Math.floor(sorted.length / 2);
    const fAvg = avg(sorted.slice(0, mid)); const sAvg = avg(sorted.slice(mid));
    if (fAvg - sAvg >= 1) results.push(`${areaLabel(area)} pain is trending better this month 📈`);
    else if (sAvg - fAvg >= 1) results.push(`${areaLabel(area)} pain has been increasing — consider checking with your PT`);
    else results.push(`${areaLabel(area)} pain has been consistent this month`);
  }

  if (!results.length) results.push(`Log more data to see patterns for ${areaLabel(area).toLowerCase()}`);
  return results;
}

function recapStat(val, label, icon) {
  return `<div class="stat-item"><div class="stat-val">${icon} ${val}</div><div class="stat-lbl">${label}</div></div>`;
}

function avgPain(logs) {
  if (!logs.length) return '—';
  return (logs.reduce((s,l) => s + l.painScore, 0) / logs.length).toFixed(1);
}

function avg(logs) {
  return logs.reduce((s,l) => s + l.painScore, 0) / logs.length;
}

function sameMonth(date, ref) {
  return date.getMonth() === ref.getMonth() && date.getFullYear() === ref.getFullYear();
}

function areaLabel(a) {
  return { knees:'Knees', back:'Back', leftShoulder:'Left Shoulder', rightShoulder:'Right Shoulder' }[a] || a;
}
function areaIcon(a) {
  return { knees:'🦵', back:'🧍', leftShoulder:'◀️', rightShoulder:'▶️' }[a] || '🩺';
}
