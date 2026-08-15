const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const repoRoot = path.resolve(__dirname, '..');
const appSource = fs.readFileSync(path.join(repoRoot, 'lang-app.js'), 'utf8');

function loadCatImageService() {
    const match = appSource.match(/const CatImageService = \(\(\) => \{[\s\S]*?\n\}\)\(\);/);
    assert.ok(match, 'Expected CatImageService module in lang-app.js');

    const sandbox = {
        URL,
        console,
        Math: Object.create(Math),
        setTimeout,
        clearTimeout,
        globalThis: {},
    };
    vm.runInNewContext(`${match[0]}\nglobalThis.CatImageService = CatImageService;`, sandbox);
    return sandbox.globalThis.CatImageService;
}

function createClassList() {
    const items = new Set();
    return {
        add(value) { items.add(value); },
        remove(value) { items.delete(value); },
        contains(value) { return items.has(value); },
    };
}

function createImageElement() {
    const attrs = new Map();
    return {
        src: '',
        alt: '',
        dataset: {},
        style: {},
        classList: createClassList(),
        setAttribute(name, value) { attrs.set(name, String(value)); },
        removeAttribute(name) { attrs.delete(name); },
        getAttribute(name) { return attrs.get(name); },
    };
}

test('builds a Cataas URL with the encoded keyword', () => {
    const service = loadCatImageService();
    const url = service.__test__.buildCataasUrl('Salut chat & café');
    assert.equal(
        url,
        'https://cataas.com/cat/says/Salut%20chat%20%26%20caf%C3%A9?size=200&color=white&fontSize=22',
    );
});

test('resolves fallback asset URLs for file and GitHub Pages bases', () => {
    const service = loadCatImageService();
    const photo = service.__test__.getFallbackPhotos('https://example.github.io/catlang/lang.html')[0];
    const localPhoto = service.__test__.getFallbackPhotos('file:///C:/Users/example/catlang/lang.html')[0];

    assert.match(photo.src, /^https:\/\/example\.github\.io\/catlang\/assets\/cats\/.+\.jpg$/);
    assert.match(localPhoto.src, /^file:\/\/\/C:\/Users\/example\/catlang\/assets\/cats\/.+\.jpg$/);
});

test('falls back to a local asset when the Cataas image fails', async () => {
    const service = loadCatImageService();
    const img = createImageElement();
    const calls = [];

    const instance = service.__test__.createCatImageService({
        imageEl: img,
        baseHref: 'https://example.github.io/catlang/lang.html',
        random: () => 0,
        loadSource: async (src) => {
            calls.push(src);
            if (src.includes('cataas.com')) throw new Error('timeout');
            return { src };
        },
    });

    const result = await instance.load('Bonjour', 'french');

    assert.equal(result.source, 'fallback');
    assert.equal(result.applied, true);
    assert.equal(img.style.opacity, '1');
    assert.equal(img.dataset.catSource, 'fallback');
    assert.match(img.src, /^https:\/\/example\.github\.io\/catlang\/assets\/cats\/.+\.jpg$/);
    assert.equal(img.alt, 'Photo d’un chat pour « Bonjour »');
    assert.equal(calls.length, 2);
});

test('falls back to a local asset when the Cataas decode step rejects', async () => {
    const service = loadCatImageService();
    const img = createImageElement();
    const remoteUrl = service.__test__.buildCataasUrl('Decode');
    const fallbackUrl = service.__test__.getFallbackPhotos('https://example.github.io/catlang/lang.html')[0].src;
    const createImage = () => {
        const stub = {
            complete: false,
            naturalWidth: 100,
            onload: null,
            onerror: null,
            decode: () => Promise.reject(new Error('decode failed')),
        };
        Object.defineProperty(stub, 'src', {
            get() { return stub._src || ''; },
            set(value) {
                stub._src = value;
                Promise.resolve().then(() => {
                    if (value === remoteUrl) {
                        stub.onload && stub.onload();
                        return;
                    }
                    stub.decode = () => Promise.resolve();
                    stub.onload && stub.onload();
                });
            },
        });
        return stub;
    };

    const instance = service.__test__.createCatImageService({
        imageEl: img,
        baseHref: 'https://example.github.io/catlang/lang.html',
        random: () => 0,
        loadSource: service.__test__.createBrowserLoader(createImage),
    });

    const result = await instance.load('Decode', 'french');

    assert.equal(result.source, 'fallback');
    assert.equal(result.applied, true);
    assert.equal(img.dataset.catSource, 'fallback');
    assert.equal(img.src, fallbackUrl);
    assert.equal(img.alt, 'Photo d’un chat pour « Decode »');
});

test('ignores stale earlier requests so the latest image wins', async () => {
    const service = loadCatImageService();
    const img = createImageElement();
    const pending = new Map();

    const instance = service.__test__.createCatImageService({
        imageEl: img,
        baseHref: 'https://example.github.io/catlang/lang.html',
        loadSource: (src) => new Promise((resolve, reject) => {
            pending.set(src, { resolve, reject });
        }),
    });

    const first = instance.load('Premier', 'french');
    const second = instance.load('Second', 'french');

    const firstUrl = service.__test__.buildCataasUrl('Premier');
    const secondUrl = service.__test__.buildCataasUrl('Second');

    pending.get(secondUrl).resolve({ src: secondUrl });
    const secondResult = await second;
    assert.equal(secondResult.applied, true);
    assert.equal(img.src, secondUrl);
    assert.equal(img.alt, 'Photo d’un chat pour « Second »');

    pending.get(firstUrl).resolve({ src: firstUrl });
    const firstResult = await first;
    assert.equal(firstResult.stale, true);
    assert.equal(img.src, secondUrl);
    assert.equal(img.alt, 'Photo d’un chat pour « Second »');
});
