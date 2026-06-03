// ─── Weekly Tab ───────────────────────────────────────────────────────────────

import { getAll, save, remove, uuid, now } from './db.js';
import { isSameWeek } from './today.js';

export async function renderWeekly(container) {
  const [tasks, categories] = await Promise.all([
    getAll('tasks'), getAll('categories')
  ]);
  const weekly = tasks.filter(t => t.taskType === 'weekly');
  const catMap = Object.fromEntries(categories.map(c => [c.id, c]));
  const totalFreq = weekly.reduce((s, t) => s + t.weeklyFrequency, 0);
  const totalDone = weekly.reduce((s, t) => s + (t.weeklyCompletions || []).filter(d => isSameWeek(new Date(d))).length, 0);
  const pct = totalFreq > 0 ? totalDone / totalFreq : 0;

  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Weekly Tasks</h1>
        <div class="page-subtitle">${weekRangeString()}</div>
      </div>
      <button class="btn-fab-small" id="add-weekly-btn">+</button>
    </div>

    <div class="card summary-card">
      <div>
        <div class="summary-label">This Week</div>
        <div class="summary-value">${totalDone} / ${totalFreq} completions</div>
      </div>
      <div class="progress-ring-wrap">
        <svg width="56" height="56" viewBox="0 0 56 56">
          <circle cx="28" cy="28" r="22" fill="none" stroke="var(--blush)" stroke-width="5"/>
          <circle cx="28" cy="28" r="22" fill="none" stroke="var(--mauve)" stroke-width="5"
            stroke-dasharray="${2 * Math.PI * 22}" stroke-dashoffset="${2 * Math.PI * 22 * (1 - pct)}"
            transform="rotate(-90 28 28)" stroke-linecap="round"/>
        </svg>
        <span class="ring-label">${Math.round(pct * 100)}%</span>
      </div>
    </div>

    <div id="weekly-list">
      ${weekly.length === 0
        ? '<p class="empty-msg">No weekly tasks yet — tap + to add one 🌸</p>'
        : weekly.map(t => weeklyCard(t, catMap)).join('')}
    </div>

    ${addWeeklyModal(categories)}
  `;

  bindWeeklyEvents(container, tasks, categories);
}

function weeklyCard(task, catMap) {
  const cat = catMap[task.categoryId];
  const done = (task.weeklyCompletions || []).filter(d => isSameWeek(new Date(d))).length;
  const pct = Math.min(done / task.weeklyFrequency, 1);
  const goalReached = done >= task.weeklyFrequency;
  const lastDone = (task.weeklyCompletions || []).slice(-1)[0];

  return `
    <div class="card weekly-card" data-id="${task.id}">
      <div class="weekly-card-top">
        <div class="progress-ring-wrap">
          <svg width="56" height="56" viewBox="0 0 56 56">
            <circle cx="28" cy="28" r="22" fill="none" stroke="var(--blush)" stroke-width="5"/>
            <circle cx="28" cy="28" r="22" fill="none" stroke="${cat?.colorHex || 'var(--mauve)'}" stroke-width="5"
              stroke-dasharray="${2 * Math.PI * 22}" stroke-dashoffset="${2 * Math.PI * 22 * (1 - pct)}"
              transform="rotate(-90 28 28)" stroke-linecap="round"/>
          </svg>
          <span class="ring-label">${done}</span>
        </div>
        <div class="weekly-info">
          <div class="task-title">${task.title}</div>
          <div class="task-meta">${done} of ${task.weeklyFrequency} done this week
            ${cat ? `<span class="cat-pill" style="background:${cat.colorHex}">${cat.name}</span>` : ''}
          </div>
          ${lastDone ? `<div class="task-notes">Last: ${new Date(lastDone).toLocaleTimeString('en-US', {hour:'numeric',minute:'2-digit'})}</div>` : ''}
        </div>
        <button class="delete-btn" data-delete="${task.id}">🗑</button>
      </div>

      <div class="dot-row">
        ${Array.from({length: task.weeklyFrequency}, (_,i) => `
          <span class="completion-dot ${i < done ? 'filled' : ''}"
            style="${i < done ? `background:${cat?.colorHex || 'var(--mauve)'}` : ''}"></span>
        `).join('')}
      </div>

      ${goalReached
        ? `<div class="goal-banner">Goal reached! ✨</div>`
        : `<button class="btn-log" data-log="${task.id}">+ Log Completion</button>`}
    </div>
  `;
}

function addWeeklyModal(categories) {
  return `
    <div class="modal-overlay hidden" id="add-weekly-modal">
      <div class="modal">
        <div class="modal-header">
          <h3>New Weekly Task</h3>
          <button class="modal-close" id="close-weekly-modal">✕</button>
        </div>
        <div class="form-group">
          <label>Title *</label>
          <input type="text" id="weekly-title" placeholder="e.g. Physical therapy" class="input">
        </div>
        <div class="form-group">
          <label>Times per week</label>
          <input type="number" id="weekly-freq" value="3" min="1" max="7" class="input">
        </div>
        <div class="form-group">
          <label>Category</label>
          <select id="weekly-cat" class="input">
            <option value="">None</option>
            ${categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
          </select>
        </div>
        <button class="btn-primary" id="save-weekly-btn">Add Task</button>
      </div>
    </div>
  `;
}

function bindWeeklyEvents(container, tasks, categories) {
  container.querySelector('#add-weekly-btn')?.addEventListener('click', () => {
    container.querySelector('#add-weekly-modal').classList.remove('hidden');
  });
  container.querySelector('#close-weekly-modal')?.addEventListener('click', () => {
    container.querySelector('#add-weekly-modal').classList.add('hidden');
  });
  container.querySelector('#save-weekly-btn')?.addEventListener('click', async () => {
    const title = container.querySelector('#weekly-title').value.trim();
    if (!title) return;
    await save('tasks', {
      id: uuid(), title, taskType: 'weekly',
      weeklyFrequency: parseInt(container.querySelector('#weekly-freq').value) || 3,
      categoryId: container.querySelector('#weekly-cat').value || null,
      weeklyCompletions: [], isCompleted: false, createdAt: now()
    });
    renderWeekly(container);
  });

  container.querySelectorAll('[data-log]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const task = tasks.find(t => t.id === btn.dataset.log);
      if (!task) return;
      task.weeklyCompletions = [...(task.weeklyCompletions || []), now()];
      await save('tasks', task);
      renderWeekly(container);
    });
  });

  container.querySelectorAll('[data-delete]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete this task?')) return;
      await remove('tasks', btn.dataset.delete);
      renderWeekly(container);
    });
  });
}

function weekRangeString() {
  const now = new Date();
  const mon = new Date(now);
  mon.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
  const fmt = d => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${fmt(mon)} – ${fmt(sun)}`;
}
