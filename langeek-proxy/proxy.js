import express from 'express';
import cors from 'cors';
import * as cheerio from 'cheerio';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';
import fs from 'fs';
import path from 'path';
import os from 'os';

// 1. KHỞI TẠO APP VÀ PORT
const app = express();
const PORT = 3001;

// 2. CẤU HÌNH CORS
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Private-Network', 'true');
    next();
});
app.use(cors());

// 3. CÁC BIẾN TOÀN CỤC
const cache = new Map();
const CACHE_TTL = 1000 * 60 * 60; // 1 giờ

const BROWSER_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
};

// 4. CÁC HÀM XỬ LÝ
async function fetchHtml(url) {
    const res = await fetch(url, { headers: BROWSER_HEADERS, redirect: 'follow' });
    if (!res.ok) throw new Error(`HTTP ${res.status} cho ${url}`);
    return await res.text();
}

async function findLangeekUrl(word) {
    const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent('site:dictionary.langeek.co ' + word)}`;
    try {
        const html = await fetchHtml(searchUrl);
        const $ = cheerio.load(html);
        let found = null;
        $('a.result__a').each((i, el) => {
            const href = $(el).attr('href') || '';
            const match = href.match(/uddg=([^&]+)/);
            if (match) {
                const decoded = decodeURIComponent(match[1]);
                if (decoded.includes('dictionary.langeek.co/en/word/')) {
                    found = decoded;
                    return false; // break
                }
            }
        });
        return found;
    } catch (e) {
        console.error('Lỗi tìm LanGeek:', e);
        return null;
    }
}

// ==========================================
// 5. ROUTES (API)
// ==========================================
app.get('/langeek', async (req, res) => {
    const word = req.query.q;
    if (!word) return res.status(400).json({ error: 'Missing q parameter' });

    if (cache.has(word)) {
        const cached = cache.get(word);
        if (Date.now() - cached.time < CACHE_TTL) {
            return res.json({ data: cached.data });
        }
    }

    try {
        const langeekUrl = await findLangeekUrl(word);
        if (!langeekUrl) {
            return res.status(404).json({ error: 'Not found on LanGeek' });
        }

        const html = await fetchHtml(langeekUrl);
        const $ = cheerio.load(html);
        
        const phonetic = $('.pronunciation').first().text().trim() || '';
        const pos = $('.part-of-speech').first().text().trim() || '';
        const img = $('.word-picture img').attr('src') || $('meta[property="og:image"]').attr('content') || '';

        const result = { phonetic, pos, img, url: langeekUrl };
        
        cache.set(word, { time: Date.now(), data: result });
        res.json({ data: result });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/edge-tts', async (req, res) => {
    const { q, voice = 'en-US-JennyNeural' } = req.query;
    if (!q) return res.status(400).json({ error: 'Missing q parameter' });

    try {
        const tts = new MsEdgeTTS();
        await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
        
        const tempDir = os.tmpdir();
        
        // Thư viện sẽ trả về 1 object chứa đường dẫn file, ta hứng lấy nó
        const result = await tts.toFile(tempDir, q, { rate: '0%', pitch: '0Hz' });
        
        // Lấy đường dẫn file chính xác từ kết quả trả về
        const filePath = result.audioFilePath || result;

        if (!filePath || !fs.existsSync(filePath)) {
            throw new Error('Không tìm thấy file âm thanh vừa tạo');
        }
        
        // Gửi file về cho trình duyệt
        res.setHeader('Content-Type', 'audio/mpeg');
        res.sendFile(filePath, () => {
            // Xoá file sau khi gửi xong để không rác máy
            fs.unlink(filePath, () => {});
        });
    } catch (error) {
        console.error("Lỗi TTS:", error);
        res.status(500).json({ error: error.message });
    }
});

// 6. KHỞI CHẠY SERVER
app.listen(PORT, () => {
    console.log(`🚀 Proxy chạy tại: http://localhost:${PORT}`);
    console.log(`📌 Test LanGeek: http://localhost:${PORT}/langeek?q=apple`);
    console.log(`📌 Test Edge TTS: http://localhost:${PORT}/edge-tts?q=tiger`);
});