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
app.use(express.json());

// [SUPER BIG UPGRADE] VERCEL PATH FIX
const ROOT_DIR = process.cwd();
app.use('/public', express.static(path.join(ROOT_DIR, 'public')));

// Set EJS as view engine
app.set('views', path.join(ROOT_DIR, 'views'));
app.engine('html', require('ejs').renderFile);
app.set('view engine', 'html');

// ==========================================
// KONFIGURASI MULTER (STORAGE UPLOAD VIDEO & COVER ANTI-CRASH VERCEL)
// ==========================================
const isVercel = process.env.VERCEL || process.env.NODE_ENV === 'production';
const uploadDir = isVercel ? path.join(os.tmpdir(), 'axa_uploads') : path.join(ROOT_DIR, 'public', 'uploads');

if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

app.use('/public/uploads', express.static(uploadDir));

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const prefix = file.fieldname === 'coverFile' ? 'axa-cover-' : 'axa-video-';
        cb(null, prefix + uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 100 * 1024 * 1024 } 
});

// ==========================================
// [SUPER BIG UPGRADE] KONEKSI DATABASE UPSTASH REDIS REAL-TIME
// ==========================================
// Memasukkan variabel langsung sesuai ENV lo sebagai fallback jika .env gagal terload
const redis = new Redis({
  url: process.env.KV_REST_API_URL || 'https://ace-cod-172244.upstash.io',
  token: process.env.KV_REST_API_TOKEN || 'gQAAAAAAAqDUAAIgcDFhNDJjM2NmOTlkZTg0NDYyODE0MDkzZTQyN2I0OTAzOQ',
});

// Keys untuk Redis Hash Map
const REDIS_KEY_VIDEOS = 'axa:videos';
const REDIS_KEY_TOKENS = 'axa:tokens';

// ==========================================
// API ENDPOINTS (PUBLIC)
// ==========================================
app.get('/api/videos', async (req, res) => {
  try {
    // Tarik semua data video asli dari Redis
    const videos = await redis.hvals(REDIS_KEY_VIDEOS);
    res.json(videos || []); 
  } catch (error) {
    console.error("Redis Error Fetch Videos:", error);
    res.status(200).json([]); // Fallback array kosong kalau Redis timeout
  }
});

app.post('/api/verify-token', async (req, res) => {
  try {
    const { videoId, token } = req.body;
    if (!videoId || !token) return res.status(400).json({ valid: false, message: "Token required" });

    // Tarik spesifik token dari Redis
    const tokenData = await redis.hget(REDIS_KEY_TOKENS, token);

    if (tokenData && !tokenData.isUsed && (tokenData.videoId === videoId || tokenData.videoId === "ALL")) {
      // Jika token bukan Master Token (AXA2026), tandai sebagai terpakai
      if(token !== "AXA2026") {
          tokenData.isUsed = true;
          await redis.hset(REDIS_KEY_TOKENS, { [token]: tokenData });
      }
      return res.json({ valid: true, streamUrl: "https://sample-videos.com/video123.mp4" }); // URL stream di sini bisa lo ganti statis atau tarik dari database videonya
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

      res.json({ 
          totalVideos: videos.length, 
          totalTokens: tokens.length, 
          activeTokens, 
          totalViews 
      });
  } catch (error) {
      console.error("Redis Error Fetch Stats:", error);
      res.json({ totalVideos: 0, totalTokens: 0, activeTokens: 0, totalViews: 0 });
  }
});

const uploadFields = upload.fields([
    { name: 'videoFile', maxCount: 1 }, 
    { name: 'coverFile', maxCount: 1 }
]);

app.post('/api/admin/videos', uploadFields, async (req, res) => {
  try {
      const { title, genre, isPremium, videoUrl, coverUrl } = req.body;
      
      let finalVideoUrl = videoUrl;
      if (req.files && req.files['videoFile']) {
          finalVideoUrl = `/public/uploads/${req.files['videoFile'][0].filename}`;
      }

      let finalCoverUrl = coverUrl;
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
      
      // Simpan langsung ke Redis Hash
      await redis.hset(REDIS_KEY_VIDEOS, { [newVideo.id]: newVideo });

      res.json({ success: true, message: "Video berhasil di-upload ke Database!", video: newVideo });
  } catch (err) {
      console.error("Upload Error:", err);
      res.status(500).json({ success: false, message: "Gagal menyimpan data video." });
  }
});

app.post('/api/admin/tokens', async (req, res) => {
  try {
      const { videoId, prefix, count } = req.body;
      const generatedTokens = {};
      const responseTokens = [];

      for(let i=0; i<count; i++) {
        const tokenStr = `${prefix}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
        const newToken = { token: tokenStr, videoId, isUsed: false, createdAt: new Date().toISOString() };
        
        // Siapkan dalam object untuk di-push ke Redis Hash sekaligus
        generatedTokens[tokenStr] = newToken;
        responseTokens.push(newToken);
      }
      
      // Simpan semua token secara masal ke Redis
      await redis.hset(REDIS_KEY_TOKENS, generatedTokens);

      res.json({ success: true, message: `${count} Token berhasil dibuat!`, tokens: responseTokens });
  } catch (error) {
      console.error("Redis Error Generate Tokens:", error);
      res.status(500).json({ success: false, message: "Gagal mencetak token." });
  }
});

app.get('/api/admin/tokens', async (req, res) => {
    try {
        const tokens = await redis.hvals(REDIS_KEY_TOKENS);
        res.json(tokens || []);
    } catch (error) {
        res.status(200).json([]);
    }
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
        <p><strong>Peringatan Sistem:</strong> Internal Error.</p>
        <pre style="background:#111; padding:15px; border-left:4px solid #ff3366; overflow-x:auto;">${err.message}</pre>
        <pre style="color:#aaa; font-size:0.8rem; margin-top:20px;">CWD Dir: ${process.cwd()}</pre>
      </div>
    `);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 AXA SHORT+ running on port ${PORT}`));
