import { createContext, useContext, useState } from 'react';

const ToastContext = createContext(() => {});
export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const show = (message, type = 'success') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3000);
  };
  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="toast-container position-fixed bottom-0 end-0 p-3">
        {toasts.map((t) => (
          <div key={t.id} className={`toast show text-bg-${t.type} border-0`}>
            <div className="toast-body">{t.message}</div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// const run = useRun();  const ok = await run(() => post(...), 'Saved!')
// Shows a success toast, or an error toast if the request fails. Returns true/false.
export function useRun() {
  const toast = useToast();
  return async (fn, okMessage) => {
    try {
      await fn();
      if (okMessage) toast(okMessage);
      return true;
    } catch (e) {
      toast(e.response?.data?.error || e.response?.data?.detail || 'Something went wrong', 'danger');
      return false;
    }
  };
}
