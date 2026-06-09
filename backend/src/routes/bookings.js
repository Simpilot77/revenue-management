const router = require('express').Router();
const db = require('../db/connection');
const { authenticate, requireManager } = require('../middleware/auth');

router.use(authenticate);

const BOOKING_SELECT = `
  SELECT b.*,
    h.name AS house_name, h.short_name AS house_short, h.capacity AS house_capacity,
    c.name AS channel_name, c.short_name AS channel_short, c.color AS channel_color,
    u.name AS created_by_name
  FROM bookings b
  LEFT JOIN houses h ON b.house_id = h.id
  LEFT JOIN channels c ON b.channel_id = c.id
  LEFT JOIN users u ON b.created_by = u.id
`;

router.get('/', async (req, res) => {
  try {
    const { from, to, house_id, channel_id, status, search, page = 1, limit = 50 } = req.query;
    const conditions = [];
    const values = [];

    if (from) { conditions.push('b.checkin_date >= ?'); values.push(from); }
    if (to) { conditions.push('b.checkout_date <= ?'); values.push(to); }
    if (house_id) { conditions.push('b.house_id = ?'); values.push(house_id); }
    if (channel_id) { conditions.push('b.channel_id = ?'); values.push(channel_id); }
    if (status) { conditions.push('b.status = ?'); values.push(status); }
    if (search) {
      conditions.push('(b.guest_name LIKE ? OR b.company_name LIKE ? OR b.external_reference LIKE ?)');
      values.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) AS total FROM bookings b ${where}`,
      values
    );
    const [rows] = await db.query(
      `${BOOKING_SELECT} ${where} ORDER BY b.checkin_date DESC LIMIT ? OFFSET ?`,
      [...values, parseInt(limit), offset]
    );
    res.json({ data: rows, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

router.get('/:id', async (req, res) => {
  const [rows] = await db.query(`${BOOKING_SELECT} WHERE b.id = ?`, [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Buchung nicht gefunden' });
  res.json(rows[0]);
});

router.post('/', requireManager, async (req, res) => {
  try {
    const {
      house_id, channel_id, external_reference,
      booking_date, checkin_date, checkout_date,
      guest_name, company_name, guest_email, guest_phone, nationality, is_returning_guest,
      guest_count, adults, children,
      daily_rate, cleaning_fee, discount_percent, total_price, currency,
      payment_method, payment_status, invoice_number,
      status, cancellation_date, cancellation_reason,
      breakfast_included, pets_allowed, parking,
      guest_notes, internal_notes
    } = req.body;

    if (!house_id || !booking_date || !checkin_date || !checkout_date || !guest_name || !total_price) {
      return res.status(400).json({ error: 'Pflichtfelder fehlen: Haus, Buchungsdatum, An/Abreise, Gastname, Gesamtpreis' });
    }
    if (checkin_date >= checkout_date) {
      return res.status(400).json({ error: 'Abreisedatum muss nach Anreisedatum liegen' });
    }

    const [result] = await db.query(
      `INSERT INTO bookings (
        house_id, channel_id, external_reference,
        booking_date, checkin_date, checkout_date,
        guest_name, company_name, guest_email, guest_phone, nationality, is_returning_guest,
        guest_count, adults, children,
        daily_rate, cleaning_fee, discount_percent, total_price, currency,
        payment_method, payment_status, invoice_number,
        status, cancellation_date, cancellation_reason,
        breakfast_included, pets_allowed, parking,
        guest_notes, internal_notes, created_by
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        house_id, channel_id || null, external_reference || null,
        booking_date, checkin_date, checkout_date,
        guest_name, company_name || null, guest_email || null, guest_phone || null,
        nationality || null, is_returning_guest || false,
        guest_count || 1, adults || 1, children || 0,
        daily_rate || null, cleaning_fee || 0, discount_percent || 0, total_price, currency || 'EUR',
        payment_method || 'ueberweisung', payment_status || 'offen', invoice_number || null,
        status || 'bestaetigt', cancellation_date || null, cancellation_reason || null,
        breakfast_included || false, pets_allowed || false, parking || false,
        guest_notes || null, internal_notes || null, req.user.id
      ]
    );
    const [rows] = await db.query(`${BOOKING_SELECT} WHERE b.id = ?`, [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

router.put('/:id', requireManager, async (req, res) => {
  try {
    const fields = [];
    const values = [];
    const allowed = [
      'house_id','channel_id','external_reference','booking_date','checkin_date','checkout_date',
      'guest_name','company_name','guest_email','guest_phone','nationality','is_returning_guest',
      'guest_count','adults','children','daily_rate','cleaning_fee','discount_percent',
      'total_price','currency','payment_method','payment_status','invoice_number',
      'status','cancellation_date','cancellation_reason',
      'breakfast_included','pets_allowed','parking','guest_notes','internal_notes'
    ];
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        fields.push(`${key} = ?`);
        values.push(req.body[key]);
      }
    }
    if (!fields.length) return res.status(400).json({ error: 'Keine Felder angegeben' });
    values.push(req.params.id);
    await db.query(`UPDATE bookings SET ${fields.join(', ')} WHERE id = ?`, values);
    const [rows] = await db.query(`${BOOKING_SELECT} WHERE b.id = ?`, [req.params.id]);
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

router.delete('/:id', requireManager, async (req, res) => {
  await db.query('DELETE FROM bookings WHERE id = ?', [req.params.id]);
  res.json({ message: 'Buchung gelöscht' });
});

// Generate next invoice number: {house_number}-{YYYY}-{0001}
router.get('/next-invoice-number', requireManager, async (req, res) => {
  try {
    const { house_id } = req.query;
    if (!house_id) return res.status(400).json({ error: 'house_id erforderlich' });

    const [[house]] = await db.query('SELECT house_number FROM houses WHERE id = ?', [house_id]);
    if (!house) return res.status(404).json({ error: 'Haus nicht gefunden' });

    const year = new Date().getFullYear();
    const prefix = `${house.house_number}-${year}-`;
    const [[row]] = await db.query(
      `SELECT invoice_number FROM bookings
       WHERE invoice_number LIKE ? AND invoice_number REGEXP ?
       ORDER BY invoice_number DESC LIMIT 1`,
      [`${prefix}%`, `^${house.house_number.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-${year}-[0-9]+$`]
    );
    let next = 1;
    if (row?.invoice_number) {
      const parts = row.invoice_number.split('-');
      next = parseInt(parts[parts.length - 1]) + 1;
    }
    res.json({ invoice_number: `${prefix}${String(next).padStart(4, '0')}` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

module.exports = router;
