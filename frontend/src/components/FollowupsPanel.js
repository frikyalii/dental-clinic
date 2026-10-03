import { useState } from 'react';
import { useFetch, put, del, fmtDate, today } from '../services/api';
import SimpleForm from './Form';
import { Modal, Loading, PanelHeader, StatusBadge } from './Common';
import { useRun } from './Toast';

function FollowTable({ title, rows, showPatient, reload }) {
  const run = useRun();
  return (
    <div className="mb-4">
      <h6>{title} <span className="badge text-bg-light">{rows.length}</span></h6>
      <div className="card"><div className="table-responsive">
        <table className="table table-hover align-middle mb-0">
          <tbody>
            {rows.map((f) => (
              <tr key={f.id}>
                {showPatient && <td>{f.patient_name}</td>}
                <td>{fmtDate(f.followup_date)}</td><td>{f.treatment || '—'}</td><td>{f.notes}</td>
                <td><StatusBadge status={f.status} /></td>
                <td className="text-end text-nowrap">
                  {f.status === 'Pending' && <button className="btn btn-sm btn-outline-success me-1"
                    onClick={() => run(() => put(`/followups/${f.id}`, { status: 'Completed' }), 'Follow-up completed').then(reload)}>✓ Complete</button>}
                  <button className="btn btn-sm btn-outline-danger"
                    onClick={() => window.confirm('Delete follow-up?') && run(() => del(`/followups/${f.id}`)).then(reload)}>✕</button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td className="text-center text-muted py-3">Nothing here.</td></tr>}
          </tbody>
        </table>
      </div></div>
    </div>
  );
}

export default function FollowupsPanel({ patientId }) {
  const [rows, reload] = useFetch(patientId ? `/patients/${patientId}/followups` : '/followups');
  const [show, setShow] = useState(false);
  if (!rows) return <Loading />;

  const t = today();
  const pending = rows.filter((r) => r.status === 'Pending');
  const props = { showPatient: !patientId, reload };

  return (
    <>
      <PanelHeader title="Follow-ups" onAdd={() => setShow(true)} addLabel="+ New Follow-up" />
      <FollowTable title="Today's Follow-ups" rows={pending.filter((r) => r.followup_date === t)} {...props} />
      <FollowTable title="Upcoming Follow-ups" rows={pending.filter((r) => r.followup_date > t)} {...props} />
      <FollowTable title="Overdue & Completed" rows={rows.filter((r) => r.status === 'Completed' || r.followup_date < t)} {...props} />

      <Modal title="New Follow-up" show={show} onClose={() => setShow(false)}>
        <SimpleForm endpoint="/followups" patientId={patientId} initial={{ status: 'Pending', followup_date: t }}
          fields={[
            ['treatment', 'Treatment', { placeholder: 'e.g. Root Canal - Tooth 46', col: 'col-12' }],
            ['followup_date', 'Follow-up Date', { type: 'date', required: true }],
            ['status', 'Status', { options: ['Pending', 'Completed'] }],
            ['notes', 'Notes', { type: 'textarea', col: 'col-12' }],
          ]}
          onSaved={() => { setShow(false); reload(); }} />
      </Modal>
    </>
  );
}
