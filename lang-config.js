(function (root, factory) {
    const config = factory();
    root.CATLINGO_CONFIG = config;
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = config;
    }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    return {
        features: {
            firebaseAuth: false,
        },
        firebase: {
            scripts: [
                'https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js',
                'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth-compat.js',
                'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore-compat.js',
            ],
            project: {
                apiKey: 'AIzaSyBhEuX8lcxlkDwbm-J90Unq2JuAMi73u8s',
                authDomain: 'cat-language-1ecd4.firebaseapp.com',
                projectId: 'cat-language-1ecd4',
                storageBucket: 'cat-language-1ecd4.firebasestorage.app',
                messagingSenderId: '539587205119',
                appId: '1:539587205119:web:a6e9f463c519829194f9ca',
                measurementId: 'G-E6G2J3RECG',
            },
        },
    };
});
