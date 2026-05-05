/* Orders page — table, filters, detail modal, export, bulk verify */
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
  const verifyBtn   = $('#verify-btn');
  const verifyCount = $('#verify-count');
  const verifyModal = $('#verify-modal');
  const verifySummary  = $('#verify-summary');
  const verifyList     = $('#verify-list');
  const verifyConfirm  = $('#verify-confirm');
  const verifyResult   = $('#verify-result');
  const verifyResultList = $('#verify-result-list');
  const selAll  = $('#sel-all');
  let clearTimer = null;
  let clearSecondsLeft = 0;

  // Orders that are selectable (active tickets the bot can complete)
  const SELECTABLE_STATUSES = new Set(['open', 'awaiting_review']);
  // Map order# -> order data, populated on each render
  let renderedOrders = {};
  // Currently checked order numbers
  const selected = new Set();

  function updateVerifyBtn() {
    const n = selected.size;
    verifyCount.textContent = n;
    verifyBtn.disabled = n === 0;
  }

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
    tbody.innerHTML = '<tr class="no-hover"><td colspan="7" class="muted muted-center">Loading…</td></tr>';
    try {
      const res = await fetch(API + '/api/orders?' + params().toString());
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      render(data.orders);
      countEl.textContent = `${data.count} order${data.count === 1 ? '' : 's'}`;
    } catch (err) {
      tbody.innerHTML = `<tr class="no-hover"><td colspan="7" class="muted muted-center">Failed to load: ${escapeHtml(err.message)}</td></tr>`;
    }
  }

  function render(orders) {
    renderedOrders = {};
    if (!orders.length) {
      // Clear any stale selections when results change
      selected.clear();
      updateVerifyBtn();
      selAll.checked = false;
      selAll.indeterminate = false;
      tbody.innerHTML = '<tr class="no-hover"><td colspan="7" class="muted muted-center">No orders match your filters.</td></tr>';
      return;
    }
    orders.forEach(o => { renderedOrders[o.order] = o; });

    tbody.innerHTML = orders.map(o => {
      const canSelect = SELECTABLE_STATUSES.has(o.status);
      const isChecked = selected.has(o.order);
      const chk = canSelect
        ? `<input type="checkbox" class="row-sel" value="${o.order}"${isChecked ? ' checked' : ''}>`
        : '';
      return `
      <tr data-order="${o.order}">
        <td class="sel-col" data-no-open>${chk}</td>
        <td class="mono">${escapeHtml(o.created_at_display || '—')}</td>
        <td>${o.roblox_edited ? '📝 ' : ''}${escapeHtml(o.roblox || '—')}${o.roblox_display_name && o.roblox_display_name !== o.roblox ? '<br><span class="muted" style="font-size:0.82em">' + escapeHtml(o.roblox_display_name) + '</span>' : ''}</td>
        <td class="num">${o.amount_edited ? '📝 ' : ''}${fmtNum(o.amount)}</td>
        <td>${escapeHtml(o.discord_name || '—')}</td>
        <td><span class="badge badge-${o.status}">${escapeHtml(o.status_label)}</span></td>
        <td class="muted">#${o.order}</td>
      </tr>`;
    }).join('');

    // Row click → detail (but not on the checkbox cell)
    tbody.querySelectorAll('tr[data-order]').forEach(tr => {
      tr.addEventListener('click', e => {
        if (e.target.closest('[data-no-open]')) return;
        openDetail(tr.dataset.order);
      });
    });

    // Checkbox change
    tbody.querySelectorAll('.row-sel').forEach(chk => {
      chk.addEventListener('change', () => {
        const n = parseInt(chk.value, 10);
        if (chk.checked) selected.add(n); else selected.delete(n);
        syncSelAll();
        updateVerifyBtn();
      });
    });

    syncSelAll();
    updateVerifyBtn();
  }

  function syncSelAll() {
    const selectableInView = [...tbody.querySelectorAll('.row-sel')];
    if (!selectableInView.length) {
      selAll.checked = false;
      selAll.indeterminate = false;
      return;
    }
    const checkedCount = selectableInView.filter(c => c.checked).length;
    selAll.indeterminate = checkedCount > 0 && checkedCount < selectableInView.length;
    selAll.checked = checkedCount === selectableInView.length;
  }

  selAll.addEventListener('change', () => {
    const boxes = [...tbody.querySelectorAll('.row-sel')];
    boxes.forEach(c => {
      c.checked = selAll.checked;
      const n = parseInt(c.value, 10);
      if (selAll.checked) selected.add(n); else selected.delete(n);
    });
    syncSelAll();
    updateVerifyBtn();
  });

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
    if (clearTimer) { clearInterval(clearTimer); clearTimer = null; }
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

  // ── Verify Selected ──────────────────────────────────────────
  function closeVerifyModal() {
    verifyModal.hidden = true;
    $('#verify-body').hidden = false;
    verifyResult.hidden = true;
    verifyConfirm.disabled = false;
    verifyConfirm.textContent = 'Complete All';
  }

  function openVerifyModal() {
    const orders = [...selected].sort((a,b) => a - b);
    verifySummary.textContent =
      `You are about to complete ${orders.length} order${orders.length === 1 ? '' : 's'}. This will DM each user and delete the ticket channels.`;
    verifyList.innerHTML = orders.map(n => {
      const o = renderedOrders[n];
      return `<li>#${n}${o ? ` — ${escapeHtml(o.roblox || '')} · ${fmtNum(o.amount)} Robux · ${escapeHtml(o.discord_name || '')}` : ''}</li>`;
    }).join('');
    $('#verify-body').hidden = false;
    verifyResult.hidden = true;
    verifyConfirm.disabled = false;
    verifyConfirm.textContent = 'Complete All';
    verifyModal.hidden = false;
  }

  verifyBtn.addEventListener('click', openVerifyModal);
  verifyModal.querySelectorAll('[data-verify-close]').forEach(el =>
    el.addEventListener('click', closeVerifyModal));
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !verifyModal.hidden) closeVerifyModal();
  });

  verifyConfirm.addEventListener('click', async () => {
    const orders = [...selected];
    verifyConfirm.disabled = true;
    verifyConfirm.textContent = 'Completing…';
    try {
      const res = await fetch(API + '/api/bulk-complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orders }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = data.message || data.error || `HTTP ${res.status}`;
        window.alert(`Error: ${msg}`);
        verifyConfirm.disabled = false;
        verifyConfirm.textContent = 'Complete All';
        return;
      }
      // Show results
      const results = data.results || [];
      verifyResultList.innerHTML = results.map(r =>
        r.ok
          ? `<li>✅ #${r.order} — completed`
          : `<li>❌ #${r.order} — ${escapeHtml(r.error || 'failed')}`
      ).join('');
      $('#verify-body').hidden = true;
      verifyResult.hidden = false;
      // Clear selections for completed orders
      results.filter(r => r.ok).forEach(r => selected.delete(r.order));
      updateVerifyBtn();
      // Reload list in background
      loadOrders();
    } catch (err) {
      window.alert(`Request failed: ${err.message}`);
      verifyConfirm.disabled = false;
      verifyConfirm.textContent = 'Complete All';
    }
  });

  // ── Debounced filter listeners ────────────────────────────────
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
