import { useState } from 'react';
import { post } from '../services/api';
import { useRun } from './Toast';
import Markdown from './Markdown';

export default function DeepAnswer({ patientId }) {
  const [q, setQ] = useState('');
  const [res, setRes] = useState(null);
  const [busy, setBusy] = useState(false);
  const run = useRun();

  const ask = async (e) => {
    e.preventDefault();
    setBusy(true);
    setRes(null);
    let r;
    if (await run(async () => { r = await post('/ai/rag/ask', { question: q, patient_id: patientId ? Number(patientId) : null }); })) setRes(r);
    setBusy(false);
  };

  return (
    <div className="card border-primary"><div className="card-body">
      <h5 className="mb-1">📚 Deep answer <span className="badge text-bg-primary align-middle fs-6">agentic RAG</span></h5>
      <div className="small text-muted mb-3">
        Searches {patientId ? "this patient's chart records, their uploaded documents and the clinic knowledge base" : 'the clinic knowledge base (open a patient to include their records and documents)'},
        checks the passages, answers with citations and verifies the answer. Slower than chat (several AI steps).
      </div>
      <form onSubmit={ask} className="input-group mb-3">
        <input className="form-control" required value={q} onChange={(e) => setQ(e.target.value)}
          placeholder={patientId ? 'e.g. What was the latest HbA1c in the lab report, and is it safe to extract?' : 'e.g. What aftercare do we give after extraction?'} />
        <button className="btn btn-primary" disabled={busy}>{busy ? 'Researching…' : 'Ask'}</button>
      </form>

      {res && (
        <>
          <div className="d-flex gap-2 mb-2">
            {res.grounded
              ? <span className="badge text-bg-success">✓ verified against sources</span>
              : <span className="badge text-bg-warning">⚠ not fully verified - check the citations</span>}
          </div>
          <Markdown>{res.answer}</Markdown>
          {!res.grounded && res.issues.length > 0 && (
            <div className="alert alert-warning py-2 small mt-2 mb-0">Possibly unsupported: {res.issues.join('; ')}</div>
          )}
          {res.citations.length > 0 && (
            <div className="mt-3">
              <div className="fw-semibold small mb-1">Sources</div>
              {res.citations.map((c) => (
                <div key={c.n} className="small border-start border-3 ps-2 mb-2">
                  <b>[{c.n}]</b> {c.source} - {c.title}{c.page ? `, p.${c.page}` : ''}{c.ocr ? <span className="badge text-bg-warning ms-1" title="Text was read by OCR and may contain errors">OCR</span> : null}{c.date ? `, ${c.date}` : ''}
                  {c.doc_id && <> · <a href={`/ai/documents/${c.doc_id}/file`} target="_blank" rel="noreferrer">open file</a></>}
                  <div className="text-muted">{c.snippet}…</div>
                </div>
              ))}
            </div>
          )}
          <details className="small mt-2">
            <summary className="text-muted">How I answered</summary>
            <ol className="mb-0 mt-1">{res.trace.map((t, i) => <li key={i}>{t}</li>)}</ol>
          </details>
        </>
      )}
    </div></div>
  );
}
