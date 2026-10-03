import { useState } from 'react';
import { useFetch, del, fmtDate, today } from '../services/api';
import SimpleForm from './Form';
import { Modal, Loading, PanelHeader, Empty } from './Common';
import { useRun } from './Toast';

const MEDICAL = [
  ['allergies', 'Allergies', {}],
  ['medical_conditions', 'Medical Conditions', {}],
  ['current_medications', 'Current Medications', {}],
  ['previous_surgeries', 'Previous Surgeries', {}],
  ['blood_group', 'Blood Group', { options: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] }],
  ['tobacco_history', 'Smoking / Tobacco History', { options: ['None', 'Smoker', 'Tobacco chewer', 'Ex-smoker'] }],
  ['notes', 'Other Medical Notes', { type: 'textarea', col: 'col-12' }],
];

const TYPES = ['Root canal', 'Extraction', 'Crown', 'Bridge', 'Implant', 'Filling', 'Cleaning', 'Orthodontic treatment', 'Other'];

export default function MedicalHistory({ patientId }) {
  const [medical, reloadMedical] = useFetch(`/patients/${patientId}/medical-history`);
  const [history, reloadHistory] = useFetch(`/patients/${patientId}/dental-history`);
  const [show, setShow] = useState(false);
  const run = useRun();

  if (!medical || !history) return <Loading />;

  return (
    <div className="row g-3">
      <div className="col-lg-6">
        <div className="card"><div className="card-body">
          <h5 className="mb-3">Medical History</h5>
          <SimpleForm endpoint={`/patients/${patientId}/medical-history`} patientId={patientId} keep
            initial={medical} fields={MEDICAL} label="Save Medical History" onSaved={reloadMedical} />
        </div></div>
      </div>

      <div className="col-lg-6">
        <div className="card"><div className="card-body">
          <PanelHeader title="Dental History" onAdd={() => setShow(true)} addLabel="+ Add" />
          {history.length === 0 && <Empty text="No previous dental treatments recorded." />}
          <ul className="list-group list-group-flush">
            {history.map((h) => (
              <li key={h.id} className="list-group-item d-flex justify-content-between px-0">
                <div><strong>{h.treatment_type}</strong> <span className="text-muted small">· {fmtDate(h.treatment_date)}</span>
                  <div className="small">{h.notes}</div></div>
                <button className="btn btn-sm btn-outline-danger align-self-start"
                  onClick={() => window.confirm('Delete this entry?') && run(() => del(`/dental-history/${h.id}`)).then(reloadHistory)}>✕</button>
              </li>
            ))}
          </ul>
        </div></div>
      </div>

      <Modal title="Add Dental History" show={show} onClose={() => setShow(false)}>
        <SimpleForm endpoint="/dental-history" patientId={patientId} initial={{ treatment_date: today() }}
          fields={[
            ['treatment_type', 'Treatment', { options: TYPES, required: true }],
            ['treatment_date', 'Date', { type: 'date' }],
            ['notes', 'Notes', { type: 'textarea', col: 'col-12' }],
          ]}
          onSaved={() => { setShow(false); reloadHistory(); }} />
      </Modal>
    </div>
  );
}
