const db = require('../database/db');
const makeCrud = require('./crud');

// attach sessions[] to each treatment
const withSessions = async (rows) => {
  if (!rows.length) return rows;
  const [s] = await db.query(
    'SELECT * FROM treatment_sessions WHERE treatment_id IN (?) ORDER BY session_date, id', [rows.map((r) => r.id)]);
  return rows.map((r) => ({ ...r, sessions: s.filter((x) => x.treatment_id === r.id) }));
};

exports.crud = makeCrud('treatments',
  ['name', 'tooth_number', 'diagnosis', 'cost', 'sessions_planned', 'status', 'notes'], 'id DESC', withSessions);

exports.addSession = async (req, res) => {
  const { session_date, notes } = req.body;
  await db.query('INSERT INTO treatment_sessions SET ?', [{
    treatment_id: req.params.rid,
    session_date: session_date || new Date().toISOString().slice(0, 10),
    notes: notes || null,
  }]);
  await db.query("UPDATE treatments SET status = 'In Progress' WHERE id = ? AND status = 'Planned'", [req.params.rid]);
  res.status(201).json({ ok: true });
};

exports.removeSession = async (req, res) => {
  await db.query('DELETE FROM treatment_sessions WHERE id = ?', [req.params.rid]);
  res.json({ ok: true });
};
