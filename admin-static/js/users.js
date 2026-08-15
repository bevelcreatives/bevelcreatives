/* User lookup page — per-username totals + orders list + detail panel */
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

  // Split-panel elements (same pattern as the Orders page)
  const splitWrap    = $('#user-split');
  const panelRight    = $('#user-panel-right');
  const detailBody    = $('#user-detail-body');
  const detailTitle   = $('#user-detail-title');
  const detailClose   = $('#user-detail-close');

  // Track which order row is currently selected
  let activeOrderNo = null;

  function fmt(n) { return (n ?? 0).toLocaleString(); }
  function escapeHtml(s) {
    return (s ?? '').toString()
      .replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')
      .replaceAll('"','&quot;').replaceAll("'",'&#39;');
  }

  // ── Open / close detail panel ──────────────────────────────
  function openPanel() {
    panelRight.hidden = false;
    splitWrap.classList.add('panel-open');
  }

  function closePanel() {
    panelRight.hidden = true;
    splitWrap.classList.remove('panel-open');
    activeOrderNo = null;
    ordersBody.querySelectorAll('tr.active-row').forEach(r => r.classList.remove('active-row'));
  }

  detailClose.addEventListener('click', closePanel);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !panelRight.hidden) closePanel();
  });

  // ── Open detail for a specific order ───────────────────────
  async function openDetail(orderNo, clickedRow) {
    if (activeOrderNo == orderNo && !panelRight.hidden) {
      closePanel();
      return;
    }

    activeOrderNo = parseInt(orderNo, 10);

    ordersBody.querySelectorAll('tr.active-row').forEach(r => r.classList.remove('active-row'));
    if (clickedRow) clickedRow.classList.add('active-row');

    detailTitle.textContent = `Order #${orderNo}`;
    detailBody.innerHTML = '<div class="muted muted-center" style="padding:32px 0;">Loading…</div>';
    openPanel();

    try {
      const res = await fetch(API + '/api/order/' + orderNo);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const o = await res.json();
      renderDetail(o);
    } catch (err) {
      detailBody.innerHTML = `<div class="muted muted-center" style="padding:32px 0;">Failed to load: ${escapeHtml(err.message)}</div>`;
    }
  }

  // ── Render detail panel content (mirrors the Orders page) ──
  function renderDetail(o) {
    detailTitle.innerHTML =
      `Order #${o.order} &nbsp;<span class="badge badge-${o.status}">${escapeHtml(o.status_label)}</span>`;

    const items = [
      ['Roblox Username',    (o.roblox_edited ? '📝 ' : '') + (o.roblox || '—'), false],
      ['Display Name',       o.roblox_display_name || o.roblox || '—',           false],
      ['Amount (Robux)',     (o.amount_edited ? '📝 ' : '') + fmt(o.amount),     false],
      ['Discord Username',   o.discord_name,                                      false],
      ['Discord User ID',    o.discord_user_id,                                   true ],
      ['Ticket Opened',      o.created_at_display,                                true ],
      ['Payment Received',   o.screenshot_at_display || '—',                      true ],
      ['Completed',          o.completed_at_display  || '—',                      true ],
      ['Cancelled',          o.cancelled_at_display  || '—',                      true ],
      ['Rejected',           o.rejected_at_display   || '—',                      true ],
      ['Auto-Deleted',       o.auto_deleted_at_display || '—',                    true ],
      ['Pre-Order',          o.is_preorder ? 'Yes' : 'No',                        false],
      ['Eligible On',        o.eligible_on || '—',                                false],
      ['Channel ID',         o.channel_id  || '—',                                true ],
    ];

    const gridHTML = items.map(([k, v, mono]) => `
      <div class="detail-item">
        <div class="detail-label">${escapeHtml(k)}</div>
        <div class="detail-value ${mono ? 'mono' : ''}">${escapeHtml(v || '—')}</div>
      </div>
    `).join('');

    const screenshotUrl = o.screenshot_display_url || o.screenshot_log_url || o.screenshot_url;
    const screenshotRedirectUrl = API + `/api/order/${encodeURIComponent(o.order)}/screenshot`;
    const screenshotHTML = screenshotUrl ? `
      <div class="detail-screenshot">
        <img
          src="${escapeHtml(screenshotRedirectUrl)}"
          alt="Payment screenshot"
          onerror="this.style.display='none';this.nextElementSibling.style.display='block';"
        />
        <div class="screenshot-error muted" style="display:none;padding:10px 0;font-size:13px;">
          Screenshot could not be loaded (Discord CDN links may expire).
        </div>
        <a href="${escapeHtml(screenshotRedirectUrl)}" target="_blank" rel="noopener">
          View full screenshot ↗
        </a>
      </div>
    ` : '<div class="muted" style="margin:14px 0;font-size:13px;">No payment screenshot on record.</div>';

    const auditHTML = (o.log_history && o.log_history.length) ? `
      <div class="audit">
        <h4>Ticket History</h4>
        <ul class="audit-list">
          ${o.log_history.map(ev => `<li class="audit-item">${escapeHtml(ev)}</li>`).join('')}
        </ul>
      </div>
    ` : `
      <div class="audit">
        <h4>Ticket History</h4>
        <div class="muted" style="font-size:13px;">No events recorded.</div>
      </div>
    `;

    detailBody.innerHTML = `
      <div class="detail-grid">${gridHTML}</div>
      <div class="detail-section-label">Screenshot</div>
      ${screenshotHTML}
      ${auditHTML}
    `;
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
    closePanel();
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
        <tr data-order="${o.order}">
          <td class="mono">${escapeHtml(o.created_at_display || '—')}</td>
          <td>${escapeHtml(o.roblox || '—')}</td>
          <td class="num">${fmt(o.amount)}</td>
          <td>${escapeHtml(o.discord_name || '—')}</td>
          <td><span class="badge badge-${o.status}">${escapeHtml(o.status_label || o.status)}</span></td>
          <td class="muted col-order-num">#${o.order}</td>
        </tr>
      `).join('');
      ordersBody.querySelectorAll('tr[data-order]').forEach(tr => {
        tr.addEventListener('click', () => openDetail(tr.dataset.order, tr));
      });
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
