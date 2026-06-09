const router = require('express').Router();
const bcrypt = require('bcryptjs');
const db = require('../db/connection');
const { authenticate, requireAdmin } = require('../middleware/auth');

router.use(authenticate);

router.get('/', requireAdmin, async (req, res) => {
  const [rows] = await db.query(
    'SELECT id, name, email, role, active, created_at FROM users ORDER BY name'
  );
  res.json(rows);
});

router.post('/', requireAdmin, async (req, res) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password || password.length < 8) {
    return res.status(400).json({ error: 'Name, E-Mail und Passwort (min. 8 Zeichen) erforderlich' });
  }
  const [existing] = await db.query('SELECT id FROM users WHERE email = ?', [email.toLowerCase()]);
  if (existing.length) return res.status(409).json({ error: 'E-Mail bereits vergeben' });

  const hash = await bcrypt.hash(password, 12);
  const [result] = await db.query(
    'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
    [name.trim(), email.toLowerCase().trim(), hash, role || 'viewer']
  );
  res.status(201).json({ id: result.insertId, name, email, role: role || 'viewer' });
});

router.put('/:id', requireAdmin, async (req, res) => {
  const { name, email, role, active, password } = req.body;
  const fields = [];
  const values = [];
  if (name) { fields.push('name = ?'); values.push(name.trim()); }
  if (email) { fields.push('email = ?'); values.push(email.toLowerCase().trim()); }
  if (role) { fields.push('role = ?'); values.push(role); }
  if (active !== undefined) { fields.push('active = ?'); values.push(active); }
  if (password && password.length >= 8) {
    fields.push('password_hash = ?');
    values.push(await bcrypt.hash(password, 12));
  }
  if (!fields.length) return res.status(400).json({ error: 'Keine Felder zum Aktualisieren' });
  values.push(req.params.id);
  await db.query(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values);
  res.json({ message: 'Benutzer aktualisiert' });
});

router.delete('/:id', requireAdmin, async (req, res) => {
  if (parseInt(req.params.id) === req.user.id) {
    return res.status(400).json({ error: 'Eigenen Account nicht löschbar' });
  }
  await db.query('UPDATE users SET active = FALSE WHERE id = ?', [req.params.id]);
  res.json({ message: 'Benutzer deaktiviert' });
});

module.exports = router;
