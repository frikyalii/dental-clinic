-- Optional demo data: mysql -u root -p < database/seed.sql
USE dental_clinic;
INSERT INTO patients (id, patient_code, name, age, gender, phone, email) VALUES (1, 'PAT-001', 'Rahul Sharma', 42, 'Male', '9876543210', 'rahul@example.com');
INSERT INTO medical_history (patient_id, allergies, medical_conditions, current_medications, blood_group) VALUES (1, 'Penicillin', 'Diabetes', 'Metformin', 'B+');
INSERT INTO consultations (patient_id, chief_complaint, severity, dentist_notes) VALUES (1, 'Tooth pain', 'Severe', 'Deep caries in 46.');
INSERT INTO diagnoses (patient_id, diagnosis, tooth_number, notes, diagnosis_date) VALUES (1, 'Deep dental caries', '46', 'Requires root canal treatment.', CURDATE());
INSERT INTO treatments (id, patient_id, name, tooth_number, diagnosis, cost, sessions_planned, status) VALUES (1, 1, 'Root Canal Treatment', '46', 'Deep dental caries', 8000, 3, 'In Progress');
INSERT INTO treatment_sessions (treatment_id, session_date, notes) VALUES (1, CURDATE(), 'Cleaning started');
INSERT INTO appointments (patient_id, appointment_date, appointment_time, type, status) VALUES (1, CURDATE(), '11:30:00', 'Root Canal Follow-up', 'Scheduled');
INSERT INTO teeth (patient_id, tooth_number, tooth_condition, notes, updated_date) VALUES (1, '46', 'Root Canal', 'Treatment in progress', CURDATE());
INSERT INTO invoices (id, patient_id, treatment_name, amount, discount, total) VALUES (1, 1, 'Root Canal', 8000, 0, 8000);
INSERT INTO payments (invoice_id, patient_id, amount, payment_date, method) VALUES (1, 1, 5001, CURDATE(), 'UPI');
