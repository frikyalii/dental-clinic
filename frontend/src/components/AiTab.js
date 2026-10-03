import { useState } from 'react';
import AiAssistant from './AiAssistant';
import DraftsPanel from './DraftsPanel';
import InstructionsGenerator from './InstructionsGenerator';
import DeepAnswer from './DeepAnswer';

// patientId given -> scoped to that patient (Patient Details tab); missing -> clinic-wide assistant page
export default function AiTab({ patientId }) {
  const [n, setN] = useState(0); // bump to refresh the drafts list after the assistant creates one
  return (
    <div className="d-flex flex-column gap-4">
      <AiAssistant patientId={patientId} onDraft={() => setN((x) => x + 1)} />
      <DeepAnswer patientId={patientId} />
      <DraftsPanel key={n} patientId={patientId} />
      {patientId && <InstructionsGenerator patientId={patientId} />}
    </div>
  );
}
