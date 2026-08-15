import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createContext, runInContext } from 'node:vm';
import { spawnSync } from 'node:child_process';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataFiles = [
    path.join(rootDir, 'data', 'catalog.js'),
    path.join(rootDir, 'data', 'french.js'),
    path.join(rootDir, 'data', 'korean.js'),
    path.join(rootDir, 'data', 'hebrew.js'),
];
const validatorFile = path.join(rootDir, 'scripts', 'validate-content.mjs');
const stableLevels = ['beginner', 'intermediate', 'advanced'];

function assertFileExists(filePath) {
    assert.ok(existsSync(filePath), `Expected file to exist: ${path.relative(rootDir, filePath)}`);
    return filePath;
}

function loadBrowserData() {
    const sandbox = { console };
    sandbox.window = sandbox;
    sandbox.globalThis = sandbox;
    sandbox.self = sandbox;
    const context = createContext(sandbox);

    for (const filePath of dataFiles.map(assertFileExists)) {
        runInContext(readFileSync(filePath, 'utf8'), context, { filename: filePath });
    }

    return sandbox;
}

test('split browser data loads through a shared catalog with three stable levels', () => {
    const sandbox = loadBrowserData();

    assert.deepEqual(Object.keys(sandbox.LEVELS), stableLevels);
    assert.equal(sandbox.CATLINGO_CONTENT.catalog.languages, sandbox.LANGS);
    assert.equal(sandbox.CATLINGO_CONTENT.catalog.themes, sandbox.THEMES);
    assert.equal(sandbox.CATLINGO_CONTENT.catalog.levels, sandbox.LEVELS);
    assert.equal(sandbox.CATLINGO_CONTENT.phraseBanks, sandbox.LEVEL_DEMO);
    assert.equal(sandbox.CATLINGO_CONTENT.lessons, sandbox.LESSONS);
    assert.equal(sandbox.CATLINGO_CONTENT.glosses, sandbox.GLOSS);

    for (const lang of ['french', 'korean', 'hebrew']) {
        assert.ok(sandbox.LANGS[lang], `Missing language metadata for ${lang}`);
        assert.ok(sandbox.THEMES[lang], `Missing theme for ${lang}`);
        assert.ok(sandbox.LEVEL_DEMO[lang], `Missing phrase bank for ${lang}`);
        assert.ok(Array.isArray(sandbox.LESSONS[lang]), `Lessons for ${lang} must be an array`);
        assert.ok(sandbox.GLOSS[lang] && typeof sandbox.GLOSS[lang] === 'object', `Missing glosses for ${lang}`);

        for (const level of stableLevels) {
            assert.ok(Array.isArray(sandbox.LEVEL_DEMO[lang][level]), `Missing ${lang}.${level} phrase list`);
        }
    }
});

test('content validator passes in structure-only mode', () => {
    assertFileExists(validatorFile);
    const result = spawnSync(process.execPath, [validatorFile, '--structure-only'], {
        cwd: rootDir,
        encoding: 'utf8',
    });

    assert.equal(result.status, 0, result.stdout + result.stderr);
});

test('content validator reports incomplete launch coverage in full mode', () => {
    assertFileExists(validatorFile);
    const result = spawnSync(process.execPath, [validatorFile], {
        cwd: rootDir,
        encoding: 'utf8',
    });

    assert.notEqual(result.status, 0, 'Expected full validation to fail until launch coverage is complete');
    assert.match(result.stdout + result.stderr, /launch coverage/i);
});
