import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useFetch } from '../services/api';
import PatientCard from '../components/PatientCard';
import Overview from '../components/Overview';
import MedicalHistory from '../components/MedicalHistory';
import DentalChart from '../components/DentalChart';
import ConsultationsPanel from '../components/ConsultationsPanel';
import TreatmentsPanel from '../components/TreatmentsPanel';
import ImagesPanel from '../components/ImagesPanel';
import PrescriptionsPanel from '../components/PrescriptionsPanel';
import AppointmentsPanel from '../components/AppointmentsPanel';
import BillingPanel from '../components/BillingPanel';
import FollowupsPanel from '../components/FollowupsPanel';
import Timeline from '../components/Timeline';
import AiTab from '../components/AiTab';
import DocumentsPanel from '../components/DocumentsPanel';
import { Loading } from '../components/Common';

const TABS = {
  'Overview': Overview,
  'Medical History': MedicalHistory,
  'Dental Chart': DentalChart,
  'Consultations': ConsultationsPanel,
  'Treatment': TreatmentsPanel,
  'X-Rays': ImagesPanel,
  'Documents': DocumentsPanel,
  'Prescriptions': PrescriptionsPanel,
  'Appointments': AppointmentsPanel,
  'Billing': BillingPanel,
  'Follow-ups': FollowupsPanel,
  'Timeline': Timeline,
  '✨ AI Assistant': AiTab,
};

export default function PatientDetails() {
  const { id } = useParams();
  const [patient] = useFetch(`/patients/${id}`);
  const [tab, setTab] = useState('Overview');
  if (!patient) return <Loading />;

  const Panel = TABS[tab];
  return (
    <>
      <PatientCard patient={patient} />
      <ul className="nav nav-tabs mb-3 flex-nowrap overflow-auto">
        {Object.keys(TABS).map((name) => (
          <li key={name} className="nav-item">
            <button className={`nav-link text-nowrap ${tab === name ? 'active' : ''}`} onClick={() => setTab(name)}>{name}</button>
          </li>
        ))}
      </ul>
      <Panel key={tab} patientId={id} />
    </>
  );
}
