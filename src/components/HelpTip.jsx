import { useState, useRef, useEffect } from 'react';
import { HelpCircle } from 'lucide-react';

/**
 * HelpTip — small "?" icon that shows a tooltip on hover/tap.
 *
 * @param {string} text - The help text to show
 * @param {number} [size=14] - Icon size
 * @param {'top'|'bottom'|'left'|'right'} [position='top'] - Tooltip position
 */
export default function HelpTip({ text, size = 14, position = 'top' }) {
  const [visible, setVisible] = useState(false);
  const tipRef = useRef(null);
  const timeoutRef = useRef(null);

  // Close on outside tap (mobile)
  useEffect(() => {
    if (!visible) return;
    const handler = (e) => {
      if (tipRef.current && !tipRef.current.contains(e.target)) {
        setVisible(false);
      }
    };
    document.addEventListener('pointerdown', handler);
    return () => document.removeEventListener('pointerdown', handler);
  }, [visible]);

  const show = () => {
    clearTimeout(timeoutRef.current);
    setVisible(true);
  };

  const hide = () => {
    timeoutRef.current = setTimeout(() => setVisible(false), 150);
  };

  const positionStyles = {
    top: { bottom: '100%', left: '50%', transform: 'translateX(-50%)', marginBottom: 6 },
    bottom: { top: '100%', left: '50%', transform: 'translateX(-50%)', marginTop: 6 },
    left: { right: '100%', top: '50%', transform: 'translateY(-50%)', marginRight: 6 },
    right: { left: '100%', top: '50%', transform: 'translateY(-50%)', marginLeft: 6 },
  };

  return (
    <span
      ref={tipRef}
      onMouseEnter={show}
      onMouseLeave={hide}
      onClick={(e) => { e.stopPropagation(); setVisible((v) => !v); }}
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        cursor: 'help',
        marginLeft: 4,
        verticalAlign: 'middle',
      }}
    >
      <HelpCircle
        size={size}
        style={{
          color: visible ? 'var(--accent)' : 'var(--text-dim)',
          transition: 'color var(--transition)',
        }}
      />
      {visible && (
        <span
          style={{
            position: 'absolute',
            ...positionStyles[position],
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            padding: '8px 12px',
            fontSize: 12,
            lineHeight: 1.5,
            color: 'var(--text-muted)',
            whiteSpace: 'normal',
            width: 220,
            zIndex: 100,
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            pointerEvents: 'auto',
          }}
        >
          {text}
        </span>
      )}
    </span>
  );
}
