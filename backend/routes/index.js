const router = require('express').Router();
const patients = require('../controllers/patients');
const records = require('../controllers/records');
const treatments = require('../controllers/treatments');
const prescriptions = require('../controllers/prescriptions');
const images = require('../controllers/images');
const billing = require('../controllers/billing');
const dashboard = require('../controllers/dashboard');

// Registers the standard routes for a patient-owned resource
const crud = (path, c) => {
  router.get(`/${path}`, c.listAll);                       // all patients (used by the list pages)
  router.get(`/patients/:id/${path}`, c.listByPatient);    // one patient
  router.post(`/${path}`, c.create);                       // patient_id sent in the body
  router.post(`/patients/:id/${path}`, c.create);
  router.put(`/${path}/:rid`, c.update);
  router.delete(`/${path}/:rid`, c.remove);
};

router.get('/dashboard', dashboard.summary);

// Patients
router.get('/patients', patients.list);
router.post('/patients', patients.create);
router.get('/patients/:id', patients.get);
router.put('/patients/:id', patients.update);
router.delete('/patients/:id', patients.remove);
router.get('/patients/:id/overview', patients.overview);
router.get('/patients/:id/timeline', patients.timeline);
router.get('/patients/:id/medical-history', patients.getMedical);
router.post('/patients/:id/medical-history', patients.saveMedical);
router.get('/patients/:id/teeth', patients.getTeeth);
router.post('/patients/:id/teeth', patients.saveTooth);

// Patient-owned records
crud('dental-history', records.dentalHistory);
crud('consultations', records.consultations);
crud('diagnoses', records.diagnoses);
crud('appointments', records.appointments);
crud('followups', records.followups);
crud('treatments', treatments.crud);

// Treatment sessions
router.post('/treatments/:rid/sessions', treatments.addSession);
router.delete('/sessions/:rid', treatments.removeSession);

// Prescriptions
router.get('/prescriptions', prescriptions.listAll);
router.get('/patients/:id/prescriptions', prescriptions.listByPatient);
router.post('/prescriptions', prescriptions.create);
router.delete('/prescriptions/:rid', prescriptions.remove);

// X-rays & images
router.post('/images/upload', images.upload, images.create);
router.get('/images', images.listAll);
router.get('/patients/:id/images', images.listByPatient);
router.delete('/images/:rid', images.remove);

// Billing
router.get('/billing', billing.listAll);
router.get('/patients/:id/billing', billing.listByPatient);
router.post('/invoices', billing.createInvoice);
router.delete('/invoices/:rid', billing.removeInvoice);
router.post('/payments', billing.addPayment);

module.exports = router;
