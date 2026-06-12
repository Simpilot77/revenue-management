#!/usr/bin/env python3
"""
Lodgify → Revenue Management sync script.
Ruft Buchungen UND Eigentümer-Sperren über die Lodgify API v2 ab
und speichert sie als frontend/public/data/sync.json.

Umgebungsvariablen:
  LODGIFY_API_KEY      – Lodgify API-Schlüssel (Pflicht)
  LODGIFY_ACCOUNT_ID   – Lodgify Konto-ID (optional, für Logging)
  DATE_FROM            – Von-Datum YYYY-MM-DD (Standard: 1 Jahr zurück)
  DATE_TO              – Bis-Datum YYYY-MM-DD (Standard: 2 Jahre voraus)
  HOUSE_MAP            – JSON: {"lodgify_property_id": house_id, ...}
                         Beispiel: {"123456": 1, "234567": 2, "345678": 3}
"""

import os
import json
import sys
import requests
from datetime import datetime, timedelta, date as dt_date
from pathlib import Path

# ─── Config ─────────────────────────────────────────────────────────────────

API_KEY = os.environ.get('LODGIFY_API_KEY', '').strip()
ACCOUNT_ID = os.environ.get('LODGIFY_ACCOUNT_ID', '')
BASE_URL = 'https://api.lodgify.com'

if not API_KEY:
    print("❌  LODGIFY_API_KEY nicht gesetzt – Abbruch.")
    sys.exit(1)

today = dt_date.today()
DATE_FROM = os.environ.get('DATE_FROM') or (today - timedelta(days=365)).isoformat()
DATE_TO   = os.environ.get('DATE_TO')   or (today + timedelta(days=730)).isoformat()

# Property-ID → house_id Mapping (aus Env oder wird aus API-Antwort gebaut)
HOUSE_MAP_RAW = os.environ.get('HOUSE_MAP', '')
HOUSE_MAP: dict[str, int] = {}
if HOUSE_MAP_RAW:
    try:
        HOUSE_MAP = {str(k): int(v) for k, v in json.loads(HOUSE_MAP_RAW).items()}
    except Exception as e:
        print(f"⚠  HOUSE_MAP konnte nicht geparst werden: {e}")

HEADERS = {
    'X-ApiKey': API_KEY,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
}

# ─── Helpers ────────────────────────────────────────────────────────────────

def get(path: str, params: dict = None) -> any:
    url = f"{BASE_URL}{path}"
    r = requests.get(url, headers=HEADERS, params=params or {}, timeout=30)
    print(f"  GET {path} {params} → {r.status_code}")
    if not r.ok:
        print(f"     Response: {r.text[:500]}")
    r.raise_for_status()
    return r.json()

def safe_get(path: str, params: dict = None, default=None):
    try:
        return get(path, params)
    except Exception as e:
        print(f"   ⚠  {path} fehlgeschlagen: {e}")
        return default

def date_str(val) -> str:
    """Normalisiert Datums-Strings auf YYYY-MM-DD."""
    if not val:
        return ''
    if isinstance(val, (dt_date, datetime)):
        return val.strftime('%Y-%m-%d')
    s = str(val)
    return s[:10] if len(s) >= 10 else s

# ─── 1. Properties (Häuser) holen ───────────────────────────────────────────

print(f"\n{'='*60}")
print(f"Lodgify Sync  {DATE_FROM} → {DATE_TO}")
print(f"{'='*60}\n")
print("1️⃣  Hole Properties …")

raw_props = get('/v2/properties')
# API gibt je nach Version eine Liste oder ein Dict zurück
props_list = raw_props if isinstance(raw_props, list) else raw_props.get('items', [])
print(f"   → {len(props_list)} Properties gefunden")

# Haus-Map aus Properties bauen, falls nicht per Env angegeben
prop_map: dict[int, dict] = {}
house_short_map = {1: 'A', 2: 'B', 3: 'C', 4: 'D', 5: 'E'}

for idx, p in enumerate(props_list, start=1):
    pid = p.get('id')
    house_id = HOUSE_MAP.get(str(pid), idx)  # Fallback: Reihenfolge
    prop_map[pid] = {
        'house_id':   house_id,
        'house_name': p.get('name', f'Haus {house_id}'),
        'house_short': house_short_map.get(house_id, str(house_id)),
        'house_capacity': (p.get('guests_max') or p.get('max_people') or 6),
        'lodgify_id': pid,
    }
    print(f"   • [{pid}] {p.get('name')} → house_id={house_id}")

# ─── 2. Kanal-Mapping ───────────────────────────────────────────────────────

CHANNEL_MAP = {
    'airbnb':       {'id': 3, 'name': 'Airbnb',                'short': 'AIRBNB',  'color': '#ff5a5f'},
    'booking':      {'id': 2, 'name': 'Booking.com',           'short': 'BDC',     'color': '#003580'},
    'bookingcom':   {'id': 2, 'name': 'Booking.com',           'short': 'BDC',     'color': '#003580'},
    'direct':       {'id': 1, 'name': 'Direkt',                'short': 'DIREKT',  'color': '#10b981'},
    'website':      {'id': 1, 'name': 'Direkt',                'short': 'DIREKT',  'color': '#10b981'},
    'manual':       {'id': 1, 'name': 'Direkt',                'short': 'DIREKT',  'color': '#10b981'},
    'homeaway':     {'id': 5, 'name': 'Expedia/HomeAway',      'short': 'EXPEDIA', 'color': '#ffc107'},
    'expedia':      {'id': 5, 'name': 'Expedia',               'short': 'EXPEDIA', 'color': '#ffc107'},
    'hrs':          {'id': 4, 'name': 'HRS',                   'short': 'HRS',     'color': '#e65100'},
    'owner':        {'id': None, 'name': 'Eigentümer',         'short': 'OWNER',   'color': '#64748b'},
    'ownerblock':   {'id': None, 'name': 'Eigentümer',         'short': 'OWNER',   'color': '#64748b'},
    'owneruse':     {'id': None, 'name': 'Eigentümer',         'short': 'OWNER',   'color': '#64748b'},
    'blocked':      {'id': None, 'name': 'Eigentümer',         'short': 'OWNER',   'color': '#64748b'},
    'maintenance':  {'id': None, 'name': 'Wartung',            'short': 'MAINT',   'color': '#64748b'},
    'unavailable':  {'id': None, 'name': 'Gesperrt',           'short': 'BLOCK',   'color': '#64748b'},
}

def get_channel(source: str) -> dict:
    if not source:
        return CHANNEL_MAP['direct']
    key = source.lower().strip().replace(' ', '').replace('.', '').replace('-', '').replace('_', '')
    for k, v in CHANNEL_MAP.items():
        clean_k = k.replace('.', '').replace('-', '').replace('_', '')
        if clean_k == key or clean_k in key or key in clean_k:
            return v
    return {'id': 7, 'name': source, 'short': source[:6].upper(), 'color': '#6b7280'}

STATUS_MAP = {
    'accepted':    'bestaetigt',
    'approved':    'bestaetigt',
    'confirmed':   'bestaetigt',
    'pending':     'angefragt',
    'request':     'angefragt',
    'inquiry':     'angefragt',
    'tentative':   'angefragt',
    'cancelled':   'storniert',
    'canceled':    'storniert',
    'declined':    'storniert',
    'rejected':    'storniert',
    'checkedin':   'eingecheckt',
    'checked_in':  'eingecheckt',
    'checkedout':  'ausgecheckt',
    'checked_out': 'ausgecheckt',
    'closed':      'ausgecheckt',
    'completed':   'ausgecheckt',
}

# Felder/Werte, die einen Owner Block kennzeichnen
OWNER_BLOCK_SOURCES = {
    'owner', 'ownerblock', 'owner_block', 'owneruse', 'owner_use',
    'blocked', 'maintenance', 'unavailable', 'block', 'internal',
}
OWNER_BLOCK_TYPES = {
    'ownerblock', 'owner_block', 'owneruse', 'blocked', 'maintenance',
    'unavailable', 'block', 'owner', 'internal',
}

def is_owner_block_record(r: dict) -> bool:
    """Prüft, ob ein Datensatz ein Eigentümer-Block ist."""
    def clean(s): return (s or '').lower().strip().replace(' ', '').replace('_', '').replace('-', '')

    source     = clean(r.get('source', ''))
    rtype      = clean(r.get('type', ''))
    status_raw = clean(r.get('status', ''))
    reason     = clean(r.get('note', '') or r.get('reason', '') or '')

    if r.get('is_blocked') or r.get('is_owner_block') or r.get('owner_block'):
        return True
    if source in OWNER_BLOCK_SOURCES:
        return True
    if rtype in OWNER_BLOCK_TYPES:
        return True
    if status_raw in {'owner', 'ownerblock', 'blocked', 'unavailable', 'maintenance'}:
        return True
    # Häufige Eigentümer-Notizen
    if any(kw in reason for kw in ('eigennutzung', 'eigentümer', 'owner', 'blocked', 'maintenance', 'renovierung')):
        return True
    return False

# ─── 3. Buchungen holen ──────────────────────────────────────────────────────

print("\n2️⃣  Hole Buchungen …")

def fetch_reservations_with_params(extra_params: dict = {}) -> list:
    """Paginierte Abfrage mit gegebenen Parametern."""
    results = []
    page, size = 1, 50
    while True:
        params = {
            'size': size,
            'page': page,
            **extra_params,
        }
        data = safe_get('/v2/reservations', params, default={})
        items = data if isinstance(data, list) else data.get('items', [])
        if not items:
            break
        results.extend(items)
        total = data.get('total_count', len(items)) if isinstance(data, dict) else len(items)
        print(f"   Seite {page}: {len(items)} Einträge (gesamt bisher: {len(results)}/{total})")
        if len(results) >= total or len(items) < size:
            break
        page += 1
    return results

# Haupt-Buchungsabfrage — versuche beide Varianten für Datumsparam-Namen
print("   → Versuche Buchungen mit dateDeparture-Parametern …")
reservations = fetch_reservations_with_params({
    'dateDepartureStart': DATE_FROM,
    'dateDepartureEnd':   DATE_TO,
    'includeExternal':    'true',
})

if not reservations:
    print("   → Versuche mit arrival/departure-Parametern …")
    reservations = fetch_reservations_with_params({
        'dateArrivalStart': DATE_FROM,
        'dateDepartureEnd': DATE_TO,
        'includeExternal':  'true',
    })

if not reservations:
    print("   → Versuche ohne Datumsfilter …")
    reservations = fetch_reservations_with_params({'includeExternal': 'true'})

print(f"   → {len(reservations)} Buchungen gesamt gefunden")

# Alle Felder des ersten Eintrags loggen (zur Diagnose)
if reservations:
    print(f"\n   🔍 Beispiel-Felder (1. Buchung): {list(reservations[0].keys())}")
    print(f"   🔍 Beispiel-Werte: source={reservations[0].get('source')}, "
          f"type={reservations[0].get('type')}, "
          f"status={reservations[0].get('status')}, "
          f"is_blocked={reservations[0].get('is_blocked')}")

# ─── 4. Eigentümer-Sperren holen ────────────────────────────────────────────

print("\n3️⃣  Hole Eigentümer-Sperren …")

owner_blocks_raw: list = []
seen_block_ids: set = set()

def add_blocks(blocks: list, source_desc: str):
    added = 0
    for b in blocks:
        bid = b.get('id')
        key = bid if bid else id(b)
        if key not in seen_block_ids:
            seen_block_ids.add(key)
            owner_blocks_raw.append(b)
            added += 1
    if added:
        print(f"   ✅ {source_desc}: +{added} Sperren")

# Ansatz 1: reservations?type=OwnerBlock
data_ob = safe_get('/v2/reservations', {
    'dateDepartureStart': DATE_FROM,
    'dateDepartureEnd':   DATE_TO,
    'type':               'OwnerBlock',
    'size':               200,
}, default={})
items_ob = data_ob if isinstance(data_ob, list) else (data_ob or {}).get('items', [])
if items_ob:
    add_blocks(items_ob, "/v2/reservations?type=OwnerBlock")

# Ansatz 2: reservations?type=Blocked
data_bl = safe_get('/v2/reservations', {
    'dateDepartureStart': DATE_FROM,
    'dateDepartureEnd':   DATE_TO,
    'type':               'Blocked',
    'size':               200,
}, default={})
items_bl = data_bl if isinstance(data_bl, list) else (data_bl or {}).get('items', [])
if items_bl:
    add_blocks(items_bl, "/v2/reservations?type=Blocked")

# Ansatz 3: Aus der normalen Buchungsliste herausfiltern
from_reservations = [r for r in reservations if is_owner_block_record(r)]
if from_reservations:
    add_blocks(from_reservations, "Herausgefiltert aus Buchungsliste")

# Ansatz 4: /v2/availability/{pid} je Property (gibt geblockte Perioden)
for pid, prop in prop_map.items():
    data = safe_get(f'/v2/availability/{pid}', {
        'from': DATE_FROM,
        'to':   DATE_TO,
    })
    if not data:
        # Versuche alternativen Endpunkt
        data = safe_get(f'/v2/properties/{pid}/availability', {
            'startDate': DATE_FROM,
            'endDate':   DATE_TO,
        })
    if data:
        # Extrahiere geblockte Perioden
        periods = []
        if isinstance(data, list):
            periods = data
        elif isinstance(data, dict):
            for key in ('blocked_periods', 'unavailable_periods', 'periods', 'items', 'blocks'):
                if key in data and isinstance(data[key], list):
                    periods = data[key]
                    break
        # Nur als Eigentümer-Block markieren, wenn kein bestehender Eintrag
        new_periods = []
        for p in periods:
            arrival   = date_str(p.get('arrival') or p.get('from') or p.get('start') or p.get('start_date'))
            departure = date_str(p.get('departure') or p.get('to') or p.get('end') or p.get('end_date'))
            if arrival and departure and arrival < departure:
                p['_property_id'] = pid
                p['_is_owner_block'] = True
                new_periods.append(p)
        if new_periods:
            add_blocks(new_periods, f"Availability property {pid}")

# Ansatz 5: /v2/reservations?includeOwnerBlocks=true (einige Lodgify-Versionen)
data_incl = safe_get('/v2/reservations', {
    'dateDepartureStart': DATE_FROM,
    'dateDepartureEnd':   DATE_TO,
    'includeOwnerBlocks': 'true',
    'size':               200,
}, default={})
items_incl = data_incl if isinstance(data_incl, list) else (data_incl or {}).get('items', [])
owner_from_incl = [r for r in items_incl if is_owner_block_record(r)]
if owner_from_incl:
    add_blocks(owner_from_incl, "/v2/reservations?includeOwnerBlocks=true")

print(f"   → {len(owner_blocks_raw)} Eigentümer-Sperren insgesamt")

# ─── 5. Transformation ──────────────────────────────────────────────────────

print("\n4️⃣  Transformiere Daten …")

def get_prop_info(r: dict) -> dict:
    pid = (
        r.get('property_id') or
        r.get('_property_id') or
        (r.get('property') or {}).get('id') or
        (r.get('rooms') or [{}])[0].get('property_id') if r.get('rooms') else None
    )
    if pid and int(pid) in prop_map:
        return prop_map[int(pid)]
    # Fallback: ersten Eintrag nehmen
    if prop_map:
        return next(iter(prop_map.values()))
    return {'house_id': 1, 'house_name': 'Haus 1', 'house_short': 'A', 'house_capacity': 6}

def nights_between(arrival: str, departure: str) -> int:
    try:
        a = dt_date.fromisoformat(arrival[:10])
        d = dt_date.fromisoformat(departure[:10])
        return max(0, (d - a).days)
    except Exception:
        return 0

def transform_reservation(r: dict, is_block: bool = False) -> dict | None:
    prop = get_prop_info(r)

    arrival   = date_str(
        r.get('arrival') or r.get('checkin_date') or r.get('start_date') or
        r.get('from') or r.get('start') or r.get('date_arrival')
    )
    departure = date_str(
        r.get('departure') or r.get('checkout_date') or r.get('end_date') or
        r.get('to') or r.get('end') or r.get('date_departure')
    )

    if not arrival or not departure or arrival >= departure:
        return None  # ungültige Periode

    # Filter: nur Einträge im relevanten Zeitraum
    if departure < DATE_FROM or arrival > DATE_TO:
        return None

    nights = r.get('nights', 0) or nights_between(arrival, departure)

    # Kanal
    source = r.get('source', '') or ''
    is_owner = is_block or r.get('_is_owner_block', False) or is_owner_block_record(r)

    channel = CHANNEL_MAP['owner'] if is_owner else get_channel(source)

    # Status
    status_raw = (r.get('status', '') or '').lower().replace(' ', '').replace('_', '')
    status = 'gesperrt' if is_owner else STATUS_MAP.get(status_raw, 'bestaetigt')

    # Gast
    guest = r.get('guest', {}) or {}
    if not isinstance(guest, dict):
        guest = {}
    if is_owner:
        guest_name = 'Eigentümer (gesperrt)'
    else:
        guest_name = (
            guest.get('name') or
            f"{guest.get('first_name', '')} {guest.get('last_name', '')}".strip() or
            r.get('guest_name', '') or
            r.get('name', '') or
            'Unbekannt'
        )

    # Personen
    people = r.get('people', r.get('guests', {})) or {}
    if isinstance(people, dict):
        adults   = people.get('adults', 0) or people.get('adults_count', 0) or 0
        children = people.get('children', 0) or people.get('children_count', 0) or 0
    else:
        adults, children = int(people or 1), 0
    guest_count = adults + children or (0 if is_owner else 1)

    # Preis
    total_price = float(r.get('total_amount', 0) or r.get('total_price', 0) or r.get('price', 0) or r.get('amount', 0) or 0)
    daily_rate  = round(total_price / nights, 2) if nights > 0 and total_price > 0 else 0

    # Buchungsdatum
    booking_date = date_str(r.get('created_at') or r.get('booking_date') or r.get('created')) or today.isoformat()

    # Block-Grund
    block_reason = None
    if is_owner:
        block_reason = (
            r.get('reason') or
            r.get('block_reason') or
            r.get('note') or
            r.get('notes') or
            r.get('internal_notes') or
            r.get('name') or
            ''
        ) or ''

    return {
        'id':               r.get('id') or abs(hash(f"{arrival}{departure}{prop['house_id']}")),
        'house_id':         prop['house_id'],
        'house_name':       prop['house_name'],
        'house_short':      prop['house_short'],
        'house_capacity':   prop['house_capacity'],
        'channel_id':       channel['id'],
        'channel_name':     channel['name'],
        'channel_short':    channel['short'],
        'channel_color':    channel['color'],
        'external_reference': str(r.get('id', '')),
        'booking_date':     booking_date,
        'checkin_date':     arrival,
        'checkout_date':    departure,
        'nights':           nights,
        'guest_name':       guest_name,
        'company_name':     guest.get('company', '') or None,
        'guest_email':      guest.get('email', '') or r.get('guest_email', '') or None,
        'guest_phone':      guest.get('phone', '') or None,
        'nationality':      guest.get('country_code', '') or guest.get('country', '') or None,
        'is_returning_guest': bool(r.get('is_returning_guest')),
        'guest_count':      guest_count,
        'adults':           adults,
        'children':         children,
        'daily_rate':       daily_rate,
        'cleaning_fee':     float(r.get('cleaning_fee', 0) or 0),
        'discount_percent': 0,
        'total_price':      total_price,
        'currency':         r.get('currency_code', 'EUR') or 'EUR',
        'payment_method':   'ueberweisung',
        'payment_status':   'bezahlt' if r.get('is_paid') or r.get('paid') else 'offen',
        'invoice_number':   r.get('invoice_number') or None,
        'status':           status,
        'is_owner_block':   is_owner,
        'block_reason':     block_reason if is_owner else None,
        'cancellation_date':   date_str(r.get('cancelled_at') or r.get('cancellation_date')) or None,
        'cancellation_reason': r.get('cancellation_reason') or None,
        'breakfast_included':  bool(r.get('breakfast_included')),
        'pets_allowed':        bool(r.get('pets_allowed')),
        'parking':             True,
        'guest_notes':         guest.get('notes', '') or None,
        'internal_notes':      r.get('notes', '') or r.get('internal_notes', '') or None,
        'guests_registered':   False,
        'deposit_taken':       False,
        'deposit_returned':    False,
        'created_by':          1,
        'included_in_stats':   not is_owner,
    }

# IDs der Owner Blocks die wir explizit gefunden haben
explicit_block_ids = {b.get('id') for b in owner_blocks_raw if b.get('id')}

# Reguläre Buchungen (keine Owner Blocks)
regular = [r for r in reservations if not is_owner_block_record(r)]
# Owner Blocks aus Buchungsliste
implicit_blocks = [r for r in reservations if is_owner_block_record(r)]

print(f"   Aus /v2/reservations: {len(regular)} regulär, {len(implicit_blocks)} Owner Blocks")
print(f"   Explizit gefunden: {len(owner_blocks_raw)} Owner Blocks")

bookings_out = []
for r in regular:
    b = transform_reservation(r, is_block=False)
    if b:
        bookings_out.append(b)

# Alle Owner Blocks transformieren (dedupliziert)
all_block_records = list(owner_blocks_raw)
# Füge auch implizite hinzu, falls nicht schon in owner_blocks_raw
impl_ids = {r.get('id') for r in implicit_blocks if r.get('id')}
for r in implicit_blocks:
    if r.get('id') not in {b.get('id') for b in all_block_records}:
        all_block_records.append(r)

for r in all_block_records:
    b = transform_reservation(r, is_block=True)
    if b:
        bookings_out.append(b)

# Duplikate per ID entfernen (behalte erste Instanz)
seen_ids: set = set()
unique_bookings = []
for b in bookings_out:
    bid = b['id']
    if bid not in seen_ids:
        seen_ids.add(bid)
        unique_bookings.append(b)

regular_count = sum(1 for b in unique_bookings if not b.get('is_owner_block'))
block_count   = sum(1 for b in unique_bookings if     b.get('is_owner_block'))
print(f"   → {regular_count} Buchungen + {block_count} Eigentümer-Sperren = {len(unique_bookings)} gesamt")

# ─── 6. Speichern ───────────────────────────────────────────────────────────

output_path = Path('frontend/public/data')
output_path.mkdir(parents=True, exist_ok=True)

output = {
    'synced_at':    datetime.utcnow().isoformat() + 'Z',
    'date_from':    DATE_FROM,
    'date_to':      DATE_TO,
    'account_id':   ACCOUNT_ID,
    'bookings':     unique_bookings,
    'properties':   list(prop_map.values()),
    'stats': {
        'total':         len(unique_bookings),
        'reservations':  regular_count,
        'owner_blocks':  block_count,
    },
}

out_file = output_path / 'sync.json'
with open(out_file, 'w', encoding='utf-8') as f:
    json.dump(output, f, ensure_ascii=False, indent=2)

print(f"\n✅  Gespeichert: {out_file}  ({out_file.stat().st_size // 1024} KB)")
print(f"   {regular_count} Buchungen, {block_count} Eigentümer-Sperren")
