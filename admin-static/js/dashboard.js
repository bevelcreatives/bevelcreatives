/* Orders page — table, filters, detail modal, export */
(() => {
  const API = window.BASE_URL || '';
  const $  = sel => document.querySelector(sel);
  const tbody   = $('#orders-body');
  const qEl     = $('#f-q');
  const stEl    = $('#f-status');
  const fromEl  = $('#f-from');
  const toEl    = $('#f-to');
  const clearEl = $('#f-clear');
  const countEl = $('#orders-count');
  const exportBtn = $('#export-btn');
  const modal   = $('#detail-modal');
  const modalBody = $('#detail-body');
  const modalTitle = $('#detail-title');
  const clearModal = $('#clear-modal');
  const clearCountdown = $('#clear-countdown');
  const clearConfirmBtn = $('#clear-confirm');
  let clearTimer = null;
  let clearSecondsLeft = 0;

  function params() {
    const p = new URLSearchParams();
    if (qEl.value)    p.set('q', qEl.value);
    if (stEl.value)   p.set('status', stEl.value);
    if (fromEl.value) p.set('from', fromEl.value);
    if (toEl.value)   p.set('to', toEl.value);
    return p;
  }

  function fmtNum(n) { return (n ?? 0).toLocaleString(); }
  function escapeHtml(s) {
    return (s ?? '').toString()
      .replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')
      .replaceAll('"','&quot;').replaceAll("'",'&#39;');
  }

  async function loadOrders() {
    tbody.innerHTML = '<tr class="no-hover"><td colspan="6" class="muted muted-center">Loading…</td></tr>';
    try {
      const res = await fetch(API + '/api/orders?' + params().toString());
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      render(data.orders);
      countEl.textContent = `${data.count} order${data.count === 1 ? '' : 's'}`;
    } catch (err) {
      tbody.innerHTML = `<tr class="no-hover"><td colspan="6" class="muted muted-center">Failed to load: ${escapeHtml(err.message)}</td></tr>`;
    }
  }

  function render(orders) {
    if (!orders.length) {
      tbody.innerHTML = '<tr class="no-hover"><td colspan="6" class="muted muted-center">No orders match your filters.</td></tr>';
      return;
    }
    tbody.innerHTML = orders.map(o => `
      <tr data-order="${o.order}">
        <td class="mono">${escapeHtml(o.created_at_display || '—')}</td>
        <td>${o.roblox_edited ? '📝 ' : ''}${escapeHtml(o.roblox || '—')}${o.roblox_display_name && o.roblox_display_name !== o.roblox ? '<br><span class="muted" style="font-size:0.82em">' + escapeHtml(o.roblox_display_name) + '</span>' : ''}</td>
        <td class="num">${o.amount_edited ? '📝 ' : ''}${fmtNum(o.amount)}</td>
        <td>${escapeHtml(o.discord_name || '—')}</td>
        <td><span class="badge badge-${o.status}">${escapeHtml(o.status_label)}</span></td>
        <td class="muted">#${o.order}</td>
      </tr>
    `).join('');
    tbody.querySelectorAll('tr[data-order]').forEach(tr => {
      tr.addEventListener('click', () => openDetail(tr.dataset.order));
    });
  }

  async function openDetail(orderNo) {
    modalTitle.textContent = `Order #${orderNo}`;
    modalBody.innerHTML = '<div class="muted">Loading…</div>';
    modal.hidden = false;
    try {
      const res = await fetch(API + '/api/order/' + orderNo);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const o = await res.json();
      renderDetail(o);
    } catch (err) {
      modalBody.innerHTML = `<div class="muted">Failed to load: ${escapeHtml(err.message)}</div>`;
    }
  }

  function renderDetail(o) {
    modalTitle.innerHTML = `Order #${o.order} &nbsp; <span class="badge badge-${o.status}">${escapeHtml(o.status_label)}</span>`;
    const items = [
      ['Roblox Username',    (o.roblox_edited ? '📝 ' : '') + (o.roblox || '—')],
      ['Roblox DisplayName', o.roblox_display_name || o.roblox || '—'],
      ['Amount (Robux)',     (o.amount_edited ? '📝 ' : '') + fmtNum(o.amount)],
      ['Discord Username',   o.discord_name],
      ['Discord User ID',    o.discord_user_id],
      ['Ticket Opened',      o.created_at_display],
      ['Payment Received',   o.screenshot_at_display || '—'],
      ['Completed',          o.completed_at_display || '—'],
      ['Cancelled',          o.cancelled_at_display || '—'],
      ['Rejected',           o.rejected_at_display  || '—'],
      ['Auto-Deleted',       o.auto_deleted_at_display || '—'],
      ['Pre-Order',          o.is_preorder ? 'Yes' : 'No'],
      ['Eligible On',        o.eligible_on || '—'],
      ['Channel ID',         o.channel_id  || '—'],
    ];
    const gridHTML = items.map(([k, v]) => `
      <div class="detail-item">
        <div class="detail-label">${escapeHtml(k)}</div>
        <div class="detail-value ${/ID|Channel/.test(k) ? 'mono' : ''}">${escapeHtml(v || '—')}</div>
      </div>
    `).join('');

    const screenshotUrl = o.screenshot_display_url || o.screenshot_log_url || o.screenshot_url;
    const screenshotRedirectUrl = API + `/api/order/${encodeURIComponent(o.order)}/screenshot`;
    const screenshotHTML = screenshotUrl ? `
      <div class="detail-screenshot">
        <img src="${escapeHtml(screenshotRedirectUrl)}" alt="Payment screenshot" onerror="this.style.display='none';this.nextElementSibling.textContent='Screenshot URL could not be loaded (Discord CDN links may expire).';"/>
        <a href="${escapeHtml(screenshotRedirectUrl)}" target="_blank" rel="noopener">${escapeHtml(screenshotUrl)}</a>
      </div>
    ` : '<div class="muted" style="margin:14px 0;">No payment screenshot on record.</div>';

    const auditHTML = (o.log_history && o.log_history.length) ? `
      <div class="audit">
        <h4>Audit Log</h4>
        <ul class="audit-list">
          ${o.log_history.map(ev => `<li class="audit-item">${escapeHtml(ev)}</li>`).join('')}
        </ul>
      </div>
    ` : '<div class="audit"><h4>Audit Log</h4><div class="muted">No events recorded.</div></div>';

    modalBody.innerHTML = `<div class="detail-grid">${gridHTML}</div>${screenshotHTML}${auditHTML}`;
  }

  function closeModal(){ modal.hidden = true; modalBody.innerHTML=''; }
  modal.querySelectorAll('[data-close]').forEach(el => el.addEventListener('click', closeModal));
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !modal.hidden) closeModal(); });

  function closeClearModal() {
    clearModal.hidden = true;
    clearConfirmBtn.disabled = true;
    if (clearTimer) {
      clearInterval(clearTimer);
      clearTimer = null;
    }
  }

  function openClearModal() {
    clearModal.hidden = false;
    clearConfirmBtn.disabled = true;
    clearSecondsLeft = 3;
    clearCountdown.textContent = `Please wait ${clearSecondsLeft} seconds before confirming.`;
    if (clearTimer) clearInterval(clearTimer);
    clearTimer = setInterval(() => {
      clearSecondsLeft -= 1;
      if (clearSecondsLeft <= 0) {
        clearInterval(clearTimer);
        clearTimer = null;
        clearCountdown.textContent = 'You can now confirm the clear action.';
        clearConfirmBtn.disabled = false;
        return;
      }
      clearCountdown.textContent = `Please wait ${clearSecondsLeft} seconds before confirming.`;
    }, 1000);
  }

  async function clearData() {
    const key = window.prompt('Enter the 4-digit key to clear the stored data:');
    if (key === null) return;
    try {
      const res = await fetch(API + '/api/clear-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: key.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error === 'invalid_key' ? 'Invalid key.' : `HTTP ${res.status}`);
      }
      closeClearModal();
      await loadOrders();
    } catch (err) {
      window.alert(`Failed to clear data: ${err.message}`);
    }
  }

  // Debounced filter listeners
  let t;
  function onChange() { clearTimeout(t); t = setTimeout(loadOrders, 220); }
  [qEl, stEl, fromEl, toEl].forEach(el => el.addEventListener('input', onChange));
  clearEl.addEventListener('click', openClearModal);
  clearModal.querySelectorAll('[data-clear-close]').forEach(el => el.addEventListener('click', closeClearModal));
  clearConfirmBtn.addEventListener('click', clearData);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !clearModal.hidden) closeClearModal();
  });

  exportBtn.addEventListener('click', (e) => {
    e.preventDefault();
    window.location.href = API + '/export/orders.xlsx?' + params().toString();
  });

  loadOrders();
})();
