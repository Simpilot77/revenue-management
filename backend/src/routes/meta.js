const router = require('express').Router();
const db = require('../db/connection');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/houses', async (req, res) => {
  const [rows] = await db.query('SELECT * FROM houses WHERE active = TRUE ORDER BY id');
  res.json(rows);
});

router.get('/channels', async (req, res) => {
  const [rows] = await db.query('SELECT * FROM channels WHERE active = TRUE ORDER BY name');
  res.json(rows);
});

module.exports = router;
