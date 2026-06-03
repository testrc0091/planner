// ─── Today Tab ───────────────────────────────────────────────────────────────

import { getAll, save, remove, uuid, now } from './db.js';

export async function renderToday(container) {
  const [tasks, categories] = await Promise.all([
    getAll('tasks'), getAll('categories')
  ]);

  const today = new Date();
  const todayStr = today.toDateString();
  const catMap = Object.fromEntries(categories.map(c => [c.id, c]));

  const dailyTasks = tasks.filter(t =>
    t.taskType === 'daily' &&
    (new Date(t.createdAt).toDateString() === todayStr || isOverdue(t))
  );
  const weeklyDue = tasks.filter(t =>
    t.taskType === 'weekly' &&
    (t.weeklyCompletions || []).filter(d => isSameWeek(new Date(d))).length < t.weeklyFrequency
  );
  const monthlyDue = tasks.filter(t =>
    t.taskType === 'monthly' &&
    getMonthlyStatus(t) !== 'done'
  );

  container.innerHTML = `
    <div class="page-header">
      <div>
        <div class="page-subtitle">${today.toLocaleDateString('en-US', { weekday: 'long' })}</div>
        <h1 class="page-title">${today.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</h1>
      </div>
    </div>

    <section class="section">
      <div class="section-header">
        <span class="section-icon">☀️</span>
        <h2>Today's Tasks</h2>
        <button class="btn-fab-small" id="add-daily-btn">+</button>
      </div>
      <div id="daily-list">
        ${dailyTasks.length === 0
          ? '<p class="empty-msg">Nothing scheduled — enjoy your day! 🌸</p>'
          : dailyTasks.map(t => taskCard(t, catMap)).join('')}
      </div>
    </section>

    ${weeklyDue.length > 0 ? `
    <section class="section">
      <div class="section-header">
        <span class="section-icon">🔄</span>
        <h2>Weekly In Progress</h2>
      </div>
      <div id="weekly-mini-list">
        ${weeklyDue.map(t => weeklyMiniCard(t, catMap)).join('')}
      </div>
    </section>` : ''}

    ${monthlyDue.length > 0 ? `
    <section class="section">
      <div class="section-header">
        <span class="section-icon">📅</span>
        <h2>Monthly — Due Soon</h2>
      </div>
      ${monthlyDue.map(t => monthlyMiniCard(t, catMap)).join('')}
    </section>` : ''}

    ${addTaskModal()}
  `;

  bindTodayEvents(container, catMap, tasks, categories);
}

function taskCard(task, catMap) {
  const cat = catMap[task.categoryId];
  const overdue = isOverdue(task) && !task.isCompleted;
  return `
    <div class="card task-card ${task.isCompleted ? 'completed' : ''}" data-id="${task.id}">
      <button class="check-btn ${task.isCompleted ? 'checked' : ''}" data-check="${task.id}">
        ${task.isCompleted ? '✓' : ''}
      </button>
      <div class="task-content">
        <div class="task-title-row">
          <span class="task-title">${task.title}</span>
          ${task.priority === 'high' ? '<span class="priority-badge high">!!!</span>' : ''}
          ${task.priority === 'medium' ? '<span class="priority-badge med">!!</span>' : ''}
          ${overdue ? '<span class="overdue-badge">Overdue</span>' : ''}
        </div>
        <div class="task-meta">
          ${task.dueDate ? `<span class="meta-time">⏰ ${formatTime(task.dueDate)}</span>` : ''}
          ${cat ? `<span class="cat-pill" style="background:${cat.colorHex}">${cat.name}</span>` : ''}
        </div>
        ${task.notes ? `<div class="task-notes">${task.notes}</div>` : ''}
      </div>
      <button class="delete-btn" data-delete="${task.id}">🗑</button>
    </div>
  `;
}

function weeklyMiniCard(task, catMap) {
  const cat = catMap[task.categoryId];
  const done = (task.weeklyCompletions || []).filter(d => isSameWeek(new Date(d))).length;
  const pct = Math.min(done / task.weeklyFrequency, 1);
  return `
    <div class="card mini-card">
      <div class="progress-ring-wrap">
        <svg width="44" height="44" viewBox="0 0 44 44">
          <circle cx="22" cy="22" r="18" fill="none" stroke="var(--blush)" stroke-width="4"/>
          <circle cx="22" cy="22" r="18" fill="none" stroke="${cat?.colorHex || 'var(--mauve)'}" stroke-width="4"
            stroke-dasharray="${2 * Math.PI * 18}" stroke-dashoffset="${2 * Math.PI * 18 * (1 - pct)}"
            transform="rotate(-90 22 22)" stroke-linecap="round"/>
        </svg>
        <span class="ring-label">${done}</span>
      </div>
      <div class="mini-content">
        <div class="task-title">${task.title}</div>
        <div class="task-meta">${done} of ${task.weeklyFrequency} this week
          ${cat ? `<span class="cat-pill" style="background:${cat.colorHex}">${cat.name}</span>` : ''}
        </div>
      </div>
      <button class="btn-small" data-log-weekly="${task.id}">+ Log</button>
    </div>
  `;
}

function monthlyMiniCard(task, catMap) {
  const cat = catMap[task.categoryId];
  const status = getMonthlyStatus(task);
  const icons = { overdue: '⚠️', soon: '🕐', done: '✅' };
  return `
    <div class="card mini-card">
      <span style="font-size:1.5rem">${icons[status]}</span>
      <div class="mini-content">
        <div class="task-title">${task.title}</div>
        <div class="task-meta status-${status}">${statusLabel(status)}
          ${cat ? `<span class="cat-pill" style="background:${cat.colorHex}">${cat.name}</span>` : ''}
        </div>
      </div>
    </div>
  `;
}

function addTaskModal() {
  return `
    <div class="modal-overlay hidden" id="add-task-modal">
      <div class="modal">
        <div class="modal-header">
          <h3>New Daily Task</h3>
          <button class="modal-close" id="close-task-modal">✕</button>
        </div>
        <div class="form-group">
          <label>Title *</label>
          <input type="text" id="task-title" placeholder="e.g. Morning journal" class="input">
        </div>
        <div class="form-group">
          <label>Notes</label>
          <textarea id="task-notes" placeholder="Optional notes..." class="input" rows="2"></textarea>
        </div>
        <div class="form-group">
          <label>Due Time</label>
          <input type="time" id="task-time" class="input">
        </div>
        <div class="form-group">
          <label>Priority</label>
          <select id="task-priority" class="input">
            <option value="none">None</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>
        <button class="btn-primary" id="save-task-btn">Add Task</button>
      </div>
    </div>
  `;
}

function bindTodayEvents(container, catMap, tasks, categories) {
  // Add task button
  container.querySelector('#add-daily-btn')?.addEventListener('click', () => {
    container.querySelector('#add-task-modal').classList.remove('hidden');
  });
  container.querySelector('#close-task-modal')?.addEventListener('click', () => {
    container.querySelector('#add-task-modal').classList.add('hidden');
  });
  container.querySelector('#save-task-btn')?.addEventListener('click', async () => {
    const title = container.querySelector('#task-title').value.trim();
    if (!title) return;
    const timeVal = container.querySelector('#task-time').value;
    await save('tasks', {
      id: uuid(), title,
      notes: container.querySelector('#task-notes').value,
      taskType: 'daily',
      priority: container.querySelector('#task-priority').value,
      dueDate: timeVal ? new Date().toISOString().slice(0,10) + 'T' + timeVal : null,
      isCompleted: false, createdAt: now()
    });
    const { renderToday } = await import('./today.js');
    renderToday(container);
  });

  // Check buttons
  container.querySelectorAll('[data-check]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const task = tasks.find(t => t.id === btn.dataset.check);
      if (!task) return;
      task.isCompleted = !task.isCompleted;
      task.completedAt = task.isCompleted ? now() : null;
      await save('tasks', task);
      renderToday(container);
    });
  });

  // Delete buttons
  container.querySelectorAll('[data-delete]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete this task?')) return;
      await remove('tasks', btn.dataset.delete);
      renderToday(container);
    });
  });

  // Log weekly
  container.querySelectorAll('[data-log-weekly]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const task = tasks.find(t => t.id === btn.dataset.logWeekly);
      if (!task) return;
      task.weeklyCompletions = [...(task.weeklyCompletions || []), now()];
      await save('tasks', task);
      renderToday(container);
    });
  });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function isOverdue(task) {
  if (task.taskType !== 'daily' || task.isCompleted) return false;
  const created = new Date(task.createdAt);
  return created.toDateString() !== new Date().toDateString() && created < new Date();
}

export function isSameWeek(date) {
  const now = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  monday.setHours(0,0,0,0);
  return date >= monday;
}

export function getMonthlyStatus(task) {
  if (!task.lastCompletedDate) return 'overdue';
  const last = new Date(task.lastCompletedDate);
  const now = new Date();
  if (last.getMonth() === now.getMonth() && last.getFullYear() === now.getFullYear()) return 'done';
  if (task.monthlyPreferredDay) {
    const diff = task.monthlyPreferredDay - now.getDate();
    if (diff >= 0 && diff <= 5) return 'soon';
  }
  return 'overdue';
}

function statusLabel(s) {
  return { done: 'Done this month ✓', soon: 'Due soon', overdue: 'Overdue' }[s];
}

function formatTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}
