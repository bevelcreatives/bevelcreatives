/* Analytics page — stats cards + charts */
(() => {
  const API = window.BASE_URL || '';
  const $ = sel => document.querySelector(sel);
  const fromEl = $('#a-from');
  const toEl   = $('#a-to');
  const exportBtn = $('#export-analytics');
  const chips = document.querySelectorAll('.chip');
  let chartA, chartB, chartC, chartD;

  function fmt(n) { return (n ?? 0).toLocaleString(); }
  function params() {
    const p = new URLSearchParams();
    if (fromEl.value) p.set('from', fromEl.value);
    if (toEl.value)   p.set('to',   toEl.value);
    return p;
  }

  async function load() {
    try {
      const [resA, resB, resC] = await Promise.all([
        fetch(API + '/api/analytics?' + params().toString()),
        fetch(API + '/api/button-stats?' + params().toString()),
        fetch(API + '/api/ineligible-choices?' + params().toString()),
      ]);
      if (!resA.ok) throw new Error('HTTP ' + resA.status);
      if (!resB.ok) throw new Error('HTTP ' + resB.status);
      if (!resC.ok) throw new Error('HTTP ' + resC.status);
      const data    = await resA.json();
      const btnData = await resB.json();
      const icData  = await resC.json();

      $('#s-amount').textContent    = fmt(data.total_amount_completed);
      $('#s-orders').textContent    = fmt(data.total_orders);
      $('#s-completed').textContent = fmt(data.total_completed);
      $('#s-cancelled').textContent = fmt(data.total_cancelled);
      $('#s-opened').textContent    = fmt(data.total_orders);
      $('#s-auto').textContent      = fmt(data.total_auto_deleted);
      $('#s-rejected').textContent  = fmt(data.total_rejected);
      $('#s-awaiting').textContent  = fmt(data.total_awaiting);

      const t = btnData.totals || {};
      $('#bs-total').textContent      = fmt(t.total);
      $('#bs-not-joined').textContent = fmt(t.not_joined);
      $('#bs-ineligible').textContent = fmt(t.ineligible);
      $('#bs-eligible').textContent   = fmt(t.eligible);
      $('#bs-not-found').textContent  = fmt(t.not_found);

      const ic = icData.totals || {};
      $('#ic-proceed').textContent = fmt(ic.proceed);
      $('#ic-later').textContent   = fmt(ic.later);

      drawCharts(data, btnData, icData);
    } catch (err) {
      console.error('Analytics load failed:', err);
    }
  }

  function isDark() { return document.documentElement.getAttribute('data-theme') === 'dark'; }
  function gridColor() { return isDark() ? '#30363d' : '#eef1f5'; }
  function tickColor() { return isDark() ? '#8b949e' : '#64748b'; }

  // Returns a fresh options object each call — Chart.js 4.x mutates the object
  // it receives (merges defaults in-place), so sharing one reference across
  // multiple Chart instances causes the second and third to silently fail.
  function chartOpts() {
    return {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { position: 'top', labels: { boxWidth: 10, usePointStyle: true, pointStyle: 'circle', font: { family: 'Inter', size: 12 } } },
        tooltip: { backgroundColor: '#0f172a', padding: 10, titleFont: { family: 'Inter' }, bodyFont: { family: 'Inter' } },
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { family: 'Inter', size: 11 }, color: tickColor(), maxRotation: 0, autoSkip: true, maxTicksLimit: 12 } },
        y: { grid: { color: gridColor() }, ticks: { font: { family: 'Inter', size: 11 }, color: tickColor() }, beginAtZero: true },
      },
      elements: { line: { tension: 0.3, borderWidth: 2 }, point: { radius: 2, hoverRadius: 5 } },
    };
  }

  function drawCharts(data, btnData, icData) {
    const labels = data.days;
    if (chartA) chartA.destroy();
    if (chartB) chartB.destroy();
    if (chartC) chartC.destroy();
    if (chartD) chartD.destroy();

    chartA = new Chart(document.getElementById('chart-amount').getContext('2d'), {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Amount (Robux)',
          data: data.series.amount,
          borderColor: '#0b6e4f',
          backgroundColor: 'rgba(11,110,79,0.12)',
          fill: true,
        }],
      },
      options: chartOpts(),
    });

    chartB = new Chart(document.getElementById('chart-counts').getContext('2d'), {
      type: 'line',
      data: {
        labels,
        datasets: [
          { label: 'Opened',       data: data.series.opened,       borderColor: '#1d4ed8', backgroundColor: 'rgba(29,78,216,0.1)',  fill: false },
          { label: 'Completed',    data: data.series.completed,    borderColor: '#059669', backgroundColor: 'rgba(5,150,105,0.1)',  fill: false },
          { label: 'Cancelled',    data: data.series.cancelled,    borderColor: '#dc2626', backgroundColor: 'rgba(220,38,38,0.1)',  fill: false },
          { label: 'Rejected',     data: data.series.rejected,     borderColor: '#9333ea', backgroundColor: 'rgba(147,51,234,0.1)', fill: false },
          { label: 'Auto-deleted', data: data.series.auto_deleted, borderColor: '#b45309', backgroundColor: 'rgba(180,83,9,0.1)',   fill: false },
        ],
      },
      options: chartOpts(),
    });

    const btnLabels = btnData.days || [];
    const s = btnData.series || {};
    chartC = new Chart(document.getElementById('chart-button-clicks').getContext('2d'), {
      type: 'bar',
      data: {
        labels: btnLabels,
        datasets: [
          { label: 'Not In Group',     data: s.not_joined  || [], backgroundColor: 'rgba(220,38,38,0.75)',   stack: 'a' },
          { label: 'Not Eligible Yet', data: s.ineligible  || [], backgroundColor: 'rgba(180,83,9,0.75)',    stack: 'a' },
          { label: 'Eligible',         data: s.eligible    || [], backgroundColor: 'rgba(5,150,105,0.75)',   stack: 'a' },
          { label: 'Not Found',        data: s.not_found   || [], backgroundColor: 'rgba(100,116,139,0.65)', stack: 'a' },
        ],
      },
      options: {
        ...chartOpts(),
        scales: {
          x: { stacked: true, grid: { display: false }, ticks: { font: { family: 'Inter', size: 11 }, color: tickColor(), maxRotation: 0, autoSkip: true, maxTicksLimit: 12 } },
          y: { stacked: true, grid: { color: gridColor() }, ticks: { font: { family: 'Inter', size: 11 }, color: tickColor() }, beginAtZero: true },
        },
      },
    });

    const icLabels = icData.days || [];
    const ic = icData.series || {};
    chartD = new Chart(document.getElementById('chart-ineligible-choices').getContext('2d'), {
      type: 'bar',
      data: {
        labels: icLabels,
        datasets: [
          { label: 'Proceeded',   data: ic.proceed || [], backgroundColor: 'rgba(5,150,105,0.75)',  stack: 'a' },
          { label: 'Bought Later', data: ic.later  || [], backgroundColor: 'rgba(220,38,38,0.75)', stack: 'a' },
        ],
      },
      options: {
        ...chartOpts(),
        scales: {
          x: { stacked: true, grid: { display: false }, ticks: { font: { family: 'Inter', size: 11 }, color: tickColor(), maxRotation: 0, autoSkip: true, maxTicksLimit: 12 } },
          y: { stacked: true, grid: { color: gridColor() }, ticks: { font: { family: 'Inter', size: 11 }, color: tickColor() }, beginAtZero: true },
        },
      },
    });
  }

  function activateChip(btn) {
    chips.forEach(c => c.classList.remove('active'));
    if (btn) btn.classList.add('active');
  }
  chips.forEach(btn => {
    btn.addEventListener('click', () => {
      activateChip(btn);
      const r = btn.dataset.range;
      if (r === 'all') {
        fromEl.value = ''; toEl.value = '';
      } else {
        const days = parseInt(r, 10);
        const to = new Date().toISOString().slice(0, 10);
        const from = new Date(Date.now() - (days - 1) * 86400000).toISOString().slice(0, 10);
        fromEl.value = from; toEl.value = to;
      }
      load();
    });
  });

  [fromEl, toEl].forEach(el => el.addEventListener('change', () => { activateChip(null); load(); }));
  document.getElementById('theme-toggle').addEventListener('click', () => load());
  exportBtn.addEventListener('click', (e) => { e.preventDefault(); window.location.href = API + '/export/analytics.xlsx?' + params().toString(); });

  document.querySelector('.chip[data-range="30"]').click();
})();
