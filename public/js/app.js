// FILE: public/js/app.js
// VANILLA JS ENGINE: Mengambil data dari Backend Redis & Mengatur Interaksi

document.addEventListener('DOMContentLoaded', () => {
    console.log("🔥 AXA SHORT+ Frontend Engine Initialized. Gasss!");
    
    // Identifikasi Elemen DOM di tiap halaman
    const homeGrid = document.getElementById('home-video-grid');
    const exploreGrid = document.getElementById('explore-video-grid');
    const searchInput = document.getElementById('searchInput');
    const searchGrid = document.getElementById('search-video-grid');
    const playContainer = document.getElementById('play-video-details'); // Khusus play.html

    // State penyimpan memori sementara agar web cepat (SPA feel)
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
                homeGrid.innerHTML = '<p style="text-align:center; width:100%; color:#888;">Belum ada film bosku. Upload dari Admin Dashboard dulu!</p>';
                return;
            }
            // Tampilkan video terbaru di atas (reverse)
            homeGrid.innerHTML = videos.reverse().map(vid => generateVideoCard(vid)).join('');
        });
    }

    // ==========================================
    // 4. LOGIKA HALAMAN EXPLORE (KATALOG & FILTER)
    // ==========================================
    if (exploreGrid) {
        fetchVideosData().then(videos => {
            if (videos.length === 0) {
                exploreGrid.innerHTML = '<p style="text-align:center; width:100%; color:#888;">Belum ada konten di katalog.</p>';
                return;
            }
            // Tampilkan semua secara default
            exploreGrid.innerHTML = videos.reverse().map(vid => generateVideoCard(vid)).join('');
            
            // Logika Filter by Genre
            const genreBadges = document.querySelectorAll('.genre-filter');
            genreBadges.forEach(badge => {
                badge.style.cursor = "pointer";
                badge.addEventListener('click', (e) => {
                    const selectedGenre = e.target.innerText;
                    const filtered = videos.filter(v => v.genre === selectedGenre);
                    exploreGrid.innerHTML = filtered.length > 0 
                        ? filtered.map(vid => generateVideoCard(vid)).join('')
                        : `<p style="text-align:center; width:100%; color:#ff3366;">Belum ada video untuk genre ${selectedGenre}.</p>`;
                });
            });
        });
    }

    // ==========================================
    // 5. LOGIKA HALAMAN SEARCH (LIVE SEARCH)
    // ==========================================
    if (searchInput && searchGrid) {
        fetchVideosData(); // Load ke background memory dulu biar instan

        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase();
            if(query.trim() === '') {
                searchGrid.innerHTML = '';
                return;
            }
            // Filter berdasarkan judul ATAU genre
            const filtered = allVideos.filter(v => 
                v.title.toLowerCase().includes(query) || 
                v.genre.toLowerCase().includes(query)
            );
            
            searchGrid.innerHTML = filtered.length > 0 
                ? filtered.map(vid => generateVideoCard(vid)).join('')
                : '<p style="text-align:center; width:100%; color:#aaa;">Video nggak ketemu bosku.</p>';
        });
    }

    // ==========================================
    // 6. LOGIKA HALAMAN PLAY (DETAIL & MODAL TOKEN)
    // ==========================================
    if (playContainer) {
        const videoId = document.getElementById('videoIdHolder').value;
        const playerBox = document.getElementById('player-container');
        
        // Tarik data detail video untuk dipasang di HTML (Title & Cover otomatis)
        fetchVideosData().then(videos => {
            const vid = videos.find(v => v.id === videoId);
            if (vid) {
                document.getElementById('play-title').innerText = vid.title;
                document.getElementById('play-desc').innerText = `Genre: ${vid.genre}. Film eksklusif AXA SHORT+ yang penuh kejutan!`;
                
                // Jadikan cover gambar sebagai background player yang terkunci
                playerBox.style.backgroundImage = `linear-gradient(rgba(5, 5, 16, 0.8), rgba(5, 5, 16, 0.9)), url('${vid.coverUrl}')`;
                playerBox.style.backgroundSize = 'cover';
                playerBox.style.backgroundPosition = 'center';
            }
        });
    }

    // Logika Verifikasi Token (Skeuomorphic Button Interaction)
    const tokenModal = document.getElementById('tokenModal');
    const closeBtn = document.getElementById('closeModal');
    const verifyBtn = document.getElementById('verifyTokenBtn');
    
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            tokenModal.classList.remove('active');
        });
    }

    if (verifyBtn) {
        verifyBtn.addEventListener('click', async () => {
            const token = document.getElementById('tokenInput').value;
            const videoId = document.getElementById('videoIdHolder').value;
            
            const btnText = verifyBtn.innerText;
            verifyBtn.innerText = "⏳ Mengecek...";
            verifyBtn.disabled = true;

            try {
                const res = await fetch('/api/verify-token', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ videoId, token })
                });
                const data = await res.json();
                
                if(data.valid) {
                    alert("🔥 AKSES DIBUKA! Selamat menonton bosku.");
                    tokenModal.classList.remove('active');
                    
                    // Render HTML5 Video Player untuk memutar GDrive/MP4 langsung
                    const playerBox = document.getElementById('player-container');
                    playerBox.style.background = "#000"; // Hapus cover, ganti hitam pekat
                    playerBox.style.padding = "0";
                    playerBox.innerHTML = `
                        <video width="100%" height="100%" controls autoplay controlsList="nodownload" style="border-radius:16px; outline: none;">
                            <source src="${data.streamUrl}" type="video/mp4">
                            Browser lo nggak support HTML5 video bosku.
                        </video>
                    `;
                } else {
                    alert("❌ " + (data.message || "Token Salah atau Sudah Dipakai!"));
                }
            } catch (err) {
                console.error(err);
                alert("Terjadi kesalahan server, coba lagi.");
            } finally {
                verifyBtn.innerText = btnText;
                verifyBtn.disabled = false;
            }
        });
    }
});

// Trigger Modal helper function (Dipanggil dari tombol di HTML play.html)
window.triggerPremiumUnlock = function(vidId) {
    const modal = document.getElementById('tokenModal');
    modal.classList.add('active'); // CSS opacity akan otomatis menganimasi masuk
}
