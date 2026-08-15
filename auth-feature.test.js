const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const rootDir = __dirname;
const htmlPath = path.join(rootDir, 'lang.html');
const appPath = path.join(rootDir, 'lang-app.js');
const configPath = path.join(rootDir, 'lang-config.js');
const authPath = path.join(rootDir, 'lang-auth.js');

function createNode(id) {
    return {
        id,
        style: { display: '' },
        textContent: '',
        src: '',
        dataset: {},
    };
}

function createDocument() {
    const nodes = new Map();
    return {
        getElementById(id) {
            if (!nodes.has(id)) nodes.set(id, createNode(id));
            return nodes.get(id);
        },
    };
}

function createFirebaseStub(existingProfiles = {}) {
    const profiles = new Map(Object.entries(existingProfiles));
    const setCalls = [];
    const authApi = {
        lastProvider: null,
        signedOut: false,
        onAuthStateChanged(callback) {
            this.callback = callback;
            return () => { this.callback = null; };
        },
        async signInWithPopup(provider) {
            this.lastProvider = provider;
        },
        async signOut() {
            this.signedOut = true;
        },
    };

    const firestoreApi = {
        collection(name) {
            assert.equal(name, 'users');
            return {
                doc(uid) {
                    return {
                        async get() {
                            return {
                                exists: profiles.has(uid),
                                data() { return profiles.get(uid); },
                            };
                        },
                        async set(data, options) {
                            setCalls.push({ uid, data, options });
                            const next = options && options.merge && profiles.has(uid)
                                ? { ...profiles.get(uid), ...data }
                                : data;
                            profiles.set(uid, next);
                        },
                    };
                },
            };
        },
    };

    const firebase = {
        apps: [],
        initializeApp(config) {
            this.apps.push({ config });
            return this.apps[this.apps.length - 1];
        },
        auth() {
            return authApi;
        },
        firestore() {
            return firestoreApi;
        },
    };

    firebase.auth.GoogleAuthProvider = class GoogleAuthProvider {};
    firebase.firestore.FieldValue = {
        serverTimestamp() {
            return 'SERVER_TIMESTAMP';
        },
    };

    return { firebase, authApi, setCalls };
}

test('static auth wiring removes bundled firebase and keeps auth off by default', () => {
    const html = fs.readFileSync(htmlPath, 'utf8');
    const appSource = fs.readFileSync(appPath, 'utf8');

    assert.equal(/<script[^>]+firebasejs\/10\.14\.1\/firebase-[^"]+-compat\.js/.test(html), false, 'lang.html should not eagerly load Firebase scripts');
    assert.ok(fs.existsSync(configPath), 'Expected a central browser config file');

    const config = require(configPath);
    assert.equal(config.features.firebaseAuth, false, 'Firebase auth should default to disabled');
    assert.equal(/\bfirebase\./.test(appSource), false, 'lang-app.js should not directly touch the firebase global');
});

test('disabled auth neither loads firebase scripts nor exposes auth UI', async () => {
    assert.ok(fs.existsSync(authPath), 'Expected an auth lifecycle service file');

    const { createAuthService } = require(authPath);
    const documentObj = createDocument();
    const loadedScripts = [];
    const service = createAuthService({
        config: {
            features: { firebaseAuth: false },
            firebase: { scripts: ['one.js', 'two.js', 'three.js'] },
        },
        documentObj,
        windowObj: {},
        loadScript: async (url) => loadedScripts.push(url),
        log: { error() {} },
    });

    const result = await service.start();

    assert.equal(result.enabled, false);
    assert.equal(result.ready, false);
    assert.deepEqual(loadedScripts, []);
    assert.equal(documentObj.getElementById('googleLoginBtn').style.display, 'none');
    assert.equal(documentObj.getElementById('topLoginBtn').style.display, 'none');
    assert.equal(documentObj.getElementById('logoutBtn').style.display, 'none');
    assert.equal(documentObj.getElementById('userAvatar').style.display, 'none');
    assert.equal(documentObj.getElementById('userName').style.display, 'none');
});

test('enabled auth loads compat scripts and syncs language and level profile fields', async () => {
    assert.ok(fs.existsSync(configPath), 'Expected a central browser config file');
    assert.ok(fs.existsSync(authPath), 'Expected an auth lifecycle service file');

    const config = require(configPath);
    const { createAuthService } = require(authPath);
    const documentObj = createDocument();
    const loadedScripts = [];
    const { firebase, authApi, setCalls } = createFirebaseStub();
    const service = createAuthService({
        config: {
            ...config,
            features: { ...config.features, firebaseAuth: true },
        },
        documentObj,
        windowObj: { firebase },
        loadScript: async (url) => loadedScripts.push(url),
        log: { error(err) { throw err instanceof Error ? err : new Error(String(err)); } },
    });

    const startResult = await service.start();
    assert.equal(startResult.ready, true);
    assert.deepEqual(loadedScripts, config.firebase.scripts);

    const user = {
        uid: 'cat-user',
        displayName: 'Le Chat',
        email: 'cat@example.com',
        photoURL: 'https://example.com/cat.png',
    };

    const profile = await service.ensureUserProfile(user);
    assert.equal(profile.selectedLanguage, null);
    assert.equal(profile.selectedLevel, null);

    await service.saveUserProfile(user, {
        selectedLanguage: 'korean',
        selectedLevel: null,
    });
    assert.deepEqual(setCalls.at(-1), {
        uid: 'cat-user',
        data: {
            selectedLanguage: 'korean',
            selectedLevel: null,
            updatedAt: 'SERVER_TIMESTAMP',
        },
        options: { merge: true },
    });

    service.renderAuthUi(null);
    assert.notEqual(documentObj.getElementById('topLoginBtn').style.display, 'none');

    await service.signInWithGoogle();
    assert.ok(authApi.lastProvider instanceof firebase.auth.GoogleAuthProvider);

    service.renderAuthUi(user);
    assert.equal(documentObj.getElementById('topLoginBtn').style.display, 'none');
    assert.equal(documentObj.getElementById('logoutBtn').style.display, '');
    assert.equal(documentObj.getElementById('userName').textContent, 'Le Chat');
});

test('enabled auth initialization failures surface in login error and console state', async () => {
    assert.ok(fs.existsSync(authPath), 'Expected an auth lifecycle service file');

    const { createAuthService } = require(authPath);
    const documentObj = createDocument();
    const errors = [];
    const service = createAuthService({
        config: {
            features: { firebaseAuth: true },
            firebase: {
                scripts: ['https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js'],
                project: { projectId: 'cat-language-1ecd4' },
            },
        },
        documentObj,
        windowObj: {},
        loadScript: async () => {
            throw new Error('network down');
        },
        log: {
            error(...args) {
                errors.push(args.join(' '));
            },
        },
    });

    const result = await service.start();

    assert.equal(result.ready, false);
    assert.match(documentObj.getElementById('loginError').textContent, /network down/i);
    assert.equal(errors.length, 1);
});
