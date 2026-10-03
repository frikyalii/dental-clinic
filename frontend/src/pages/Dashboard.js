import { Link, useNavigate } from 'react-router-dom';
import { useFetch, fmtDate, fmtTime, money } from '../services/api';
import { Loading, StatusBadge } from '../components/Common';

export default function Dashboard() {
  const [d] = useFetch('/dashboard');
  const nav = useNavigate();
  if (!d) return <Loading />;
  const s = d.stats;

  const cards = [
    ['Total Patients', s.patients, 'primary', '/patients'],
    ["Today's Appointments", s.appointments_today, 'success', '/appointments'],
    ['Active Treatments', s.active_treatments, 'warning', '/treatments'],
    ['Pending Follow-ups', s.pending_followups, 'info', '/followups'],
    ['Pending Payments', s.pending_payments.count, 'danger', '/billing', money(s.pending_payments.amount)],
  ];

  return (
    <>
      <div className="d-flex gap-2 mb-4 flex-wrap">
        <button className="btn btn-primary" onClick={() => nav('/patients?add=1')}>+ Add Patient</button>
        <button className="btn btn-success" onClick={() => nav('/appointments?new=1')}>📅 New Appointment</button>
        <button className="btn btn-outline-primary" onClick={() => nav('/consultations?new=1')}>🩺 Start Consultation</button>
      </div>

      <div className="row g-3 mb-4">
        {cards.map(([label, value, color, to, sub]) => (
          <div key={label} className="col-6 col-xl">
            <Link to={to} className={`card stat-card border-${color} border-start border-4 h-100`}>
              <div className="card-body">
                <div className="text-muted small">{label}</div>
                <div className="stat-value">{value}</div>
                {sub && <div className="small text-muted">{sub} due</div>}
              </div>
            </Link>
          </div>
        ))}
      </div>

      <div className="row g-3">
        <div className="col-lg-6">
          <div className="card h-100"><div className="card-body">
            <h5>Today's Appointments</h5>
            <table className="table table-sm align-middle mb-0">
              <thead><tr><th>Patient</th><th>Time</th><th>Type</th><th>Status</th></tr></thead>
              <tbody>
                {d.today.map((a) => (
                  <tr key={a.id}>
                    <td><Link to={`/patients/${a.patient_id}`}>{a.patient_name}</Link></td>
                    <td>{fmtTime(a.appointment_time)}</td><td>{a.type}</td><td><StatusBadge status={a.status} /></td>
                  </tr>
                ))}
                {d.today.length === 0 && <tr><td colSpan="4" className="text-muted text-center py-3">No appointments today.</td></tr>}
              </tbody>
            </table>
          </div></div>
        </div>

        <div className="col-lg-6">
          <div className="card h-100"><div className="card-body">
            <h5>Recent Patients</h5>
            <table className="table table-sm align-middle mb-0">
              <thead><tr><th>Patient</th><th>ID</th><th>Last Visit</th><th>Current Treatment</th></tr></thead>
              <tbody>
                {d.recent.map((p) => (
                  <tr key={p.id}>
                    <td><Link to={`/patients/${p.id}`}>{p.name}</Link></td><td>{p.patient_code}</td>
                    <td>{fmtDate(p.last_visit)}</td><td>{p.current_treatment || '—'}</td>
                  </tr>
                ))}
                {d.recent.length === 0 && <tr><td colSpan="4" className="text-muted text-center py-3">No patients yet.</td></tr>}
              </tbody>
            </table>
          </div></div>
        </div>
      </div>
    </>
  );
}
