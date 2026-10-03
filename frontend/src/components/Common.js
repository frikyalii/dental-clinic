const COLORS = {
  Scheduled: 'primary', Completed: 'success', Cancelled: 'secondary', Planned: 'info',
  'In Progress': 'warning', Pending: 'warning', Paid: 'success', Partial: 'warning', Unpaid: 'danger',
};

export const StatusBadge = ({ status }) => <span className={`badge text-bg-${COLORS[status] || 'light'}`}>{status}</span>;

export const Loading = () => <div className="text-muted py-4 text-center">Loading…</div>;
export const Empty = ({ text }) => <div className="text-muted text-center py-4">{text}</div>;

export const PanelHeader = ({ title, onAdd, addLabel = '+ Add', children }) => (
  <div className="d-flex justify-content-between align-items-center mb-3 gap-2 flex-wrap">
    <h5 className="mb-0">{title}</h5>
    <div className="d-flex gap-2">
      {children}
      {onAdd && <button className="btn btn-primary btn-sm" onClick={onAdd}>{addLabel}</button>}
    </div>
  </div>
);

// Bootstrap modal controlled by React state (children are only mounted while open)
export function Modal({ title, show, onClose, children, size = '' }) {
  if (!show) return null;
  return (
    <>
      <div className="modal d-block" tabIndex="-1" onMouseDown={onClose}>
        <div className={`modal-dialog modal-dialog-centered modal-dialog-scrollable ${size}`} onMouseDown={(e) => e.stopPropagation()}>
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">{title}</h5>
              <button type="button" className="btn-close" onClick={onClose} />
            </div>
            <div className="modal-body">{children}</div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop show" />
    </>
  );
}
