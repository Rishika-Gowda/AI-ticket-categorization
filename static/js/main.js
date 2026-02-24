/* ============================================================
   SmartDesk — Main Page JavaScript
   ============================================================ */

// ── NAV scroll effect ──
window.addEventListener('scroll', () => {
  document.getElementById('navbar')?.classList.toggle('scrolled', window.scrollY > 30);
});

// ── Check auth state on load ──
async function checkAuth() {
  try {
    const res  = await fetch('/api/me');
    const data = await res.json();
    if (data.authenticated) {
      showUserNav(data.user);
    }
  } catch(e) {}
}

function showUserNav(user) {
  const initials = user.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  document.getElementById('nav-auth')?.classList.add('hidden');
  document.getElementById('nav-user')?.classList.remove('hidden');
  const init = document.getElementById('user-initials');
  const name = document.getElementById('user-name-nav');
  if (init) init.textContent = initials;
  if (name) name.textContent = user.name.split(' ')[0];
  
  // Show appropriate nav links based on role
  if (user.role === 'admin') {
    // Admin sees: Dashboard, Analytics (no My Tickets, no submit section)
    document.getElementById('nav-dashboard')?.classList.remove('hidden');
    document.getElementById('nav-analytics')?.classList.remove('hidden');
    
    // Hide submit section for admin
    const submitSection = document.querySelector('.submit-section');
    if (submitSection) {
      submitSection.style.display = 'none';
    }
    
    // Update hero CTAs for admin
    const heroCta = document.querySelector('.hero-cta');
    if (heroCta) {
      heroCta.innerHTML = `
        <a href="/dashboard" class="btn-hero">Go to Dashboard</a>
        <a href="/analytics" class="btn-hero-outline">View Analytics →</a>
      `;
    }
  } else {
    // Regular user sees: My Tickets (no Dashboard/Analytics, has submit section)
    document.getElementById('nav-mytickets')?.classList.remove('hidden');
  }
  
  // Remove auth notice on form if it exists
  document.getElementById('auth-notice')?.remove();
}

async function logout() {
  await fetch('/api/logout', { method: 'POST' });
  window.location.href = '/';
}

// Store analyzed data
let analyzedData = null;

// ── Analyze ticket (no auth required) ──
async function analyzeTicket() {
  const subject = document.getElementById('subject').value.trim();
  const body    = document.getElementById('body').value.trim();
  const btn     = document.getElementById('analyzeBtn');

  if (!subject || !body) {
    showToast('Please fill in both subject and description', 'error');
    return;
  }

  // Show loading state
  btn.disabled = true;
  btn.querySelector('.btn-text').classList.add('hidden');
  btn.querySelector('.btn-loader').classList.remove('hidden');
  document.getElementById('resultCard')?.classList.add('hidden');

  try {
    const res  = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subject, body })
    });
    const data = await res.json();

    if (!res.ok) {
      showToast(data.error || 'Analysis failed', 'error');
      return;
    }

    // Store the analyzed data
    analyzedData = data;

    // Show results
    displayResult(data);
    
    // Enable submit button and show notice
    const submitBtn = document.getElementById('submitBtn');
    submitBtn.disabled = false;
    document.getElementById('analyze-notice').classList.remove('hidden');
    
    showToast('Analysis complete! Review and submit when ready.', 'info');
  } catch (err) {
    showToast('Connection error. Please try again.', 'error');
  } finally {
    btn.disabled = false;
    btn.querySelector('.btn-text').classList.remove('hidden');
    btn.querySelector('.btn-loader').classList.add('hidden');
  }
}

// ── Submit ticket (requires auth) ──
document.getElementById('ticketForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();

  const subject = document.getElementById('subject').value.trim();
  const body    = document.getElementById('body').value.trim();
  const btn     = document.getElementById('submitBtn');

  if (!subject || !body) {
    showToast('Please fill in both subject and description', 'error');
    return;
  }

  // Check if user has analyzed first
  if (!analyzedData) {
    showToast('Please analyze the ticket first', 'error');
    return;
  }

  // Show loading state
  btn.disabled = true;
  btn.querySelector('.btn-text').classList.add('hidden');
  btn.querySelector('.btn-loader').classList.remove('hidden');

  try {
    const res  = await fetch('/api/predict', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subject, body })
    });
    const data = await res.json();

    if (!res.ok) {
      if (res.status === 401) {
        showToast('Please sign in to submit tickets', 'error');
        setTimeout(() => {
          window.location.href = '/login';
        }, 1500);
        return;
      }
      showToast(data.error || 'Submission failed', 'error');
      return;
    }

    // Update result with ticket ID
    displayResult(data);
    
    // Clear form
    document.getElementById('ticketForm').reset();
    analyzedData = null;
    btn.disabled = true;
    document.getElementById('analyze-notice').classList.add('hidden');
    
    showToast('✅ Ticket submitted successfully!', 'success');
  } catch (err) {
    showToast('Connection error. Please try again.', 'error');
  } finally {
    btn.disabled = false;
    btn.querySelector('.btn-text').classList.remove('hidden');
    btn.querySelector('.btn-loader').classList.add('hidden');
  }
});

function displayResult(data) {
  const card = document.getElementById('resultCard');
  card.classList.remove('hidden');

  // Update title based on whether ticket was saved
  const resultTitle = document.getElementById('result-title');
  if (data.ticket_id) {
    resultTitle.textContent = 'Ticket Submitted Successfully!';
  } else {
    resultTitle.textContent = 'AI Analysis Complete';
  }

  // Ticket ID (only show if ticket was actually saved)
  const ticketIdBadge = document.getElementById('ticketIdBadge');
  if (data.ticket_id) {
    ticketIdBadge.textContent = `#TKT-${String(data.ticket_id).padStart(5, '0')}`;
    ticketIdBadge.style.display = 'inline';
  } else {
    ticketIdBadge.style.display = 'none';
  }

  // Category
  const catEl = document.getElementById('r-category');
  catEl.textContent = data.category;

  // Priority
  const priEl = document.getElementById('r-priority');
  priEl.textContent = data.priority?.charAt(0).toUpperCase() + data.priority?.slice(1);
  priEl.setAttribute('data-val', data.priority);
  priEl.className = 'ri-value priority-badge';

  // Queue
  document.getElementById('r-queue').textContent = data.queue;

  // Confidence bars
  const catConf = Math.round((data.confidence_category || 0) * 100);
  const priConf = Math.round((data.confidence_priority || 0) * 100);
  document.getElementById('conf-cat-pct').textContent = `${catConf}%`;
  document.getElementById('conf-pri-pct').textContent = `${priConf}%`;

  // Animate bars
  setTimeout(() => {
    document.getElementById('conf-cat-bar').style.width = `${catConf}%`;
    document.getElementById('conf-pri-bar').style.width = `${priConf}%`;
  }, 100);

  // Rule override notice
  const overrideNotice = document.getElementById('override-notice');
  if (data.rule_override) {
    overrideNotice.classList.remove('hidden');
  } else {
    overrideNotice.classList.add('hidden');
  }

  // Entities
  const grid = document.getElementById('entitiesGrid');
  const section = document.getElementById('entitiesSection');
  grid.innerHTML = '';
  const ents = data.entities || {};
  const hasEnts = Object.keys(ents).some(k => ents[k]?.length);

  if (hasEnts) {
    section.style.display = 'block';
    Object.entries(ents).forEach(([type, values]) => {
      if (!values?.length) return;
      values.forEach(v => {
        const tag = document.createElement('span');
        tag.className = 'entity-tag';
        tag.innerHTML = `<strong>${type}</strong>${v}`;
        grid.appendChild(tag);
      });
    });
  } else {
    section.style.display = 'none';
  }

  // Smooth scroll to result
  card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ── Toast notification ──
function showToast(msg, type = 'info') {
  const existing = document.getElementById('toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'toast';
  
  let bgColor, borderColor, textColor;
  if (type === 'error') {
    bgColor = 'rgba(220,38,38,0.15)';
    borderColor = 'rgba(220,38,38,0.3)';
    textColor = '#DC2626';
  } else if (type === 'success') {
    bgColor = 'rgba(22,163,74,0.12)';
    borderColor = 'rgba(22,163,74,0.25)';
    textColor = '#16A34A';
  } else {
    bgColor = 'rgba(6,182,212,0.12)';
    borderColor = 'rgba(6,182,212,0.25)';
    textColor = '#0891B2';
  }
  
  toast.style.cssText = `
    position: fixed; bottom: 28px; right: 28px; z-index: 1000;
    padding: 14px 22px; border-radius: 10px; font-size: 0.875rem;
    font-family: 'Inter', sans-serif; font-weight: 500;
    backdrop-filter: blur(10px); animation: toastIn 0.3s ease;
    background: ${bgColor}; border: 1px solid ${borderColor}; color: ${textColor};
  `;
  toast.textContent = msg;

  const style = document.createElement('style');
  style.textContent = '@keyframes toastIn { from { opacity:0; transform: translateX(20px); } to { opacity:1; transform: translateX(0); } }';
  if (!document.getElementById('toast-styles')) {
    style.id = 'toast-styles';
    document.head.appendChild(style);
  }
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}

// ── Animate feature cards on scroll ──
function animateOnScroll() {
  const cards = document.querySelectorAll('.feature-card, .arch-node');
  const obs = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const delay = entry.target.dataset.delay || 0;
        setTimeout(() => {
          entry.target.style.opacity = '1';
          entry.target.style.transform = 'translateY(0)';
        }, Number(delay));
        obs.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });

  cards.forEach(card => {
    card.style.opacity = '0';
    card.style.transform = 'translateY(20px)';
    card.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
    obs.observe(card);
  });
}

// ── Init ──
document.addEventListener('DOMContentLoaded', () => {
  checkAuth();
  animateOnScroll();
});
