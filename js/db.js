// ─── IndexedDB wrapper ───────────────────────────────────────────────────────

const DB_NAME = 'BloomPlannerDB';
const DB_VERSION = 1;

const STORES = [
  'tasks', 'categories', 'completionLogs',
  'workoutSessions', 'workoutExercises', 'exerciseSets',
  'personalRecords', 'workoutTemplates',
  'periodEntries', 'symptomLogs', 'resistanceBands', 'settings'
];

let _db = null;

export function openDB() {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      STORES.forEach(name => {
        if (!db.objectStoreNames.contains(name)) {
          db.createObjectStore(name, { keyPath: 'id' });
        }
      });
    };
    req.onsuccess = e => { _db = e.target.result; resolve(_db); };
    req.onerror = e => reject(e.target.error);
  });
}

export async function getAll(store) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getOne(store, id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).get(id);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function save(store, item) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    const req = tx.objectStore(store).put(item);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function remove(store, id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    const req = tx.objectStore(store).delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export function uuid() {
  return crypto.randomUUID();
}

export function now() {
  return new Date().toISOString();
}

// ─── Seed default data ────────────────────────────────────────────────────────

export async function seedIfNeeded() {
  const cats = await getAll('categories');
  if (cats.length > 0) return;

  const defaults = [
    { id: uuid(), name: 'Physical Therapy', colorHex: '#5BBFBF', createdAt: now() },
    { id: uuid(), name: 'Lifting',          colorHex: '#9B7FD4', createdAt: now() },
    { id: uuid(), name: 'Cardio',           colorHex: '#F0934A', createdAt: now() },
    { id: uuid(), name: 'Self-Care',        colorHex: '#E8A0A0', createdAt: now() },
    { id: uuid(), name: 'Work',             colorHex: '#6BAED6', createdAt: now() },
  ];
  for (const c of defaults) await save('categories', c);

  // Example tasks
  await save('tasks', {
    id: uuid(), title: 'Morning journal',
    notes: 'Write 3 things I\'m grateful for',
    taskType: 'daily', priority: 'low',
    categoryId: defaults[3].id,
    isCompleted: false, createdAt: now(), dueDate: null
  });
  await save('tasks', {
    id: uuid(), title: 'Physical therapy for hips',
    taskType: 'weekly', weeklyFrequency: 3,
    categoryId: defaults[0].id,
    weeklyCompletions: [], isCompleted: false, createdAt: now()
  });
  await save('tasks', {
    id: uuid(), title: 'Lash lift',
    taskType: 'monthly', monthlyPreferredDay: 15,
    categoryId: defaults[3].id,
    isCompleted: false, lastCompletedDate: null, createdAt: now()
  });

  // Settings
  await save('settings', { id: 'theme', baseColor: '#C97B8A' });
}
