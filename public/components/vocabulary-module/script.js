let generatedCardsData = [];
let currentExampleCount = 2;
let lastAIRequest = 0;
const AI_DELAY_MS = 5000;

// Folder handle — cache để không phải chọn lại
let cachedDirHandle = null;

// Số từ tải mỗi lần bấm
const BATCH_SIZE = 5;

// ==========================================
// STATE PERSISTENCE — chống reload
// ==========================================
const STORAGE_KEY_STATE = 'app_state_persist';

function saveAppState() {
    try {
        const state = {
            inputValue: document.getElementById('vocabInput')?.value || '',
            downloadedWords: downloadedWords,
            currentWord: window.__currentDownloadingWord || null,
            timestamp: Date.now()
        };
        sessionStorage.setItem(STORAGE_KEY_STATE, JSON.stringify(state));
    } catch (e) {}
}

function restoreAppState() {
    try {
        const raw = sessionStorage.getItem(STORAGE_KEY_STATE);
        if (!raw) return;
        const state = JSON.parse(raw);

        if (Date.now() - state.timestamp > 5000) {
            sessionStorage.removeItem(STORAGE_KEY_STATE);
            return;
        }

        console.log('🔄 Restore state sau reload');

        const ta = document.getElementById('vocabInput');
        if (ta && state.inputValue) {
            ta.value = state.inputValue;
        }

        if (state.downloadedWords) {
            downloadedWords = state.downloadedWords;
            try {
                localStorage.setItem(STORAGE_KEY_VOICE_STATE, JSON.stringify(downloadedWords));
            } catch (e) {}
        }

        sessionStorage.removeItem(STORAGE_KEY_STATE);
    } catch (e) {}
}

// ==========================================
// SVG ICONS
// ==========================================
const ICONS = {
    copy: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`,
    edit: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>`,
    save: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>`,
    plus: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>`,
    minus: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="5" y1="12" x2="19" y2="12"></line></svg>`,
    speaker: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>`,
    check: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`
};

// ==========================================
// MODALS
// ==========================================
function openGuideModal() { document.getElementById('guideModal').classList.add('active'); }
function closeGuideModal() { document.getElementById('guideModal').classList.remove('active'); }

window.addEventListener('click', function(e) {
    if (e.target.id === 'guideModal') closeGuideModal();
});

// ==========================================
// SEGMENTED CONTROL
// ==========================================
document.addEventListener('DOMContentLoaded', function() {
    const group = document.getElementById('exampleCountGroup');
    if (!group) return;
    group.querySelectorAll('.count-chip').forEach(chip => {
        chip.addEventListener('click', function(e) {
            e.preventDefault();
            group.querySelectorAll('.count-chip').forEach(c => c.classList.remove('active'));
            this.classList.add('active');
            currentExampleCount = parseInt(this.dataset.value);
        });
    });
});

// ==========================================
// LOCALSTORAGE
// ==========================================
const STORAGE_KEY_INPUT = 'vocab_input';
const STORAGE_KEY_CARDS = 'vocab_cards';
const STORAGE_KEY_TIME = 'vocab_last_time';
const STORAGE_KEY_VOICE_STATE = 'voice_downloaded';

function saveToStorage(input, cardsData) {
    try {
        localStorage.setItem(STORAGE_KEY_INPUT, input);
        localStorage.setItem(STORAGE_KEY_CARDS, JSON.stringify(cardsData));
        localStorage.setItem(STORAGE_KEY_TIME, new Date().toISOString());
    } catch (e) {}
}

function loadFromStorage() {
    try {
        const input = localStorage.getItem(STORAGE_KEY_INPUT) || '';
        const cardsRaw = localStorage.getItem(STORAGE_KEY_CARDS);
        const timeRaw = localStorage.getItem(STORAGE_KEY_TIME);
        const cardsData = cardsRaw ? JSON.parse(cardsRaw) : [];
        return { input, cardsData, lastTime: timeRaw };
    } catch (e) {
        return { input: '', cardsData: [], lastTime: null };
    }
}

function showLastGeneratedInfo(lastTime, isFresh) {
    const el = document.getElementById('lastGeneratedInfo');
    if (!el) return;
    if (!lastTime) { el.classList.remove('show'); el.textContent = ''; return; }
    const d = new Date(lastTime);
    const timeStr = d.toLocaleString('vi-VN', {
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        day: '2-digit', month: '2-digit', year: 'numeric'
    });
    const freshLabel = isFresh ? '<span class="fresh">🆕 Vừa tạo xong:</span> ' : '📅 Đã tạo lúc: ';
    el.innerHTML = `${freshLabel}${timeStr}`;
    el.classList.add('show');
}

// ==========================================
// DOWNLOAD HELPER
// ==========================================
function downloadBlobDefault(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// ==========================================
// DATABASE
// ==========================================
const VOCAB_DATABASE = {
    "cat": { pos: "(n)", phonetic: "/kæt/", ex1: "The lazy cat is sleeping on the warm sofa.", ex2: "She loves feeding stray cats in her neighborhood.", img: "https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=400" },
    "dog": { pos: "(n)", phonetic: "/dɔːɡ/", ex1: "My loyal dog waits for me by the front door every day.", ex2: "They took their puppy for a long walk in the park.", img: "https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=400" },
    "apple": { pos: "(n)", phonetic: "/ˈæp.əl/", ex1: "She sliced an apple for her afternoon snack.", ex2: "An apple a day keeps the doctor away.", img: "https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?w=400" },
    "beautiful": { pos: "(adj)", phonetic: "/ˈbjuː.tɪ.fəl/", ex1: "The sunset over the ocean was absolutely beautiful.", ex2: "She wore a beautiful red dress to the party.", img: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400" },
    "run": { pos: "(v)", phonetic: "/rʌn/", ex1: "I run three miles every morning before work.", ex2: "The children run around the playground happily.", img: "https://images.unsplash.com/photo-1552674605-db6ffd4facb5?w=400" },
    "happy": { pos: "(adj)", phonetic: "/ˈhæp.i/", ex1: "She was so happy to see her old friends again.", ex2: "The children looked happy playing in the park.", img: "https://images.unsplash.com/photo-1499209974431-9dddcece7f88?w=400" },
    "book": { pos: "(n)", phonetic: "/bʊk/", ex1: "He reads a book every night before sleeping.", ex2: "This book changed the way I think about life.", img: "https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=400" },
    "water": { pos: "(n)", phonetic: "/ˈwɔː.tər/", ex1: "Please drink more water throughout the day.", ex2: "The water in this lake is crystal clear.", img: "https://images.unsplash.com/photo-1548839140-29a749e1cf4d?w=400" },
    "school": { pos: "(n)", phonetic: "/skuːl/", ex1: "The children walk to school together every morning.", ex2: "She teaches English at a local high school.", img: "https://images.unsplash.com/photo-1580582932707-520aed937b7b?w=400" },
    "teacher": { pos: "(n)", phonetic: "/ˈtiː.tʃər/", ex1: "Our teacher explained the lesson very clearly.", ex2: "She wants to become an English teacher.", img: "https://images.unsplash.com/photo-1544717305-2782549b5136?w=400" },
    "friend": { pos: "(n)", phonetic: "/frend/", ex1: "He is my best friend since childhood.", ex2: "Good friends always support each other.", img: "https://images.unsplash.com/photo-1511632765486-a01980e01a18?w=400" },
    "family": { pos: "(n)", phonetic: "/ˈfæm.əl.i/", ex1: "My family gathers every Sunday for dinner.", ex2: "Family is the most important thing in life.", img: "https://images.unsplash.com/photo-1511895426328-dc8714191300?w=400" },
    "travel": { pos: "(v)", phonetic: "/ˈtræv.əl/", ex1: "I love to travel to new countries every year.", ex2: "They travel by train across Europe.", img: "https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=400" },
    "food": { pos: "(n)", phonetic: "/fuːd/", ex1: "Vietnamese food is famous around the world.", ex2: "We bought food for the weekend trip.", img: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400" },
    "work": { pos: "(v/n)", phonetic: "/wɜːrk/", ex1: "I work from home three days a week.", ex2: "She has a lot of work to finish today.", img: "https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=400" },
    "time": { pos: "(n)", phonetic: "/taɪm/", ex1: "What time do you usually wake up?", ex2: "We had a wonderful time at the beach.", img: "https://images.unsplash.com/photo-1495364141860-b0d03eccd065?w=400" },
    "love": { pos: "(v/n)", phonetic: "/lʌv/", ex1: "I love spending time with my family.", ex2: "Their love story inspired everyone.", img: "https://images.unsplash.com/photo-1518199266791-5375a83190b7?w=400" },
    "house": { pos: "(n)", phonetic: "/haʊs/", ex1: "They bought a small house near the beach.", ex2: "The house has a beautiful garden.", img: "https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=400" },
    "city": { pos: "(n)", phonetic: "/ˈsɪt.i/", ex1: "Ho Chi Minh City is very busy at night.", ex2: "They moved to a bigger city last year.", img: "https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=400" },
    "study": { pos: "(v)", phonetic: "/ˈstʌd.i/", ex1: "I study English for two hours every day.", ex2: "She studies hard to pass the exam.", img: "https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=400" },
    "learn": { pos: "(v)", phonetic: "/lɜːrn/", ex1: "Children learn new things very quickly.", ex2: "I want to learn how to play the piano.", img: "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=400" },
    "speak": { pos: "(v)", phonetic: "/spiːk/", ex1: "She can speak three languages fluently.", ex2: "Please speak more slowly, I can't follow.", img: "https://images.unsplash.com/photo-1543269865-cbf427effbad?w=400" },
    "listen": { pos: "(v)", phonetic: "/ˈlɪs.ən/", ex1: "I listen to podcasts while commuting.", ex2: "Please listen carefully to the instructions.", img: "https://images.unsplash.com/photo-1590602847861-f357a9332bbc?w=400" },
    "write": { pos: "(v)", phonetic: "/raɪt/", ex1: "She writes in her journal every night.", ex2: "Can you write your name here, please?", img: "https://images.unsplash.com/photo-1455390582262-044cdead277a?w=400" },
    "take care": { pos: "(phrase)", phonetic: "/teɪk ker/", ex1: "Make sure to take good care of yourself when traveling.", ex2: "I have to go now, take care and see you soon!", img: "https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?w=400" },
    "look forward to": { pos: "(phrase)", phonetic: "/lʊk ˈfɔːr.wɚd tuː/", ex1: "I look forward to meeting you next week.", ex2: "We look forward to hearing from you soon.", img: "https://images.unsplash.com/photo-1521791136064-7986c2920216?w=400" },
    "give up": { pos: "(phrase)", phonetic: "/ɡɪv ʌp/", ex1: "Don't give up on your dreams so easily.", ex2: "He gave up smoking last year.", img: "https://images.unsplash.com/photo-1499209974431-9dddcece7f88?w=400" },
    "town hall": { pos: "(n)", phonetic: "/taʊn hɔːl/", ex1: "The meeting will be held at the town hall.", ex2: "They got married in the old town hall.", img: "https://images.unsplash.com/photo-1541888946425-d81bb19240f5?w=400" },
    "fountain": { pos: "(n)", phonetic: "/ˈfaʊn.tɪn/", ex1: "Children played near the fountain in the park.", ex2: "The fountain in the square lights up at night.", img: "https://images.unsplash.com/photo-1533387520709-752d83de3630?w=400" },
    "library": { pos: "(n)", phonetic: "/ˈlaɪ.brer.i/", ex1: "I often study at the university library.", ex2: "The library has thousands of old books.", img: "https://images.unsplash.com/photo-1521587760476-6c12a4b040da?w=400" },
    "restaurant": { pos: "(n)", phonetic: "/ˈres.tər.ɑːnt/", ex1: "We had dinner at a fancy restaurant last night.", ex2: "This restaurant is famous for its seafood.", img: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=400" }
};

// ==========================================
// AI - POLLINATIONS
// ==========================================
async function generateExamplesWithAI(word, isPhrase, count) {
    const elapsed = Date.now() - lastAIRequest;
    if (elapsed < AI_DELAY_MS) await new Promise(r => setTimeout(r, AI_DELAY_MS - elapsed));
    lastAIRequest = Date.now();

    const wordType = isPhrase ? 'phrase' : 'word';
    const prompt = `Generate exactly ${count} SHORT, natural English sentences that use the ${wordType} "${word}".

REQUIREMENTS:
- Complete grammatical sentences with subject and verb
- STRICTLY between 8 and 15 words each
- Simple, everyday context
- Use "${word}" naturally without quotes
- Do NOT start with "I learned", "The word", "The phrase"
- One sentence per line, no numbering

Output ONLY the ${count} sentences.`;

    for (let attempt = 0; attempt < 3; attempt++) {
        try {
            const url = `https://text.pollinations.ai/${encodeURIComponent(prompt)}?model=openai`;
            const res = await fetch(url, { signal: AbortSignal.timeout(25000) });
            if (res.status === 404 || res.status === 429 || res.status === 502) {
                await new Promise(r => setTimeout(r, 3000));
                lastAIRequest = Date.now();
                continue;
            }
            if (!res.ok) break;

            const text = await res.text();
            const wordLower = word.toLowerCase().trim();
            const lines = text.split('\n')
                .map(l => l.trim())
                .map(l => l.replace(/^\d+[\.\)]\s*/, '').replace(/^[-•*]\s*/, ''))
                .map(l => l.replace(/^["'`]|["'`]$/g, '').trim())
                .filter(l => {
                    if (l.length < 25 || l.length > 120) return false;
                    if (!/[.!?]$/.test(l)) return false;
                    const words = l.split(/\s+/);
                    if (words.length < 7 || words.length > 18) return false;
                    const lower = l.toLowerCase();
                    if (lower.startsWith('i learned') || lower.startsWith('the word "') || lower.startsWith('the phrase "')) return false;
                    if (lower.includes('is very common in english') || lower.includes('in my english class today')) return false;
                    if (isPhrase) {
                        const mainWord = wordLower.split(/\s+/).pop();
                        if (!lower.includes(mainWord)) return false;
                    } else {
                        if (!lower.includes(wordLower)) return false;
                    }
                    return true;
                });

            const unique = [...new Set(lines)];
            if (unique.length >= 1) return unique.slice(0, count);
        } catch (e) {
            await new Promise(r => setTimeout(r, 3000));
            lastAIRequest = Date.now();
        }
    }
    return null;
}

const FALLBACK_PHRASE = [
    "This expression is commonly heard in everyday conversations.",
    "Native speakers often use this kind of phrase naturally.",
    "You will come across this expression frequently in English.",
    "This phrase appears in many real-life situations."
];
const FALLBACK_WORD = [
    "This word appears frequently in everyday English.",
    "You will see this word often in English texts.",
    "This is a common word in daily conversations.",
    "English speakers use this word in many contexts."
];

function isFallbackExample(ex) {
    if (!ex) return true;
    const lower = ex.toLowerCase();
    return lower.startsWith('this word appears') || lower.startsWith('you will see this word')
        || lower.startsWith('this is a common word') || lower.startsWith('english speakers use this word')
        || lower.startsWith('this expression is commonly') || lower.startsWith('native speakers often use this kind')
        || lower.startsWith('you will come across this expression') || lower.startsWith('this phrase appears in many');
}

async function getExamples(word, isPhrase, count) {
    let examples = [];
    const aiEx = await generateExamplesWithAI(word, isPhrase, count).catch(() => null);
    if (aiEx && aiEx.length) examples = aiEx.slice();

    const fallback = isPhrase ? FALLBACK_PHRASE : FALLBACK_WORD;
    let fi = 0;
    while (examples.length < count && fi < fallback.length * 2) {
        const fb = fallback[fi % fallback.length];
        if (!examples.includes(fb)) examples.push(fb);
        fi++;
    }
    return examples.slice(0, count);
}

// ==========================================
// LANGEEK PROXY
// ==========================================
async function fetchFromLangeek(word) {
    try {
        const url = `http://localhost:3001/langeek?q=${encodeURIComponent(word)}`;
        const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
        if (!res.ok) return null;
        const json = await res.json();
        const data = json.data;
        if (!Array.isArray(data) || !data.length) return null;

        const lowerWord = word.toLowerCase().trim();
        let entry = data.find(item => item.entry?.toLowerCase() === lowerWord) || data[0];

        let photo = entry.translation?.wordPhoto?.photo;
        if (!photo && entry.translations) {
            for (const posType of ['noun', 'verb', 'adjective', 'adverb', 'phrase']) {
                const list = entry.translations[posType];
                if (Array.isArray(list)) {
                    for (const item of list) {
                        if (item.wordPhoto?.photo) { photo = item.wordPhoto.photo; break; }
                    }
                }
                if (photo) break;
            }
        }

        const pronunciation = entry.pronunciation || '';
        const pos = entry.translation?.partOfSpeech?.partOfSpeechType || '';

        return {
            img: photo || null,
            phonetic: pronunciation ? `/${pronunciation}/` : '',
            pos: pos ? `(${pos})` : '',
            id: entry.id
        };
    } catch (e) { return null; }
}

async function fetchPhoneticFromWiktionary(word) {
    try {
        const url = `https://en.wiktionary.org/api/rest_v1/page/definition/${encodeURIComponent(word.toLowerCase())}`;
        const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
        if (!res.ok) return null;
        const data = await res.json();
        const enDefs = data.en;
        if (!Array.isArray(enDefs)) return null;
        for (const def of enDefs) {
            if (def.pronunciations && def.pronunciations.length) {
                for (const p of def.pronunciations) {
                    if (p.ipa) return `/${p.ipa}/`;
                }
            }
        }
        return null;
    } catch (e) { return null; }
}

async function fetchImageFromWikimedia(word) {
    try {
        const url = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(word)}&gsrnamespace=6&gsrlimit=1&prop=imageinfo&iiprop=url&iiurlwidth=400&format=json&origin=*`;
        const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
        if (!res.ok) return null;
        const data = await res.json();
        const pages = data?.query?.pages;
        if (!pages) return null;
        for (const key in pages) {
            const info = pages[key]?.imageinfo?.[0];
            if (info?.thumburl) return info.thumburl;
            if (info?.url) return info.url;
        }
        return null;
    } catch (e) { return null; }
}

function getPlaceholderImage(word) {
    return `https://placehold.co/400x200/00C2CB/FFFFFF?text=${encodeURIComponent(word)}&font=montserrat`;
}

// ==========================================
// GET VOCAB DETAILS
// ==========================================
async function getVocabularyDetails(word, userMeaning) {
    const cleanWord = word.trim();
    const lowerWord = cleanWord.toLowerCase();
    const isPhrase = cleanWord.includes(' ');
    const exampleCount = currentExampleCount;

    if (VOCAB_DATABASE[lowerWord]) {
        const db = VOCAB_DATABASE[lowerWord];
        const baseExamples = [db.ex1, db.ex2].filter(Boolean);
        let examples = baseExamples.slice(0, exampleCount);
        if (examples.length < exampleCount) {
            const aiEx = await generateExamplesWithAI(cleanWord, isPhrase, exampleCount).catch(() => null);
            if (aiEx) {
                for (const a of aiEx) {
                    if (!examples.includes(a)) examples.push(a);
                    if (examples.length >= exampleCount) break;
                }
            }
        }
        const fb = isPhrase ? FALLBACK_PHRASE : FALLBACK_WORD;
        let fi = 0;
        while (examples.length < exampleCount && fi < fb.length) {
            if (!examples.includes(fb[fi])) examples.push(fb[fi]);
            fi++;
        }
        return {
            word: cleanWord, pos: db.pos, phonetic: db.phonetic,
            meaning: userMeaning, examples: examples.slice(0, exampleCount), img: db.img
        };
    }

    const [langeekData, examples] = await Promise.all([
        fetchFromLangeek(lowerWord).catch(() => null),
        getExamples(cleanWord, isPhrase, exampleCount).catch(() => null)
    ]);

    const finalExamples = (examples && examples.length) ? examples : (isPhrase ? FALLBACK_PHRASE : FALLBACK_WORD).slice(0, exampleCount);

    if (langeekData && langeekData.img) {
        return {
            word: cleanWord,
            pos: langeekData.pos || (isPhrase ? "(phrase)" : "(n/v)"),
            phonetic: langeekData.phonetic || `/${lowerWord}/`,
            meaning: userMeaning, examples: finalExamples, img: langeekData.img
        };
    }

    const [phonetic, wikiImg] = await Promise.all([
        isPhrase ? Promise.resolve(null) : fetchPhoneticFromWiktionary(lowerWord).catch(() => null),
        fetchImageFromWikimedia(lowerWord).catch(() => null)
    ]);

    return {
        word: cleanWord, pos: isPhrase ? "(phrase)" : "(n/v)",
        phonetic: phonetic || `/${lowerWord}/`, meaning: userMeaning,
        examples: finalExamples, img: wikiImg || getPlaceholderImage(cleanWord)
    };
}

// ==========================================
// RENDER FLASHCARDS
// ==========================================
function renderFlashcards(cardsData) {
    const container = document.getElementById('flashcardContainer');
    container.innerHTML = '';

    if (!cardsData.length) {
        container.innerHTML = '<p class="placeholder-text">Nhập từ vựng ở góc bên trái để bắt đầu tạo thẻ bài.</p>';
        return;
    }

    cardsData.forEach((data, cardIndex) => {
        const googleImagesUrl = `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(data.word)}`;
        const fallbackImg = getPlaceholderImage(data.word);
        const examplesHtml = (data.examples || []).map(ex => `<p class="example-item">${ex}</p>`).join('');

        const card = document.createElement('div');
        card.className = 'flashcard';
        card.dataset.cardIndex = cardIndex;

        card.innerHTML = `
            <div class="card-img-wrapper">
                <img src="${data.img}" alt="${data.word}" loading="lazy"
                     onerror="this.onerror=null;this.src='${fallbackImg}'">
                <a href="${googleImagesUrl}" target="_blank" class="btn-search-img">🔍 Ảnh</a>
            </div>
            <div class="card-body">
                <div class="card-header">
                    <span class="card-word" contenteditable="false">${data.word}</span>
                    <span class="card-pos" contenteditable="false">${data.pos}</span>
                </div>
                <div class="card-phonetic" contenteditable="false">${data.phonetic}</div>
                <div class="card-examples">${examplesHtml}</div>
                <div class="card-meaning" contenteditable="false">${data.meaning}</div>
                <div class="card-actions-row">
                    <button type="button" class="btn-icon-text" onclick="copyCardContent(this)" title="Copy">${ICONS.copy}</button>
                    <button type="button" class="btn-icon-text" onclick="toggleEditCard(this)" title="Sửa">${ICONS.edit}</button>
                    <button type="button" class="btn-icon-text" onclick="addExample(this)" title="Thêm ví dụ">${ICONS.plus}</button>
                    <button type="button" class="btn-icon-text" onclick="removeExample(this)" title="Xóa ví dụ">${ICONS.minus}</button>
                </div>
            </div>
        `;
        container.appendChild(card);
    });
}

async function addExample(button) {
    const card = button.closest('.flashcard');
    const examplesBox = card.querySelector('.card-examples');
    const word = card.querySelector('.card-word').textContent.trim();
    const isPhrase = word.includes(' ');
    const existing = Array.from(examplesBox.querySelectorAll('.example-item')).map(p => p.textContent);

    const loadingP = document.createElement('p');
    loadingP.className = 'example-item loading';
    loadingP.textContent = '⏳ Đang tạo ví dụ mới...';
    examplesBox.appendChild(loadingP);

    let newEx = null;
    const aiEx = await generateExamplesWithAI(word, isPhrase, 3).catch(() => null);
    if (aiEx) {
        for (const a of aiEx) { if (!existing.includes(a)) { newEx = a; break; } }
    }
    if (!newEx) {
        const fb = isPhrase ? FALLBACK_PHRASE : FALLBACK_WORD;
        for (const f of fb) { if (!existing.includes(f)) { newEx = f; break; } }
    }
    if (!newEx) newEx = "This is a common expression in English.";

    loadingP.remove();
    const p = document.createElement('p');
    p.className = 'example-item';
    p.textContent = newEx;
    examplesBox.appendChild(p);
}

function removeExample(button) {
    const card = button.closest('.flashcard');
    const examplesBox = card.querySelector('.card-examples');
    const items = examplesBox.querySelectorAll('.example-item');
    if (items.length <= 1) { alert('Cần ít nhất 1 ví dụ!'); return; }
    items[items.length - 1].remove();
}

// ==========================================
// PROCESS FLASHCARDS
// ==========================================
document.getElementById('processBtn').addEventListener('click', async function(e) {
    e.preventDefault();
    const rawInput = document.getElementById('vocabInput').value.trim();
    const warningMsg = document.getElementById('warningMsg');
    const btn = this;

    warningMsg.textContent = '';
    generatedCardsData = [];

    if (!rawInput) {
        warningMsg.textContent = 'Vui lòng nhập ít nhất 1 từ vựng!';
        renderFlashcards([]);
        saveToStorage('', []);
        showLastGeneratedInfo(null, false);
        return;
    }

    btn.disabled = true;

    const lines = rawInput.split('\n').filter(l => l.trim());
    const parseErrors = [];
    const parsedItems = [];

    lines.forEach((line) => {
        let parts = line.split(':');
        if (parts.length < 2) { parseErrors.push(line); return; }
        parsedItems.push({ word: parts[0].trim(), meaning: parts[1].trim() });
    });

    const results = [];
    for (let i = 0; i < parsedItems.length; i++) {
        const item = parsedItems[i];
        btn.textContent = `⏳ Đang tạo ${i + 1}/${parsedItems.length}...`;
        try {
            const data = await getVocabularyDetails(item.word, item.meaning);
            results.push(data);
        } catch (e) {
            results.push({
                word: item.word, pos: "(n/v)", phonetic: `/${item.word.toLowerCase()}/`,
                meaning: item.meaning, examples: FALLBACK_WORD.slice(0, 2), img: getPlaceholderImage(item.word)
            });
        }
    }

    for (let i = 0; i < results.length; i++) {
        const r = results[i];
        if (r.examples && r.examples.length && isFallbackExample(r.examples[0])) {
            btn.textContent = `⏳ Thử lại ${i + 1}/${results.length}...`;
            await new Promise(res => setTimeout(res, 6000));
            const item = parsedItems[i];
            const aiEx = await generateExamplesWithAI(item.word, item.word.includes(' '), currentExampleCount).catch(() => null);
            if (aiEx && aiEx.length) results[i].examples = aiEx;
        }
    }

    generatedCardsData = results;
    renderFlashcards(generatedCardsData);
    saveToStorage(rawInput, generatedCardsData);
    showLastGeneratedInfo(new Date().toISOString(), true);

    if (parseErrors.length) warningMsg.textContent = `${parseErrors.length} dòng sai định dạng đã bị bỏ qua.`;

    btn.disabled = false;
    btn.textContent = 'Tạo Flashcards';
});

// ==========================================
// CLEAR
// ==========================================
document.getElementById('clearBtn').addEventListener('click', function(e) {
    e.preventDefault();
    if (!confirm('Xóa hết từ vựng đã nhập và thẻ bài đã tạo?')) return;
    localStorage.removeItem(STORAGE_KEY_INPUT);
    localStorage.removeItem(STORAGE_KEY_CARDS);
    localStorage.removeItem(STORAGE_KEY_TIME);
    document.getElementById('vocabInput').value = '';
    document.getElementById('warningMsg').textContent = '';
    generatedCardsData = [];
    renderFlashcards([]);
    showLastGeneratedInfo(null, false);
    updateVoiceStudio('');
});

// ==========================================
// VOICE STUDIO
// ==========================================
let downloadedWords = {};
try {
    downloadedWords = JSON.parse(localStorage.getItem(STORAGE_KEY_VOICE_STATE) || '{}');
} catch (e) { downloadedWords = {}; }

function saveDownloadState() {
    try {
        localStorage.setItem(STORAGE_KEY_VOICE_STATE, JSON.stringify(downloadedWords));
    } catch (e) {}
}

function parseVocabWords(text) {
    if (!text) return [];
    const words = [];
    const seen = new Set();
    text.split('\n').forEach(line => {
        line = line.trim();
        if (!line) return;
        const parts = line.split(':');
        let word = parts[0].trim();
        if (!word) return;
        word = word.replace(/[?!.,;"""'']/g, '').trim();
        if (!word) return;
        const key = word.toLowerCase();
        if (seen.has(key)) return;
        seen.add(key);
        words.push(word);
    });
    return words;
}

function updateVoiceStudio(text) {
    const listEl = document.getElementById('voicePreviewList');
    const badgeEl = document.getElementById('voiceCountBadge');
    if (!listEl || !badgeEl) return;

    const words = parseVocabWords(text);
    badgeEl.textContent = `${words.length} từ`;

    if (words.length === 0) {
        listEl.innerHTML = '<div class="voice-studio-empty">Nhập từ vựng ở dưới để xem preview</div>';
        updateVoiceButtonState();
        return;
    }

    const downloadingWord = window.__currentDownloadingWord || null;

    listEl.innerHTML = words.map((w, i) => {
        const isDone = downloadedWords[w] === true;
        const isDownloading = w === downloadingWord;

        let statusClass = 'pending';
        let statusText = '⏸️ Chờ';

        if (isDone) {
            statusClass = 'done';
            statusText = '✅ Đã tải';
        } else if (isDownloading) {
            statusClass = 'loading';
            statusText = '⏳ Đang tải...';
        }

        return `
            <div class="voice-preview-item ${statusClass}" data-word="${w.replace(/"/g, '&quot;')}">
                <button type="button" class="voice-preview-play" onclick="previewWord('${w.replace(/'/g, "\\'")}')" title="Nghe thử (giọng trình duyệt)">
                    ${ICONS.speaker}
                </button>
                <span class="voice-preview-word">${w}</span>
                <span class="voice-preview-index">#${i + 1}</span>
                <span class="voice-preview-status ${statusClass}">${statusText}</span>
            </div>
        `;
    }).join('');

    updateVoiceButtonState();
}

function updateVoiceButtonState() {
    const btn = document.getElementById('downloadNextBtn');
    const ta = document.getElementById('vocabInput');
    if (!btn || !ta) return;

    const words = parseVocabWords(ta.value);
    const remaining = words.filter(w => !downloadedWords[w]);

    btn.disabled = false;
    btn.classList.remove('done');

    if (words.length === 0) {
        btn.textContent = '📥 Tải 5 từ đầu tiên';
        btn.disabled = true;
        return;
    }

    if (remaining.length === 0) {
        btn.textContent = '🎉 Đã tải hết — Bấm để tải lại từ đầu';
        btn.classList.add('done');
        return;
    }

    const batchCount = Math.min(BATCH_SIZE, remaining.length);
    const doneCount = words.length - remaining.length;

    if (doneCount === 0) {
        btn.textContent = `📥 Tải ${batchCount} từ đầu tiên`;
    } else {
        btn.textContent = `📥 Tải ${batchCount} từ tiếp (còn ${remaining.length})`;
    }
}

function previewWord(word) {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(word);
    u.lang = 'en-US';
    u.rate = 0.9;
    window.speechSynthesis.speak(u);
}

// ==========================================
// HELPERS
// ==========================================
function safeFileName(word) {
    return word.replace(/[^a-z0-9]/gi, '_').toLowerCase();
}

async function fetchVoiceBlob(word) {
    const VOICE = 'en-US-JennyNeural';
    const url = `http://localhost:3001/edge-tts?q=${encodeURIComponent(word)}&voice=${VOICE}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(20000) });

    if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
    }

    const blob = await res.blob();
    if (blob.size < 500) {
        throw new Error(`File quá nhỏ`);
    }
    return blob;
}

// ==========================================
// CHỌN FOLDER
// ==========================================
async function chooseFolder() {
    if (!('showDirectoryPicker' in window)) {
        alert('Trình duyệt không hỗ trợ chọn folder.\nFile sẽ vào Downloads mặc định.');
        return false;
    }

    try {
        const dirHandle = await window.showDirectoryPicker({
            mode: 'readwrite',
            startIn: 'downloads'
        });
        cachedDirHandle = dirHandle;
        console.log('📁 Đã chọn folder:', dirHandle.name);

        const folderNameEl = document.getElementById('folderName');
        const chooseBtn = document.getElementById('chooseFolderBtn');
        if (folderNameEl) {
            folderNameEl.textContent = '📂 ' + dirHandle.name;
            folderNameEl.classList.add('chosen');
        }
        if (chooseBtn) {
            chooseBtn.textContent = '✅ Đã chọn';
            chooseBtn.classList.add('chosen');
        }

        return true;
    } catch (err) {
        if (err.name === 'AbortError') {
            console.log('User hủy chọn folder');
            return false;
        }
        console.error('Lỗi chọn folder:', err);
        return false;
    }
}

// ==========================================
// TẢI 5 TỪ 1 LẦN — vào cùng folder
// ==========================================
async function downloadNextWord() {
    const ta = document.getElementById('vocabInput');
    const allWords = parseVocabWords(ta.value);
    const remaining = allWords.filter(w => !downloadedWords[w]);

    if (remaining.length === 0) {
        if (confirm('Đã tải hết rồi!\n\nBạn có muốn TẢI LẠI TỪ ĐẦU không?')) {
            downloadedWords = {};
            saveDownloadState();
            updateVoiceStudio(ta.value);
        }
        return;
    }

    if (!cachedDirHandle) {
        const ok = await chooseFolder();
        if (!ok) {
            console.log('Không có folder → dùng Downloads');
        }
    }

    // Lấy 5 từ tiếp theo
    const batch = remaining.slice(0, BATCH_SIZE);
    const btn = document.getElementById('downloadNextBtn');
    const progressEl = document.getElementById('voiceProgress');

    btn.disabled = true;

    // LƯU STATE + CHẶN RELOAD
    saveAppState();

    const preventUnload = (e) => {
        e.preventDefault();
        e.returnValue = '';
        return '';
    };
    window.addEventListener('beforeunload', preventUnload);

    let success = 0;
    let failed = 0;

    // ═══════════════════════════════════════
    // LOOP 5 TỪ
    // ═══════════════════════════════════════
    for (let i = 0; i < batch.length; i++) {
        const word = batch[i];
        progressEl.textContent = `Đang tải ${i + 1}/${batch.length}: ${word}`;

        window.__currentDownloadingWord = word;
        updateVoiceStudio(ta.value);

        try {
            const blob = await fetchVoiceBlob(word);
            const filename = `${safeFileName(word)}.mp3`;

            let written = false;
            if (cachedDirHandle) {
                try {
                    const fileHandle = await cachedDirHandle.getFileHandle(filename, { create: true });
                    const writable = await fileHandle.createWritable();
                    await writable.write(blob);
                    await writable.close();
                    written = true;
                    console.log(`✓ ${i + 1}/${batch.length} — ${filename}`);
                } catch (e) {
                    console.warn('Ghi file lỗi:', e);
                    cachedDirHandle = null;
                }
            }

            if (!written) {
                downloadBlobDefault(blob, filename);
                console.log(`✓ ${i + 1}/${batch.length} — Fallback Downloads/${filename}`);
            }

            downloadedWords[word] = true;
            saveDownloadState();
            saveAppState();
            success++;

            await new Promise(r => setTimeout(r, 200));
        } catch (e) {
            console.error(`❌ Lỗi "${word}":`, e);
            failed++;
        }

        updateVoiceStudio(ta.value);
    }

    window.__currentDownloadingWord = null;

    // BỎ CHẶN + CLEAR STATE
    window.removeEventListener('beforeunload', preventUnload);
    sessionStorage.removeItem(STORAGE_KEY_STATE);

    const folderDisplay = cachedDirHandle ? cachedDirHandle.name : 'Downloads';
    if (failed === 0) {
        progressEl.textContent = `✅ Đã tải ${success}/${batch.length} từ → 📁 ${folderDisplay}/`;
    } else {
        progressEl.textContent = `⚠️ Tải xong: ${success} OK, ${failed} lỗi → 📁 ${folderDisplay}/`;
    }

    updateVoiceStudio(ta.value);
    btn.disabled = false;

    setTimeout(() => {
        if (progressEl.textContent.startsWith('✅') || progressEl.textContent.startsWith('⚠️')) {
            progressEl.textContent = '';
        }
    }, 5000);
}

// ==========================================
// INPUT EVENT + RESTORE
// ==========================================
document.addEventListener('DOMContentLoaded', function() {
    restoreAppState();

    const ta = document.getElementById('vocabInput');
    if (!ta) return;

    ta.addEventListener('input', () => updateVoiceStudio(ta.value));

    const { input, cardsData, lastTime } = loadFromStorage();
    if (input) {
        ta.value = input;
        updateVoiceStudio(input);
    }
    if (cardsData && cardsData.length) {
        generatedCardsData = cardsData;
        renderFlashcards(cardsData);
        showLastGeneratedInfo(lastTime, false);
    }

    const nextBtn = document.getElementById('downloadNextBtn');
    if (nextBtn) {
        nextBtn.addEventListener('click', (e) => {
            e.preventDefault();
            downloadNextWord();
        });
    }

    const chooseBtn = document.getElementById('chooseFolderBtn');
    if (chooseBtn) {
        chooseBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            await chooseFolder();
            updateVoiceButtonState();
        });
    }
});

// ==========================================
// COPY / EDIT CARD
// ==========================================
function copyCardContent(button) {
    const card = button.closest('.flashcard');
    const word = card.querySelector('.card-word').textContent.trim();
    const pos = card.querySelector('.card-pos').textContent.trim();
    const phonetic = card.querySelector('.card-phonetic').textContent.trim();
    const meaning = card.querySelector('.card-meaning').textContent.trim();
    const examples = Array.from(card.querySelectorAll('.example-item')).map(p => p.textContent).join('\n');

    let copyText = `${word} ${pos}\n${phonetic}\n${examples}\n${meaning}`;

    navigator.clipboard.writeText(copyText.trim()).then(() => {
        const originalHTML = button.innerHTML;
        button.innerHTML = ICONS.check;
        setTimeout(() => button.innerHTML = originalHTML, 1000);
    });
}

function toggleEditCard(button) {
    const card = button.closest('.flashcard');
    const editables = card.querySelectorAll('[contenteditable], .example-item');

    if (editables.length && editables[0].contentEditable === 'true') {
        editables.forEach(el => {
            el.contentEditable = 'false';
            el.style.borderBottom = 'none';
        });
        button.innerHTML = ICONS.edit;
        button.title = 'Sửa';
    } else {
        editables.forEach(el => {
            el.contentEditable = 'true';
            el.style.borderBottom = '1px dashed #00C2CB';
        });
        button.innerHTML = ICONS.save;
        button.title = 'Lưu';
    }
}