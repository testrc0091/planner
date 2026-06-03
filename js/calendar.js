// ─── Calendar Tab ────────────────────────────────────────────────────────────

import { getAll, save, remove, uuid, now } from './db.js';

export async function renderCalendar(container) {
  const [tasks, categories, periods, symptoms] = await Promise.all([
    getAll('tasks'), getAll('categories'),
    getAll('periodEntries'), getAll('symptomLogs')
  ]);
  const catMap = Object.fromEntries(categories.map(c => [c.id, c]));

  let viewMode = 'month'; // 'month' | 'week'
  let displayDate = new Date();

  function render() {
    container.innerHTML = `
      <div class="page-header">
        <div class="cal-nav">
          <button class="btn-icon" id="cal-prev">‹</button>
          <h1 class="page-title" id="cal-title"></h1>
          <button class="btn-icon" id="cal-next">›</button>
        </div>
        <div class="cal-controls">
          <button class="btn-small ${viewMode==='month'?'active':''}" id="month-view-btn">Month</button>
          <button class="btn-small ${viewMode==='week'?'active':''}" id="week-view-btn">Week</button>
          <button class="btn-small" id="today-btn">Today</button>
        </div>
      </div>
      <div id="cal-body"></div>
      ${addEventModal()}
      ${periodModal()}
      ${symptomModal()}
    `;

    updateCalendar();
    bindCalendarControls();
  }

  function updateCalendar() {
    const title = container.querySelector('#cal-title');
    const body = container.querySelector('#cal-body');

    if (viewMode === 'month') {
      title.textContent = displayDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      body.innerHTML = renderMonthGrid(displayDate, tasks, catMap, periods, symptoms);
    } else {
      const wStart = getWeekStart(displayDate);
      const wEnd = new Date(wStart); wEnd.setDate(wStart.getDate() + 6);
      title.textContent = `${fmtShort(wStart)} – ${fmtShort(wEnd)}`;
      body.innerHTML = renderWeekGrid(wStart, tasks, catMap, periods);
    }

    bindDayClicks(container, tasks, catMap, periods, symptoms, categories);
  }

  function bindCalendarControls() {
    container.querySelector('#cal-prev').addEventListener('click', () => {
      if (viewMode === 'month') displayDate = addMonths(displayDate, -1);
      else displayDate = new Date(displayDate.setDate(displayDate.getDate() - 7));
      updateCalendar();
    });
    container.querySelector('#cal-next').addEventListener('click', () => {
      if (viewMode === 'month') displayDate = addMonths(displayDate, 1);
      else displayDate = new Date(displayDate.setDate(displayDate.getDate() + 7));
      updateCalendar();
    });
    container.querySelector('#today-btn').addEventListener('click', () => {
      displayDate = new Date(); updateCalendar();
    });
    container.querySelector('#month-view-btn').addEventListener('click', () => {
      viewMode = 'month'; render();
    });
    container.querySelector('#week-view-btn').addEventListener('click', () => {
      viewMode = 'week'; render();
    });
  }

  render();
}

// ─── Month Grid ───────────────────────────────────────────────────────────────

function renderMonthGrid(date, tasks, catMap, periods, symptoms) {
  const year = date.getFullYear(), month = date.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startOffset = (firstDay.getDay() + 6) % 7; // Mon=0

  let html = `
    <div class="cal-grid-header">
      ${['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d=>`<div class="cal-day-label">${d}</div>`).join('')}
    </div>
    <div class="cal-grid" id="month-grid">
  `;

  // Empty cells
  for (let i = 0; i < startOffset; i++) html += `<div class="cal-cell empty"></div>`;

  for (let day = 1; day <= lastDay.getDate(); day++) {
    const d = new Date(year, month, day);
    const isToday = d.toDateString() === new Date().toDateString();
    const isPeriod = periods.some(p => {
      const start = new Date(p.startDate); start.setHours(0,0,0,0);
      const end = p.endDate ? new Date(p.endDate) : new Date();
      end.setHours(23,59,59,999);
      return d >= start && d <= end;
    });
    const dayTasks = tasks.filter(t => t.completedAt && new Date(t.completedAt).toDateString() === d.toDateString());
    const daySymptoms = symptoms.filter(s => new Date(s.date).toDateString() === d.toDateString());
    const highPain = daySymptoms.some(s => s.painScore >= 6);

    const dots = [...new Set(dayTasks.map(t => catMap[t.categoryId]?.colorHex || 'var(--mauve)'))].slice(0,3);

    html += `
      <div class="cal-cell ${isToday ? 'today' : ''} ${isPeriod ? 'period-day' : ''}" data-date="${d.toISOString()}">
        <div class="cal-date-num ${isToday ? 'today-num' : ''}">${day}</div>
        <div class="cal-dots">
          ${dots.map(c => `<span class="cal-dot" style="background:${c}"></span>`).join('')}
          ${highPain ? '<span class="pain-dot"></span>' : ''}
        </div>
      </div>
    `;
  }
  html += '</div>';

  html += `
    <div id="day-detail" class="day-detail hidden">
      <div id="day-detail-content"></div>
    </div>
  `;
  return html;
}

// ─── Week Grid ────────────────────────────────────────────────────────────────

function renderWeekGrid(weekStart, tasks, catMap, periods) {
  const hours = Array.from({length:17}, (_,i) => i + 6); // 6am–10pm
  const days = Array.from({length:7}, (_,i) => {
    const d = new Date(weekStart); d.setDate(weekStart.getDate() + i); return d;
  });

  const isPeriodDay = d => periods.some(p => {
    const start = new Date(p.startDate); start.setHours(0,0,0,0);
    const end = p.endDate ? new Date(p.endDate) : new Date(); end.setHours(23,59,59,999);
    return d >= start && d <= end;
  });

  let html = `<div class="week-grid">`;

  // Day headers
  html += `<div class="week-header-row"><div class="time-col"></div>`;
  days.forEach(d => {
    const isToday = d.toDateString() === new Date().toDateString();
    html += `
      <div class="week-day-header ${isToday ? 'today' : ''} ${isPeriodDay(d) ? 'period-col' : ''}">
        <div class="wk-weekday">${d.toLocaleDateString('en-US',{weekday:'short'})}</div>
        <div class="wk-date ${isToday ? 'today-num' : ''}">${d.getDate()}</div>
        ${isPeriodDay(d) ? '<div class="period-bar"></div>' : ''}
      </div>
    `;
  });
  html += `</div>`;

  // Time slots
  hours.forEach(hour => {
    html += `<div class="week-row"><div class="time-col">${formatHour(hour)}</div>`;
    days.forEach(d => {
      const isToday = d.toDateString() === new Date().toDateString();
      html += `<div class="week-cell ${isToday ? 'today-col' : ''} ${isPeriodDay(d) ? 'period-col' : ''}"></div>`;
    });
    html += `</div>`;
  });

  html += `</div>`;
  return html;
}

// ─── Day detail panel ─────────────────────────────────────────────────────────

function bindDayClicks(container, tasks, catMap, periods, symptoms, categories) {
  container.querySelectorAll('.cal-cell:not(.empty)').forEach(cell => {
    cell.addEventListener('click', () => {
      const date = new Date(cell.dataset.date);
      showDayDetail(container, date, tasks, catMap, periods, symptoms, categories);
    });
  });
}

function showDayDetail(container, date, tasks, catMap, periods, symptoms, categories) {
  const detail = container.querySelector('#day-detail');
  const content = container.querySelector('#day-detail-content');
  if (!detail || !content) return;

  const dateStr = date.toDateString();
  const dayTasks = tasks.filter(t => t.completedAt && new Date(t.completedAt).toDateString() === dateStr);
  const daySymptoms = symptoms.filter(s => new Date(s.date).toDateString() === dateStr);
  const isPeriod = periods.some(p => {
    const start = new Date(p.startDate); start.setHours(0,0,0,0);
    const end = p.endDate ? new Date(p.endDate) : new Date(); end.setHours(23,59,59,999);
    return date >= start && date <= end;
  });

  content.innerHTML = `
    <div class="day-detail-header">
      <h3>${date.toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric' })}</h3>
      ${isPeriod ? '<span class="period-chip">🩸 Period</span>' : ''}
    </div>
    <div class="day-actions">
      <button class="btn-small" id="dd-add-task" data-date="${date.toISOString()}">+ Task</button>
      <button class="btn-small" id="dd-log-period" data-date="${date.toISOString()}">🩸 Period</button>
      <button class="btn-small" id="dd-log-symptom" data-date="${date.toISOString()}">🩺 Symptoms</button>
    </div>

    ${dayTasks.length > 0 ? `
      <div class="section-label">Completed Tasks</div>
      ${dayTasks.map(t => `
        <div class="day-item">
          <span>✓</span>
          <span>${t.title}</span>
          ${catMap[t.categoryId] ? `<span class="cat-pill" style="background:${catMap[t.categoryId].colorHex}">${catMap[t.categoryId].name}</span>` : ''}
        </div>
      `).join('')}
    ` : ''}

    ${daySymptoms.length > 0 ? `
      <div class="section-label">Symptoms</div>
      ${daySymptoms.map(s => `
        <div class="day-item">
          <span>${areaIcon(s.bodyArea)}</span>
          <span>${areaLabel(s.bodyArea)}</span>
          <span class="pain-badge pain-${painLevel(s.painScore)}">${s.painScore}/10</span>
        </div>
      `).join('')}
    ` : ''}

    ${dayTasks.length === 0 && daySymptoms.length === 0 ? '<p class="empty-msg">Nothing on this day</p>' : ''}
  `;

  detail.classList.remove('hidden');

  // Bind detail actions
  detail.querySelector('#dd-add-task')?.addEventListener('click', () => {
    container.querySelector('#add-event-modal').classList.remove('hidden');
    container.querySelector('#event-date').value = date.toISOString().slice(0,10);
  });
  detail.querySelector('#dd-log-period')?.addEventListener('click', () => {
    container.querySelector('#period-modal').classList.remove('hidden');
    container.querySelector('#period-start').value = date.toISOString().slice(0,10);
  });
  detail.querySelector('#dd-log-symptom')?.addEventListener('click', () => {
    container.querySelector('#symptom-modal').classList.remove('hidden');
    container.querySelector('#symptom-date').value = date.toISOString().slice(0,10);
  });
}

// ─── Modals ───────────────────────────────────────────────────────────────────

function addEventModal() {
  return `
    <div class="modal-overlay hidden" id="add-event-modal">
      <div class="modal">
        <div class="modal-header">
          <h3>New Task</h3>
          <button class="modal-close" id="close-event-modal">✕</button>
        </div>
        <div class="form-group">
          <label>Title *</label>
          <input type="text" id="event-title" class="input" placeholder="Task title">
        </div>
        <div class="form-group">
          <label>Date</label>
          <input type="date" id="event-date" class="input">
        </div>
        <button class="btn-primary" id="save-event-btn">Add Task</button>
      </div>
    </div>
  `;
}

function periodModal() {
  return `
    <div class="modal-overlay hidden" id="period-modal">
      <div class="modal">
        <div class="modal-header">
          <h3>Log Period</h3>
          <button class="modal-close" id="close-period-modal">✕</button>
        </div>
        <div class="form-group">
          <label>Start date</label>
          <input type="date" id="period-start" class="input">
        </div>
        <div class="form-group">
          <label><input type="checkbox" id="period-ongoing" checked> Still ongoing</label>
        </div>
        <div class="form-group" id="period-end-group" style="display:none">
          <label>End date</label>
          <input type="date" id="period-end" class="input">
        </div>
        <div class="form-group">
          <label>Notes</label>
          <input type="text" id="period-notes" class="input" placeholder="Optional">
        </div>
        <button class="btn-primary" id="save-period-btn">Save</button>
      </div>
    </div>
  `;
}

function symptomModal() {
  return `
    <div class="modal-overlay hidden" id="symptom-modal">
      <div class="modal">
        <div class="modal-header">
          <h3>Log Symptoms</h3>
          <button class="modal-close" id="close-symptom-modal">✕</button>
        </div>
        <div class="form-group">
          <label>Date</label>
          <input type="date" id="symptom-date" class="input">
        </div>
        <div class="form-group">
          <label>Body area</label>
          <select id="symptom-area" class="input">
            <option value="knees">Knees</option>
            <option value="back">Back</option>
            <option value="leftShoulder">Left Shoulder</option>
            <option value="rightShoulder">Right Shoulder</option>
          </select>
        </div>
        <div class="form-group">
          <label>Pain score: <span id="pain-val">5</span>/10</label>
          <input type="range" id="pain-score" min="1" max="10" value="5" class="slider">
          <div class="slider-labels"><span>🟢 1</span><span>🔴 10</span></div>
        </div>
        <div class="form-group">
          <label>Notes</label>
          <input type="text" id="symptom-notes" class="input" placeholder="Optional">
        </div>
        <button class="btn-primary" id="save-symptom-btn">Save</button>
      </div>
    </div>
  `;
}

// Bind calendar modal events after render
document.addEventListener('click', async e => {
  if (e.target.id === 'close-event-modal') e.target.closest('.modal-overlay').classList.add('hidden');
  if (e.target.id === 'close-period-modal') e.target.closest('.modal-overlay').classList.add('hidden');
  if (e.target.id === 'close-symptom-modal') e.target.closest('.modal-overlay').classList.add('hidden');

  if (e.target.id === 'period-ongoing') {
    document.querySelector('#period-end-group').style.display = e.target.checked ? 'none' : 'block';
  }
  if (e.target.id === 'pain-score') {
    document.querySelector('#pain-val').textContent = e.target.value;
  }

  if (e.target.id === 'save-event-btn') {
    const title = document.querySelector('#event-title').value.trim();
    if (!title) return;
    await save('tasks', {
      id: uuid(), title, taskType: 'daily',
      dueDate: document.querySelector('#event-date').value || null,
      isCompleted: false, priority: 'none', createdAt: now()
    });
    document.querySelector('#add-event-modal').classList.add('hidden');
  }

  if (e.target.id === 'save-period-btn') {
    const startVal = document.querySelector('#period-start').value;
    if (!startVal) return;
    const ongoing = document.querySelector('#period-ongoing').checked;
    await save('periodEntries', {
      id: uuid(),
      startDate: new Date(startVal).toISOString(),
      endDate: ongoing ? null : (document.querySelector('#period-end').value ? new Date(document.querySelector('#period-end').value).toISOString() : null),
      notes: document.querySelector('#period-notes').value,
      createdAt: now()
    });
    document.querySelector('#period-modal').classList.add('hidden');
    const { renderCalendar } = await import('./calendar.js');
    renderCalendar(document.querySelector('#main-content'));
  }

  if (e.target.id === 'save-symptom-btn') {
    const dateVal = document.querySelector('#symptom-date').value;
    if (!dateVal) return;
    await save('symptomLogs', {
      id: uuid(),
      date: new Date(dateVal).toISOString(),
      bodyArea: document.querySelector('#symptom-area').value,
      painScore: parseInt(document.querySelector('#pain-score').value),
      notes: document.querySelector('#symptom-notes').value,
      createdAt: now()
    });
    document.querySelector('#symptom-modal').classList.add('hidden');
    const { renderCalendar } = await import('./calendar.js');
    renderCalendar(document.querySelector('#main-content'));
  }
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getWeekStart(date) {
  const d = new Date(date);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  d.setHours(0,0,0,0);
  return d;
}

function addMonths(date, n) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + n);
  return d;
}

function fmtShort(d) {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatHour(h) {
  if (h === 12) return '12pm';
  if (h < 12) return `${h}am`;
  return `${h-12}pm`;
}

function areaLabel(area) {
  return { knees:'Knees', back:'Back', leftShoulder:'Left Shoulder', rightShoulder:'Right Shoulder' }[area] || area;
}

function areaIcon(area) {
  return { knees:'🦵', back:'🧍', leftShoulder:'◀️', rightShoulder:'▶️' }[area] || '🩺';
}

function painLevel(score) {
  if (score <= 3) return 'low';
  if (score <= 5) return 'med';
  return 'high';
}
