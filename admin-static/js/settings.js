/* Settings page — mirrors both bots' /config, plus scheduled DMs and images */
(() => {
  const API = window.BASE_URL || '';
  const $ = sel => document.querySelector(sel);
  const $all = sel => Array.from(document.querySelectorAll(sel));

  function escapeHtml(s) {
    return (s ?? '').toString()
      .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;').replaceAll("'", '&#39;');
  }

  let lastRules = [];
  let editingRuleId = null;

  // ── Field-status indicator (saving / saved / error) ─────────
  function setStatus(key, state, message) {
    const el = document.querySelector(`[data-status-for="${CSS.escape(key)}"]`);
    if (!el) return;
    el.className = 'field-status field-status-' + state;
    el.textContent = state === 'saving' ? '⏳ ' + (message || 'Saving…')
                    : state === 'saved'  ? '✓ ' + (message || 'Saved')
                    : '✗ ' + (message || 'Error');
    if (state === 'saved') {
      setTimeout(() => { if (el.textContent.startsWith('✓')) el.textContent = ''; }, 4000);
    }
  }

  // ── Populate a channel/category/role <select> from guild_structure ──
  function populateSelect(select, kind, gs, currentValue) {
    const list = kind === 'channel' ? gs.channels : kind === 'category' ? gs.categories : gs.roles;
    const opts = ['<option value="0">(not set)</option>'];
    for (const item of (list || [])) {
      opts.push(`<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}</option>`);
    }
    select.innerHTML = opts.join('');
    select.value = String(currentValue || 0);
    // If the stored ID isn't in the current guild snapshot (stale/renamed),
    // still show it rather than silently reverting to "(not set)".
    if (select.value !== String(currentValue || 0) && currentValue) {
      const opt = document.createElement('option');
      opt.value = String(currentValue);
      opt.textContent = `Unknown (${currentValue})`;
      select.appendChild(opt);
      select.value = String(currentValue);
    }
  }

  // ── Save a single field (dropdown / text / textarea / groups) ───────
  async function saveField(el) {
    const domain = el.dataset.domain; // "ticket" | "util"
    const key    = el.dataset.key;
    const kind   = el.dataset.kind;
    let value;
    if (kind === 'groups') {
      value = Array.from(el.querySelectorAll('input[type="checkbox"]:checked')).map(cb => cb.value);
    } else {
      value = el.value;
    }
    setStatus(key, 'saving');
    const endpoint = domain === 'ticket' ? 'ticket-field' : 'util-field';
    try {
      const res = await fetch(API + '/api/settings/' + endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || d.error) {
        setStatus(key, 'error', d.message || d.error || 'Save failed');
        return;
      }
      setStatus(key, 'saved');
    } catch (err) {
      setStatus(key, 'error', err.message);
    }
  }

  // ── Image upload ─────────────────────────────────────────────
  function readAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload  = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }

  async function handleImageUpload(input) {
    const file = input.files[0];
    if (!file) return;
    const slot     = input.dataset.slot;
    const endpoint = input.dataset.endpoint; // "ticket-image" | "util-image"
    const statusKey = 'img:' + slot;
    setStatus(statusKey, 'saving', 'Uploading…');
    try {
      const dataUrl = await readAsDataURL(file);
      const b64 = dataUrl.split(',', 2)[1] || '';
      const res = await fetch(API + '/api/settings/' + endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slot, data: b64, content_type: file.type }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || d.error) {
        setStatus(statusKey, 'error', d.message || d.error || 'Upload failed');
        return;
      }
      setStatus(statusKey, 'saved', 'Uploaded — synced to the bot within ~20s');
    } catch (err) {
      setStatus(statusKey, 'error', err.message);
    } finally {
      input.value = '';
    }
  }

  // ── Scheduled DMs ─────────────────────────────────────────────
  function renderDmRules(rules) {
    const el = $('#dm-rules-list');
    if (!rules.length) {
      el.innerHTML = '<div class="muted muted-center">No scheduled DMs yet.</div>';
      return;
    }
    el.innerHTML = rules.map(r => `
      <div class="dm-rule-row" data-rule-id="${r.id}">
        <div class="dm-rule-main">
          <span class="mono">#${r.id}</span>
          <span class="mono">&lt;@${escapeHtml(r.user_id)}&gt;</span>
          <span class="mono">${escapeHtml(r.time)} NPT</span>
          <span class="dm-rule-msg">${escapeHtml(r.message)}</span>
        </div>
        <div class="dm-rule-actions">
          <label class="dm-rule-toggle">
            <input type="checkbox" data-dm-toggle="${r.id}" ${r.enabled ? 'checked' : ''}/> Enabled
          </label>
          <button type="button" class="btn btn-ghost btn-compact" data-dm-edit="${r.id}">Edit</button>
          <button type="button" class="btn btn-ghost btn-compact" data-dm-delete="${r.id}">Delete</button>
        </div>
      </div>
    `).join('');

    el.querySelectorAll('[data-dm-toggle]').forEach(cb => {
      cb.addEventListener('change', () => doDmAction('toggle', { rule_id: parseInt(cb.dataset.dmToggle, 10) }));
    });
    el.querySelectorAll('[data-dm-delete]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!window.confirm('Delete this scheduled DM rule?')) return;
        doDmAction('delete', { rule_id: parseInt(btn.dataset.dmDelete, 10) });
      });
    });
    el.querySelectorAll('[data-dm-edit]').forEach(btn => {
      btn.addEventListener('click', () => startEditDmRule(parseInt(btn.dataset.dmEdit, 10)));
    });
  }

  function startEditDmRule(ruleId) {
    const rule = lastRules.find(r => r.id === ruleId);
    if (!rule) return;
    $('#dm-add-user').value = rule.user_id;
    $('#dm-add-time').value = rule.time;
    $('#dm-add-message').value = rule.message;
    editingRuleId = ruleId;
    $('#dm-add-btn').textContent = 'Update Rule';
  }

  function resetDmAddForm() {
    $('#dm-add-user').value = '';
    $('#dm-add-time').value = '';
    $('#dm-add-message').value = '';
    editingRuleId = null;
    $('#dm-add-btn').textContent = 'Add Rule';
  }

  async function doDmAction(action, extra) {
    setStatus('dm-add', 'saving');
    try {
      const res = await fetch(API + '/api/settings/dm-rule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...extra }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || d.error) {
        setStatus('dm-add', 'error', d.message || d.error || 'Failed');
        return;
      }
      setStatus('dm-add', 'saved');
      lastRules = d.rules || lastRules;
      renderDmRules(lastRules);
      if (action !== 'toggle') resetDmAddForm();
    } catch (err) {
      setStatus('dm-add', 'error', err.message);
    }
  }

  $('#dm-add-btn').addEventListener('click', () => {
    const user_id = $('#dm-add-user').value.trim();
    const time    = $('#dm-add-time').value.trim();
    const message = $('#dm-add-message').value.trim();
    if (!user_id || !time || !message) {
      setStatus('dm-add', 'error', 'Fill in all fields.');
      return;
    }
    if (editingRuleId) {
      doDmAction('update', { rule_id: editingRuleId, user_id, time, message });
    } else {
      doDmAction('create', { user_id, time, message });
    }
  });

  // ── Load + populate everything ──────────────────────────────
  async function loadSettings() {
    try {
      const res = await fetch(API + '/api/settings');
      const data = await res.json();

      if (!data.kv_configured) {
        $('#settings-kv-warning').hidden = false;
      }

      const gs = data.guild_structure || { channels: [], categories: [], roles: [] };
      const tc = data.ticket_config || {};
      const uc = data.util_config || {};
      lastRules = data.scheduled_dms || [];

      $all('select[data-kind="channel"]').forEach(el => populateSelect(el, 'channel', gs, tc[el.dataset.key]));
      $all('select[data-kind="category"]').forEach(el => populateSelect(el, 'category', gs, tc[el.dataset.key]));
      $all('select[data-kind="role"]').forEach(el => populateSelect(el, 'role', gs, tc[el.dataset.key]));
      $all('select[data-kind="choice"]').forEach(el => { el.value = tc[el.dataset.key] || 'QR.png'; });
      $all('input[data-kind="text"][data-domain="ticket"]').forEach(el => { el.value = tc[el.dataset.key] ?? ''; });
      $all('[data-kind="groups"]').forEach(el => {
        const current = tc[el.dataset.key] || [];
        el.querySelectorAll('input[type="checkbox"]').forEach(cb => { cb.checked = current.includes(cb.value); });
      });
      $all('textarea[data-kind="text_field"]').forEach(el => { el.value = uc[el.dataset.key] ?? ''; });

      renderDmRules(lastRules);
    } catch (err) {
      console.error('Failed to load settings:', err);
    }
  }

  // ── Wire generic save-on-change handlers ────────────────────
  $all('select[data-key]').forEach(el => el.addEventListener('change', () => saveField(el)));
  $all('input[data-key]').forEach(el => el.addEventListener('blur', () => saveField(el)));
  $all('textarea[data-key]').forEach(el => el.addEventListener('blur', () => saveField(el)));
  $all('[data-kind="groups"]').forEach(el => el.addEventListener('change', () => saveField(el)));
  $all('input[type="file"][data-slot]').forEach(el => el.addEventListener('change', () => handleImageUpload(el)));

  loadSettings();
})();
