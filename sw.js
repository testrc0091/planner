const CACHE = 'bloom-v2';
const ASSETS = [
  '/planner/',
  '/planner/index.html',
  '/planner/css/styles.css',
  '/planner/js/db.js',
  '/planner/js/app.js',
  '/planner/js/router.js',
  '/planner/js/today.js',
  '/planner/js/weekly.js',
  '/planner/js/monthly.js',
  '/planner/js/fitness.js',
  '/planner/js/calendar.js',
  '/planner/js/symptoms.js',
  '/planner/js/settings.js'
];
const ASSETS = [
  '/', '/index.html', '/css/styles.css',
  '/js/db.js', '/js/app.js', '/js/router.js',
  '/js/today.js', '/js/weekly.js', '/js/monthly.js',
  '/js/fitness.js', '/js/calendar.js', '/js/symptoms.js',
  '/js/settings.js'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request))
  );
});
