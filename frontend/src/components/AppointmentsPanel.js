import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useFetch, today } from '../services/api';
import AppointmentTable from './AppointmentTable';
import SimpleForm from './Form';
import { Modal, Loading, PanelHeader } from './Common';

const TYPES = ['Consultation', 'Check-up', 'Cleaning', 'Filling', 'Root Canal', 'Root Canal Follow-up', 'Extraction', 'Crown / Bridge', 'Implant', 'Orthodontic', 'Other'];

export default function AppointmentsPanel({ patientId }) {
  const [params] = useSearchParams();
  const [rows, reload] = useFetch(patientId ? `/patients/${patientId}/appointments` : '/appointments');
  const [show, setShow] = useState(params.get('new') === '1');
  if (!rows) return <Loading />;

  return (
    <>
      <PanelHeader title="Appointments" onAdd={() => setShow(true)} addLabel="+ New Appointment" />
      <AppointmentTable rows={rows} showPatient={!patientId} reload={reload} />
      <Modal title="New Appointment" show={show} onClose={() => setShow(false)}>
        <SimpleForm endpoint="/appointments" patientId={patientId} initial={{ appointment_date: today(), status: 'Scheduled' }}
          fields={[
            ['appointment_date', 'Date', { type: 'date', required: true }],
            ['appointment_time', 'Time', { type: 'time', required: true }],
            ['type', 'Appointment Type', { options: TYPES, required: true }],
            ['status', 'Status', { options: ['Scheduled', 'Completed', 'Cancelled'] }],
            ['notes', 'Notes', { type: 'textarea', col: 'col-12' }],
          ]}
          onSaved={() => { setShow(false); reload(); }} />
      </Modal>
    </>
  );
}
