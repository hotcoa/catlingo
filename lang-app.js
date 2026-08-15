/**
 * Le Chat Parisien — Application Logic
 * Clean, modular architecture for the language learning app.
 */

// ═══════════ Firebase Setup ═══════════
const firebaseConfig = {
    apiKey: "AIzaSyBhEuX8lcxlkDwbm-J90Unq2JuAMi73u8s",
    authDomain: "cat-language-1ecd4.firebaseapp.com",
    projectId: "cat-language-1ecd4",
    storageBucket: "cat-language-1ecd4.firebasestorage.app",
    messagingSenderId: "539587205119",
    appId: "1:539587205119:web:a6e9f463c519829194f9ca",
    measurementId: "G-E6G2J3RECG",
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// ═══════════ Application State ═══════════
const state = {
    currentUser: null,
    userProfile: null,
    currentLang: null,
    currentQuiz: null,       // { phrase, segments, blankIndex, answer, answerNorm, options, answered }
    score: 0,
    hasLocalPref: false,
    demoCount: 0,
    activeDemos: [],
    lastDemoIndex: -1,
    wordPool: { lang: null, words: [] },
};

// ═══════════ DOM References ═══════════
const dom = {
    get loginError() { return document.getElementById('loginError'); },
    get userAvatar() { return document.getElementById('userAvatar'); },
    get userName() { return document.getElementById('userName'); },
    get topLoginBtn() { return document.getElementById('topLoginBtn'); },
    get logoutBtn() { return document.getElementById('logoutBtn'); },
    get langueLabel() { return document.getElementById('langueLabel'); },
    get levelLabel() { return document.getElementById('levelLabel'); },
    get langPicker() { return document.getElementById('langPicker'); },
    get langGrid() { return document.getElementById('langGrid'); },
    get mainContent() { return document.getElementById('mainContent'); },
    get mainTitle() { return document.getElementById('mainTitle'); },
    get mainSubtitle() { return document.getElementById('mainSubtitle'); },
    get catImage() { return document.getElementById('catImage'); },
    get demoPhrase() { return document.getElementById('demoPhrase'); },
    get demoMeaning() { return document.getElementById('demoMeaning'); },
    get quizPromptLabel() { return document.getElementById('quizPromptLabel'); },
    get quizChoices() { return document.getElementById('quizChoices'); },
    get quizFeedback() { return document.getElementById('quizFeedback'); },
    get wordGloss() { return document.getElementById('wordGloss'); },
    get speakBtn() { return document.getElementById('speakBtn'); },
    get refreshBtn() { return document.getElementById('refreshBtn'); },
    get progressFill() { return document.getElementById('progressFill'); },
    get phrasesLearned() { return document.getElementById('phrasesLearned'); },
    get levelBadge() { return document.getElementById('levelBadge'); },
    get motivationText() { return document.getElementById('motivationText'); },
    get postmark() { return document.getElementById('postmark'); },
    get catCaption() { return document.getElementById('catCaption'); },
    get topLangStamps() { return document.getElementById('topLangStamps'); },
    get levelStamps() { return document.getElementById('levelStamps'); },
    get lessonTopTab() { return document.getElementById('lessonTopTab'); },
    get lessonTopTitle() { return document.getElementById('lessonTopTitle'); },
    get lessonTopBody() { return document.getElementById('lessonTopBody'); },
    get lessonBottomTab() { return document.getElementById('lessonBottomTab'); },
    get lessonBottomTitle() { return document.getElementById('lessonBottomTitle'); },
    get lessonExamples() { return document.getElementById('lessonExamples'); },
};

// ═══════════ Utilities ═══════════
function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
}

// Native UI labels for the selected language (falls back to French).
function currentUI() {
    return (THEMES[state.currentLang] || THEMES.french).ui;
}

// ═══════════ Local Preferences (works without an account) ═══════════
// Persists the language + level choice so the site honors the last selection
// on the next visit, whether or not the visitor is signed in.
const LocalPrefs = {
    KEY: 'lcp_prefs',
    read() {
        try { return JSON.parse(localStorage.getItem(this.KEY)) || {}; }
        catch { return {}; }
    },
    write(patch) {
        const next = { ...this.read(), ...patch };
        try { localStorage.setItem(this.KEY, JSON.stringify(next)); } catch { /* ignore */ }
        return next;
    },
};

function randomFrom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

// ═══════════ Phrase Engine ═══════════
// The current UI still practices one combined deck per language, so flatten
// the stable level banks into a single active postcard rotation.
function buildActiveDemos() {
    const banks = LEVEL_DEMO[state.currentLang];
    state.activeDemos = banks
        ? Object.values(banks).flat()
        : (DEMO[state.currentLang] || []);
    state.lastDemoIndex = -1;
    state.wordPool = { lang: null, words: [] };
}

function nextDemo() {
    const { activeDemos } = state;
    if (!activeDemos.length) return;

    // Pick a random phrase, avoiding immediate repetition
    let idx;
    if (activeDemos.length === 1) {
        idx = 0;
    } else {
        do { idx = Math.floor(Math.random() * activeDemos.length); }
        while (idx === state.lastDemoIndex);
    }
    loadQuiz(idx, true);
}

// ═══════════ Word tokenisation & glosses ═══════════
const RE_EDGE = /^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu;

// Split a sentence into { lead, word, trail } chunks, preserving punctuation so
// word chips stay clean while surrounding marks render as plain text.
function segmentWords(text) {
    return text.trim().split(/\s+/).filter(Boolean).map(tok => {
        const lead = (tok.match(/^[^\p{L}\p{N}]+/u) || [''])[0];
        const trail = (tok.match(/[^\p{L}\p{N}]+$/u) || [''])[0];
        const word = tok.slice(lead.length, tok.length - trail.length);
        return word ? { lead, word, trail } : { lead: '', word: '', trail: tok };
    });
}

function normalizeWord(w) {
    return (w || '')
        .replace(/\u2019/g, "'")            // curly → straight apostrophe
        .toLowerCase()
        .replace(RE_EDGE, '');
}

// Accent/punctuation-insensitive comparison so type-in answers are forgiving.
function foldWord(w) {
    return normalizeWord(w).normalize('NFD').replace(/\p{Diacritic}/gu, '');
}

function glossFor(word) {
    const dict = (typeof GLOSS !== 'undefined' && GLOSS[state.currentLang]) || null;
    if (!dict) return null;
    return dict[normalizeWord(word)] || null;
}

function letterCount(word) {
    return (word.match(/\p{L}/gu) || []).length;
}

// Words worth blanking / offering as multiple-choice options.
function blankMinLetters() {
    return state.currentLang === 'french' ? 3 : 2;
}
function isCandidateWord(word) {
    if (!word) return false;
    return letterCount(word) >= blankMinLetters() || /\d/.test(word);
}

// Unique pool of candidate words across the active bank (for MC distractors).
function getWordPool() {
    if (state.wordPool.lang === state.currentLang) return state.wordPool.words;
    const seen = new Set();
    const words = [];
    for (const phrase of state.activeDemos) {
        for (const seg of segmentWords(phrase.p)) {
            if (!isCandidateWord(seg.word)) continue;
            const norm = normalizeWord(seg.word);
            if (norm && !seen.has(norm)) { seen.add(norm); words.push(norm); }
        }
    }
    state.wordPool = { lang: state.currentLang, words };
    return words;
}

function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

// Build a quiz object: choose one content word to hide + gather MC distractors.
function buildQuiz(phrase) {
    const segments = segmentWords(phrase.p);
    const candidates = segments
        .map((seg, i) => ({ i, word: seg.word }))
        .filter(c => isCandidateWord(c.word));

    // Prefer a glossed content word so the blank is meaningful, but pick at
    // random within that set so the same sentence quizzes different words over
    // time (and doesn't always blank the one dominant noun).
    let pick;
    if (candidates.length) {
        const glossed = candidates.filter(c => glossFor(c.word));
        pick = randomFrom(glossed.length ? glossed : candidates);
    } else {
        const withWord = segments.map((seg, i) => ({ i, word: seg.word })).filter(c => c.word);
        pick = withWord.length ? randomFrom(withWord) : { i: 0, word: segments[0].word };
    }

    const answer = segments[pick.i].word;
    const answerNorm = normalizeWord(answer);
    const ansLen = answer.length;

    // Distractors are drawn ONLY from the current language's own word bank, so
    // options always match the language on screen. Prefer real (glossed) words
    // of a similar length so the choices feel parallel and plausible.
    const pool = getWordPool().filter(w => w !== answerNorm);
    const glossedPool = new Set(pool.filter(w => (GLOSS[state.currentLang] || {})[w]));
    const rank = w => (glossedPool.has(w) ? 0 : 1);          // glossed first
    const tiers = [
        pool.filter(w => Math.abs(w.length - ansLen) <= 2),  // similar length
        pool.filter(w => Math.abs(w.length - ansLen) > 2),   // any length
    ];
    const ordered = [];
    for (const tier of tiers) {
        for (const w of shuffle(tier).sort((a, b) => rank(a) - rank(b))) {
            if (!ordered.includes(w)) ordered.push(w);
        }
    }
    const distractors = ordered.slice(0, 3);
    const options = shuffle([answerNorm, ...distractors]);

    return { phrase, segments, blankIndex: pick.i, answer, answerNorm, options, answered: false, attempts: 0 };
}

// ═══════════ Quiz rendering ═══════════
function loadQuiz(idx, countIt) {
    const phrase = state.activeDemos[idx];
    if (!phrase) return;
    state.lastDemoIndex = idx;
    state.currentQuiz = buildQuiz(phrase);

    const ui = currentUI();
    dom.demoMeaning.textContent = phrase.m;          // English hint
    if (dom.wordGloss) { dom.wordGloss.textContent = ''; dom.wordGloss.classList.remove('is-active'); }
    if (dom.quizFeedback) { dom.quizFeedback.textContent = ''; dom.quizFeedback.className = 'quiz-feedback'; }

    const keyword = phrase.kw ? randomFrom(phrase.kw) : LANGS[state.currentLang].hi;
    setCatImage(keyword);
    renderLesson(idx);

    const phraseEl = dom.demoPhrase;
    phraseEl.style.opacity = '0';
    setTimeout(() => {
        renderSentence();
        renderAnswerArea();
        phraseEl.style.opacity = '1';
    }, 180);

    if (countIt) {
        state.demoCount++;
        dom.phrasesLearned.textContent = state.demoCount;
        dom.progressFill.style.width = Math.min((state.demoCount / state.activeDemos.length) * 100, 100) + '%';
    }
}

// Render the sentence: a blank at the hidden word, clickable chips for glossed
// words, and plain text for everything else.
function renderSentence() {
    const quiz = state.currentQuiz;
    if (!quiz) return;
    const reveal = quiz.answered;
    const html = quiz.segments.map((seg, i) => {
        const lead = escapeHtml(seg.lead);
        const trail = escapeHtml(seg.trail);
        if (!seg.word) return escapeHtml(seg.trail);

        if (i === quiz.blankIndex && !reveal) {
            return `${lead}<span class="quiz-blank" aria-hidden="true">${'\u00A0'.repeat(Math.max(3, seg.word.length))}</span>${trail}`;
        }

        const gloss = glossFor(seg.word);
        const answerHere = (i === quiz.blankIndex) ? ' is-answer' : '';
        if (gloss) {
            return `${lead}<button type="button" class="vocab-word has-gloss${answerHere}" `
                + `data-gloss="${escapeHtml(gloss)}" data-word="${escapeHtml(seg.word)}">${escapeHtml(seg.word)}</button>${trail}`;
        }
        return `${lead}<span class="vocab-word${answerHere}">${escapeHtml(seg.word)}</span>${trail}`;
    }).join(' ');

    dom.demoPhrase.innerHTML = html;
}

// Render the multiple-choice options (hidden once answered).
function renderAnswerArea() {
    const quiz = state.currentQuiz;
    const choices = dom.quizChoices;
    if (!quiz || !choices) return;

    if (quiz.answered) {
        choices.hidden = true;
        return;
    }
    choices.hidden = false;
    choices.innerHTML = quiz.options
        .map(opt => `<button type="button" class="quiz-choice" data-opt="${escapeHtml(opt)}">${escapeHtml(opt)}</button>`)
        .join('');
}

function submitAnswer(guess) {
    const quiz = state.currentQuiz;
    if (!quiz || quiz.answered) return;
    const ui = currentUI();
    const correct = foldWord(guess) === foldWord(quiz.answer) && foldWord(guess) !== '';

    if (correct) {
        quiz.answered = true;
        state.score++;
        updateScoreBadge();
        renderSentence();
        renderAnswerArea();
        setFeedback(ui.correct, 'is-correct');
        if (dom.wordGloss) dom.wordGloss.textContent = ui.tapHint;
    } else {
        quiz.attempts++;
        setFeedback(ui.tryAgain, 'is-wrong');
    }
    return correct;
}

function setFeedback(msg, cls) {
    if (!dom.quizFeedback) return;
    dom.quizFeedback.textContent = msg;
    dom.quizFeedback.className = 'quiz-feedback' + (cls ? ' ' + cls : '');
}

function updateScoreBadge() {
    if (!dom.levelBadge) return;
    const ui = currentUI();
    dom.levelBadge.textContent = `${ui.score} ${state.score}`;
}

// Tap a glossed word to show its translation underneath.
function showWordGloss(btn) {
    if (!dom.wordGloss) return;
    const word = btn.getAttribute('data-word');
    const gloss = btn.getAttribute('data-gloss');
    const wasActive = btn.classList.contains('is-open');
    dom.demoPhrase.querySelectorAll('.vocab-word.is-open').forEach(b => b.classList.remove('is-open'));
    if (wasActive) {
        dom.wordGloss.textContent = '';
        dom.wordGloss.classList.remove('is-active');
        return;
    }
    btn.classList.add('is-open');
    dom.wordGloss.textContent = `${word} — ${gloss}`;
    dom.wordGloss.classList.add('is-active');
}

// ═══════════ Lesson Carnet (right column) ═══════════
// Find the most relevant grammar/vocab lesson for a phrase. Lessons are
// ordered specific → general, so the first pattern match wins.
function findLesson(phrase, lang) {
    const lessons = (typeof LESSONS !== 'undefined' && LESSONS[lang]) || null;
    if (!lessons || !phrase) return null;
    const text = phrase.p || '';
    for (const lesson of lessons) {
        if (lesson.match.some(re => re.test(text))) return lesson;
    }
    return null;
}

function renderLesson(currentIdx) {
    const { activeDemos, currentLang } = state;
    const phrase = activeDemos[currentIdx];
    if (!phrase) return;

    const isRtl = !!LANGS[currentLang]?.rtl;
    const lesson = findLesson(phrase, currentLang);

    if (lesson) {
        renderLessonFromData(lesson, isRtl);
    } else {
        renderLessonFallback(phrase, currentIdx, isRtl);
    }
}

// A curated grammar/vocab lesson matched to the current phrase.
function renderLessonFromData(lesson, isRtl) {
    const ui = currentUI();
    dom.lessonTopTab.textContent = ui.carnet;
    dom.lessonTopTitle.textContent = lesson.focus;

    const vocab = (lesson.vocab || []).map(v => `
        <div class="vocab-item">
            <span class="vocab-term"${isRtl ? ' dir="rtl"' : ''}>${escapeHtml(v.t)}</span>
            <span class="vocab-gloss">${escapeHtml(v.g)}</span>
        </div>
    `).join('');

    dom.lessonTopBody.innerHTML = `
        <p class="lesson-note">${mdBold(lesson.note)}</p>
        ${vocab ? `<div class="vocab-list">${vocab}</div>` : ''}
    `;

    dom.lessonBottomTab.textContent = ui.pratique;
    dom.lessonBottomTitle.textContent = ui.howTo;
    renderExampleList(lesson.examples || [], isRtl);
}

// No curated lesson: spotlight the phrase words + show related bank phrases.
function renderLessonFallback(phrase, currentIdx, isRtl) {
    const { activeDemos } = state;
    const ui = currentUI();

    dom.lessonTopTab.textContent = ui.carnet;
    dom.lessonTopTitle.textContent = ui.spotlight;

    const tokens = tokenizePhrase(phrase.p);
    const chips = tokens.map(t => `<span class="spotlight-word">${escapeHtml(t)}</span>`).join('');
    dom.lessonTopBody.innerHTML = `
        <div class="spotlight-words"${isRtl ? ' dir="rtl"' : ''}>${chips}</div>
        <p class="spotlight-translation">${escapeHtml(phrase.m)}</p>
    `;

    dom.lessonBottomTab.textContent = ui.encore;
    dom.lessonBottomTitle.textContent = ui.related;

    const others = activeDemos.map((p, i) => ({ p, i })).filter(o => o.i !== currentIdx);
    shuffle(others);
    renderExampleList(others.slice(0, 3).map(o => o.p), isRtl);
}

function renderExampleList(examples, isRtl) {
    const list = dom.lessonExamples;
    if (!list) return;
    if (!examples.length) {
        list.innerHTML = `<p class="spotlight-empty">${escapeHtml(currentUI().comingSoon)}</p>`;
        return;
    }
    list.innerHTML = examples.map(o => `
        <div class="example-item">
            <div class="example-target"${isRtl ? ' dir="rtl"' : ''}>${escapeHtml(o.p)}</div>
            <div class="example-meaning">${escapeHtml(o.m)}</div>
        </div>
    `).join('');
}

// Split a phrase into display tokens. Space-delimited languages split on
// whitespace; scriptio-continua languages (Chinese/Japanese) show the whole
// phrase as a single unit since word boundaries aren't marked by spaces.
function tokenizePhrase(text) {
    if (!text) return [];
    const spaced = text.trim().split(/\s+/).filter(Boolean);
    return spaced.length > 1 ? spaced : [text.trim()];
}

function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// Minimal **bold** / *italic* rendering for lesson notes (input pre-escaped).
function mdBold(str) {
    return escapeHtml(str)
        .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
        .replace(/\*(.+?)\*/g, '<i>$1</i>');
}

// ═══════════ Cat Image Service ═══════════
async function fetchCatUrl(keyword) {
    return `https://cataas.com/cat/says/${encodeURIComponent(keyword || 'Bonjour')}?size=200&color=white&fontSize=22`;
}

async function setCatImage(keyword) {
    const img = dom.catImage;
    img.style.opacity = '0';
    const url = await fetchCatUrl(keyword);
    img.onload = () => { img.style.opacity = '1'; };
    img.src = url;
}

// ═══════════ Text-to-Speech Engine ═══════════
const TTS = (() => {
    const VOICE_CONFIG = {
        french: {
            lang: 'fr-FR',
            female: [
                'Denise Online', 'Eloise Online', 'Vivienne Online',
                'Denise', 'Eloise', 'Vivienne',
                'Amélie', 'Céline', 'Marie', 'Aurélie', 'Léa',
                'Google français',
                'Julie', 'Caroline', 'Hortense',
            ],
            male: [
                'Henri Online', 'Alain Online', 'Claude Online',
                'Henri', 'Alain', 'Claude', 'Fabrice', 'Théo',
                'Thomas', 'Jacques', 'Nicolas',
                'Paul',
            ],
            femaleBias: 0.5,
        },
        korean: {
            lang: 'ko-KR',
            female: [
                'SunHi Online', 'JiMin Online',
                'SunHi', 'JiMin', 'Yuna', 'Sora',
                'Google 한국어',
                'Heami',
            ],
            male: [
                'InJoon Online', 'BongJin Online',
                'InJoon', 'BongJin',
            ],
            femaleBias: 0.5,
        },
        hebrew: {
            lang: 'he-IL',
            female: [
                'Hila Online', 'Hila',
                'Carmit',
                'Google עברית',
            ],
            male: [
                'Avri Online', 'Avri',
            ],
            femaleBias: 0.5,
        },
    };

    let cachedVoices = [];
    let voiceCache = {};
    let lastGender = null;

    function loadVoices() {
        cachedVoices = speechSynthesis.getVoices();
        voiceCache = {};
    }

    speechSynthesis.addEventListener('voiceschanged', loadVoices);
    loadVoices();

    function isNeural(voice) {
        const n = voice.name.toLowerCase();
        return n.includes('online') || n.includes('natural') || n.includes('neural');
    }

    function buildPool(langKey) {
        if (voiceCache[langKey]) return voiceCache[langKey];
        if (!cachedVoices.length) cachedVoices = speechSynthesis.getVoices();

        const config = VOICE_CONFIG[langKey];
        if (!config) return { female: [], male: [] };

        const langPrefix = config.lang.split('-')[0];
        const langVoices = cachedVoices.filter(v => v.lang.startsWith(langPrefix));

        function findByPrefs(prefs) {
            const found = [];
            const seen = new Set();
            for (const name of prefs) {
                const v = langVoices.find(v =>
                    v.name.toLowerCase().includes(name.toLowerCase()) && !seen.has(v.name)
                );
                if (v) { found.push(v); seen.add(v.name); }
            }
            return found;
        }

        let female = findByPrefs(config.female);
        let male = findByPrefs(config.male);

        // Fallback: split available voices by name heuristic
        if (!female.length && !male.length) {
            const malePattern = /henri|alain|claude|paul|fabrice|théo|thomas|jacques|nicolas|injoon|bongjin|male|homme/i;
            male = langVoices.filter(v => malePattern.test(v.name));
            female = langVoices.filter(v => !malePattern.test(v.name));
            if (!female.length) female = langVoices;
        }

        // Sort neural voices first
        const sortNeural = (a, b) => (isNeural(b) ? 1 : 0) - (isNeural(a) ? 1 : 0);
        female.sort(sortNeural);
        male.sort(sortNeural);

        voiceCache[langKey] = { female, male };
        return voiceCache[langKey];
    }

    function pickVoice(langKey) {
        const pool = buildPool(langKey);
        const config = VOICE_CONFIG[langKey];
        if (!config) return null;

        const hasFemale = pool.female.length > 0;
        const hasMale = pool.male.length > 0;
        if (!hasFemale && !hasMale) return null;

        // Alternate gender on each press so the deck naturally mixes men and
        // women; fall back to whichever pool has voices when only one exists.
        let useFemale;
        if (!hasMale) useFemale = true;
        else if (!hasFemale) useFemale = false;
        else useFemale = (lastGender !== 'f');

        const voices = useFemale ? pool.female : pool.male;
        lastGender = useFemale ? 'f' : 'm';

        // Strongly prefer natural/neural voices — only use a robotic local
        // voice if the browser exposes no neural voice for this gender.
        const neural = voices.filter(isNeural);
        const preferred = neural.length ? neural : voices;
        return preferred[Math.floor(Math.random() * preferred.length)];
    }

    function speak() {
        const text = (state.currentQuiz && state.currentQuiz.phrase.p) || dom.demoPhrase.textContent;
        if (!text || !state.currentLang) return;

        speechSynthesis.cancel();

        const utter = new SpeechSynthesisUtterance(text);
        const voice = pickVoice(state.currentLang);
        const config = VOICE_CONFIG[state.currentLang];

        if (voice) utter.voice = voice;
        utter.lang = config?.lang || 'en-US';

        // Tune for natural adult voice
        if (voice && isNeural(voice)) {
            utter.rate = 0.92 + Math.random() * 0.06;
            utter.pitch = 0.95;
        } else {
            utter.rate = 0.84 + Math.random() * 0.06;
            utter.pitch = lastGender === 'f' ? 0.92 : 0.85;
        }

        const btn = dom.speakBtn;
        btn.classList.add('speaking');
        btn.textContent = lastGender === 'f' ? '👩' : '👨';

        const resetBtn = () => { btn.classList.remove('speaking'); btn.textContent = '🔊'; };
        utter.onend = resetBtn;
        utter.onerror = resetBtn;

        speechSynthesis.speak(utter);
    }

    return { speak };
})();

// ═══════════ Confetti Effect ═══════════
function spawnConfetti() {
    const emojis = ['🎉', '🐱', '💝', '⭐', '🌟'];
    const el = document.createElement('div');
    el.textContent = randomFrom(emojis);
    Object.assign(el.style, {
        position: 'fixed',
        left: Math.random() * 100 + '%',
        top: '-10px',
        fontSize: '20px',
        pointerEvents: 'none',
        zIndex: '1000',
    });
    document.body.appendChild(el);

    el.animate([
        { transform: 'translateY(0) rotate(0deg)', opacity: 1 },
        { transform: `translateY(${window.innerHeight + 100}px) rotate(360deg)`, opacity: 0 },
    ], {
        duration: 3000,
        easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
    }).addEventListener('finish', () => el.remove());
}

// ═══════════ Firestore Service (only used when signed in) ═══════════
const UserService = {
    async loadProfile() {
        const ref = db.collection('users').doc(state.currentUser.uid);
        const doc = await ref.get();
        if (doc.exists) {
            state.userProfile = doc.data();
        } else {
            state.userProfile = {
                displayName: state.currentUser.displayName,
                email: state.currentUser.email,
                photoURL: state.currentUser.photoURL,
                selectedLanguage: null,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            };
            await ref.set(state.userProfile);
        }
    },

    async saveProfile() {
        if (!state.currentUser) return;
        await db.collection('users').doc(state.currentUser.uid).set({
            selectedLanguage: state.currentLang,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
    },
};

// ═══════════ UI Rendering ═══════════
function renderTopLangStamps() {
    const wrap = dom.topLangStamps;
    wrap.innerHTML = Object.entries(LANGS).map(([key, lang]) => `
        <button class="stamp-btn${key === state.currentLang ? ' active' : ''}" data-lang="${key}">
            <span class="stamp-icon">${lang.flag}</span>
            <span class="stamp-text">${lang.name}</span>
        </button>
    `).join('');

    wrap.querySelectorAll('.stamp-btn').forEach(btn =>
        btn.addEventListener('click', () => selectLanguage(btn.dataset.lang))
    );
}

// Attach delegated click handlers once: answer choices and clickable vocab.
function wireQuizControls() {
    const choices = dom.quizChoices;
    if (choices && !choices.dataset.wired) {
        choices.dataset.wired = '1';
        choices.addEventListener('click', e => {
            const btn = e.target.closest('.quiz-choice');
            if (!btn || btn.disabled) return;
            const correct = submitAnswer(btn.dataset.opt);
            if (!correct) { btn.classList.add('is-wrong'); btn.disabled = true; }
        });
    }

    const phraseEl = dom.demoPhrase;
    if (phraseEl && !phraseEl.dataset.wired) {
        phraseEl.dataset.wired = '1';
        phraseEl.addEventListener('click', e => {
            const btn = e.target.closest('.vocab-word.has-gloss');
            if (btn) showWordGloss(btn);
        });
    }
}

// ═══════════ Language Selection ═══════════
function showLangPicker() {
    dom.langPicker.style.display = 'block';
    dom.mainContent.style.display = 'none';

    dom.langGrid.innerHTML = Object.entries(LANGS).map(([key, lang]) => `
        <div class="lang-card" data-lang="${key}">
            <div class="lang-card-flag">${lang.flag}</div>
            <div class="lang-card-name">${lang.name}</div>
            <div class="lang-card-native">${lang.native}</div>
        </div>
    `).join('');

    dom.langGrid.querySelectorAll('.lang-card').forEach(card =>
        card.addEventListener('click', () => selectLanguage(card.dataset.lang))
    );
}

async function selectLanguage(lang) {
    state.currentLang = lang;
    renderTopLangStamps();
    showMainContent();
    persistSelection();
}

// Remember the language locally always and to the account if signed in.
function persistSelection() {
    state.hasLocalPref = true;
    LocalPrefs.write({ lang: state.currentLang });
    if (state.currentUser) UserService.saveProfile().catch(e => console.error('Save failed:', e));
}

// ═══════════ Main Content ═══════════
function showMainContent() {
    dom.langPicker.style.display = 'none';
    dom.mainContent.style.display = 'flex';

    const lang = LANGS[state.currentLang];
    const theme = THEMES[state.currentLang] || THEMES.french;

    // Right-to-left languages (e.g. Hebrew) render the target phrase RTL for a native feel.
    const isRtl = !!lang.rtl;
    dom.demoPhrase.setAttribute('dir', isRtl ? 'rtl' : 'ltr');
    dom.mainContent.classList.toggle('rtl-lang', isRtl);

    // Re-skin the whole postcard for the selected language.
    Object.values(THEMES).forEach(t => dom.mainContent.classList.remove(t.cls));
    dom.mainContent.classList.add(theme.cls);

    dom.mainTitle.textContent = theme.title;
    dom.mainTitle.setAttribute('dir', isRtl ? 'rtl' : 'ltr');
    dom.mainSubtitle.textContent = theme.subtitle;
    dom.mainSubtitle.setAttribute('dir', isRtl ? 'rtl' : 'ltr');
    dom.postmark.innerHTML = theme.postmark.map(escapeHtml).join('<br/>');
    dom.catCaption.textContent = theme.caption;
    dom.motivationText.textContent = theme.motivation;
    dom.motivationText.setAttribute('dir', isRtl ? 'rtl' : 'ltr');

    // Localize the shared chrome (top-bar labels + stats) to the selected language.
    if (dom.langueLabel) dom.langueLabel.textContent = theme.ui.langue;
    const seenLabel = document.getElementById('seenLabel');
    if (seenLabel) seenLabel.textContent = theme.ui.seen;
    if (dom.quizPromptLabel) dom.quizPromptLabel.textContent = theme.ui.quizPrompt;
    dom.refreshBtn.textContent = theme.ui.next;

    state.score = 0;
    updateScoreBadge();
    wireQuizControls();
    initDemo();
}

function initDemo() {
    state.demoCount = 0;
    dom.phrasesLearned.textContent = '0';
    dom.progressFill.style.width = '0%';
    buildActiveDemos();

    if (state.activeDemos.length) {
        nextDemo();
    } else {
        const lang = LANGS[state.currentLang];
        const ui = currentUI();
        dom.demoPhrase.textContent = lang.hi;
        dom.demoMeaning.textContent = ui.start;
        setCatImage(lang.hi);
        dom.lessonTopTab.textContent = ui.carnet;
        dom.lessonTopTitle.textContent = ui.spotlight;
        dom.lessonTopBody.innerHTML = `<div class="spotlight-words"><span class="spotlight-word">${escapeHtml(lang.hi)}</span></div>`;
        dom.lessonBottomTab.textContent = ui.encore;
        dom.lessonBottomTitle.textContent = ui.related;
        dom.lessonExamples.innerHTML = `<p class="spotlight-empty">${escapeHtml(ui.comingSoon)}</p>`;
    }
}

// ═══════════ Authentication (optional) ═══════════
// The app is fully usable without an account. Signing in simply syncs the
// language/level choice to Firestore so it follows the user across devices.
async function signIn() {
    try {
        dom.loginError.textContent = '';
        await auth.signInWithPopup(new firebase.auth.GoogleAuthProvider());
    } catch (e) {
        dom.loginError.textContent = e.message;
        console.error('Sign-in failed:', e);
    }
}

function updateAuthUI() {
    const user = state.currentUser;
    dom.logoutBtn.style.display = user ? '' : 'none';
    dom.topLoginBtn.style.display = user ? 'none' : '';
    if (user) {
        const hasPhoto = !!user.photoURL;
        dom.userAvatar.style.display = hasPhoto ? '' : 'none';
        dom.userAvatar.src = user.photoURL || '';
        dom.userName.textContent = user.displayName || user.email || '';
    } else {
        dom.userAvatar.style.display = 'none';
        dom.userAvatar.src = '';
        dom.userName.textContent = '';
    }
}

dom.topLoginBtn.addEventListener('click', signIn);
const googleLoginBtn = document.getElementById('googleLoginBtn');
if (googleLoginBtn) googleLoginBtn.addEventListener('click', signIn);
dom.logoutBtn.addEventListener('click', () => auth.signOut());

auth.onAuthStateChanged(async (user) => {
    state.currentUser = user || null;
    updateAuthUI();
    if (!user) return;

    try {
        await UserService.loadProfile();
        const savedLang = state.userProfile.selectedLanguage;

        if (!state.hasLocalPref && savedLang && LANGS[savedLang]) {
            // Visitor hadn't made a local choice — restore their account choice.
            state.currentLang = savedLang;
            state.hasLocalPref = true;
            LocalPrefs.write({ lang: state.currentLang });
            renderTopLangStamps();
            showMainContent();
        } else {
            // Push the local choice up to the account.
            UserService.saveProfile().catch(e => console.error('Save failed:', e));
        }
    } catch (e) {
        console.error('Profile load failed:', e);
    }
});

// ═══════════ Boot ═══════════
// Show content immediately, honoring the last saved language/level from
// localStorage — no login required.
function boot() {
    const prefs = LocalPrefs.read();
    // Default experience: French — no picker screen shown.
    // A saved local choice always overrides the default and is honored on return.
    state.hasLocalPref = !!(prefs.lang && LANGS[prefs.lang]);
    state.currentLang = state.hasLocalPref ? prefs.lang : 'french';

    updateAuthUI();
    renderTopLangStamps();
    showScreen('mainApp');
    showMainContent();
}

// ═══════════ Event Listeners ═══════════
dom.refreshBtn.addEventListener('click', nextDemo);
dom.speakBtn.addEventListener('click', () => TTS.speak());

boot();
