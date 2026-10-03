import { useForm, Field } from './Form';
import { post, put } from '../services/api';
import { useRun } from './Toast';

export default function PatientForm({ patient, onSaved }) {
  const form = useForm(patient || { gender: 'Male' });
  const run = useRun();
  const submit = async (e) => {
    e.preventDefault();
    const call = () => (patient ? put(`/patients/${patient.id}`, form.values) : post('/patients', form.values));
    if (await run(call, patient ? 'Patient updated' : 'Patient added')) onSaved();
  };
  return (
    <form onSubmit={submit} className="row g-3">
      <Field form={form} name="name" label="Full Name" required col="col-12" />
      <Field form={form} name="age" label="Age" type="number" min="0" col="col-md-4" />
      <Field form={form} name="gender" label="Gender" options={['Male', 'Female', 'Other']} col="col-md-4" />
      <Field form={form} name="phone" label="Phone" col="col-md-4" />
      <Field form={form} name="email" label="Email" type="email" />
      <Field form={form} name="address" label="Address" />
      <div className="col-12 text-end"><button className="btn btn-primary">{patient ? 'Update' : 'Add'} Patient</button></div>
    </form>
  );
}
