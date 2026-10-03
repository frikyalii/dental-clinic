const fs = require('fs');
const path = require('path');
const multer = require('multer');
const db = require('../database/db');

const dir = path.join(__dirname, '../uploads');
fs.mkdirSync(dir, { recursive: true });

exports.upload = multer({
  storage: multer.diskStorage({
    destination: dir,
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname.replace(/[^\w.\-]/g, '_')),
  }),
}).single('file');

exports.create = async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Please choose a file' });
  const b = req.body;
  await db.query('INSERT INTO images SET ?', [{
    patient_id: b.patient_id,
    filename: req.file.filename,
    image_type: b.image_type || 'X-Ray',
    tooth_number: b.tooth_number || null,
    description: b.description || null,
    notes: b.notes || null,
    taken_date: b.taken_date || new Date().toISOString().slice(0, 10),
  }]);
  res.status(201).json({ ok: true });
};

const BASE = 'SELECT i.*, p.name AS patient_name, p.patient_code FROM images i JOIN patients p ON p.id = i.patient_id';

exports.listAll = async (req, res) => {
  const [rows] = await db.query(`${BASE} ORDER BY i.taken_date DESC, i.id DESC`);
  res.json(rows);
};

exports.listByPatient = async (req, res) => {
  const [rows] = await db.query(`${BASE} WHERE i.patient_id = ? ORDER BY i.taken_date DESC, i.id DESC`, [req.params.id]);
  res.json(rows);
};

exports.remove = async (req, res) => {
  const [[img]] = await db.query('SELECT filename FROM images WHERE id = ?', [req.params.rid]);
  await db.query('DELETE FROM images WHERE id = ?', [req.params.rid]);
  if (img) fs.unlink(path.join(dir, img.filename), () => {});
  res.json({ ok: true });
};
