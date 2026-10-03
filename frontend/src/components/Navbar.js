export default function Navbar() {
  const date = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  return (
    <div className="topbar d-flex justify-content-between align-items-center">
      <span className="fw-semibold">Patient Management</span>
      <span className="text-muted small">{date}</span>
    </div>
  );
}
