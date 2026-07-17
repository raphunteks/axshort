// FILE: public/js/app.js
// VANILLA JS ENGINE: Mengambil data dari Backend Redis & Mengatur Interaksi (100% Synchronized)

document.addEventListener('DOMContentLoaded', () => {
    console.log("🔥 AXA SHORT+ Frontend Engine Initialized. Gasss!");
    
    const homeGrid = document.getElementById('home-video-grid');
    const exploreGrid = document.getElementById('explore-video-grid');
    const searchInput = document.getElementById('searchInput');
    const searchGrid = document.getElementById('search-video-grid');
    const playContainer = document.getElementById('play-video-details'); 

    let allVideos = [];

    // ==========================================
    // 1. ENGINE UTAMA: FETCH DATA DARI API
    // ==========================================
    async function fetchVideosData() {
        try {
            const res = await fetch('/api/videos');
            const videos = await res.json();
            allVideos = videos;
            return videos;
        } catch (error) { 
            console.error("Gagal load data dari backend:", error);
            return []; 
        }
    }

    // ==========================================
    // 2. TEMPLATE RENDER: CARD VIDEO (Glassmorphism & Neon)
    // ==========================================
    function generateVideoCard(vid) {
        return `
            <a href="/play/${vid.id}" style="text-decoration:none; color:inherit; display: block; height: 100%;">
                <div class="${vid.isPremium ? 'holo-card' : 'glass-panel'}" style="height: 100%; display: flex; flex-direction: column;">
                    <img src="${vid.coverUrl}" class="video-card-img" alt="${vid.title}" loading="lazy" onerror="this.src='/public/img/axalogo.png'" style="object-fit: cover; height: 200px; width: 100%;">
                    <div class="video-info" style="flex: 1; display: flex; flex-direction: column; justify-content: space-between;">
                        <h3 class="video-title" style="margin-bottom: 10px; font-size: 1rem;">${vid.title}</h3>
                        <div>
                            <span class="clay-badge">${vid.genre}</span>
                            ${vid.isPremium 
                                ? '<span style="color:var(--accent-neon); font-size:0.8rem; float:right; font-weight:bold; margin-top:5px;">PREMIUM</span>' 
                                : '<span style="color:#aaa; font-size:0.8rem; float:right; margin-top:5px;">FREE</span>'}
                        </div>
                    </div>
                </div>
            </a>
        `;
    }

    // ==========================================
    // 3. LOGIKA HALAMAN INDEX (BERANDA)
    // ==========================================
    if (homeGrid) {
        fetchVideosData().then(videos => {
            if (videos.length === 0) { 
                homeGrid.innerHTML = '<p style="color:#888; text-align:center; width:100%;">Belum ada film bosku. Upload dari Admin Dashboard dulu!</p>'; 
                return; 
            }
            homeGrid.innerHTML = videos.reverse().map(vid => generateVideoCard(vid)).join('');
        });
    }

    // ==========================================
    // 4. LOGIKA HALAMAN EXPLORE (KATALOG & FILTER)
    // ==========================================
    if (exploreGrid) {
        fetchVideosData().then(videos => {
            if (videos.length === 0) { 
                exploreGrid.innerHTML = '<p style="color:#888; text-align:center; width:100%;">Belum ada konten di katalog.</p>'; 
                return; 
            }
            exploreGrid.innerHTML = videos.reverse().map(vid => generateVideoCard(vid)).join('');
            
            const genreBadges = document.querySelectorAll('.genre-filter');
            genreBadges.forEach(badge => {
                badge.style.cursor = "pointer";
                badge.addEventListener('click', (e) => {
                    const selectedGenre = e.target.innerText;
                    const filtered = videos.filter(v => v.genre === selectedGenre);
                    exploreGrid.innerHTML = filtered.length > 0 
                        ? filtered.map(vid => generateVideoCard(vid)).join('') 
                        : `<p style="color:#ff3366; text-align:center; width:100%;">Belum ada video untuk genre ${selectedGenre}.</p>`;
                });
            });
        });
    }

    // ==========================================
    // 5. LOGIKA HALAMAN SEARCH (LIVE SEARCH)
    // ==========================================
    if (searchInput && searchGrid) {
        fetchVideosData(); 
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase();
            if(query.trim() === '') { 
                searchGrid.innerHTML = ''; 
                return; 
            }
            const filtered = allVideos.filter(v => v.title.toLowerCase().includes(query) || v.genre.toLowerCase().includes(query));
            searchGrid.innerHTML = filtered.length > 0 
                ? filtered.map(vid => generateVideoCard(vid)).join('') 
                : '<p style="color:#aaa; text-align:center; width:100%;">Video nggak ketemu bosku.</p>';
        });
    }

    // ==========================================
    // 6. LOGIKA HALAMAN PLAY (DETAIL & MODAL TOKEN)
    // ==========================================
    if (playContainer) {
        const videoId = document.getElementById('videoIdHolder').value;
        const playerBox = document.getElementById('player-container');
        
        fetchVideosData().then(videos => {
            const vid = videos.find(v => v.id === videoId);
            if (vid) {
                document.getElementById('play-title').innerText = vid.title;
                document.getElementById('play-desc').innerText = `Genre: ${vid.genre}. Film eksklusif AXA SHORT+ yang penuh kejutan!`;
                
                playerBox.style.backgroundImage = `linear-gradient(rgba(5, 5, 16, 0.8), rgba(5, 5, 16, 0.95)), url('${vid.coverUrl}')`;
                playerBox.style.backgroundSize = 'cover';
                playerBox.style.backgroundPosition = 'center';
            }
        });
    }

    // ==========================================
    // 7. SISTEM VALIDASI LISENSI
    // ==========================================
    const tokenModal = document.getElementById('tokenModal');
    const closeBtn = document.getElementById('closeModal');
    const verifyBtn = document.getElementById('verifyTokenBtn');
    
    if (closeBtn) closeBtn.addEventListener('click', () => tokenModal.classList.remove('active'));

    if (verifyBtn) {
        verifyBtn.addEventListener('click', async () => {
            const tokenInput = document.getElementById('tokenInput');
            const token = tokenInput.value.trim().toUpperCase();
            const videoId = document.getElementById('videoIdHolder').value;
            
            if(!token) { 
                alert("Token nggak boleh kosong bosku!"); 
                tokenInput.focus();
                return; 
            }

            const btnText = verifyBtn.innerText;
            verifyBtn.innerText = "⏳ Mengecek License...";
            verifyBtn.disabled = true;

            try {
                const res = await fetch('/api/verify-token', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ videoId, token })
                });
                const data = await res.json();
                
                if(data.valid) {
                    alert("🔥 AKSES VIP DIBUKA! Selamat menonton bosku.");
                    tokenModal.classList.remove('active');
                    
                    const playerBox = document.getElementById('player-container');
                    playerBox.style.background = "#000"; 
                    playerBox.style.padding = "0";
                    
                    // [SUPER BIG UPGRADE] Auto-Convert Legacy GDrive Links di Frontend
                    // Berjaga-jaga jika database masih nyimpen link lama (/view) yang di-block oleh Google CORS
                    let finalStream = data.streamUrl;
                    if (finalStream.includes('drive.google.com') && !finalStream.includes('/preview')) {
                        const match = finalStream.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
                        if (match && match[1]) {
                            finalStream = `https://drive.google.com/file/d/${match[1]}/preview`;
                        }
                    }
                    
                    // [SUPER BIG UPGRADE] Render Engine Mutlak
                    if (finalStream.includes('drive.google.com')) {
                        // Merender iFrame dengan parameter keamanan Anti-Block Google
                        playerBox.innerHTML = `
                            <iframe 
                                src="${finalStream}" 
                                width="100%" 
                                height="100%" 
                                allow="autoplay; fullscreen; encrypted-media; picture-in-picture" 
                                allowfullscreen 
                                frameborder="0" 
                                scrolling="no" 
                                referrerpolicy="no-referrer"
                                style="border:none; border-radius:16px; min-height: 250px; background: #000;">
                            </iframe>
                        `;
                    } else {
                        // Merender native HTML5 Player (Untuk file MP4, dll)
                        playerBox.innerHTML = `
                            <video id="axa-native-player" width="100%" height="100%" controls autoplay controlsList="nodownload" style="border-radius:16px; outline: none; background: #000;">
                                <source src="${finalStream}" type="video/mp4">
                                <source src="${finalStream}" type="video/quicktime">
                                Browser lo nggak support HTML5 video bosku.
                            </video>
                        `;
                        
                        // [SUPER UPGRADE] Error Trapping: Deteksi jika file Vercel /tmp hilang (404)
                        setTimeout(() => {
                            const vidPlayer = document.getElementById('axa-native-player');
                            if(vidPlayer) {
                                vidPlayer.addEventListener('error', () => {
                                    alert("⚠️ VIDEO BLANK / GAGAL DIMUAT! Jika lo pakai Opsi 1 (Upload File) di Vercel, file lo udah dihapus otomatis oleh Vercel. WAJIB pakai Opsi 2 (Link Google Drive) bosku!");
                                });
                            }
                        }, 500);
                    }
                } else {
                    alert("❌ " + (data.message || "Token Salah atau Sudah Dipakai!"));
                    tokenInput.value = '';
                    tokenInput.focus();
                }
            } catch (err) {
                console.error("Fetch Error:", err);
                alert("Terjadi kesalahan server, coba lagi.");
            } finally {
                verifyBtn.innerText = btnText;
                verifyBtn.disabled = false;
            }
        });
    }
});

// Trigger Modal helper function
window.triggerPremiumUnlock = function(vidId) {
    const modal = document.getElementById('tokenModal');
    modal.classList.add('active'); 
    
    setTimeout(() => {
        const tokenInput = document.getElementById('tokenInput');
        if (tokenInput) tokenInput.focus();
    }, 300);
}
