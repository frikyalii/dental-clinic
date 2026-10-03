import { useState } from 'react';
import { put, del, fmtDate, today, money } from '../services/api';
import SimpleForm from './Form';
import { Modal, StatusBadge } from './Common';
import { useRun } from './Toast';

const STATUSES = ['Planned', 'In Progress', 'Completed', 'Cancelled'];

export default function TreatmentCard({ t, showPatient, reload }) {
  const [adding, setAdding] = useState(false);
  const run = useRun();

  const setStatus = (status) => run(() => put(`/treatments/${t.id}`, { status }), 'Status updated').then(reload);
  const remove = () => window.confirm('Delete this treatment and its sessions?') && run(() => del(`/treatments/${t.id}`)).then(reload);
  const removeSession = (id) => window.confirm('Delete this session?') && run(() => del(`/sessions/${id}`)).then(reload);

  return (
    <div className="card h-100"><div className="card-body">
      <div className="d-flex justify-content-between align-items-start">
        <h6 className="mb-1">{t.name}{t.tooth_number ? ` — Tooth ${t.tooth_number}` : ''}</h6>
        <StatusBadge status={t.status} />
      </div>
      {showPatient && <div className="small text-primary">{t.patient_name} ({t.patient_code})</div>}
      <div className="small text-muted mb-2">
        {t.diagnosis && <>Diagnosis: {t.diagnosis} · </>}Cost: {money(t.cost)} · Sessions: {t.sessions.length}/{t.sessions_planned}
      </div>
      {t.notes && <div className="small mb-2">{t.notes}</div>}

      <div className="border-top pt-2">
        {t.sessions.length === 0 && <div className="small text-muted">No sessions yet.</div>}
        {t.sessions.map((s, i) => (
          <div key={s.id} className="small d-flex justify-content-between">
            <span><b>Session {i + 1}</b> · {fmtDate(s.session_date)} — {s.notes}</span>
            <button className="btn btn-link btn-sm text-danger p-0" onClick={() => removeSession(s.id)}>✕</button>
          </div>
        ))}
      </div>

      <div className="d-flex gap-2 mt-3 flex-wrap">
        <button className="btn btn-outline-primary btn-sm" onClick={() => setAdding(true)}>+ Session</button>
        <select className="form-select form-select-sm w-auto" value={t.status} onChange={(e) => setStatus(e.target.value)}>
          {STATUSES.map((s) => <option key={s}>{s}</option>)}
        </select>
        <button className="btn btn-outline-danger btn-sm ms-auto" onClick={remove}>Delete</button>
      </div>

      <Modal title={`Add session — ${t.name}`} show={adding} onClose={() => setAdding(false)}>
        <SimpleForm endpoint={`/treatments/${t.id}/sessions`} noPatient initial={{ session_date: today() }}
          fields={[
            ['session_date', 'Date', { type: 'date', required: true }],
            ['notes', 'Notes', { type: 'textarea', col: 'col-12' }],
          ]}
          onSaved={() => { setAdding(false); reload(); }} />
      </Modal>
    </div></div>
  );
}
