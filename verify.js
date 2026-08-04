const fs = require('fs');
const jsdom = require('jsdom');
const { JSDOM } = jsdom;

const indexHtml = fs.readFileSync('index.html', 'utf8');
const appJs = fs.readFileSync('app.js', 'utf8');

const dom = new JSDOM(indexHtml, {
  url: "http://localhost/", // This fixes the localStorage SecurityError!
  runScripts: "dangerously",
  resources: "usable"
});

process.on('uncaughtException', (err) => {
    console.log('UNCAUGHT EXCEPTION:', err.stack || err);
});
process.on('unhandledRejection', (reason) => {
    console.log('UNHANDLED REJECTION:', reason.stack || reason);
});

// Polyfill window functions
dom.window.fetch = async () => ({ json: async () => ({ success: true, account: {} }) });
dom.window.navigator.geolocation = { getCurrentPosition: (cb) => cb({coords: {latitude: 41, longitude: 69}}) };

// Polyfill ResizeObserver
dom.window.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
};

dom.window.L = {
  map: () => ({ setView: () => ({ removeLayer: () => {}, fitBounds: () => {}, invalidateSize: () => {} }) }),
  tileLayer: () => ({ addTo: () => {} }),
  divIcon: () => ({}),
  marker: () => ({ addTo: () => ({ bindPopup: () => {} }) }),
  polyline: () => ({ addTo: () => {} }),
  latLngBounds: () => ({})
};
// Use real Chart.js via JSDOM resources but it uses ResizeObserver so we polyfilled it

try {
  dom.window.eval(appJs);
} catch (e) {
  console.log('EVAL ERROR:', e.stack || e);
}

setTimeout(() => {
    console.log('Time is:', dom.window.document.getElementById('liveTime').textContent);
    process.exit(0);
}, 2000);
