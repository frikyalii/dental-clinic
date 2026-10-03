import { useFetch, post } from '../services/api';
import { Loading, PanelHeader, StatusBadge } from './Common';
import { useRun } from './Toast';

const KIND = { appointment: '📅 Appointment', followup: '🔔 Follow-up', consultation: '🩺 Consultation', prescription: '💊 Prescription' };

function Details({ draft }) {
  const { items, ...rest } = draft.payload;
  return (
    <>
      <dl className="row small mb-1">
        {Object.entries(rest).filter(([k, v]) => v && k !== 'status').map(([k, v]) => (
          <div key={k} className="col-12 d-flex"><dt className="fw-semibold me-2 text-capitalize" style={{ minWidth: 130 }}>{k.replace(/_/g, ' ')}</dt><dd className="mb-0">{String(v)}</dd></div>
        ))}
      </dl>
      {items && (
        <ul className="small mb-1">{items.map((i, n) => <li key={n}><b>{i.medicine}</b> {i.dosage} {i.frequency} {i.duration} {i.instructions && `— ${i.instructions}`}</li>)}</ul>
      )}
    </>
  );
}

export default function DraftsPanel({ patientId }) {
  const [drafts, reload] = useFetch(patientId ? `/ai/drafts?patient_id=${patientId}` : '/ai/drafts');
  const run = useRun();
  if (!drafts) return <Loading />;

  const act = (id, what) => run(() => post(`/ai/drafts/${id}/${what}`), what === 'approve' ? 'Approved and saved' : 'Draft rejected').then(reload);

  return (
    <>
      <PanelHeader title={<>AI drafts waiting for approval <span className="badge text-bg-warning">{drafts.length}</span></>} />
      {drafts.length === 0 && <div className="text-muted mb-3">No pending drafts.</div>}
      <div className="row g-3">
        {drafts.map((d) => (
          <div key={d.id} className="col-lg-6">
            <div className="card h-100 border-warning"><div className="card-body">
              <div className="d-flex justify-content-between">
                <h6>{KIND[d.kind]} <StatusBadge status="Pending" /></h6>
                {!patientId && <span className="small text-primary">{d.patient_name}</span>}
              </div>
              <div className="fw-semibold mb-2">{d.summary}</div>
              {d.warnings.map((w, i) => (
                <div key={i} className={`alert alert-${w.level === 'high' ? 'danger' : 'warning'} py-1 px-2 small mb-1`}>🛡️ <b>{w.drug}:</b> {w.message}</div>
              ))}
              <Details draft={d} />
              <div className="mt-2 d-flex gap-2">
                <button className="btn btn-success btn-sm" onClick={() => act(d.id, 'approve')}>✓ Approve &amp; save</button>
                <button className="btn btn-outline-danger btn-sm" onClick={() => act(d.id, 'reject')}>Reject</button>
              </div>
            </div></div>
          </div>
        ))}
      </div>
    </>
  );
}
