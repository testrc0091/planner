// ─── Settings Tab ────────────────────────────────────────────────────────────

import { getAll, save, remove, uuid, now, getOne } from './db.js';
import { applyTheme } from './theme.js';

export async function renderSettings(container) {
  const [categories, bands, settings] = await Promise.all([
    getAll('categories'), getAll('resistanceBands'), getOne('settings', 'theme')
  ]);

  container.innerHTML = `
    <div class="page-header">
      <h1 class="page-title">Settings</h1>
    </div>

    <!-- Theme -->
    <div class="settings-section">
      <div class="settings-label">Appearance</div>
      <div class="settings-card">
        <div class="settings-row">
          <span>App Theme Color</span>
          <input type="color" id="theme-color" value="${settings?.baseColor || '#C97B8A'}" class="color-wheel">
        </div>
        <div class="palette-preview" id="palette-preview">
          ${renderPalettePreview()}
        </div>
      </div>
    </div>

    <!-- Categories -->
    <div class="settings-section">
      <div class="settings-label">Categories</div>
      <div class="settings-card">
        <div id="categories-list">
          ${categories.map(c => categoryRow(c)).join('')}
        </div>
        <button class="btn-secondary full-width" id="add-cat-btn">+ Add Category</button>
      </div>
    </div>

    <!-- Resistance Bands -->
    <div class="settings-section">
      <div class="settings-label">Resistance Bands</div>
      <div class="settings-card">
        <div id="bands-list">
          ${bands.length === 0
            ? '<p class="empty-msg">No bands yet</p>'
            : bands.sort((a,b) => a.order - b.order).map(b => bandRow(b)).join('')}
        </div>
        <button class="btn-secondary full-width" id="add-band-btn">+ Add Band</button>
      </div>
    </div>

    <!-- About -->
    <div class="settings-section">
      <div class="settings-label">About</div>
      <div class="settings-card">
        <div class="settings-row">
          <span>🌸 Bloom Planner</span>
          <span class="muted">v1.0 PWA</span>
        </div>
        <div class="settings-row">
          <span>Data stored locally</span>
          <span class="muted">IndexedDB</span>
        </div>
      </div>
    </div>

    ${addCategoryModal()}
    ${addBandModal()}
  `;

  bindSettingsEvents(container, categories, bands);
}

function renderPalettePreview() {
  const vars = ['--blush','--rose','--mauve','--deep-rose','--card'];
  const labels = ['Blush','Rose','Mauve','Deep','Card'];
  return vars.map((v,i) => `
    <div class="palette-swatch">
      <div class="swatch-circle" style="background:var(${v})"></div>
      <div class="swatch-label">${labels[i]}</div>
    </div>
  `).join('');
}

function categoryRow(cat) {
  return `
    <div class="settings-row" data-catid="${cat.id}">
      <div class="row-left">
        <span class="color-dot" style="background:${cat.colorHex}"></span>
        <span>${cat.name}</span>
      </div>
      <div class="row-right">
        <input type="color" class="color-mini" value="${cat.colorHex}" data-recolor="${cat.id}">
        <button class="delete-btn" data-delete-cat="${cat.id}">🗑</button>
      </div>
    </div>
  `;
}

function bandRow(band) {
  return `
    <div class="settings-row" data-bandid="${band.id}">
      <div class="row-left">
        <span class="color-dot" style="background:${band.colorHex}"></span>
        <span>${band.name}</span>
      </div>
      <div class="row-right">
        <input type="color" class="color-mini" value="${band.colorHex}" data-recolor-band="${band.id}">
        <button class="delete-btn" data-delete-band="${band.id}">🗑</button>
      </div>
    </div>
  `;
}

function addCategoryModal() {
  return `
    <div class="modal-overlay hidden" id="add-cat-modal">
      <div class="modal">
        <div class="modal-header">
          <h3>New Category</h3>
          <button class="modal-close" id="close-cat-modal">✕</button>
        </div>
        <div class="modal-scroll">
          <div class="form-group">
            <label>Name *</label>
            <input type="text" id="cat-name" class="input" placeholder="e.g. Yoga"
              autocomplete="off" autocorrect="off">
          </div>
          <div class="form-group">
            <label>Color</label>
            <input type="color" id="cat-color" value="#C97B8A" class="color-wheel">
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-primary full-width" id="save-cat-btn">Add Category</button>
        </div>
      </div>
    </div>
  `;
}

function addBandModal() {
  return `
    <div class="modal-overlay hidden" id="add-band-modal">
      <div class="modal">
        <div class="modal-header">
          <h3>New Resistance Band</h3>
          <button class="modal-close" id="close-band-modal">✕</button>
        </div>
        <div class="modal-scroll">
          <div class="form-group">
            <label>Name *</label>
            <input type="text" id="band-name" class="input" placeholder="e.g. Light Blue"
              autocomplete="off" autocorrect="off">
          </div>
          <div class="form-group">
            <label>Color</label>
            <input type="color" id="band-color" value="#5BBFBF" class="color-wheel">
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-primary full-width" id="save-band-btn">Add Band</button>
        </div>
      </div>
    </div>
  `;
}

function bindSettingsEvents(container, categories, bands) {
  // Theme color wheel — live preview
  let themeTimeout;
  container.querySelector('#theme-color')?.addEventListener('input', async e => {
    clearTimeout(themeTimeout);
    themeTimeout = setTimeout(async () => {
      await applyTheme(e.target.value);
      container.querySelector('#palette-preview').innerHTML = renderPalettePreview();
    }, 200);
  });

  // Category CRUD
  container.querySelector('#add-cat-btn')?.addEventListener('click', () => {
    container.querySelector('#add-cat-modal').classList.remove('hidden');
  });
  container.querySelector('#close-cat-modal')?.addEventListener('click', () => {
    container.querySelector('#add-cat-modal').classList.add('hidden');
  });
  container.querySelector('#save-cat-btn')?.addEventListener('click', async () => {
    const name = container.querySelector('#cat-name').value.trim();
    if (!name) return;
    await save('categories', {
      id: uuid(), name,
      colorHex: container.querySelector('#cat-color').value,
      createdAt: now()
    });
    renderSettings(container);
  });

  container.querySelectorAll('[data-delete-cat]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete category? Affected tasks will become uncategorized.')) return;
      await remove('categories', btn.dataset.deleteCat);
      renderSettings(container);
    });
  });

  container.querySelectorAll('[data-recolor]').forEach(input => {
    input.addEventListener('change', async e => {
      const cat = categories.find(c => c.id === e.target.dataset.recolor);
      if (cat) { cat.colorHex = e.target.value; await save('categories', cat); }
    });
  });

  // Band CRUD
  container.querySelector('#add-band-btn')?.addEventListener('click', () => {
    container.querySelector('#add-band-modal').classList.remove('hidden');
  });
  container.querySelector('#close-band-modal')?.addEventListener('click', () => {
    container.querySelector('#add-band-modal').classList.add('hidden');
  });
  container.querySelector('#save-band-btn')?.addEventListener('click', async () => {
    const name = container.querySelector('#band-name').value.trim();
    if (!name) return;
    await save('resistanceBands', {
      id: uuid(), name,
      colorHex: container.querySelector('#band-color').value,
      order: bands.length, createdAt: now()
    });
    renderSettings(container);
  });

  container.querySelectorAll('[data-delete-band]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete band?')) return;
      await remove('resistanceBands', btn.dataset.de
