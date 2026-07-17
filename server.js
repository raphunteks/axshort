// FILE: server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { Redis } = require('@upstash/redis');

const app = express();
app.use(cors());
app.use(express.json());
app.use('/public', express.static(path.join(__dirname, 'public')));

// Set EJS as view engine for HTML rendering
app.engine('html', require('ejs').renderFile);
app.set('view engine', 'html');
app.set('views', path.join(__dirname, 'views'));

// Initialize Upstash Redis (Safe Initialization)
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
// MOCK DATA (GRACEFUL DEGRADATION FALLBACK)
// ==========================================
let mockVideos = [
  { id: "v1", title: "Neon Horizon", genre: "Fiksi Ilmiah", coverUrl: "https://images.unsplash.com/photo-1533972751724-d13706b6fc69?auto=format&fit=crop&w=500&q=80", videoUrl: "#", isPremium: true, views: 1250 },
  { id: "v2", title: "Midnight Romance", genre: "Romantis", coverUrl: "https://images.unsplash.com/photo-1514316454349-750a7fd3da3a?auto=format&fit=crop&w=500&q=80", videoUrl: "#", isPremium: false, views: 840 },
  { id: "v3", title: "Cyber Chase", genre: "Aksi", coverUrl: "https://images.unsplash.com/photo-1605806616949-1e87b487cb2a?auto=format&fit=crop&w=500&q=80", videoUrl: "#", isPremium: true, views: 3200 }
];

let mockTokens = [
  { token: "AXA-BETA-001", videoId: "v1", isUsed: false, createdAt: new Date().toISOString() },
  { token: "AXA2026", videoId: "ALL", isUsed: true, createdAt: new Date().toISOString() }
];

// ==========================================
// API ENDPOINTS (PUBLIC)
// ==========================================
app.get('/api/videos', async (req, res) => {
  try {
    res.json(mockVideos); 
  } catch (error) {
    res.status(200).json(mockVideos); 
  }
});

app.post('/api/verify-token', async (req, res) => {
  try {
    const { videoId, token } = req.body;
    if (!videoId || !token) return res.status(400).json({ valid: false, message: "Token required" });

    // Cek Token di Mock Database
    const tokenExists = mockTokens.find(t => t.token === token && (t.videoId === videoId || t.videoId === "ALL"));
    
    if (tokenExists && !tokenExists.isUsed) {
      // Tandai token terpakai jika bukan master token
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
  res.json({ 
    totalVideos: mockVideos.length, 
    totalTokens: mockTokens.length,
    activeTokens: mockTokens.filter(t => !t.isUsed).length,
    totalViews
  });
});

app.post('/api/admin/videos', (req, res) => {
  const { title, genre, coverUrl, videoUrl, isPremium } = req.body;
  const newVideo = {
    id: `v${Date.now()}`,
    title, genre, coverUrl, videoUrl, isPremium, views: 0
  };
  mockVideos.push(newVideo);
  res.json({ success: true, message: "Video berhasil di-upload!", video: newVideo });
});

app.post('/api/admin/tokens', (req, res) => {
  const { videoId, prefix, count } = req.body;
  const generatedTokens = [];
  
  for(let i=0; i<count; i++) {
    const randomStr = Math.random().toString(36).substring(2, 8).toUpperCase();
    const tokenStr = `${prefix}-${randomStr}`;
    const newToken = { token: tokenStr, videoId, isUsed: false, createdAt: new Date().toISOString() };
    mockTokens.push(newToken);
    generatedTokens.push(newToken);
  }
  
  res.json({ success: true, message: `${count} Token berhasil dibuat!`, tokens: generatedTokens });
});

app.get('/api/admin/tokens', (req, res) => {
  res.json(mockTokens);
});

// ==========================================
// VIEW ROUTES
// ==========================================
app.get('/', (req, res) => res.render('index'));
app.get('/explore', (req, res) => res.render('explore'));
app.get('/search', (req, res) => res.render('search'));
app.get('/play/:id', (req, res) => res.render('play', { videoId: req.params.id }));
// NEW ADMIN ROUTE
app.get('/admin-dashboard', (req, res) => res.render('admin-dashboard'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 AXA SHORT+ running on port ${PORT}`));