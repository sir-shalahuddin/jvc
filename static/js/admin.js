// ==========================================================================
// Retro - Admin Dashboard Logic
// ==========================================================================

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

async function loadAdminData() {
    try {
        const res = await fetch('/api/admin/stats');
        if (res.status === 403) return window.location.href = '/';
        const data = await res.json();
        
        const totalSessionsEl = document.getElementById('totalSessions');
        const totalUsersEl = document.getElementById('totalUsers');
        const totalRevenueEl = document.getElementById('totalRevenue');
        if (totalSessionsEl) totalSessionsEl.innerText = data.total_sessions || 0;
        if (totalUsersEl) totalUsersEl.innerText = data.total_users || 0;
        if (totalRevenueEl) totalRevenueEl.innerText = data.total_revenue || 0;

        const sList = document.getElementById('sessionList');
        if (sList) {
            sList.innerHTML = (data.recent_sessions || []).map(s => `
                <tr>
                    <td style="font-weight: 700;">${escapeHTML(s.creator_email || 'System')}</td>
                    <td>${escapeHTML(s.name)}</td>
                    <td style="color: var(--text-muted); font-size: 0.8rem;">${new Date(s.created_at).toLocaleString()}</td>
                    <td>
                        <a href="/session/?id=${encodeURIComponent(s.id)}&role=sm" class="action-btn">Manage</a>
                    </td>
                </tr>
            `).join('');
        }
    } catch (e) {
        console.error('Failed to load admin data:', e);
    }
}

window.toggleTheme = toggleTheme;
window.updateThemeIcon = updateThemeIcon;

document.addEventListener('DOMContentLoaded', () => {
    updateThemeIcon();
    loadAdminData();
});
