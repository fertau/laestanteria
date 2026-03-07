import { useState } from 'react';

export default function Stars({ value = 0, onChange, size = 20, readOnly = false }) {
  const [hover, setHover] = useState(0);

  return (
    <div
      style={{
        display: 'inline-flex',
        gap: 2,
        cursor: readOnly ? 'default' : 'pointer',
      }}
    >
      {[1, 2, 3, 4, 5].map((star) => {
        const active = hover ? star <= hover : star <= value;
        return (
          <span
            key={star}
            onClick={() => {
              if (readOnly) return;
              // Click same star again to remove rating
              if (star === value && onChange) {
                onChange(0);
              } else if (onChange) {
                onChange(star);
              }
            }}
            onMouseEnter={() => !readOnly && setHover(star)}
            onMouseLeave={() => !readOnly && setHover(0)}
            style={{
              fontSize: size,
              color: active ? 'var(--accent)' : 'var(--border)',
              transition: 'color 0.15s ease, transform 0.15s ease',
              transform: !readOnly && hover === star ? 'scale(1.2)' : 'scale(1)',
              userSelect: 'none',
            }}
          >
            {'★'}
          </span>
        );
      })}
    </div>
  );
}
