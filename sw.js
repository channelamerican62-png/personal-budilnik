const CACHE_NAME = 'chronoguard-v2';
const ASSETS = [
    '/',
    '/index.html',
    '/styles.css',
    '/login.css',
    '/app.js',
    '/bg_image.png',
    'https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

// Install - skip waiting to activate immediately
self.addEventListener('install', event => {
    self.skipWaiting();
});

// Activate - purge ALL old caches
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys.map(k => caches.delete(k))
            );
        })
    );
    self.clients.claim();
});

// Fetch - NETWORK FIRST strategy to guarantee fresh updates
self.addEventListener('fetch', event => {
    if (event.request.method !== 'GET') return;
    if (event.request.url.includes('chronoguard-backend.onrender.com')) return;
    if (event.request.url.includes('open-meteo.com')) return;
    if (event.request.url.includes('nominatim.openstreetmap.org')) return;

    event.respondWith(
        fetch(event.request).then(response => {
            if (response && response.status === 200 && response.type === 'basic') {
                const cloned = response.clone();
                caches.open(CACHE_NAME).then(cache => cache.put(event.request, cloned));
            }
            return response;
        }).catch(() => caches.match(event.request))
    );
});

// Push Notifications handler
self.addEventListener('push', event => {
    const data = event.data ? event.data.json() : {};
    const title = data.title || 'ChronoGuard Eslatma';
    const options = {
        body: data.body || 'Sizda yangi eslatma bor!',
        icon: 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/svgs/solid/hourglass-half.svg',
        vibrate: [200, 100, 200],
        data: { url: data.url || '/' }
    };
    event.waitUntil(self.registration.showNotification(title, options));
});

// Notification click - open app
self.addEventListener('notificationclick', event => {
    event.notification.close();
    event.waitUntil(
        clients.openWindow(event.notification.data.url || '/')
    );
});
