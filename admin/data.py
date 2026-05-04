"""Data layer â€” reads ticket_data.json and produces normalised orders + stats."""
from __future__ import annotations
import json
import os
import re
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Iterable

NPT = timezone(timedelta(hours=5, minutes=45))


def _resolve_data_file() -> Path:
    app_dir = Path(__file__).resolve().parent
    root_dir = app_dir.parent
    raw_path = (os.getenv("TICKET_DATA_PATH") or "").strip()

    candidates: list[Path] = []
    if raw_path:
        configured = Path(raw_path)
        if configured.is_absolute():
            candidates.append(configured)
        else:
            candidates.extend([
                Path.cwd() / configured,
                app_dir / configured,
                root_dir / configured,
            ])

    candidates.extend([
        root_dir / "ticket_data.json",
        app_dir / "ticket_data.json",
    ])

    for candidate in candidates:
        if candidate.exists():
            return candidate

    return candidates[0]


DATA_FILE = _resolve_data_file()

# Vercel KV (Upstash Redis) â€” set these env vars on Render to enable cloud sync
_KV_URL   = os.getenv("KV_REST_API_URL", "")
_KV_TOKEN = os.getenv("KV_REST_API_TOKEN", "")

# Canonical status set used throughout the dashboard.
STATUSES = [
    "open",
    "awaiting_review",
    "completed",
    "cancelled",
    "rejected",
    "auto_deleted",
]

STATUS_LABELS = {
    "open":            "Open",
    "awaiting_review": "Awaiting Review",
    "completed":       "Completed",
    "cancelled":       "Cancelled",
    "rejected":        "Rejected",
    "auto_deleted":    "Auto-deleted",
}


def _load_raw() -> dict:
    # Prefer Vercel KV when deployed (set KV_REST_API_URL + KV_REST_API_TOKEN)
    if _KV_URL and _KV_TOKEN:
        try:
            import requests as _req
            resp = _req.get(
                f"{_KV_URL}/get/ticket_data",
                headers={"Authorization": f"Bearer {_KV_TOKEN}"},
                timeout=5,
            )
            if resp.ok:
                value = resp.json().get("result")
                if value:
                    return json.loads(value)
        except Exception:
            pass
    # Fall back to local file
    if not DATA_FILE.exists():
        return {}
    try:
        with DATA_FILE.open("r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}


def clear_dashboard_data() -> dict:
    existing = _load_raw()
    cleared = {
        "order_counter": existing.get("order_counter", 0),
        "completed_orders": [],
        "archived_orders": [],
        "server_config": existing.get("server_config", {}),
        "tickets": {},
    }
    if _KV_URL and _KV_TOKEN:
        try:
            import requests as _req
            _req.post(
                _KV_URL,
                json=["SET", "ticket_data", json.dumps(cleared, ensure_ascii=False)],
                headers={"Authorization": f"Bearer {_KV_TOKEN}"},
                timeout=10,
            )
        except Exception:
            pass
    else:
        DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
        with DATA_FILE.open("w", encoding="utf-8") as f:
            json.dump(cleared, f, indent=2, ensure_ascii=False)
    return cleared


def _parse_iso(s: str | None) -> datetime | None:
    if not s:
        return None
    try:
        dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=NPT)
        return dt
    except Exception:
        return None


def _created_dt(o: dict) -> datetime | None:
    # Prefer epoch, then opened_at, then opened_str
    epoch = o.get("created_at_epoch") or o.get("created_at")
    if epoch:
        try:
            return datetime.fromtimestamp(float(epoch), tz=NPT)
        except Exception:
            pass
    for key in ("opened_at", "completed_at", "archived_at"):
        dt = _parse_iso(o.get(key))
        if dt:
            return dt
    # Try parsing opened_str: "2026-04-24 12:29 NPT"
    s = o.get("opened_str", "")
    m = re.match(r"(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2})", s or "")
    if m:
        try:
            return datetime.strptime(f"{m.group(1)} {m.group(2)}", "%Y-%m-%d %H:%M").replace(tzinfo=NPT)
        except Exception:
            pass
    return None


def _completed_dt(o: dict) -> datetime | None:
    return _parse_iso(o.get("completed_at"))


def _cancelled_dt(o: dict) -> datetime | None:
    return _parse_iso(o.get("cancelled_at"))


def _deleted_dt(o: dict) -> datetime | None:
    return _parse_iso(o.get("auto_deleted_at"))


def _rejected_dt(o: dict) -> datetime | None:
    return _parse_iso(o.get("rejected_at"))


def _screenshot_dt(o: dict) -> datetime | None:
    return _parse_iso(o.get("screenshot_received_at"))


def _fmt(dt: datetime | None) -> str:
    return dt.astimezone(NPT).strftime("%Y-%m-%d %H:%M") if dt else ""


def _edit_flags(log_history: list[str]) -> tuple[bool, bool]:
    username_edited = False
    amount_edited = False
    for event in log_history or []:
        if "Edited:" not in event:
            continue
        parts = re.findall(r"`([^`]*)`", event)
        if len(parts) >= 4:
            if parts[0] != parts[1]:
                username_edited = True
            if parts[2] != parts[3]:
                amount_edited = True
        if username_edited and amount_edited:
            break
    return username_edited, amount_edited


def _normalise(o: dict) -> dict:
    """Coerce a ticket-archive record into a stable dashboard shape."""
    created = _created_dt(o)
    status = o.get("status") or ("completed" if o.get("completed_at") else "open")
    log_history = list(o.get("log_history") or [])
    username_edited, amount_edited = _edit_flags(log_history)
    out = {
        "order":             o.get("order"),
        "roblox":            o.get("roblox") or "",
        "roblox_display_name": (o.get("roblox_display_name") or "").strip() or o.get("roblox") or "",
        "amount":            int(o.get("amount") or 0),
        "discord_user_id":   str(o.get("discord_user_id") or o.get("discord_id") or ""),
        "discord_name":      o.get("discord_name") or "",
        "is_preorder":       bool(o.get("is_preorder")),
        "eligible_on":       o.get("eligible_on") or "",
        "guild_id":          str(o.get("guild_id") or ""),
        "channel_id":        str(o.get("channel_id") or ""),
        "status":            status,
        "created_at":        created.isoformat() if created else "",
        "created_at_display": _fmt(created),
        "opened_at":         o.get("opened_at") or "",
        "completed_at":      o.get("completed_at") or "",
        "completed_at_display": _fmt(_completed_dt(o)),
        "cancelled_at":      o.get("cancelled_at") or "",
        "cancelled_at_display": _fmt(_cancelled_dt(o)),
        "rejected_at":       o.get("rejected_at") or "",
        "rejected_at_display": _fmt(_rejected_dt(o)),
        "auto_deleted_at":   o.get("auto_deleted_at") or "",
        "auto_deleted_at_display": _fmt(_deleted_dt(o)),
        "screenshot_url":      o.get("screenshot_url") or "",
        "screenshot_log_url":  o.get("screenshot_log_url") or "",
        "screenshot_filename": o.get("screenshot_filename") or "",
        "screenshot_display_url": o.get("screenshot_log_url") or o.get("screenshot_url") or "",
        "screenshot_received_at": o.get("screenshot_received_at") or "",
        "screenshot_at_display": _fmt(_screenshot_dt(o)),
        "log_history":       log_history,
        "roblox_edited":     username_edited,
        "amount_edited":     amount_edited,
        "archived_at":       o.get("archived_at") or "",
        "completed_by_name": o.get("completed_by_name") or "",
        "cancelled_by_name": o.get("cancelled_by_name") or "",
        "rejected_by_name":  o.get("rejected_by_name") or "",
    }
    return out


def all_orders() -> list[dict]:
    """
    Produce the full list of orders from:
      1. archived_orders (new comprehensive archive â€” preferred)
      2. active tickets not yet archived (current open tickets)
      3. legacy completed_orders that predate archived_orders

    Deduplicated by order number; later sources only fill in missing orders.
    """
    data = _load_raw()
    archived = data.get("archived_orders") or []
    active_tickets = list((data.get("tickets") or {}).values())
    legacy_completed = data.get("completed_orders") or []

    seen = {}
    for o in archived:
        n = _normalise(o)
        if n["order"]:
            seen[n["order"]] = n

    # Fill in active tickets (channel_id attached from dict key)
    for k, meta in (data.get("tickets") or {}).items():
        meta = dict(meta)
        meta["channel_id"] = meta.get("channel_id") or k
        if meta.get("order") and meta["order"] not in seen:
            n = _normalise(meta)
            meta_status = (meta.get("status") or "").strip()
            if meta_status in STATUSES:
                n["status"] = meta_status
            else:
                n["status"] = "awaiting_review" if meta.get("screenshot_received") else "open"
            seen[n["order"]] = n

    # Fill in any legacy completed orders not already archived
    for o in legacy_completed:
        if not o.get("order") or o["order"] in seen:
            continue
        synth = dict(o)
        synth["status"] = "completed"
        synth["discord_user_id"] = o.get("discord_id")
        seen[o["order"]] = _normalise(synth)

    # Newest first
    def sort_key(o):
        return o["created_at"] or o["archived_at"] or ""
    orders = sorted(seen.values(), key=sort_key, reverse=True)
    return orders


# â”€â”€â”€â”€â”€â”€â”€â”€â”€ filtering â”€â”€â”€â”€â”€â”€â”€â”€â”€

def filter_orders(orders: list[dict], q: str = "", status: str = "",
                  date_from: str = "", date_to: str = "") -> list[dict]:
    """Apply search/filter to orders list."""
    def date_filter(o):
        if not (date_from or date_to):
            return True
        dt = _parse_iso(o.get("created_at"))
        if not dt:
            return False
        d = dt.astimezone(NPT).date()
        if date_from:
            try:
                if d < datetime.strptime(date_from, "%Y-%m-%d").date():
                    return False
            except Exception:
                pass
        if date_to:
            try:
                if d > datetime.strptime(date_to, "%Y-%m-%d").date():
                    return False
            except Exception:
                pass
        return True

    q = (q or "").strip().lower()
    out = []
    for o in orders:
        if status and o["status"] != status:
            continue
        if not date_filter(o):
            continue
        if q:
            haystack = " ".join([
                str(o.get("roblox", "")),
                str(o.get("roblox_display_name", "")),
                str(o.get("discord_name", "")),
                str(o.get("amount", "")),
                str(o.get("discord_user_id", "")),
                str(o.get("order", "")),
            ]).lower()
            if q not in haystack:
                continue
        out.append(o)
    return out


# â”€â”€â”€â”€â”€â”€â”€â”€â”€ analytics â”€â”€â”€â”€â”€â”€â”€â”€â”€

def analytics(date_from: str = "", date_to: str = "") -> dict:
    """Return summary stats and per-day buckets between date_from and date_to (inclusive)."""
    orders = all_orders()
    filtered = filter_orders(orders, date_from=date_from, date_to=date_to)

    by_status: dict[str, int] = {s: 0 for s in STATUSES}
    total_amount_completed = 0
    for o in filtered:
        by_status[o["status"]] = by_status.get(o["status"], 0) + 1
        if o["status"] == "completed":
            total_amount_completed += o["amount"]

    # Daily buckets
    start_d, end_d = _resolve_range(filtered, date_from, date_to)
    days: list[str] = []
    if start_d and end_d and start_d <= end_d:
        d = start_d
        while d <= end_d:
            days.append(d.strftime("%Y-%m-%d"))
            d += timedelta(days=1)

    buckets: dict[str, dict[str, int]] = {d: {"completed": 0, "cancelled": 0, "rejected": 0,
                                              "auto_deleted": 0, "opened": 0,
                                              "amount": 0} for d in days}
    for o in filtered:
        dt = _parse_iso(o.get("created_at"))
        if not dt:
            continue
        day = dt.astimezone(NPT).strftime("%Y-%m-%d")
        if day not in buckets:
            continue
        buckets[day]["opened"] += 1
        st = o["status"]
        if st == "completed":
            buckets[day]["completed"] += 1
            buckets[day]["amount"] += o["amount"]
        elif st == "cancelled":
            buckets[day]["cancelled"] += 1
        elif st == "rejected":
            buckets[day]["rejected"] += 1
        elif st == "auto_deleted":
            buckets[day]["auto_deleted"] += 1

    return {
        "from":              start_d.strftime("%Y-%m-%d") if start_d else "",
        "to":                end_d.strftime("%Y-%m-%d") if end_d else "",
        "total_orders":      len(filtered),
        "total_amount_completed": total_amount_completed,
        "total_completed":   by_status.get("completed", 0),
        "total_cancelled":   by_status.get("cancelled", 0),
        "total_rejected":    by_status.get("rejected", 0),
        "total_auto_deleted": by_status.get("auto_deleted", 0),
        "total_open":        by_status.get("open", 0),
        "total_awaiting":    by_status.get("awaiting_review", 0),
        "by_status":         by_status,
        "days":              days,
        "series": {
            "opened":       [buckets[d]["opened"]       for d in days],
            "completed":    [buckets[d]["completed"]    for d in days],
            "cancelled":    [buckets[d]["cancelled"]    for d in days],
            "rejected":     [buckets[d]["rejected"]     for d in days],
            "auto_deleted": [buckets[d]["auto_deleted"] for d in days],
            "amount":       [buckets[d]["amount"]       for d in days],
        },
    }


def _resolve_range(filtered: list[dict], date_from: str, date_to: str):
    """Derive a (start, end) date span from explicit args or from the data itself."""
    if date_from:
        try:
            start = datetime.strptime(date_from, "%Y-%m-%d").date()
        except Exception:
            start = None
    else:
        start = None
    if date_to:
        try:
            end = datetime.strptime(date_to, "%Y-%m-%d").date()
        except Exception:
            end = None
    else:
        end = None
    if start and end:
        return start, end

    dates = []
    for o in filtered:
        dt = _parse_iso(o.get("created_at"))
        if dt:
            dates.append(dt.astimezone(NPT).date())
    if not dates:
        today = datetime.now(NPT).date()
        return start or today, end or today
    return (start or min(dates)), (end or max(dates))


# â”€â”€â”€â”€â”€â”€â”€â”€â”€ per-user history â”€â”€â”€â”€â”€â”€â”€â”€â”€

def user_history(q: str, date_from: str = "", date_to: str = "") -> dict:
    """Look up all orders matching a Roblox/Discord username or Discord ID."""
    q_clean = (q or "").strip().lower()
    if not q_clean:
        return {"query": q, "matches": [], "totals": {}}
    orders = all_orders()
    orders = filter_orders(orders, date_from=date_from, date_to=date_to)

    matches = []
    for o in orders:
        if (q_clean == str(o.get("roblox", "")).lower()
                or q_clean == str(o.get("roblox_display_name", "")).lower()
                or q_clean == str(o.get("discord_name", "")).lower()
                or q_clean == str(o.get("discord_user_id", "")).lower()
                or q_clean in str(o.get("roblox", "")).lower()
                or q_clean in str(o.get("roblox_display_name", "")).lower()
                or q_clean in str(o.get("discord_name", "")).lower()):
            matches.append(o)

    totals = {
        "orders":      len(matches),
        "completed":   sum(1 for m in matches if m["status"] == "completed"),
        "cancelled":   sum(1 for m in matches if m["status"] == "cancelled"),
        "amount_total_completed": sum(m["amount"] for m in matches if m["status"] == "completed"),
    }
    return {"query": q, "matches": matches, "totals": totals}


# â”€â”€â”€â”€â”€â”€â”€â”€â”€ button click stats â”€â”€â”€â”€â”€â”€â”€â”€â”€

def button_stats(date_from: str = "", date_to: str = "") -> dict:
    """Return ticket-open button click stats, optionally filtered by date range."""
    data   = _load_raw()
    bs     = data.get("button_stats") or {}
    daily  = bs.get("daily") or {}

    if date_from or date_to:
        filtered: dict[str, dict] = {}
        for day, counts in daily.items():
            try:
                d = datetime.strptime(day, "%Y-%m-%d").date()
            except Exception:
                continue
            if date_from:
                try:
                    if d < datetime.strptime(date_from, "%Y-%m-%d").date():
                        continue
                except Exception:
                    pass
            if date_to:
                try:
                    if d > datetime.strptime(date_to, "%Y-%m-%d").date():
                        continue
                except Exception:
                    pass
            filtered[day] = counts
        totals = {k: sum(v.get(k, 0) for v in filtered.values())
                  for k in ("total", "not_found", "not_joined", "ineligible", "eligible")}
    else:
        filtered = daily
        totals = {k: bs.get(k, 0)
                  for k in ("total", "not_found", "not_joined", "ineligible", "eligible")}

    if filtered:
        days = sorted(filtered.keys())
        if date_from and date_to:
            try:
                start = datetime.strptime(date_from, "%Y-%m-%d").date()
                end   = datetime.strptime(date_to,   "%Y-%m-%d").date()
                d, all_days = start, []
                while d <= end:
                    all_days.append(d.strftime("%Y-%m-%d"))
                    d += timedelta(days=1)
                days = all_days
            except Exception:
                pass
    else:
        days = []

    series = {k: [filtered.get(d, {}).get(k, 0) for d in days]
              for k in ("total", "not_found", "not_joined", "ineligible", "eligible")}

    return {"totals": totals, "days": days, "series": series}


# â”€â”€â”€â”€â”€â”€â”€â”€â”€ ineligible choice stats â”€â”€â”€â”€â”€â”€â”€â”€â”€

def ineligible_choice_stats(date_from: str = "", date_to: str = "") -> dict:
    """Return proceed vs later counts for ineligible users, optionally date-filtered."""
    data  = _load_raw()
    ic    = data.get("ineligible_choices") or {}
    daily = ic.get("daily") or {}

    if date_from or date_to:
        filtered: dict[str, dict] = {}
        for day, counts in daily.items():
            try:
                d = datetime.strptime(day, "%Y-%m-%d").date()
            except Exception:
                continue
            if date_from:
                try:
                    if d < datetime.strptime(date_from, "%Y-%m-%d").date():
                        continue
                except Exception:
                    pass
            if date_to:
                try:
                    if d > datetime.strptime(date_to, "%Y-%m-%d").date():
                        continue
                except Exception:
                    pass
            filtered[day] = counts
        totals = {k: sum(v.get(k, 0) for v in filtered.values()) for k in ("proceed", "later")}
    else:
        filtered = daily
        totals = {k: ic.get(k, 0) for k in ("proceed", "later")}

    if filtered:
        days = sorted(filtered.keys())
        if date_from and date_to:
            try:
                start = datetime.strptime(date_from, "%Y-%m-%d").date()
                end   = datetime.strptime(date_to,   "%Y-%m-%d").date()
                d, all_days = start, []
                while d <= end:
                    all_days.append(d.strftime("%Y-%m-%d"))
                    d += timedelta(days=1)
                days = all_days
            except Exception:
                pass
    else:
        days = []

    series = {k: [filtered.get(d, {}).get(k, 0) for d in days] for k in ("proceed", "later")}
    return {"totals": totals, "days": days, "series": series}


# â”€â”€â”€â”€â”€â”€â”€â”€â”€ leaderboard â”€â”€â”€â”€â”€â”€â”€â”€â”€

def leaderboard(date_from: str = "", date_to: str = "") -> dict:
    """Return top users ranked by total Robux purchased (completed orders only)."""
    orders = all_orders()
    filtered = filter_orders(orders, date_from=date_from, date_to=date_to)

    roblox_data: dict[str, dict] = {}
    discord_data: dict[str, dict] = {}

    for o in filtered:
        if o["status"] != "completed":
            continue
        amount = o["amount"]
        roblox  = o["roblox"] or "â€”"
        discord = o["discord_name"] or "â€”"

        if roblox not in roblox_data:
            roblox_data[roblox] = {"name": roblox, "amount": 0, "orders": 0}
        roblox_data[roblox]["amount"] += amount
        roblox_data[roblox]["orders"] += 1

        if discord not in discord_data:
            discord_data[discord] = {"name": discord, "amount": 0, "orders": 0}
        discord_data[discord]["amount"] += amount
        discord_data[discord]["orders"] += 1

    roblox_board  = sorted(roblox_data.values(),  key=lambda x: x["amount"], reverse=True)
    discord_board = sorted(discord_data.values(), key=lambda x: x["amount"], reverse=True)

    return {"roblox": roblox_board, "discord": discord_board}

