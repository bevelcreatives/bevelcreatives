module.exports = async function handler(req, res) {
  const { action, user_id, group } = req.query;
  const ELIGIBILITY_DAYS = 15;

  const GROUPS = {
    '1': { id: '32582015', key: process.env.ROBLOX_API_KEY },
    '2': { id: '34169651', key: process.env.ROBLOX_API_KEY_2 },
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
    if (!g.key) return res.status(200).json({ error: 'API_KEY_MISSING' });
    if (!user_id || !/^\d+$/.test(user_id))
      return res.status(200).json({ error: 'Invalid user_id' });

    const filter = `user=='users/${user_id}'`;
    const url    = `https://apis.roblox.com/cloud/v2/groups/${g.id}/memberships?filter=${encodeURIComponent(filter)}`;

    let r;
    try {
      r = await fetch(url, {
        headers: { accept: 'application/json', 'x-api-key': g.key },
        signal:  AbortSignal.timeout(10000),
      });
    } catch {
      return res.status(200).json({ error: 'Request failed' });
    }

    if (r.status === 429) return res.status(200).json({ error: 'RATE_LIMITED' });
    if (!r.ok) {
      const errBody = await r.json().catch(() => ({}));
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
