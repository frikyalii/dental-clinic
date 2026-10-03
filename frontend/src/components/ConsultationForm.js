import { useState } from 'react';
import { useForm, Field, PatientSelect } from './Form';
import { post } from '../services/api';
import { useRun } from './Toast';

const COMPLAINTS = ['Tooth pain', 'Sensitivity', 'Swelling', 'Bleeding gums', 'Broken tooth', 'Other'];

export default function ConsultationForm({ patientId, onSaved }) {
  const form = useForm({ severity: 'Mild', oral_hygiene: 'Fair' });
  const run = useRun();
  const [dictation, setDictation] = useState('');
  const [busy, setBusy] = useState(false);

  // AI: rough notes -> pre-filled form. Nothing is saved until the dentist reviews and clicks Save.
  const fillFromNotes = async () => {
    setBusy(true);
    let d;
    const ok = await run(async () => { d = await post('/ai/consultation/extract', { text: dictation }); }, 'Form filled - please review before saving');
    setBusy(false);
    if (ok) {
      const known = COMPLAINTS.includes(d.chief_complaint);
      form.patch({ ...d, chief_complaint: known ? d.chief_complaint : 'Other', chief_other: known ? '' : d.chief_complaint });
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    const v = form.values;
    const body = { ...v, patient_id: patientId || v.patient_id };
    if (v.chief_complaint === 'Other' && v.chief_other) body.chief_complaint = v.chief_other;
    if (await run(() => post('/consultations', body), 'Consultation saved')) onSaved();
  };

  return (
    <form onSubmit={submit} className="row g-3">
      {!patientId && <PatientSelect form={form} />}
      <div className="col-12">
        <div className="border rounded p-2 bg-light">
          <label className="form-label small fw-semibold mb-1">✨ AI: type or dictate rough notes, then fill the form</label>
          <textarea className="form-control mb-2" rows="2" value={dictation} onChange={(e) => setDictation(e.target.value)}
            placeholder="e.g. pain in lower right molar for 3 days, severe, sensitive to cold, deep caries on 46, gums bleeding a bit" />
          <button type="button" className="btn btn-outline-primary btn-sm" disabled={busy || !dictation.trim()} onClick={fillFromNotes}>
            {busy ? 'Reading notes…' : 'Fill form from notes'}
          </button>
        </div>
      </div>
      <Field form={form} name="chief_complaint" label="Chief Complaint" options={COMPLAINTS} required />
      {form.values.chief_complaint === 'Other' && <Field form={form} name="chief_other" label="Describe the complaint" />}

      <h6 className="col-12 mb-0 mt-4">Symptoms</h6>
      <Field form={form} name="duration" label="Duration" placeholder="e.g. 3 days" col="col-md-4" />
      <Field form={form} name="severity" label="Severity" options={['Mild', 'Moderate', 'Severe']} col="col-md-4" />
      <Field form={form} name="symptom_location" label="Location" placeholder="e.g. lower right" col="col-md-4" />

      <h6 className="col-12 mb-0 mt-4">Examination</h6>
      <Field form={form} name="oral_hygiene" label="Oral Hygiene" options={['Good', 'Fair', 'Poor']} col="col-md-4" />
      <Field form={form} name="gum_condition" label="Gum Condition" options={['Healthy', 'Gingivitis', 'Periodontitis', 'Bleeding', 'Swollen']} col="col-md-4" />
      <Field form={form} name="tooth_condition" label="Tooth Condition" col="col-md-4" />
      <Field form={form} name="other_findings" label="Other Findings" type="textarea" col="col-12" />

      <Field form={form} name="dentist_notes" label="Dentist Notes" type="textarea" rows="5" col="col-12" />
      <div className="col-12 text-end"><button className="btn btn-primary">Save Consultation</button></div>
    </form>
  );
}
