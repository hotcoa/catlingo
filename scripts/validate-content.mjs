import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createContext, runInContext } from 'node:vm';

export const STABLE_LEVELS = ['beginner', 'intermediate', 'advanced'];
export const LAUNCH_TARGET = { languages: 4, levels: STABLE_LEVELS.length, phrasesPerLevel: 25 };
export const DEFAULT_DATA_FILES = [
    'data/catalog.js',
    'data/french.js',
    'data/korean.js',
    'data/hebrew.js',
    'data/spanish.js',
];

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const DEFAULT_ROOT = path.resolve(path.dirname(SCRIPT_PATH), '..');

export function loadBrowserContent(rootDir = DEFAULT_ROOT, relativeFiles = DEFAULT_DATA_FILES) {
    const sandbox = { console };
    sandbox.window = sandbox;
    sandbox.globalThis = sandbox;
    sandbox.self = sandbox;
    const context = createContext(sandbox);
    const files = [];

    for (const relativeFile of relativeFiles) {
        const absoluteFile = path.join(rootDir, relativeFile);
        if (!fs.existsSync(absoluteFile)) {
            throw new Error(`Missing content file: ${relativeFile}`);
        }
        runInContext(fs.readFileSync(absoluteFile, 'utf8'), context, { filename: absoluteFile });
        files.push(absoluteFile);
    }

    const globals = runInContext('({ CATLINGO_CONTENT, LANGS, THEMES, LEVELS, LEVEL_DEMO, LESSONS, GLOSS, DEMO })', context);
    return { rootDir, files, ...globals };
}

export function validateBrowserContent(content, { structureOnly = false } = {}) {
    const errors = [];
    const warnings = [];
    const stats = { languages: {} };

    const fail = message => errors.push(message);
    const registry = content.CATLINGO_CONTENT;

    if (!registry || typeof registry !== 'object') {
        fail('Missing CATLINGO_CONTENT registry.');
    }

    if (content.LANGS !== registry?.catalog?.languages) fail('LANGS must point at CATLINGO_CONTENT.catalog.languages.');
    if (content.THEMES !== registry?.catalog?.themes) fail('THEMES must point at CATLINGO_CONTENT.catalog.themes.');
    if (content.LEVELS !== registry?.catalog?.levels) fail('LEVELS must point at CATLINGO_CONTENT.catalog.levels.');
    if (content.LEVEL_DEMO !== registry?.phraseBanks) fail('LEVEL_DEMO must point at CATLINGO_CONTENT.phraseBanks.');
    if (content.LESSONS !== registry?.lessons) fail('LESSONS must point at CATLINGO_CONTENT.lessons.');
    if (content.GLOSS !== registry?.glosses) fail('GLOSS must point at CATLINGO_CONTENT.glosses.');

    const levelKeys = Object.keys(content.LEVELS || {});
    if (levelKeys.length !== STABLE_LEVELS.length || levelKeys.some((level, index) => level !== STABLE_LEVELS[index])) {
        fail(`LEVELS must define exactly these stable keys in order: ${STABLE_LEVELS.join(', ')}.`);
    }

    const languages = Object.keys(content.LANGS || {});
    if (!languages.length) {
        fail('No languages were loaded.');
    }

    for (const lang of languages) {
        stats.languages[lang] = {};

        if (!content.THEMES || !content.THEMES[lang]) {
            fail(`Missing theme for language: ${lang}.`);
        }

        const bank = content.LEVEL_DEMO && content.LEVEL_DEMO[lang];
        if (!bank || typeof bank !== 'object' || Array.isArray(bank)) {
            fail(`Missing phrase bank object for language: ${lang}.`);
            continue;
        }

        const unknownLevels = Object.keys(bank).filter(level => !STABLE_LEVELS.includes(level));
        if (unknownLevels.length) {
            fail(`Unknown level keys in ${lang}: ${unknownLevels.join(', ')}.`);
        }

        for (const level of STABLE_LEVELS) {
            const phrases = bank[level];
            stats.languages[lang][level] = Array.isArray(phrases) ? phrases.length : 0;

            if (!Array.isArray(phrases)) {
                fail(`Phrase bank ${lang}.${level} must be an array.`);
                continue;
            }

            const seenPhrases = new Map();
            phrases.forEach((phrase, index) => {
                const label = `${lang}.${level}[${index}]`;
                if (!phrase || typeof phrase !== 'object' || Array.isArray(phrase)) {
                    fail(`${label} must be an object.`);
                    return;
                }
                if (typeof phrase.p !== 'string' || !phrase.p.trim()) {
                    fail(`${label}.p must be a non-empty string.`);
                }
                if (typeof phrase.m !== 'string' || !phrase.m.trim()) {
                    fail(`${label}.m must be a non-empty string.`);
                }
                if ('kw' in phrase) {
                    const validKeywords = Array.isArray(phrase.kw) && phrase.kw.every(keyword => typeof keyword === 'string' && keyword.trim());
                    if (!validKeywords) {
                        fail(`${label}.kw must be an array of non-empty strings when provided.`);
                    }
                }
                if (typeof phrase.p === 'string') {
                    if (seenPhrases.has(phrase.p)) {
                        const duplicateMessage = `Duplicate exact target phrase in ${lang}.${level}: "${phrase.p}".`;
                        if (structureOnly) {
                            warnings.push(duplicateMessage);
                        } else {
                            fail(duplicateMessage);
                        }
                    } else {
                        seenPhrases.set(phrase.p, index);
                    }
                }
            });
        }

        const lessons = content.LESSONS && content.LESSONS[lang];
        if (!Array.isArray(lessons)) {
            fail(`Lessons for ${lang} must be an array.`);
        }

        const glosses = content.GLOSS && content.GLOSS[lang];
        if (!glosses || typeof glosses !== 'object' || Array.isArray(glosses)) {
            fail(`Glosses for ${lang} must be an object.`);
        }
    }

    if (!structureOnly) {
        if (languages.length < LAUNCH_TARGET.languages) {
            fail(`Launch coverage requires at least ${LAUNCH_TARGET.languages} languages; found ${languages.length}.`);
        }

        for (const lang of languages) {
            for (const level of STABLE_LEVELS) {
                const count = stats.languages[lang]?.[level] || 0;
                if (count < LAUNCH_TARGET.phrasesPerLevel) {
                    fail(`Launch coverage shortfall: ${lang}.${level} has ${count}/${LAUNCH_TARGET.phrasesPerLevel} phrases.`);
                }
            }
        }
    }

    return { errors, warnings, stats };
}

export function formatValidationReport(result, { structureOnly = false } = {}) {
    const lines = [];
    lines.push(`Validated ${Object.keys(result.stats.languages).length} loaded language(s).`);
    lines.push(`Mode: ${structureOnly ? 'structure-only' : 'full launch coverage'}`);

    for (const [lang, counts] of Object.entries(result.stats.languages)) {
        lines.push(`- ${lang}: ${STABLE_LEVELS.map(level => `${level}=${counts[level] ?? 0}`).join(', ')}`);
    }

    if (!structureOnly) {
        lines.push(`Launch coverage target: ${LAUNCH_TARGET.languages} languages x ${LAUNCH_TARGET.levels} levels x ${LAUNCH_TARGET.phrasesPerLevel} phrases.`);
    }

    if (result.warnings.length) {
        lines.push('Warnings:');
        for (const warning of result.warnings) {
            lines.push(`  - ${warning}`);
        }
    }

    if (result.errors.length) {
        lines.push('Errors:');
        for (const error of result.errors) {
            lines.push(`  - ${error}`);
        }
    } else {
        lines.push('OK');
    }

    return lines.join('\n');
}

function parseArgs(argv) {
    return { structureOnly: argv.includes('--structure-only') };
}

function main(argv = process.argv.slice(2)) {
    const options = parseArgs(argv);
    const content = loadBrowserContent();
    const result = validateBrowserContent(content, options);
    console.log(formatValidationReport(result, options));
    process.exitCode = result.errors.length ? 1 : 0;
}

if (process.argv[1] === SCRIPT_PATH) {
    try {
        main();
    } catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        process.exitCode = 1;
    }
}
