// FILE: public/js/admin.js
document.addEventListener('DOMContentLoaded', () => {
    console.log("AXA Admin System Loaded.");
    
    const loginForm = document.getElementById('adminLoginForm');
    const loginOverlay = document.getElementById('loginOverlay');
    const dashboardWrapper = document.getElementById('dashboardWrapper');

    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const user = document.getElementById('adminUser').value;
            const pass = document.getElementById('adminPass').value;

            if (user === 'axaaxyz_01' && pass === 'axaxyz999') {
                loginOverlay.style.opacity = '0';
                setTimeout(() => {
                    loginOverlay.style.display = 'none';
                    dashboardWrapper.style.display = 'block';
                    setTimeout(() => dashboardWrapper.style.opacity = '1', 50);
                    initDashboardData();
                }, 300);
            } else {
                alert("🔥 AKSES DITOLAK! Username atau Password salah bosku.");
            }
        });
    }

    const addVideoForm = document.getElementById('addVideoForm');
    const btnSubmit = document.getElementById('btnUploadSubmit');

    if (addVideoForm) {
        addVideoForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const originalBtnText = btnSubmit.innerText;
            btnSubmit.innerText = "⏳ Sedang Memproses... (Jangan di-close)";
            btnSubmit.disabled = true;
            btnSubmit.style.opacity = "0.7";

            const formData = new FormData();
            formData.append('title', document.getElementById('vidTitle').value);
            formData.append('genre', document.getElementById('vidGenre').value);
            formData.append('isPremium', document.getElementById('vidPremium').checked);

            const coverFileInput = document.getElementById('vidCoverFile');
            const coverUrlInput = document.getElementById('vidCoverUrl');

            if (coverFileInput.files.length > 0) {
                formData.append('coverFile', coverFileInput.files[0]);
            } else if (coverUrlInput.value.trim() !== '') {
                formData.append('coverUrl', coverUrlInput.value);
            } else {
                alert("Bosku wajib masukin File Cover Image atau Paste URL Cover!");
                resetBtn();
                return;
            }

            const fileInput = document.getElementById('vidFile');
            const urlInput = document.getElementById('vidUrl');

            if (fileInput.files.length > 0) {
                formData.append('videoFile', fileInput.files[0]);
            } else if (urlInput.value.trim() !== '') {
                formData.append('videoUrl', urlInput.value);
            } else {
                alert("Bosku wajib masukin File Video atau Paste URL!");
                resetBtn();
                return;
            }

            try {
                const res = await fetch('/api/admin/videos', {
                    method: 'POST',
                    body: formData 
                });
                
                const data = await res.json();
                if(data.success) {
                    alert(`🔥 BOMB! Video "${data.video.title}" berhasil naik ke server! (Jika pakai GDrive otomatis ter-convert)`);
                    addVideoForm.reset();
                    initDashboardData(); 
                } else {
                    alert("Upload gagal: " + data.message);
                }
            } catch (error) {
                console.error(error);
                alert("Oops! Server lagi sibuk, gagal koneksi.");
            } finally {
                resetBtn();
            }

            function resetBtn() {
                btnSubmit.innerText = originalBtnText;
                btnSubmit.disabled = false;
                btnSubmit.style.opacity = "1";
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
                    initDashboardData();
                }
            } catch (error) {
                console.error(error);
                alert("Gagal mencetak token.");
            }
        });
    }
});

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
    } catch (e) { console.error("Gagal load stats", e); }
}

async function fetchVideosForDropdown() {
    try {
        const res = await fetch('/api/videos');
        const videos = await res.json();
        const select = document.getElementById('tokenVideoId');
        select.innerHTML = '<option value="ALL">Semua Video (Master/VIP Token)</option>';
        videos.forEach(v => { select.innerHTML += `<option value="${v.id}">${v.title} (${v.id})</option>`; });
    } catch (e) { console.error("Gagal load dropdown video", e); }
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
                        : '<span class="clay-badge success" style="padding: 4px 10px; font-size:0.7rem;">Aktif</span>'
                    }
                </td>
                <td style="font-size: 0.8rem; color:#888;">${new Date(t.createdAt).toLocaleString('id-ID')}</td>
            </tr>
        `).join('');
    } catch (e) { console.error("Gagal load table token", e); }
}
