/**
 * Name Logo — "La Estanteria"
 * Unified typographic logo — all letters same size, Playfair Display Bold.
 * Optional decorative gold underline.
 */

const SIZES = {
  sm: { fontSize: 16, line: false },
  md: { fontSize: 22, line: true },
  lg: { fontSize: 32, line: true },
};

export default function NameLogo({ size = 'md', showLine = undefined, className = '' }) {
  const s = SIZES[size] || SIZES.md;
  const displayLine = showLine !== undefined ? showLine : s.line;

  return (
    <div className={className} style={{ display: 'inline-flex', flexDirection: 'column', alignItems: size === 'lg' ? 'center' : 'flex-start' }}>
      <span
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
      {displayLine && (
        <div
          style={{
            width: '40%',
            height: 2,
            background: 'var(--accent)',
            borderRadius: 1,
            marginTop: size === 'lg' ? 6 : 4,
            alignSelf: size === 'lg' ? 'center' : 'flex-start',
            opacity: 0.7,
          }}
        />
      )}
    </div>
  );
}
