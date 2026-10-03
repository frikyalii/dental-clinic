const db = require('../database/db');
const patients = require('./patients');

exports.summary = async (req, res) => {
  const [[pt]] = await db.query('SELECT COUNT(*) AS n FROM patients');
  const [[ap]] = await db.query("SELECT COUNT(*) AS n FROM appointments WHERE appointment_date = CURDATE() AND status <> 'Cancelled'");
  const [[tr]] = await db.query("SELECT COUNT(*) AS n FROM treatments WHERE status = 'In Progress'");
  const [[fu]] = await db.query("SELECT COUNT(*) AS n FROM followups WHERE status = 'Pending'");
  const [[pay]] = await db.query(`SELECT COUNT(*) AS n, COALESCE(SUM(pending), 0) AS amount FROM (
    SELECT i.total - COALESCE((SELECT SUM(amount) FROM payments WHERE invoice_id = i.id), 0) AS pending FROM invoices i) x
    WHERE pending > 0`);
  const [today] = await db.query(
    `SELECT a.*, p.name AS patient_name, p.patient_code FROM appointments a JOIN patients p ON p.id = a.patient_id
     WHERE a.appointment_date = CURDATE() ORDER BY a.appointment_time`);
  const [recent] = await db.query(`${patients.SELECT} ORDER BY p.id DESC LIMIT 5`);
  res.json({
    stats: { patients: pt.n, appointments_today: ap.n, active_treatments: tr.n, pending_followups: fu.n,
      pending_payments: { count: pay.n, amount: pay.amount } },
    today, recent,
  });
};
