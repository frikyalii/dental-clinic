import { useNavigate } from 'react-router-dom';

export default function PatientCard({ patient: p }) {
  const nav = useNavigate();
  return (
    <div className="card mb-3 shadow-sm"><div className="card-body d-flex align-items-center gap-3 flex-wrap">
      <div className="avatar">{p.name.charAt(0).toUpperCase()}</div>
      <div className="flex-grow-1">
        <h4 className="mb-1">{p.name} <span className="badge text-bg-primary fs-6 align-middle">{p.patient_code}</span></h4>
        <div className="text-muted">
          {p.age ?? '—'} yrs · {p.gender || '—'} · 📞 {p.phone || '—'} · ✉️ {p.email || '—'}
        </div>
      </div>
      <button className="btn btn-outline-secondary btn-sm" onClick={() => nav('/patients')}>← All patients</button>
    </div></div>
  );
}
