const fs = require('fs');
const appJs = fs.readFileSync('app.js', 'utf8');
const indexHtml = fs.readFileSync('index.html', 'utf8');

let missing = [];
const idMatches = [...appJs.matchAll(/getElementById\(['"`](\w+)['"`]\)/g)].map(m => m[1]);
idMatches.forEach(id => {
    if (!indexHtml.includes(`id="${id}"`) && !indexHtml.includes(`id='${id}'`)) {
        missing.push(id);
    }
});
console.log('Missing IDs:', new Set(missing));

let missingClasses = [];
const classMatches = [...appJs.matchAll(/querySelector\(['"`]\.([\w-]+)['"`]\)/g)].map(m => m[1]);
classMatches.forEach(cls => {
    if (!indexHtml.includes(`class="${cls}`) && !indexHtml.includes(` ${cls} `) && !indexHtml.includes(`"${cls}"`)) {
        missingClasses.push(cls);
    }
});
console.log('Missing Classes:', new Set(missingClasses));
