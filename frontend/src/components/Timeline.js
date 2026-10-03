import { useFetch, fmtDate } from '../services/api';
import { Loading, Empty } from './Common';

const ICONS = { consultation: '🩺', diagnosis: '📋', treatment: '🦷', session: '🔧', image: '📷', prescription: '💊', appointment: '📅', followup: '🔔', payment: '💰' };

export default function Timeline({ patientId }) {
  const [events] = useFetch(`/patients/${patientId}/timeline`);
  if (!events) return <Loading />;
  if (!events.length) return <Empty text="Nothing has happened yet for this patient." />;
  return (
    <div className="card"><div className="card-body">
      <h5 className="mb-4">Patient Timeline</h5>
      <ul className="timeline">
        {events.map((e, i) => (
          <li key={i}>
            <div className="fw-semibold">{fmtDate(e.d)}</div>
            <div>{ICONS[e.type]} {e.title}</div>
          </li>
        ))}
      </ul>
    </div></div>
  );
}
