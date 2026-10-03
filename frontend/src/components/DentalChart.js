import { useState } from 'react';
import { useFetch, today, fmtDate } from '../services/api';
import Tooth, { CONDITIONS, COLORS } from './Tooth';
import SimpleForm from './Form';
import { Modal, Loading } from './Common';

// FDI numbering, drawn as the dentist sees the patient
const UPPER = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
const LOWER = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];

const Row = ({ teeth, map, onPick }) => (
  <div className="chart-row my-2">
    {teeth.map((n) => (
      <span key={n} className="d-flex">
        {n === 21 || n === 31 ? <span className="gap" /> : null}
        <Tooth number={n} data={map[n]} onClick={onPick} />
      </span>
    ))}
  </div>
);

export default function DentalChart({ patientId }) {
  const [teeth, reload] = useFetch(`/patients/${patientId}/teeth`);
  const [selected, setSelected] = useState(null);
  if (!teeth) return <Loading />;

  const map = Object.fromEntries(teeth.map((t) => [t.tooth_number, t]));
  const current = map[selected];
  const recorded = teeth.filter((t) => t.tooth_condition !== 'Healthy').sort((a, b) => a.tooth_number - b.tooth_number);

  return (
    <div className="card"><div className="card-body">
      <h5>Dental Chart <small className="text-muted fs-6">— click a tooth to update it</small></h5>
      <div className="text-center text-muted small mt-3">Upper jaw</div>
      <Row teeth={UPPER} map={map} onPick={setSelected} />
      <hr className="my-2" />
      <Row teeth={LOWER} map={map} onPick={setSelected} />
      <div className="text-center text-muted small mb-3">Lower jaw</div>

      <div className="d-flex flex-wrap gap-3 small justify-content-center mb-3">
        {CONDITIONS.map((c) => <span key={c}><span className="legend-dot" style={{ background: COLORS[c] }} />{c}</span>)}
      </div>

      {recorded.length > 0 && (
        <table className="table table-sm mb-0">
          <thead><tr><th>Tooth</th><th>Condition</th><th>Notes</th><th>Date</th></tr></thead>
          <tbody>{recorded.map((t) => (
            <tr key={t.id}><td>#{t.tooth_number}</td><td>{t.tooth_condition}</td><td>{t.notes}</td><td>{fmtDate(t.updated_date)}</td></tr>
          ))}</tbody>
        </table>
      )}

      <Modal title={`Tooth ${selected}`} show={selected !== null} onClose={() => setSelected(null)}>
        <SimpleForm
          endpoint={`/patients/${patientId}/teeth`} patientId={patientId} keep
          initial={{ tooth_number: String(selected), tooth_condition: current?.tooth_condition || 'Healthy', notes: current?.notes || '', updated_date: today() }}
          fields={[
            ['tooth_condition', 'Condition', { options: CONDITIONS, required: true }],
            ['updated_date', 'Date', { type: 'date' }],
            ['notes', 'Notes', { type: 'textarea', col: 'col-12' }],
          ]}
          onSaved={() => { setSelected(null); reload(); }} />
      </Modal>
    </div></div>
  );
}
