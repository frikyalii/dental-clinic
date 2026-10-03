CREATE DATABASE IF NOT EXISTS dental_clinic;
USE dental_clinic;

CREATE TABLE IF NOT EXISTS patients (
  id INT AUTO_INCREMENT PRIMARY KEY,
  patient_code VARCHAR(20) UNIQUE,
  name VARCHAR(100) NOT NULL,
  age INT, gender VARCHAR(10), phone VARCHAR(20), email VARCHAR(100), address VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS medical_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  patient_id INT NOT NULL UNIQUE,
  allergies VARCHAR(255), medical_conditions VARCHAR(255), current_medications VARCHAR(255),
  previous_surgeries VARCHAR(255), blood_group VARCHAR(10), tobacco_history VARCHAR(100), notes TEXT,
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS dental_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  patient_id INT NOT NULL,
  treatment_type VARCHAR(50) NOT NULL, treatment_date DATE, notes TEXT,
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS teeth (
  id INT AUTO_INCREMENT PRIMARY KEY,
  patient_id INT NOT NULL,
  tooth_number VARCHAR(5) NOT NULL,
  tooth_condition VARCHAR(30) NOT NULL DEFAULT 'Healthy',
  notes TEXT, updated_date DATE,
  UNIQUE KEY uq_patient_tooth (patient_id, tooth_number),
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS consultations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  patient_id INT NOT NULL,
  chief_complaint VARCHAR(255) NOT NULL,
  duration VARCHAR(50), severity VARCHAR(20), symptom_location VARCHAR(100),
  oral_hygiene VARCHAR(50), gum_condition VARCHAR(100), tooth_condition VARCHAR(255), other_findings TEXT,
  dentist_notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS diagnoses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  patient_id INT NOT NULL,
  consultation_id INT NULL,
  diagnosis VARCHAR(255) NOT NULL, tooth_number VARCHAR(5), notes TEXT, diagnosis_date DATE,
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
  FOREIGN KEY (consultation_id) REFERENCES consultations(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS treatments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  patient_id INT NOT NULL,
  diagnosis_id INT NULL,
  name VARCHAR(150) NOT NULL, tooth_number VARCHAR(5), diagnosis VARCHAR(255),
  cost DECIMAL(10,2) DEFAULT 0, sessions_planned INT DEFAULT 1,
  status VARCHAR(20) NOT NULL DEFAULT 'Planned', notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
  FOREIGN KEY (diagnosis_id) REFERENCES diagnoses(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS treatment_sessions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  treatment_id INT NOT NULL,
  session_date DATE NOT NULL, notes TEXT,
  FOREIGN KEY (treatment_id) REFERENCES treatments(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS appointments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  patient_id INT NOT NULL,
  appointment_date DATE NOT NULL, appointment_time TIME NOT NULL,
  type VARCHAR(50), notes TEXT, status VARCHAR(20) NOT NULL DEFAULT 'Scheduled',
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS followups (
  id INT AUTO_INCREMENT PRIMARY KEY,
  patient_id INT NOT NULL,
  treatment VARCHAR(150), followup_date DATE NOT NULL, notes TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'Pending',
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS prescriptions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  patient_id INT NOT NULL,
  notes TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS prescription_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  prescription_id INT NOT NULL,
  medicine VARCHAR(150) NOT NULL, dosage VARCHAR(50), frequency VARCHAR(50), duration VARCHAR(50), instructions VARCHAR(255),
  FOREIGN KEY (prescription_id) REFERENCES prescriptions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS images (
  id INT AUTO_INCREMENT PRIMARY KEY,
  patient_id INT NOT NULL,
  filename VARCHAR(255) NOT NULL, image_type VARCHAR(30), tooth_number VARCHAR(5),
  description VARCHAR(255), notes TEXT, taken_date DATE,
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS invoices (
  id INT AUTO_INCREMENT PRIMARY KEY,
  patient_id INT NOT NULL,
  treatment_id INT NULL,
  treatment_name VARCHAR(150) NOT NULL,
  amount DECIMAL(10,2) NOT NULL, discount DECIMAL(10,2) DEFAULT 0, total DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
  FOREIGN KEY (treatment_id) REFERENCES treatments(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS payments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  invoice_id INT NOT NULL,
  patient_id INT NOT NULL,
  amount DECIMAL(10,2) NOT NULL, payment_date DATE NOT NULL, method VARCHAR(20) DEFAULT 'Cash',
  FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
);
