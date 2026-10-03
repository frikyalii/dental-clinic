import { useState } from 'react';
import { useFetch, post } from '../services/api';
import { useRun } from './Toast';

export function useForm(initial = {}) {
  const [values, setValues] = useState(initial);
  return { values, set: (k, v) => setValues((s) => ({ ...s, [k]: v })), patch: (obj) => setValues((s) => ({ ...s, ...obj })), reset: () => setValues(initial) };
}

// One labelled input / select / textarea. options: ['A','B'] or [{value,label}]
export function Field({ label, name, form, type = 'text', options, col = 'col-md-6', ...rest }) {
  const props = { value: form.values[name] ?? '', onChange: (e) => form.set(name, e.target.value), ...rest };
  return (
    <div className={col}>
      <label className="form-label small fw-semibold mb-1">{label}</label>
      {options ? (
        <select className="form-select" {...props}>
          <option value="">Select…</option>
          {options.map((o) => typeof o === 'object'
            ? <option key={o.value} value={o.value}>{o.label}</option>
            : <option key={o}>{o}</option>)}
        </select>
      ) : type === 'textarea' ? (
        <textarea className="form-control" rows="3" {...props} />
      ) : (
        <input className="form-control" type={type} {...props} />
      )}
    </div>
  );
}

export function PatientSelect({ form }) {
  const [patients] = useFetch('/patients');
  const options = (patients || []).map((p) => ({ value: p.id, label: `${p.patient_code} - ${p.name}` }));
  return <Field form={form} name="patient_id" label="Patient" options={options} required col="col-12" />;
}

// Generic "fill fields and POST" form used by most screens.
// fields: [[name, label, extraProps], ...]   (extraProps: type, options, required, col ...)
export default function SimpleForm({ fields, endpoint, patientId, noPatient, initial = {}, onSaved, label = 'Save', keep }) {
  const form = useForm(initial);
  const run = useRun();
  const submit = async (e) => {
    e.preventDefault();
    const body = { ...form.values, patient_id: patientId || form.values.patient_id };
    if (await run(() => post(endpoint, body), 'Saved')) {
      if (!keep) form.reset();
      onSaved && onSaved();
    }
  };
  return (
    <form onSubmit={submit} className="row g-3">
      {!patientId && !noPatient && <PatientSelect form={form} />}
      {fields.map(([name, lbl, opts]) => <Field key={name} form={form} name={name} label={lbl} {...opts} />)}
      <div className="col-12 text-end"><button className="btn btn-primary">{label}</button></div>
    </form>
  );
}
