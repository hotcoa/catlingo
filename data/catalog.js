/**
 * Shared browser-global content catalog.
 * Language files register their data here before lang-app.js runs.
 */
(function (global) {
    const stableLevelKeys = [
  'beginner',
  'intermediate',
  'advanced'
];
    const content = global.CATLINGO_CONTENT || {};

    content.catalog = content.catalog || {};
    content.catalog.languages = {
  french: {
    name: 'French',
    flag: '🇫🇷',
    native: 'Français',
    hi: 'Bonjour!'
  },
  korean: {
    name: 'Korean',
    flag: '🇰🇷',
    native: '한국어',
    hi: '안녕하세요!'
  },
  hebrew: {
    name: 'Hebrew',
    flag: '🇮🇱',
    native: 'עברית',
    hi: 'שלום!',
    rtl: true
  }
};
    content.catalog.themes = {
  french: {
    cls: 'theme-french',
    title: 'Le Chat Parisien',
    subtitle: 'Une carte postale de Paris, chaque jour',
    postmark: [
      'CACHET',
      'DE LA POSTE',
      'PARIS'
    ],
    caption: 'Paris',
    refresh: 'Nouvelle carte postale ✉️',
    placeholder: {
      p: 'Cliquez pour commencer !',
      m: 'Click to start!'
    },
    motivation: 'Chaque phrase vous rapproche de la maîtrise ! 💪',
    ui: {
      langue: 'Langue',
      level: 'Niveau',
      carnet: 'Le carnet',
      pratique: 'En pratique',
      encore: 'Encore',
      grammar: 'Grammaire & vocabulaire',
      howTo: "Comment l'utiliser",
      spotlight: 'La phrase du jour',
      related: 'Autres phrases',
      comingSoon: "D'autres phrases arrivent bientôt.",
      seen: 'Phrases vues :',
      start: 'Commencez le français !',
      quizPrompt: 'Complétez la phrase',
      correct: 'Bravo ! 🎉',
      tryAgain: 'Réessayez',
      reveal: 'Voir la réponse',
      tapHint: 'Touchez un mot pour la traduction',
      score: 'Score :',
      next: 'Suivant ✉️'
    }
  },
  korean: {
    cls: 'theme-korean',
    title: '대구 고양이',
    subtitle: '매일 대구에서 온 엽서 한 장',
    postmark: [
      '대구',
      '우체국',
      '소인'
    ],
    caption: '대구',
    refresh: '새 엽서 받기 ✉️',
    placeholder: {
      p: '눌러서 시작하세요!',
      m: 'Click to start!'
    },
    motivation: '한 문장씩, 매일 실력이 늘어요! 💪',
    ui: {
      langue: '언어',
      level: '수준',
      carnet: '단어장',
      pratique: '활용하기',
      encore: '더 보기',
      grammar: '문법과 어휘',
      howTo: '이렇게 써 보세요',
      spotlight: '오늘의 문장',
      related: '관련 문장',
      comingSoon: '문장을 준비하고 있어요.',
      seen: '본 문장:',
      start: '한국어를 시작해요!',
      quizPrompt: '문장을 완성하세요',
      correct: '잘했어요! 🎉',
      tryAgain: '다시 해보세요',
      reveal: '정답 보기',
      tapHint: '단어를 누르면 뜻이 나와요',
      score: '점수:',
      next: '다음 ✉️'
    }
  },
  hebrew: {
    cls: 'theme-hebrew',
    title: 'החתול הישראלי',
    subtitle: 'גלויה מישראל, בכל יום',
    postmark: [
      'דואר',
      'ירושלים',
      'ישראל'
    ],
    caption: 'תל אביב',
    refresh: 'גלויה חדשה ✉️',
    placeholder: {
      p: '!לחצו כדי להתחיל',
      m: 'Click to start!'
    },
    motivation: '!כל משפט מקרב אותך לשליטה בשפה 💪',
    ui: {
      langue: 'שפה',
      level: 'רמה',
      carnet: 'מחברת',
      pratique: 'בתרגול',
      encore: 'עוד',
      grammar: 'דקדוק ואוצר מילים',
      howTo: 'איך משתמשים בזה',
      spotlight: 'משפט היום',
      related: 'משפטים נוספים',
      comingSoon: '.משפטים נוספים בקרוב',
      seen: ':משפטים שנראו',
      start: '!בואו נתחיל עברית',
      quizPrompt: 'השלימו את המשפט',
      correct: '!כל הכבוד 🎉',
      tryAgain: 'נסו שוב',
      reveal: 'הצגת התשובה',
      tapHint: 'הקישו על מילה לתרגום',
      score: ':ניקוד',
      next: 'הבא ✉️'
    }
  }
};
    content.catalog.levels = {
  beginner: {
    name: 'Complete Beginner',
    emoji: '🌱',
    desc: 'I know almost nothing yet'
  },
  intermediate: {
    name: 'Intermediate',
    emoji: '🌳',
    desc: 'I can hold simple conversations'
  },
  advanced: {
    name: 'Advanced',
    emoji: '🏔️',
    desc: 'I want to perfect my skills'
  }
};
    content.catalog.stableLevelKeys = stableLevelKeys.slice();

    content.phraseBanks = content.phraseBanks || {};
    content.lessons = content.lessons || {};
    content.glosses = content.glosses || {};
    content.legacyDemo = content.legacyDemo || {};

    global.CATLINGO_CONTENT = content;
    global.LANGS = content.catalog.languages;
    global.THEMES = content.catalog.themes;
    global.LEVELS = content.catalog.levels;
    global.LEVEL_DEMO = content.phraseBanks;
    global.LESSONS = content.lessons;
    global.GLOSS = content.glosses;
    global.DEMO = content.legacyDemo;

    // Language data files call this to populate the shared registries.
    global.__registerLanguageContent = function registerLanguageContent(languageKey, payload) {
        const sourceBanks = payload && payload.phraseBanks ? payload.phraseBanks : {};
        const unknownLevels = Object.keys(sourceBanks).filter(level => !stableLevelKeys.includes(level));
        if (unknownLevels.length) {
            throw new Error('Unknown levels for ' + languageKey + ': ' + unknownLevels.join(', '));
        }

        const phraseBanks = {};
        for (const level of stableLevelKeys) {
            phraseBanks[level] = Array.isArray(sourceBanks[level]) ? sourceBanks[level] : [];
        }

        content.phraseBanks[languageKey] = phraseBanks;
        content.lessons[languageKey] = Array.isArray(payload && payload.lessons) ? payload.lessons : [];
        content.glosses[languageKey] = payload && payload.glosses && typeof payload.glosses === 'object' ? payload.glosses : {};
        content.legacyDemo[languageKey] = Array.isArray(payload && payload.demo)
            ? payload.demo
            : [...phraseBanks.beginner, ...phraseBanks.intermediate, ...phraseBanks.advanced];
    };
})(window);
