// FILE: public/js/admin.js
// Logika Vanilla JS khusus untuk Halaman Admin (Upload & Generate Token)

document.addEventListener('DOMContentLoaded', () => {
    console.log("AXA Admin Module Initialized. Gasss!");
    
    // Initial Fetch
    fetchDashboardStats();
    fetchVideosForDropdown();
    fetchTokenList();

    // Event Listener: Add Video
    document.getElementById('addVideoForm').addEventListener('submit', async (e) => {
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
                alert(`🔥 BOMB! Video "${data.video.title}" berhasil naik ke server bosku!`);
                e.target.reset();
                fetchDashboardStats(); // Refresh stats
                fetchVideosForDropdown(); // Refresh dropdown
            }
        } catch (error) {
            console.error(error);
            alert("Oops! Server lagi sibuk, gagal upload.");
        }
    });

    // Event Listener: Generate Token
    document.getElementById('generateTokenForm').addEventListener('submit', async (e) => {
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
                fetchDashboardStats();
                fetchTokenList();
            }
        } catch (error) {
            console.error(error);
            alert("Gagal mencetak token.");
        }
    });
});

// -- Helper Functions API Fetcher -- //

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
        
        // Keep the ALL option, clear the rest
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