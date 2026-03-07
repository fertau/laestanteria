import { useToast } from '../hooks/useToast';

const typeStyles = {
  success: { background: '#1a3a2a', borderColor: '#27ae60' },
  error: { background: '#3a1a1a', borderColor: '#c0392b' },
  info: { background: '#1a2a3a', borderColor: '#2980b9' },
};

export default function ToastContainer() {
  const { toasts, dismiss } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: 20,
      right: 20,
      zIndex: 10000,
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      maxWidth: 360,
    }}>
      {toasts.map((t) => (
        <div
          key={t.id}
          onClick={() => dismiss(t.id)}
          style={{
            padding: '12px 16px',
            borderRadius: 'var(--radius)',
            borderLeft: '3px solid',
            fontSize: 14,
            cursor: 'pointer',
            animation: 'slideIn 0.2s ease',
            ...typeStyles[t.type],
          }}
        >
          {t.message}
        </div>
      ))}
      <style>{`
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
