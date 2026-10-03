import { useFetch, fmtDate, fmtTime, money } from '../services/api';
import { Loading } from './Common';
import AiBrief from './AiBrief';

const Card = ({ title, color, children }) => (
  <div className="col-md-6">
    <div className={`card h-100 border-${color}`}>
      <div className={`card-header text-bg-${color} py-2`}>{title}</div>
      <div className="card-body">{children}</div>
    </div>
  </div>
);

export default function Overview({ patientId }) {
  const [o] = useFetch(`/patients/${patientId}/overview`);
  if (!o) return <Loading />;
  const m = o.medical || {};
  const a = o.next_appointment;
  const b = o.billing;

  return (
    <div className="row g-3">
      <div className="col-12"><AiBrief patientId={patientId} /></div>
      <Card title="⚠️ Medical Alerts" color="danger">
        {m.allergies || m.medical_conditions || m.current_medications ? (
          <>
            <div><b>Allergies:</b> {m.allergies || '—'}</div>
            <div><b>Medical Condition:</b> {m.medical_conditions || '—'}</div>
            <div><b>Current Medication:</b> {m.current_medications || '—'}</div>
            <div><b>Blood Group:</b> {m.blood_group || '—'}</div>
          </>
        ) : <span className="text-muted">No medical alerts recorded.</span>}
      </Card>

      <Card title="🦷 Current Treatment" color="warning">
        {o.treatments.length === 0 && <span className="text-muted">No treatment in progress.</span>}
        {o.treatments.map((t) => (
          <div key={t.id}><b>{t.name}{t.tooth_number ? ` - Tooth #${t.tooth_number}` : ''}</b><br />
            <span className="badge text-bg-warning">In Progress</span></div>
        ))}
      </Card>

      <Card title="📅 Next Appointment" color="primary">
        {a ? <><b>{fmtDate(a.appointment_date)}</b><br />{fmtTime(a.appointment_time)}<br />{a.type}</>
          : <span className="text-muted">No upcoming appointment.</span>}
      </Card>

      <Card title="💰 Pending Payment" color={b.pending > 0 ? 'danger' : 'success'}>
        <div>Total: <b>{money(b.total)}</b></div>
        <div>Paid: <b>{money(b.paid)}</b></div>
        <div>Pending: <b className={b.pending > 0 ? 'text-danger' : 'text-success'}>{money(b.pending)}</b></div>
      </Card>

      <div className="col-12">
        <div className="card"><div className="card-body">
          <h6>🔔 Pending Follow-ups</h6>
          {o.followups.length === 0 && <span className="text-muted">None</span>}
          {o.followups.map((f) => <div key={f.id}>{fmtDate(f.followup_date)} — {f.treatment || 'Follow-up'} {f.notes && <span className="text-muted">({f.notes})</span>}</div>)}
        </div></div>
      </div>
    </div>
  );
}
