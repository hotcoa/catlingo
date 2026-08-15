(function (root, factory) {
    const api = factory();
    root.CatlingoAuth = api;
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    function setDisplay(node, visible) {
        if (!node) return;
        node.style.display = visible ? '' : 'none';
    }

    function getNode(documentObj, id) {
        return documentObj && typeof documentObj.getElementById === 'function'
            ? documentObj.getElementById(id)
            : null;
    }

    function hideAuthUi(documentObj) {
        const googleLoginBtn = getNode(documentObj, 'googleLoginBtn');
        const topLoginBtn = getNode(documentObj, 'topLoginBtn');
        const logoutBtn = getNode(documentObj, 'logoutBtn');
        const userAvatar = getNode(documentObj, 'userAvatar');
        const userName = getNode(documentObj, 'userName');

        setDisplay(googleLoginBtn, false);
        setDisplay(topLoginBtn, false);
        setDisplay(logoutBtn, false);
        setDisplay(userAvatar, false);
        setDisplay(userName, false);

        if (userAvatar) userAvatar.src = '';
        if (userName) userName.textContent = '';
    }

    function defaultLoadScript(documentObj, url) {
        if (!documentObj || typeof documentObj.createElement !== 'function' || !documentObj.head) {
            return Promise.reject(new Error('Document unavailable for Firebase script loading.'));
        }

        const existing = typeof documentObj.querySelector === 'function'
            ? documentObj.querySelector(`script[src="${url}"]`)
            : null;
        if (existing) {
            return Promise.resolve(existing);
        }

        return new Promise((resolve, reject) => {
            const script = documentObj.createElement('script');
            script.src = url;
            script.async = false;
            script.onload = () => resolve(script);
            script.onerror = () => reject(new Error(`Failed to load ${url}`));
            documentObj.head.appendChild(script);
        });
    }

    function createAuthService(options = {}) {
        const config = options.config || {};
        const documentObj = options.documentObj || (typeof document !== 'undefined' ? document : null);
        const windowObj = options.windowObj || (typeof window !== 'undefined' ? window : {});
        const loadScript = options.loadScript || ((url) => defaultLoadScript(documentObj, url));
        const log = options.log || console;
        const enabled = !!(config.features && config.features.firebaseAuth);

        let ready = false;
        let firebaseApi = null;
        let authApi = null;
        let dbApi = null;

        function setLoginError(message) {
            const loginError = getNode(documentObj, 'loginError');
            if (loginError) loginError.textContent = message || '';
        }

        function renderAuthUi(user) {
            if (!enabled || !ready) {
                hideAuthUi(documentObj);
                return;
            }

            const isSignedIn = !!user;
            const googleLoginBtn = getNode(documentObj, 'googleLoginBtn');
            const topLoginBtn = getNode(documentObj, 'topLoginBtn');
            const logoutBtn = getNode(documentObj, 'logoutBtn');
            const userAvatar = getNode(documentObj, 'userAvatar');
            const userName = getNode(documentObj, 'userName');

            setDisplay(googleLoginBtn, !isSignedIn);
            setDisplay(topLoginBtn, !isSignedIn);
            setDisplay(logoutBtn, isSignedIn);

            if (userAvatar) {
                const hasPhoto = !!(isSignedIn && user.photoURL);
                setDisplay(userAvatar, hasPhoto);
                userAvatar.src = hasPhoto ? user.photoURL : '';
            }

            if (userName) {
                const label = isSignedIn ? (user.displayName || user.email || '') : '';
                setDisplay(userName, !!label);
                userName.textContent = label;
            }
        }

        function requireReady() {
            if (!enabled) throw new Error('Google sign-in is disabled.');
            if (!ready || !firebaseApi || !authApi || !dbApi) {
                throw new Error('Google sign-in is unavailable.');
            }
        }

        async function start() {
            hideAuthUi(documentObj);
            setLoginError('');

            if (!enabled) {
                return { enabled: false, ready: false };
            }

            try {
                for (const url of config.firebase && config.firebase.scripts ? config.firebase.scripts : []) {
                    await loadScript(url);
                }

                firebaseApi = windowObj.firebase;
                if (!firebaseApi) {
                    throw new Error('Firebase did not load.');
                }

                if (!firebaseApi.apps || !firebaseApi.apps.length) {
                    firebaseApi.initializeApp((config.firebase && config.firebase.project) || {});
                }

                authApi = firebaseApi.auth();
                dbApi = firebaseApi.firestore();
                ready = true;
                renderAuthUi(null);
                return { enabled: true, ready: true };
            } catch (error) {
                ready = false;
                hideAuthUi(documentObj);
                const message = `Google sign-in is unavailable: ${error.message}`;
                setLoginError(message);
                if (log && typeof log.error === 'function') {
                    log.error(message, error);
                }
                return { enabled: true, ready: false, error };
            }
        }

        async function signInWithGoogle() {
            requireReady();
            setLoginError('');
            return authApi.signInWithPopup(new firebaseApi.auth.GoogleAuthProvider());
        }

        async function signOut() {
            requireReady();
            return authApi.signOut();
        }

        function onAuthStateChanged(callback) {
            if (!ready || !authApi) return () => {};
            return authApi.onAuthStateChanged(callback);
        }

        async function ensureUserProfile(user) {
            requireReady();
            const ref = dbApi.collection('users').doc(user.uid);
            const doc = await ref.get();
            if (doc.exists) {
                return doc.data();
            }

            const profile = {
                displayName: user.displayName || null,
                email: user.email || null,
                photoURL: user.photoURL || null,
                selectedLanguage: null,
                selectedLevel: null,
                createdAt: firebaseApi.firestore.FieldValue.serverTimestamp(),
            };
            await ref.set(profile);
            return profile;
        }

        async function saveUserProfile(user, profile) {
            requireReady();
            if (!user) return;
            return dbApi.collection('users').doc(user.uid).set({
                selectedLanguage: profile.selectedLanguage ?? null,
                selectedLevel: profile.selectedLevel ?? null,
                updatedAt: firebaseApi.firestore.FieldValue.serverTimestamp(),
            }, { merge: true });
        }

        return {
            start,
            renderAuthUi,
            setLoginError,
            signInWithGoogle,
            signOut,
            onAuthStateChanged,
            ensureUserProfile,
            saveUserProfile,
            isEnabled() {
                return enabled;
            },
            isReady() {
                return ready;
            },
        };
    }

    return { createAuthService };
});
