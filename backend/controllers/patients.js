const db = require('../database/db');
const { pick } = require('./crud');

const FIELDS = ['name', 'age', 'gender', 'phone', 'email', 'address'];

// Patient row + last visit + current treatment (used by list, details and dashboard)
const SELECT = `SELECT p.*,
  NULLIF(GREATEST(
    COALESCE((SELECT MAX(appointment_date) FROM appointments WHERE patient_id = p.id AND status = 'Completed'), '1900-01-01'),
    COALESCE((SELECT MAX(DATE(created_at)) FROM consultations WHERE patient_id = p.id), '1900-01-01')
  ), '1900-01-01') AS last_visit,
  (SELECT CONCAT(name, IF(tooth_number IS NULL, '', CONCAT(' - Tooth ', tooth_number)))
     FROM treatments WHERE patient_id = p.id AND status = 'In Progress' ORDER BY id DESC LIMIT 1) AS current_treatment
  FROM patients p`;
exports.SELECT = SELECT;

exports.list = async (req, res) => {
  const q = `%${req.query.q || ''}%`;
  const [rows] = await db.query(
    `${SELECT} WHERE p.name LIKE ? OR p.patient_code LIKE ? OR p.phone LIKE ? ORDER BY p.id DESC`, [q, q, q]);
  res.json(rows);
};

exports.get = async (req, res) => {
  const [rows] = await db.query(`${SELECT} WHERE p.id = ?`, [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Patient not found' });
  res.json(rows[0]);
};

exports.create = async (req, res) => {
  const [r] = await db.query('INSERT INTO patients SET ?', [pick(req.body, FIELDS)]);
  const code = 'PAT-' + String(r.insertId).padStart(3, '0');
  await db.query('UPDATE patients SET patient_code = ? WHERE id = ?', [code, r.insertId]);
  res.status(201).json({ id: r.insertId, patient_code: code });
};

exports.update = async (req, res) => {
  await db.query('UPDATE patients SET ? WHERE id = ?', [pick(req.body, FIELDS), req.params.id]);
  res.json({ ok: true });
};

exports.remove = async (req, res) => {
  await db.query('DELETE FROM patients WHERE id = ?', [req.params.id]); // child rows cascade
  res.json({ ok: true });
};

// ---- Medical history (one row per patient) ----
const MED = ['allergies', 'medical_conditions', 'current_medications', 'previous_surgeries', 'blood_group', 'tobacco_history', 'notes'];

exports.getMedical = async (req, res) => {
  const [rows] = await db.query('SELECT * FROM medical_history WHERE patient_id = ?', [req.params.id]);
  res.json(rows[0] || {});
};

exports.saveMedical = async (req, res) => {
  const d = pick(req.body, MED);
  await db.query('INSERT INTO medical_history SET ?, patient_id = ? ON DUPLICATE KEY UPDATE ?', [d, req.params.id, d]);
  res.json({ ok: true });
};

// ---- Dental chart (one row per tooth per patient) ----
exports.getTeeth = async (req, res) => {
  const [rows] = await db.query('SELECT * FROM teeth WHERE patient_id = ?', [req.params.id]);
  res.json(rows);
};

exports.saveTooth = async (req, res) => {
  const d = pick(req.body, ['tooth_number', 'tooth_condition', 'notes', 'updated_date']);
  await db.query('INSERT INTO teeth SET ?, patient_id = ? ON DUPLICATE KEY UPDATE ?', [d, req.params.id, d]);
  res.json({ ok: true });
};

// ---- Overview cards ----
exports.overview = async (req, res) => {
  const id = req.params.id;
  const [med] = await db.query('SELECT * FROM medical_history WHERE patient_id = ?', [id]);
  const medical = med[0] || null;
  const [treatments] = await db.query("SELECT * FROM treatments WHERE patient_id = ? AND status = 'In Progress'", [id]);
  const [appts] = await db.query(
    `SELECT * FROM appointments WHERE patient_id = ? AND status = 'Scheduled' AND appointment_date >= CURDATE()
     ORDER BY appointment_date, appointment_time LIMIT 1`, [id]);
  const [[t]] = await db.query('SELECT COALESCE(SUM(total), 0) AS total FROM invoices WHERE patient_id = ?', [id]);
  const [[p]] = await db.query('SELECT COALESCE(SUM(amount), 0) AS paid FROM payments WHERE patient_id = ?', [id]);
  const [followups] = await db.query(
    "SELECT * FROM followups WHERE patient_id = ? AND status = 'Pending' ORDER BY followup_date LIMIT 5", [id]);
  res.json({
    medical, treatments, followups,
    next_appointment: appts[0] || null,
    billing: { total: t.total, paid: p.paid, pending: t.total - p.paid },
  });
};

// ---- Timeline: everything that happened, newest first ----
exports.timeline = async (req, res) => {
  const id = req.params.id;
  const sql = `
    SELECT DATE(created_at) AS d, 'consultation' AS type, CONCAT('Consultation: ', chief_complaint) AS title FROM consultations WHERE patient_id = ?
    UNION ALL SELECT diagnosis_date, 'diagnosis', CONCAT('Diagnosis: ', diagnosis, IF(tooth_number IS NULL, '', CONCAT(' (Tooth ', tooth_number, ')'))) FROM diagnoses WHERE patient_id = ?
    UNION ALL SELECT DATE(created_at), 'treatment', CONCAT('Treatment planned: ', name) FROM treatments WHERE patient_id = ?
    UNION ALL SELECT s.session_date, 'session', CONCAT('Session - ', t.name, IF(s.notes IS NULL, '', CONCAT(': ', s.notes))) FROM treatment_sessions s JOIN treatments t ON t.id = s.treatment_id WHERE t.patient_id = ?
    UNION ALL SELECT taken_date, 'image', CONCAT(image_type, ' uploaded') FROM images WHERE patient_id = ?
    UNION ALL SELECT DATE(created_at), 'prescription', 'Prescription created' FROM prescriptions WHERE patient_id = ?
    UNION ALL SELECT appointment_date, 'appointment', CONCAT('Appointment (', status, '): ', COALESCE(type, '')) FROM appointments WHERE patient_id = ?
    UNION ALL SELECT followup_date, 'followup', CONCAT('Follow-up ', LOWER(status), IF(treatment IS NULL, '', CONCAT(': ', treatment))) FROM followups WHERE patient_id = ?
    UNION ALL SELECT payment_date, 'payment', CONCAT('Payment received: Rs. ', amount, ' (', method, ')') FROM payments WHERE patient_id = ?
    ORDER BY d DESC`;
  const [rows] = await db.query(sql, Array(9).fill(id));
  res.json(rows);
};
