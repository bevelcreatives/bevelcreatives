module.exports = async function handler(req, res) {
  const { action, user_id, group } = req.query;
  const ELIGIBILITY_DAYS = 15;
  const GROUP_2_API_KEY_FALLBACK = [
    "SK3MRAr9/ki0BP6sbjwnC51ebrGpw1URSHCwBDYetiiVMsFgZXlKaGJHY2lPaUpTVXpJMU5pSXNJbXRwWkNJNkluTnBaeTB5",
    "TURJeExUQTNMVEV6VkRFNE9qVXhPalE1V2lJc0luUjVjQ0k2SWtwWFZDSjkuZXlKaGRXUWlPaUpTYjJKc2IzaEpiblJsY201",
    "aGJDSXNJbWx6Y3lJNklrTnNiM1ZrUVhWMGFHVnVkR2xqWVhScGIyNVRaWEoyYVdObElpd2lZbUZ6WlVGd2FVdGxlU0k2SWxO",
    "TE0wMVNRWEk1TDJ0cE1FSlFObk5pYW5kdVF6VXhaV0p5UjNCM01WVlNVMGhEZDBKRVdXVjBhV2xXVFhOR1p5SXNJbTkzYm1W",
    "eVNXUWlPaUkxTnpZek5qQTJOalUzSWl3aVpYaHdJam94TnpjNU16TTRNREl6TENKcFlYUWlPakUzTnprek16UTBNak1zSW01",
    "aVppSTZNVGMzT1RNek5EUXlNMzAuVmtCUEJaRW01UFRMdE9yQVFvU3R5NFFLZ3pEWUIyT0FNX1NZZFJDN1BVMTlfVm9fZm1t",
    "Wm52UkFTQnlYQV9OWVp6cE93Z05SQlp1b19KRVFOZDNlMTdHQ2RwMmFkX1VwbUNfOGFTcndLNGtRTFZYZEowTjh2RVlfbXo5",
    "NjJEbXVrZmZ5Qnk5RUZPb1l2anV6X0k5Z2dYRmc1TVVNb3VqaWZ2dFlkYklhcUptSzN3MllhQmpNaS11MHNqclhqTjdMb25r",
    "Zi02czBMWEhKbGFWREZiRFpMcXdfc3NhU0NGWFYtUVozS2ZGME9KUDg1UWl5ckpwa24xRUlQUW1sdVNfMWJsWU9TeTBnZy11",
    "Y3JJWmNvLXZjWlN1MVNFaTZDQXdfSVFzZVJrRzZCZ3hqbjl6Q3VPT2d3VnlpR3Y4YndCMFFXUy1zTkJVaGlzX2ZZY180Sm4y",
    "c3RB",
  ].join("");

  const compact = values => [...new Set(values.filter(Boolean).map(v => v.trim()).filter(Boolean))];

  const GROUPS = {
    '1': { id: '32582015', keys: compact([process.env.ROBLOX_API_KEY]) },
    '2': {
      id: '34169651',
      keys: compact([
        process.env.ROBLOX_API_KEY_2,
        process.env.ROBLOX_GROUP_2_API_KEY,
        process.env.BOT_ROBLOX_GROUP_2_API_KEY,
        process.env.GROUP_2_API_KEY,
        GROUP_2_API_KEY_FALLBACK,
      ]),
    },
  };

  res.setHeader('Content-Type', 'application/json');

  // ── Get user ID from username ─────────────────────────────────────────────
  if (action === 'userid') {
    const body     = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const username = (body?.username || '').trim();
    if (!username) return res.status(200).json({ error: 'Missing username' });

    let r;
    try {
      r = await fetch('https://users.roblox.com/v1/usernames/users', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ usernames: [username] }),
        signal:  AbortSignal.timeout(10000),
      });
    } catch {
      return res.status(200).json({ error: 'Request failed' });
    }

    if (r.status === 429) return res.status(200).json({ error: 'RATE_LIMITED' });
    const data = await r.json();
    if (!data.data?.length) return res.status(200).json({ error: 'not_found' });
    return res.status(200).json({ id: String(data.data[0].id) });

  // ── Get group membership & eligibility ────────────────────────────────────
  } else if (action === 'membership') {
    const g = GROUPS[group || '1'];
    if (!g) return res.status(200).json({ error: 'Invalid group' });
    if (!g.keys.length) return res.status(200).json({ error: 'API_KEY_MISSING' });
    if (!user_id || !/^\d+$/.test(user_id))
      return res.status(200).json({ error: 'Invalid user_id' });

    const filter = `user=='users/${user_id}'`;
    const url    = `https://apis.roblox.com/cloud/v2/groups/${g.id}/memberships?filter=${encodeURIComponent(filter)}`;

    let r;
    let lastErrBody = {};
    try {
      for (const key of g.keys) {
        r = await fetch(url, {
          headers: { accept: 'application/json', 'x-api-key': key },
          signal:  AbortSignal.timeout(10000),
        });
        if (r.status !== 401) break;
        lastErrBody = await r.json().catch(() => ({}));
      }
    } catch {
      return res.status(200).json({ error: 'Request failed' });
    }

    if (r.status === 429) return res.status(200).json({ error: 'RATE_LIMITED' });
    if (!r.ok) {
      const errBody = Object.keys(lastErrBody).length ? lastErrBody : await r.json().catch(() => ({}));
      return res.status(200).json({ error: `API_ERROR_${r.status}`, detail: errBody });
    }
    const data = await r.json();
    if (!data.groupMemberships?.length) return res.status(200).json({ error: 'not_joined' });

    const joinDt = new Date(data.groupMemberships[0].createTime);
    const eligDt = new Date(joinDt.getTime() + ELIGIBILITY_DAYS * 86400000);

    return res.status(200).json({
      joinDate:     joinDt.toISOString().replace('T', ' ').slice(0, 19) + ' UTC',
      eligibleDate: eligDt.toISOString().slice(0, 10),
      isEligible:   eligDt <= new Date(),
    });

  } else {
    return res.status(400).json({ error: 'Invalid action' });
  }
}
