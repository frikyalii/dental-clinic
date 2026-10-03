import { NavLink } from 'react-router-dom';

const LINKS = [
  ['/', 'Dashboard'], ['/patients', 'Patients'], ['/appointments', 'Appointments'],
  ['/consultations', 'Consultations'], ['/treatments', 'Treatments'], ['/prescriptions', 'Prescriptions'],
  ['/xrays', 'X-Rays'], ['/billing', 'Billing'], ['/followups', 'Follow-ups'], ['/ai', '✨ AI Assistant'], ['/knowledge', '📚 Knowledge Base'],
];

export default function Sidebar() {
  return (
    <nav className="sidebar">
      <div className="brand">🦷 Dental Clinic</div>
      {LINKS.map(([to, label]) => (
        <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => (isActive ? 'active' : '')}>{label}</NavLink>
      ))}
    </nav>
  );
}
