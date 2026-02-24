/* ============================================================
   SmartDesk — User Tickets JavaScript
   ============================================================ */

let allTickets = [];
let currentFilter = 'all';

const STATUS_CLASS = { 
  'Pending': 's-pending', 
  'In Progress': 's-inprogress', 
  'Resolved': 's-resolved', 
  'Closed': 's-closed' 
};

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

async function loadStats() {
  const res  = await fetch('/api/stats');
  const data = await res.json();
  
  document.getElementById('stat-total').textContent = data.total;
  document.getElementById('stat-pending').textContent = data.pending;
  document.getElementById('stat-resolved').textContent = data.resolved;
  
  // Calculate in progress
  const inProgress = data.by_status.find(s => s.status === 'In Progress');
  document.getElementById('stat-inprogress').textContent = inProgress ? inProgress.cnt : 0;
}

async function loadTickets() {
  const res  = await fetch('/api/tickets');
  allTickets = await res.json();
  renderTickets(allTickets);
}

function filterTickets(btn, filter) {
  currentFilter = filter;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');

  const filtered = filter === 'all'
    ? allTickets
    : allTickets.filter(t => t.status === filter);
  renderTickets(filtered);
}

function renderTickets(tickets) {
  const tbody = document.getElementById('ticketsBody');

  if (!tickets.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-row">No tickets found. <a href="/#submit" style="color:var(--blue)">Submit your first ticket →</a></td></tr>';
    return;
  }

  tbody.innerHTML = tickets.map(t => {
    const statClass = STATUS_CLASS[t.status] || '';
    const created = formatDate(t.created_at);
    const updated = formatDate(t.updated_at);
    const hasDetails = t.body || t.admin_notes;

    return `
      <tr class="ticket-row">
        <td style="padding: 8px;">
          ${hasDetails ? `<button class="expand-btn" onclick="toggleDetails(${t.id})" id="expand-${t.id}">▶</button>` : ''}
        </td>
        <td>#${String(t.id).padStart(5,'0')}</td>
        <td class="td-subject" title="${escapeHtml(t.subject)}">${escapeHtml(t.subject)}</td>
        <td><span class="pill pill-status ${statClass}">${escapeHtml(t.status)}</span></td>
        <td style="font-size:0.85rem;color:var(--text-3)">${created.split(',')[0]}</td>
        <td style="font-size:0.85rem;color:var(--text-3)">${updated.split(',')[0]}</td>
      </tr>
      ${hasDetails ? `
      <tr class="detail-row" id="details-${t.id}">
        <td colspan="6" class="detail-cell">
          <div class="ticket-details">
            <div class="detail-section">
              <h4>Ticket Description</h4>
              <p>${escapeHtml(t.body || 'No description provided')}</p>
            </div>
            <div class="detail-section">
              <h4>Ticket Information</h4>
              <p style="margin-bottom: 8px;"><strong>Created:</strong> ${created}</p>
              <p style="margin-bottom: 8px;"><strong>Last Updated:</strong> ${updated}</p>
              <p><strong>Status:</strong> <span class="pill pill-status ${statClass}">${escapeHtml(t.status)}</span></p>
              ${t.admin_notes ? `
                <div class="admin-note">
                  <div class="admin-note-label">📝 Admin Response</div>
                  <div class="admin-note-text">${escapeHtml(t.admin_notes)}</div>
                </div>
              ` : ''}
            </div>
          </div>
        </td>
      </tr>
      ` : ''}
    `;
  }).join('');
}

function toggleDetails(id) {
  const detailRow = document.getElementById(`details-${id}`);
  const expandBtn = document.getElementById(`expand-${id}`);
  
  if (detailRow.classList.contains('show')) {
    detailRow.classList.remove('show');
    expandBtn.classList.remove('expanded');
  } else {
    // Close all other details first
    document.querySelectorAll('.detail-row').forEach(row => row.classList.remove('show'));
    document.querySelectorAll('.expand-btn').forEach(btn => btn.classList.remove('expanded'));
    
    // Open this one
    detailRow.classList.add('show');
    expandBtn.classList.add('expanded');
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

async function logout() {
  await fetch('/api/logout', { method: 'POST' });
  window.location.href = '/';
}

// ── Init ──
document.addEventListener('DOMContentLoaded', async () => {
  // Auth check
  const res = await fetch('/api/me');
  if (res.status === 401) { window.location.href = '/login'; return; }
  const me = await res.json();
  if (!me.authenticated) { window.location.href = '/login'; return; }
  
  // Redirect admin users to admin dashboard
  if (me.user.role === 'admin') {
    window.location.href = '/dashboard';
    return;
  }

  // Set nav user
  const initials = me.user.name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
  document.getElementById('user-initials').textContent = initials;
  document.getElementById('user-name-nav').textContent = me.user.name.split(' ')[0];

  await loadStats();
  await loadTickets();
});
