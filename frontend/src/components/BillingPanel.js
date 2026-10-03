import { useState } from 'react';
import { useFetch, del, fmtDate, today, money } from '../services/api';
import { printInvoice } from '../services/print';
import SimpleForm from './Form';
import { Modal, Loading, PanelHeader, StatusBadge } from './Common';
import { useRun } from './Toast';

const METHODS = ['Cash', 'UPI', 'Card', 'Bank Transfer'];
const state = (i) => (i.pending <= 0 ? 'Paid' : i.paid > 0 ? 'Partial' : 'Unpaid');

export default function BillingPanel({ patientId }) {
  const [rows, reload] = useFetch(patientId ? `/patients/${patientId}/billing` : '/billing');
  const [showNew, setShowNew] = useState(false);
  const [payFor, setPayFor] = useState(null);
  const run = useRun();
  if (!rows) return <Loading />;

  const sum = (key) => rows.reduce((s, r) => s + r[key], 0);

  return (
    <>
      <PanelHeader title="Billing" onAdd={() => setShowNew(true)} addLabel="+ New Invoice" />
      <div className="row g-3 mb-3 text-center">
        {[['Total', sum('total'), 'primary'], ['Paid', sum('paid'), 'success'], ['Pending', sum('pending'), 'danger']].map(([l, v, c]) => (
          <div key={l} className="col-4"><div className="card"><div className="card-body py-2">
            <div className="text-muted small">{l}</div><div className={`fs-5 fw-bold text-${c}`}>{money(v)}</div>
          </div></div></div>
        ))}
      </div>

      <div className="card"><div className="table-responsive">
        <table className="table table-hover align-middle mb-0">
          <thead><tr><th>Invoice</th>{!patientId && <th>Patient</th>}<th>Date</th><th>Treatment</th><th>Total</th><th>Paid</th><th>Pending</th><th>Status</th><th /></tr></thead>
          <tbody>
            {rows.map((i) => (
              <tr key={i.id}>
                <td>INV-{String(i.id).padStart(4, '0')}</td>
                {!patientId && <td>{i.patient_name}</td>}
                <td>{fmtDate(i.created_at)}</td><td>{i.treatment_name}</td>
                <td>{money(i.total)}</td><td>{money(i.paid)}</td><td>{money(i.pending)}</td>
                <td><StatusBadge status={state(i)} /></td>
                <td className="text-end text-nowrap">
                  {i.pending > 0 && <button className="btn btn-sm btn-outline-success me-1" onClick={() => setPayFor(i)}>+ Payment</button>}
                  <button className="btn btn-sm btn-outline-primary me-1" onClick={() => printInvoice(i)}>Invoice</button>
                  <button className="btn btn-sm btn-outline-danger"
                    onClick={() => window.confirm('Delete invoice and its payments?') && run(() => del(`/invoices/${i.id}`)).then(reload)}>✕</button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan="9" className="text-center text-muted py-4">No invoices yet.</td></tr>}
          </tbody>
        </table>
      </div></div>

      <Modal title="New Invoice" show={showNew} onClose={() => setShowNew(false)}>
        <SimpleForm endpoint="/invoices" patientId={patientId}
          initial={{ discount: 0, amount_paid: 0, payment_method: 'Cash', payment_date: today() }}
          fields={[
            ['treatment_name', 'Treatment', { required: true, col: 'col-12' }],
            ['amount', 'Amount (₹)', { type: 'number', min: 0, required: true, col: 'col-md-4' }],
            ['discount', 'Discount (₹)', { type: 'number', min: 0, col: 'col-md-4' }],
            ['amount_paid', 'Amount Paid (₹)', { type: 'number', min: 0, col: 'col-md-4' }],
            ['payment_date', 'Payment Date', { type: 'date' }],
            ['payment_method', 'Payment Method', { options: METHODS }],
          ]}
          onSaved={() => { setShowNew(false); reload(); }} />
        <div className="small text-muted mt-2">Total = Amount − Discount. Pending = Total − Amount Paid.</div>
      </Modal>

      <Modal title={payFor ? `Add payment — ${payFor.treatment_name} (pending ${money(payFor.pending)})` : ''} show={!!payFor} onClose={() => setPayFor(null)}>
        {payFor && (
          <SimpleForm endpoint="/payments" noPatient initial={{ invoice_id: payFor.id, amount: payFor.pending, payment_date: today(), method: 'Cash' }}
            fields={[
              ['amount', 'Amount (₹)', { type: 'number', min: 1, max: payFor.pending, required: true }],
              ['payment_date', 'Payment Date', { type: 'date' }],
              ['method', 'Payment Method', { options: METHODS }],
            ]}
            onSaved={() => { setPayFor(null); reload(); }} />
        )}
      </Modal>
    </>
  );
}
