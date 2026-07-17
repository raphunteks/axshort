// FILE: server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const os = require('os');
const multer = require('multer');
const { Redis } = require('@upstash/redis');

const app = express();
app.use(cors());

// [SUPER UPGRADE] Perbesar limit body parser
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

// VERCEL PATH FIX
const ROOT_DIR = process.cwd();
app.use('/public', express.static(path.join(ROOT_DIR, 'public')));

// Set EJS as view engine
app.set('views', path.join(ROOT_DIR, 'views'));
app.engine('html', require('ejs').renderFile);
app.set('view engine', 'html');

// ==========================================
// KONFIGURASI MULTER
// ==========================================
const isVercel = process.env.VERCEL || process.env.NODE_ENV === 'production';
const uploadDir = isVercel ? path.join(os.tmpdir(), 'axa_uploads') : path.join(ROOT_DIR, 'public', 'uploads');

if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}
app.use('/public/uploads', express.static(uploadDir));

const storage = multer.diskStorage({
    destination: function (req, file, cb) { cb(null, uploadDir); },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const prefix = file.fieldname === 'coverFile' ? 'axa-cover-' : 'axa-video-';
        cb(null, prefix + uniqueSuffix + path.extname(file.originalname));
    }
});

const MAX_UPLOAD_SIZE = isVercel ? 4.5 * 1024 * 1024 : 100 * 1024 * 1024;
const upload = multer({ storage: storage, limits: { fileSize: MAX_UPLOAD_SIZE } });

// ==========================================
// KONEKSI DATABASE UPSTASH REDIS REAL-TIME
// ==========================================
const redis = new Redis({
  url: process.env.KV_REST_API_URL || 'https://ace-cod-172244.upstash.io',
  token: process.env.KV_REST_API_TOKEN || 'gQAAAAAAAqDUAAIgcDFhNDJjM2NmOTlkZTg0NDYyODE0MDkzZTQyN2I0OTAzOQ',
});

const REDIS_KEY_VIDEOS = 'axa:videos';
const REDIS_KEY_TOKENS = 'axa:tokens';

// ==========================================
// HELPER: GOOGLE DRIVE LINK CONVERTER
// ==========================================
// [SUPER BIG UPGRADE] Mengubah link sharing biasa menjadi Direct Stream Link
function convertGDriveLink(url) {
    if (!url || !url.includes('drive.google.com')) return url;
    
    let fileId = null;
    // Cari pola URL: /file/d/FILE_ID/view
    const match = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (match && match[1]) {
        fileId = match[1];
    } else {
        // Cari pola URL: ?id=FILE_ID
        const matchId = url.match(/id=([a-zA-Z0-9_-]+)/);
        if (matchId && matchId[1]) {
            fileId = matchId[1];
        }
    }
    
    if (fileId) {
        // Return format streamable direct link
        return `https://drive.google.com/uc?export=download&id=${fileId}`;
    }
    return url;
}

// ==========================================
// API ENDPOINTS (PUBLIC)
// ==========================================
app.get('/api/videos', async (req, res) => {
  try {
    const videos = await redis.hvals(REDIS_KEY_VIDEOS);
    res.json(videos || []); 
  } catch (error) {
    console.error("Redis Error Fetch Videos:", error);
    res.status(200).json([]); 
  }
});

app.post('/api/verify-token', async (req, res) => {
  try {
    const { videoId, token } = req.body;
    if (!videoId || !token) return res.status(400).json({ valid: false, message: "Token required" });

    const tokenData = await redis.hget(REDIS_KEY_TOKENS, token);

    if (tokenData && !tokenData.isUsed && (tokenData.videoId === videoId || tokenData.videoId === "ALL")) {
      if(token !== "AXA2026") {
          tokenData.isUsed = true;
          await redis.hset(REDIS_KEY_TOKENS, { [token]: tokenData });
      }
      
      // Ambil stream URL langsung dari database video berdasarkan videoId
      const videoData = await redis.hget(REDIS_KEY_VIDEOS, videoId);
      const finalStreamUrl = videoData ? videoData.videoUrl : "https://sample-videos.com/video123.mp4";
      
      return res.json({ valid: true, streamUrl: finalStreamUrl }); 
    }
    
    res.status(403).json({ valid: false, message: "Token Invalid atau Sudah Terpakai" });
  } catch (error) {
    console.error("Token Verification Error:", error);
    res.status(500).json({ valid: false, message: "Internal Server Error" });
  }
});

// ==========================================
// API ENDPOINTS (ADMIN / CREATOR)
// ==========================================
app.get('/api/admin/stats', async (req, res) => {
  try {
      const videos = (await redis.hvals(REDIS_KEY_VIDEOS)) || [];
      const tokens = (await redis.hvals(REDIS_KEY_TOKENS)) || [];
      const totalViews = videos.reduce((sum, v) => sum + (v.views || 0), 0);
      const activeTokens = tokens.filter(t => !t.isUsed).length;
      res.json({ totalVideos: videos.length, totalTokens: tokens.length, activeTokens, totalViews });
  } catch (error) {
      res.json({ totalVideos: 0, totalTokens: 0, activeTokens: 0, totalViews: 0 });
  }
});

const uploadFields = upload.fields([{ name: 'videoFile', maxCount: 1 }, { name: 'coverFile', maxCount: 1 }]);

app.post('/api/admin/videos', (req, res) => {
    uploadFields(req, res, async function (err) {
        if (err instanceof multer.MulterError) {
            if (err.code === 'LIMIT_FILE_SIZE') {
                const limitText = isVercel ? '4.5MB (Limit Vercel Serverless)' : '100MB';
                return res.status(400).json({ success: false, message: `GAGAL: File terlalu besar! Batas maksimal ${limitText}. Gunakan Opsi 2 (Paste URL Google Drive) untuk film panjang.` });
            }
            return res.status(400).json({ success: false, message: `Upload error: ${err.message}` });
        } else if (err) {
            return res.status(500).json({ success: false, message: `Server error saat upload file: ${err.message}` });
        }

        try {
            const { title, genre, isPremium, videoUrl, coverUrl } = req.body;
            
            // [SUPER BIG UPGRADE] Eksekusi Konversi Link GDrive untuk Video dan Cover
            let finalVideoUrl = convertGDriveLink(videoUrl);
            if (req.files && req.files['videoFile']) {
                finalVideoUrl = `/public/uploads/${req.files['videoFile'][0].filename}`;
            }

            let finalCoverUrl = convertGDriveLink(coverUrl);
            if (req.files && req.files['coverFile']) {
                finalCoverUrl = `/public/uploads/${req.files['coverFile'][0].filename}`;
            }

            const newVideo = { 
                id: `v${Date.now()}`, 
                title, 
                genre, 
                coverUrl: finalCoverUrl, 
                videoUrl: finalVideoUrl, 
                isPremium: isPremium === 'true' || isPremium === true, 
                views: 0 
            };
            
            await redis.hset(REDIS_KEY_VIDEOS, { [newVideo.id]: newVideo });
            res.json({ success: true, message: "Video berhasil di-upload ke Database!", video: newVideo });
        } catch (dbErr) {
            res.status(500).json({ success: false, message: "Gagal menyimpan data ke Redis." });
        }
    });
});

app.post('/api/admin/tokens', async (req, res) => {
  try {
      const { videoId, prefix, count } = req.body;
      const generatedTokens = {};
      const responseTokens = [];
      for(let i=0; i<count; i++) {
        const tokenStr = `${prefix}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
        const newToken = { token: tokenStr, videoId, isUsed: false, createdAt: new Date().toISOString() };
        generatedTokens[tokenStr] = newToken;
        responseTokens.push(newToken);
      }
      await redis.hset(REDIS_KEY_TOKENS, generatedTokens);
      res.json({ success: true, message: `${count} Token berhasil dibuat!`, tokens: responseTokens });
  } catch (error) {
      res.status(500).json({ success: false, message: "Gagal mencetak token." });
  }
});

app.get('/api/admin/tokens', async (req, res) => {
    try {
        const tokens = await redis.hvals(REDIS_KEY_TOKENS);
        res.json(tokens || []);
    } catch (error) { res.status(200).json([]); }
});

// ==========================================
// VIEW ROUTES
// ==========================================
app.get('/', (req, res) => res.render('index'));
app.get('/explore', (req, res) => res.render('explore'));
app.get('/search', (req, res) => res.render('search'));
app.get('/play/:id', (req, res) => res.render('play', { videoId: req.params.id }));
app.get('/admin-dashboard', (req, res) => res.render('admin-dashboard'));

// Global Error Handler
app.use((err, req, res, next) => {
    console.error("🔥 AXA SERVER CRASH:", err.stack);
    res.status(500).send(`
      <div style="background:#050510; color:#00FF80; font-family:monospace; padding:40px; height:100vh;">
        <h2>🔥 500 - SYSTEM CRASH</h2>
        <pre style="background:#111; padding:15px; border-left:4px solid #ff3366; overflow-x:auto;">${err.message}</pre>
      </div>
    `);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 AXA SHORT+ running on port ${PORT}`));
