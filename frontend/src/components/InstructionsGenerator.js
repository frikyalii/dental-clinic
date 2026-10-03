import { useState } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ReactMarkdown from 'react-markdown';
import { post } from '../services/api';
import { printText } from '../services/print';
import { useForm, Field } from './Form';
import Markdown from './Markdown';
import { useRun } from './Toast';

export default function InstructionsGenerator({ patientId }) {
  const form = useForm({ language: 'English', topic: '' });
  const [result, setResult] = useState(null);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const run = useRun();

  const generate = async (e) => {
    e.preventDefault();
    setBusy(true);
    setEditing(false);
    let res;
    if (await run(async () => { res = await post('/ai/instructions', { patient_id: Number(patientId), ...form.values }); })) setResult(res);
    setBusy(false);
  };

  const print = () => {
    const html = renderToStaticMarkup(<ReactMarkdown>{result.text}</ReactMarkdown>); // same formatting as the preview
    printText('Care Instructions', result.patient_name, html);
  };

  return (
    <div className="card"><div className="card-body">
      <h5>Patient care instructions</h5>
      <form onSubmit={generate} className="row g-2 align-items-end">
        <Field form={form} name="topic" label="Topic" placeholder="e.g. Root canal aftercare, tooth extraction" required col="col-md-6" />
        <Field form={form} name="language" label="Language" options={['English', 'Hindi', 'Marathi']} col="col-md-3" />
        <div className="col-md-3"><button className="btn btn-primary w-100" disabled={busy}>{busy ? 'Writing…' : 'Generate'}</button></div>
      </form>

      {result && (
        <div className="mt-3">
          {editing ? (
            <textarea className="form-control" rows="12" value={result.text} onChange={(e) => setResult({ ...result, text: e.target.value })} />
          ) : (
            <div className="border rounded p-3 bg-white"><Markdown>{result.text}</Markdown></div>
          )}
          <div className="d-flex justify-content-between align-items-center mt-2">
            <span className="small text-muted">Review before giving it to the patient.</span>
            <div className="d-flex gap-2">
              <button className="btn btn-outline-secondary btn-sm" onClick={() => setEditing(!editing)}>{editing ? '✓ Done editing' : '✏️ Edit text'}</button>
              <button className="btn btn-success btn-sm" onClick={print}>🖨️ Print</button>
            </div>
          </div>
        </div>
      )}
    </div></div>
  );
}
