import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useFetch, del, fmtDate, fmtDateTime, today } from '../services/api';
import ConsultationForm from './ConsultationForm';
import SimpleForm from './Form';
import { Modal, Loading, PanelHeader, Empty } from './Common';
import { useRun } from './Toast';

const Line = ({ label, value }) => (value ? <div className="small"><span className="text-muted">{label}:</span> {value}</div> : null);

export default function ConsultationsPanel({ patientId }) {
  const [params] = useSearchParams();
  const [consults, reloadC] = useFetch(patientId ? `/patients/${patientId}/consultations` : '/consultations');
  const [diagnoses, reloadD] = useFetch(patientId ? `/patients/${patientId}/diagnoses` : '/diagnoses');
  const [showC, setShowC] = useState(params.get('new') === '1');
  const [showD, setShowD] = useState(false);
  const run = useRun();

  if (!consults || !diagnoses) return <Loading />;

  return (
    <>
      <PanelHeader title="Consultations" onAdd={() => setShowC(true)} addLabel="+ New Consultation" />
      {consults.length === 0 && <Empty text="No consultations yet." />}
      <div className="row g-3 mb-4">
        {consults.map((c) => (
          <div key={c.id} className="col-lg-6">
            <div className="card h-100"><div className="card-body">
              <div className="d-flex justify-content-between">
                <h6>{c.chief_complaint}</h6>
                <span className="text-muted small">{fmtDateTime(c.created_at)}</span>
              </div>
              {c.patient_name && <div className="small text-primary mb-1">{c.patient_name} ({c.patient_code})</div>}
              <Line label="Duration" value={c.duration} /><Line label="Severity" value={c.severity} />
              <Line label="Location" value={c.symptom_location} /><Line label="Oral hygiene" value={c.oral_hygiene} />
              <Line label="Gums" value={c.gum_condition} /><Line label="Teeth" value={c.tooth_condition} />
              <Line label="Other findings" value={c.other_findings} /><Line label="Notes" value={c.dentist_notes} />
            </div></div>
          </div>
        ))}
      </div>

      <PanelHeader title="Diagnoses" onAdd={() => setShowD(true)} addLabel="+ Add Diagnosis" />
      <div className="card"><div className="table-responsive">
        <table className="table table-hover mb-0 align-middle">
          <thead><tr>{!patientId && <th>Patient</th>}<th>Date</th><th>Diagnosis</th><th>Tooth</th><th>Notes</th><th /></tr></thead>
          <tbody>
            {diagnoses.map((d) => (
              <tr key={d.id}>
                {!patientId && <td>{d.patient_name}</td>}
                <td>{fmtDate(d.diagnosis_date)}</td><td>{d.diagnosis}</td><td>{d.tooth_number || '—'}</td><td>{d.notes}</td>
                <td className="text-end"><button className="btn btn-sm btn-outline-danger"
                  onClick={() => window.confirm('Delete diagnosis?') && run(() => del(`/diagnoses/${d.id}`)).then(reloadD)}>✕</button></td>
              </tr>
            ))}
            {diagnoses.length === 0 && <tr><td colSpan="6" className="text-center text-muted py-3">No diagnoses yet.</td></tr>}
          </tbody>
        </table>
      </div></div>

      <Modal title="New Consultation" size="modal-lg" show={showC} onClose={() => setShowC(false)}>
        <ConsultationForm patientId={patientId} onSaved={() => { setShowC(false); reloadC(); }} />
      </Modal>
      <Modal title="Add Diagnosis" show={showD} onClose={() => setShowD(false)}>
        <SimpleForm endpoint="/diagnoses" patientId={patientId} initial={{ diagnosis_date: today() }}
          fields={[
            ['diagnosis', 'Diagnosis', { required: true, col: 'col-12' }],
            ['tooth_number', 'Tooth Number'],
            ['diagnosis_date', 'Date', { type: 'date' }],
            ['notes', 'Notes', { type: 'textarea', col: 'col-12' }],
          ]}
          onSaved={() => { setShowD(false); reloadD(); }} />
      </Modal>
    </>
  );
}
