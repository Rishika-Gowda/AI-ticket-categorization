/* ============================================================
   SmartDesk — Dashboard JavaScript (Admin View)
   ============================================================ */

let allTickets = [];
let currentFilter = 'all';
let currentEditId = null;
let isAdmin = false;

// ── Priority badge classes ──
const PRIORITY_CLASS = { high: 'pill-high', medium: 'pill-medium', low: 'pill-low' };
const STATUS_CLASS   = { 'Pending': 's-pending', 'In Progress': 's-inprogress', 'Resolved': 's-resolved', 'Closed': 's-closed' };

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

async function loadStats() {
  const res  = await fetch('/api/stats');
  const data = await res.json();
  isAdmin = data.is_admin;
  
  document.getElementById('stat-total').textContent    = data.total;
  document.getElementById('stat-today').textContent    = data.today;
  document.getElementById('stat-pending').textContent  = data.pending;
  document.getElementById('stat-resolved').textContent = data.resolved;
  
  // Update page title if admin
  if (isAdmin) {
    document.querySelector('.page-title').textContent = 'Admin Dashboard';
    document.querySelector('.page-sub').textContent = 'Manage all support tickets';
  }
}

async function loadTickets() {
  const sort = document.getElementById('sortSelect')?.value || 'date';
  const res  = await fetch(`/api/tickets?sort=${sort}`);
  allTickets = await res.json();
  
  // Update table header for admin
  if (isAdmin && allTickets.length > 0 && allTickets[0].user_name) {
    const header = document.getElementById('tableHeader');
    if (header && !document.getElementById('userCol')) {
      const th = document.createElement('th');
      th.id = 'userCol';
      th.textContent = 'User';
      header.insertBefore(th, header.children[2]); // Insert after Subject
    }
  }
  
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
    const colspan = isAdmin && allTickets[0]?.user_name ? '9' : '8';
    tbody.innerHTML = `<tr><td colspan="${colspan}" class="empty-row">No tickets found.</td></tr>`;
    return;
  }

  tbody.innerHTML = tickets.map(t => {
    const priClass  = PRIORITY_CLASS[t.priority] || 'pill-medium';
    const statClass = STATUS_CLASS[t.status] || '';

    let userCol = '';
    if (isAdmin && t.user_name) {
      userCol = `<td style="font-size:0.85rem;color:var(--text-2)">${escapeHtml(t.user_name)}</td>`;
    }

    return `
      <tr>
        <td>#${String(t.id).padStart(5,'0')}</td>
        <td class="td-subject" title="${escapeHtml(t.subject)}">${escapeHtml(t.subject)}</td>
        ${userCol}
        <td><span class="pill pill-cat">${escapeHtml(t.category || '—')}</span></td>
        <td><span class="pill ${priClass}">${capitalize(t.priority || 'medium')}</span></td>
        <td style="font-size:0.8rem;color:var(--text-3)">${escapeHtml(t.queue || '—')}</td>
        <td><span class="pill pill-status ${statClass}">${escapeHtml(t.status)}</span></td>
        <td style="white-space:nowrap">${formatDate(t.created_at)}</td>
        <td>
          <div class="action-btns">
            <button class="action-btn action-btn-edit" onclick="openStatusModal(${t.id})">Update</button>
            ${isAdmin ? `<button class="action-btn action-btn-del" onclick="deleteTicket(${t.id})">Delete</button>` : ''}
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function capitalize(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

// ── Status modal ──
function openStatusModal(id) {
  currentEditId = id;
  const ticket = allTickets.find(t => t.id === id);
  
  document.getElementById('modal-ticket-id').textContent = `#${String(id).padStart(5,'0')}`;
  document.getElementById('modal-ticket-subject').textContent = ticket ? ticket.subject : '';
  
  // Set current status as selected
  if (ticket) {
    document.getElementById('statusSelect').value = ticket.status;
  }
  
  // Clear admin notes
  document.getElementById('adminNotes').value = '';
  
  document.getElementById('statusModal').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('statusModal').classList.add('hidden');
  currentEditId = null;
}

async function applyStatusUpdate() {
  if (!currentEditId) return;
  
  const status = document.getElementById('statusSelect').value;
  const adminNotes = document.getElementById('adminNotes').value.trim();
  const btn = document.querySelector('#statusModal .btn-submit');
  
  // Show loading
  btn.disabled = true;
  btn.querySelector('.btn-text').classList.add('hidden');
  btn.querySelector('.btn-loader').classList.remove('hidden');
  
  try {
    const payload = { status };
    if (adminNotes) {
      payload.admin_notes = adminNotes;
    }
    
    const res = await fetch(`/api/tickets/${currentEditId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    if (!res.ok) {
      throw new Error('Update failed');
    }
    
    closeModal();
    await loadTickets();
    await loadStats();
    showToast(`Ticket updated to "${status}"`);
  } catch (e) {
    showToast('Failed to update ticket', 'error');
  } finally {
    btn.disabled = false;
    btn.querySelector('.btn-text').classList.remove('hidden');
    btn.querySelector('.btn-loader').classList.add('hidden');
  }
}

async function deleteTicket(id) {
  if (!confirm('Delete this ticket? This cannot be undone.')) return;
  try {
    await fetch(`/api/tickets/${id}`, { method: 'DELETE' });
    await loadTickets();
    await loadStats();
    showToast('Ticket deleted');
  } catch (e) {
    showToast('Failed to delete ticket', 'error');
  }
}

// Close modal on overlay click
document.getElementById('statusModal')?.addEventListener('click', (e) => {
  if (e.target === document.getElementById('statusModal')) closeModal();
});

function showToast(msg, type='info') {
  const existing = document.getElementById('toast');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.id = 'toast';
  toast.style.cssText = `
    position:fixed;bottom:28px;right:28px;z-index:1000;
    padding:14px 22px;border-radius:10px;font-size:0.875rem;
    font-family:'Inter',sans-serif;font-weight:500;
    backdrop-filter:blur(10px);
    ${type==='error'
      ? 'background:rgba(220,38,38,0.15);border:1px solid rgba(220,38,38,0.3);color:#DC2626;'
      : 'background:rgba(22,163,74,0.1);border:1px solid rgba(22,163,74,0.25);color:#16A34A;'}
  `;
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
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
  
  // Redirect regular users to user tickets page
  if (me.user.role !== 'admin') {
    window.location.href = '/my-tickets';
    return;
  }

  // Set nav user
  const initials = me.user.name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
  document.getElementById('user-initials').textContent = initials;
  document.getElementById('user-name-nav').textContent = me.user.name.split(' ')[0];

  await loadStats();
  await loadTickets();
});
