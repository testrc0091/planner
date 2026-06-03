// ─── Monthly Tab ─────────────────────────────────────────────────────────────

import { getAll, save, remove, uuid, now } from './db.js';
import { getMonthlyStatus } from './today.js';

export async function renderMonthly(container) {
  const [tasks, categories] = await Promise.all([
    getAll('tasks'), getAll('categories')
  ]);
  const monthly = tasks.filter(t => t.taskType === 'monthly');
  const catMap = Object.fromEntries(categories.map(c => [c.id, c]));

  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Monthly Tasks</h1>
        <div class="page-subtitle">${new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</div>
      </div>
      <button class="btn-fab-small" id="add-monthly-btn">+</button>
    </div>

    <div id="monthly-list">
      ${monthly.length === 0
        ? '<p class="empty-msg">No monthly tasks yet — tap + to add one 🌸</p>'
        : monthly.map(t => monthlyCard(t, catMap)).join('')}
    </div>

    ${addMonthlyModal(categories)}
  `;

  bindMonthlyEvents(container, tasks, categories);
}

function monthlyCard(task, catMap) {
  const cat = catMap[task.categoryId];
  const status = getMonthlyStatus(task);
  const icons = { done: '✅', soon: '🕐', overdue: '⚠️' };
  const statusColors = { done: 'var(--status-done)', soon: 'var(--mauve)', overdue: 'var(--deep-rose)' };
  const labels = { done: 'Done this month ✓', soon: 'Due soon', overdue: 'Overdue' };

  const daysUntil = task.monthlyPreferredDay
    ? task.monthlyPreferredDay - new Date().getDate()
    : null;

  return `
    <div class="card monthly-card" data-id="${task.id}">
      <div class="monthly-icon" style="background:${statusColors[status]}22">
        <span style="font-size:1.5rem">${icons[status]}</span>
      </div>
      <div class="monthly-info">
        <div class="task-title">${task.title}</div>
        <div class="task-meta">
          <span style="color:${statusColors[status]};font-weight:600">${labels[status]}</span>
          ${daysUntil !== null && status === 'soon'
            ? `<span class="task-notes">in ${daysUntil} day${daysUntil !== 1 ? 's' : ''}</span>` : ''}
          ${task.monthlyPreferredDay ? `<span class="task-notes">Day ${task.monthlyPreferredDay}</span>` : ''}
        </div>
        <div class="task-meta">
          ${cat ? `<span class="cat-pill" style="background:${cat.colorHex}">${cat.name}</span>` : ''}
          ${task.lastCompletedDate
            ? `<span class="task-notes">Last: ${new Date(task.lastCompletedDate).toLocaleDateString()}</span>` : ''}
        </div>
      </div>
      <div class="monthly-actions">
        ${status !== 'done'
          ? `<button class="btn-small" data-complete="${task.id}">Mark Done</button>` : ''}
        <button class="delete-btn" data-delete="${task.id}">🗑</button>
      </div>
    </div>
  `;
}

function addMonthlyModal(categories) {
  return `
    <div class="modal-overlay hidden" id="add-monthly-modal">
      <div class="modal">
        <div class="modal-header">
          <h3>New Monthly Task</h3>
          <button class="modal-close" id="close-monthly-modal">✕</button>
        </div>
        <div class="form-group">
          <label>Title *</label>
          <input type="text" id="monthly-title" placeholder="e.g. Lash lift" class="input">
        </div>
        <div class="form-group">
          <label>Preferred day of month</label>
          <input type="number" id="monthly-day" value="1" min="1" max="28" class="input">
        </div>
        <div class="form-group">
          <label>Category</label>
          <select id="monthly-cat" class="input">
            <option value="">None</option>
            ${categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
          </select>
        </div>
        <button class="btn-primary" id="save-monthly-btn">Add Task</button>
      </div>
    </div>
  `;
}

function bindMonthlyEvents(container, tasks, categories) {
  container.querySelector('#add-monthly-btn')?.addEventListener('click', () => {
    container.querySelector('#add-monthly-modal').classList.remove('hidden');
  });
  container.querySelector('#close-monthly-modal')?.addEventListener('click', () => {
    container.querySelector('#add-monthly-modal').classList.add('hidden');
  });
  container.querySelector('#save-monthly-btn')?.addEventListener('click', async () => {
    const title = container.querySelector('#monthly-title').value.trim();
    if (!title) return;
    await save('tasks', {
      id: uuid(), title, taskType: 'monthly',
      monthlyPreferredDay: parseInt(container.querySelector('#monthly-day').value) || 1,
      categoryId: container.querySelector('#monthly-cat').value || null,
      isCompleted: false, lastCompletedDate: null, createdAt: now()
    });
    renderMonthly(container);
  });

  container.querySelectorAll('[data-complete]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const task = tasks.find(t => t.id === btn.dataset.complete);
      if (!task) return;
      task.isCompleted = true;
      task.lastCompletedDate = now();
      task.completedAt = now();
      await save('tasks', task);
      renderMonthly(container);
    });
  });

  container.querySelectorAll('[data-delete]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete this task?')) return;
      await remove('tasks', btn.dataset.delete);
      renderMonthly(container);
    });
  });
}
