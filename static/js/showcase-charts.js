/* ============================================================
   SmartDesk — Showcase Charts (Home Page)
   Demo analytics for public viewing
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
  initShowcaseCharts();
});

function initShowcaseCharts() {
  // Chart.js default config
  Chart.defaults.color = '#475569';
  Chart.defaults.borderColor = '#E2E8F0';
  Chart.defaults.font.family = "'Inter', sans-serif";

  // Color palette
  const colors = {
    blue: '#2563EB',
    cyan: '#06B6D4',
    violet: '#7C3AED',
    orange: '#EA580C',
    red: '#DC2626',
    green: '#16A34A',
    yellow: '#EAB308',
  };

  // ─── Category Chart ───
  const categoryCtx = document.getElementById('showcaseCategoryChart');
  if (categoryCtx) {
    new Chart(categoryCtx, {
      type: 'doughnut',
      data: {
        labels: ['Incident', 'Request', 'Problem', 'Change'],
        datasets: [{
          data: [45, 30, 18, 7],
          backgroundColor: [
            colors.blue + 'CC',
            colors.cyan + 'CC',
            colors.violet + 'CC',
            colors.orange + 'CC'
          ],
          borderColor: [colors.blue, colors.cyan, colors.violet, colors.orange],
          borderWidth: 2,
          hoverOffset: 8,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              boxWidth: 12,
              padding: 12,
              font: { size: 11 }
            }
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                return context.label + ': ' + context.parsed + '%';
              }
            }
          }
        },
        cutout: '65%'
      }
    });
  }

  // ─── Priority Chart ───
  const priorityCtx = document.getElementById('showcasePriorityChart');
  if (priorityCtx) {
    new Chart(priorityCtx, {
      type: 'doughnut',
      data: {
        labels: ['High', 'Medium', 'Low'],
        datasets: [{
          data: [25, 55, 20],
          backgroundColor: [
            colors.red + 'CC',
            colors.orange + 'CC',
            colors.green + 'CC'
          ],
          borderColor: [colors.red, colors.orange, colors.green],
          borderWidth: 2,
          hoverOffset: 8,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              boxWidth: 12,
              padding: 12,
              font: { size: 11 }
            }
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                return context.label + ': ' + context.parsed + '%';
              }
            }
          }
        },
        cutout: '65%'
      }
    });
  }

  // ─── Response Time Chart ───
  const timeCtx = document.getElementById('showcaseTimeChart');
  if (timeCtx) {
    new Chart(timeCtx, {
      type: 'bar',
      data: {
        labels: ['Incident', 'Request', 'Problem', 'Change'],
        datasets: [{
          label: 'Hours',
          data: [1.2, 4.5, 8.3, 12.7],
          backgroundColor: (ctx) => {
            const grad = ctx.chart.ctx.createLinearGradient(0, 0, 0, 200);
            grad.addColorStop(0, colors.cyan + 'DD');
            grad.addColorStop(1, colors.cyan + '33');
            return grad;
          },
          borderColor: colors.cyan,
          borderWidth: 2,
          borderRadius: 6,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: function(context) {
                return 'Avg: ' + context.parsed.y + ' hours';
              }
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: function(value) {
                return value + 'h';
              }
            },
            grid: { color: '#F1F5F9' }
          },
          x: { grid: { display: false } }
        }
      }
    });
  }

  // ─── Status Chart (Wide) ───
  const statusCtx = document.getElementById('showcaseStatusChart');
  if (statusCtx) {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    
    new Chart(statusCtx, {
      type: 'line',
      data: {
        labels: days,
        datasets: [
          {
            label: 'Resolved',
            data: [42, 38, 45, 51, 48, 22, 18],
            borderColor: colors.green,
            backgroundColor: (ctx) => {
              const grad = ctx.chart.ctx.createLinearGradient(0, 0, 0, 180);
              grad.addColorStop(0, colors.green + '44');
              grad.addColorStop(1, colors.green + '00');
              return grad;
            },
            fill: true,
            tension: 0.4,
            borderWidth: 2,
          },
          {
            label: 'In Progress',
            data: [15, 18, 20, 16, 19, 8, 6],
            borderColor: colors.blue,
            backgroundColor: (ctx) => {
              const grad = ctx.chart.ctx.createLinearGradient(0, 0, 0, 180);
              grad.addColorStop(0, colors.blue + '44');
              grad.addColorStop(1, colors.blue + '00');
              return grad;
            },
            fill: true,
            tension: 0.4,
            borderWidth: 2,
          },
          {
            label: 'Pending',
            data: [8, 12, 10, 7, 9, 5, 4],
            borderColor: colors.orange,
            backgroundColor: (ctx) => {
              const grad = ctx.chart.ctx.createLinearGradient(0, 0, 0, 180);
              grad.addColorStop(0, colors.orange + '44');
              grad.addColorStop(1, colors.orange + '00');
              return grad;
            },
            fill: true,
            tension: 0.4,
            borderWidth: 2,
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        interaction: {
          mode: 'index',
          intersect: false,
        },
        plugins: {
          legend: {
            position: 'top',
            labels: {
              boxWidth: 12,
              padding: 16,
              font: { size: 11 }
            }
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                return context.dataset.label + ': ' + context.parsed.y + ' tickets';
              }
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: { stepSize: 10 },
            grid: { color: '#F1F5F9' }
          },
          x: { grid: { display: false } }
        }
      }
    });
  }
}
