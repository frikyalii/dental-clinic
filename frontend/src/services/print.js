import { fmtDate, money } from './api';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function printHtml(title, body) {
  const w = window.open('', '_blank', 'width=820,height=900');
  if (!w) return alert('Please allow pop-ups to print.');
  w.document.write(`<html><head><title>${title}</title><style>
    body{font-family:Arial,sans-serif;padding:36px;color:#222}
    .hdr{border-bottom:3px solid #0d6efd;padding-bottom:10px;margin-bottom:18px}
    h1{margin:0;font-size:24px} table{width:100%;border-collapse:collapse;margin-top:14px}
    ul,ol{padding-left:22px} h1,h2,h3,h4{margin:14px 0 6px} th,td{border:1px solid #999;padding:7px 9px;text-align:left} th{background:#eef3fb} .r{text-align:right}
    .sign{margin-top:70px;text-align:right}
  </style></head><body>${body}</body></html>`);
  w.document.close();
  w.focus();
  w.print();
}

const header = (title) => `<div class="hdr"><h1>🦷 Dental Clinic</h1><div>${title}</div></div>`;

// bodyHtml is already-rendered (trusted) HTML, e.g. from rendered Markdown
export function printText(title, patientName, bodyHtml) {
  printHtml(title, `${header(title)}<p><b>Patient:</b> ${esc(patientName)}</p><div style="line-height:1.6">${bodyHtml}</div>`);
}

export function printPrescription(rx) {
  const rows = rx.items.map((i, n) =>
    `<tr><td>${n + 1}</td><td>${esc(i.medicine)}</td><td>${esc(i.dosage)}</td><td>${esc(i.frequency)}</td><td>${esc(i.duration)}</td><td>${esc(i.instructions)}</td></tr>`).join('');
  printHtml('Prescription', `${header('Prescription')}
    <p><b>Patient:</b> ${esc(rx.patient_name)} (${esc(rx.patient_code)}) &nbsp; <b>Age/Gender:</b> ${esc(rx.age)} / ${esc(rx.gender)}<br>
    <b>Date:</b> ${fmtDate(rx.created_at)}</p>
    <h3>Rx</h3>
    <table><tr><th>#</th><th>Medicine</th><th>Dosage</th><th>Frequency</th><th>Duration</th><th>Instructions</th></tr>${rows}</table>
    ${rx.notes ? `<p><b>Notes:</b> ${esc(rx.notes)}</p>` : ''}
    <div class="sign">Dentist's signature: ____________________</div>`);
}

export function printInvoice(i) {
  const no = 'INV-' + String(i.id).padStart(4, '0');
  printHtml('Invoice', `${header('Invoice / Receipt')}
    <p><b>Invoice No:</b> ${no} &nbsp; <b>Date:</b> ${fmtDate(i.created_at)}<br>
    <b>Patient:</b> ${esc(i.patient_name)} (${esc(i.patient_code)})</p>
    <table>
      <tr><th>Treatment</th><th class="r">Amount</th></tr>
      <tr><td>${esc(i.treatment_name)}</td><td class="r">${money(i.amount)}</td></tr>
      <tr><td>Discount</td><td class="r">- ${money(i.discount)}</td></tr>
      <tr><td><b>Total</b></td><td class="r"><b>${money(i.total)}</b></td></tr>
      <tr><td>Paid</td><td class="r">${money(i.paid)}</td></tr>
      <tr><td><b>Pending</b></td><td class="r"><b>${money(i.pending)}</b></td></tr>
    </table>
    <p style="margin-top:40px">Thank you for visiting.</p>`);
}
