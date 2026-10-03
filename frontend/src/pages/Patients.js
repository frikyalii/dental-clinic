import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useFetch, del, fmtDate } from '../services/api';
import PatientForm from '../components/PatientForm';
import { Modal, Loading } from '../components/Common';
import { useRun } from '../components/Toast';

export default function Patients() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [q, setQ] = useState('');
  const [patients, reload] = useFetch(`/patients?q=${encodeURIComponent(q)}`);
  const [editing, setEditing] = useState(params.get('add') === '1' ? {} : null); // {} = new, object = edit, null = closed
  const run = useRun();

  const remove = (p) =>
    window.confirm(`Delete ${p.name} and ALL their records?`) && run(() => del(`/patients/${p.id}`), 'Patient deleted').then(reload);

  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-3 gap-2 flex-wrap">
        <h4 className="mb-0">Patients</h4>
        <div className="d-flex gap-2">
          <input className="form-control" placeholder="Search name, ID or phone…" value={q} onChange={(e) => setQ(e.target.value)} />
          <button className="btn btn-primary text-nowrap" onClick={() => setEditing({})}>+ Add Patient</button>
        </div>
      </div>

      {!patients ? <Loading /> : (
        <div className="card"><div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
            <thead><tr><th>Patient ID</th><th>Name</th><th>Age</th><th>Gender</th><th>Phone</th><th>Last Visit</th><th>Current Treatment</th><th>Action</th></tr></thead>
            <tbody>
              {patients.map((p) => (
                <tr key={p.id}>
                  <td><span className="badge text-bg-primary">{p.patient_code}</span></td>
                  <td className="fw-semibold">{p.name}</td><td>{p.age ?? '—'}</td><td>{p.gender || '—'}</td><td>{p.phone || '—'}</td>
                  <td>{fmtDate(p.last_visit)}</td><td>{p.current_treatment || '—'}</td>
                  <td className="text-nowrap">
                    <button className="btn btn-sm btn-primary me-1" onClick={() => nav(`/patients/${p.id}`)}>View</button>
                    <button className="btn btn-sm btn-outline-secondary me-1" onClick={() => setEditing(p)}>Edit</button>
                    <button className="btn btn-sm btn-outline-danger" onClick={() => remove(p)}>Delete</button>
                  </td>
                </tr>
              ))}
              {patients.length === 0 && <tr><td colSpan="8" className="text-center text-muted py-4">No patients found.</td></tr>}
            </tbody>
          </table>
        </div></div>
      )}

      <Modal title={editing?.id ? 'Edit Patient' : 'Add Patient'} show={editing !== null} onClose={() => setEditing(null)}>
        <PatientForm patient={editing?.id ? editing : null} onSaved={() => { setEditing(null); reload(); }} />
      </Modal>
    </>
  );
}
