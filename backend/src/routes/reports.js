const router = require('express').Router();
const db = require('../db/connection');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

// Helper: get date range params
const getRange = (query) => {
  const from = query.from || new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10);
  const to = query.to || new Date().toISOString().slice(0, 10);
  const house_id = query.house_id || null;
  return { from, to, house_id };
};

// KPI Summary: Occupancy, ADR, RevPAR, Revenue, Nights, Bookings
router.get('/kpis', async (req, res) => {
  try {
    const { from, to, house_id } = getRange(req.query);
    const houseFilter = house_id ? 'AND b.house_id = ?' : '';
    const params = house_id ? [from, to, from, to, house_id] : [from, to, from, to];

    // Total available bed-nights in period
    const days = Math.max(1, Math.ceil((new Date(to) - new Date(from)) / 86400000));
    const [[capRow]] = await db.query(
      `SELECT COALESCE(SUM(capacity),0) AS total_capacity FROM houses WHERE active = TRUE ${house_id ? 'AND id = ?' : ''}`,
      house_id ? [house_id] : []
    );
    const availableBedNights = capRow.total_capacity * days;

    const [[kpis]] = await db.query(`
      SELECT
        COUNT(*) AS total_bookings,
        SUM(CASE WHEN status NOT IN ('storniert','no_show') THEN 1 ELSE 0 END) AS confirmed_bookings,
        SUM(CASE WHEN status NOT IN ('storniert','no_show') THEN total_price ELSE 0 END) AS total_revenue,
        SUM(CASE WHEN status NOT IN ('storniert','no_show') THEN nights ELSE 0 END) AS total_nights,
        SUM(CASE WHEN status NOT IN ('storniert','no_show') THEN guest_count * nights ELSE 0 END) AS occupied_bed_nights,
        AVG(CASE WHEN status NOT IN ('storniert','no_show') AND daily_rate > 0 THEN daily_rate ELSE NULL END) AS adr,
        AVG(CASE WHEN status NOT IN ('storniert','no_show') THEN nights ELSE NULL END) AS avg_los,
        AVG(CASE WHEN status NOT IN ('storniert','no_show') THEN DATEDIFF(checkin_date, booking_date) ELSE NULL END) AS avg_lead_time,
        SUM(CASE WHEN status = 'storniert' THEN 1 ELSE 0 END) AS cancellations,
        SUM(CASE WHEN status = 'no_show' THEN 1 ELSE 0 END) AS no_shows,
        SUM(CASE WHEN is_returning_guest = TRUE AND status NOT IN ('storniert','no_show') THEN 1 ELSE 0 END) AS returning_guests
      FROM bookings b
      WHERE checkin_date >= ? AND checkin_date <= ? ${houseFilter}
    `, house_id ? [from, to, house_id] : [from, to]);

    const occupancy = availableBedNights > 0
      ? ((kpis.occupied_bed_nights / availableBedNights) * 100).toFixed(1)
      : 0;
    const revpar = availableBedNights > 0
      ? (kpis.total_revenue / availableBedNights).toFixed(2)
      : 0;
    const cancellationRate = kpis.total_bookings > 0
      ? ((kpis.cancellations / kpis.total_bookings) * 100).toFixed(1)
      : 0;

    res.json({
      ...kpis,
      available_bed_nights: availableBedNights,
      occupancy_rate: parseFloat(occupancy),
      revpar: parseFloat(revpar),
      cancellation_rate: parseFloat(cancellationRate),
      adr: kpis.adr ? parseFloat(kpis.adr).toFixed(2) : 0,
      avg_los: kpis.avg_los ? parseFloat(kpis.avg_los).toFixed(1) : 0,
      avg_lead_time: kpis.avg_lead_time ? Math.round(kpis.avg_lead_time) : 0,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// Occupancy by month
router.get('/occupancy-monthly', async (req, res) => {
  try {
    const { from, to, house_id } = getRange(req.query);
    const houseFilter = house_id ? 'AND b.house_id = ?' : '';

    const [[capRow]] = await db.query(
      `SELECT COALESCE(SUM(capacity),0) AS total_capacity FROM houses WHERE active = TRUE ${house_id ? 'AND id = ?' : ''}`,
      house_id ? [house_id] : []
    );

    const [rows] = await db.query(`
      SELECT
        DATE_FORMAT(checkin_date, '%Y-%m') AS month,
        SUM(CASE WHEN status NOT IN ('storniert','no_show') THEN nights ELSE 0 END) AS booked_nights,
        SUM(CASE WHEN status NOT IN ('storniert','no_show') THEN guest_count * nights ELSE 0 END) AS bed_nights,
        SUM(CASE WHEN status NOT IN ('storniert','no_show') THEN total_price ELSE 0 END) AS revenue,
        AVG(CASE WHEN status NOT IN ('storniert','no_show') AND daily_rate > 0 THEN daily_rate ELSE NULL END) AS adr,
        COUNT(*) AS bookings
      FROM bookings b
      WHERE checkin_date >= ? AND checkin_date <= ? ${houseFilter}
      GROUP BY month ORDER BY month
    `, house_id ? [from, to, house_id] : [from, to]);

    const result = rows.map(r => {
      const daysInMonth = new Date(r.month.slice(0,4), parseInt(r.month.slice(5,7)), 0).getDate();
      const availableBedNights = capRow.total_capacity * daysInMonth;
      return {
        ...r,
        available_bed_nights: availableBedNights,
        occupancy_rate: availableBedNights > 0
          ? parseFloat(((r.bed_nights / availableBedNights) * 100).toFixed(1))
          : 0,
        revpar: availableBedNights > 0
          ? parseFloat((r.revenue / availableBedNights).toFixed(2))
          : 0,
        adr: r.adr ? parseFloat(parseFloat(r.adr).toFixed(2)) : 0,
      };
    });
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// Channel mix
router.get('/channels', async (req, res) => {
  try {
    const { from, to, house_id } = getRange(req.query);
    const houseFilter = house_id ? 'AND b.house_id = ?' : '';
    const [rows] = await db.query(`
      SELECT
        COALESCE(c.name, 'Unbekannt') AS channel,
        c.color,
        COUNT(*) AS bookings,
        SUM(CASE WHEN b.status NOT IN ('storniert','no_show') THEN b.total_price ELSE 0 END) AS revenue,
        SUM(CASE WHEN b.status NOT IN ('storniert','no_show') THEN b.nights ELSE 0 END) AS nights,
        AVG(CASE WHEN b.status NOT IN ('storniert','no_show') AND b.daily_rate > 0 THEN b.daily_rate ELSE NULL END) AS adr
      FROM bookings b
      LEFT JOIN channels c ON b.channel_id = c.id
      WHERE b.checkin_date >= ? AND b.checkin_date <= ? ${houseFilter}
      GROUP BY b.channel_id, c.name, c.color
      ORDER BY revenue DESC
    `, house_id ? [from, to, house_id] : [from, to]);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// Pickup report: bookings received per day for a future date range
router.get('/pickup', async (req, res) => {
  try {
    const { from, to, house_id } = getRange(req.query);
    const houseFilter = house_id ? 'AND house_id = ?' : '';
    const [rows] = await db.query(`
      SELECT
        DATE(booking_date) AS pickup_date,
        COUNT(*) AS new_bookings,
        SUM(total_price) AS revenue,
        SUM(nights) AS nights
      FROM bookings
      WHERE booking_date >= ? AND booking_date <= ?
        AND status NOT IN ('storniert','no_show') ${houseFilter}
      GROUP BY pickup_date ORDER BY pickup_date
    `, house_id ? [from, to, house_id] : [from, to]);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// Lead time distribution
router.get('/lead-time', async (req, res) => {
  try {
    const { from, to, house_id } = getRange(req.query);
    const houseFilter = house_id ? 'AND house_id = ?' : '';
    const [rows] = await db.query(`
      SELECT
        CASE
          WHEN DATEDIFF(checkin_date, booking_date) = 0 THEN 'Same Day'
          WHEN DATEDIFF(checkin_date, booking_date) <= 3 THEN '1-3 Tage'
          WHEN DATEDIFF(checkin_date, booking_date) <= 7 THEN '4-7 Tage'
          WHEN DATEDIFF(checkin_date, booking_date) <= 14 THEN '1-2 Wochen'
          WHEN DATEDIFF(checkin_date, booking_date) <= 30 THEN '2-4 Wochen'
          WHEN DATEDIFF(checkin_date, booking_date) <= 60 THEN '1-2 Monate'
          ELSE '> 2 Monate'
        END AS lead_time_bucket,
        COUNT(*) AS bookings,
        AVG(total_price) AS avg_revenue
      FROM bookings
      WHERE checkin_date >= ? AND checkin_date <= ?
        AND status NOT IN ('storniert','no_show') ${houseFilter}
      GROUP BY lead_time_bucket
      ORDER BY MIN(DATEDIFF(checkin_date, booking_date))
    `, house_id ? [from, to, house_id] : [from, to]);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// Year-over-Year comparison
router.get('/yoy', async (req, res) => {
  try {
    const { house_id } = req.query;
    const currentYear = new Date().getFullYear();
    const houseFilter = house_id ? 'AND b.house_id = ?' : '';

    const yearData = async (year) => {
      const [[capRow]] = await db.query(
        `SELECT COALESCE(SUM(capacity),0) AS total_capacity FROM houses WHERE active = TRUE ${house_id ? 'AND id = ?' : ''}`,
        house_id ? [house_id] : []
      );
      const [rows] = await db.query(`
        SELECT
          DATE_FORMAT(checkin_date, '%m') AS month,
          COUNT(*) AS bookings,
          SUM(CASE WHEN status NOT IN ('storniert','no_show') THEN total_price ELSE 0 END) AS revenue,
          SUM(CASE WHEN status NOT IN ('storniert','no_show') THEN nights ELSE 0 END) AS nights,
          SUM(CASE WHEN status NOT IN ('storniert','no_show') THEN guest_count * nights ELSE 0 END) AS bed_nights,
          AVG(CASE WHEN status NOT IN ('storniert','no_show') AND daily_rate > 0 THEN daily_rate ELSE NULL END) AS adr
        FROM bookings b
        WHERE YEAR(checkin_date) = ? ${houseFilter}
        GROUP BY month ORDER BY month
      `, house_id ? [year, house_id] : [year]);
      return { year, capacity: capRow.total_capacity, months: rows };
    };

    const [current, previous] = await Promise.all([
      yearData(currentYear),
      yearData(currentYear - 1),
    ]);
    res.json({ current, previous });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// Occupancy forecast: next 90 days
router.get('/forecast', async (req, res) => {
  try {
    const { house_id } = req.query;
    const today = new Date().toISOString().slice(0, 10);
    const end90 = new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10);
    const houseFilter = house_id ? 'AND b.house_id = ?' : '';

    const [[capRow]] = await db.query(
      `SELECT COALESCE(SUM(capacity),0) AS total_capacity FROM houses WHERE active = TRUE ${house_id ? 'AND id = ?' : ''}`,
      house_id ? [house_id] : []
    );

    const [rows] = await db.query(`
      SELECT
        DATE_FORMAT(checkin_date, '%Y-%m') AS month,
        SUM(nights) AS booked_nights,
        SUM(guest_count * nights) AS bed_nights_booked,
        SUM(total_price) AS revenue,
        COUNT(*) AS bookings
      FROM bookings b
      WHERE checkin_date >= ? AND checkin_date <= ?
        AND status NOT IN ('storniert','no_show') ${houseFilter}
      GROUP BY month ORDER BY month
    `, house_id ? [today, end90, house_id] : [today, end90]);

    const result = rows.map(r => {
      const daysInMonth = new Date(r.month.slice(0,4), parseInt(r.month.slice(5,7)), 0).getDate();
      const availableBedNights = capRow.total_capacity * daysInMonth;
      return {
        ...r,
        available_bed_nights: availableBedNights,
        occupancy_rate: availableBedNights > 0
          ? parseFloat(((r.bed_nights_booked / availableBedNights) * 100).toFixed(1))
          : 0,
      };
    });
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// House comparison
router.get('/houses', async (req, res) => {
  try {
    const { from, to } = getRange(req.query);
    const [rows] = await db.query(`
      SELECT
        h.id, h.name, h.short_name, h.capacity,
        COUNT(b.id) AS bookings,
        SUM(CASE WHEN b.status NOT IN ('storniert','no_show') THEN b.total_price ELSE 0 END) AS revenue,
        SUM(CASE WHEN b.status NOT IN ('storniert','no_show') THEN b.nights ELSE 0 END) AS nights,
        AVG(CASE WHEN b.status NOT IN ('storniert','no_show') AND b.daily_rate > 0 THEN b.daily_rate ELSE NULL END) AS adr,
        SUM(CASE WHEN b.status = 'storniert' THEN 1 ELSE 0 END) AS cancellations
      FROM houses h
      LEFT JOIN bookings b ON b.house_id = h.id AND b.checkin_date >= ? AND b.checkin_date <= ?
      WHERE h.active = TRUE
      GROUP BY h.id ORDER BY h.id
    `, [from, to]);
    const days = Math.max(1, Math.ceil((new Date(to) - new Date(from)) / 86400000));
    const result = rows.map(h => ({
      ...h,
      available_bed_nights: h.capacity * days,
      occupancy_rate: h.capacity * days > 0
        ? parseFloat(((h.nights / (h.capacity * days)) * 100).toFixed(1))
        : 0,
      revpar: h.capacity * days > 0
        ? parseFloat((h.revenue / (h.capacity * days)).toFixed(2))
        : 0,
      adr: h.adr ? parseFloat(parseFloat(h.adr).toFixed(2)) : 0,
    }));
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// Guest nationality breakdown
router.get('/nationalities', async (req, res) => {
  const { from, to, house_id } = getRange(req.query);
  const houseFilter = house_id ? 'AND house_id = ?' : '';
  const [rows] = await db.query(`
    SELECT
      COALESCE(nationality, 'Unbekannt') AS nationality,
      COUNT(*) AS bookings,
      SUM(total_price) AS revenue
    FROM bookings
    WHERE checkin_date >= ? AND checkin_date <= ?
      AND status NOT IN ('storniert','no_show') ${houseFilter}
    GROUP BY nationality ORDER BY bookings DESC LIMIT 20
  `, house_id ? [from, to, house_id] : [from, to]);
  res.json(rows);
});

module.exports = router;
