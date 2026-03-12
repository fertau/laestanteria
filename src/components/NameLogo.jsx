/**
 * Name Logo — "La Estanteria"
 * Unified typographic logo — all letters same size, Playfair Display Bold.
 */

const SIZES = {
  sm: { fontSize: 16 },
  md: { fontSize: 22 },
  lg: { fontSize: 32 },
};

export default function NameLogo({ size = 'md', className = '' }) {
  const s = SIZES[size] || SIZES.md;

  return (
    <span
      className={className}
      style={{
        fontFamily: 'var(--font-display)',
        fontWeight: 700,
        fontSize: s.fontSize,
        color: 'var(--text)',
        letterSpacing: '-0.01em',
      }}
    >
      La Estanteria
    </span>
  );
}
