import { useState, useRef, useEffect } from 'react';
import { post } from '../services/api';
import { useRun } from './Toast';
import Markdown from './Markdown';

const PATIENT_HINTS = [
  'Summarize this patient\'s history',
  'What was done on the last visit?',
  'Any allergies I should know about before prescribing?',
  'Schedule a follow-up in 2 weeks for the current treatment',
];
const GLOBAL_HINTS = [
  'Who has pending payments above ₹3,000?',
  'Which patients are coming in today?',
  'Find Rahul and draft a follow-up in 1 week',
];

export default function AiAssistant({ patientId, onDraft }) {
  const [msgs, setMsgs] = useState([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [thread] = useState(() => String(Date.now()));
  const end = useRef(null);
  const run = useRun();

  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs, busy]);

  const send = async (text) => {
    const q = (text ?? input).trim();
    if (!q || busy) return;
    setInput('');
    setMsgs((m) => [...m, { role: 'user', text: q }]);
    setBusy(true);
    let res;
    const ok = await run(async () => { res = await post('/ai/ask', { question: q, patient_id: patientId ? Number(patientId) : null, thread_id: thread }); });
    setBusy(false);
    if (ok) {
      setMsgs((m) => [...m, { role: 'ai', ...res }]);
      if (res.drafts_created.length) onDraft && onDraft();
    }
  };

  return (
    <div className="card"><div className="card-body">
      <h5>{patientId ? 'Ask about this patient' : 'Ask the clinic assistant'}</h5>
      <div className="border rounded p-3 mb-3" style={{ height: 340, overflowY: 'auto', background: '#fafbfc' }}>
        {msgs.length === 0 && (
          <div className="text-muted">
            <div className="mb-2">Try:</div>
            {(patientId ? PATIENT_HINTS : GLOBAL_HINTS).map((h) => (
              <button key={h} className="btn btn-outline-secondary btn-sm me-2 mb-2" onClick={() => send(h)}>{h}</button>
            ))}
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={`d-flex mb-3 ${m.role === 'user' ? 'justify-content-end' : ''}`}>
            <div className={`rounded px-3 py-2 ${m.role === 'user' ? 'bg-primary text-white' : 'bg-white border'}`} style={{ maxWidth: '85%', whiteSpace: m.role === 'user' ? 'pre-wrap' : 'normal' }}>
              {m.role === 'user' ? m.text : <Markdown>{m.answer}</Markdown>}
              {m.tools_used?.length > 0 && <div className="small text-muted mt-2">🔎 used: {[...new Set(m.tools_used)].join(', ')}</div>}
              {m.drafts_created?.length > 0 && <div className="small mt-1 text-success">📝 {m.drafts_created.length} draft(s) waiting for your approval below</div>}
            </div>
          </div>
        ))}
        {busy && <div className="text-muted">Thinking…</div>}
        <div ref={end} />
      </div>
      <div className="input-group">
        <input className="form-control" placeholder="Ask a question or give an instruction…" value={input}
          onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} />
        <button className="btn btn-primary" disabled={busy} onClick={() => send()}>Send</button>
      </div>
      <div className="small text-muted mt-2">The assistant can only draft changes. Nothing is saved until you approve it.</div>
    </div></div>
  );
}
