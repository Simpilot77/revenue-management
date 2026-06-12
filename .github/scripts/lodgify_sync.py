#!/usr/bin/env python3
"""
Lodgify → Revenue Management sync script.
Nutzt /v1/reservation (korrekte API) mit offset/limit Pagination.
"""

import os, json, sys, requests
from datetime import datetime, date as dt_date
from pathlib import Path

API_KEY    = os.environ.get('LODGIFY_API_KEY', '').strip()
ACCOUNT_ID = os.environ.get('LODGIFY_ACCOUNT_ID', '')
BASE_URL   = 'https://api.lodgify.com'

if not API_KEY:
    print("❌  LODGIFY_API_KEY nicht gesetzt – Abbruch.")
    sys.exit(1)

HOUSE_MAP: dict = {}
try:
    raw = os.environ.get('HOUSE_MAP', '')
    if raw:
        HOUSE_MAP = {str(k): int(v) for k, v in json.loads(raw).items()}
except Exception as e:
    print(f"⚠  HOUSE_MAP Fehler: {e}")

HEADERS = {'X-ApiKey': API_KEY, 'Accept': 'application/json'}

def get(path, params=None):
    r = requests.get(f"{BASE_URL}{path}", headers=HEADERS, params=params or {}, timeout=30)
    print(f"  GET {path} {params} → {r.status_code}")
    if not r.ok:
        print(f"     {r.text[:300]}")
    r.raise_for_status()
    return r.json()

def date_str(val):
    if not val: return ''
    return str(val)[:10]

def nights_between(a, b):
    try:
        return max(0, (dt_date.fromisoformat(b[:10]) - dt_date.fromisoformat(a[:10])).days)
    except: return 0

today = dt_date.today().isoformat()

print(f"\n{'='*60}\nLodgify Sync\n{'='*60}\n")

# 1. Properties
print("1️⃣  Hole Properties …")
raw = get('/v2/properties')
props = raw if isinstance(raw, list) else raw.get('items', [])
print(f"   → {len(props)} Properties")

short_labels = ['A','B','C','D','E']
prop_map = {}
for idx, p in enumerate(props, 1):
    pid = p['id']
    hid = HOUSE_MAP.get(str(pid), idx)
    prop_map[pid] = {
        'house_id': hid,
        'house_name': p.get('name', f'Haus {hid}'),
        'house_short': short_labels[hid-1] if hid <= 5 else str(hid),
        'house_capacity': p.get('guests_max') or p.get('max_people') or 6,
    }
    print(f"   • [{pid}] {p.get('name')} → house_id={hid}")

# 2. Buchungen über /v1/reservation (korrekte API, mit offset/limit)
print("\n2️⃣  Hole Buchungen …")
all_items = []
limit, offset = 50, 0
while True:
    data = get('/v1/reservation', {'offset': offset, 'limit': limit})
    items = data.get('items', [])
    if not items: break
    all_items.extend(items)
    total = data.get('total', len(items))
    print(f"   offset={offset}: {len(items)} Buchungen (gesamt: {total})")
    if len(all_items) >= total or len(items) < limit:
        break
    offset += limit

print(f"   → {len(all_items)} Buchungen geladen")
if all_items:
    print(f"   Felder: {list(all_items[0].keys())}")

# 3. Kanal-Mapping
CHANNEL_MAP = {
    'manual':            {'id': 1, 'name': 'Direkt',          'short': 'DIREKT',  'color': '#10b981'},
    'direct':            {'id': 1, 'name': 'Direkt',          'short': 'DIREKT',  'color': '#10b981'},
    'bookingcom':        {'id': 2, 'name': 'Booking.com',     'short': 'BDC',     'color': '#003580'},
    'airbnbintegration': {'id': 3, 'name': 'Airbnb',          'short': 'AIRBNB',  'color': '#ff5a5f'},
    'airbnb':            {'id': 3, 'name': 'Airbnb',          'short': 'AIRBNB',  'color': '#ff5a5f'},
    'hrs':               {'id': 4, 'name': 'HRS',             'short': 'HRS',     'color': '#e65100'},
    'homeaway':          {'id': 5, 'name': 'Expedia/HomeAway','short': 'EXPEDIA', 'color': '#ffc107'},
    'owner':             {'id': None, 'name': 'Eigentümer',   'short': 'OWNER',   'color': '#64748b'},
}
def get_channel(source):
    key = (source or '').lower().replace(' ','').replace('.','').replace('-','').replace('_','')
    if key in CHANNEL_MAP: return CHANNEL_MAP[key]
    for k, v in CHANNEL_MAP.items():
        if k in key or key in k: return v
    return {'id': 7, 'name': source or 'Direkt', 'short': (source or 'DIR')[:6].upper(), 'color': '#6b7280'}

STATUS_MAP = {
    'booked': 'bestaetigt', 'open': 'angefragt', 'bookingrequest': 'angefragt',
    'cancelled': 'storniert', 'canceled': 'storniert', 'declined': 'storniert',
    'checkedin': 'eingecheckt', 'checkedout': 'ausgecheckt',
    'closed': 'ausgecheckt', 'completed': 'ausgecheckt',
}
OWNER_SOURCES = {'owner','ownerblock','owneruse','blocked','maintenance','unavailable'}

def is_owner(r):
    src = (r.get('source') or '').lower().replace(' ','').replace('_','')
    typ = (r.get('type') or '').lower().replace(' ','').replace('_','')
    return r.get('is_blocked') or src in OWNER_SOURCES or typ in OWNER_SOURCES

# 4. Transformation
print("\n3️⃣  Transformiere …")
bookings_out = []
for r in all_items:
    arrival   = date_str(r.get('arrival'))
    departure = date_str(r.get('departure'))
    if not arrival or not departure or arrival >= departure:
        continue

    is_block = is_owner(r)
    pid = r.get('property_id') or (r.get('rooms') or [{}])[0].get('property_id')
    prop = prop_map.get(pid, list(prop_map.values())[0] if prop_map else
           {'house_id':1,'house_name':'Haus 1','house_short':'A','house_capacity':6})

    channel = CHANNEL_MAP['owner'] if is_block else get_channel(r.get('source',''))
    nights  = r.get('nights') or nights_between(arrival, departure)
    status_key = (r.get('status') or '').lower().replace(' ','').replace('_','')
    status  = 'gesperrt' if is_block else STATUS_MAP.get(status_key, 'bestaetigt')

    guest = r.get('guest') or {}
    if not isinstance(guest, dict): guest = {}
    guest_name = 'Eigentümer (gesperrt)' if is_block else (
        guest.get('full_name') or guest.get('guest_name') or guest.get('name') or
        f"{guest.get('first_name','')} {guest.get('last_name','')}".strip() or 'Unbekannt'
    )

    people = r.get('people') or {}
    adults   = people.get('adults', 0) if isinstance(people, dict) else int(people or 1)
    children = people.get('children', 0) if isinstance(people, dict) else 0

    total_price = float(r.get('total_amount') or r.get('total_price') or 0)
    daily_rate  = round(total_price / nights, 2) if nights > 0 and total_price > 0 else 0

    bookings_out.append({
        'id':               r['id'],
        'house_id':         prop['house_id'],
        'house_name':       prop['house_name'],
        'house_short':      prop['house_short'],
        'house_capacity':   prop['house_capacity'],
        'channel_id':       channel['id'],
        'channel_name':     channel['name'],
        'channel_short':    channel['short'],
        'channel_color':    channel['color'],
        'external_reference': str(r['id']),
        'booking_date':     date_str(r.get('created_at')) or today,
        'checkin_date':     arrival,
        'checkout_date':    departure,
        'nights':           nights,
        'guest_name':       guest_name,
        'company_name':     guest.get('company') or None,
        'guest_email':      guest.get('email') or None,
        'guest_phone':      guest.get('phone') or (guest.get('phone_numbers') or [None])[0],
        'nationality':      guest.get('country_code') or guest.get('country_name') or None,
        'is_returning_guest': False,
        'guest_count':      adults + children or (0 if is_block else 1),
        'adults':           adults,
        'children':         children,
        'daily_rate':       daily_rate,
        'cleaning_fee':     0,
        'discount_percent': 0,
        'total_price':      total_price,
        'currency':         r.get('currency') or 'EUR',
        'payment_method':   'ueberweisung',
        'payment_status':   'bezahlt' if (r.get('total_paid') or 0) >= total_price > 0 else 'offen',
        'invoice_number':   None,
        'status':           status,
        'is_owner_block':   is_block,
        'block_reason':     (r.get('notes') or r.get('reason') or '') if is_block else None,
        'cancellation_date': None,
        'cancellation_reason': None,
        'breakfast_included': False,
        'pets_allowed':       False,
        'parking':            True,
        'guest_notes':        guest.get('notes') or None,
        'internal_notes':     r.get('notes') or None,
        'guests_registered':  False,
        'deposit_taken':      False,
        'deposit_returned':   False,
        'created_by':         1,
        'included_in_stats':  not is_block,
    })

regular = [b for b in bookings_out if not b['is_owner_block']]
blocks   = [b for b in bookings_out if b['is_owner_block']]
print(f"   → {len(regular)} Buchungen + {len(blocks)} Eigentümer-Sperren = {len(bookings_out)} gesamt")

# 5. Speichern
output_path = Path('frontend/public/data')
output_path.mkdir(parents=True, exist_ok=True)
out = {
    'synced_at':  datetime.utcnow().isoformat() + 'Z',
    'bookings':   bookings_out,
    'properties': list(prop_map.values()),
    'stats':      {'total': len(bookings_out), 'reservations': len(regular), 'owner_blocks': len(blocks)},
}
out_file = output_path / 'sync.json'
with open(out_file, 'w', encoding='utf-8') as f:
    json.dump(out, f, ensure_ascii=False, indent=2)
print(f"\n✅  {out_file}  ({out_file.stat().st_size // 1024} KB) — {len(regular)} Buchungen, {len(blocks)} Sperren")
