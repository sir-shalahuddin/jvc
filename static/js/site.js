// Landing page: login state, create session, join session.

function el(tag, attrs, text) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    if (text !== undefined) n.textContent = text;
    return n;
}

function setMsg(text) {
    var m = document.getElementById('formMsg');
    if (m) {
        m.textContent = text || '';
        m.className = text ? 'msg err' : 'msg';
    }
}

function renderLoggedOut(box) {
    box.textContent = '';
    var stack = el('div', { 'class': 'stack' });
    stack.appendChild(el('p', { 'class': 'note' }, 'Masuk dengan Google untuk membuat sesi.'));
    stack.appendChild(el('a', { 'class': 'btn btn-primary btn-block', href: '/auth/google/login?next=%2Fdashboard' }, 'Masuk dengan Google'));
    box.appendChild(stack);
}

function renderLoggedIn(box, data) {
    box.textContent = '';
    var stack = el('div', { 'class': 'stack' });
    var name = (data.email || '').split('@')[0];
    stack.appendChild(el('div', { 'class': 'who' }, name));
    stack.appendChild(el('p', { 'class': 'note' }, 'Sisa kuota: ' + (data.quota || 0)));

    var form = el('form', { id: 'createForm' });
    form.appendChild(el('label', { 'class': 'lbl', 'for': 'sessionName' }, 'Nama sesi'));
    var row = el('div', { 'class': 'row' });
    var input = el('input', { type: 'text', id: 'sessionName', value: 'Retro sprint', autocomplete: 'off' });
    row.appendChild(input);
    row.appendChild(el('button', { type: 'submit', 'class': 'btn btn-primary' }, 'Mulai'));
    form.appendChild(row);
    form.addEventListener('submit', function (e) {
        e.preventDefault();
        createSession(input.value);
    });
    stack.appendChild(form);

    stack.appendChild(el('p', { id: 'formMsg', 'class': 'msg', role: 'alert' }));
    stack.appendChild(el('a', { 'class': 'btn', href: '/dashboard' }, 'Buka dashboard'));
    stack.appendChild(el('a', { 'class': 'note', href: '/auth/logout' }, 'Keluar'));
    box.appendChild(stack);

    // Put the account in the top-up message so the request names who it is for.
    var wa = document.getElementById('waRequestBtn');
    if (wa && data.email) {
        wa.href = 'https://wa.me/6285640390800?text=' +
            encodeURIComponent('Halo, saya ingin menambah kuota sesi Retro untuk akun ' + data.email + '. Terima kasih.');
    }
}

async function checkAuth() {
    var box = document.getElementById('authSection');
    if (!box) return;
    try {
        var res = await fetch('/api/me');
        var data = await res.json();
        if (data && data.authenticated) renderLoggedIn(box, data);
        else renderLoggedOut(box);
    } catch (e) {
        renderLoggedOut(box);
    }
}

async function createSession(rawName) {
    var name = (rawName || '').trim() || 'Retro sprint';
    setMsg('');
    try {
        var res = await fetch('/api/session/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: name })
        });
        if (res.ok) {
            var d = await res.json();
            window.location.href = '/session/?id=' + encodeURIComponent(d.id) + '&role=sm';
        } else {
            var t = (await res.text()) || '';
            setMsg(t.trim() || 'Gagal membuat sesi. Cek kuota kamu.');
        }
    } catch (e) {
        setMsg('Gagal membuat sesi. Coba lagi.');
    }
}

function sessionIdFrom(input) {
    var v = (input || '').trim();
    if (!v) return '';
    try {
        var u = new URL(v);
        var id = u.searchParams.get('id');
        if (id) return id;
    } catch (e) { /* not a URL: treat as a code */ }
    return v;
}

document.addEventListener('DOMContentLoaded', function () {
    checkAuth();
    var join = document.getElementById('joinForm');
    if (join) {
        join.addEventListener('submit', function (e) {
            e.preventDefault();
            var code = sessionIdFrom(document.getElementById('joinCode').value);
            if (code) window.location.href = '/session/?id=' + encodeURIComponent(code);
        });
    }
});
