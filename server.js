// FILE: server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const os = require('os'); // [SUPER UPGRADE] OS module untuk mendeteksi Temp Dir Vercel
const multer = require('multer'); // [SUPER UPGRADE] Library untuk handle upload file
const { Redis } = require('@upstash/redis');

const app = express();
app.use(cors());
app.use(express.json());

// [SUPER BIG UPGRADE] VERCEL PATH FIX - process.cwd() adalah kunci mutlak.
const ROOT_DIR = process.cwd();
app.use('/public', express.static(path.join(ROOT_DIR, 'public')));

// Set EJS as view engine
app.set('views', path.join(ROOT_DIR, 'views'));
app.engine('html', require('ejs').renderFile);
app.set('view engine', 'html');

// ==========================================
// KONFIGURASI MULTER (STORAGE UPLOAD VIDEO & COVER ANTI-CRASH VERCEL)
// ==========================================
// [SUPER BIG UPGRADE] Serverless Vercel itu Read-Only (EROFS). Kita HANYA boleh nulis di folder OS Temp (/tmp).
const isVercel = process.env.VERCEL || process.env.NODE_ENV === 'production';
const uploadDir = isVercel ? path.join(os.tmpdir(), 'axa_uploads') : path.join(ROOT_DIR, 'public', 'uploads');

// Buat folder otomatis jika belum ada (Sekarang aman dari blokir Vercel)
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// WAJIB: Daftarkan folder dinamis ini ke express.static agar file upload di /tmp tetap bisa diakses browser
app.use('/public/uploads', express.static(uploadDir));

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        // [SUPER UPGRADE] Pisahkan penamaan untuk cover dan video agar rapi
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const prefix = file.fieldname === 'coverFile' ? 'axa-cover-' : 'axa-video-';
        cb(null, prefix + uniqueSuffix + path.extname(file.originalname));
    }
});
// Limit upload 100MB (Bisa disesuaikan)
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 100 * 1024 * 1024 } 
});

// Initialize Upstash Redis
let redis;
try {
  redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL || 'http://localhost',
    token: process.env.UPSTASH_REDIS_REST_TOKEN || 'mock',
  });
} catch (error) {
  console.warn("Redis init failed, falling back to mock mode.");
}

// ==========================================
// MOCK DATA
// ==========================================
let mockVideos = [
  { id: "v1", title: "Neon Horizon", genre: "Fiksi Ilmiah", coverUrl: "https://images.unsplash.com/photo-1533972751724-d13706b6fc69?auto=format&fit=crop&w=500&q=80", videoUrl: "#", isPremium: true, views: 1250 },
  { id: "v2", title: "Midnight Romance", genre: "Romantis", coverUrl: "https://images.unsplash.com/photo-1514316454349-750a7fd3da3a?auto=format&fit=crop&w=500&q=80", videoUrl: "#", isPremium: false, views: 840 }
];

let mockTokens = [
  { token: "AXA2026", videoId: "ALL", isUsed: true, createdAt: new Date().toISOString() }
];

// ==========================================
// API ENDPOINTS (PUBLIC)
// ==========================================
app.get('/api/videos', async (req, res) => {
  try { res.json(mockVideos); } 
  catch (error) { res.status(200).json(mockVideos); }
});

app.post('/api/verify-token', async (req, res) => {
  try {
    const { videoId, token } = req.body;
    if (!videoId || !token) return res.status(400).json({ valid: false, message: "Token required" });

    const tokenExists = mockTokens.find(t => t.token === token && (t.videoId === videoId || t.videoId === "ALL"));
    if (tokenExists && !tokenExists.isUsed) {
      if(token !== "AXA2026") tokenExists.isUsed = true;
      return res.json({ valid: true, streamUrl: "https://sample-videos.com/video123.mp4" });
    }
    res.status(403).json({ valid: false, message: "Token Invalid atau Sudah Terpakai" });
  } catch (error) {
    res.status(500).json({ valid: false, message: "Internal Server Error" });
  }
});

// ==========================================
// API ENDPOINTS (ADMIN / CREATOR)
// ==========================================
app.get('/api/admin/stats', (req, res) => {
  const totalViews = mockVideos.reduce((sum, v) => sum + (v.views || 0), 0);
  res.json({ totalViews: mockVideos.length, totalTokens: mockTokens.length, activeTokens: mockTokens.filter(t => !t.isUsed).length, totalViews });
});

// [SUPER UPGRADE] API Upload Handle Multiple Files (Video & Cover Image)
const uploadFields = upload.fields([
    { name: 'videoFile', maxCount: 1 }, 
    { name: 'coverFile', maxCount: 1 }
]);

app.post('/api/admin/videos', uploadFields, (req, res) => {
  try {
      const { title, genre, isPremium, videoUrl, coverUrl } = req.body;
      
      // Handle Video URL / File
      let finalVideoUrl = videoUrl;
      if (req.files && req.files['videoFile']) {
          finalVideoUrl = `/public/uploads/${req.files['videoFile'][0].filename}`;
      }

      // Handle Cover URL / File
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
      
      mockVideos.push(newVideo);
      res.json({ success: true, message: "Video berhasil di-upload!", video: newVideo });
  } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: "Gagal menyimpan data video." });
  }
});

app.post('/api/admin/tokens', (req, res) => {
  const { videoId, prefix, count } = req.body;
  const generatedTokens = [];
  for(let i=0; i<count; i++) {
    const tokenStr = `${prefix}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    const newToken = { token: tokenStr, videoId, isUsed: false, createdAt: new Date().toISOString() };
    mockTokens.push(newToken);
    generatedTokens.push(newToken);
  }
  res.json({ success: true, message: `${count} Token berhasil dibuat!`, tokens: generatedTokens });
});
app.get('/api/admin/tokens', (req, res) => { res.json(mockTokens); });

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
