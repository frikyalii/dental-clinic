import { put, del, fmtDate, fmtTime } from '../services/api';
import { StatusBadge } from './Common';
import { useRun } from './Toast';

export default function AppointmentTable({ rows, showPatient, reload }) {
  const run = useRun();
  const setStatus = (id, status) => run(() => put(`/appointments/${id}`, { status }), 'Status updated').then(reload);
  const remove = (id) => window.confirm('Delete this appointment?') && run(() => del(`/appointments/${id}`)).then(reload);

  return (
    <div className="card"><div className="table-responsive">
      <table className="table table-hover align-middle mb-0">
        <thead><tr>{showPatient && <th>Patient</th>}<th>Date</th><th>Time</th><th>Type</th><th>Notes</th><th>Status</th><th /></tr></thead>
        <tbody>
          {rows.map((a) => (
            <tr key={a.id}>
              {showPatient && <td>{a.patient_name} <span className="text-muted small">{a.patient_code}</span></td>}
              <td>{fmtDate(a.appointment_date)}</td><td>{fmtTime(a.appointment_time)}</td><td>{a.type}</td><td>{a.notes}</td>
              <td><StatusBadge status={a.status} /></td>
              <td className="text-end text-nowrap">
                <select className="form-select form-select-sm d-inline-block w-auto me-1" value={a.status} onChange={(e) => setStatus(a.id, e.target.value)}>
                  {['Scheduled', 'Completed', 'Cancelled'].map((s) => <option key={s}>{s}</option>)}
                </select>
                <button className="btn btn-sm btn-outline-danger" onClick={() => remove(a.id)}>✕</button>
              </td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan="7" className="text-center text-muted py-4">No appointments.</td></tr>}
        </tbody>
      </table>
    </div></div>
  );
}
