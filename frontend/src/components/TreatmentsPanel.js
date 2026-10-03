import { useState } from 'react';
import { useFetch } from '../services/api';
import TreatmentCard from './TreatmentCard';
import SimpleForm from './Form';
import { Modal, Loading, PanelHeader, Empty } from './Common';

export default function TreatmentsPanel({ patientId }) {
  const [rows, reload] = useFetch(patientId ? `/patients/${patientId}/treatments` : '/treatments');
  const [show, setShow] = useState(false);
  if (!rows) return <Loading />;

  return (
    <>
      <PanelHeader title="Treatment Plans" onAdd={() => setShow(true)} addLabel="+ Add Treatment" />
      {rows.length === 0 && <Empty text="No treatments yet." />}
      <div className="row g-3">
        {rows.map((t) => <div key={t.id} className="col-lg-6"><TreatmentCard t={t} showPatient={!patientId} reload={reload} /></div>)}
      </div>

      <Modal title="Add Treatment" show={show} onClose={() => setShow(false)}>
        <SimpleForm endpoint="/treatments" patientId={patientId} initial={{ status: 'Planned', sessions_planned: 1, cost: 0 }}
          fields={[
            ['name', 'Treatment Name', { required: true, col: 'col-12' }],
            ['tooth_number', 'Tooth Number'],
            ['diagnosis', 'Diagnosis'],
            ['cost', 'Cost (₹)', { type: 'number', min: 0 }],
            ['sessions_planned', 'Number of Sessions', { type: 'number', min: 1 }],
            ['status', 'Status', { options: ['Planned', 'In Progress', 'Completed', 'Cancelled'] }],
            ['notes', 'Notes', { type: 'textarea', col: 'col-12' }],
          ]}
          onSaved={() => { setShow(false); reload(); }} />
      </Modal>
    </>
  );
}
