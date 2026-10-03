import { useState } from 'react';
import { get } from '../services/api';
import { useRun } from './Toast';
import Markdown from './Markdown';

export default function AiBrief({ patientId }) {
  const [text, setText] = useState(null);
  const [busy, setBusy] = useState(false);
  const run = useRun();

  const generate = async () => {
    setBusy(true);
    let res;
    if (await run(async () => { res = await get(`/ai/patients/${patientId}/brief`); })) setText(res.brief);
    setBusy(false);
  };

  return (
    <div className="card border-info"><div className="card-body py-2">
      <div className="d-flex justify-content-between align-items-center">
        <strong>✨ Pre-visit brief</strong>
        <button className="btn btn-outline-info btn-sm" onClick={generate} disabled={busy}>{busy ? 'Generating…' : text ? 'Refresh' : 'Generate'}</button>
      </div>
      {text && <div className="mt-2"><Markdown>{text}</Markdown></div>}
      {text && <div className="small text-muted mt-2">AI-generated from the records - verify before relying on it.</div>}
    </div></div>
  );
}
