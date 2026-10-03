import { useState } from 'react';
import { useFetch, post, del, fmtDate, today } from '../services/api';
import { useForm, Field, PatientSelect } from './Form';
import { Modal, Loading, PanelHeader, Empty } from './Common';
import { useRun } from './Toast';

const TYPES = ['X-Ray', 'OPG', 'Intraoral Photo', 'Before Image', 'After Image'];

function UploadForm({ patientId, onSaved }) {
  const form = useForm({ image_type: 'X-Ray', taken_date: today() });
  const [file, setFile] = useState(null);
  const run = useRun();

  const submit = async (e) => {
    e.preventDefault();
    const fd = new FormData();
    Object.entries({ ...form.values, patient_id: patientId || form.values.patient_id }).forEach(([k, v]) => v && fd.append(k, v));
    fd.append('file', file);
    if (await run(() => post('/images/upload', fd), 'Image uploaded')) onSaved();
  };

  return (
    <form onSubmit={submit} className="row g-3">
      {!patientId && <PatientSelect form={form} />}
      <div className="col-12">
        <label className="form-label small fw-semibold mb-1">File</label>
        <input type="file" accept="image/*" className="form-control" required onChange={(e) => setFile(e.target.files[0])} />
      </div>
      <Field form={form} name="image_type" label="Type" options={TYPES} />
      <Field form={form} name="taken_date" label="Date" type="date" />
      <Field form={form} name="tooth_number" label="Tooth Number" />
      <Field form={form} name="description" label="Description" />
      <Field form={form} name="notes" label="Notes" type="textarea" col="col-12" />
      <div className="col-12 text-end"><button className="btn btn-primary">Upload</button></div>
    </form>
  );
}

export default function ImagesPanel({ patientId }) {
  const [rows, reload] = useFetch(patientId ? `/patients/${patientId}/images` : '/images');
  const [show, setShow] = useState(false);
  const run = useRun();
  if (!rows) return <Loading />;

  return (
    <>
      <PanelHeader title="X-Rays & Images" onAdd={() => setShow(true)} addLabel="+ Upload Image" />
      {rows.length === 0 && <Empty text="No images uploaded yet." />}
      <div className="row g-3">
        {rows.map((img) => (
          <div key={img.id} className="col-sm-6 col-lg-4 col-xl-3">
            <div className="card h-100">
              <a href={`/uploads/${img.filename}`} target="_blank" rel="noreferrer">
                <img src={`/uploads/${img.filename}`} alt={img.description || img.image_type} className="card-img-top" style={{ height: 180, objectFit: 'cover' }} />
              </a>
              <div className="card-body p-2 small">
                <span className="badge text-bg-info me-1">{img.image_type}</span>
                {img.tooth_number && <span className="badge text-bg-secondary">Tooth {img.tooth_number}</span>}
                <div className="fw-semibold mt-1">{img.description}</div>
                {!patientId && <div className="text-primary">{img.patient_name}</div>}
                <div className="text-muted">{fmtDate(img.taken_date)}</div>
                {img.notes && <div>{img.notes}</div>}
                <button className="btn btn-link btn-sm text-danger p-0 mt-1"
                  onClick={() => window.confirm('Delete image?') && run(() => del(`/images/${img.id}`)).then(reload)}>Delete</button>
              </div>
            </div>
          </div>
        ))}
      </div>
      <Modal title="Upload X-Ray / Image" show={show} onClose={() => setShow(false)}>
        <UploadForm patientId={patientId} onSaved={() => { setShow(false); reload(); }} />
      </Modal>
    </>
  );
}
