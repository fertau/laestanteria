/**
 * Name Logo — "La Estantería"
 * Tipographic logo with Playfair Display + Lato.
 * "La" in Lato Light (small, muted) + "Estantería" in Playfair Bold (cream).
 * Optional decorative gold underline.
 */

const SIZES = {
  sm: { la: 11, main: 16, line: false, gap: 3 },
  md: { la: 14, main: 22, line: true, gap: 4 },
  lg: { la: 18, main: 32, line: true, gap: 5 },
};

export default function NameLogo({ size = 'md', showLine = undefined, className = '' }) {
  const s = SIZES[size] || SIZES.md;
  const displayLine = showLine !== undefined ? showLine : s.line;

  return (
    <div className={className} style={{ display: 'inline-flex', flexDirection: 'column', alignItems: size === 'lg' ? 'center' : 'flex-start' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: s.gap }}>
        <span
          style={{
            fontFamily: 'var(--font-body)',
            fontWeight: 300,
            fontSize: s.la,
            color: 'var(--text-muted)',
            letterSpacing: '0.02em',
          }}
        >
          La
        </span>
        <span
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: s.main,
            color: 'var(--text)',
            letterSpacing: '-0.01em',
          }}
        >
          Estanteria
        </span>
      </div>
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
