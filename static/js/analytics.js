/* ============================================================
   SmartDesk — Analytics JavaScript
   ============================================================ */

const CHART_COLORS = {
  blue:   '#2979FF',
  cyan:   '#00D4FF',
  violet: '#7B5CF0',
  teal:   '#00C9A7',
  orange: '#F59E0B',
  red:    '#FF4444',
  green:  '#22C55E',
  pink:   '#EC4899',
};

Chart.defaults.color = '#94A3C0';
Chart.defaults.borderColor = 'rgba(255,255,255,0.06)';
Chart.defaults.font.family = "'DM Sans', sans-serif";

function makeGradient(ctx, colors) {
  const grad = ctx.createLinearGradient(0,0,0,300);
  grad.addColorStop(0, colors[0] + 'CC');
  grad.addColorStop(1, colors[1] + '22');
  return grad;
}

async function loadAnalytics() {
  const res  = await fetch('/api/stats');
  const data = await res.json();

  // Update total label
  document.getElementById('total-label').textContent = `${data.total} total`;

  // ─── Daily chart ───
  const dailyCtx = document.getElementById('dailyChart').getContext('2d');
  const labels   = data.daily?.map(d => {
    const date = new Date(d.day);
    return date.toLocaleDateString('en', { month:'short', day:'numeric' });
  }) || [];
  const counts = data.daily?.map(d => d.cnt) || [];

  // Fill missing days
  const fullLabels = [];
  const fullCounts = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const label = d.toLocaleDateString('en', { month:'short', day:'numeric' });
    fullLabels.push(label);
    const found = data.daily?.find(r => {
      const rd = new Date(r.day);
      return rd.toLocaleDateString('en', { month:'short', day:'numeric' }) === label;
    });
    fullCounts.push(found ? found.cnt : 0);
  }

  new Chart(dailyCtx, {
    type: 'bar',
    data: {
      labels: fullLabels,
      datasets: [{
        label: 'Tickets',
        data: fullCounts,
        backgroundColor: (ctx) => {
          const grad = ctx.chart.ctx.createLinearGradient(0,0,0,200);
          grad.addColorStop(0, '#00D4FFCC');
          grad.addColorStop(1, '#00D4FF22');
          return grad;
        },
        borderColor: '#00D4FF',
        borderWidth: 2,
        borderRadius: 6,
        hoverBackgroundColor: '#00D4FF',
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, ticks: { stepSize: 1 }, grid: { color: 'rgba(255,255,255,0.04)' } },
        x: { grid: { display: false } }
      }
    }
  });

  // ─── Category chart ───
  const catCtx    = document.getElementById('categoryChart').getContext('2d');
  const catData   = data.by_category || [];
  const catLabels = catData.map(d => d.category);
  const catCounts = catData.map(d => d.cnt);
  const catColors = [CHART_COLORS.blue, CHART_COLORS.cyan, CHART_COLORS.violet, CHART_COLORS.teal, CHART_COLORS.orange];

  new Chart(catCtx, {
    type: 'doughnut',
    data: {
      labels: catLabels,
      datasets: [{
        data: catCounts,
        backgroundColor: catColors.slice(0, catData.length).map(c => c + 'CC'),
        borderColor: catColors.slice(0, catData.length),
        borderWidth: 2,
        hoverOffset: 6,
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: 'bottom',
          labels: { boxWidth: 12, padding: 16, font: { size: 12 } }
        }
      },
      cutout: '65%'
    }
  });

  // ─── Priority chart ───
  const priCtx  = document.getElementById('priorityChart').getContext('2d');
  const priData = data.by_priority || [];
  const priColorsMap = { high: CHART_COLORS.red, medium: CHART_COLORS.orange, low: CHART_COLORS.green };

  new Chart(priCtx, {
    type: 'doughnut',
    data: {
      labels: priData.map(d => capitalize(d.priority)),
      datasets: [{
        data: priData.map(d => d.cnt),
        backgroundColor: priData.map(d => (priColorsMap[d.priority] || CHART_COLORS.cyan) + 'CC'),
        borderColor: priData.map(d => priColorsMap[d.priority] || CHART_COLORS.cyan),
        borderWidth: 2,
        hoverOffset: 6,
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'bottom', labels: { boxWidth: 12, padding: 16, font: { size: 12 } } }
      },
      cutout: '65%'
    }
  });

  // ─── Status chart ───
  const statCtx  = document.getElementById('statusChart').getContext('2d');
  const statData = data.by_status || [];
  const statColorsMap = { 'Pending': CHART_COLORS.orange, 'In Progress': CHART_COLORS.blue, 'Resolved': CHART_COLORS.green, 'Closed': '#94A3C0' };

  new Chart(statCtx, {
    type: 'pie',
    data: {
      labels: statData.map(d => d.status),
      datasets: [{
        data: statData.map(d => d.cnt),
        backgroundColor: statData.map(d => (statColorsMap[d.status] || CHART_COLORS.cyan) + 'BB'),
        borderColor: '#0B1121',
        borderWidth: 3,
        hoverOffset: 6,
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'bottom', labels: { boxWidth: 12, padding: 14, font: { size: 12 } } }
      }
    }
  });

  // Update model accuracy from real stats
  const ms = data.model_stats;
  if (ms) {
    if (ms.category_accuracy) {
      document.getElementById('acc-category').textContent = `${ms.category_accuracy}%`;
      document.getElementById('mab-cat').style.width = `${ms.category_accuracy}%`;
    }
    if (ms.priority_accuracy) {
      document.getElementById('acc-priority').textContent = `${ms.priority_accuracy}%`;
      document.getElementById('mab-pri').style.width = `${ms.priority_accuracy}%`;
    }
    if (ms.queue_accuracy) {
      document.getElementById('acc-queue').textContent = `${ms.queue_accuracy}%`;
      document.getElementById('mab-que').style.width = `${ms.queue_accuracy}%`;
    }
  }
}

function capitalize(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

async function logout() {
  await fetch('/api/logout', { method: 'POST' });
  window.location.href = '/';
}

// ── Init ──
document.addEventListener('DOMContentLoaded', async () => {
  const res = await fetch('/api/me');
  if (res.status === 401) { window.location.href = '/login'; return; }
  const me = await res.json();
  if (!me.authenticated) { window.location.href = '/login'; return; }
  
  // Redirect regular users to their tickets page (analytics is admin-only)
  if (me.user.role !== 'admin') {
    window.location.href = '/my-tickets';
    return;
  }

  const initials = me.user.name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
  document.getElementById('user-initials').textContent = initials;
  document.getElementById('user-name-nav').textContent = me.user.name.split(' ')[0];

  await loadAnalytics();
});
