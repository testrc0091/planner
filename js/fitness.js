// ─── Fitness Tab ─────────────────────────────────────────────────────────────

import { getAll, save, remove, uuid, now } from './db.js';

export async function renderFitness(container) {
  const [sessions, templates, categories, bands, records] = await Promise.all([
    getAll('workoutSessions'), getAll('workoutTemplates'),
    getAll('categories'), getAll('resistanceBands'), getAll('personalRecords')
  ]);
  const catMap = Object.fromEntries(categories.map(c => [c.id, c]));
  const recent = sessions.sort((a,b) => new Date(b.date) - new Date(a.date)).slice(0, 10);

  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Fitness</h1>
        <div class="page-subtitle">${new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</div>
      </div>
    </div>

    <!-- Monthly recap strip -->
    ${recapStrip(sessions)}

    <!-- Heatmap -->
    <div class="card" style="margin-bottom:16px">
      <div class="section-label">Activity — Last 10 Weeks</div>
      <div class="heatmap">${buildHeatmap(sessions, categories)}</div>
    </div>

    <!-- Templates -->
    <section class="section">
      <div class="section-header">
        <span class="section-icon">📋</span>
        <h2>Workout Templates</h2>
        <button class="btn-fab-small" id="new-template-btn">+</button>
      </div>
      <div id="templates-list">
        ${templates.length === 0
          ? '<p class="empty-msg">Save a workout as a template to reuse it quickly</p>'
          : templates.map(t => templateCard(t, catMap)).join('')}
      </div>
    </section>

    <!-- Start workout -->
    <section class="section">
      <div class="section-header">
        <span class="section-icon">💪</span>
        <h2>Log Workout</h2>
      </div>
      <button class="btn-primary full-width" id="start-workout-btn">+ Start New Workout</button>
    </section>

    <!-- Recent sessions -->
    <section class="section">
      <div class="section-header">
        <span class="section-icon">📖</span>
        <h2>Recent Sessions</h2>
      </div>
      <div id="sessions-list">
        ${recent.length === 0
          ? '<p class="empty-msg">No workouts yet — start your first one above!</p>'
          : recent.map(s => sessionCard(s, catMap, records)).join('')}
      </div>
    </section>

    ${workoutModal(categories, bands, templates)}
    ${templateModal(categories, bands)}
  `;

  bindFitnessEvents(container, sessions, templates, categories, bands, records);
}

// ─── Cards ───────────────────────────────────────────────────────────────────

function recapStrip(sessions) {
  const thisMonth = sessions.filter(s => {
    const d = new Date(s.date);
    const n = new Date();
    return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear();
  });
  const avgEx = thisMonth.length
    ? (thisMonth.reduce((s,w) => s + (w.exertionRating||0), 0) / thisMonth.length).toFixed(1) : '—';
  return `
    <div class="card summary-card" style="margin-bottom:16px">
      <div class="stat-item"><div class="stat-val">${thisMonth.length}</div><div class="stat-lbl">Workouts</div></div>
      <div class="stat-item"><div class="stat-val">${avgEx}</div><div class="stat-lbl">Avg Exertion</div></div>
      <div class="stat-item"><a href="#" id="view-recap-btn" class="link">View Recap →</a></div>
    </div>
  `;
}

function templateCard(tmpl, catMap) {
  const cat = catMap[tmpl.categoryId];
  return `
    <div class="card template-card">
      <div class="template-info">
        <div class="task-title">${tmpl.name}</div>
        <div class="task-meta">
          ${tmpl.exercises?.length || 0} exercises
          ${cat ? `<span class="cat-pill" style="background:${cat.colorHex}">${cat.name}</span>` : ''}
        </div>
      </div>
      <div class="template-actions">
        <button class="btn-small" data-use-template="${tmpl.id}">Use</button>
        <button class="delete-btn" data-delete-template="${tmpl.id}">🗑</button>
      </div>
    </div>
  `;
}

function sessionCard(session, catMap, records) {
  const cat = catMap[session.categoryId];
  const exs = (session.exercises || []);
  return `
    <div class="card session-card">
      <div class="session-top">
        <div>
          <div class="task-title">${new Date(session.date).toLocaleDateString('en-US', {month:'short',day:'numeric',year:'numeric'})}</div>
          <div class="task-meta">
            ${session.durationMinutes ? `⏱ ${formatDuration(session.durationMinutes)}` : ''}
            ${cat ? `<span class="cat-pill" style="background:${cat.colorHex}">${cat.name}</span>` : ''}
          </div>
        </div>
        <div class="rating-badges">
          ${session.willingnessRating ? `<span class="rating-badge">🔋${session.willingnessRating}</span>` : ''}
          ${session.exertionRating ? `<span class="rating-badge">🔥${session.exertionRating}</span>` : ''}
        </div>
      </div>
      ${exs.slice(0,3).map(ex => `
        <div class="exercise-row">
          <span class="ex-name">${ex.name}</span>
          <span class="ex-sets">${ex.sets?.length || 0} sets</span>
        </div>
      `).join('')}
      ${exs.length > 3 ? `<div class="task-notes">+ ${exs.length - 3} more exercises</div>` : ''}
      <button class="delete-btn" data-delete-session="${session.id}">🗑</button>
    </div>
  `;
}

// ─── Heatmap ─────────────────────────────────────────────────────────────────

function buildHeatmap(sessions, categories) {
  const cells = [];
  const today = new Date();
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  const start = new Date(monday);
  start.setDate(start.getDate() - 63);

  for (let d = new Date(start); d <= today; d.setDate(d.getDate() + 1)) {
    const key = d.toDateString();
    const daySessions = sessions.filter(s => new Date(s.date).toDateString() === key);
    const cat = daySessions.length > 0 && categories.find(c => c.id === daySessions[0].categoryId);
    const color = cat ? cat.colorHex : (daySessions.length > 0 ? 'var(--mauve)' : 'var(--blush)');
    const opacity = daySessions.length > 0 ? '1' : '0.3';
    cells.push(`<div class="heat-cell" style="background:${color};opacity:${opacity}" title="${new Date(d).toLocaleDateString()}"></div>`);
  }
  return cells.join('');
}

// ─── Modals ──────────────────────────────────────────────────────────────────

function workoutModal(categories, bands, templates) {
  return `
    <div class="modal-overlay hidden" id="workout-modal">
      <div class="modal modal-large">
        <div class="modal-header">
          <h3 id="workout-modal-title">New Workout</h3>
          <button class="modal-close" id="close-workout-modal">✕</button>
        </div>

        <!-- Screen 1: Pre-workout -->
        <div id="screen-pre">
          <div class="form-group">
            <label>Category</label>
            <select id="workout-cat" class="input">
              <option value="">None</option>
              ${categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>Willingness to work out: <span id="will-val">5</span>/10</label>
            <input type="range" id="willingness" min="1" max="10" value="5" class="slider">
            <div class="slider-labels"><span>😴</span><span>💪</span></div>
          </div>
          <button class="btn-primary full-width" id="start-logging-btn">Start Workout ▶</button>
        </div>

        <!-- Screen 2: Active logging -->
        <div id="screen-active" class="hidden">
          <div class="timer-bar">
            <div id="timer-display" class="timer">00:00</div>
            <button id="pause-btn" class="btn-icon">⏸</button>
            <span id="paused-label" class="hidden paused-label">Paused</span>
          </div>
          <div id="exercises-container"></div>
          <button class="btn-secondary full-width" id="add-exercise-btn">+ Add Exercise</button>
          <button class="btn-primary full-width" style="margin-top:8px" id="finish-workout-btn">Finish Workout</button>
        </div>

        <!-- Screen 3: Post-workout -->
        <div id="screen-post" class="hidden">
          <div class="card" style="text-align:center;margin-bottom:16px">
            <div class="summary-value" id="duration-display"></div>
            <div class="stat-lbl">Active Time</div>
          </div>
          <div class="form-group">
            <label>Rate of Perceived Exertion: <span id="exert-val">5</span>/10</label>
            <input type="range" id="exertion" min="1" max="10" value="5" class="slider">
            <div class="slider-labels"><span>😌</span><span>🫠</span></div>
          </div>
          <div class="form-group">
            <label>Notes</label>
            <textarea id="workout-notes" class="input" rows="2" placeholder="How did it go?"></textarea>
          </div>
          <div class="form-group">
            <label><input type="checkbox" id="save-as-template"> Save as template for future use</label>
          </div>
          <div class="form-group hidden" id="template-name-group">
            <label>Template name</label>
            <input type="text" id="template-name-input" class="input" placeholder="e.g. Push Day">
          </div>
          <button class="btn-primary full-width" id="save-workout-btn">Save Workout</button>
        </div>
      </div>
    </div>

    ${templateModal(categories, bands)}
  `;
}

function templateModal(categories, bands) {
  return `
    <div class="modal-overlay hidden" id="template-modal">
      <div class="modal modal-large">
        <div class="modal-header">
          <h3>New Template</h3>
          <button class="modal-close" id="close-template-modal">✕</button>
        </div>
        <div class="form-group">
          <label>Template Name *</label>
          <input type="text" id="tmpl-name" class="input" placeholder="e.g. Push Day">
        </div>
        <div class="form-group">
          <label>Category</label>
          <select id="tmpl-cat" class="input">
            <option value="">None</option>
            ${categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
          </select>
        </div>
        <div id="tmpl-exercises"></div>
        <button class="btn-secondary full-width" id="tmpl-add-ex">+ Add Exercise</button>
        <button class="btn-primary full-width" style="margin-top:12px" id="save-template-btn">Save Template</button>
      </div>
    </div>
  `;
}

// ─── Exercise builder (shared between workout and template) ───────────────────

let exerciseList = [];  // draft exercises during logging

function addExerciseCard(container, bandsList, prefill = null) {
  const exId = uuid();
  const ex = {
    id: exId,
    name: prefill?.name || '',
    isBand: prefill?.isBand || false,
    sets: prefill?.sets?.map(() => ({
      id: uuid(),
      reps: prefill.sets[0]?.reps || 10,
      weight: prefill.sets[0]?.weight || 0,
      unit: prefill.sets[0]?.unit || 'kg',
      isWarmup: false,
      bandId: null
    })) || [
      { id: uuid(), reps: 10, weight: 0, unit: 'kg', isWarmup: false, bandId: null },
      { id: uuid(), reps: 10, weight: 0, unit: 'kg', isWarmup: false, bandId: null },
      { id: uuid(), reps: 10, weight: 0, unit: 'kg', isWarmup: false, bandId: null },
    ]
  };
  exerciseList.push(ex);

  const div = document.createElement('div');
  div.className = 'exercise-card';
  div.dataset.exid = exId;
  div.innerHTML = exerciseCardHTML(ex, bandsList);
  container.appendChild(div);
  bindExerciseCardEvents(div, ex, bandsList, container);
}

function exerciseCardHTML(ex, bands) {
  return `
    <div class="ex-header">
      <input type="text" class="input ex-name-input" placeholder="Exercise name" value="${ex.name}">
      <div class="toggle-group">
        <button class="toggle-btn ${!ex.isBand ? 'active' : ''}" data-mode="weight">Weight</button>
        <button class="toggle-btn ${ex.isBand ? 'active' : ''}" data-mode="band">Band</button>
      </div>
      <button class="delete-btn ex-delete">🗑</button>
    </div>
    <div class="sets-container">
      ${ex.sets.map(s => setRowHTML(s, ex.isBand, bands)).join('')}
    </div>
    <button class="btn-small add-set-btn">+ Add Set</button>
  `;
}

function setRowHTML(set, isBand, bands) {
  return `
    <div class="set-row" data-setid="${set.id}">
      <button class="warmup-btn ${set.isWarmup ? 'active' : ''}" title="Warmup">W</button>
      <div class="reps-control">
        <button class="reps-btn minus" data-setid="${set.id}">−</button>
        <span class="reps-val">${set.reps}</span>
        <button class="reps-btn plus" data-setid="${set.id}">+</button>
        <span class="reps-label">reps</span>
      </div>
      ${isBand ? `
        <div class="band-picker">
          ${bands.map(b => `
            <button class="band-dot ${set.bandId === b.id ? 'selected' : ''}"
              style="background:${b.colorHex}" data-bandid="${b.id}" title="${b.name}"></button>
          `).join('')}
        </div>
      ` : `
        <div class="weight-control">
          <input type="number" class="input weight-input" value="${set.weight}" min="0" step="0.5">
          <button class="unit-toggle">${set.unit}</button>
        </div>
      `}
      <button class="delete-btn set-delete" data-setid="${set.id}">✕</button>
    </div>
  `;
}

function bindExerciseCardEvents(div, ex, bands, exContainer) {
  // Name
  div.querySelector('.ex-name-input').addEventListener('input', e => { ex.name = e.target.value; });

  // Weight/Band toggle
  div.querySelectorAll('[data-mode]').forEach(btn => {
    btn.addEventListener('click', () => {
      ex.isBand = btn.dataset.mode === 'band';
      div.querySelectorAll('[data-mode]').forEach(b => b.classList.toggle('active', b === btn));
      div.querySelector('.sets-container').innerHTML = ex.sets.map(s => setRowHTML(s, ex.isBand, bands)).join('');
      bindSetEvents(div, ex, bands);
    });
  });

  // Delete exercise
  div.querySelector('.ex-delete').addEventListener('click', () => {
    exerciseList = exerciseList.filter(e => e.id !== ex.id);
    div.remove();
  });

  // Add set
  div.querySelector('.add-set-btn').addEventListener('click', () => {
    const lastSet = ex.sets[ex.sets.length - 1];
    const newSet = { id: uuid(), reps: lastSet?.reps || 10, weight: lastSet?.weight || 0,
      unit: lastSet?.unit || 'kg', isWarmup: false, bandId: lastSet?.bandId || null };
    ex.sets.push(newSet);
    const row = document.createElement('div');
    row.innerHTML = setRowHTML(newSet, ex.isBand, bands);
    div.querySelector('.sets-container').appendChild(row.firstElementChild);
    bindSetEvents(div, ex, bands);
  });

  bindSetEvents(div, ex, bands);
}

function bindSetEvents(div, ex, bands) {
  div.querySelectorAll('.reps-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const set = ex.sets.find(s => s.id === btn.dataset.setid);
      if (!set) return;
      if (btn.classList.contains('plus')) set.reps++;
      else if (set.reps > 1) set.reps--;
      btn.closest('.reps-control').querySelector('.reps-val').textContent = set.reps;
    });
  });

  div.querySelectorAll('.weight-input').forEach(input => {
    input.addEventListener('input', e => {
      const setId = e.target.closest('.set-row').dataset.setid;
      const set = ex.sets.find(s => s.id === setId);
      if (set) set.weight = parseFloat(e.target.value) || 0;
    });
  });

  div.querySelectorAll('.unit-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const setId = btn.closest('.set-row').dataset.setid;
      const set = ex.sets.find(s => s.id === setId);
      if (set) { set.unit = set.unit === 'kg' ? 'lbs' : 'kg'; btn.textContent = set.unit; }
    });
  });

  div.querySelectorAll('.warmup-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const setId = btn.closest('.set-row').dataset.setid;
      const set = ex.sets.find(s => s.id === setId);
      if (set) { set.isWarmup = !set.isWarmup; btn.classList.toggle('active', set.isWarmup); }
    });
  });

  div.querySelectorAll('.band-dot').forEach(btn => {
    btn.addEventListener('click', () => {
      const setId = btn.closest('.set-row').dataset.setid;
      const set = ex.sets.find(s => s.id === setId);
      if (set) {
        set.bandId = set.bandId === btn.dataset.bandid ? null : btn.dataset.bandid;
        div.querySelectorAll(`[data-setid="${setId}"] .band-dot`).forEach(b =>
          b.classList.toggle('selected', b.dataset.bandid === set.bandId));
      }
    });
  });

  div.querySelectorAll('.set-delete').forEach(btn => {
    btn.addEventListener('click', () => {
      const setId = btn.dataset.setid;
      ex.sets = ex.sets.filter(s => s.id !== setId);
      btn.closest('.set-row').remove();
    });
  });
}

// ─── Fitness events ───────────────────────────────────────────────────────────

function bindFitnessEvents(container, sessions, templates, categories, bands, records) {
  let startTime, pauseStart, totalPaused = 0, isPaused = false, timerInterval;

  // Start workout
  container.querySelector('#start-workout-btn')?.addEventListener('click', () => {
    exerciseList = [];
    container.querySelector('#workout-modal').classList.remove('hidden');
  });

  // Use template
  container.querySelectorAll('[data-use-template]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const tmpl = templates.find(t => t.id === btn.dataset.useTemplate);
      if (!tmpl) return;
      exerciseList = [];
      container.querySelector('#workout-cat').value = tmpl.categoryId || '';
      container.querySelector('#workout-modal').classList.remove('hidden');
      // Pre-fill exercises after switching to active screen
      container.querySelector('#start-logging-btn').dataset.templateId = tmpl.id;
    });
  });

  // Delete template
  container.querySelectorAll('[data-delete-template]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete template?')) return;
      await remove('workoutTemplates', btn.dataset.deleteTemplate);
      renderFitness(container);
    });
  });

  // Delete session
  container.querySelectorAll('[data-delete-session]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete this workout?')) return;
      await remove('workoutSessions', btn.dataset.deleteSession);
      renderFitness(container);
    });
  });

  // Close modals
  container.querySelector('#close-workout-modal')?.addEventListener('click', () => {
    clearInterval(timerInterval);
    container.querySelector('#workout-modal').classList.add('hidden');
    resetWorkoutModal(container);
  });

  // Willingness slider
  container.querySelector('#willingness')?.addEventListener('input', e => {
    container.querySelector('#will-val').textContent = e.target.value;
  });

  // Start logging
  container.querySelector('#start-logging-btn')?.addEventListener('click', () => {
    container.querySelector('#screen-pre').classList.add('hidden');
    container.querySelector('#screen-active').classList.remove('hidden');

    // Pre-fill from template if set
    const tmplId = container.querySelector('#start-logging-btn').dataset.templateId;
    const exContainer = container.querySelector('#exercises-container');
    if (tmplId) {
      const tmpl = templates.find(t => t.id === tmplId);
      tmpl?.exercises?.forEach(ex => addExerciseCard(exContainer, bands, ex));
    }

    startTime = Date.now();
    totalPaused = 0;
    timerInterval = setInterval(() => {
      if (!isPaused) {
        const elapsed = Math.floor((Date.now() - startTime - totalPaused) / 1000);
        container.querySelector('#timer-display').textContent = formatSeconds(elapsed);
      }
    }, 1000);
  });

  // Add exercise
  container.querySelector('#add-exercise-btn')?.addEventListener('click', () => {
    const exContainer = container.querySelector('#exercises-container');
    addExerciseCard(exContainer, bands);
  });

  // Pause
  container.querySelector('#pause-btn')?.addEventListener('click', () => {
    if (!isPaused) {
      isPaused = true;
      pauseStart = Date.now();
      container.querySelector('#pause-btn').textContent = '▶';
      container.querySelector('#paused-label').classList.remove('hidden');
    } else {
      totalPaused += Date.now() - pauseStart;
      isPaused = false;
      container.querySelector('#pause-btn').textContent = '⏸';
      container.querySelector('#paused-label').classList.add('hidden');
    }
  });

  // Finish workout
  container.querySelector('#finish-workout-btn')?.addEventListener('click', () => {
    clearInterval(timerInterval);
    const activeSecs = Math.floor((Date.now() - startTime - totalPaused) / 1000);
    container.querySelector('#screen-active').classList.add('hidden');
    container.querySelector('#screen-post').classList.remove('hidden');
    container.querySelector('#duration-display').textContent = formatSeconds(activeSecs);
    container.querySelector('#save-workout-btn').dataset.activeSecs = activeSecs;
  });

  // Exertion slider
  container.querySelector('#exertion')?.addEventListener('input', e => {
    container.querySelector('#exert-val').textContent = e.target.value;
  });

  // Template name toggle
  container.querySelector('#save-as-template')?.addEventListener('change', e => {
    container.querySelector('#template-name-group').classList.toggle('hidden', !e.target.checked);
  });

  // Save workout
  container.querySelector('#save-workout-btn')?.addEventListener('click', async () => {
    const activeSecs = parseInt(container.querySelector('#save-workout-btn').dataset.activeSecs || '0');
    const session = {
      id: uuid(),
      date: now(),
      durationMinutes: Math.floor(activeSecs / 60),
      categoryId: container.querySelector('#workout-cat').value || null,
      willingnessRating: parseInt(container.querySelector('#willingness').value),
      exertionRating: parseInt(container.querySelector('#exertion').value),
      notes: container.querySelector('#workout-notes').value,
      exercises: exerciseList.map(ex => ({
        id: ex.id, name: ex.name, isBand: ex.isBand,
        sets: ex.sets
      }))
    };
    await save('workoutSessions', session);

    // PR detection
    for (const ex of exerciseList.filter(e => !e.isBand)) {
      const best = ex.sets.filter(s => !s.isWarmup).sort((a,b) => b.weight - a.weight)[0];
      if (best && best.weight > 0) {
        const existing = records.find(r => r.exerciseName === ex.name.toLowerCase());
        if (!existing || best.weight > existing.weight) {
          await save('personalRecords', {
            id: uuid(), exerciseName: ex.name.toLowerCase(),
            weight: best.weight, reps: best.reps, unit: best.unit,
            achievedAt: now(), sessionId: session.id
          });
        }
      }
    }

    // Save as template
    if (container.querySelector('#save-as-template').checked) {
      const tmplName = container.querySelector('#template-name-input').value.trim();
      if (tmplName) {
        await save('workoutTemplates', {
          id: uuid(), name: tmplName,
          categoryId: session.categoryId,
          exercises: exerciseList.map(ex => ({
            name: ex.name, isBand: ex.isBand,
            sets: ex.sets.map(s => ({ reps: s.reps, weight: s.weight, unit: s.unit }))
          })),
          createdAt: now()
        });
      }
    }

    container.querySelector('#workout-modal').classList.add('hidden');
    resetWorkoutModal(container);
    renderFitness(container);
  });

  // New template from scratch
  container.querySelector('#new-template-btn')?.addEventListener('click', () => {
    container.querySelector('#template-modal').classList.remove('hidden');
    container.querySelector('#tmpl-exercises').innerHTML = '';
  });

  container.querySelector('#close-template-modal')?.addEventListener('click', () => {
    container.querySelector('#template-modal').classList.add('hidden');
  });

  container.querySelector('#tmpl-add-ex')?.addEventListener('click', () => {
    const exDiv = document.createElement('div');
    exDiv.innerHTML = `
      <div class="exercise-card" style="margin-bottom:10px">
        <input type="text" class="input tmpl-ex-name" placeholder="Exercise name" style="margin-bottom:6px">
        <div class="form-group">
          <label>Default sets</label>
          <input type="number" class="input tmpl-ex-sets" value="3" min="1" max="10">
        </div>
        <div class="form-group">
          <label>Default reps</label>
          <input type="number" class="input tmpl-ex-reps" value="10" min="1">
        </div>
      </div>
    `;
    container.querySelector('#tmpl-exercises').appendChild(exDiv.firstElementChild);
  });

  container.querySelector('#save-template-btn')?.addEventListener('click', async () => {
    const name = container.querySelector('#tmpl-name').value.trim();
    if (!name) return;
    const exCards = container.querySelectorAll('#tmpl-exercises .exercise-card');
    const exercises = Array.from(exCards).map(card => ({
      name: card.querySelector('.tmpl-ex-name').value,
      isBand: false,
      sets: Array.from({ length: parseInt(card.querySelector('.tmpl-ex-sets').value) || 3 },
        () => ({ reps: parseInt(card.querySelector('.tmpl-ex-reps').value) || 10, weight: 0, unit: 'kg' }))
    }));
    await save('workoutTemplates', {
      id: uuid(), name,
      categoryId: container.querySelector('#tmpl-cat').value || null,
      exercises, createdAt: now()
    });
    container.querySelector('#template-modal').classList.add('hidden');
    renderFitness(container);
  });
}

function resetWorkoutModal(container) {
  exerciseList = [];
  ['#screen-pre','#screen-active','#screen-post'].forEach((s,i) => {
    container.querySelector(s)?.classList.toggle('hidden', i !== 0);
  });
  const ex = container.querySelector('#exercises-container');
  if (ex) ex.innerHTML = '';
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatSeconds(s) {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
  return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
}

function formatDuration(mins) {
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins/60)}h ${mins%60}m`;
}
