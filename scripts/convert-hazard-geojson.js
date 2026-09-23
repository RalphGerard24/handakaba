const fs = require('fs');

const inputFile = 'MetroManila_Flood_5year.json';
const outputFile = 'MetroManila_Flood_5year.geojson';

console.log('Reading file...');
const data = JSON.parse(fs.readFileSync(inputFile, 'utf8'));

console.log('Converting...');
let geojson;
if (data.type && data.type === 'FeatureCollection') {
    geojson = data;
} else if (data.features) {
    geojson = {type: "FeatureCollection", features: data.features};
} else {
    geojson = {type: "FeatureCollection", features: Array.isArray(data) ? data : [data]};
}

console.log('Writing file...');
fs.writeFileSync(outputFile, JSON.stringify(geojson, null, 2));

console.log('Done! Created ' + outputFile);
console.log('Features: ' + (geojson.features || []).length);
console.log('Size: ' + (fs.statSync(outputFile).size / 1024 / 1024).toFixed(2) + ' MB');