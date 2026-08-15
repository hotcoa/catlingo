(function (root, factory) {
    const api = factory();
    root.CatlingoAuthBootstrap = api;
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    function getNode(documentObj, id) {
        return documentObj && typeof documentObj.getElementById === 'function'
            ? documentObj.getElementById(id)
            : null;
    }

    function setDisplay(node, visible) {
        if (!node) return;
        node.style.display = visible ? '' : 'none';
    }

    function hideAuthUi(documentObj) {
        setDisplay(getNode(documentObj, 'googleLoginBtn'), false);
        setDisplay(getNode(documentObj, 'topLoginBtn'), false);
        setDisplay(getNode(documentObj, 'logoutBtn'), false);
        setDisplay(getNode(documentObj, 'userAvatar'), false);
        setDisplay(getNode(documentObj, 'userName'), false);
    }

    function setVisibleAuthStatus(documentObj, message) {
        const authStatus = getNode(documentObj, 'authStatus');
        const loginError = getNode(documentObj, 'loginError');
        const text = message || '';

        if (loginError) loginError.textContent = text;
        if (!authStatus) return;

        authStatus.textContent = text;
        authStatus.setAttribute('role', 'alert');
        authStatus.setAttribute('aria-live', 'assertive');
        setDisplay(authStatus, !!text);
    }

    function wrapService(service, documentObj) {
        return {
            async start() {
                const result = await service.start();
                if (result && result.error) {
                    setVisibleAuthStatus(documentObj, `Google sign-in is unavailable: ${result.error.message}`);
                } else {
                    setVisibleAuthStatus(documentObj, '');
                }
                return result;
            },
            renderAuthUi(user) {
                return service.renderAuthUi(user);
            },
            setLoginError(message) {
                service.setLoginError(message);
                setVisibleAuthStatus(documentObj, message);
            },
            signInWithGoogle() {
                return service.signInWithGoogle();
            },
            signOut() {
                return service.signOut();
            },
            onAuthStateChanged(callback) {
                return service.onAuthStateChanged(callback);
            },
            ensureUserProfile(user) {
                return service.ensureUserProfile(user);
            },
            saveUserProfile(user, profile) {
                return service.saveUserProfile(user, profile);
            },
            isEnabled() {
                return service.isEnabled();
            },
            isReady() {
                return service.isReady();
            },
        };
    }

    function createUnavailableService(message, documentObj, log) {
        return {
            async start() {
                hideAuthUi(documentObj);
                setVisibleAuthStatus(documentObj, message);
                if (log && typeof log.error === 'function') {
                    log.error(message);
                }
                return { enabled: true, ready: false, error: new Error(message) };
            },
            renderAuthUi() {
                hideAuthUi(documentObj);
            },
            setLoginError(nextMessage) {
                setVisibleAuthStatus(documentObj, nextMessage || message);
            },
            async signInWithGoogle() {
                throw new Error(message);
            },
            async signOut() {},
            onAuthStateChanged() {
                return () => {};
            },
            async ensureUserProfile() {
                return null;
            },
            async saveUserProfile() {},
            isEnabled() {
                return true;
            },
            isReady() {
                return false;
            },
        };
    }

    function createDisabledService(documentObj) {
        return {
            async start() {
                hideAuthUi(documentObj);
                setVisibleAuthStatus(documentObj, '');
                return { enabled: false, ready: false };
            },
            renderAuthUi() {
                hideAuthUi(documentObj);
            },
            setLoginError() {
                setVisibleAuthStatus(documentObj, '');
            },
            async signInWithGoogle() {
                throw new Error('Google sign-in is disabled.');
            },
            async signOut() {},
            onAuthStateChanged() {
                return () => {};
            },
            async ensureUserProfile() {
                return null;
            },
            async saveUserProfile() {},
            isEnabled() {
                return false;
            },
            isReady() {
                return false;
            },
        };
    }

    function createAuthBootstrap(options = {}) {
        const config = options.config || {};
        const documentObj = options.documentObj || (typeof document !== 'undefined' ? document : null);
        const log = options.log || console;
        const authModule = Object.prototype.hasOwnProperty.call(options, 'authModule')
            ? options.authModule
            : (typeof globalThis !== 'undefined' ? globalThis.CatlingoAuth : null);
        const enabled = !!(config.features && config.features.firebaseAuth);

        if (!enabled) {
            if (authModule && typeof authModule.createAuthService === 'function') {
                return wrapService(authModule.createAuthService(options), documentObj);
            }
            return createDisabledService(documentObj);
        }

        if (!authModule || typeof authModule.createAuthService !== 'function') {
            return createUnavailableService(
                'Google sign-in is enabled, but lang-auth.js failed to load.',
                documentObj,
                log
            );
        }

        return wrapService(authModule.createAuthService(options), documentObj);
    }

    return { createAuthBootstrap };
});
