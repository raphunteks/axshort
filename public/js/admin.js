// FILE: public/js/admin.js
// Logika Vanilla JS Halaman Admin & Sistem Login Gate (Anti Bypass)

document.addEventListener('DOMContentLoaded', () => {
    console.log("AXA Admin System Loaded.");
    
    const loginForm = document.getElementById('adminLoginForm');
    const loginOverlay = document.getElementById('loginOverlay');
    const dashboardWrapper = document.getElementById('dashboardWrapper');

    // ==========================================
    // 1. SISTEM LOGIN GATE KREDENSIAL
    // ==========================================
    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const user = document.getElementById('adminUser').value;
            const pass = document.getElementById('adminPass').value;

            // Validasi Kredensial (Sesuai Environment Variables)
            if (user === 'axaaxyz_01' && pass === 'axaxyz999') {
                // Login Berhasil
                loginOverlay.style.opacity = '0'; // Animasi fade out
                
                setTimeout(() => {
                    loginOverlay.style.display = 'none';
                    dashboardWrapper.style.display = 'block';
                    
                    // Trigger animasi fade in ke dashboard
                    setTimeout(() => {
                        dashboardWrapper.style.opacity = '1';
                    }, 50);

                    // Panggil data dari backend (Mencegah pencurian data sebelum login)
                    initDashboardData();
                }, 300);
            } else {
                alert("🔥 AKSES DITOLAK! Username atau Password salah bosku.");
            }
        });
    }

    // ==========================================
    // 2. EVENT LISTENER FORMS DASHBOARD
    // ==========================================
    const addVideoForm = document.getElementById('addVideoForm');
    if (addVideoForm) {
        addVideoForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const payload = {
                title: document.getElementById('vidTitle').value,
                genre: document.getElementById('vidGenre').value,
                coverUrl: document.getElementById('vidCover').value,
                videoUrl: document.getElementById('vidUrl').value,
                isPremium: document.getElementById('vidPremium').checked
            };

            try {
                const res = await fetch('/api/admin/videos', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const data = await res.json();
                if(data.success) {
                    alert(`🔥 BOMB! Video "${data.video.title}" berhasil naik ke server!`);
                    e.target.reset();
                    initDashboardData(); // Refresh data otomatis
                }
            } catch (error) {
                console.error(error);
                alert("Oops! Server lagi sibuk, gagal upload.");
            }
        });
    }

    const generateTokenForm = document.getElementById('generateTokenForm');
    if (generateTokenForm) {
        generateTokenForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const payload = {
                videoId: document.getElementById('tokenVideoId').value,
                prefix: document.getElementById('tokenPrefix').value.toUpperCase(),
                count: parseInt(document.getElementById('tokenCount').value)
            };

            try {
                const res = await fetch('/api/admin/tokens', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const data = await res.json();
                if(data.success) {
                    alert(`✨ GACOR! Berhasil nyetak ${data.tokens.length} token siap jual!`);
                    initDashboardData(); // Refresh data otomatis
                }
            } catch (error) {
                console.error(error);
                alert("Gagal mencetak token.");
            }
        });
    }
});

// ==========================================
// 3. FUNGSI INISIALISASI & FETCH BACKEND
// (Dipanggil HANYA setelah login sukses)
// ==========================================
function initDashboardData() {
    fetchDashboardStats();
    fetchVideosForDropdown();
    fetchTokenList();
}

async function fetchDashboardStats() {
    try {
        const res = await fetch('/api/admin/stats');
        const stats = await res.json();
        
        document.getElementById('statTotalVideo').innerText = stats.totalVideos;
        document.getElementById('statTotalToken').innerText = stats.totalTokens;
        document.getElementById('statActiveToken').innerText = stats.activeTokens;
        document.getElementById('statViews').innerText = stats.totalViews.toLocaleString('id-ID');
    } catch (e) {
        console.error("Gagal load stats:", e);
    }
}

async function fetchVideosForDropdown() {
    try {
        const res = await fetch('/api/videos');
        const videos = await res.json();
        const select = document.getElementById('tokenVideoId');
        
        select.innerHTML = '<option value="ALL">Semua Video (Master/VIP Token)</option>';
        videos.forEach(v => {
            select.innerHTML += `<option value="${v.id}">${v.title} (${v.id})</option>`;
        });
    } catch (e) {
        console.error("Gagal load dropdown video", e);
    }
}

async function fetchTokenList() {
    try {
        const res = await fetch('/api/admin/tokens');
        const tokens = await res.json();
        const tbody = document.getElementById('tokenTableBody');
        
        tbody.innerHTML = tokens.reverse().map(t => `
            <tr>
                <td style="font-family: monospace; font-size: 1.1rem;" class="text-neon">${t.token}</td>
                <td><span class="clay-badge">${t.videoId}</span></td>
                <td>
                    ${t.isUsed 
                        ? '<span class="clay-badge danger" style="padding: 4px 10px; font-size:0.7rem;">Terpakai</span>' 
                        : '<span class="clay-badge success" style="padding: 4px 10px; font-size:0.7rem;">Aktif / Tersedia</span>'
                    }
                </td>
                <td style="font-size: 0.8rem; color:#888;">${new Date(t.createdAt).toLocaleString('id-ID')}</td>
            </tr>
        `).join('');
    } catch (e) {
        console.error("Gagal load table token", e);
    }
}
