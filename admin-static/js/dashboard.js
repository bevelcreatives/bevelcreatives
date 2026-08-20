/* Orders page — split panel layout: table left, detail right */
(() => {
  const API = window.BASE_URL || '';
  const $  = sel => document.querySelector(sel);

  const tbody        = $('#orders-body');
  const qEl          = $('#f-q');
  const stEl         = $('#f-status');
  const fromEl       = $('#f-from');
  const toEl         = $('#f-to');
  const clearEl      = $('#f-clear');
  const countEl      = $('#orders-count');
  const exportBtn    = $('#export-btn');

  // Split-panel elements
  const splitWrap    = $('#orders-split');
  const panelRight   = $('#orders-panel-right');
  const detailBody   = $('#detail-body');
  const detailTitle  = $('#detail-title');
  const detailClose  = $('#detail-close');

  // Clear modal
  const clearModal      = $('#clear-modal');
  const clearCountdown  = $('#clear-countdown');
  const clearConfirmBtn = $('#clear-confirm');
  let clearTimer = null;
  let clearSecondsLeft = 0;

  // Track which order row is currently selected
  let activeOrderNo = null;

  // Bulk complete
  const bulkBtn          = $('#bulk-complete-btn');
  const bulkCountEl      = $('#bulk-complete-count');
  const bulkModal        = $('#bulk-modal');
  const bulkConfirmView  = $('#bulk-confirm-view');
  const bulkProgressView = $('#bulk-progress-view');
  const bulkResultView   = $('#bulk-result-view');
  const bulkConfirmText  = $('#bulk-confirm-text');
  const bulkConfirmBtn   = $('#bulk-confirm');
  const bulkResultText   = $('#bulk-result-text');
  let selectedOrders = new Set();
  let bulkInProgress = false;

  // ── Helpers ────────────────────────────────────────────────
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
      .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;').replaceAll("'", '&#39;');
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
    // Remove active highlight from all rows
    tbody.querySelectorAll('tr.active-row').forEach(r => r.classList.remove('active-row'));
  }

  detailClose.addEventListener('click', closePanel);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !panelRight.hidden) closePanel();
  });

  // ── Load orders table ──────────────────────────────────────
  async function loadOrders() {
    tbody.innerHTML = '<tr class="no-hover"><td colspan="7" class="muted muted-center">Loading…</td></tr>';
    try {
      const res = await fetch(API + '/api/orders?' + params().toString());
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      render(data.orders);
      countEl.textContent = `${data.count} order${data.count === 1 ? '' : 's'}`;

      // Re-select the active row if panel is still open
      if (activeOrderNo !== null) {
        const activeRow = tbody.querySelector(`tr[data-order="${activeOrderNo}"]`);
        if (activeRow) activeRow.classList.add('active-row');
      }
    } catch (err) {
      tbody.innerHTML = `<tr class="no-hover"><td colspan="7" class="muted muted-center">Failed to load: ${escapeHtml(err.message)}</td></tr>`;
    }
  }

  function render(orders) {
    if (!orders.length) {
      tbody.innerHTML = '<tr class="no-hover"><td colspan="7" class="muted muted-center">No orders match your filters.</td></tr>';
      return;
    }
    tbody.innerHTML = orders.map(o => `
      <tr data-order="${o.order}" class="${o.order === activeOrderNo ? 'active-row' : ''}">
        <td class="mono">${escapeHtml(o.created_at_display || '—')}</td>
        <td>${o.is_test ? '🧪 ' : ''}${o.edited ? '📝 ' : ''}${escapeHtml(o.roblox || '—')}</td>
        <td class="num">${fmtNum(o.amount)}</td>
        <td>${escapeHtml(o.discord_name || '—')}</td>
        <td><span class="badge badge-${o.status}">${escapeHtml(o.status_label)}</span></td>
        <td class="muted col-order-num">#${o.order}</td>
        <td class="td-check">
          ${o.status === 'awaiting_review'
            ? `<input type="checkbox" data-check="${o.order}" ${selectedOrders.has(o.order) ? 'checked' : ''} title="Select for bulk complete"/>`
            : ''}
        </td>
      </tr>
    `).join('');

    tbody.querySelectorAll('tr[data-order]').forEach(tr => {
      tr.addEventListener('click', () => openDetail(tr.dataset.order, tr));
    });
    tbody.querySelectorAll('input[data-check]').forEach(cb => {
      cb.addEventListener('click', e => e.stopPropagation());
      cb.addEventListener('change', () => toggleSelect(parseInt(cb.dataset.check, 10), cb.checked));
    });
  }

  // ── Open detail for a specific order ───────────────────────
  async function openDetail(orderNo, clickedRow) {
    // If clicking the already-active order, close the panel
    if (activeOrderNo == orderNo && !panelRight.hidden) {
      closePanel();
      return;
    }

    activeOrderNo = parseInt(orderNo, 10);

    // Highlight the clicked row, remove highlight from others
    tbody.querySelectorAll('tr.active-row').forEach(r => r.classList.remove('active-row'));
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

  // ── Render detail panel content ────────────────────────────
  function renderDetail(o) {
    detailTitle.innerHTML =
      `Order #${o.order} &nbsp;<span class="badge badge-${o.status}">${escapeHtml(o.status_label)}</span>`;

    // Info rows
    const items = [
      ['Roblox Username',    (o.is_test ? '🧪 ' : '') + (o.edited ? '📝 ' : '') + (o.roblox || '—'), false],
      ['Display Name',       o.roblox_display_name || o.roblox || '—',           false],
      ['Amount (Robux)',     fmtNum(o.amount),                                    false],
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

    // Screenshot
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

    // Audit log / ticket history
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

  // ── Clear data modal ───────────────────────────────────────
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
        clearInterval(clearTimer); clearTimer = null;
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
      if (!res.ok) throw new Error(data.error === 'invalid_key' ? 'Invalid key.' : `HTTP ${res.status}`);
      closeClearModal();
      closePanel();
      await loadOrders();
    } catch (err) {
      window.alert(`Failed to clear data: ${err.message}`);
    }
  }

  clearEl.addEventListener('click', openClearModal);
  clearModal.querySelectorAll('[data-clear-close]').forEach(el => el.addEventListener('click', closeClearModal));
  clearConfirmBtn.addEventListener('click', clearData);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !clearModal.hidden) closeClearModal();
  });

  // ── Bulk complete ──────────────────────────────────────────
  function toggleSelect(orderNo, checked) {
    if (checked) selectedOrders.add(orderNo);
    else selectedOrders.delete(orderNo);
    updateBulkButton();
  }

  function updateBulkButton() {
    const n = selectedOrders.size;
    bulkBtn.hidden = n === 0;
    bulkCountEl.textContent = n || '';
  }

  function openBulkModal() {
    if (!selectedOrders.size) return;
    bulkConfirmView.hidden = false;
    bulkProgressView.hidden = true;
    bulkResultView.hidden = true;
    const n = selectedOrders.size;
    bulkConfirmText.textContent = `Complete ${n} selected order${n === 1 ? '' : 's'}?`;
    bulkModal.hidden = false;
  }

  function closeBulkModal() {
    if (bulkInProgress) return; // don't allow closing mid-flight
    bulkModal.hidden = true;
  }

  async function submitBulkComplete() {
    const orders = Array.from(selectedOrders);
    bulkInProgress = true;
    bulkConfirmView.hidden = true;
    bulkProgressView.hidden = false;

    try {
      const res = await fetch(API + '/api/bulk-complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orders }),
      });
      const d = await res.json().catch(() => ({}));
      bulkInProgress = false;
      if (!res.ok || d.error) {
        showBulkResult(null, d.message || d.error || `HTTP ${res.status}`);
        return;
      }
      showBulkResult(d.results || []);
    } catch (err) {
      bulkInProgress = false;
      showBulkResult(null, `Failed to submit: ${err.message}`);
    }
  }

  function showBulkResult(results, errorMsg) {
    bulkProgressView.hidden = true;
    bulkResultView.hidden = false;

    if (errorMsg) {
      bulkResultText.innerHTML = `<p class="bulk-result-bad">${escapeHtml(errorMsg)}</p>`;
    } else {
      const ok = results.filter(r => r.ok);
      const bad = results.filter(r => !r.ok);
      const ERROR_LABELS = {
        not_found: 'no longer an active ticket',
        no_screenshot: 'no payment screenshot on record',
        guild_not_found: 'server could not be resolved',
      };
      let html = `<p><strong>${ok.length}</strong> completed${bad.length ? `, <strong>${bad.length}</strong> failed` : ''}.</p>`;
      if (bad.length) {
        html += '<ul class="bulk-result-list">' + bad.map(r =>
          `<li><span>#${r.order ?? '?'}</span><span class="bulk-result-bad">${escapeHtml(ERROR_LABELS[r.error] || r.error || 'failed')}</span></li>`
        ).join('') + '</ul>';
      }
      bulkResultText.innerHTML = html;
    }

    selectedOrders.clear();
    updateBulkButton();
    loadOrders();
  }

  bulkBtn.addEventListener('click', openBulkModal);
  bulkModal.querySelectorAll('[data-bulk-close]').forEach(el => el.addEventListener('click', closeBulkModal));
  bulkConfirmBtn.addEventListener('click', submitBulkComplete);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !bulkModal.hidden) closeBulkModal();
  });

  // ── Filters ────────────────────────────────────────────────
  let debounceTimer;
  function onChange() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(loadOrders, 220);
  }
  [qEl, stEl, fromEl, toEl].forEach(el => el.addEventListener('input', onChange));

  // ── Export ─────────────────────────────────────────────────
  exportBtn.addEventListener('click', e => {
    e.preventDefault();
    window.location.href = API + '/export/orders.xlsx?' + params().toString();
  });

  // ── Init ───────────────────────────────────────────────────
  loadOrders();
})();