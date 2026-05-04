/* User lookup page — per-username totals + orders list + leaderboard */
(() => {
  const API = window.BASE_URL || '';
  const $ = sel => document.querySelector(sel);
  const qEl = $('#u-q');
  const fromEl = $('#u-from');
  const toEl = $('#u-to');
  const searchBtn = $('#u-search');
  const exportBtn = $('#export-user');
  const summary = $('#user-summary');
  const ordersCard = $('#user-orders-card');
  const ordersBody = $('#user-orders-body');
  const empty = $('#user-empty');

  function fmt(n) { return (n ?? 0).toLocaleString(); }
  function escapeHtml(s) {
    return (s ?? '').toString()
      .replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')
      .replaceAll('"','&quot;').replaceAll("'",'&#39;');
  }

  // ── User search ──────────────────────────────────────────────
  function searchParams() {
    const p = new URLSearchParams();
    if (qEl.value)    p.set('q', qEl.value);
    if (fromEl.value) p.set('from', fromEl.value);
    if (toEl.value)   p.set('to',   toEl.value);
    return p;
  }

  async function run() {
    if (!qEl.value.trim()) return;
    summary.hidden = true;
    ordersCard.hidden = true;
    empty.hidden = true;
    try {
      const res = await fetch(API + '/api/user?' + searchParams().toString());
      const data = await res.json();
      const t = data.totals || {};
      $('#u-total-amount').textContent    = fmt(t.amount_total_completed);
      $('#u-total-orders').textContent    = fmt(t.orders);
      $('#u-total-completed').textContent = fmt(t.completed);
      $('#u-total-cancelled').textContent = fmt(t.cancelled);
      summary.hidden = false;

      if (!data.matches.length) {
        empty.hidden = false;
        return;
      }
      ordersBody.innerHTML = data.matches.map(o => `
        <tr>
          <td class="mono">${escapeHtml(o.created_at_display || '—')}</td>
          <td>${escapeHtml(o.roblox || '—')}</td>
          <td class="num">${fmt(o.amount)}</td>
          <td>${escapeHtml(o.discord_name || '—')}</td>
          <td><span class="badge badge-${o.status}">${escapeHtml(o.status_label || o.status)}</span></td>
        </tr>
      `).join('');
      ordersCard.hidden = false;
    } catch (err) {
      empty.textContent = 'Failed to load: ' + err.message;
      empty.hidden = false;
    }
  }

  searchBtn.addEventListener('click', run);
  qEl.addEventListener('keydown', e => { if (e.key === 'Enter') run(); });
  exportBtn.addEventListener('click', (e) => {
    e.preventDefault();
    if (!qEl.value.trim()) { alert('Enter a username or ID first.'); return; }
    window.location.href = API + '/export/user.xlsx?' + searchParams().toString();
  });

})();
