export const CONDITIONS = ['Healthy', 'Caries', 'Filling', 'Crown', 'Root Canal', 'Extraction', 'Missing', 'Implant', 'Infection', 'Fracture', 'Other'];

export const COLORS = {
  Healthy: '#d1e7dd', Caries: '#f5c2c7', Filling: '#cfe2ff', Crown: '#fff3cd', 'Root Canal': '#d9c7f2',
  Extraction: '#adb5bd', Missing: '#dee2e6', Implant: '#9fd8c0', Infection: '#ee8f9a', Fracture: '#ffd8a8', Other: '#e9ecef',
};

export default function Tooth({ number, data, onClick }) {
  const condition = data?.tooth_condition;
  return (
    <button type="button" className="tooth" style={{ background: COLORS[condition] || '#fff' }}
      title={condition ? `${condition}${data.notes ? ' - ' + data.notes : ''}` : 'No record'} onClick={() => onClick(number)}>
      {number}
    </button>
  );
}
