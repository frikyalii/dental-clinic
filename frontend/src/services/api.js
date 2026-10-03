import axios from 'axios';
import { useState, useEffect, useCallback } from 'react';

const api = axios.create({ baseURL: '/api' });
const aiClient = axios.create({ timeout: 120000 }); // hosted model calls can take a while
export default api;

// URLs starting with /ai/ go to the Python AI service, everything else to the Express API
const client = (url) => (url.startsWith('/ai/') ? aiClient : api);
export const get = (url) => client(url).get(url).then((r) => r.data);
export const post = (url, data) => client(url).post(url, data).then((r) => r.data);
export const put = (url, data) => client(url).put(url, data).then((r) => r.data);
export const del = (url) => client(url).delete(url).then((r) => r.data);

// const [data, reload] = useFetch('/patients')   (data is null while loading)
export function useFetch(url) {
  const [data, setData] = useState(null);
  const load = useCallback(() => get(url).then(setData).catch((e) => console.error(e)), [url]);
  useEffect(() => { load(); }, [load]);
  return [data, load];
}

// ---- formatting helpers ----
export const today = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
export const fmtDate = (d) =>
  d ? new Date(d.slice(0, 10) + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
export const fmtTime = (t) => {
  if (!t) return '';
  const [h, m] = t.split(':');
  return `${+h % 12 || 12}:${m} ${+h >= 12 ? 'PM' : 'AM'}`;
};
export const fmtDateTime = (d) => (d ? `${fmtDate(d)}, ${fmtTime(d.slice(11, 16))}` : '—');
export const money = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');
