// ==========================================
// MODAL CONTROLLERS (Hướng dẫn & FAQ)
// ==========================================

function openGuideModal() {
    document.getElementById('guideModal').classList.add('active');
}

function closeGuideModal() {
    document.getElementById('guideModal').classList.remove('active');
}

window.addEventListener('click', function(e) {
    const modal = document.getElementById('guideModal');
    if (e.target === modal) {
        closeGuideModal();
    }
});

// ==========================================
// MODAL CONTROLLERS (Hướng dẫn & FAQ)
// ==========================================

function openGuideModal() {
    document.getElementById('guideModal').classList.add('active');
}

function closeGuideModal() {
    document.getElementById('guideModal').classList.remove('active');
}

// Đóng modal khi bấm ra ngoài vùng container
window.addEventListener('click', function(e) {
    const modal = document.getElementById('guideModal');
    if (e.target === modal) {
        closeGuideModal();
    }
});

// ==========================================
// CORE: TẠO THẺ BÀI TỪ CÂU HOÀN CHỈNH
// ==========================================
document.getElementById('prepCompleteBtn').addEventListener('click', function() {
    const sentenceInputs = document.querySelectorAll('.prep-sentence-input');
    const keywordInputs = document.querySelectorAll('.prep-keyword-input');
    const outcomeGrid = document.getElementById('prepOutcomeGrid');
    
    outcomeGrid.innerHTML = '';
    let prepDataStore = [];
    let hasContent = false;

    sentenceInputs.forEach((sentenceEl, index) => {
        const sentence = sentenceEl.value.trim();
        const customKeyword = keywordInputs[index].value.trim();
        const fallbackWord = sentence ? sentence.split(/\s+/).pop().replace(/[^a-zA-Z0-9]/g, '') : 'english';
        const keyword = customKeyword || fallbackWord;

        if (sentence) {
            hasContent = true;
            prepDataStore.push({ sentence: sentence, keyword: keyword });
        }
    });

    if (!hasContent) {
        alert('Vui lòng nhập ít nhất 1 câu hoàn chỉnh!');
        return;
    }

    prepDataStore.forEach((item) => {
        const card = document.createElement('div');
        card.className = 'flashcard-horizontal';
        const googleImagesUrl = `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(item.keyword)}`;

        card.innerHTML = `
            <a href="${googleImagesUrl}" target="_blank" class="card-search-box" title="Mở Google Images cho từ: ${item.keyword}">
                <div class="search-icon-wrapper">🔍</div>
                <div class="search-text-label">${item.keyword}</div>
            </a>
            <div class="card-content-side">
                <div class="card-sentence-full">${item.sentence}</div>
                <div class="card-actions-row-left">
                    <button type="button" class="btn-icon-text" onclick="speakText('${item.sentence.replace(/'/g, "\\'")}')">🔊 Nghe</button>
                    <button type="button" class="btn-icon-text" onclick="downloadVoice('${item.sentence.replace(/'/g, "\\'")}')">📥 Voice</button>
                    <button type="button" class="btn-icon-text" onclick="copyText('${item.sentence.replace(/'/g, "\\'")}', this)">📋 Copy</button>
                </div>
            </div>
        `;
        outcomeGrid.appendChild(card);
    });

    outcomeGrid.scrollIntoView({ behavior: 'smooth' });
});

function speakText(text) {
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'en-US';
        utterance.rate = 0.9;
        window.speechSynthesis.speak(utterance);
    }
}

function downloadVoice(text) { speakText(text); }

function copyText(text, btn) {
    navigator.clipboard.writeText(text).then(() => {
        const originalText = btn.innerHTML;
        btn.innerHTML = '✅ Đã Copy';
        setTimeout(() => { btn.innerHTML = originalText; }, 1200);
    });
}