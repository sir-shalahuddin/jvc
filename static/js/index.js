// ==========================================================================
// Retro - Landing / Home Page Logic
// ==========================================================================

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast toast-${type} animate-fade-up`;
    toast.style.cssText = `
        background: var(--bg-card);
        border: 3px solid var(--border-color);
        padding: 1rem 2rem;
        border-radius: var(--radius);
        margin-bottom: 1rem;
        box-shadow: 4px 4px 0px var(--border-color);
        display: flex;
        align-items: center;
        gap: 1rem;
        color: var(--text);
        font-family: 'JetBrains Mono', monospace !important;
        font-weight: 700;
        font-size: 0.9rem;
    `;
    
    const colors = {
        success: '#10b981',
        error: '#ef4444',
        info: '#ff8552'
    };
    
    const dot = `<div style="width: 10px; height: 10px; border-radius: 0px; background: ${colors[type] || colors.info}"></div>`;
    toast.innerHTML = `${dot} <span>${message}</span>`;
    
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(-20px)';
        toast.style.transition = 'all 0.5s ease';
        setTimeout(() => toast.remove(), 500);
    }, 5000);
}

function updateThemeIcon() {
    const theme = document.documentElement.getAttribute('data-theme');
    const icon = document.getElementById('theme-icon');
    if (!icon) return;
    if (theme === 'dark') {
        icon.innerHTML = '<path d="M12 3c.132 0 .263 0 .393 0a7.5 7.5 0 0 0 7.92 12.446a9 9 0 1 1-8.313-12.454z"></path>';
    } else {
        icon.innerHTML = '<circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>';
    }
}

function toggleTheme() {
    const target = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', target);
    localStorage.setItem('theme', target);
    updateThemeIcon();
}

function escapeHTML(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, m => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
    })[m]);
}

async function checkAuth() {
    try {
        const res = await fetch('/api/me');
        const data = await res.json();
        const authSection = document.getElementById('authSection');
        const nav = document.getElementById('mainNav');
        if (!authSection) return;
        
        if (data.authenticated) {
            const encodedMsg = encodeURIComponent(`Halo Admin Retro, saya ingin request penambahan kuota sesi untuk akun ${data.email}. Terima kasih!`);
            const waUrl = `https://wa.me/6285640390800?text=${encodedMsg}`;
            
            const waBtn = document.getElementById('waRequestBtn');
            if (waBtn) {
                waBtn.href = waUrl;
            }

            authSection.innerHTML = `
                <div class="auth-status-box">
                    <div style="font-weight: 700; font-size: 0.9rem;">${escapeHTML(data.email.split('@')[0])}</div>
                    <span class="badge badge-success">${data.quota} Units</span>
                </div>
                <div style="display: flex; gap: 0.75rem; margin-bottom: 0.75rem;">
                    <input type="text" id="sessionName" placeholder="Discussion Topic" value="Sprint Sync" style="padding: 0.75rem 1rem; flex-grow: 1;">
                    <button id="createSessionBtn" class="btn btn-primary" style="padding: 0 1.25rem;">Start</button>
                </div>
                <div style="margin-bottom: 1.25rem;">
                    <a href="/dashboard" class="btn btn-secondary" style="width: 100%; justify-content: center; font-size: 0.85rem; padding: 0.6rem; text-decoration: none;">
                        Open Workspace Dashboard &rarr;
                    </a>
                </div>
                <div style="display: flex; gap: 1.5rem; font-size: 0.8rem; font-weight: 700;">
                    <a href="${waUrl}" target="_blank" style="color: var(--primary); text-decoration:none;">Tambah Kuota (WA)</a>
                    <a href="/auth/logout" style="color: var(--danger); text-decoration:none;">Sign Out</a>
                </div>
            `;
            const createBtn = document.getElementById('createSessionBtn');
            if (createBtn) createBtn.onclick = createSession;
            
            // Inject Dashboard link ONLY if logged in and not already present
            if (nav && !document.getElementById('dashboardNavLink')) {
                const dashLink = document.createElement('a');
                dashLink.id = 'dashboardNavLink';
                dashLink.href = '/dashboard';
                dashLink.innerText = 'Dashboard';
                dashLink.style.color = 'var(--primary)';
                dashLink.style.fontWeight = '700';
                nav.appendChild(dashLink);

                if (data.is_admin && !document.getElementById('adminDashboardLink')) { 
                    const adminLink = document.createElement('a');
                    adminLink.id = 'adminDashboardLink';
                    adminLink.href = '/admin';
                    adminLink.innerText = 'Admin Center';
                    adminLink.style.color = 'var(--accent)';
                    nav.appendChild(adminLink);
                }
            }
        } else {
            authSection.innerHTML = `<button class="btn btn-primary" style="width: 100%; padding: 1rem; font-size: 1rem; border-radius: 0px;" onclick="window.location.href='/auth/google/login'">Continue with Google</button>`;
        }
    } catch (e) {
        console.error('Failed to check auth:', e);
    }
}

async function createSession() {
    const sessionNameInput = document.getElementById('sessionName');
    const name = (sessionNameInput && sessionNameInput.value.trim()) || "Sprint Sync";
    try {
        const res = await fetch('/api/session/create', { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ name }) 
        });
        if (res.ok) { 
            const d = await res.json(); 
            window.location.href = `/session/?id=${d.id}&role=sm`; 
        } else {
            showToast('Failed to create session', 'error');
        }
    } catch (e) {
        console.error('Error creating session:', e);
        showToast('Error creating session', 'error');
    }
}

window.toggleTheme = toggleTheme;
window.updateThemeIcon = updateThemeIcon;
window.showToast = showToast;

document.addEventListener('DOMContentLoaded', () => {
    updateThemeIcon();
    checkAuth();

    const joinBtn = document.getElementById('joinSessionBtn');
    if (joinBtn) {
        joinBtn.onclick = () => {
            const joinCodeInput = document.getElementById('joinCode');
            const code = joinCodeInput ? joinCodeInput.value.trim() : '';
            if (code) window.location.href = `/session/?id=${encodeURIComponent(code)}`;
        };
    }
});
