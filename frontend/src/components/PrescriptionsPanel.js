import { useState } from 'react';
import { useFetch, post, del, fmtDate } from '../services/api';
import { printPrescription } from '../services/print';
import { useForm, Field, PatientSelect } from './Form';
import { Modal, Loading, PanelHeader, Empty } from './Common';
import { useRun } from './Toast';

const blank = { medicine: '', dosage: '', frequency: '', duration: '', instructions: '' };

function PrescriptionForm({ patientId, onSaved }) {
  const form = useForm({});
  const [items, setItems] = useState([{ ...blank }]);
  const run = useRun();
  const [alerts, setAlerts] = useState(null);
  const setItem = (i, key, value) => setItems((list) => list.map((x, j) => (j === i ? { ...x, [key]: value } : x)));

  const check = async () => {
    const pid = patientId || form.values.patient_id;
    if (!pid) return run(() => Promise.reject({ response: { data: { error: 'Select a patient first' } } }));
    let res;
    if (await run(async () => { res = await post('/ai/prescription/check', { patient_id: Number(pid), items: items.filter((i) => i.medicine) }); })) setAlerts(res.warnings);
  };

  const submit = async (e) => {
    e.preventDefault();
    const body = { patient_id: patientId || form.values.patient_id, notes: form.values.notes, items: items.filter((i) => i.medicine) };
    if (await run(() => post('/prescriptions', body), 'Prescription saved')) onSaved();
  };

  return (
    <form onSubmit={submit} className="row g-3">
      {!patientId && <PatientSelect form={form} />}
      <div className="col-12">
        {items.map((it, i) => (
          <div key={i} className="rx-item row g-2 mb-2 mx-0">
            <div className="col-md-4"><input className="form-control form-control-sm" placeholder="Medicine name" required value={it.medicine} onChange={(e) => setItem(i, 'medicine', e.target.value)} /></div>
            <div className="col-md-2"><input className="form-control form-control-sm" placeholder="Dosage" value={it.dosage} onChange={(e) => setItem(i, 'dosage', e.target.value)} /></div>
            <div className="col-md-2"><input className="form-control form-control-sm" placeholder="Frequency" value={it.frequency} onChange={(e) => setItem(i, 'frequency', e.target.value)} /></div>
            <div className="col-md-2"><input className="form-control form-control-sm" placeholder="Duration" value={it.duration} onChange={(e) => setItem(i, 'duration', e.target.value)} /></div>
            <div className="col-md-2 d-flex">
              {items.length > 1 && <button type="button" className="btn btn-sm btn-outline-danger ms-auto" onClick={() => setItems((l) => l.filter((_, j) => j !== i))}>✕</button>}
            </div>
            <div className="col-12"><input className="form-control form-control-sm" placeholder="Instructions (e.g. after food)" value={it.instructions} onChange={(e) => setItem(i, 'instructions', e.target.value)} /></div>
          </div>
        ))}
        <button type="button" className="btn btn-outline-primary btn-sm" onClick={() => setItems((l) => [...l, { ...blank }])}>+ Add medicine</button>
      </div>
      <Field form={form} name="notes" label="Notes" type="textarea" col="col-12" />
      {alerts && (
        <div className="col-12">
          {alerts.length === 0 && <div className="alert alert-success py-2 mb-0">🛡️ No allergy or interaction warnings found (rule-based check - not a substitute for clinical judgement).</div>}
          {alerts.map((a, i) => (
            <div key={i} className={`alert alert-${a.level === 'high' ? 'danger' : 'warning'} py-2 mb-2`}><b>{a.drug}:</b> {a.message}</div>
          ))}
        </div>
      )}
      <div className="col-12 d-flex justify-content-between">
        <button type="button" className="btn btn-outline-secondary" onClick={check}>🛡️ Check safety</button>
        <button className="btn btn-primary">Save Prescription</button>
      </div>
    </form>
  );
}

export default function PrescriptionsPanel({ patientId }) {
  const [rows, reload] = useFetch(patientId ? `/patients/${patientId}/prescriptions` : '/prescriptions');
  const [show, setShow] = useState(false);
  const run = useRun();
  if (!rows) return <Loading />;

  return (
    <>
      <PanelHeader title="Prescriptions" onAdd={() => setShow(true)} addLabel="+ New Prescription" />
      {rows.length === 0 && <Empty text="No prescriptions yet." />}
      <div className="row g-3">
        {rows.map((rx) => (
          <div key={rx.id} className="col-lg-6">
            <div className="card h-100"><div className="card-body">
              <div className="d-flex justify-content-between">
                <h6>{!patientId ? rx.patient_name : 'Prescription'} <span className="text-muted small">#{rx.id}</span></h6>
                <span className="text-muted small">{fmtDate(rx.created_at)}</span>
              </div>
              <ul className="small ps-3 mb-2">
                {rx.items.map((i) => <li key={i.id}><b>{i.medicine}</b> {i.dosage} · {i.frequency} · {i.duration}{i.instructions && ` — ${i.instructions}`}</li>)}
              </ul>
              {rx.notes && <div className="small text-muted mb-2">{rx.notes}</div>}
              <button className="btn btn-success btn-sm me-2" onClick={() => printPrescription(rx)}>🖨️ Generate Prescription</button>
              <button className="btn btn-outline-danger btn-sm"
                onClick={() => window.confirm('Delete prescription?') && run(() => del(`/prescriptions/${rx.id}`)).then(reload)}>Delete</button>
            </div></div>
          </div>
        ))}
      </div>
      <Modal title="New Prescription" size="modal-lg" show={show} onClose={() => setShow(false)}>
        <PrescriptionForm patientId={patientId} onSaved={() => { setShow(false); reload(); }} />
      </Modal>
    </>
  );
}
