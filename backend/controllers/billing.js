const db = require('../database/db');

// invoice + amount paid so far + pending amount
const invoices = (where = '') => `
  SELECT x.*, x.total - x.paid AS pending FROM (
    SELECT i.*, p.name AS patient_name, p.patient_code,
      COALESCE((SELECT SUM(amount) FROM payments WHERE invoice_id = i.id), 0) AS paid
    FROM invoices i JOIN patients p ON p.id = i.patient_id ${where}
  ) x ORDER BY x.id DESC`;

exports.listAll = async (req, res) => {
  const [rows] = await db.query(invoices());
  res.json(rows);
};

exports.listByPatient = async (req, res) => {
  const [rows] = await db.query(invoices('WHERE i.patient_id = ?'), [req.params.id]);
  res.json(rows);
};

// Creates an invoice and (optionally) the first payment in one go
exports.createInvoice = async (req, res) => {
  const b = req.body;
  const amount = Number(b.amount) || 0;
  const discount = Number(b.discount) || 0;
  const [r] = await db.query('INSERT INTO invoices SET ?', [{
    patient_id: b.patient_id, treatment_name: b.treatment_name, amount, discount, total: amount - discount,
  }]);
  if (Number(b.amount_paid) > 0) {
    await db.query('INSERT INTO payments SET ?', [{
      invoice_id: r.insertId, patient_id: b.patient_id, amount: b.amount_paid,
      payment_date: b.payment_date || new Date().toISOString().slice(0, 10), method: b.payment_method || 'Cash',
    }]);
  }
  res.status(201).json({ id: r.insertId });
};

exports.addPayment = async (req, res) => {
  const b = req.body;
  const [[inv]] = await db.query('SELECT patient_id FROM invoices WHERE id = ?', [b.invoice_id]);
  if (!inv) return res.status(404).json({ error: 'Invoice not found' });
  await db.query('INSERT INTO payments SET ?', [{
    invoice_id: b.invoice_id, patient_id: inv.patient_id, amount: b.amount,
    payment_date: b.payment_date || new Date().toISOString().slice(0, 10), method: b.method || 'Cash',
  }]);
  res.status(201).json({ ok: true });
};

exports.removeInvoice = async (req, res) => {
  await db.query('DELETE FROM invoices WHERE id = ?', [req.params.rid]);
  res.json({ ok: true });
};
