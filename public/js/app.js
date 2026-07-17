// FILE: public/js/app.js
// Vanilla JS Frontend Interactivity & SPA Logic

document.addEventListener('DOMContentLoaded', () => {
    console.log("AXA SHORT+ Frontend Initialized. Gasss!");
    
    // --- Page Transitions (SPA Feel without reload if possible, though routes exist) ---
    document.body.classList.add('page-transition');

    // --- Load Videos on Home ---
    const videoGrid = document.getElementById('home-video-grid');
    if(videoGrid) {
        fetchVideos();
    }

    // --- Modal Logic for Player ---
    const tokenModal = document.getElementById('tokenModal');
    const closeBtn = document.getElementById('closeModal');
    const verifyBtn = document.getElementById('verifyTokenBtn');
    
    if(closeBtn) closeBtn.addEventListener('click', () => tokenModal.classList.remove('active'));

    if(verifyBtn) {
        verifyBtn.addEventListener('click', async () => {
            const token = document.getElementById('tokenInput').value;
            const videoId = document.getElementById('videoIdHolder').value;
            
            try {
                const res = await fetch('/api/verify-token', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ videoId, token })
                });
                const data = await res.json();
                
                if(data.valid) {
                    alert("Akses Dibuka! Memuat video...");
                    tokenModal.classList.remove('active');
                    // Inject video player logic here (Mocked)
                    document.getElementById('player-container').innerHTML = `
                        <video width="100%" controls autoplay style="border-radius:16px;">
                            <source src="${data.streamUrl}" type="video/mp4">
                        </video>
                    `;
                } else {
                    alert(data.message || "Token Salah!");
                }
            } catch (err) {
                console.error(err);
                alert("Terjadi kesalahan server.");
            }
        });
    }
});

async function fetchVideos() {
    const grid = document.getElementById('home-video-grid');
    try {
        const res = await fetch('/api/videos');
        const videos = await res.json();
        
        grid.innerHTML = videos.map(vid => `
            <a href="/play/${vid.id}" style="text-decoration:none; color:inherit;">
                <div class="${vid.isPremium ? 'holo-card' : 'glass-panel'}">
                    <img src="${vid.coverUrl}" class="video-card-img" alt="${vid.title}" loading="lazy">
                    <div class="video-info">
                        <h3 class="video-title">${vid.title}</h3>
                        <span class="clay-badge">${vid.genre}</span>
                        ${vid.isPremium ? '<span style="color:var(--accent-neon); font-size:0.8rem; float:right;">Premium</span>' : ''}
                    </div>
                </div>
            </a>
        `).join('');
    } catch (e) {
        console.error("Failed to load videos", e);
        grid.innerHTML = '<p style="text-align:center; width:100%;">Gagal memuat data.</p>';
    }
}

// Trigger Modal helper function
window.triggerPremiumUnlock = function(vidId) {
    document.getElementById('videoIdHolder').value = vidId;
    document.getElementById('tokenModal').classList.add('active');
}