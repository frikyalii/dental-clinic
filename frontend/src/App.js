import { Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Navbar from './components/Navbar';
import { ToastProvider } from './components/Toast';
import Dashboard from './pages/Dashboard';
import Patients from './pages/Patients';
import PatientDetails from './pages/PatientDetails';
import Appointments from './pages/Appointments';
import Consultations from './pages/Consultations';
import Treatments from './pages/Treatments';
import Prescriptions from './pages/Prescriptions';
import XRays from './pages/XRays';
import Billing from './pages/Billing';
import Followups from './pages/Followups';
import AiPage from './pages/AiPage';
import KnowledgeBase from './pages/KnowledgeBase';

export default function App() {
  return (
    <ToastProvider>
      <Sidebar />
      <div className="main-area">
        <Navbar />
        <div className="content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/patients" element={<Patients />} />
            <Route path="/patients/:id" element={<PatientDetails />} />
            <Route path="/appointments" element={<Appointments />} />
            <Route path="/consultations" element={<Consultations />} />
            <Route path="/treatments" element={<Treatments />} />
            <Route path="/prescriptions" element={<Prescriptions />} />
            <Route path="/xrays" element={<XRays />} />
            <Route path="/billing" element={<Billing />} />
            <Route path="/followups" element={<Followups />} />
            <Route path="/ai" element={<AiPage />} />
            <Route path="/knowledge" element={<KnowledgeBase />} />
          </Routes>
        </div>
      </div>
    </ToastProvider>
  );
}
