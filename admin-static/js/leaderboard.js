/* Leaderboard page */
(() => {
  const API = window.BASE_URL || '';
  const $ = sel => document.querySelector(sel);
  const lbFromEl  = $('#lb-from');
  const lbToEl    = $('#lb-to');
  const lbChips   = document.querySelectorAll('.lb-chip');
  const lbTabs    = document.querySelectorAll('.lb-tab');
  const lbRobloxTable  = $('#lb-roblox-table');
  const lbDiscordTable = $('#lb-discord-table');
  const lbRobloxBody   = $('#lb-roblox-body');
  const lbDiscordBody  = $('#lb-discord-body');

  function fmt(n) { return (n ?? 0).toLocaleString(); }
  function escapeHtml(s) {
    return (s ?? '').toString()
      .replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')
      .replaceAll('"','&quot;').replaceAll("'",'&#39;');
  }

  function lbParams() {
    const p = new URLSearchParams();
    if (lbFromEl.value) p.set('from', lbFromEl.value);
    if (lbToEl.value)   p.set('to',   lbToEl.value);
    return p;
  }

  function renderRows(entries, tbody) {
    if (!entries.length) {
      tbody.innerHTML = '<tr class="no-hover"><td colspan="4" class="muted muted-center">No completed orders in this range.</td></tr>';
      return;
    }
    tbody.innerHTML = entries.map((e, i) => `
      <tr class="no-hover">
        <td class="lb-rank">${i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}</td>
        <td>${escapeHtml(e.name)}</td>
        <td class="num">${fmt(e.amount)}</td>
        <td class="num">${fmt(e.orders)}</td>
      </tr>
    `).join('');
  }

  async function load() {
    const loading = '<tr class="no-hover"><td colspan="4" class="muted muted-center">Loading…</td></tr>';
    lbRobloxBody.innerHTML = loading;
    lbDiscordBody.innerHTML = loading;
    try {
      const res = await fetch(API + '/api/leaderboard?' + lbParams().toString());
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      renderRows(data.roblox,  lbRobloxBody);
      renderRows(data.discord, lbDiscordBody);
    } catch (err) {
      const errRow = `<tr class="no-hover"><td colspan="4" class="muted muted-center">Failed to load: ${escapeHtml(err.message)}</td></tr>`;
      lbRobloxBody.innerHTML = errRow;
      lbDiscordBody.innerHTML = errRow;
    }
  }

  lbTabs.forEach(btn => {
    btn.addEventListener('click', () => {
      lbTabs.forEach(t => t.classList.remove('active'));
      btn.classList.add('active');
      lbRobloxTable.hidden  = btn.dataset.tab !== 'roblox';
      lbDiscordTable.hidden = btn.dataset.tab !== 'discord';
    });
  });

  function activateChip(btn) {
    lbChips.forEach(c => c.classList.remove('active'));
    if (btn) btn.classList.add('active');
  }
  lbChips.forEach(btn => {
    btn.addEventListener('click', () => {
      activateChip(btn);
      const r = btn.dataset.range;
      if (r === 'all') {
        lbFromEl.value = ''; lbToEl.value = '';
      } else {
        const days = parseInt(r, 10);
        lbToEl.value   = new Date().toISOString().slice(0, 10);
        lbFromEl.value = new Date(Date.now() - (days - 1) * 86400000).toISOString().slice(0, 10);
      }
      load();
    });
  });
  [lbFromEl, lbToEl].forEach(el => el.addEventListener('change', () => { activateChip(null); load(); }));

  load();
})();
