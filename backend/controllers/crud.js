// Small factory that builds list / create / update / delete handlers for a patient-owned table.
const db = require('../database/db');

// keep only allowed fields; turn '' into NULL
const pick = (body, fields) =>
  Object.fromEntries(fields.filter((f) => f in body).map((f) => [f, body[f] === '' ? null : body[f]]));

function makeCrud(table, fields, orderBy = 'id DESC', decorate = async (rows) => rows) {
  return {
    listAll: async (req, res) => {
      const [rows] = await db.query(
        `SELECT * FROM (SELECT t.*, p.name AS patient_name, p.patient_code
           FROM ${table} t JOIN patients p ON p.id = t.patient_id) x ORDER BY ${orderBy}`);
      res.json(await decorate(rows));
    },
    listByPatient: async (req, res) => {
      const [rows] = await db.query(`SELECT * FROM ${table} WHERE patient_id = ? ORDER BY ${orderBy}`, [req.params.id]);
      res.json(await decorate(rows));
    },
    create: async (req, res) => {
      const data = pick(req.body, fields);
      data.patient_id = req.params.id || req.body.patient_id;
      const [r] = await db.query(`INSERT INTO ${table} SET ?`, [data]);
      res.status(201).json({ id: r.insertId });
    },
    update: async (req, res) => {
      await db.query(`UPDATE ${table} SET ? WHERE id = ?`, [pick(req.body, fields), req.params.rid]);
      res.json({ ok: true });
    },
    remove: async (req, res) => {
      await db.query(`DELETE FROM ${table} WHERE id = ?`, [req.params.rid]);
      res.json({ ok: true });
    },
  };
}

module.exports = makeCrud;
module.exports.pick = pick;
