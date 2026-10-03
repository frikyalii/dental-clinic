const db = require('../database/db');

const BASE = `SELECT rx.*, p.name AS patient_name, p.patient_code, p.age, p.gender
  FROM prescriptions rx JOIN patients p ON p.id = rx.patient_id`;

const withItems = async (rows) => {
  if (!rows.length) return rows;
  const [items] = await db.query('SELECT * FROM prescription_items WHERE prescription_id IN (?) ORDER BY id', [rows.map((r) => r.id)]);
  return rows.map((r) => ({ ...r, items: items.filter((i) => i.prescription_id === r.id) }));
};

exports.listAll = async (req, res) => {
  const [rows] = await db.query(`${BASE} ORDER BY rx.id DESC`);
  res.json(await withItems(rows));
};

exports.listByPatient = async (req, res) => {
  const [rows] = await db.query(`${BASE} WHERE rx.patient_id = ? ORDER BY rx.id DESC`, [req.params.id]);
  res.json(await withItems(rows));
};

exports.create = async (req, res) => {
  const { patient_id, notes, items = [] } = req.body;
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [r] = await conn.query('INSERT INTO prescriptions SET ?', [{ patient_id, notes: notes || null }]);
    if (items.length) {
      await conn.query(
        'INSERT INTO prescription_items (prescription_id, medicine, dosage, frequency, duration, instructions) VALUES ?',
        [items.map((i) => [r.insertId, i.medicine, i.dosage || null, i.frequency || null, i.duration || null, i.instructions || null])]);
    }
    await conn.commit();
    res.status(201).json({ id: r.insertId });
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
};

exports.remove = async (req, res) => {
  await db.query('DELETE FROM prescriptions WHERE id = ?', [req.params.rid]);
  res.json({ ok: true });
};
