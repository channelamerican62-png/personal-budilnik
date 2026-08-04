const fs = require('fs');
const jsdom = require('jsdom');
const { JSDOM } = jsdom;

const indexHtml = fs.readFileSync('index.html', 'utf8');
const appJs = fs.readFileSync('app.js', 'utf8');

const dom = new JSDOM(indexHtml, {
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
dom.window.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
dom.window.navigator.geolocation = { getCurrentPosition: (cb) => cb({coords: {latitude: 41, longitude: 69}}) };

dom.window.L = {
  map: () => ({ setView: () => ({ removeLayer: () => {}, fitBounds: () => {}, invalidateSize: () => {} }) }),
  tileLayer: () => ({ addTo: () => {} }),
  divIcon: () => ({}),
  marker: () => ({ addTo: () => ({ bindPopup: () => {} }) }),
  polyline: () => ({ addTo: () => {} }),
  latLngBounds: () => ({})
};
dom.window.Chart = class { constructor() { this.data = { datasets: [{ data: [] }] }; } update() {} };

try {
  dom.window.eval(appJs);
} catch (e) {
  console.log('EVAL ERROR:', e.stack || e);
}

setTimeout(() => {
    console.log('Time is:', dom.window.document.getElementById('liveTime').textContent);
    process.exit(0);
}, 2000);
