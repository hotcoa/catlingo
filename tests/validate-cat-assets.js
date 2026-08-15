const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const repoRoot = path.resolve(__dirname, '..');
const assetsDir = path.join(repoRoot, 'assets', 'cats');
const readmePath = path.join(assetsDir, 'README.md');
const appSource = fs.readFileSync(path.join(repoRoot, 'lang-app.js'), 'utf8');

assert.ok(fs.existsSync(assetsDir), 'Expected assets/cats directory');
assert.ok(fs.existsSync(readmePath), 'Expected assets/cats/README.md');

const assetFiles = fs.readdirSync(assetsDir)
    .filter((name) => /\.(jpe?g)$/i.test(name))
    .sort();

assert.ok(assetFiles.length >= 3, 'Expected at least three local cat fallback photos');

const readme = fs.readFileSync(readmePath, 'utf8');
for (const file of assetFiles) {
    assert.match(readme, new RegExp(file.replace('.', '\\.')), `README is missing ${file}`);
}

assert.match(readme, /https?:\/\//, 'README should include source URLs');
assert.match(readme, /(CC0|Public Domain)/i, 'README should record a reusable license');
assert.match(appSource, /assets\/cats\/.+\.jpg/, 'lang-app.js should reference local cat assets');

console.log(`Validated ${assetFiles.length} fallback cat assets.`);
