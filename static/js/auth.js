/* ============================================================
   SmartDesk — Auth Shared JavaScript
   ============================================================ */

function setLoading(btn, loading) {
  btn.disabled = loading;
  const text   = btn.querySelector('.btn-text');
  const loader = btn.querySelector('.btn-loader');
  if (text && loader) {
    text.classList.toggle('hidden', loading);
    loader.classList.toggle('hidden', !loading);
  }
}

function togglePw() {
  const inp = document.getElementById('password');
  const ico = document.getElementById('eye-icon');
  if (inp.type === 'password') {
    inp.type = 'text';
    ico.innerHTML = `<path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24M1 1l22 22" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>`;
  } else {
    inp.type = 'password';
    ico.innerHTML = `<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>`;
  }
}

async function logout() {
  await fetch('/api/logout', { method: 'POST' });
  window.location.href = '/';
}

// Check if logged in for protected pages
async function checkAuthRequired() {
  try {
    const res = await fetch('/api/me');
    if (res.status === 401) {
      window.location.href = '/login';
      return null;
    }
    const data = await res.json();
    if (!data.authenticated) {
      window.location.href = '/login';
      return null;
    }

    // Update nav
    const initials = data.user.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
    const initEl = document.getElementById('user-initials');
    const nameEl = document.getElementById('user-name-nav');
    if (initEl) initEl.textContent = initials;
    if (nameEl) nameEl.textContent = data.user.name.split(' ')[0];

    return data.user;
  } catch (e) {
    window.location.href = '/login';
    return null;
  }
}
