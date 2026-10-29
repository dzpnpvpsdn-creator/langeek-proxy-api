// ==========================================
// MODULE: BROWSER AUDIO RECORDING & DOWNLOAD
// ==========================================

// Phát âm thanh trực tiếp trên web
function playElevenLabsAudio(textToSpeak) {
    if (!('speechSynthesis' in window)) {
        alert("Trình duyệt của bạn không hỗ trợ đọc giọng nói!");
        return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.lang = 'en-US';
    utterance.rate = 0.9;
    window.speechSynthesis.speak(utterance);
}

// Hàm tải file âm thanh trực tiếp bằng cách ghi lại luồng phát của trình duyệt
async function downloadSingleAudio(wordText) {
    if (!('speechSynthesis' in window)) {
        alert("Trình duyệt không hỗ trợ tổng hợp giọng nói!");
        return;
    }

    const safeFileName = wordText.toLowerCase().replace(/[^a-z0-9]/g, '_');
    
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const dest = audioCtx.createMediaStreamDestination();
        const mediaRecorder = new MediaRecorder(dest.stream);
        let chunks = [];

        mediaRecorder.ondataavailable = function(evt) {
            chunks.push(evt.data);
        };

        mediaRecorder.onstop = function() {
            const blob = new Blob(chunks, { type: 'audio/wav' });
            const url = URL.createObjectURL(blob);
            
            const link = document.createElement('a');
            link.href = url;
            link.download = `${safeFileName}.wav`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        };

        mediaRecorder.start();

        const utterance = new SpeechSynthesisUtterance(wordText);
        utterance.lang = 'en-US';
        utterance.rate = 0.85;

        utterance.onend = function() {
            setTimeout(() => {
                if (mediaRecorder.state === "recording") {
                    mediaRecorder.stop();
                }
                if (audioCtx.state !== 'closed') {
                    audioCtx.close();
                }
            }, 300);
        };

        utterance.onerror = function() {
            if (mediaRecorder.state === "recording") mediaRecorder.stop();
            alert(`Không thể tạo file âm thanh cho: "${wordText}"`);
        };

        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utterance);

    } catch (error) {
        console.error(error);
        alert(`Trình duyệt của bạn đang chặn tạo file tự động. Hãy dùng tính năng 🔊 Nghe để luyện tập trực tiếp nhé!`);
    }
}