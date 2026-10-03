import { useState } from 'react';
import { useFetch, post, del, fmtDate } from '../services/api';
import { Modal, Loading, PanelHeader, Empty } from './Common';
import { useRun } from './Toast';

const TYPES = ['Protocol / Guideline', 'Lab report', 'Referral letter', 'Consent form', 'Medical report', 'Insurance', 'Other'];

function UploadForm({ patientId, onSaved }) {
  const [file, setFile] = useState(null);
  const [docType, setDocType] = useState(patientId ? 'Lab report' : 'Protocol / Guideline');
  const [busy, setBusy] = useState(false);
  const run = useRun();

  const submit = async (e) => {
    e.preventDefault();
    const fd = new FormData();
    fd.append('file', file);
    fd.append('doc_type', docType);
    fd.append('scope', patientId ? 'patient' : 'clinic');
    if (patientId) fd.append('patient_id', patientId);
    setBusy(true);
    const ok = await run(() => post('/ai/documents/upload', fd), 'Document indexed');
    setBusy(false);
    if (ok) onSaved();
  };

  return (
    <form onSubmit={submit} className="row g-3">
      <div className="col-12">
        <label className="form-label small fw-semibold mb-1">File (PDF, DOCX, TXT, MD or an image)</label>
        <input type="file" accept=".pdf,.docx,.txt,.md,.png,.jpg,.jpeg,.webp" className="form-control" required onChange={(e) => setFile(e.target.files[0])} />
      </div>
      <div className="col-12">
        <label className="form-label small fw-semibold mb-1">Document type</label>
        <select className="form-select" value={docType} onChange={(e) => setDocType(e.target.value)}>
          {TYPES.map((t) => <option key={t}>{t}</option>)}
        </select>
      </div>
      <div className="col-12 small text-muted">
        The text is split into chunks and indexed so the AI can search and cite it. Scanned PDFs and photos are read with OCR, which can make mistakes - verify important values against the original.
      </div>
      <div className="col-12 text-end"><button className="btn btn-primary" disabled={busy || !file}>{busy ? 'Reading & indexing…' : 'Upload & index'}</button></div>
    </form>
  );
}

export default function DocumentsPanel({ patientId }) {
  const [rows, reload] = useFetch(patientId ? `/ai/documents?scope=patient&patient_id=${patientId}` : '/ai/documents?scope=clinic');
  const [show, setShow] = useState(false);
  const run = useRun();
  if (!rows) return <Loading />;

  return (
    <>
      <PanelHeader title={patientId ? 'Patient Documents' : '📚 Clinic Knowledge Base'} onAdd={() => setShow(true)} addLabel="+ Upload Document" />
      <p className="text-muted small">
        {patientId
          ? 'Lab reports, referral letters, consent forms… Indexed documents can be searched and cited in this patient\'s ✨ AI Assistant tab.'
          : 'Clinic protocols and guidelines. Indexed documents are searchable by the AI for every patient (e.g. aftercare instructions). Sample protocols are loaded on first use.'}
      </p>
      <div className="card"><div className="table-responsive">
        <table className="table table-hover align-middle mb-0">
          <thead><tr><th>Document</th><th>Type</th><th>Pages</th><th>Chunks</th><th>Uploaded</th><th /></tr></thead>
          <tbody>
            {rows.map((d) => (
              <tr key={d.id}>
                <td className="fw-semibold">{d.filename}{d.ocr > 0 && <span className="badge text-bg-warning ms-2" title="Text was read by OCR - verify against the original">OCR</span>}</td><td>{d.doc_type}</td><td>{d.pages || '—'}</td><td>{d.chunks}</td><td>{fmtDate(d.uploaded_at)}</td>
                <td className="text-end text-nowrap">
                  <a className="btn btn-sm btn-outline-primary me-1" href={`/ai/documents/${d.id}/file`} target="_blank" rel="noreferrer">Open</a>
                  <button className="btn btn-sm btn-outline-danger"
                    onClick={() => window.confirm(`Delete ${d.filename}?`) && run(() => del(`/ai/documents/${d.id}`), 'Document deleted').then(reload)}>✕</button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan="6"><Empty text="No documents yet." /></td></tr>}
          </tbody>
        </table>
      </div></div>
      <Modal title={patientId ? 'Upload patient document' : 'Upload clinic document'} show={show} onClose={() => setShow(false)}>
        <UploadForm patientId={patientId} onSaved={() => { setShow(false); reload(); }} />
      </Modal>
    </>
  );
}
