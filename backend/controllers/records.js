const makeCrud = require('./crud');

module.exports = {
  dentalHistory: makeCrud('dental_history', ['treatment_type', 'treatment_date', 'notes'], 'treatment_date DESC, id DESC'),
  consultations: makeCrud('consultations',
    ['chief_complaint', 'duration', 'severity', 'symptom_location', 'oral_hygiene', 'gum_condition',
      'tooth_condition', 'other_findings', 'dentist_notes'], 'created_at DESC, id DESC'),
  diagnoses: makeCrud('diagnoses', ['diagnosis', 'tooth_number', 'notes', 'diagnosis_date'], 'diagnosis_date DESC, id DESC'),
  appointments: makeCrud('appointments',
    ['appointment_date', 'appointment_time', 'type', 'notes', 'status'], 'appointment_date DESC, appointment_time DESC'),
  followups: makeCrud('followups', ['treatment', 'followup_date', 'notes', 'status'], 'followup_date ASC, id ASC'),
};
