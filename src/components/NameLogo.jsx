/**
 * Name Logo — "La Cueva"
 * Stacked typographic logo: "LA" small Lato above "CUEVA" large Playfair Display.
 */

const SIZES = {
  sm: { la: 9, main: 14, gap: 1 },
  md: { la: 12, main: 20, gap: 2 },
  lg: { la: 16, main: 36, gap: 3 },
};

export default function NameLogo({ size = 'md', className = '' }) {
  const s = SIZES[size] || SIZES.md;

  return (
    <div className={className} style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center' }}>
      <span
        style={{
          fontFamily: 'var(--font-body)',
          fontWeight: 400,
          fontSize: s.la,
          color: 'var(--text-muted)',
          letterSpacing: '0.2em',
          lineHeight: 1,
          marginBottom: s.gap,
        }}
      >
        LA
      </span>
      <span
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 600,
          fontSize: s.main,
          color: 'var(--text)',
          letterSpacing: '0.04em',
          lineHeight: 1,
        }}
      >
        CUEVA
      </span>
    </div>
  );
}
